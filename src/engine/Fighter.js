import * as Phaser from 'phaser';
import { Rig } from './Rig.js';
import { applyDefense } from '../data/characters.js';
import { resolveMoveDamage, resolvePacket, TUNING } from '../data/balance.js';
import { interceptHit } from './defense.js';
import { applyOnCast, applyOnHit, bonusPackets, combatOpts, tickKit } from './kit.js';
import { playVfx } from './MoveVfx.js';
import { play as sfx } from './sfx.js';

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
  const opts = combatOpts(defender);
  if (move?.chemDealtMult) opts.chemDealtMult = move.chemDealtMult;
  if (defender.charDef?.combat) {
    const resolved = resolveMoveDamage(move, attacker?.charDef, defender.charDef, opts);
    const now = defender.scene?.time?.now ?? 0;
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
  }

  get isBusy() {
    return this.state === 'attack' || this.state === 'hurt' || this.state === 'ko' || this.state === 'dead' ||
      this.state === 'charging' || this.state === 'defending';
  }

  update(time, dt) {
    if (this.state === 'dead') return;
    const stats = this.charDef.stats;
    const onGround = this.body.blocked.down || this.body.touching.down;

    if (onGround) this.airJumpsLeft = stats.airJumps;

    // timed states expire
    if ((this.state === 'attack' || this.state === 'hurt' || this.state === 'defending') && time >= this.stateUntil) {
      if (this.state === 'defending' && this.defenseMove?.openAfter) {
        this.vulnerableUntil = time + (this.defenseMove.vulnerableMs ?? 650);
      }
      this.state = 'idle';
      this.rig.setFlash(null);
      this.rig.attackSwing = 0;
      this.activeHit = null;
      this.defenseMove = null;
    }
    tickKit(this, time);

    const inp = this.input;
    const pressedJump = inp.jump && !this._prev.jump;
    const pressedAttack = inp.attack && !this._prev.attack;
    const pressedSpecial = inp.special && !this._prev.special;
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

      if (pressedJump) {
        if (onGround) {
          this.body.setVelocityY(-stats.jumpVelocity);
          sfx('jump');
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft -= 1;
          this.body.setVelocityY(-stats.jumpVelocity * 0.92);
          sfx('jump');
        }
      }
    }

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
      this.state = 'idle';
      this.defenseMove = null;
      this.rig.setFlash(null);
    } else if (!locked && !this.isBusy) {
      if (pressedAttack && time >= this.attackCooldownUntil) {
        if (dirHeld || !this.charDef.moves.basicCharge) {
          this.startMove(time, this.charDef.moves.basicDirectional, 'basic');
        } else {
          this.state = 'charging';
          this.chargeStart = time;
        }
      } else if (pressedSpecial && time >= this.specialCooldownUntil && time >= (this.vulnerableUntil ?? 0)) {
        if (dirHeld || !this.charDef.moves.specialDefense) {
          this.startMove(time, this.charDef.moves.specialDirectional, 'special');
        } else {
          this.startDefense(time);
        }
      }
    }

    if (this.diveUntil && time >= (this.diveArm ?? 0) && (onGround || time >= this.diveUntil)) {
      this.scene.resolveBurst?.(this, this.diveMove);
      this.diveUntil = 0;
    }

    // drive attack swing progress for the rig
    if (this.state === 'attack' && this.currentMove) {
      const total = this.currentMove.duration;
      this.rig.attackSwing = Phaser.Math.Clamp(1 - (this.stateUntil - time) / total, 0, 1);
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
    const speedFactor = Math.abs(this.body.velocity.x) / stats.speed;
    this.rig.facing = this.facing;
    this.rig.animate(dt / 1000, animState, speedFactor);
  }

  startMove(time, move, slot) {
    this.state = 'attack';
    this.currentMove = move;
    this.rig.moveSlot = slot; // sheet-mode rigs have separate basic/special clips
    this.stateUntil = time + move.duration;
    this.scene.noteMove?.(this, move);
    if (slot === 'basic') this.attackCooldownUntil = time + move.duration + move.cooldown;
    else {
      this.specialCooldownUntil = time + move.duration + move.cooldown;
      sfx('special');
    }

    playVfx(this.scene, this, move, 'release');
    applyOnCast(this, move, time, move._chargeFrac ?? 1);
    const commitBurst = !!(move.releaseOnHit || move.detonateAtFull || move.includeSelf);

    if (move.kind === 'buff' || move.kind === 'zone') {
      if (move.zone) this.scene.spawnZone?.(this, move.zone, this.x, this.y - this.bodyH * (move.zone.low ? 0.15 : 0.5));
    } else if (move.kind === 'projectile') {
      this.scene.spawnProjectile(this, move);
    } else if (move.kind === 'beam') {
      this.scene.resolveBeam?.(this, move);
    } else if (move.kind === 'dive') {
      this.body.setVelocity(this.facing * (move.dashSpeed ?? 220), -(move.diveVY ?? 420));
      this.diveUntil = time + move.duration;
      this.diveArm = time + 160;
      this.diveMove = move;
    } else if (move.kind === 'burst') {
      // burst hits everything in a radius partway through the animation.
      // Moves that can be interrupted on purpose (Supernova popping early)
      // still go off.
      this.scene.time.delayedCall(move.duration * (commitBurst ? 0.05 : 0.4), () => {
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
      const isDash = move.kind === 'dash';
      this.activeHit = {
        move, dir: this.facing, landed: new Set(),
        from: time + move.duration * (isDash ? 0.05 : 0.25),
        until: time + move.duration * (isDash ? 0.95 : 0.8),
      };
      if (isDash) {
        this.dashUntil = time + move.duration;
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
    if (move.fizzleBelow != null && frac < move.fizzleBelow) {
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
      dashSpeed: move.dashSpeed != null ? scale(move.dashSpeed, move.chargeDashMult) : move.dashSpeed,
      _beamScale: 1 + ((move.chargeLengthMult ?? 1) - 1) * frac,
    };
    this.startMove(time, scaled, 'basic');
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
    this.defenseStart = time;
    this.scene.noteMove?.(this, move);
    this.rig.moveSlot = 'special';
    this.stateUntil = time + move.duration;
    this.specialCooldownUntil = time + move.duration + move.cooldown;
    playVfx(this.scene, this, move, 'defense');
    applyOnCast(this, move, time, 1);
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
    return new Phaser.Geom.Rectangle(this.x - this.bodyW / 2, this.y - this.bodyH, this.bodyW, this.bodyH);
  }

  /**
   * Apply a hit to this fighter. Returns actual damage dealt.
   * launchDir: -1 or 1, the direction the attack itself points. Omit it for
   * radial moves, which launch away from the attacker instead.
   */
  takeHit(attacker, move, time, launchDir) {
    if (this.state === 'ko' || this.state === 'dead') return 0;

    if (this.state === 'charging' && this.charDef.moves.basicCharge?.releaseOnHit && !move.isSelf && !move.isCounterAttack) {
      this.fireCharge(time);
    }

    let incoming = move;
    if (move.bonusVsBlock && this.state === 'defending') {
      const bump = 1 + move.bonusVsBlock;
      incoming = {
        ...move,
        damage: (move.damage ?? 0) * bump,
        damage2: move.damage2 != null ? move.damage2 * bump : move.damage2,
      };
    }

    const gate = interceptHit(this, attacker, incoming, time);
    if (gate.result === 'pop' || gate.result === 'negate') {
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
      this.lastPackets = dealt.packets.map((p) => ({ ...p, dealt: p.dealt * (1 - gate.reduction) }));
      if (attacker === this || move.isSelf) dmg *= TUNING.selfDamageMult;
      this.percent = Math.min(999, this.percent + dmg);
      this.creditDamage(attacker, dmg, incoming.type);
      if (!gate.noKnockback && !move.isSelf && attacker !== this) {
        const kb = ((incoming.baseKnockback + this.percent * (incoming.knockbackGrowth ?? 0)) / this.charDef.stats.weight) * (1 - gate.reduction);
        const slip = this.slipperyUntil > time ? (this.slipperyMult ?? 1.3) : 1;
        const away = Math.sign(this.x - (attacker?.x ?? this.x)) || attacker?.facing || 1;
        const dir = launchDir || away;
        this.body.setVelocity(kb * dir * Math.cos(0.45) * slip, kb * -0.9);
      }
      return dmg;
    }

    // Cancel whatever attack this fighter was mid-swing on. Without this, an
    // attack's hitbox stayed live (getHitboxRect() only checks activeHit,
    // not state) even after its owner got hit and entered hurt state, so
    // "both fighters hit each other at once" wasn't just simultaneous
    // swings landing together -- it was ALSO an already-losing attacker
    // still landing their hit for the rest of its active window after being
    // interrupted. Getting hit first now reliably beats swinging first.
    this.activeHit = null;
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
    if (attacker === this || move.isSelf) dmg *= TUNING.selfDamageMult;
    this.percent = Math.min(999, this.percent + dmg);
    this.lastPackets = dealt.packets;
    this.creditDamage(attacker, dmg, incoming.type);

    if (move.isSelf || attacker === this) {
      this.state = 'hurt';
      this.stateUntil = time + 160;
      return dmg;
    }

    const kb = ((incoming.baseKnockback ?? 0) + this.percent * (incoming.knockbackGrowth ?? 0)) / this.charDef.stats.weight;
    const slip = this.slipperyUntil > time ? (this.slipperyMult ?? 1.3) : 1;

    // Launch direction.
    //
    // Directional moves (punches, projectiles) launch the way the ATTACK
    // points, passed in as launchDir. Deriving it from relative position
    // instead — which is what this used to do — breaks when the two bodies
    // overlap: standing on top of someone put their centre behind the
    // attacker's, so a punch aimed right launched them left, back through
    // the puncher.
    //
    // Radial moves (H-Burst and anything else centred on the attacker) still
    // launch away from the blast, which is the whole point of them. A move
    // can force either rule with `launch: 'radial' | 'directional'`.
    const radial = incoming.launch ? incoming.launch === 'radial' : incoming.kind === 'burst';
    const away = Math.sign(this.x - (attacker?.x ?? this.x)) || attacker?.facing || 1;
    const dir = (!radial && launchDir) ? launchDir : away;

    const angle = incoming.lift ? -1.25 : -0.9; // lift sends them up (Balloon Bop)
    let vx = kb * dir * Math.cos(0.45) * slip;
    if (incoming.pull && attacker) vx = Math.sign((attacker.x ?? this.x) - this.x || dir) * incoming.pull;
    this.body.setVelocity(vx, kb * angle);

    applyOnHit(attacker, this, incoming, time);

    this.state = 'hurt';
    this.stateUntil = time + 320 + Math.min(this.percent * 2, 300); // more hitstun at high %
    this.rig.setFlash(0xff5544);
    this.scene.time.delayedCall(120, () => {
      if (this.state !== 'ko' && this.state !== 'dead') this.rig.setFlash(null);
    });
    return dmg;
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
    this.setVisible(false);

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
      this.scene.tweens.add({ targets: this, alpha: 0.35, yoyo: true, repeat: 5, duration: 120, onComplete: () => (this.alpha = 1) });
    });
  }
}
