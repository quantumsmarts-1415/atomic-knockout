import * as Phaser from 'phaser';
import { Rig } from './Rig.js';
import { applyDefense } from '../data/characters.js';
import { canonicalType, enGapMult, resolveMoveDamage, resolvePacket, TUNING } from '../data/balance.js';
import { applyImmunities, gateStored, interceptHit, rearmDefense } from './defense.js';
import { applyDot, applyOnCast, applyOnHit, bonusPackets, cleanse, combatOpts, finalBlow, grantTonic, halfLifeScale, lightUnquenchable, prepareMove, rewindPoint, scaledByHaste, stripProtection, tickKit, visibleAlpha, weakestType } from './kit.js';
import { clockPerfect, gambleFizzle, glideAim } from './batch3.js';
import { playVfx } from './MoveVfx.js';
import { armGeyser, artFor, fxAnchor, groundTop, hitAnchor, playRetortPulse, spawnFxSprite, spawnMeteor, spawnMoveExtra, spawnReplayGhost } from './fxArt.js';
import { clipNameForMove, sheetMeta } from './moveSheet.js';
import { coatSpec } from './coat.js';
import { hurtboxes, hurtUnion, hitboxes, pushbox, hitAabb } from './boxes.js';

function vaporAttack(move, attacker) {
  if (!move || move.isSelf || move.isCounterAttack) return false;
  if (move.gas) return true;
  return attacker?.charDef?.combat?.state === 'gas';
}
import { play as sfx, playHit } from './sfx.js';
import {
  FEEL, hitlagFrames, frameData, smashUnits, hitstunFrames, launchAngle,
  knockbackRaw,
  launchVelocity, applyDI, decayLaunch, leavesBlast, takeBuffered,
  hitlagShake,
} from './feel.js';

// ---------------------------------------------------------------------------
// Fighter — one combatant. Reads everything character-specific from its
// charDef (see src/data/characters.js); contains zero per-character logic.
//
// Input is abstracted: each frame the owner (keyboard mapper, gamepad, bot
// AI, or phone controller) writes into fighter.input = { left, right, down, jump,
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
// Dealt-damage multipliers for fighters the duel table puts outside
// 40–60%. The stored kits stay as written; only the dealt total moves.
// Filled after the 150% knockback curve, so an old nudge is not reused.
const BAND_DAMAGE = {
  aaron: 1.37,
  ace: 0.99,
  agatha: 0.83,
  allen: 1.23,
  amy: 1.34,
  arsenio: 1.39,
  aurelius: 1.12,
  barry: 1.23,
  ben: 0.70,
  bianca: 0.78,
  boar: 1.21,
  bord: 0.74,
  brock: 0.85,
  burke: 0.94,
  caesar: 1.58,
  cal: 0.98,
  cali: 0.87,
  carter: 1.00,
  ceres: 1.15,
  chloe: 1.34,
  chroma: 0.90,
  cody: 1.34,
  collin: 0.72,
  cooper: 1.53,
  copernicus: 2.79,
  curie: 1.08,
  dash: 0.87,
  dizzy: 1.37,
  duke: 1.07,
  einstein: 0.83,
  erin: 1.14,
  europa: 1.20,
  fermi: 0.94,
  fey: 1.22,
  flo: 0.95,
  flora: 1.10,
  ford: 1.52,
  frank: 1.08,
  gail: 1.08,
  gertrude: 0.86,
  goldie: 1.53,
  haley: 0.98,
  helen: 0.54,
  hog: 1.48,
  hoss: 0.93,
  holly: 1.22,
  hydra: 0.82,
  indy: 1.56,
  iona: 1.06,
  ira: 1.04,
  krypto: 1.33,
  kyle: 1.23,
  lana: 1.02,
  lars: 0.91,
  lillie: 0.61,
  liv: 1.24,
  lucy: 1.31,
  mac: 0.89,
  mae: 1.58,
  maggie: 0.86,
  manny: 1.34,
  mendel: 0.82,
  molly: 0.69,
  nadia: 0.65,
  natalie: 0.40,
  neo: 0.81,
  neptune: 1.32,
  nick: 0.73,
  niko: 0.87,
  niobe: 1.19,
  noble: 1.17,
  ogden: 1.66,
  oxana: 1.08,
  oz: 0.92,
  pablo: 1.28,
  pat: 0.87,
  paula: 0.98,
  percy: 1.13,
  phillip: 1.13,
  pit: 0.59,
  pluto: 0.77,
  polonius: 0.80,
  prometheus: 1.26,
  ray: 3.06,
  rex: 0.79,
  rhoda: 1.15,
  roger: 1.82,
  ronan: 3.06,
  ruben: 1.62,
  ruth: 2.14,
  saab: 1.33,
  sam: 1.00,
  sandy: 1.06,
  sarge: 1.20,
  scarlett: 0.86,
  selena: 1.17,
  silas: 0.77,
  sterling: 1.08,
  sully: 1.14,
  talia: 1.52,
  tara: 1.17,
  terra: 1.10,
  tate: 1.09,
  tess: 2.21,
  tessa: 1.38,
  tex: 1.06,
  thor: 1.34,
  thule: 1.35,
  titan: 0.55,
  uri: 0.84,
  van: 0.91,
  wolf: 0.56,
  xander: 1.40,
  yara: 1.13,
  yvette: 1.09,
  zane: 1.31,
  zora: 1.44,
};

function dealtDamage(attacker, move, defender) {
  const now = defender.scene?.time?.now ?? 0;
  // Fixed damage is the listed number. Buffs, defense, and the balance band stay off it.
  if (move?.fixed) {
    const amount = Math.max(0, move.damage ?? 0);
    const type = canonicalType(move.type || 'kinetic');
    return { total: amount, packets: [{ type, base: amount, dealt: amount }] };
  }
  move = prepareMove(move, attacker, defender, now);
  if (move?.enScale && attacker?.charDef?.combat && defender.charDef?.combat) {
    const mult = enGapMult(attacker.charDef.combat, defender.charDef.combat);
    move = {
      ...move,
      damage: canonicalType(move.type) === 'heat' ? (move.damage ?? 0) * mult : move.damage,
      damage2: canonicalType(move.type2) === 'heat' ? (move.damage2 ?? 0) * mult : move.damage2,
    };
  }
  const opts = combatOpts(defender);
  if (move?.chemDealtMult) opts.chemDealtMult = move.chemDealtMult;
  if (move?.ignoreDefense) opts.ignoreDefense = true;
  if (move?.ignoreReductions) opts.ignoreReductions = true;
  if (typeof move?.defensePierce === 'number' && move.defensePierce > 0) {
    opts.pierce = Math.min(1, move.defensePierce);
  }
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
    applyAttackPower(attacker, resolved, now);
    const band = BAND_DAMAGE[attacker?.charDef?.id];
    if (band && band !== 1) {
      resolved.total *= band;
      for (const p of resolved.packets) p.dealt *= band;
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
  if (move.type3) {
    const extra = applyDefense(move.damage3 ?? 0, move.type3, defender.charDef?.defense);
    total += extra;
    packets.push({ type: move.type3, dealt: extra });
  }
  const resolved = { total, packets };
  applyAttackPower(attacker, resolved, now);
  return resolved;
}

function applyAttackPower(attacker, resolved, now) {
  if (!(attacker?.attackPowerUntil > now) || !(attacker.attackPower > 0)) return;
  const mul = attacker.attackPower;
  resolved.total *= mul;
  for (const p of resolved.packets) p.dealt *= mul;
}

/** Feet for a ground slam, or the predicted floor point a meteor is already falling toward. */
function burstLanding(fighter, move) {
  if (!move) return null;
  if (move.groundImpact) return { x: fighter.x, y: fighter.y };
  if (!move.predict) return null;
  const scene = fighter.scene;
  let best = null;
  let bestD = Infinity;
  for (const other of scene?.fighters || []) {
    if (other === fighter || !other.alive || other.state === 'ko' || other.state === 'dead') continue;
    const d = Math.hypot(other.x - fighter.x, other.y - fighter.y);
    if (d < bestD) { bestD = d; best = other; }
  }
  const lead = move.predict.lead ?? 0.32;
  let at;
  if (!best) {
    const face = fighter.facing || 1;
    at = { x: fighter.x + face * 140, y: fighter.y };
  } else {
    const vx = best.body?.velocity?.x ?? 0;
    const vy = best.body?.velocity?.y ?? 0;
    at = { x: best.x + vx * lead, y: best.y - (best.bodyH ?? 80) * 0.45 + vy * lead };
  }
  if (move.floor) at.y = groundTop(scene, at.x, at.y);
  return at;
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
    this.state = 'idle'; // idle|walk|jump|fall|attack|hurt|ko|dead|grabbing|grabbed
    this.stateUntil = 0;
    this.attackCooldownUntil = 0;
    this.specialCooldownUntil = 0;
    this.grabCooldownUntil = 0;
    this.grabTarget = null;
    this.grabber = null;
    this.grabEscape = 0;
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
      this.state === 'charging' || this.state === 'defending' || this.state === 'jumpsquat' || this.state === 'ledge' ||
      this.state === 'grabbing' || this.state === 'grabbed';
  }

  update(time, dt) {
    if (this.bornAt == null) this.bornAt = time;
    if (this.state === 'dead') return;
    if (this.state === 'ko' && this._koHide > 0) {
      this._koHide -= 1;
      if (this._koHide <= 0) this.setVisible(false);
    }
    const stats = this.charDef.stats;
    const onGround = this.body.blocked.down || this.body.touching.down;
    this.grounded = onGround;

    if (onGround) {
      this.airJumpsLeft = stats.airJumps;
      this.ledgeRegrab = false;
      this.fastFell = false;
      this.fallPeak = 0;
    } else {
      this.fallPeak = Math.max(this.fallPeak || 0, this.body.velocity.y);
    }

    const step = this.scene?.stepMs || FEEL.stepMs;
    // Hitstun owns gravity. A glide, a charge float, or a ledge hang must
    // not leave a still body weightless for the launch.
    if (this.hitlagFrames > 0 || this.state === 'hurt') this.forceHitstunPhysics();
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

    if (this.state === 'grabbing' || this.state === 'grabbed') {
      this.holdGrab(time, step, dt);
      return;
    }

    if (this.state === 'defending' && this.defenseMove?.chargeMs && !this._shellBroken
      && time >= this.defenseStart + this.defenseMove.chargeMs && !this._shellDone) {
      this._shellDone = true;
      const buff = this.defenseMove.onReady || { mult: 0.45, ms: 5000 };
      this.mitigateMult = buff.mult ?? 0.45;
      this.mitigateUntil = time + (buff.ms ?? 5000);
      this.lingerHardening(time);
      this.state = 'idle';
      this.defenseMove = null;
      this.rig.setFlash(0xd7ecff);
    }

    // timed states expire
    if ((this.state === 'attack' || this.state === 'hurt' || this.state === 'defending') && time >= this.stateUntil) {
      if (this.state === 'defending' && this.defenseMove?.openAfter) {
        const openMs = this.defenseMove.vulnerableMs ?? 650;
        this.vulnerableUntil = time + openMs;
        this.lockedUntil = Math.max(this.lockedUntil || 0, time + openMs);
      }
      if (this.state === 'defending') this.onDefenseEnd(time);
      this.state = 'idle';
      this.rig.setFlash(null);
      this.rig.attackSwing = 0;
      this.activeHit = null;
      this.defenseMove = null;
    }
    tickKit(this, time);
    if (this.poisonFrom && !this.poisonFrom.played && time >= (this.poisonFrom.burstAt ?? 0)) {
      this.poisonFrom.played = true;
      const owner = (this.scene?.fighters || []).find((f) => f.charDef?.id === this.poisonFrom.id) || this;
      const move = { name: this.poisonFrom.move };
      playVfx(this.scene, owner, move, 'hit', {
        x: this.x,
        y: this.y - (this.bodyH ?? 80) * 0.45,
      });
    }
    if (this.state === 'defending' && this.defenseMove?.regen && time >= (this._regenAt ?? 0)) {
      this._regenAt = time + (this.defenseMove.regenEvery ?? 800);
      this.percent = Math.max(0, this.percent - this.defenseMove.regen);
    }
    if (this.state === 'defending' && this.defenseMove?.clearType && time >= (this._regenAt ?? 0)) {
      this._regenAt = time + (this.defenseMove.regenEvery ?? 500);
      const type = this.defenseMove.clearType;
      const pile = this.takenByType?.[type] ?? 0;
      const step = Math.min(pile, this.defenseMove.clearStep ?? 2);
      if (step > 0) {
        this.takenByType[type] = pile - step;
        this.percent = Math.max(0, (this.percent ?? 0) - step);
      }
    }
    if (this.state === 'defending' && this.defenseMove?.rewind) {
      const log = this._rewindLog ?? (this._rewindLog = []);
      const last = log[log.length - 1];
      if (!last || time - last.t >= 50) {
        log.push({ t: time, x: this.x, y: this.y, percent: this.percent ?? 0 });
      }
      while (log.length > 1 && time - log[0].t > 1200) log.shift();
    }
    if (this.state === 'defending' && this.defenseMove?.revealNear && time >= (this._revealAt ?? 0)) {
      const spec = this.defenseMove.revealNear;
      this._revealAt = time + (spec.every ?? 1000);
      const reach = spec.radius ?? 220;
      for (const other of this.scene?.fighters || []) {
        if (other === this || !other.alive) continue;
        const hidden = (other.phasingUntil ?? 0) > time
          || other.state === 'defending' && other.defenseMove?.phase
          || (other.alpha ?? 1) < 0.5;
        if (!hidden) continue;
        if (Math.hypot(other.x - this.x, other.y - this.y) > reach) continue;
        other.revealedUntil = time + (spec.ms ?? 1100);
        other.phasingUntil = 0;
      }
      playVfx(this.scene, this, this.defenseMove, 'wave');
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
    if (this.dazzleUntil > time) {
      const left = inp.left;
      inp.left = inp.right;
      inp.right = left;
    }
    let pressedJump = inp.jump && !this._prev.jump && !((this.goldUntil ?? 0) > time);
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
      if (this.slowUntil > time) {
        const stacks = this.slowStacks ?? 1;
        speed *= stacks > 1 ? Math.max(0.34, 0.55 - (stacks - 1) * 0.08) : 0.55;
      }
      let vx = 0;
      if (inp.left) vx -= speed;
      if (inp.right) vx += speed;
      if (this.rootedUntil > time) vx = 0;
      if (this.state === 'attack' && onGround) vx *= 0.25; // plant feet on ground attacks
      if (this.dashUntil && time < this.dashUntil) {
        const weave = this.currentMove?.weaveEvery;
        if (weave && this.attackFrame && this.attackFrame % weave === 0 && this._weavedAt !== this.attackFrame) {
          this._weavedAt = this.attackFrame;
          this.dashVX = -this.dashVX;
        }
        vx = this.dashVX; // kind:'dash' overrides normal movement
        if (this._gliding && this.body) {
          this.body.allowGravity = false;
          this.body.setVelocityY(this.dashVY || 0);
        }
      } else if (this._gliding) {
        this._gliding = false;
        if (this.body) this.body.allowGravity = true;
      }
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
          this.launch = null;
          this._appliedLaunch = null;
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
          // Residual knockback launch was still added after the jump impulse,
          // so damaged fighters hopped higher and fell on a stacked arc.
          this.launch = null;
          this._appliedLaunch = null;
          if (this.isBot) this._botJumpHold = FEEL.jumpSquat;
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft -= 1;
          this.body.setVelocityY(-stats.jumpVelocity * 0.92);
          this.launch = null;
          this._appliedLaunch = null;
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

    if (this.state === 'defending' && this.defenseMove?.rooted && this.body) {
      this.body.setVelocityX(0);
    }
    if (this.state === 'defending' && this.defenseMove?.float && this.body) {
      if (this._floatFloor == null) this._floatFloor = this.y;
      const target = this._floatFloor - (this.bodyH ?? 80) * 0.62;
      this.body.allowGravity = false;
      this.body.setVelocityY((target - this.y) * 5);
    }
    if (this.state === 'defending' && this.defenseMove?.cleanse) {
      const hadPoison = (this.poisonUntil ?? 0) > time;
      cleanse(this, this.defenseMove.cleanse);
      if (hadPoison && !((this.poisonUntil ?? 0) > time) && !this._cleansedFx) {
        this._cleansedFx = true;
        playVfx(this.scene, this, this.defenseMove, 'cleanse');
      }
    }
    if (this.state === 'defending' && this.defenseMove?.fadeAlpha != null) {
      this.alpha = visibleAlpha(this, time, this.defenseMove.fadeAlpha);
      this._hazeFade = true;
    } else if (this._hazeFade) {
      this.alpha = 1;
      this._hazeFade = false;
    }
    if (this.state === 'attack' && this.currentMove?.flicker) {
      this.alpha = Math.floor(time / 50) % 2 === 0 ? 1 : 0.12;
      this._flickerHid = true;
    } else if (this._flickerHid) {
      this.alpha = 1;
      this._flickerHid = false;
    }
    if ((this._blinkUntil ?? 0) > time) {
      this.alpha = 0;
      this._blinkHid = true;
    } else if (this._blinkHid) {
      this.alpha = 1;
      this._blinkHid = false;
      const gone = this._blinkMove;
      this._blinkMove = null;
      if (gone) playVfx(this.scene, this, gone, 'linger');
    }
    if ((this.revealedUntil ?? 0) > time) {
      this.alpha = 1;
    }

    if (onGround && this._wasAir) {
      const hard = (this.fallPeak || 0) > FEEL.landingHardVy;
      const lag = this.state === 'attack'
        ? (this.currentMove?.landingLagF ?? FEEL.landingAerial)
        : (hard ? FEEL.landingHard : FEEL.landingSoft);
      if (this.state === 'attack') this.stateUntil += lag * step;
      else if (this.state !== 'hurt' && this.state !== 'jumpsquat') this.lockedUntil = Math.max(this.lockedUntil || 0, time + lag * step);
      this.landing = lag;
      // Jump/fall used to stick after landing, so walk never remapped until an
      // attack or hurt expired back to idle. Clear locomotion air states here.
      if (this.state === 'jump' || this.state === 'fall') this.state = 'idle';
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
      if (chargeMove?.floatRise && this.body && this.chargeStart != null) {
        const max = chargeMove.maxChargeMs || 1;
        const frac = Math.min(1, Math.max(0, time - this.chargeStart) / max);
        if (this._floatFloor == null) this._floatFloor = this.y;
        const target = this._floatFloor - chargeMove.floatRise * frac;
        this.body.allowGravity = false;
        this.body.setVelocityY((target - this.y) * 6);
      }
      if (chargeMove?.seep) this.phasingUntil = time + 80;
      if (chargeMove?.critWindow && this.chargeStart != null && !this._critCue) {
        if (time - this.chargeStart >= (chargeMove.maxChargeMs ?? 0)) {
          this._critCue = true;
          playVfx(this.scene, this, chargeMove, 'warn');
        }
      }
      if (chargeMove?.tonic && this.chargeStart != null) {
        const every = chargeMove.tonic.every ?? 1000;
        const steps = Math.floor((time - this.chargeStart) / every);
        if (steps > (this._tonicSteps ?? 0)) {
          const gained = steps - (this._tonicSteps ?? 0);
          this._tonicSteps = steps;
          applyDot(this, (chargeMove.tonic.cost ?? 1) * gained, 'radiation');
        }
      }
      if (chargeMove?.eatZones) this.scene?.consumeZones?.(this, chargeMove.eatZones);
      if (chargeMove?.pull) this.pullNearby(chargeMove.pull);
      if (chargeMove?.overhold && this.chargeStart != null && time - this.chargeStart >= (chargeMove.maxChargeMs ?? 0) + (chargeMove.overhold.grace ?? 220)) {
        this._overheld = true;
        this.fireCharge(time);
      } else if (chargeMove?.detonateAtFull && this.chargeStart != null && time - this.chargeStart >= chargeMove.maxChargeMs) {
        this.fireCharge(time);
      } else if (dirHeld && !chargeMove?.aimOnRelease) {
        // pressing a direction cancels the charge -- this slot is only for
        // the neutral (no-direction) case. An aimed release (maglev) keeps
        // the stick as the launch direction instead.
        if (chargeMove?.tonic) grantTonic(this, chargeMove, time);
        this.state = 'idle';
        this.chargeStart = null;
        this._floatFloor = null;
        if (this.body) this.body.allowGravity = true;
      } else if (releasedAttack) {
        this.fireCharge(time);
      }
    } else if (this.state === 'defending' && (this.specialMutedUntil ?? 0) > time) {
      this.onDefenseEnd(time);
      this.state = 'idle';
      this.defenseMove = null;
      this.rig.setFlash(null);
    } else if (this.state === 'defending' && this.defenseMove?.hold !== false && !inp.special) {
      this.onDefenseEnd(time);
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
          let swing = this.charDef.moves.basicDirectional;
          if (this.copiedMove && !((this.moveLock?.[this.copiedMove.name] ?? 0) > time)) {
            swing = this.copiedMove;
            this.copiedMove = null;
          }
          this.startMove(time, swing, 'basic', 'basicDirectional');
        } else {
          this.state = 'charging';
          this.chargeStart = time;
          this._tonicSteps = 0;
          this._critCue = false;
          if (this.charDef.moves.basicCharge?.perTravel) this.travel = 0;
        }
      } else if (pressedSpecial && time >= this.specialCooldownUntil && time >= (this.vulnerableUntil ?? 0) && time >= (this.specialMutedUntil ?? 0)) {
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

    if (this.diveUntil || (this.dashUntil && time < this.dashUntil && !this._gliding)) this.holdDiveOnDeck();
    if (this.diveUntil && time >= (this.diveArm ?? 0) && (onGround || time >= this.diveUntil)) {
      const slam = this.diveMove;
      const at = slam?.slamAtFeet ? { x: this.x, y: this.y } : undefined;
      this.scene.resolveBurst?.(this, slam, at);
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
          this.scene.juice?.afterimage?.(this);
        }
      }
      // Dashes leave a short trail of ghosts, still capped per fighter.
      if (!this.scene?.simFast && this.dashUntil && time < this.dashUntil && this.attackFrame % 5 === 0) {
        const dx = this.x - (this._ghostX ?? this.x);
        const dy = this.y - (this._ghostY ?? this.y);
        if (dx * dx + dy * dy > 144) {
          this.scene.juice?.afterimage?.(this, 0.36);
          this._ghostX = this.x;
          this._ghostY = this.y;
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
    // Remap grounded locomotion even if state briefly lags behind landing
    // (jump/fall) so walk sheets start as soon as horizontal speed is there.
    if (this.state === 'idle' || this.state === 'walk' || this.state === 'jump' || this.state === 'fall') {
      if (!onGround) {
        animState = this.body.velocity.y < -40 ? 'jump' : 'fall';
      } else if (Math.abs(this.body.velocity.x) > 12) {
        animState = 'walk';
        if (this.state === 'jump' || this.state === 'fall' || this.state === 'idle') this.state = 'walk';
      } else {
        animState = 'idle';
        if (this.state === 'jump' || this.state === 'fall' || this.state === 'walk') this.state = 'idle';
      }
    }
    const speedFactor = Math.abs(this.body.velocity.x) / Math.max(1, stats.speed);
    this.applyLaunch();
    const melt = this.state === 'defending' && !!this.defenseMove?.puddle;
    if (this.rig) {
      this.rig.puddle = melt;
      this.rig.tripped = (this.trippedUntil || 0) > time;
    }
    if (melt) {
      this.phasingUntil = time + 90;
      this._puddlePhase = true;
      this.body?.setVelocityX(0);
    } else if (this._puddlePhase) {
      this._puddlePhase = false;
      this.phasingUntil = 0;
    }
    this.rig.facing = this.facing;
    this.rig.frameData = this.frameData;
    this.rig.attackFrame = this.attackFrame || 0;
    this.rig.comboStep = this._comboStep || 0;
    this.rig.hurtUnits = this.hurtUnits || 0;
    this.rig.hurtSign = this.hurtSign || 1;
    this.rig.landing = this.landing || 0;
    this.rig.vy = this.body?.velocity?.y || 0;
    if (this.landing > 0) this.landing -= 1;
    if (!this.scene?.simFast && animState === 'walk' && Math.floor(this.rig.animT * 8) !== this._foot) {
      this._foot = Math.floor(this.rig.animT * 8);
      if (this._foot % 4 === 0) {
        sfx('foot');
        this.scene.juice?.dust?.(this.x - this.facing * 8, this.y, -this.facing);
      }
    }
    this.rig.holdFrame = (this.goldUntil ?? 0) > time;
    this.rig.animPace = this.slowUntil > time && this._animPace ? this._animPace : 1;
    this.rig.animate(dt / 1000, animState, speedFactor);
    const goldNow = (this.goldUntil ?? 0) > time;
    const revealNow = (this.revealTintUntil ?? 0) > time;
    if (goldNow) {
      this.rig.setFlash?.(0xffc85a);
      this._goldFlash = true;
    } else if (revealNow) {
      this.rig.setFlash?.(this.revealTint ?? 0x8ec8ff);
      this._revealFlash = true;
      this._goldFlash = false;
    } else if (this._goldFlash || this._revealFlash) {
      this.rig.setFlash?.(null);
      this._goldFlash = false;
      this._revealFlash = false;
    }
    this.syncChalkTint();
    if (this._sheetFxFrame && this.state === 'attack' && this.attackFrame === this._sheetFxFrame && this.currentMove) {
      this._sheetFxFrame = 0;
      playVfx(this.scene, this, this.currentMove, 'release', { fromSheet: true });
    }
    if (this._px != null) this.travel = (this.travel ?? 0) + Math.abs(this.x - this._px);
    this._px = this.x;
  }

  answerStrike(attacker, time) {
    const fx = this.defenseMove?.onStruck;
    if (!fx || !attacker || attacker === this) return;
    applyOnHit(this, attacker, { name: this.defenseMove?.name, onHit: fx }, time);
  }

  lingerHardening(time) {
    const d = this.defenseMove;
    if (!d?.harden || !this.hardenStacks) return;
    this._hardenCoat = d.name;
    this.kineticResistMult = Math.max(0.55, 1 - this.hardenStacks * (d.hardenLingerStep ?? 0.07));
    this.kineticResistUntil = time + (d.hardenLinger ?? 1800);
  }

  onDefenseEnd(time) {
    const coat = this.defenseMove;
    if (!coat) return;
    this.lingerHardening(time);
    this.scene?.dropPins?.(this);
    this.scene?.clearOwnedZones?.(this, coat.zone?.name || coat.name);
    if (coat.fadeAlpha != null) this.alpha = 1;
    this._floatFloor = null;
    if (coat.float && this.body) this.body.allowGravity = true;
    this._cleansedFx = false;
    this.restoreShrink();
    playVfx(this.scene, this, coat, 'letgo');
    if (coat.sponge) {
      const stored = this._sponge ?? 0;
      this._sponge = 0;
      const push = coat.sponge.push ?? 80;
      this.scene?.resolveBurst?.(this, {
        name: coat.name,
        kind: 'burst',
        isCounterAttack: true,
        type: 'kinetic',
        damage: Math.min(4, stored * 0.3),
        radius: coat.sponge.radius ?? 74,
        baseKnockback: push + Math.min(120, stored * 12),
        knockbackGrowth: 0.8,
      });
    }
    if (coat.letgoBurst) {
      this.scene?.resolveBurst?.(this, {
        name: coat.name,
        kind: 'burst',
        isCounterAttack: true,
        baseKnockback: 80,
        knockbackGrowth: 1.4,
        ...coat.letgoBurst,
      });
    }
    if (coat.releaseRods) {
      const glow = !!this._soakedRad;
      this._soakedRad = false;
      this.scene?.throwRods?.(this, coat, glow);
    }
    const ready = rearmDefense(coat, time);
    if (ready != null) this.specialCooldownUntil = ready;
  }

  startMove(time, move, slot, moveKey = null) {
    this._liftBurst = false;
    if (move?.name && (this.moveLock?.[move.name] ?? 0) > time) {
      this.state = 'idle';
      this.attackCooldownUntil = Math.max(this.attackCooldownUntil ?? 0, time + 180);
      playVfx(this.scene, this, move, 'fizzle');
      return;
    }
    if (this.catalystStacks > 0 && move?.consumeCatalyst !== false && ((move.damage ?? 0) > 0 || (move.damage2 ?? 0) > 0)) {
      const mul = 1 + (this.catalystPer ?? 0.25) * this.catalystStacks;
      this.catalystStacks = 0;
      move = {
        ...move,
        damage: (move.damage ?? 0) * mul,
        damage2: move.damage2 != null ? move.damage2 * mul : move.damage2,
      };
    }
    if (move?.gasBolt && this.absorbedGas) {
      const mul = move.gasBolt;
      this.absorbedGas = false;
      move = {
        ...move,
        damage: (move.damage ?? 0) * mul,
        damage2: move.damage2 != null ? move.damage2 * mul : move.damage2,
        projectileRadius: (move.projectileRadius ?? 10) * (move.boltScale ?? 1),
        vfxColor: move.boltColor ?? move.vfxColor,
      };
    }
    if (move.luckyEvery) {
      this._lucky = (this._lucky ?? 0) + 1;
      if (this._lucky % move.luckyEvery === 0) {
        const mul = move.luckyMult ?? 2;
        move = {
          ...move,
          damage: (move.damage ?? 0) * mul,
          damage2: move.damage2 != null ? move.damage2 * mul : move.damage2,
        };
      }
    }
    if (move.sharpen) {
      if (this._sharpenName === move.name) {
        this._sharpen = Math.min(8, (this._sharpen ?? 0) + 1);
      } else {
        this._sharpenName = move.name;
        this._sharpen = 1;
      }
    }
    if (move.combo) {
      const hits = move.combo.hits ?? 3;
      const open = this._comboName === move.name && this._comboHit && time <= (this._comboUntil ?? 0);
      let step = open ? (this._comboStep ?? 1) + 1 : 1;
      if (step > hits) step = 1;
      this._comboName = move.name;
      this._comboStep = step;
      this._comboHit = false;
      this._comboUntil = time + (move.combo.window ?? 480);
      const scale = move.combo.scales?.[step - 1] ?? 1;
      const kb = move.combo.knockbacks?.[step - 1];
      const launch = move.combo.launch?.[step - 1];
      move = {
        ...move,
        damage: (move.damage ?? 0) * scale,
        damage2: move.damage2 != null ? move.damage2 * scale : move.damage2,
        baseKnockback: kb ?? move.baseKnockback,
        launchMult: launch ?? move.launchMult,
        _comboStep: step,
      };
    }
    if (move.halfLife) {
      const gen = halfLifeScale(this, move, time);
      move = {
        ...move,
        damage: (move.damage ?? 0) * gen,
        damage2: move.damage2 != null ? move.damage2 * gen : move.damage2,
        damage3: move.damage3 != null ? move.damage3 * gen : move.damage3,
        _halfLife: gen,
      };
    }
    if (move.echoWithin) {
      const again = this._echoName === move.name && time - (this._echoAt ?? -1e9) < move.echoWithin;
      if (again) {
        this._echoName = null;
        const mul = move.echoMult ?? 2;
        move = {
          ...move,
          damage: (move.damage ?? 0) * mul,
          damage2: move.damage2 != null ? move.damage2 * mul : move.damage2,
          damage3: move.damage3 != null ? move.damage3 * mul : move.damage3,
        };
      } else {
        this._echoName = move.name;
        this._echoAt = time;
      }
    }
    this.openedStill = !!(this.body && Math.abs(this.body.velocity.x) < 36 && Math.abs(this.body.velocity.y) < 80);
    if (this.missNext > 0) {
      this.missNext -= 1;
      this.dazzledBy = null;
      move = { ...move, damage: 0, damage2: 0, onHit: null, zone: null };
    }
    // Charge barks (Sound Off) bank damage and an unblock onto the next real swing.
    const banked = (move.damage ?? 0) > 0 || (move.damage2 ?? 0) > 0;
    if (banked && move.kind !== 'buff') {
      if (this._nextBonus) {
        move = { ...move, damage: (move.damage ?? 0) + this._nextBonus };
        this._nextBonus = 0;
      }
      if (this.unblockNext) {
        move = { ...move, breaksBlock: true };
        this.unblockNext = false;
      }
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
    if (this.attackHasteUntil > time && (this.attackHaste ?? 1) > 0 && (this.attackHaste ?? 1) !== 1) {
      move = scaledByHaste(move, this.attackHaste);
    }
    if (move.shatter) this._bladeDown = false;
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
    const sheet = sheetMeta(this.charDef.id, clipNameForMove(this.charDef.id, moveKey));
    if (sheet?.release != null) this._sheetFxFrame = fd.startup;
    else {
      this._sheetFxFrame = 0;
      playVfx(this.scene, this, move, 'release');
    }
    applyOnCast(this, move, time, move._chargeFrac ?? 1);
    const commitBurst = !!(move.releaseOnHit || move.detonateAtFull || move.includeSelf || move.commit);

    if (move.kind === 'buff' || move.kind === 'zone') {
      if (move.yank) this.scene?.yankFront?.(this, move);
      if (move.blast) {
        const frac = move._chargeFrac ?? 1;
        const mult = move.blast.chargeDamageMult ?? 1;
        const damage = (move.blast.damage ?? 8) * (1 + (mult - 1) * frac);
        const radius = move.radius ?? move.blast.radius ?? 80;
        const packet = {
          name: move.name,
          kind: 'burst',
          type: move.blast.type ?? 'heat',
          damage,
          radius,
          baseKnockback: move.blast.knockback ?? 160,
          knockbackGrowth: move.blast.growth ?? 2.4,
          _noVfx: true,
        };
        const delay = this.scene?.stepMs || 16;
        this.scene?.time?.delayedCall(delay, () => {
          if (this.alive) {
            this.scene.resolveBurst?.(this, packet, { x: this.x, y: this.y - this.bodyH * 0.5 });
          }
        });
      }
      if (move.zone) {
        const zx = this.x + (this.facing || 1) * (move.zone.offsetX ?? 0);
        const zy = move.zone.feet
          ? this.y
          : this.y - this.bodyH * (move.zone.low ? 0.15 : 0.5);
        this.scene.spawnZone?.(this, move.zone, zx, zy);
      }
    } else if (move.kind === 'mine') {
      this.scene?.spawnMine?.(this, move);
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
    } else if (move.kind === 'burst' && move.geyser) {
      armGeyser(this.scene, this, move);
    } else if (move.kind === 'burst') {
      // burst hits everything in a radius partway through the animation.
      // Moves that can be interrupted on purpose (Supernova popping early)
      // still go off. `pulses` releases that same burst as a timed chain.
      const impactFrac = move.impactAt > 0 && move.impactAt <= 1 ? move.impactAt : 0.4;
      const burstAt = commitBurst ? step : Math.round((move.duration ?? step) * impactFrac);
      const landing = burstLanding(this, move);
      if (move.meteor) spawnMeteor(this.scene, this, move, landing, burstAt);
      const pulses = move.pulses?.length ? move.pulses : [{ damage: move.damage, delay: 0 }];
      for (const pulse of pulses) {
        const shot = move.pulses?.length
          ? { ...move, damage: pulse.damage ?? move.damage, radius: pulse.radius ?? move.radius, pulses: null }
          : move;
        this.scene.time.delayedCall(burstAt + (pulse.delay ?? 0), () => {
          if (this.state !== 'attack' && !commitBurst) return;
          this.scene.resolveBurst(this, shot, landing || undefined);
        });
      }
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
        if (move.aimOnRelease || move._glide) {
          const aim = move._glide || { x: this.facing || 1, y: 0 };
          const speed = move.dashSpeed ?? 500;
          this.dashVX = aim.x * speed;
          this.dashVY = aim.y * speed;
          this._gliding = true;
          if (this.body) this.body.allowGravity = false;
        } else {
          this.dashVX = this.facing * (move.dashSpeed ?? 500);
          this.dashVY = 0;
          this._gliding = false;
        }
      }
    }
    if (move.zone && move.kind !== 'zone') {
      const zx = this.x + this.facing * (move.offsetX ?? 0);
      const zy = this.y - this.bodyH * (move.zone.low ? 0.2 : 0.45);
      this.scene.spawnZone?.(this, move.zone, zx, zy);
    }
    if (move.also && move.kind !== 'projectile') {
      const extra = { ...move.also, name: move.also.name ?? move.name, delayMs: 0 };
      this.scene?.time?.delayedCall(move.also.delayMs ?? 140, () => {
        if (this.alive) this.scene.spawnProjectile?.(this, extra);
      });
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
    this._floatFloor = null;
    const coinFlip = move.fizzleCoin && (Math.floor(time / 6400) % 2 === 1);
    let gambleScale = 1;
    if (move.gamble) {
      const roll = this.scene?.rng ? this.scene.rng() : Math.random();
      const outcome = gambleFizzle(heldMs, move.maxChargeMs ?? 0, move.gamble, roll);
      if (outcome.fizzle) {
        this.state = 'idle';
        this.attackCooldownUntil = time + 420;
        if (this.body) this.body.allowGravity = true;
        this.scene.noteMove?.(this, move);
        playVfx(this.scene, this, move, 'fizzle');
        return;
      }
      gambleScale = outcome.scale;
    }
    if ((move.fizzleBelow != null && frac < move.fizzleBelow) || coinFlip) {
      this.state = 'idle';
      this.attackCooldownUntil = time + 420;
      if (this.body) this.body.allowGravity = true;
      this.scene.noteMove?.(this, move);
      playVfx(this.scene, this, move, 'fizzle');
      return;
    }
    let src = move;
    if (move.earlyBlast && frac < (move.earlyBlast.below ?? 1)) {
      const early = move.earlyBlast;
      src = {
        ...move,
        type: early.type ?? 'heat',
        damage: early.damage ?? 0,
        type2: undefined,
        damage2: undefined,
        radius: early.radius ?? move.radius,
        chargeDamageMult: 1,
        chargeRadiusMult: 1,
      };
    }
    const scale = (base, mult) => (base ?? 0) * (1 + ((mult ?? 1) - 1) * frac);
    const scaled = {
      ...src,
      _chargeFrac: frac,
      _baseRadius: move.radius,
      damage: src.damage != null ? scale(src.damage, src.chargeDamageMult) : src.damage,
      damage2: src.damage2 != null ? scale(src.damage2, src.chargeDamageMult) : src.damage2,
      damage3: src.damage3 != null ? scale(src.damage3, src.chargeDamageMult) : src.damage3,
      baseKnockback: scale(move.baseKnockback ?? 0, move.chargeKnockbackMult),
      radius: src.radius != null ? scale(src.radius, src.chargeRadiusMult) : src.radius,
      rangeW: move.rangeW != null && move.chargeRangeMult ? scale(move.rangeW, move.chargeRangeMult) : move.rangeW,
      hits: Array.isArray(move.hits)
        ? move.hits.map((h) => ({ ...h, damage: scale(h.damage ?? 0, move.chargeDamageMult) }))
        : move.hits,
      pulses: Array.isArray(move.pulses)
        ? move.pulses.map((p) => ({ ...p, damage: scale(p.damage ?? move.damage ?? 0, move.chargeDamageMult) }))
        : move.pulses,
      _baseProjectileRadius: move.projectileRadius,
      projectileRadius: move.projectileRadius != null ? scale(move.projectileRadius, move.chargeRadiusMult) : move.projectileRadius,
      explodeRadius: src.explodeRadius != null ? scale(src.explodeRadius, src.chargeRadiusMult) : src.explodeRadius,
      hitRadius: src.hitRadius != null ? scale(src.hitRadius, src.chargeRadiusMult) : src.hitRadius,
      projectileSpeed: move.projectileSpeed != null && move.chargeSpeedMult != null
        ? scale(move.projectileSpeed, move.chargeSpeedMult)
        : move.projectileSpeed,
      dashSpeed: move.dashSpeed != null ? scale(move.dashSpeed, move.chargeDashMult) : move.dashSpeed,
      _beamScale: 1 + ((move.chargeLengthMult ?? 1) - 1) * frac,
    };
    if (move.selfDamage?.chargeMult != null) {
      scaled.selfDamage = {
        ...move.selfDamage,
        damage: scale(move.selfDamage.damage ?? 4, move.selfDamage.chargeMult),
        withCharge: false,
      };
    }
    if (move.perTravel) {
      const extra = Math.min(move.perTravelCap ?? 5, (this.travel ?? 0) / move.perTravel);
      if (scaled.damage != null) scaled.damage += extra;
      this.travel = 0;
    }
    if (move.stainAtFull && frac >= (move.stainAt ?? 0.95)) scaled.dropZone = move.stainAtFull;
    if (this._overheld && move.overhold) {
      this._overheld = false;
      scaled.includeSelf = true;
      if (move.overhold.damage != null) scaled.damage = move.overhold.damage;
      if (move.overhold.damage2 != null) scaled.damage2 = move.overhold.damage2;
      if (move.overhold.radius != null) scaled.radius = move.overhold.radius;
      if (move.overhold.scale > 0) scaled._selfBlast = move.overhold.scale;
    }
    if (this._storedCharge && (move.storeHits || move.bankCap)) {
      scaled._stored = this._storedCharge;
      scaled.damage = (scaled.damage ?? 0) + this._storedCharge;
      this._storedCharge = 0;
    }
    if (move.stealHeat && this._storedHeat) {
      scaled.type2 = scaled.type2 ?? 'heat';
      scaled.damage2 = (scaled.damage2 ?? 0) + this._storedHeat;
      this._storedHeat = 0;
    }
    if (gambleScale !== 1) {
      if (scaled.damage != null) scaled.damage *= gambleScale;
      if (scaled.damage2 != null) scaled.damage2 *= gambleScale;
      if (scaled.radius != null) scaled.radius *= gambleScale;
    }
    if (move.aimOnRelease) scaled._glide = glideAim(this.input, this.facing || 1);
    if (move.yank) {
      const min = move.yankMin ?? 120;
      const max = move.yankMax ?? min;
      scaled.yankRange = min + (max - min) * frac;
    }
    if (move.clockWindow) {
      const period = move.clockWindow.period ?? 410;
      const slack = move.clockWindow.slack ?? 85;
      let onTick = false;
      if (move.clockWindow.fromStart) onTick = clockPerfect(heldMs, move.clockWindow);
      else {
        const phase = ((time % period) + period) % period;
        const dist = Math.min(phase, period - phase);
        onTick = dist <= slack;
      }
      if (onTick) {
        const mult = move.clockWindow.mult ?? 3;
        if (scaled.damage != null) scaled.damage *= mult;
        if (scaled.damage2 != null) scaled.damage2 *= mult;
        scaled._clockTick = true;
      }
    }
    if (move.riseUnder && this.body && this.scene?.fighters) {
      const from = { x: this.x, y: this.y };
      let best = null;
      let bestD = Infinity;
      for (const f of this.scene.fighters) {
        if (f === this || !f.alive || f.state === 'ko' || f.state === 'dead') continue;
        const d = Math.hypot(f.x - this.x, f.y - this.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best) {
        this._seepFrom = from;
        this.body.reset(best.x, best.y);
      }
    }
    if (move.zone && move.chargeRadiusMult) {
      scaled.zone = { ...move.zone, radius: scale(move.zone.radius ?? 70, move.chargeRadiusMult) };
    }
    if (move.rain) {
      const spreadMult = move.chargeSpreadMult ?? move.chargeRadiusMult ?? 1;
      scaled.rainSpread = scale(move.rainSpread ?? 220, spreadMult);
    }
    if (move.chargeStack) {
      const every = move.chargeStack.every ?? 1000;
      const stepDmg = move.chargeStack.damage ?? 4;
      const cap = move.chargeStack.cap ?? 16;
      this._nextBonus = Math.min(cap, Math.floor(heldMs / every) * stepDmg);
    }
    if (move.unblockAtFull) this.unblockNext = frac >= (move.unblockAt ?? 0.95);
    if (move.chargePierce) scaled.defensePierce = Math.max(0, Math.min(1, frac * move.chargePierce));
    if (move.recoilSelf != null) scaled.recoilSelf = scale(move.recoilSelf, 1.5);
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
    this._blockCharges = move.blockCharges ? { ...move.blockCharges } : null;
    if (move.kind === 'wall' && move.wallLingerMs) this.scene?.pourWall?.(this, move, time);
    this._shellDone = false;
    this._shellBroken = false;
    this._coatFlaked = false;
    this._coatShed = null;
    this._coatShedPlayed = false;
    this._coatFadeAt = 0;
    this._soakedRad = false;
    this.defenseStart = time;
    this._drainAt = time + (move.drain?.every ?? 1000);
    this._regenAt = time + (move.regenEvery ?? 800);
    this._revealAt = move.revealNear ? time : 0;
    if (move.rewind) {
      this._rewindSnap = { t: time, x: this.x, y: this.y, percent: this.percent ?? 0 };
      this._rewindLog = [this._rewindSnap];
    }
    if (move.shrink && this.rig) {
      this._shrinkFrom = this.rig.baseScale ?? 1;
      this.rig.baseScale = this._shrinkFrom * move.shrink;
    }
    if (move.leaveAfterimage) this.scene?.juice?.afterimage?.(this, 0.48);
    if (move.float) this.body?.setVelocityY(-70);
    if (move.rooted) this.body?.setVelocityX(0);
    if (move.zone) {
      this.scene.spawnZone?.(this, move.zone, this.x, this.y - this.bodyH * (move.zone.low ? 0.2 : 0.45));
    }
    this.scene.noteMove?.(this, move);
    this.currentMoveKey = 'specialDefense';
    this.rig.moveKey = 'specialDefense';
    this.rig.moveSlot = 'special';
    this.stateUntil = time + move.duration;
    this.specialCooldownUntil = move.regrow === 'press'
      ? time
      : time + move.duration + move.cooldown;
    playVfx(this.scene, this, move, 'defense');
    applyOnCast(this, move, time, 1);
    if (move.swapLine) this.scene?.swapAlongLine?.(this);
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

  // Head, torso, and legs, in world space, for the pose he is in now.
  getHurtboxes() {
    return hurtboxes(this);
  }

  getPushbox() {
    return pushbox(this);
  }

  // Every live strike box. A dash uses the body itself.
  getHitboxes() {
    return hitboxes(this);
  }

  // Axis-aligned hitbox in world space for the current melee attack.
  // One rectangle covering every live strike box, for callers that want a tip.
  getHitboxRect() {
    const hb = hitAabb(this);
    if (!hb) return null;
    return new Phaser.Geom.Rectangle(hb.x, hb.y, hb.width, hb.height);
  }

  getHurtboxRect() {
    // Union of the part boxes. Beams and zones that only need a rough body
    // still work; melee and projectiles test the parts.
    const u = hurtUnion(this);
    return new Phaser.Geom.Rectangle(u.x, u.y, u.width, u.height);
  }

  /**
   * Apply a hit to this fighter. Returns actual damage dealt.
   * launchDir: -1 or 1, the direction the attack itself points. Omit it for
   * radial moves, which launch away from the attacker instead.
   */
  takeHit(attacker, move, time, launchDir) {
    if (this.state === 'ko' || this.state === 'dead') return 0;
    move = finalBlow(move);
    // A hit during a grab always breaks the clinch first.
    if ((this.state === 'grabbing' || this.state === 'grabbed') && !move?.isGrabThrow) {
      this.breakGrab(time, false);
    }
    if (move.stripProtection && !move.isSelf && !move.isCounterAttack && stripProtection(this)) {
      playVfx(this.scene, this, move, 'shatter', {
        x: this.x,
        y: this.y - (this.bodyH ?? 80) * 0.45,
      });
    }
    if (this.state === 'defending' && this.defenseMove?.intangible && !move.isSelf && !move.isCounterAttack && !move.hitsRevealed) return 0;
    if (move.cancelInvis && !move.isSelf && !move.isCounterAttack) this.phasingUntil = 0;
    if (this.phasingUntil > time && !move.isSelf && !move.isCounterAttack && !move.hitsRevealed) return 0;
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
    if (this.state === 'charging' && !move.isSelf && !move.isCounterAttack) {
      const store = this.charDef.moves.basicCharge?.storeHits;
      if (store) {
        this._storedCharge = Math.min(store.cap ?? 24, (this._storedCharge ?? 0) + (store.per ?? 3));
        playVfx(this.scene, this, this.charDef.moves.basicCharge, 'absorb', {
          x: this.x,
          y: this.y - (this.bodyH ?? 80) * 0.5,
        });
      }
      const steal = this.charDef.moves.basicCharge?.stealHeat;
      if (steal) {
        const heat = (move.type === 'heat' ? (move.damage ?? 0) : 0)
          + (move.type2 === 'heat' ? (move.damage2 ?? move.damage ?? 0) : 0);
        if (heat) this._storedHeat = Math.min(steal.cap ?? 16, (this._storedHeat ?? 0) + heat * (steal.keep ?? 0.8));
      }
    }

    let incoming = move;
    if (this.state === 'defending' && this.defenseMove?.storeType && !move.isSelf && !move.isCounterAttack) {
      const gated = gateStored(incoming, this.defenseMove.storeType);
      if (gated.stored > 0) {
        const cap = this.defenseMove.storeCap ?? 24;
        this._nextBonus = Math.min(cap, (this._nextBonus ?? 0) + gated.stored);
      }
      if (gated.emptied) return 0;
      incoming = gated.move;
    }
    if (!move.isSelf && this.lingerImmuneUntil > time && this.lingerImmune?.length) {
      const ward = applyImmunities(incoming, { immune: this.lingerImmune });
      if (ward.emptied) {
        this.rig.setFlash(0x9ad7ff);
        return 0;
      }
      incoming = ward.move;
    }
    if (this.state === 'defending' && this.defenseMove?.immune?.length && !move.isSelf && !move.isCounterAttack) {
      const stripped = applyImmunities(incoming, this.defenseMove);
      if (this.defenseMove.powersCharge) {
        const before = (move.damage ?? 0) + (move.damage2 ?? 0);
        const after = stripped.emptied ? 0 : (stripped.move.damage ?? 0) + (stripped.move.damage2 ?? 0);
        const soaked = before - after;
        if (soaked > 0) {
          const cap = this.charDef.moves.basicCharge?.bankCap ?? 18;
          this._storedCharge = Math.min(cap, (this._storedCharge ?? 0) + soaked * 0.6);
        }
      }
      if (stripped.emptied) {
        if (this.defenseMove.copyMove && move?.name) {
          const snap = { ...move };
          delete snap.isCounterAttack;
          delete snap.isSelf;
          delete snap._projectile;
          delete snap._hitAt;
          delete snap._chargeFrac;
          this.copiedMove = snap;
        }
        if (this.defenseMove.capture && move.type) {
          this.captured = {
            type: move.type,
            damage: move.damage ?? 0,
            type2: move.type2,
            damage2: move.damage2,
            type3: move.type3,
            damage3: move.damage3,
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
        if (this.defenseMove.fizzChem && move._projectile) {
          const chem = [move.type, move.type2, move.type3].some((t) => t && canonicalType(t) === 'chemical');
          if (chem) playVfx(this.scene, this, this.defenseMove, 'fizz');
        }
        this.retortFromImmune(attacker, move, time);
        if (vaporAttack(move, attacker)) this.playVaporAlarm(attacker);
        if (this.defenseMove.crackAfterHits) {
          this.wallHits = (this.wallHits ?? 0) + 1;
          if (this.wallHits >= this.defenseMove.crackAfterHits) {
            const broken = this.defenseMove;
            playVfx(this.scene, this, broken, 'break', {
              x: this.x,
              y: this.y - (this.bodyH ?? 80) * 0.5,
            });
            this.state = 'idle';
            this.defenseMove = null;
          }
        }
        this.rig.setFlash(0xaee6ff);
        playVfx(this.scene, this, this.defenseMove, 'block', {
          x: this.x,
          y: this.y - (this.bodyH ?? 80) * 0.5,
        });
        return 0;
      }
      incoming = stripped.move;
    }
    if (!move.isSelf && this.state === 'defending' && this.defenseMove?.takenWhile) {
      const table = this.defenseMove.takenWhile;
      const scaled = (type, amount) => {
        if (!type || amount == null) return amount;
        const mul = table[canonicalType(type)];
        return mul == null ? amount : amount * mul;
      };
      incoming = {
        ...incoming,
        damage: scaled(incoming.type, incoming.damage),
        damage2: scaled(incoming.type2, incoming.damage2),
        damage3: scaled(incoming.type3, incoming.damage3),
      };
    }
    if (!move.isSelf && !move.isCounterAttack && this.state === 'defending' && this.defenseMove?.sponge) {
      const sponge = this.defenseMove.sponge;
      const keep = sponge.keep ?? 0.4;
      const next = { ...incoming };
      let stored = 0;
      const soak = (typeKey, dmgKey) => {
        const amount = next[dmgKey];
        if (amount == null || !next[typeKey]) return;
        const chem = canonicalType(next[typeKey]) === 'chemical';
        const taken = chem ? amount : amount * keep;
        stored += taken;
        next[dmgKey] = chem ? 0 : amount - taken;
        if (chem) next[typeKey] = undefined;
      };
      soak('type', 'damage');
      soak('type2', 'damage2');
      soak('type3', 'damage3');
      const cap = sponge.cap ?? 16;
      this._sponge = Math.min(cap, (this._sponge ?? 0) + stored);
      const total = (next.damage || 0) + (next.damage2 || 0) + (next.damage3 || 0);
      if (total <= 0) {
        this.rig?.setFlash?.(0xd7ecff);
        return 0;
      }
      incoming = next;
    }
    if (!move.isSelf && this.state === 'defending' && this.defenseMove?.absorbGas && move.gas) {
      const heal = this.defenseMove.absorbHeal ?? 0;
      if (heal) this.percent = Math.max(0, this.percent - heal);
      this.absorbedGas = true;
      this.rig?.setFlash?.(0xd7ecff);
      return 0;
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
      this.playVaporAlarm(attacker);
      this.retortFromImmune(attacker, move, time);
      this.rig.setFlash(0xaee6ff);
      return 0;
    }
    if (move.bonusVsBlock && this.state === 'defending') {
      const bump = 1 + move.bonusVsBlock;
      incoming = {
        ...incoming,
        damage: (incoming.damage ?? 0) * bump,
        damage2: incoming.damage2 != null ? incoming.damage2 * bump : incoming.damage2,
        damage3: incoming.damage3 != null ? incoming.damage3 * bump : incoming.damage3,
      };
    }

    const gate = interceptHit(this, attacker, incoming, time);
    if (gate.stripTypes?.length && gate.result === 'pass') {
      const drop = new Set(gate.stripTypes);
      const dropType = (t) => t && drop.has(canonicalType(t));
      incoming = {
        ...incoming,
        damage: dropType(incoming.type) ? 0 : incoming.damage,
        type: dropType(incoming.type) ? undefined : incoming.type,
        damage2: dropType(incoming.type2) ? 0 : incoming.damage2,
        type2: dropType(incoming.type2) ? undefined : incoming.type2,
        damage3: dropType(incoming.type3) ? 0 : incoming.damage3,
        type3: dropType(incoming.type3) ? undefined : incoming.type3,
      };
    }
    if (gate.typeScale) {
      const scaled = (type, amount) => {
        if (!type || amount == null) return amount;
        const keep = gate.typeScale[canonicalType(type)];
        return keep == null ? amount : amount * keep;
      };
      incoming = {
        ...incoming,
        damage: scaled(incoming.type, incoming.damage),
        damage2: scaled(incoming.type2, incoming.damage2),
        damage3: scaled(incoming.type3, incoming.damage3),
      };
    }
    if (gate.result === 'pass' && incoming.breaksBlock && attacker && attacker !== this) {
      const travel = incoming._travel;
      const face = travel > 0 ? 1 : travel < 0 ? -1 : (attacker.facing || 1);
      playVfx(this.scene, attacker, incoming, 'pierce', {
        x: this.x,
        y: this.y - (this.bodyH ?? 80) * 0.45,
        face,
      });
    }
    if (gate.damageMult && gate.damageMult !== 1) {
      incoming = {
        ...incoming,
        damage: (incoming.damage ?? 0) * gate.damageMult,
        damage2: incoming.damage2 != null ? incoming.damage2 * gate.damageMult : incoming.damage2,
        damage3: incoming.damage3 != null ? incoming.damage3 * gate.damageMult : incoming.damage3,
      };
      if (gate.damageMult > 1 && this.defenseMove) {
        const face = this.facing || 1;
        playVfx(this.scene, this, this.defenseMove, 'pierce', {
          x: this.x + face * (this.bodyW ?? 40) * 0.2,
          y: this.y - (this.bodyH ?? 80) * 0.45,
        });
      }
    }
    if (gate.shatter && gate.endDefense && gate.result === 'pass') {
      const broken = this.defenseMove;
      const anchor = broken ? fxAnchor(this, broken) : null;
      this.state = 'idle';
      this.defenseMove = null;
      if (broken) {
        playVfx(this.scene, this, broken, 'shatter', {
          x: anchor?.x ?? this.x,
          y: anchor?.y ?? this.y,
          face: this.facing || 1,
        });
      }
    }
    if (gate.result === 'pop' || gate.result === 'negate') {
      if (gate.result === 'negate' && this.defenseMove?.kind === 'wall') {
        const face = this.facing || 1;
        playVfx(this.scene, this, this.defenseMove, 'block', {
          x: this.x + face * ((this.bodyW ?? 40) * 0.5 + 16),
          y: this.y - (this.bodyH ?? 80) * 0.42,
        });
      }
      if (gate.result === 'negate' && this.defenseMove?.swallow) {
        const face = this.facing || 1;
        playVfx(this.scene, this, this.defenseMove, 'block', {
          x: this.x + face * (this.bodyW ?? 40) * 0.9,
          y: this.y - (this.bodyH ?? 80) * 0.5,
        });
      }
      if (gate.detonate && this.scene?.resolveBurst) {
        this.scene.resolveBurst(this, {
          name: this.defenseMove?.name ?? 'detonate',
          kind: 'burst',
          isCounterAttack: true,
          baseKnockback: 140,
          knockbackGrowth: 2.6,
          ...gate.detonate,
        }, { x: this.x, y: this.y - (this.bodyH ?? 80) * 0.45 });
      }
      if (gate.rewind && this.body) {
        const snap = rewindPoint(this._rewindLog, time) || this._rewindSnap;
        if (snap) {
          this.percent = snap.percent;
          this.body.reset(snap.x, snap.y);
          this.body.setVelocity(0, 0);
          playVfx(this.scene, this, this.defenseMove, 'linger', {
            x: snap.x,
            y: snap.y - (this.bodyH ?? 80) * 0.5,
          });
        }
      }
      if (this.defenseMove?.scanWeak && attacker && attacker !== this) {
        this.bonusHits = 1;
        this.bonusPacket = {
          type: weakestType(attacker.charDef?.combat),
          damage: this.defenseMove.scanDamage ?? 6,
          hitsName: this.defenseMove.name,
        };
      }
      if (this.defenseMove?.healOnBlock) {
        this.percent = Math.max(0, this.percent - this.defenseMove.healOnBlock);
      }
      if (gate.result === 'negate' && this.defenseMove?.amalgam && attacker) {
        playVfx(this.scene, this, this.defenseMove, 'absorb', {
          x: attacker.x,
          y: attacker.y - (attacker.bodyH ?? 80) * 0.45,
        });
      }
      if (gate.result === 'negate' && this.defenseMove?.soakRadiation) {
        const soaked = [incoming.type, incoming.type2, incoming.type3]
          .some((t) => t && canonicalType(t) === 'radiation');
        if (soaked) this._soakedRad = true;
      }
      if (gate.endDefense) {
        const def = this.defenseMove;
        if (gate.absorb && def) {
          playVfx(this.scene, this, def, 'absorb', {
            x: this.x,
            y: this.y - (this.bodyH ?? 80) * 0.5,
          });
        }
        if (def?.lockAttackMs && attacker && attacker !== this && move?.name) {
          attacker.moveLock = attacker.moveLock ?? {};
          attacker.moveLock[move.name] = time + def.lockAttackMs;
        }
        const regrow = def?.regrow ?? 1600;
        this.specialCooldownUntil = Math.max(this.specialCooldownUntil ?? 0, time + regrow);
        this.scene?.dropPins?.(this);
        this.state = 'idle';
        this.defenseMove = null;
        this.rig.setFlash(0xaee6ff);
        return 0;
      }
      if (gate.result === 'pop') {
        const popped = this.defenseMove;
        const ready = rearmDefense(this.defenseMove, time);
        if (ready != null) this.specialCooldownUntil = ready;
        const shed = coatSpec(this.defenseMove);
        if (shed?.flake) {
          this._coatFlaked = true;
          this._coatShed = { color: shed.color, until: time + 520 };
          this._coatShedPlayed = false;
          playVfx(this.scene, this, this.defenseMove, 'shatter', {
            x: this.x,
            y: this.y - (this.bodyH ?? 80) * 0.5,
          });
        } else {
          playVfx(this.scene, this, popped, 'break', {
            x: this.x,
            y: this.y - (this.bodyH ?? 80) * 0.5,
          });
        }
        this.state = 'idle';
        this.defenseMove = null;
      } else if (this.defenseMove?.crackAfterHits) {
        this.wallHits = (this.wallHits ?? 0) + 1;
        if (this.defenseMove.shellShrink && this.rig) {
          if (this._shrinkFrom == null) this._shrinkFrom = this.rig.baseScale ?? 1;
          this.rig.baseScale = this._shrinkFrom * (this.defenseMove.shellShrink ** this.wallHits);
        }
        if (this.wallHits >= this.defenseMove.crackAfterHits) {
          const broken = this.defenseMove;
          playVfx(this.scene, this, broken, 'break', {
            x: this.x,
            y: this.y - (this.bodyH ?? 80) * 0.5,
          });
          this.restoreShrink();
          this.state = 'idle';
          this.defenseMove = null;
        }
      }
      this.rig.setFlash(0xaee6ff);
      return 0;
    }
    if (gate.result === 'counter') {
      if (this.defenseMove?.replay && attacker && attacker !== this) {
        playVfx(this.scene, this, this.defenseMove, 'block', {
          x: this.x,
          y: this.y - this.bodyH * 0.45,
        });
        spawnReplayGhost(this.scene, this, attacker, incoming);
      }
      if (attacker && attacker !== this && this.defenseMove) {
        const aim = Math.atan2(
          (attacker.y - (attacker.bodyH ?? 80) * 0.45) - (this.y - this.bodyH * 0.5),
          attacker.x - this.x,
        );
        playVfx(this.scene, this, this.defenseMove, 'reflect', {
          x: this.x,
          y: this.y - this.bodyH * 0.5,
          aim,
        });
      }
      if (this.defenseMove?.retortBurst && attacker && attacker !== this) {
        playRetortPulse(this.scene, this, attacker);
      }
      if (this.defenseMove?.truce && attacker && attacker !== this) {
        const ms = this.defenseMove.truce.ms ?? 900;
        this.muteAllUntil = time + ms;
        attacker.muteAllUntil = time + ms;
        const dir = Math.sign(attacker.x - this.x) || (this.facing || 1);
        const push = this.defenseMove.truce.push ?? 280;
        attacker.body?.setVelocityX(dir * push);
        this.body?.setVelocityX(-dir * push);
      }
      if (this.defenseMove?.swap && attacker?.body && this.body && attacker !== this) {
        const ax = attacker.x;
        const ay = attacker.y;
        attacker.body.reset(this.x, this.y);
        this.body.reset(ax, ay);
      }
      if (attacker && attacker !== this && attacker.takeHit && gate.counter) {
        const cdmg = attacker.takeHit(this, gate.counter, time, this.facing);
        if (cdmg > 0) this.scene.noteHit?.(this, attacker, gate.counter);
        if (!gate.endDefense && this.defenseMove) {
          playVfx(this.scene, this, this.defenseMove, 'break', {
            x: this.x,
            y: this.y - (this.bodyH ?? 80) * 0.5,
            both: true,
            otherX: attacker.x,
            otherY: attacker.y - (attacker.bodyH ?? 80) * 0.5,
          });
        }
        if (gate.counter.rootMs && attacker.rootedUntil != null) {
          attacker.rootedUntil = Math.max(attacker.rootedUntil, time + gate.counter.rootMs);
        } else if (gate.counter.rootMs) {
          attacker.rootedUntil = time + gate.counter.rootMs;
        }
      }
      if (gate.endDefense && this.defenseMove) {
        const broken = this.defenseMove;
        this.state = 'idle';
        this.defenseMove = null;
        playVfx(this.scene, this, broken, 'shatter', {
          x: this.x,
          y: this.y - (this.bodyH ?? 80) * 0.5,
          both: true,
          otherX: attacker?.x,
          otherY: attacker ? attacker.y - (attacker.bodyH ?? 80) * 0.5 : undefined,
        });
      }
      if (gate.selfHit && attacker && attacker !== this) {
        const sdmg = this.takeHit(attacker, gate.selfHit, time, Math.sign((attacker.x ?? this.x) - this.x) || this.facing || 1);
        if (sdmg > 0) this.scene?.noteHit?.(attacker, this, gate.selfHit);
      }
      this.rig.setFlash(0x66ffee);
      this.scene.time.delayedCall(120, () => {
        if (this.state !== 'ko' && this.state !== 'dead') this.rig.setFlash(null);
      });
      if (gate.negate === false) {
        if (gate.keepTypes?.length) {
          const keep = new Set(gate.keepTypes);
          const typeOk = incoming.type && keep.has(incoming.type);
          const type2Ok = incoming.type2 && keep.has(incoming.type2);
          incoming = {
            ...incoming,
            damage: typeOk ? incoming.damage : 0,
            type: typeOk ? incoming.type : undefined,
            damage2: type2Ok ? incoming.damage2 : 0,
            type2: type2Ok ? incoming.type2 : undefined,
          };
        }
      } else {
        return 0;
      }
    }
    if (gate.result === 'partial' && !incoming.ignoreReductions && !move.ignoreReductions) {
      playVfx(this.scene, this, this.defenseMove, 'block', {
        x: this.x,
        y: this.y - (this.bodyH ?? 80) * 0.5,
      });
      const dealt = dealtDamage(attacker, incoming, this);
      const pierce = typeof incoming.defensePierce === 'number' && incoming.defensePierce > 0
        ? Math.min(1, incoming.defensePierce)
        : 0;
      const reduction = gate.reduction * (1 - pierce);
      let dmg = dealt.total * (1 - reduction);
      if (this.currentMove?.guardStrike && this.state === 'attack') dmg *= (1 - this.currentMove.guardStrike);
      if (this.state === 'charging' && this.charDef.moves.basicCharge?.whileCharging) {
        dmg *= this.charDef.moves.basicCharge.whileCharging.keep ?? 0.5;
      }
      const ownBlast = attacker === this && !move.isSelf;
      if (ownBlast) dmg *= TUNING.selfDamageMult;
      this.lastPackets = dealt.packets.map((p) => ({ ...p, dealt: p.dealt * (1 - reduction) * (ownBlast ? TUNING.selfDamageMult : 1) }));
      this.percent = Math.min(999, this.percent + dmg);
      this.creditDamage(attacker, dmg, incoming.type);
      this.igniteFromGuard(incoming, time, dmg);
      if (!gate.noKnockback && !incoming.noKnockback && !move.isSelf && !move.dot) {
        const kb = knockbackRaw(
          incoming.baseKnockback,
          incoming.knockbackGrowth,
          this.percent,
          this.weightNow(),
          (1 - reduction) * TUNING.knockbackScale * (ownBlast ? TUNING.selfKnockbackScale : 1),
        );
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
    if (!incoming.fixed && this.state === 'charging' && charging?.whileCharging) {
      const except = charging.whileCharging.except ?? [];
      if (!except.includes(incoming.type) && incoming.type !== 'radiation') dmg *= charging.whileCharging.keep ?? 0.5;
    }
    if (!incoming.fixed && this.mitigateUntil > time) dmg *= this.mitigateMult ?? 0.45;
    if (!incoming.fixed && this.currentMove?.guardStrike && this.state === 'attack') dmg *= (1 - this.currentMove.guardStrike);
    const ownBlast = attacker === this && !move.isSelf;
    const contagious = this.poisonInherit && this.poisonUntil > time;
    if (!incoming.fixed && this.state === 'defending' && this.defenseMove?.flatHit != null && !move.isSelf && dmg > 0 && incoming.name !== 'zone') {
      dmg = this.defenseMove.flatHit;
      if (!this.scene?.simFast) {
        const at = hitAnchor(attacker, this, incoming);
        spawnMoveExtra(
          this.scene, this, this.defenseMove, 'impact',
          at?.x ?? this.x, at?.y ?? (this.y - this.bodyH * 0.45), 1,
        );
      }
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
    this.igniteFromGuard(incoming, time, dmg);

    if (move.dot) {
      applyOnHit(attacker, this, incoming, time);
      this.noteHeatAndRecoil(attacker, incoming, time, dealt);
      this.spreadPoison(attacker, time, contagious);
      return dmg;
    }

    if (move.isSelf) {
      if (!move.noFlinch) {
        this.state = 'hurt';
        this.stateUntil = time + 160;
      }
      return dmg;
    }
    let kb = knockbackRaw(
      incoming.baseKnockback,
      incoming.knockbackGrowth,
      this.percent,
      this.weightNow(),
      TUNING.knockbackScale * (incoming.launchMult ?? 1) * (ownBlast ? TUNING.selfKnockbackScale : 1),
    );
    if (this.state === 'defending' && this.defenseMove?.chargeMs && !this._shellDone && dmg > 0) {
      this._shellBroken = true;
    }
    const pinned = this.state === 'defending' && this.defenseMove?.noKnockback && !incoming.isSelf;
    const bend = this.state === 'defending' && this.defenseMove?.noKnockdown && !incoming.isSelf;
    if (pinned || bend || incoming.noKnockback) kb = 0;
    this.applyKnockback(attacker, incoming, time, launchDir, kb, dmg, !armored && !bend && !incoming.noFlinch);
    if (incoming.onHit?.reverse && this.pendingLaunch) {
      const back = Math.sign((attacker?.x ?? this.x) - this.x) || -(this.pendingLaunch.dir || 1);
      this.pendingLaunch.dir = back;
    }

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
    if (incoming.dot) return;
    const radial = incoming.launch ? incoming.launch === 'radial' : incoming.kind === 'burst';
    const away = Math.sign(this.x - (attacker?.x ?? this.x)) || attacker?.facing || 1;
    const dir = (!radial && launchDir) ? launchDir : away;
    const slip = this.slipperyUntil > time ? (this.slipperyMult ?? 1.3) : 1;
    const grabbed = incoming.pull && attacker && kb > 0 && !(this.defenseMove?.grabImmune && this.state === 'defending');
    let units = smashUnits(Math.max(0, kb) * slip);
    const grounded = !!(this.body?.blocked?.down || this.body?.touching?.down);
    let angle = launchAngle(incoming, grounded, units);
    if (incoming.trip) {
      units = Math.min(units, 24);
      angle = 0;
    }
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
    // Three rendered frames of flash. Counted in present(), not in sim
    // frames, so KO slow-motion cannot stretch it into a white silhouette.
    if (dmg > 0 && !incoming.isSelf) this._flashShow = 3;
    this._hitGrounded = grounded;
    this.hurtUnits = units;
    this.hurtSign = -dir;
    this.body?.setVelocity(0, 0);
    if (this.pendingLaunch || (flinch && (dmg > 0 || incoming.trip))) {
      this.chargeStart = null;
      if (this.ledge) this.leaveLedge();
      this.forceHitstunPhysics();
    }
    if (attacker && attacker !== this && !incoming._projectile && !incoming.isCounterAttack && attacker.hitlagFrames != null) {
      attacker.hitlagFrames = Math.max(attacker.hitlagFrames || 0, frames);
      attacker.hitlagTotal = attacker.hitlagFrames;
      attacker._hitlagRole = 'attacker';
      attacker.hitlagDmg = dmg;
      attacker.body?.setVelocity?.(0, 0);
    }
    if (flinch && (dmg > 0 || incoming.trip)) {
      const stepMs = this.scene?.stepMs || FEEL.stepMs;
      const stun = incoming.trip
        ? Math.max(FEEL.hitstunMin, Math.round((incoming.tripMs ?? 780) / stepMs))
        : Math.max(FEEL.hitstunMin, hitstunFrames(units));
      this.state = 'hurt';
      this.stateUntil = time + stun * stepMs;
      this.activeHit = null;
      if (incoming.trip) this.trippedUntil = this.stateUntil;
    }
    if (ko && flinch) this.scene?.beginFinish?.(this, { final: this.stocks <= 1, charged: (incoming._chargeFrac ?? 0) >= 0.95 });
    if (!this.scene?.simFast && dmg > 0) {
      playHit(dmg, incoming.type, ko && flinch);
      const at = hitAnchor(attacker, this, incoming);
      this.scene.juice?.hit?.(at.x, at.y, dmg, incoming.type, angle);
      this.scene.juice?.kick?.(angle, dir, dmg);
    }
    if ((this.hitlagFrames || 0) <= 0 && this.pendingLaunch) this.releaseLaunch(time);
  }

  shiftTimers(ms) {
    const keys = [
      'stateUntil', 'attackCooldownUntil', 'specialCooldownUntil', 'specialMutedUntil', 'vulnerableUntil', 'lockedUntil',
      'dashUntil', 'diveUntil', 'diveArm', 'slowUntil', 'rootedUntil', 'speedBuffUntil', 'attackHasteUntil', 'driftUntil',
      'phasingUntil', 'weightBuffUntil', 'goldUntil', 'poisonUntil', 'stunUntil', 'freezeUntil', 'burnUntil',
      'unquenchableUntil', 'heatOnHitUntil',
      'slipperyUntil', 'kineticResistUntil', 'heatedUntil',
      'mitigateUntil', 'lingerImmuneUntil', 'frozenUntil',
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
    const kick = hitlagShake(this.hitlagDmg || 0, frame);
    this._shakeX = kick.x;
    this._shakeY = kick.y;
  }

  /** Sprites that are actually on screen for this pose, including attack clips. */
  hitFlashTargets() {
    const rig = this.rig;
    if (!rig) return [];
    const out = [];
    if (rig.sprite) out.push(rig.sprite);
    if (rig.clipA && rig.clipA.visible) out.push(rig.clipA);
    return out;
  }

  syncChalkTint() {
    const rig = this.rig;
    if (!rig) return;
    const tint = this.state === 'defending' && this.defenseMove?.chalkTint
      ? this.defenseMove.chalkTint
      : 0;
    if (tint) {
      rig.paletteTint = tint;
      this._chalkOn = true;
      if (this._flashShow > 0) return;
      for (const spr of this.hitFlashTargets()) spr.setTint?.(tint);
      if (!rig.sprite) {
        for (const part of [rig.torso, rig.head, rig.frontArm, rig.backArm, rig.frontLeg, rig.backLeg]) {
          part?.setTint?.(tint);
        }
      }
      return;
    }
    if (!this._chalkOn) return;
    this._chalkOn = false;
    rig.paletteTint = null;
    if (this._flashShow > 0) return;
    for (const spr of this.hitFlashTargets()) spr.clearTint?.();
    if (!rig.sprite) {
      for (const part of [rig.torso, rig.head, rig.frontArm, rig.backArm, rig.frontLeg, rig.backLeg]) {
        part?.clearTint?.();
      }
    }
  }

  applyHitFlash() {
    // ADD with a ~0.6 gray tint: the body brightens and stays the
    // character. setTintFill would replace it with an opaque white shape,
    // and a ghost's alpha would be flattened.
    for (const spr of this.hitFlashTargets()) {
      spr.setBlendMode?.(Phaser.BlendModes.ADD);
      spr.setTint?.(0x999999);
    }
  }

  clearHitFlash() {
    const rig = this.rig;
    if (!rig) return;
    for (const spr of [rig.sprite, rig.clipA]) {
      if (!spr) continue;
      spr.setBlendMode?.(Phaser.BlendModes.NORMAL);
      if (rig.paletteTint) spr.setTint?.(rig.paletteTint);
      else spr.clearTint?.();
    }
  }

  /** Called once per rendered frame, including capture and KO freeze. */
  tickHitFlash() {
    if (this._flashShow == null) return;
    if (this._flashShow > 0) {
      this.applyHitFlash();
      this._flashShow -= 1;
      return;
    }
    this.clearHitFlash();
    this._flashShow = null;
  }

  /**
   * Hitstun always falls and always takes the launch, whatever the fighter
   * was doing. Glide, charge-float, and ledge all clear `allowGravity`;
   * a still idle body used to keep that and hang after the hit.
   */
  forceHitstunPhysics() {
    this._gliding = false;
    this._floatFloor = null;
    if (this.body) this.body.allowGravity = true;
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
    this.forceHitstunPhysics();
    // A body resting on the floor will eat an upward launch if it is still
    // marked blocked. Clear that so a still fighter can leave the ground.
    if (vel.y < 0) {
      this.body.blocked.down = false;
      this.body.touching.down = false;
      this.grounded = false;
    }
    this.applyLaunch();
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

  beginGrab(victim, time) {
    if (!victim?.alive || !victim.body) return;
    this.state = 'grabbing';
    this.grabTarget = victim;
    this.grabStart = time;
    this.stateUntil = time + FEEL.grabMaxMs;
    this.activeHit = null;
    this.launch = null;
    this._appliedLaunch = null;
    this.body.setVelocity(0, 0);
    this.facing = Math.sign(victim.x - this.x) || this.facing || 1;

    victim.state = 'grabbed';
    victim.grabber = this;
    victim.grabEscape = 0;
    victim.stateUntil = this.stateUntil;
    victim.activeHit = null;
    victim.launch = null;
    victim._appliedLaunch = null;
    victim.body.setVelocity(0, 0);
    victim.facing = -this.facing;
    if (!this.scene?.simFast) {
      sfx('land');
      this.scene.juice?.puff?.(this.x + this.facing * 20, this.y - this.bodyH * 0.45, 0xf0c14a, 0.55);
    }
  }

  holdGrab(time, step, dt) {
    const grabber = this.state === 'grabbing' ? this : this.grabber;
    const victim = this.state === 'grabbing' ? this.grabTarget : this;
    if (!grabber?.alive || !victim?.alive || grabber.state !== 'grabbing' || victim.state !== 'grabbed') {
      this.breakGrab(time, false);
      return;
    }

    const holdX = grabber.x + grabber.facing * ((grabber.bodyW ?? 40) * 0.85 + (victim.bodyW ?? 40) * 0.35);
    const holdY = grabber.y;
    grabber.body.setVelocity(0, 0);
    victim.body.setVelocity(0, 0);
    victim.body.reset?.(holdX, holdY);
    victim.x = holdX;
    victim.y = holdY;
    victim.facing = -grabber.facing;

    const gInp = grabber.input || {};
    const vInp = victim.input || {};
    const gAttack = !!gInp.attack && !grabber._prev.attack;
    const gSpecial = !!gInp.special && !grabber._prev.special;
    const gJump = !!gInp.jump && !grabber._prev.jump;
    grabber._prev.attack = !!gInp.attack;
    grabber._prev.special = !!gInp.special;
    grabber._prev.jump = !!gInp.jump;
    grabber._prev.left = !!gInp.left;
    grabber._prev.right = !!gInp.right;

    // Victim mashes directions/buttons to break free.
    const taps = [
      !!vInp.left && !victim._prev.left,
      !!vInp.right && !victim._prev.right,
      !!vInp.jump && !victim._prev.jump,
      !!vInp.attack && !victim._prev.attack,
      !!vInp.special && !victim._prev.special,
    ].filter(Boolean).length;
    victim._prev.left = !!vInp.left;
    victim._prev.right = !!vInp.right;
    victim._prev.jump = !!vInp.jump;
    victim._prev.attack = !!vInp.attack;
    victim._prev.special = !!vInp.special;
    victim.grabEscape = (victim.grabEscape || 0) + taps;
    if (victim.grabEscape >= FEEL.grabEscapeMash) {
      grabber.breakGrab(time, true);
      return;
    }

    if (gJump) {
      grabber.breakGrab(time, true);
      return;
    }
    if (gAttack || gSpecial || time >= grabber.stateUntil) {
      const back = gSpecial || (gInp.left && grabber.facing === 1) || (gInp.right && grabber.facing === -1);
      grabber.throwGrabbed(time, back ? -1 : 1);
      return;
    }

    grabber.rig.facing = grabber.facing;
    victim.rig.facing = victim.facing;
    grabber.rig.animate?.(dt / 1000, 'idle', 0);
    victim.rig.animate?.(dt / 1000, 'hurt', 0);
  }

  throwGrabbed(time, dirMul = 1) {
    const victim = this.grabTarget;
    if (!victim) { this.breakGrab(time, false); return; }
    const dir = (this.facing || 1) * (dirMul < 0 ? -1 : 1);
    const kb = FEEL.grabThrowKb * (dirMul < 0 ? FEEL.grabBackMul : 1);
    this.breakGrab(time, false);
    this.facing = dir;
    victim.takeHit(this, {
      name: 'Grab Throw',
      type: 'kinetic',
      damage: FEEL.grabThrowDamage,
      baseKnockback: kb,
      knockbackGrowth: FEEL.grabThrowGrowth,
      angle: dirMul < 0 ? 35 : 42,
      isGrabThrow: true,
    }, time, dir);
    if (!this.scene?.simFast) {
      sfx('hit');
      this.scene.juice?.puff?.(victim.x, victim.y - victim.bodyH * 0.5, 0xffe7b0, 0.7);
    }
  }

  breakGrab(time, escaped) {
    const grabber = this.state === 'grabbing' ? this : this.grabber;
    const victim = this.state === 'grabbing' ? this.grabTarget : this;
    if (grabber) {
      grabber.state = 'idle';
      grabber.grabTarget = null;
      grabber.grabCooldownUntil = time + FEEL.grabCooldownMs;
      grabber.body?.setVelocity?.(0, 0);
    }
    if (victim && victim !== grabber) {
      victim.state = 'idle';
      victim.grabber = null;
      victim.grabEscape = 0;
      victim.grabCooldownUntil = time + FEEL.grabCooldownMs * 0.5;
      if (escaped) {
        victim.body?.setVelocity?.((victim.facing || 1) * -120, -180);
        victim.state = 'jump';
        if (!victim.scene?.simFast) victim.scene.juice?.puff?.(victim.x, victim.y - 20, 0xd0e4ff, 0.4);
      }
    }
  }

  pullNearby(pull) {
    const radius = pull.radius ?? 170;
    const speed = pull.speed ?? 90;
    for (const f of this.scene?.fighters ?? []) {
      if (f === this || !f.alive || f.state === 'ko' || f.state === 'dead' || !f.body) continue;
      if (pull.metals && !f.charDef?.combat?.metal) continue;
      if (f.state === 'defending' && f.defenseMove?.grabImmune) continue;
      const dx = this.x - f.x;
      const dy = (this.y - this.bodyH * 0.45) - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 12 || d > radius) continue;
      f.body.setVelocityX(f.body.velocity.x + (dx / d) * speed);
      f.body.setVelocityY(f.body.velocity.y + (dy / d) * speed * 0.35);
    }
  }

  restoreShrink() {
    if (this._shrinkFrom == null || !this.rig) return;
    this.rig.baseScale = this._shrinkFrom;
    this._shrinkFrom = null;
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

  /** Heat on the ribbon lights Unquenchable. The flame is not a hit of its own. */
  igniteFromGuard(incoming, time, dmg) {
    if (!(dmg > 0) || this.state !== 'defending' || incoming?.isSelf || incoming?.dot) return;
    const on = this.defenseMove?.igniteOn;
    if (!on) return;
    if (incoming.type !== on && incoming.type2 !== on) return;
    playVfx(this.scene, this, this.defenseMove, 'ignite');
    lightUnquenchable(this, time);
  }

  /** Gas, smoke, or vapour that her chamber just swallowed. Sound arcs knock the attacker back. */
  playVaporAlarm(attacker) {
    const y = this.y - (this.bodyH ?? 80) * 0.5;
    playVfx(this.scene, this, this.defenseMove, 'cleanse', { x: this.x, y });
    const arcs = artFor(this.charDef?.id, this.charDef?.moves?.basicCharge?.name)?.wave;
    const face = Math.sign((attacker?.x ?? this.x) - this.x) || this.facing || 1;
    if (arcs?.frames?.length) spawnFxSprite(this.scene, arcs, this.x, y, 0.6, face);
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
      this.heatTaken = true;
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
    if (cdmg > 0) {
      this.scene.noteHit?.(this, attacker, echo);
      const aim = Math.atan2(attacker.y - this.y, attacker.x - this.x);
      playVfx(this.scene, this, defense, 'recoil', {
        x: attacker.x,
        y: attacker.y - (attacker.bodyH ?? 80) * 0.45,
        aim,
      });
    }
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
    // White phosphorus goes out when that fighter is KO'd, not before.
    this.burnUntil = 0;
    this.burnSticky = false;
    this.heatTaken = false;
    this.goldUntil = 0;
    if (this.rig) this.rig.holdFrame = false;
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
