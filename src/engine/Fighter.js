import * as Phaser from 'phaser';
import { Rig } from './Rig.js';
import { applyDefense } from '../data/characters.js';
import { play as sfx } from './sfx.js';

// ---------------------------------------------------------------------------
// Fighter — one combatant. Reads everything character-specific from its
// charDef (see src/data/characters.js); contains zero per-character logic.
//
// Input is abstracted: each frame the owner (keyboard mapper now, phone
// controller later) writes into fighter.input = { left, right, jump, attack,
// special } booleans. `jump/attack/special` are edge-triggered by this class.
// ---------------------------------------------------------------------------

const GRAVITY = 1500;

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
    this.kos = 0;
    this.alive = true;

    this.input = { left: false, right: false, jump: false, attack: false, special: false };
    this._prev = { jump: false, attack: false, special: false };
  }

  get isBusy() {
    return this.state === 'attack' || this.state === 'hurt' || this.state === 'ko' || this.state === 'dead';
  }

  update(time, dt) {
    if (this.state === 'dead') return;
    const stats = this.charDef.stats;
    const onGround = this.body.blocked.down || this.body.touching.down;

    if (onGround) this.airJumpsLeft = stats.airJumps;

    // timed states expire
    if ((this.state === 'attack' || this.state === 'hurt') && time >= this.stateUntil) {
      this.state = 'idle';
      this.rig.setFlash(null);
      this.rig.attackSwing = 0;
      this.activeHit = null;
    }

    const inp = this.input;
    const pressedJump = inp.jump && !this._prev.jump;
    const pressedAttack = inp.attack && !this._prev.attack;
    const pressedSpecial = inp.special && !this._prev.special;
    this._prev.jump = inp.jump;
    this._prev.attack = inp.attack;
    this._prev.special = inp.special;

    // --- movement (locked out while hurt/KO'd; allowed while attacking in air)
    if (this.state !== 'hurt' && this.state !== 'ko') {
      let vx = 0;
      if (inp.left) vx -= stats.speed;
      if (inp.right) vx += stats.speed;
      if (this.state === 'attack' && onGround) vx *= 0.25; // plant feet on ground attacks
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
    if (!this.isBusy) {
      if (pressedAttack && time >= this.attackCooldownUntil) {
        this.startMove(time, this.charDef.moves.basic, 'basic');
      } else if (pressedSpecial && time >= this.specialCooldownUntil) {
        this.startMove(time, this.charDef.moves.special, 'special');
      }
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
    if (slot === 'basic') this.attackCooldownUntil = time + move.duration + move.cooldown;
    else {
      this.specialCooldownUntil = time + move.duration + move.cooldown;
      sfx('special');
    }

    if (move.kind === 'projectile') {
      this.scene.spawnProjectile(this, move);
    } else if (move.kind === 'burst') {
      // burst hits everything in a radius partway through the animation
      this.scene.time.delayedCall(move.duration * 0.4, () => {
        if (this.state === 'attack') this.scene.resolveBurst(this, move);
      });
    } else {
      // melee: hitbox becomes active partway through the swing. `dir` is
      // captured now and drives both the hitbox side and the launch, so the
      // two can never disagree.
      this.activeHit = {
        move, dir: this.facing, landed: new Set(),
        from: time + move.duration * 0.25,
        until: time + move.duration * 0.8,
      };
    }
  }

  // Axis-aligned hitbox in world space for the current melee attack.
  getHitboxRect() {
    if (!this.activeHit) return null;
    const t = this.scene.time.now;
    if (t < this.activeHit.from || t > this.activeHit.until) return null;
    const m = this.activeHit.move;
    const dir = this.activeHit.dir;
    const x = dir === 1 ? this.x + this.bodyW * 0.2 : this.x - this.bodyW * 0.2 - m.rangeW;
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
    // Cancel whatever attack this fighter was mid-swing on. Without this, an
    // attack's hitbox stayed live (getHitboxRect() only checks activeHit,
    // not state) even after its owner got hit and entered hurt state, so
    // "both fighters hit each other at once" wasn't just simultaneous
    // swings landing together -- it was ALSO an already-losing attacker
    // still landing their hit for the rest of its active window after being
    // interrupted. Getting hit first now reliably beats swinging first.
    this.activeHit = null;
    const dmg = applyDefense(move.damage, move.type, this.charDef.defense);
    this.percent = Math.min(999, this.percent + dmg);

    const kb = (move.baseKnockback + this.percent * move.knockbackGrowth) / this.charDef.stats.weight;

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
    const radial = move.launch ? move.launch === 'radial' : move.kind === 'burst';
    const away = Math.sign(this.x - attacker.x) || attacker.facing || 1;
    const dir = (!radial && launchDir) ? launchDir : away;

    const angle = -0.9; // launch angle: up and away
    this.body.setVelocity(kb * dir * Math.cos(0.45), kb * angle);

    this.state = 'hurt';
    this.stateUntil = time + 320 + Math.min(this.percent * 2, 300); // more hitstun at high %
    this.rig.setFlash(0xff5544);
    this.scene.time.delayedCall(120, () => {
      if (this.state !== 'ko' && this.state !== 'dead') this.rig.setFlash(null);
    });
    return dmg;
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
