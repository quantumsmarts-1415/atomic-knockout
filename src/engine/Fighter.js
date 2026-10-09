import * as Phaser from 'phaser';
import { Rig } from './Rig.js';
import { applyDefense } from '../data/characters.js';
import { resolveMoveDamage, resolvePacket, TUNING } from '../data/balance.js';
import { applyImmunities, interceptHit } from './defense.js';
import { applyOnCast, applyOnHit, bonusPackets, combatOpts, prepareMove, tickKit } from './kit.js';
import { playVfx } from './MoveVfx.js';
import { play as sfx, playHit } from './sfx.js';
import {
  FEEL, hitlagFrames, frameData, smashUnits, hitstunFrames, launchAngle,
  launchVelocity, applyDI, decayLaunch, leavesBlast, takeBuffered, TYPE_COLOR,
} from './feel.js';

// ---------------------------------------------------------------------------
// Fighter — one combatant. Reads everything character-specific from its
// charDef (see src/data/characters.js); contains zero per-character logic.
//
// Input is abstracted: each frame the owner (keyboard mapper, bot AI, or
// phone controller) writes into fighter.input = { left, right, down, jump,
// attack, special } booleans. `jump/attack/special` are edge-triggered by
// this class; `left/right/down` are read as held state, and `jump` doubles
// as the held "up" signal for move-slot gating (see dirHeld in update()).
//
// Each of the two buttons has two variants, chosen by whether a direction is
// held at the moment of the press (2026-08-05 move-architecture change):
//   attack + direction  -> charDef.moves.basicDirectional   (melee)
//   attack, no direction -> charDef.moves.basicCharge        (hold-to-charge)
//   special + direction -> charDef.moves.specialDirectional (burst/projectile)
//   special, no direction -> charDef.moves.specialDefense    (block/counter)
// basicCharge/specialDefense are optional -- a character without one yet
// falls back to its directional move (see the attacks section in update()).
// ---------------------------------------------------------------------------

const GRAVITY = 1500;

/** Damage after the derived combat profile, or the legacy 5%-per-point
 *  table when the defender has no element record (engine tests). */
function dealtDamage(attacker, move, defender) {
  const now = defender.scene?.time?.now ?? 0;
  move = prepareMove(move, attacker, defender, now);
  const opts = combatOpts(defender);
  if (move?.chemDealtMult) opts.chemDealtMult = move.chemDealtMult;
  if (move?.ignoreDefense) opts.ignoreDefense = true;
  if (defender.charDef?.combat) {
    const resolved = resolveMoveDamage(move, attacker?.charDef, defender.charDef, opts);
    for (const bonus of bonusPackets(attacker, now)) {
      const dealt = resolvePacket(bonus.damage, bonus.type, attacker?.charDef?.combat, defender.charDef.combat, opts);
      resolved.packets.push({ type: bonus.type, base: bonus.damage, dealt, bonus: true });
      resolved.total += dealt;
    }
    if (move?.flareHeat && (defender.burnUntil > now || defender.heatOnHitUntil > now)) {
      const dealt = resolvePacket(move.flareHeat, 'heat', attacker?.charDef?.combat, defender.charDef.combat, opts);
      resolved.packets.push({ type: 'heat', base: move.flareHeat, dealt, bonus: true });
      resolved.total += dealt;
    }
    return resolved;
  }
  let total = applyDefense(move.damage ?? 0, move.type, defender.charDef?.defense);
  const packets = [{ type: move.type, dealt: total }];
  if (move.type2) {
    const extra = applyDefense(move.damage2 ?? move.damage ?? 0, move.type2, defender.charDef?.defense);
    total += extra;
    packets.push({ type: move.type2, dealt: extra });
  }
  return { total, packets };
}

export default class Fighter extends Phaser.GameObjects.Container {
  constructor(scene, x, y, charDef, paletteIndex, playerIndex) {
    super(scene, x, y);
    this.charDef = charDef;
    this.playerIndex = playerIndex;
    this.paletteIndex = paletteIndex;

    this.rig = new Rig(scene, charDef, paletteIndex);
    this.add(this.rig);
    scene.add.existing(this);

    const w = Rig.widthOf(charDef);
    const h = Rig.heightOf(charDef);
    this.bodyW = w;
    this.bodyH = h;
    scene.physics.add.existing(this);
    this.body.setSize(w, h);
    this.body.setOffset(-w / 2, -h);
    this.body.gravity.y = GRAVITY * charDef.stats.gravityScale - GRAVITY;
    this.body.maxVelocity.y = 1400;

    // match state
    this.percent = 0;
    this.stocks = 3;
    this.facing = 1;
    this.airJumpsLeft = charDef.stats.airJumps;
    this.state = 'idle'; // idle|walk|jump|fall|attack|hurt|ko|dead
    this.stateUntil = 0;
    this.attackCooldownUntil = 0;
    this.specialCooldownUntil = 0;
    this.activeHit = null;   // current live hitbox descriptor
    this.spawnPoint = { x, y };
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.dealtByType = {};
    this.takenByType = {};
    this.kos = 0;
    this.alive = true;

    this.input = { left: false, right: false, down: false, jump: false, attack: false, special: false };
    this._prev = { jump: false, attack: false, special: false };
    this.chargeStart = null;   // set while state === 'charging'
    this.defenseMove = null;   // the move def driving state === 'defending'
    this.wallLanded = null;    // Set of fighters already hit, for wall-kind defending
    this.dashUntil = 0;        // forward-velocity override window for kind:'dash' melee
    this.buffer = [];
    this.hitlagFrames = 0;
    this.launch = null;
    this.attackFrame = 0;
    this.frameData = null;
    this._shakeX = 0;
    this._shakeY = 0;
  }

  get isBusy() {
    return this.state === 'attack' || this.state === 'hurt' || this.state === 'ko' || this.state === 'dead' ||
      this.state === 'charging' || this.state === 'defending' || this.state === 'jumpsquat' || this.state === 'ledge';
  }

  update(time, dt) {
    if (this.state === 'dead') return;
    if (this.state === 'ko' && this._koHide > 0) {
      this._koHide -= 1;
      if (this._koHide <= 0) this.setVisible(false);
    }
    const stats = this.charDef.stats;
    const onGround = this.body.blocked.down || this.body.touching.down;

    if (onGround) {
      this.airJumpsLeft = stats.airJumps;
      this.ledgeRegrab = false;
      this.fastFell = false;
      this.fallPeak = 0;
    } else {
      this.fallPeak = Math.max(this.fallPeak || 0, this.body.velocity.y);
    }

    const step = this.scene?.stepMs || FEEL.stepMs;
    if (this.hitlagFrames > 0) {
      this.shiftTimers(step);
      this.hitlagFrames -= 1;
      if (this.hitlagFrames === 0) this.releaseLaunch(time);
      else this.body.setVelocity(0, 0);
      this.shakeForHitlag();
      const creep = this._hitlagRole === 'attacker' ? FEEL.hitlagCreep : 0;
      this.rig?.animate?.((step / 1000) * creep, this._hitlagRole === 'attacker' ? (this.state === 'attack' ? 'attack' : 'idle') : 'hurt', 0);
      this.captureEdges(time);
      return;
    }
    this._shakeX = 0;
    this._shakeY = 0;
    this.peelLaunch();

    if (this.state === 'ledge') {
      this.holdLedge(time, step);
      this.rig.facing = this.facing;
      this.rig.animate?.(dt / 1000, 'ledge', 0);
      return;
    }

    // timed states expire
    if ((this.state === 'attack' || this.state === 'hurt' || this.state === 'defending') && time >= this.stateUntil) {
      if (this.state === 'defending' && this.defenseMove?.openAfter) {
        this.vulnerableUntil = time + (this.defenseMove.vulnerableMs ?? 650);
      }
      if (this.state === 'defending') {
        this.lingerHardening(time);
        this.scene?.dropPins?.(this);
      }
      this.state = 'idle';
      this.rig.setFlash(null);
      this.rig.attackSwing = 0;
      this.activeHit = null;
      this.defenseMove = null;
    }
    tickKit(this, time);
    if (this.state === 'defending' && this.defenseMove?.regen && time >= (this._regenAt ?? 0)) {
      this._regenAt = time + (this.defenseMove.regenEvery ?? 800);
      this.percent = Math.max(0, this.percent - this.defenseMove.regen);
    }
    if (this.state === 'defending' && this.defenseMove?.drain && time >= (this._drainAt ?? 0)) {
      const d = this.defenseMove.drain;
      this._drainAt = time + (d.every ?? 1000);
      const cost = d.damage ?? 2;
      this.percent = Math.min(999, this.percent + cost);
      this.damageTaken += cost;
      this.takenByType[d.type ?? 'radiation'] = (this.takenByType[d.type ?? 'radiation'] ?? 0) + cost;
      this.scene?.noteDot?.(this, d.type ?? 'radiation', cost);
    }

    const inp = this.input;
    if (this.driftUntil > time && Math.floor(time / 180) % 2 === 0) {
      const left = inp.left;
      inp.left = inp.right;
      inp.right = left;
    }
    let pressedJump = inp.jump && !this._prev.jump;
    let pressedAttack = inp.attack && !this._prev.attack;
    let pressedSpecial = inp.special && !this._prev.special;
    const releasedAttack = !inp.attack && this._prev.attack;
    this._prev.jump = inp.jump;
    this._prev.attack = inp.attack;
    this._prev.special = inp.special;

    // "direction held" for the basic/special move-slot gating: left/right are
    // the normal movement keys, down is new, up reuses the jump key's
    // held-state rather than adding a dedicated key (Benjamin's choice).
    const dirHeld = inp.left || inp.right || inp.down || inp.jump;

    // --- movement (locked out while hurt/KO'd/charging/defending; allowed
    // while attacking in air)
    const locked = this.lockedUntil > time;
    if (locked) this.body.setVelocityX(0);
    if (!locked && this.state !== 'hurt' && this.state !== 'ko' && this.state !== 'charging' && this.state !== 'defending') {
      let speed = stats.speed;
      if (this.speedBuffUntil > time) speed *= this.speedBuff ?? 1;
      if (this.slowUntil > time) speed *= 0.55;
      let vx = 0;
      if (inp.left) vx -= speed;
      if (inp.right) vx += speed;
      if (this.rootedUntil > time) vx = 0;
      if (this.state === 'attack' && onGround) vx *= 0.25; // plant feet on ground attacks
      if (this.dashUntil && time < this.dashUntil) vx = this.dashVX; // kind:'dash' overrides normal movement
      if (this.diveUntil && time < this.diveUntil) vx = this.diveVX ?? vx;
      // Only stomp horizontal velocity when grounded (instant arcade
      // stop/go) or when a direction is actively held (air control).
      // Otherwise leave existing velocity alone -- without this, a
      // knockback launch's horizontal speed died the instant hitstun
      // ended and no direction was held, so the fighter hit an invisible
      // "wall" mid-arc and just dropped straight down for the rest of it.
      if (onGround || vx !== 0) this.body.setVelocityX(vx);
      // No turning mid-swing: you commit to the direction you started the
      // attack in. Otherwise the hitbox teleports to the other side of the
      // body part-way through the animation.
      if (vx !== 0 && this.state !== 'attack') this.facing = Math.sign(vx);

      if (this.state === 'jumpsquat') {
        this.body.setVelocity(0, 0);
        this.squatLeft -= 1;
        if (this.squatLeft <= 0) {
          const held = !!(inp.jump || this._botJumpHold > 0);
          this.body.setVelocityY(-stats.jumpVelocity * (held ? 1 : FEEL.shortHop));
          this.state = 'jump';
          if (!this.scene?.simFast) {
            sfx('jump');
            this.scene.juice?.dust?.(this.x, this.y, 1);
          }
        }
      } else if (pressedJump) {
        if (onGround) {
          this.state = 'jumpsquat';
          this.squatLeft = FEEL.jumpSquat - 1;
          this.body.setVelocity(0, 0);
          if (this.isBot) this._botJumpHold = FEEL.jumpSquat;
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft -= 1;
          this.body.setVelocityY(-stats.jumpVelocity * 0.92);
          if (!this.scene?.simFast) {
            sfx('jump');
            this.scene.juice?.dust?.(this.x, this.y, 1);
          }
        }
      }
      if (this._botJumpHold > 0) this._botJumpHold -= 1;
      const pressedDown = inp.down && !this._prevDown;
      this._prevDown = !!inp.down;
      if (pressedDown && !onGround && this.body.velocity.y > 40 && !this.fastFell) {
        this.fastFell = true;
        this.body.setVelocityY(Math.max(this.body.velocity.y, FEEL.fastFallSpeed));
        if (!this.scene?.simFast) this.scene.juice?.puff?.(this.x, this.y - 10, 0xd0e4ff, 0.35);
      }
    }

    if (onGround && this._wasAir) {
      const hard = (this.fallPeak || 0) > FEEL.landingHardVy;
      const lag = this.state === 'attack'
        ? (this.currentMove?.landingLagF ?? FEEL.landingAerial)
        : (hard ? FEEL.landingHard : FEEL.landingSoft);
      if (this.state === 'attack') this.stateUntil += lag * step;
      else if (this.state !== 'hurt' && this.state !== 'jumpsquat') this.lockedUntil = Math.max(this.lockedUntil || 0, time + lag * step);
      this.landing = lag;
      if (!this.scene?.simFast) {
        sfx(hard ? 'landHeavy' : 'land');
        this.scene.juice?.dust?.(this.x, this.y, -1);
        this.scene.juice?.dust?.(this.x, this.y, 1);
        if (hard) this.scene.juice?.addTrauma?.(0.2);
      }
    }
    this._wasAir = !onGround;
    if (!onGround && this.body.velocity.y >= 0 && this.state !== 'hurt' && this.state !== 'attack') this.tryLedge(time);

    // --- attacks
    // Each button has two variants gated on dirHeld: basicDirectional/
    // specialDirectional (the old basic/special melee/burst/projectile
    // moves, unchanged) fire when a direction is held; basicCharge
    // (hold-to-charge) and specialDefense (block/counter) fire on a neutral
    // press instead. A character without a charge/defense move yet (not
    // migrated in Phase B) falls back to its directional move so nothing
    // breaks mid-migration.
    if (this.state === 'charging') {
      const chargeMove = this.charDef.moves.basicCharge;
      if (time - (this._chargeFx ?? 0) > 140) {
        this._chargeFx = time;
        playVfx(this.scene, this, chargeMove, 'charge');
      }
      if (chargeMove?.slide && this.body) this.body.setVelocityX(this.facing * chargeMove.slide);
      if (chargeMove?.seep) this.phasingUntil = time + 80;
      if (chargeMove?.eatZones) this.scene?.consumeZones?.(this, chargeMove.eatZones);
      if (chargeMove?.detonateAtFull && this.chargeStart != null && time - this.chargeStart >= chargeMove.maxChargeMs) {
        this.fireCharge(time);
      } else if (dirHeld) {
        // pressing a direction cancels the charge -- this slot is only for
        // the neutral (no-direction) case.
        this.state = 'idle';
        this.chargeStart = null;
      } else if (releasedAttack) {
        this.fireCharge(time);
      }
    } else if (this.state === 'defending' && this.defenseMove?.hold !== false && !inp.special) {
      this.lingerHardening(time);
      this.scene?.dropPins?.(this);
      this.state = 'idle';
      this.defenseMove = null;
      this.rig.setFlash(null);
    } else if (!locked && !this.isBusy) {
      const queued = this.takeBuffer(time);
      if (queued && !pressedAttack && !pressedSpecial && !pressedJump) {
        pressedAttack = queued.button === 'attack';
        pressedSpecial = queued.button === 'special';
        pressedJump = queued.button === 'jump';
        if (queued.left) this.facing = -1;
        if (queued.right) this.facing = 1;
      }
      if (pressedAttack && time >= this.attackCooldownUntil) {
        if (dirHeld || !this.charDef.moves.basicCharge) {
          this.startMove(time, this.charDef.moves.basicDirectional, 'basic', 'basicDirectional');
        } else {
          this.state = 'charging';
          this.chargeStart = time;
        }
      } else if (pressedSpecial && time >= this.specialCooldownUntil && time >= (this.vulnerableUntil ?? 0)) {
        if (dirHeld || !this.charDef.moves.specialDefense) {
          this.startMove(time, this.charDef.moves.specialDirectional, 'special', 'specialDirectional');
        } else {
          this.startDefense(time);
        }
      } else if ((pressedAttack || pressedSpecial || pressedJump) && (this.isBusy || time < this.attackCooldownUntil)) {
        this.pushBuffer(time, { attack: pressedAttack, special: pressedSpecial, jump: pressedJump });
      }
    } else if (pressedAttack || pressedSpecial || (pressedJump && this.state !== 'jumpsquat')) {
      this.pushBuffer(time, { attack: pressedAttack, special: pressedSpecial, jump: pressedJump && this.state !== 'jump' });
    }

    if (this.diveUntil || (this.dashUntil && time < this.dashUntil)) this.holdDiveOnDeck();
    if (this.diveUntil && time >= (this.diveArm ?? 0) && (onGround || time >= this.diveUntil)) {
      this.scene.resolveBurst?.(this, this.diveMove);
      this.diveUntil = 0;
    }

    // drive attack swing progress for the rig
    if (this.state === 'attack' && this.currentMove) {
      this.attackFrame = (this.attackFrame ?? 0) + 1;
      const fd = this.frameData;
      const span = Math.max(1, fd?.visible || 1);
      this.rig.attackSwing = Phaser.Math.Clamp(this.attackFrame / span, 0, 1);
      if (fd && this.attackFrame <= FEEL.reverseFrames) {
        if (inp.left && this.facing !== -1) this.flipFacing(-1);
        if (inp.right && this.facing !== 1) this.flipFacing(1);
      }
      if (fd && this.attackFrame === fd.startup && !this._whooshed) {
        this._whooshed = true;
        if (!this.scene?.simFast) {
          sfx('whoosh');
          this.scene.juice?.swing?.(this, this.currentMove);
          this.scene.juice?.afterimage?.(this, 0.45);
          this.scene.juice?.afterimage?.(this, 0.30);
          this.scene.juice?.afterimage?.(this, 0.15);
        }
      }
    } else {
      this._whooshed = false;
    }
    if (this.state === 'charging') {
      this.rig.moveKey = 'basicCharge';
      const max = this.charDef.moves.basicCharge?.maxChargeMs || 1;
      this.rig.poseT = Phaser.Math.Clamp((time - (this.chargeStart ?? time)) / max, 0, 1);
    } else if (this.state === 'defending') {
      this.rig.moveKey = 'specialDefense';
      const dur = this.defenseMove?.duration || 400;
      this.rig.poseT = ((time - (this.defenseStart ?? time)) % dur) / dur;
    } else if (this.state === 'attack') {
      this.rig.moveKey = this.currentMoveKey || this.rig.moveKey;
      this.rig.poseT = this.rig.attackSwing;
    } else {
      this.rig.moveKey = null;
      this.rig.poseT = 0;
    }

    // --- pick animation state
    let animState = this.state;
    if (this.state === 'idle' || this.state === 'walk') {
      if (!onGround) {
        animState = this.body.velocity.y < -40 ? 'jump' : 'fall';
      } else if (Math.abs(this.body.velocity.x) > 20) {
        animState = 'walk';
      } else {
        animState = 'idle';
      }
    }
    const speedFactor = Math.abs(this.body.velocity.x) / Math.max(1, stats.speed);
    this.applyLaunch();
    this.rig.facing = this.facing;
    this.rig.frameData = this.frameData;
    this.rig.attackFrame = this.attackFrame || 0;
    this.rig.hurtUnits = this.hurtUnits || 0;
    this.rig.hurtSign = this.hurtSign || 1;
    this.rig.landing = this.landing || 0;
    if (this.landing > 0) this.landing -= 1;
    if (!this.scene?.simFast && animState === 'walk' && Math.floor(this.rig.animT * 8) !== this._foot) {
      this._foot = Math.floor(this.rig.animT * 8);
      if (this._foot % 4 === 0) {
        sfx('foot');
        this.scene.juice?.dust?.(this.x - this.facing * 8, this.y, -this.facing);
      }
    }
    this.rig.animate(dt / 1000, animState, speedFactor);
    if (this._px != null) this.travel = (this.travel ?? 0) + Math.abs(this.x - this._px);
    this._px = this.x;
  }

  answerStrike(attacker, time) {
    const fx = this.defenseMove?.onStruck;
    if (!fx || !attacker || attacker === this) return;
    applyOnHit(this, attacker, { onHit: fx }, time);
  }

  lingerHardening(time) {
    const d = this.defenseMove;
    if (!d?.harden || !this.hardenStacks) return;
    this.kineticResistMult = Math.max(0.55, 1 - this.hardenStacks * (d.hardenLingerStep ?? 0.07));
    this.kineticResistUntil = time + (d.hardenLinger ?? 1800);
  }

  startMove(time, move, slot, moveKey = null) {
    this.openedStill = !!(this.body && Math.abs(this.body.velocity.x) < 36 && Math.abs(this.body.velocity.y) < 80);
    if (this.missNext > 0) {
      this.missNext -= 1;
      move = { ...move, damage: 0, damage2: 0, onHit: null, zone: null };
    }
    if (moveKey === 'basicDirectional' && this.armedDash && time < this.armedDash.until) {
      const arm = this.armedDash;
      this.armedDash = null;
      move = {
        ...move,
        kind: 'dash',
        dashSpeed: arm.dashSpeed ?? 560,
        type2: 'heat',
        damage2: (move.damage2 ?? 0) + (arm.heat ?? 7),
        vfx: 'fire',
      };
    }
    this.state = 'attack';
    this.currentMove = move;
    this.currentMoveKey = moveKey;
    this.rig.moveKey = moveKey;
    this.rig.moveSlot = slot; // sheet-mode rigs have separate basic/special clips
    const step = this.scene?.stepMs || FEEL.stepMs;
    const isDash = move.kind === 'dash';
    const fdMove = isDash && move.startupF == null
      ? { ...move, startupF: Math.max(1, Math.round(((move.duration ?? step) / step) * 0.05)) }
      : move;
    const fd = frameData(move.duration, move.cooldown ?? 0, fdMove, step);
    this.frameData = fd;
    this.attackFrame = 0;
    this._whooshed = false;
    this.stateUntil = time + fd.visible * step;
    this.scene.noteMove?.(this, move);
    if (slot === 'basic') this.attackCooldownUntil = time + move.duration + move.cooldown;
    else {
      this.specialCooldownUntil = time + move.duration + move.cooldown;
      sfx('special');
    }

    if (move.replayCapture) {
      if (this.captured) {
        const typeOnly = move.replayCapture === 'type';
        move = {
          ...move,
          type: this.captured.type ?? move.type,
          damage: typeOnly ? move.damage : (this.captured.damage ?? move.damage),
          type2: typeOnly ? undefined : this.captured.type2,
          damage2: typeOnly ? undefined : this.captured.damage2,
          onHit: undefined,
        };
        this.captured = null;
      }
    }
    playVfx(this.scene, this, move, 'release');
    applyOnCast(this, move, time, move._chargeFrac ?? 1);
    const commitBurst = !!(move.releaseOnHit || move.detonateAtFull || move.includeSelf || move.commit);

    if (move.kind === 'buff' || move.kind === 'zone') {
      if (move.zone) this.scene.spawnZone?.(this, move.zone, this.x, this.y - this.bodyH * (move.zone.low ? 0.15 : 0.5));
    } else if (move.kind === 'projectile') {
      // The shot is committed when the move starts. Startup only delays the
      // spawn, so a trade during the wind-up does not delete it.
      this.scene.time.delayedCall(fd.startup * step, () => {
        if (this.alive) this.scene.spawnProjectile(this, move);
      });
    } else if (move.kind === 'beam') {
      const fire = () => { if (this.alive) this.scene.resolveBeam?.(this, move); };
      this.scene.time.delayedCall(move.delayMs ?? fd.startup * step, fire);
    } else if (move.kind === 'dive') {
      const hop = move.dashSpeed ?? 160;
      this.diveVX = this.facing * hop;
      this.body.setVelocity(this.diveVX, -(move.diveVY ?? 420));
      this.diveUntil = time + move.duration;
      this.diveArm = time + 160;
      this.diveMove = move;
      this.holdDiveOnDeck();
    } else if (move.kind === 'burst') {
      // burst hits everything in a radius partway through the animation.
      // Moves that can be interrupted on purpose (Supernova popping early)
      // still go off.
      const burstAt = commitBurst ? step : Math.round((move.duration ?? step) * 0.4);
      this.scene.time.delayedCall(burstAt, () => {
        if (this.state === 'attack' || commitBurst) this.scene.resolveBurst(this, move);
      });
    } else {
      // melee: hitbox becomes active partway through the swing. `dir` is
      // captured now and drives both the hitbox side and the launch, so the
      // two can never disagree.
      // kind: 'dash' is a melee variant (e.g. Hydra's Ignition Dash) where
      // the fighter's own body sweeps forward as the hitbox instead of a
      // static box in front of him -- active almost immediately/for nearly
      // the whole swing, plus a forward-velocity override (see update()).
      const activeF = isDash ? Math.max(fd.active, Math.round(fd.durF * 0.9)) : fd.active;
      this.activeHit = {
        move, dir: this.facing, landed: new Set(),
        from: time + fd.startup * step,
        until: time + (fd.startup + activeF) * step,
      };
      if (isDash) {
        this.dashUntil = time + fd.visible * step;
        this.dashVX = this.facing * (move.dashSpeed ?? 500);
      }
    }
    if (move.zone && move.kind !== 'zone') {
      const zx = this.x + this.facing * (move.offsetX ?? 0);
      const zy = this.y - this.bodyH * (move.zone.low ? 0.2 : 0.45);
      this.scene.spawnZone?.(this, move.zone, zx, zy);
    }
    if (move.secondHit?.atFull && (move._chargeFrac ?? 0) >= 0.95) {
      const echo = {
        ...move,
        kind: 'burst',
        damage: (move.damage ?? 0) * move.secondHit.scale,
        damage2: move.damage2 != null ? move.damage2 * move.secondHit.scale : undefined,
        radius: move.secondHit.radius ?? 90,
      };
      this.scene.time.delayedCall(move.secondHit.delay ?? 180, () => {
        this.scene.resolveBurst?.(this, echo);
      });
    }
  }

  /** Release-to-fire for basicCharge: damage/knockback scale with hold time
   * up to move.maxChargeMs (chargeDamageMult/chargeKnockbackMult at full
   * charge; a tap with no hold at all fires at the base numbers). */
  fireCharge(time) {
    const move = this.charDef.moves.basicCharge;
    if (!move || this.chargeStart == null) return;
    const heldMs = Math.min(Math.max(0, time - this.chargeStart), move.maxChargeMs ?? 0);
    let frac = move.maxChargeMs > 0 ? heldMs / move.maxChargeMs : 1;
    if (move.redox) frac = Math.max(frac, this.redox ?? 0);
    this.chargeStart = null;
    const coinFlip = move.fizzleCoin && (Math.floor(time / 6400) % 2 === 1);
    if ((move.fizzleBelow != null && frac < move.fizzleBelow) || coinFlip) {
      this.state = 'idle';
      this.attackCooldownUntil = time + 420;
      this.scene.noteMove?.(this, move);
      playVfx(this.scene, this, move, 'fizzle');
      return;
    }
    const scale = (base, mult) => (base ?? 0) * (1 + ((mult ?? 1) - 1) * frac);
    const scaled = {
      ...move,
      _chargeFrac: frac,
      damage: move.damage != null ? scale(move.damage, move.chargeDamageMult) : move.damage,
      damage2: move.damage2 != null ? scale(move.damage2, move.chargeDamageMult) : move.damage2,
      baseKnockback: scale(move.baseKnockback ?? 0, move.chargeKnockbackMult),
      radius: move.radius != null ? scale(move.radius, move.chargeRadiusMult) : move.radius,
      projectileRadius: move.projectileRadius != null ? scale(move.projectileRadius, move.chargeRadiusMult) : move.projectileRadius,
      projectileSpeed: move.projectileSpeed != null && move.chargeSpeedMult != null
        ? scale(move.projectileSpeed, move.chargeSpeedMult)
        : move.projectileSpeed,
      dashSpeed: move.dashSpeed != null ? scale(move.dashSpeed, move.chargeDashMult) : move.dashSpeed,
      _beamScale: 1 + ((move.chargeLengthMult ?? 1) - 1) * frac,
    };
    if (move.perTravel) {
      const extra = Math.min(move.perTravelCap ?? 5, (this.travel ?? 0) / move.perTravel);
      if (scaled.damage != null) scaled.damage += extra;
      this.travel = 0;
    }
    if (move.stainAtFull && frac >= (move.stainAt ?? 0.95)) scaled.dropZone = move.stainAtFull;
    if (move.clockWindow) {
      const period = move.clockWindow.period ?? 410;
      const slack = move.clockWindow.slack ?? 85;
      const phase = ((time % period) + period) % period;
      const dist = Math.min(phase, period - phase);
      if (dist <= slack) {
        const mult = move.clockWindow.mult ?? 3;
        if (scaled.damage != null) scaled.damage *= mult;
        if (scaled.damage2 != null) scaled.damage2 *= mult;
      }
    }
    if (move.riseUnder && this.body && this.scene?.fighters) {
      let best = null;
      let bestD = Infinity;
      for (const f of this.scene.fighters) {
        if (f === this || !f.alive || f.state === 'ko' || f.state === 'dead') continue;
        const d = Math.hypot(f.x - this.x, f.y - this.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best) this.body.reset(best.x, best.y);
    }
    if (move.zone && move.chargeRadiusMult) {
      scaled.zone = { ...move.zone, radius: scale(move.zone.radius ?? 70, move.chargeRadiusMult) };
    }
    if (move.onHit && move.chargeControlMult) {
      const mul = 1 + ((move.chargeControlMult ?? 1) - 1) * frac;
      const onHit = {};
      for (const [key, value] of Object.entries(move.onHit)) {
        onHit[key] = typeof value === 'number' ? value * mul : value;
      }
      scaled.onHit = onHit;
    }
    this.startMove(time, scaled, 'basic', 'basicCharge');
  }

  /** Enter the neutral-special defensive window (specialDefense). Whether it
   * blocks or counters is decided by the move's own `kind` -- see takeHit(). */
  startDefense(time) {
    const move = this.charDef.moves.specialDefense;
    this.state = 'defending';
    this.defenseMove = move;
    // `wall`-kind defenses (e.g. Hydra's Dual Flame Wall) are also an active
    // hazard -- BattleScene checks this set each frame so the same fighter
    // isn't hit twice by the same activation.
    this.wallLanded = move.kind === 'wall' ? new Set() : null;
    this.wallHits = 0;
    this.hardenStacks = 0;
    this.defenseStart = time;
    this._drainAt = time + (move.drain?.every ?? 1000);
    this._regenAt = time + (move.regenEvery ?? 800);
    if (move.float) this.body?.setVelocityY(-70);
    if (move.zone) {
      this.scene.spawnZone?.(this, move.zone, this.x, this.y - this.bodyH * (move.zone.low ? 0.2 : 0.45));
    }
    this.scene.noteMove?.(this, move);
    this.currentMoveKey = 'specialDefense';
    this.rig.moveKey = 'specialDefense';
    this.rig.moveSlot = 'special';
    this.stateUntil = time + move.duration;
    this.specialCooldownUntil = time + move.duration + move.cooldown;
    playVfx(this.scene, this, move, 'defense');
    applyOnCast(this, move, time, 1);
  }

  // A dive hop keeps its own horizontal speed, then stops at the lip of the
  // deck. Air control must not replace that hop with a full run, or the
  // landing carries her off the stage.
  holdDiveOnDeck() {
    if (!this.body) return;
    const next = diveVelocityX(
      this.x,
      this.body.velocity.x,
      this.scene.stage?.solids,
      (this.scene.stepMs || 16.7) / 1000,
    );
    if (next === this.body.velocity.x) return;
    const back = next !== 0 && Math.sign(next) !== Math.sign(this.body.velocity.x || this.facing || 1);
    this.diveVX = next;
    this.dashVX = next;
    this.body.setVelocityX(next);
    if (back && this.body.velocity.y > -80) this.body.setVelocityY(-320);
  }

  // Axis-aligned hitbox in world space for the current melee attack.
  getHitboxRect() {
    if (!this.activeHit) return null;
    const t = this.scene.time.now;
    if (t < this.activeHit.from || t > this.activeHit.until) return null;
    const m = this.activeHit.move;
    const dir = this.activeHit.dir;
    // Dash hitboxes are anchored at his own back edge (his whole body sweeps
    // through as the hitbox) instead of offset in front of him.
    const isDash = m.kind === 'dash';
    const x = dir === 1
      ? (isDash ? this.x - this.bodyW / 2 : this.x + this.bodyW * 0.2)
      : (isDash ? this.x + this.bodyW / 2 - m.rangeW : this.x - this.bodyW * 0.2 - m.rangeW);
    const y = this.y - this.bodyH * 0.75;
    return new Phaser.Geom.Rectangle(x, y, m.rangeW, m.rangeH);
  }

  getHurtboxRect() {
    // Anchored at the feet, same origin as the sprite foot line. The height
    // is the gameplay body, not the sprite cell, so a hair lock or a glow
    // does not change who gets hit.
    return new Phaser.Geom.Rectangle(this.x - this.bodyW / 2, this.y - this.bodyH, this.bodyW, this.bodyH);
  }

  /**
   * Apply a hit to this fighter. Returns actual damage dealt.
   * launchDir: -1 or 1, the direction the attack itself points. Omit it for
   * radial moves, which launch away from the attacker instead.
   */
  takeHit(attacker, move, time, launchDir) {
    if (this.state === 'ko' || this.state === 'dead') return 0;
    if (this.phasingUntil > time && !move.isSelf && !move.isCounterAttack) return 0;
    if (this.state === 'defending' && this.defenseMove && !move.isSelf && !move.isCounterAttack) {
      this.answerStrike(attacker, time);
    }

    if (move.popShield && this.state === 'defending' && this.defenseMove?.kind === 'shield') {
      this.state = 'idle';
      this.defenseMove = null;
    }
    if (move.breakPhase && this.state === 'defending' && this.defenseMove?.phase) {
      this.state = 'idle';
      this.defenseMove = null;
    }

    if (this.state === 'charging' && this.charDef.moves.basicCharge?.releaseOnHit && !move.isSelf && !move.isCounterAttack) {
      this.fireCharge(time);
    }

    let incoming = move;
    if (this.state === 'defending' && this.defenseMove?.immune?.length && !move.isSelf && !move.isCounterAttack) {
      const stripped = applyImmunities(incoming, this.defenseMove);
      if (stripped.emptied) {
        if (this.defenseMove.capture && move.type) {
          this.captured = {
            type: move.type,
            damage: move.damage ?? 0,
            type2: move.type2,
            damage2: move.damage2,
          };
        }
        const fuelTypes = [move.type, move.type2].filter(Boolean);
        if (this.defenseMove.fuelFrom && fuelTypes.includes(this.defenseMove.fuelFrom)) {
          this.bonusHits = (this.bonusHits ?? 0) + 1;
          this.bonusPacket = {
            type: this.defenseMove.fuelType ?? this.defenseMove.fuelFrom,
            damage: this.defenseMove.fuelDamage ?? 3,
            hitsName: this.defenseMove.name,
          };
        }
        if (this.defenseMove.fuelHeal) this.percent = Math.max(0, this.percent - this.defenseMove.fuelHeal);
        this.retortFromImmune(attacker, move, time);
        this.rig.setFlash(0xaee6ff);
        return 0;
      }
      incoming = stripped.move;
    }
    if (!move.isSelf && this.state === 'defending' && this.defenseMove?.absorbState
      && attacker?.charDef?.combat?.state === this.defenseMove.absorbState) {
      if (this.defenseMove.fuelHeal) this.percent = Math.max(0, this.percent - this.defenseMove.fuelHeal);
      this.bonusHits = (this.bonusHits ?? 0) + 1;
      this.bonusPacket = {
        type: this.defenseMove.fuelType ?? 'electrical',
        damage: this.defenseMove.fuelDamage ?? 4,
        hitsName: this.defenseMove.name,
      };
      this.rig.setFlash(0xaee6ff);
      return 0;
    }
    if (move.bonusVsBlock && this.state === 'defending') {
      const bump = 1 + move.bonusVsBlock;
      incoming = {
        ...move,
        damage: (move.damage ?? 0) * bump,
        damage2: move.damage2 != null ? move.damage2 * bump : move.damage2,
      };
    }

    const gate = interceptHit(this, attacker, incoming, time);
    if (gate.damageMult && gate.damageMult !== 1) {
      incoming = {
        ...incoming,
        damage: (incoming.damage ?? 0) * gate.damageMult,
        damage2: incoming.damage2 != null ? incoming.damage2 * gate.damageMult : incoming.damage2,
      };
    }
    if (gate.result === 'pop' || gate.result === 'negate') {
      if (this.defenseMove?.healOnBlock) {
        this.percent = Math.max(0, this.percent - this.defenseMove.healOnBlock);
      }
      if (gate.endDefense) {
        const regrow = this.defenseMove?.regrow ?? 1600;
        this.specialCooldownUntil = Math.max(this.specialCooldownUntil ?? 0, time + regrow);
        this.scene?.dropPins?.(this);
        this.state = 'idle';
        this.defenseMove = null;
        this.rig.setFlash(0xaee6ff);
        return 0;
      }
      if (gate.result === 'pop') {
        this.state = 'idle';
        this.defenseMove = null;
      } else if (this.defenseMove?.crackAfterHits) {
        this.wallHits = (this.wallHits ?? 0) + 1;
        if (this.wallHits >= this.defenseMove.crackAfterHits) {
          this.state = 'idle';
          this.defenseMove = null;
        }
      }
      this.rig.setFlash(0xaee6ff);
      return 0;
    }
    if (gate.result === 'counter') {
      if (this.defenseMove?.swap && attacker?.body && this.body && attacker !== this) {
        const ax = attacker.x;
        const ay = attacker.y;
        attacker.body.reset(this.x, this.y);
        this.body.reset(ax, ay);
      }
      if (gate.negate !== false && attacker && attacker !== this && attacker.takeHit) {
        const cdmg = attacker.takeHit(this, gate.counter, time, this.facing);
        if (cdmg > 0) this.scene.noteHit?.(this, attacker, gate.counter);
        if (gate.counter.rootMs && attacker.rootedUntil != null) {
          attacker.rootedUntil = Math.max(attacker.rootedUntil, time + gate.counter.rootMs);
        } else if (gate.counter.rootMs) {
          attacker.rootedUntil = time + gate.counter.rootMs;
        }
      }
      this.rig.setFlash(0x66ffee);
      this.scene.time.delayedCall(120, () => {
        if (this.state !== 'ko' && this.state !== 'dead') this.rig.setFlash(null);
      });
      if (gate.negate === false) {
        // fall through and also take the (reduced) hit — vulcanized rubber
      } else {
        return 0;
      }
    }
    if (gate.result === 'partial') {
      const dealt = dealtDamage(attacker, incoming, this);
      let dmg = dealt.total * (1 - gate.reduction);
      if (this.currentMove?.guardStrike && this.state === 'attack') dmg *= (1 - this.currentMove.guardStrike);
      if (this.state === 'charging' && this.charDef.moves.basicCharge?.whileCharging) {
        dmg *= this.charDef.moves.basicCharge.whileCharging.keep ?? 0.5;
      }
      const ownBlast = attacker === this && !move.isSelf;
      if (ownBlast) dmg *= TUNING.selfDamageMult;
      this.lastPackets = dealt.packets.map((p) => ({ ...p, dealt: p.dealt * (1 - gate.reduction) * (ownBlast ? TUNING.selfDamageMult : 1) }));
      this.percent = Math.min(999, this.percent + dmg);
      this.creditDamage(attacker, dmg, incoming.type);
      if (!gate.noKnockback && !move.isSelf) {
        const kb = ((incoming.baseKnockback + this.percent * (incoming.knockbackGrowth ?? 0)) / this.weightNow()) * (1 - gate.reduction) * TUNING.knockbackScale * (ownBlast ? TUNING.selfKnockbackScale : 1);
        this.applyKnockback(attacker, incoming, time, launchDir, kb, dmg, false);
      }
      this.noteHeatAndRecoil(attacker, incoming, time, dealt);
      this.spreadPoison(attacker, time, this.poisonInherit && this.poisonUntil > time);
      return dmg;
    }

    // Cancel whatever attack this fighter was mid-swing on. Without this, an
    // attack's hitbox stayed live (getHitboxRect() only checks activeHit,
    // not state) even after its owner got hit and entered hurt state, so
    // "both fighters hit each other at once" wasn't just simultaneous
    // swings landing together -- it was ALSO an already-losing attacker
    // still landing their hit for the rest of its active window after being
    // interrupted. Getting hit first now reliably beats swinging first.
    // hyperArmor (an uninterruptible dash) keeps the swing alive.
    const armored = this.state === 'attack' && this.currentMove?.hyperArmor && !move.isSelf && !move.isCounterAttack;
    if (!armored) this.activeHit = null;
    // Dual-type moves (e.g. Fusion Core: heat + radiation) sum a second
    // defense-adjusted damage component. Single-type moves are unaffected
    // (type2 is undefined for them).
    const dealt = dealtDamage(attacker, incoming, this);
    let dmg = dealt.total;
    const charging = this.charDef.moves.basicCharge;
    if (this.state === 'charging' && charging?.whileCharging) {
      const except = charging.whileCharging.except ?? [];
      if (!except.includes(incoming.type) && incoming.type !== 'radiation') dmg *= charging.whileCharging.keep ?? 0.5;
    }
    if (this.currentMove?.guardStrike && this.state === 'attack') dmg *= (1 - this.currentMove.guardStrike);
    const ownBlast = attacker === this && !move.isSelf;
    const contagious = this.poisonInherit && this.poisonUntil > time;
    if (this.state === 'defending' && this.defenseMove?.flatHit != null && !move.isSelf && dmg > 0 && incoming.name !== 'zone') {
      dmg = this.defenseMove.flatHit;
    }
    if (ownBlast || move.isSelf) {
      // isSelf is a designed cost (Supernova) and stays at full damage.
      // ownBlast is a move that happens to include its owner.
      if (ownBlast) dmg *= TUNING.selfDamageMult;
    }
    this.percent = Math.min(999, this.percent + dmg);
    this.lastPackets = ownBlast
      ? dealt.packets.map((p) => ({ ...p, dealt: p.dealt * TUNING.selfDamageMult }))
      : dealt.packets;
    this.creditDamage(attacker, dmg, incoming.type);

    if (move.isSelf) {
      if (!move.noFlinch) {
        this.state = 'hurt';
        this.stateUntil = time + 160;
      }
      return dmg;
    }
    let kb = (((incoming.baseKnockback ?? 0) + this.percent * (incoming.knockbackGrowth ?? 0)) / this.weightNow()) * TUNING.knockbackScale * (ownBlast ? TUNING.selfKnockbackScale : 1);
    const pinned = this.state === 'defending' && this.defenseMove?.noKnockback && !incoming.isSelf;
    if (pinned) kb = 0;
    this.applyKnockback(attacker, incoming, time, launchDir, kb, dmg, !armored);

    applyOnHit(attacker, this, incoming, time);
    this.noteHeatAndRecoil(attacker, incoming, time, dealt);
    this.spreadPoison(attacker, time, contagious);
    return dmg;
  }

  /**
   * Smash-style launch. The body freezes for hitlag; the velocity is applied
   * on the last hitlag frame, after DI. `flinch` false keeps a defender in
   * their stance (partial block) while still sliding.
   */
  applyKnockback(attacker, incoming, time, launchDir, kb, dmg, flinch) {
    const radial = incoming.launch ? incoming.launch === 'radial' : incoming.kind === 'burst';
    const away = Math.sign(this.x - (attacker?.x ?? this.x)) || attacker?.facing || 1;
    const dir = (!radial && launchDir) ? launchDir : away;
    const slip = this.slipperyUntil > time ? (this.slipperyMult ?? 1.3) : 1;
    const grabbed = incoming.pull && attacker && kb > 0 && !(this.defenseMove?.grabImmune && this.state === 'defending');
    const units = smashUnits(Math.max(0, kb) * slip);
    const grounded = !!(this.body?.blocked?.down || this.body?.touching?.down);
    let angle = launchAngle(incoming, grounded, units);
    if (grabbed) {
      angle = 0;
    }
    const players = this.scene?.fighters?.filter((f) => f.alive && f.state !== 'dead').length || 2;
    const ko = units > 0 && this.predictKO(units, angle, grabbed ? Math.sign((attacker.x - this.x) || dir) : dir);
    const hmult = incoming.hitlagMult ?? (incoming.multiHit ? FEEL.hitlagMultiHit : 1);
    const frames = hitlagFrames(dmg, {
      hitlagMult: hmult, type: incoming.type, type2: incoming.type2, players, ko,
    });
    this.pendingLaunch = units > 0 ? {
      units, angle, dir: grabbed ? Math.sign((attacker.x - this.x) || dir) : dir,
      type: incoming.type, pull: grabbed ? incoming.pull : 0,
    } : null;
    this.launch = null;
    this._appliedLaunch = null;
    this.hitlagFrames = Math.max(this.hitlagFrames || 0, frames);
    this.hitlagTotal = this.hitlagFrames;
    this.hitlagDmg = dmg;
    this._hitlagRole = 'victim';
    this._hitGrounded = grounded;
    this.hurtUnits = units;
    this.hurtSign = -dir;
    this.body?.setVelocity(0, 0);
    if (attacker && attacker !== this && !incoming._projectile && !incoming.isCounterAttack && attacker.hitlagFrames != null) {
      attacker.hitlagFrames = Math.max(attacker.hitlagFrames || 0, frames);
      attacker.hitlagTotal = attacker.hitlagFrames;
      attacker._hitlagRole = 'attacker';
      attacker.hitlagDmg = dmg;
      attacker.body?.setVelocity?.(0, 0);
    }
    if (flinch && dmg > 0) {
      const stun = Math.max(FEEL.hitstunMin, hitstunFrames(units));
      this.state = 'hurt';
      this.stateUntil = time + stun * (this.scene?.stepMs || FEEL.stepMs);
      this.activeHit = null;
    }
    if (ko && flinch) this.scene?.beginFinish?.(this, { final: this.stocks <= 1, charged: (incoming._chargeFrac ?? 0) >= 0.95 });
    if (!this.scene?.simFast && dmg > 0) {
      playHit(dmg, incoming.type, ko && flinch);
      this.scene.juice?.hit?.(this.x, this.y - this.bodyH * 0.55, dmg, incoming.type, angle);
    }
    if ((this.hitlagFrames || 0) <= 0 && this.pendingLaunch) this.releaseLaunch(time);
  }

  shiftTimers(ms) {
    const keys = [
      'stateUntil', 'attackCooldownUntil', 'specialCooldownUntil', 'vulnerableUntil', 'lockedUntil',
      'dashUntil', 'diveUntil', 'diveArm', 'slowUntil', 'rootedUntil', 'speedBuffUntil', 'driftUntil',
      'phasingUntil', 'weightBuffUntil', 'poisonUntil', 'stunUntil', 'freezeUntil', 'burnUntil',
      'slipperyUntil', 'kineticResistUntil', 'heatedUntil',
    ];
    for (const k of keys) if (this[k] > 0) this[k] += ms;
    if (this.chargeStart) this.chargeStart += ms;
    if (this.defenseStart) this.defenseStart += ms;
    if (this.activeHit) {
      this.activeHit.from += ms;
      this.activeHit.until += ms;
    }
  }

  captureEdges(time) {
    const inp = this.input || {};
    const pressed = {
      jump: !!inp.jump && !this._prev.jump,
      attack: !!inp.attack && !this._prev.attack,
      special: !!inp.special && !this._prev.special,
    };
    this._prev.jump = !!inp.jump;
    this._prev.attack = !!inp.attack;
    this._prev.special = !!inp.special;
    if (pressed.jump || pressed.attack || pressed.special) this.pushBuffer(time, pressed);
  }

  pushBuffer(time, pressed) {
    const frame = Math.round(time / (this.scene?.stepMs || FEEL.stepMs));
    const inp = this.input || {};
    for (const button of ['special', 'attack', 'jump']) {
      if (!pressed[button]) continue;
      this.buffer.push({
        button, frame, left: !!inp.left, right: !!inp.right, down: !!inp.down, jump: !!inp.jump,
      });
    }
    this.buffer = this.buffer.filter((b) => frame - b.frame <= FEEL.bufferFrames);
  }

  takeBuffer(time) {
    const frame = Math.round(time / (this.scene?.stepMs || FEEL.stepMs));
    const hit = takeBuffered(this.buffer, frame);
    if (hit) this.buffer = [];
    return hit;
  }

  shakeForHitlag() {
    const total = Math.max(1, this.hitlagTotal || 1);
    const frame = total - this.hitlagFrames;
    if (this._hitlagRole === 'attacker') {
      this._shakeX = 0;
      this._shakeY = 0;
      return;
    }
    const remain = Math.max(0, 1 - frame / total);
    const amp = Math.min(2 + (this.hitlagDmg || 0) * 0.35, 9) * remain;
    const sign = frame % 2 === 0 ? 1 : -1;
    if (!this._hitGrounded && this.pendingLaunch) {
      const a = this.pendingLaunch.angle || 0;
      this._shakeX = Math.cos(a) * amp * sign * (this.pendingLaunch.dir || 1);
      this._shakeY = Math.sin(a) * amp * sign;
    } else {
      this._shakeX = amp * sign;
      this._shakeY = 0;
    }
    const spr = this.rig?.sprite;
    if (!spr?.setTintFill) return;
    if (frame < 2) spr.setTintFill(0xffffff);
    else if (frame < 6) spr.setTint?.(TYPE_COLOR[this.pendingLaunch?.type] ?? 0xff5544);
    else spr.clearTint?.();
  }

  releaseLaunch() {
    const p = this.pendingLaunch;
    this.pendingLaunch = null;
    if (!p || !this.body) return;
    const sx = (this.input?.right ? 1 : 0) - (this.input?.left ? 1 : 0);
    const sy = (this.input?.down ? 1 : 0) - (this.input?.jump ? 1 : 0);
    const angle = applyDI(p.angle, sx, sy);
    const vel = launchVelocity(p.units, angle, p.dir || 1);
    if (p.pull) vel.x = (p.dir || 1) * p.pull;
    const stun = hitstunFrames(p.units);
    this.launch = {
      x: vel.x, y: vel.y, speed0: Math.hypot(vel.x, vel.y) || 1, type: p.type, units: p.units,
      balloonLeft: stun > FEEL.balloonHitstun ? Math.min(FEEL.balloonCap, stun - FEEL.balloonHitstun) : 0,
    };
    this._diShow = 8;
    this._diAngle = angle;
  }

  peelLaunch() {
    if (!this._appliedLaunch || !this.body) return;
    this.body.velocity.x -= this._appliedLaunch.x;
    this.body.velocity.y -= this._appliedLaunch.y;
    this.body.setVelocity(this.body.velocity.x, this.body.velocity.y);
    this._appliedLaunch = null;
  }

  applyLaunch() {
    if (this.hitlagFrames > 0 || !this.body) return;
    if (this.launch) this.launch = decayLaunch(this.launch);
    if (!this.launch) return;
    this.body.velocity.x += this.launch.x;
    this.body.velocity.y += this.launch.y;
    this.body.setVelocity(this.body.velocity.x, this.body.velocity.y);
    this._appliedLaunch = { x: this.launch.x, y: this.launch.y };
    if ((this.hurtUnits || 0) > FEEL.tumbleAt) this.spin = (this.spin || 0) + this.launch.x * 0.0009;
    if (!this.scene?.simFast) this.scene.juice?.trail?.(this);
    if (this._diShow > 0) this._diShow -= 1;
  }

  predictKO(units, angle, dir) {
    const blast = this.scene?.blast;
    if (!blast) return false;
    const vel = launchVelocity(units, angle, dir || 1);
    const g = 1500 * (this.charDef?.stats?.gravityScale ?? 1);
    return leavesBlast(this.x, this.y, vel.x, vel.y, g, blast);
  }

  flipFacing(dir) {
    this.facing = dir;
    if (this.activeHit) this.activeHit.dir = dir;
    if (this.dashVX) this.dashVX = dir * Math.abs(this.dashVX);
  }

  tryLedge(time) {
    const ledges = this.scene?.ledges;
    if (!ledges?.length || (this.ledgeLock || 0) > time) return;
    const handX = this.x + (this.facing || 1) * this.bodyW * 0.35;
    const handY = this.y - this.bodyH * 0.85;
    for (const L of ledges) {
      if (Math.abs(handX - L.x) > FEEL.ledgeW) continue;
      if (handY < L.y - FEEL.ledgeH || handY > L.y + 8) continue;
      this.grabLedge(L, time);
      return;
    }
  }

  grabLedge(L, time) {
    const step = this.scene?.stepMs || FEEL.stepMs;
    this.state = 'ledge';
    this.facing = L.facing;
    this.ledge = L;
    this.ledgeX = L.x + L.facing * this.bodyW * 0.2;
    this.ledgeY = L.y + this.bodyH * 0.62;
    this.ledgeFrames = 0;
    this.launch = null;
    this._appliedLaunch = null;
    this.body.allowGravity = false;
    this.body.setVelocity(0, 0);
    this.body.reset?.(this.ledgeX, this.ledgeY);
    if (!this.ledgeRegrab) {
      this.phasingUntil = time + FEEL.ledgeIntang * step;
      this.ledgeRegrab = true;
    }
    if (!this.scene?.simFast) sfx('ledge');
  }

  holdLedge(time, step) {
    this.ledgeFrames = (this.ledgeFrames || 0) + 1;
    this.body.allowGravity = false;
    this.body.setVelocity(0, 0);
    this.body.reset?.(this.ledgeX, this.ledgeY);
    this.x = this.ledgeX;
    this.y = this.ledgeY;
    const inp = this.input || {};
    const pressedJump = !!inp.jump && !this._prev.jump;
    const pressedAttack = !!inp.attack && !this._prev.attack;
    this._prev.jump = !!inp.jump;
    this._prev.attack = !!inp.attack;
    this._prev.special = !!inp.special;
    const away = (this.facing === 1 && inp.left) || (this.facing === -1 && inp.right);
    const toward = (this.facing === 1 && inp.right) || (this.facing === -1 && inp.left);
    if (pressedJump || (inp.jump && toward)) {
      this.leaveLedge();
      this.body.setVelocity(-this.charDef.stats.jumpVelocity, 0);
      this.body.setVelocityY(-this.charDef.stats.jumpVelocity);
      this.body.setVelocityX(this.facing * 90);
      this.state = 'jump';
      return;
    }
    if (pressedAttack || toward) {
      const lx = this.ledge.x;
      const ly = this.ledge.y;
      this.leaveLedge();
      this.phasingUntil = time + 12 * step;
      this.body.reset?.(lx + this.facing * 36, ly);
      this.state = 'idle';
      return;
    }
    if (inp.down || away || this.ledgeFrames > FEEL.ledgeMax) {
      this.leaveLedge();
      this.ledgeLock = time + 20 * step;
      this.body.setVelocityY(140);
      this.state = 'fall';
    }
  }

  leaveLedge() {
    if (this.body) this.body.allowGravity = true;
    this.ledge = null;
  }

  weightNow() {
    const w = this.charDef.stats.weight;
    const now = this.scene?.time?.now ?? 0;
    if (this.weightBuffUntil > now) return w * (this.weightBuff ?? 1);
    if (this.state === 'defending' && this.defenseMove?.weightMult) return w * this.defenseMove.weightMult;
    return w;
  }

  spreadPoison(attacker, time, contagious) {
    if (!contagious || !attacker || attacker === this || attacker.percent == null) return;
    attacker.poisonUntil = Math.max(attacker.poisonUntil ?? 0, this.poisonUntil);
    attacker.poisonDps = this.poisonDps;
    attacker.poisonRamp = this.poisonRamp ?? 0;
    attacker.poisonTick = time + 280;
    attacker.poisonInherit = true;
  }

  retortFromImmune(attacker, move, time) {
    const ret = this.defenseMove?.retort;
    if (!ret || !attacker || attacker === this || !attacker.takeHit) return;
    const types = [move?.type, move?.type2].filter(Boolean);
    if (ret.when && !types.includes(ret.when)) return;
    const cdmg = attacker.takeHit(this, {
      name: this.defenseMove.name,
      damage: ret.damage ?? 0,
      type: ret.type ?? 'radiation',
      baseKnockback: ret.knockback ?? 40,
      knockbackGrowth: ret.growth ?? 0.4,
      isCounterAttack: true,
      onHit: ret.blind || ret.stun ? { blind: ret.blind, stun: ret.stun } : undefined,
    }, time, this.facing);
    if (cdmg > 0) this.scene?.noteHit?.(this, attacker, { name: this.defenseMove.name, type: ret.type });
  }

  noteHeatAndRecoil(attacker, incoming, time, dealt) {
    if (dealt?.packets?.some((p) => p.type === 'heat' && p.dealt > 0)) {
      this.heatedUntil = Math.max(this.heatedUntil ?? 0, time + 2200);
    }
    const defense = this.defenseMove;
    if (this.state !== 'defending' || !defense?.recoil || !attacker || attacker === this) return;
    if (incoming.isCounterAttack || incoming.isSelf) return;
    const r = defense.recoil;
    const echo = {
      name: defense.name,
      type: r.type ?? 'kinetic',
      damage: r.damage ?? 5,
      baseKnockback: r.knockback ?? 140,
      knockbackGrowth: r.growth ?? 3,
      isCounterAttack: true,
    };
    const cdmg = attacker.takeHit(this, echo, time, this.facing);
    if (cdmg > 0) this.scene.noteHit?.(this, attacker, echo);
  }

  /** Damage taken always counts. Damage dealt counts only when someone else landed it. */
  creditDamage(attacker, dmg, fallbackType) {
    if (!(dmg > 0)) return;
    this.damageTaken += dmg;
    const packets = this.lastPackets;
    let sum = 0;
    if (packets) for (const p of packets) sum += p.dealt || 0;
    const give = (bag, type, amount) => {
      if (!bag || !(amount > 0)) return;
      bag[type] = (bag[type] ?? 0) + amount;
    };
    if (sum > 0) {
      const scale = dmg / sum;
      for (const p of packets) {
        const share = (p.dealt || 0) * scale;
        give(this.takenByType, p.type, share);
        if (attacker && attacker !== this) give(attacker.dealtByType, p.type, share);
      }
    } else if (fallbackType) {
      give(this.takenByType, fallbackType, dmg);
      if (attacker && attacker !== this) give(attacker.dealtByType, fallbackType, dmg);
    }
    if (attacker && attacker !== this) attacker.damageDealt += dmg;
  }

  /** Called by the scene when this fighter crosses a blast zone. */
  loseStock() {
    if (this.state === 'dead' || this.state === 'ko') return;
    this.stocks -= 1;
    this.state = 'ko';
    this.body.setVelocity(0, 0);
    this.body.setEnable(false);
    this.launch = null;
    this._appliedLaunch = null;
    this._koHide = this.scene?.simFast ? 0 : 2;
    if (this._koHide <= 0) this.setVisible(false);

    if (this.stocks <= 0) {
      this.state = 'dead';
      this.alive = false;
      return;
    }
    // respawn after a beat
    this.scene.time.delayedCall(900, () => {
      if (this.state !== 'ko') return;
      this.percent = 0;
      this.setPosition(this.spawnPoint.x, this.spawnPoint.y - 120);
      this.body.reset(this.spawnPoint.x, this.spawnPoint.y - 120);
      this.body.setEnable(true);
      this.setVisible(true);
      this.state = 'idle';
      this.rig.setFlash(null);
      this.rig.rotation = 0;
      // brief respawn invulnerability flicker
      this.scene.tweens.add({ targets: this, alpha: 0.35, yoyo: true, repeat: 8, duration: 62, onComplete: () => (this.alpha = 1) });
    });
  }
}

// Horizontal speed for an aerial dive. Zero it when the next step would
// leave the deck, and point it back if she is already past the lip.
export function diveVelocityX(x, vx, solids, stepSec = 0.0167, margin = 40) {
  const list = solids || [];
  const ground = list.filter((s) => s.h == null);
  const src = ground.length ? ground : list;
  if (!src.length) return vx;
  const covers = (px) => src.some((s) => px >= s.x - s.w / 2 + margin && px <= s.x + s.w / 2 - margin);
  if (!covers(x)) {
    let best = src[0];
    for (const s of src) if (Math.abs(s.x - x) < Math.abs(best.x - x)) best = s;
    const dir = Math.sign(best.x - x) || 1;
    return dir * Math.max(160, Math.abs(vx) || 160);
  }
  const step = Math.max(stepSec, 0.012);
  if (!covers(x + vx * step)) return 0;
  return vx;
}
