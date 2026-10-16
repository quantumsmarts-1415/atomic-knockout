// ---------------------------------------------------------------------------
// Juice — pooled hit sparks, trails, dust, afterimages and trauma shake.
// Visual only. Every entry point returns immediately when scene.simFast.
//
// Lifetimes are stepped in update(), which present() calls even while the
// capture loop has the Phaser game loop asleep. Tweens do not run then, and
// that is what left solid silhouettes on the stage.
// ---------------------------------------------------------------------------
import * as Phaser from 'phaser';
import { FEEL, traumaForHit, traumaOffset } from './feel.js';
import { slashPolyline } from './boxes.js';
import { fxReplacesSlash } from './fxArt.js';

const TEX = {
  dot: 'juice-dot',
  streak: 'juice-streak',
  star: 'juice-star',
  slash: 'juice-slash',
  jag: 'juice-jag',
  puff: 'juice-puff',
  puffB: 'juice-puff-b',
  puffC: 'juice-puff-c',
  ring: 'juice-ring',
};

// Spark tints. TYPE_COLOR stays as-is for shields and other VFX; sparks
// follow the element read the review asked for.
const SPARK = {
  kinetic: 0xfff2a8,
  physical: 0xfff2a8,
  heat: 0xff7a22,
  electrical: 0x5ce1ff,
  chemical: 0xc57bff,
  radiation: 0x3dff62,
};

const GHOST = {
  kinetic: 0xfff1c4,
  physical: 0xfff1c4,
  heat: 0xff6a1a,
  electrical: 0x6ec6ff,
  chemical: 0xc57bff,
  radiation: 0x3dff62,
};

function sparkColor(type) {
  return SPARK[type] ?? 0xfff2a8;
}

function makeTextures(scene) {
  if (scene.textures.exists(TEX.dot)) return;
  const paint = (key, w, h, draw) => {
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  paint(TEX.dot, 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 3);
  });
  paint(TEX.streak, 48, 10, (g) => {
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(0, 5, 48, 1, 48, 9);
  });
  paint(TEX.slash, 72, 28, (g) => {
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(2, 14, 70, 2, 70, 26);
    g.fillStyle(0xffffff, 0.55);
    g.fillTriangle(10, 14, 58, 7, 58, 21);
  });
  paint(TEX.star, 64, 64, (g) => {
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const len = i % 2 === 0 ? 30 : 14;
      g.fillTriangle(
        32 + Math.cos(a) * len, 32 + Math.sin(a) * len,
        32 + Math.cos(a + 0.35) * 4, 32 + Math.sin(a + 0.35) * 4,
        32 + Math.cos(a - 0.35) * 4, 32 + Math.sin(a - 0.35) * 4,
      );
    }
    g.fillCircle(32, 32, 5);
  });
  paint(TEX.jag, 64, 64, (g) => {
    g.lineStyle(3, 0xffffff, 1);
    const bolt = (ox, oy, turns) => {
      let x = ox;
      let y = oy;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < turns; i++) {
        x += 6 + (i % 2) * 4;
        y += (i % 2 === 0 ? -10 : 8);
        g.lineTo(x, y);
      }
      g.strokePath();
    };
    bolt(8, 34, 6);
    bolt(14, 40, 5);
    bolt(20, 28, 5);
  });
  const puff = (key, seeds) => {
    paint(key, 64, 64, (g) => {
      for (const s of seeds) {
        g.fillStyle(0xffffff, s.a);
        g.fillCircle(s.x, s.y, s.r);
      }
    });
  };
  puff(TEX.puff, [
    { x: 32, y: 36, r: 22, a: 0.12 },
    { x: 32, y: 34, r: 16, a: 0.22 },
    { x: 30, y: 32, r: 10, a: 0.4 },
    { x: 34, y: 30, r: 6, a: 0.55 },
  ]);
  puff(TEX.puffB, [
    { x: 28, y: 34, r: 18, a: 0.14 },
    { x: 38, y: 30, r: 14, a: 0.2 },
    { x: 32, y: 36, r: 9, a: 0.38 },
  ]);
  puff(TEX.puffC, [
    { x: 34, y: 30, r: 20, a: 0.1 },
    { x: 26, y: 38, r: 12, a: 0.24 },
    { x: 36, y: 34, r: 7, a: 0.45 },
  ]);
  paint(TEX.ring, 64, 64, (g) => {
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(32, 32, 26);
  });
}

export class Juice {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.fx = [];
    this.live = 0;
    this.trauma = 0;
    this.flash = null;
    this.arcs = [];
    makeTextures(scene);
  }

  get fast() {
    return !!this.scene.simFast;
  }

  borrow(key) {
    if (this.fast) return null;
    if (this.live >= FEEL.particleCap) return null;
    let img = this.pool.find((p) => !p.active);
    if (!img) {
      img = this.scene.add.image(0, 0, key).setActive(false).setVisible(false);
      img.juice = true;
      this.pool.push(img);
    }
    img.setTexture(key);
    img.setActive(true).setVisible(true);
    img.setAlpha(1).setScale(1).setRotation(0).clearTint();
    img.setBlendMode(Phaser.BlendModes.NORMAL);
    if (img.setTintFill) img.tintFill = null;
    this.live++;
    return img;
  }

  release(img) {
    if (!img?.active) return;
    img.setActive(false).setVisible(false);
    img.setAlpha(0);
    this.live = Math.max(0, this.live - 1);
  }

  track(img, spec) {
    if (!img) return null;
    const row = { img, life: spec.life, max: spec.life, ...spec };
    this.fx.push(row);
    return row;
  }

  expire(row) {
    if (!row || row.dead) return;
    row.dead = true;
    if (row.img) this.release(row.img);
    if (row.g && !row.g.dead) row.g.destroy();
    const i = this.fx.indexOf(row);
    if (i >= 0) this.fx.splice(i, 1);
  }

  ghostsOf(owner) {
    return this.fx.filter((f) => f.kind === 'ghost' && f.owner === owner && !f.dead);
  }

  /** Active afterimages, sparks, puffs, arcs and one-shot graphics. */
  effectCount() {
    const fx = this.fx.filter((f) => !f.dead).length;
    return fx + this.arcs.length + (this.flash && !this.flash.dead ? 1 : 0);
  }

  addTrauma(amount) {
    if (this.fast || !(amount > 0)) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /**
   * Screen kick along the launch. `angle` is screen space (negative is up)
   * and `dir` is the horizontal facing of the hit. This offsets the camera.
   * It does not change zoom.
   */
  kick(angle, dir = 1, dmg = 8) {
    if (this.fast) return;
    const mag = Math.min(1, 0.28 + Math.max(0, dmg) / 22);
    this.kickState = { angle: angle || 0, dir: dir || 1, mag, life: 0.14 + 0.1 * mag, max: 0.14 + 0.1 * mag };
  }

  shakeOffset(timeSec, zoom) {
    let mode = 'full';
    try { mode = localStorage.getItem('ak-shake') || 'full'; } catch { /* node tests */ }
    const kick = this.kickState && this.kickState.life > 0 ? this.kickState : null;
    return traumaOffset(this.trauma, timeSec, zoom, mode, kick);
  }

  update(dt) {
    if (this.fast) return;
    const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.trauma = Math.max(0, this.trauma - FEEL.traumaDecay * step);
    if (this.kickState) {
      this.kickState.life -= step;
      const u = this.kickState.max > 0 ? Math.max(0, this.kickState.life / this.kickState.max) : 0;
      this.kickState.mag *= u;
      if (this.kickState.life <= 0) this.kickState = null;
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= step;
      const u = f.max > 0 ? Math.max(0, f.life / f.max) : 0;
      if (f.life <= 0) {
        this.expire(f);
        continue;
      }
      if (f.img) {
        if (f.vx || f.vy) {
          f.img.x += (f.vx || 0) * step;
          f.img.y += (f.vy || 0) * step;
        }
        if (!f.holdScale) {
          const grow = f.scale0 + ((f.scale1 ?? f.scale0) - f.scale0) * (1 - u);
          f.img.setScale(grow);
        }
        f.img.setAlpha((f.alpha0 ?? 1) * u);
        if (f.spin) f.img.rotation += f.spin * step;
      }
      if (f.g) {
        f.g.setAlpha((f.alpha0 ?? 1) * u);
      }
    }
    if (this.flash && !this.flash.dead) {
      this.flash.life -= step;
      const u = Math.max(0, this.flash.life / this.flash.max);
      this.flash.setAlpha(0.28 * u);
      if (this.flash.life <= 0) {
        this.flash.destroy();
        this.flash.dead = true;
        this.flash = null;
      }
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.life -= step;
      if (a.life <= 0) {
        a.g.destroy();
        this.arcs.splice(i, 1);
        continue;
      }
      const t = a.life / a.max;
      a.g.clear();
      a.g.lineStyle(18 * t, a.color, 0.85 * t);
      a.g.beginPath();
      a.g.arc(a.x, a.y, a.r, a.a0, a.a1, false);
      a.g.strokePath();
      a.g.lineStyle(6 * t, 0xffffff, 0.9 * t);
      a.g.beginPath();
      a.g.arc(a.x, a.y, a.r * 0.92, a.a0, a.a1, false);
      a.g.strokePath();
    }
  }

  hit(x, y, dmg, type, angle = 0) {
    if (this.fast) return;
    const kind = type === 'physical' ? 'kinetic' : (type || 'kinetic');
    const s = 0.9 + 1.15 * Math.min(1, Math.max(0, dmg / 18));
    const color = sparkColor(kind);
    const life = (10 + Math.min(4, dmg * 0.2)) * FEEL.stepMs / 1000;
    if (kind === 'heat') this.heatHit(x, y, dmg, s, color, life);
    else if (kind === 'chemical') this.chemHit(x, y, dmg, s, color, life);
    else if (kind === 'radiation') this.radHit(x, y, dmg, s, color, life);
    else this.impactHit(x, y, dmg, s, color, life, angle, kind === 'electrical' ? TEX.jag : TEX.star);
    if (kind === 'electrical') this.bolt(x, y, color, angle);
    if (dmg >= 15) this.impactFlash();
    this.addTrauma(traumaForHit(dmg, false));
  }

  impactHit(x, y, dmg, s, color, life, angle, starKey) {
    const star = this.borrow(starKey);
    if (star) {
      star.setPosition(x, y).setTint(color).setRotation(angle).setDepth(40);
      this.track(star, { kind: 'spark', element: 'impact', life, scale0: 0.7 * s, scale1: 1.45 * s, alpha0: 0.95 });
    }
    const slash = this.borrow(TEX.slash);
    if (slash) {
      slash.setPosition(x, y).setTint(color).setRotation(angle).setDepth(41);
      this.track(slash, {
        kind: 'spark', element: 'impact', life: life * 0.85, scale0: 0.85 * s, scale1: 1.55 * s, alpha0: 0.92,
      });
    }
    const n = 5 + Math.round(Math.min(2, dmg / 10));
    for (let i = 0; i < n; i++) {
      const bit = this.borrow(TEX.streak);
      if (!bit) break;
      const spread = (i - (n - 1) / 2) * 0.32;
      const a = angle + spread;
      bit.setPosition(x, y).setTint(color).setRotation(a).setDepth(39);
      const speed = 260 + dmg * 10 + i * 36;
      this.track(bit, {
        kind: 'line',
        element: 'impact',
        life: (8 + i) * FEEL.stepMs / 1000,
        scale0: 0.7 + 0.2 * s,
        scale1: 1.15 + 0.25 * s,
        alpha0: 0.9,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
      });
    }
  }

  /** Embers that lift off the contact. No slash. */
  heatHit(x, y, dmg, s, color, life) {
    const core = this.borrow(TEX.star);
    if (core) {
      core.setPosition(x, y).setTint(color).setDepth(40);
      this.track(core, { kind: 'spark', element: 'heat', life, scale0: 0.45 * s, scale1: 1.1 * s, alpha0: 0.95 });
    }
    const n = 6 + Math.round(Math.min(3, dmg / 8));
    for (let i = 0; i < n; i++) {
      const bit = this.borrow(i % 2 ? TEX.puff : TEX.streak);
      if (!bit) break;
      const spread = (i - (n - 1) / 2) * 0.35;
      bit.setPosition(x, y).setTint(i % 2 ? 0xffc14a : color).setRotation(-Math.PI / 2 + spread).setDepth(39);
      this.track(bit, {
        kind: i % 2 ? 'puff' : 'line',
        element: 'heat',
        life: (9 + i) * FEEL.stepMs / 1000,
        scale0: 0.35 + 0.08 * s,
        scale1: 0.7 + 0.1 * s,
        alpha0: 0.85,
        vx: Math.sin(spread) * (40 + i * 12),
        vy: -(90 + dmg * 6 + i * 28),
      });
    }
  }

  /** Slow bubbles instead of a cut. */
  chemHit(x, y, dmg, s, color, life) {
    const core = this.borrow(TEX.ring);
    if (core) {
      core.setPosition(x, y).setTint(color).setDepth(40);
      this.track(core, { kind: 'spark', element: 'chemical', life, scale0: 0.2 * s, scale1: 0.85 * s, alpha0: 0.8 });
    }
    const n = 5 + Math.round(Math.min(2, dmg / 10));
    for (let i = 0; i < n; i++) {
      const bit = this.borrow(i % 2 ? TEX.puffB : TEX.dot);
      if (!bit) break;
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.4;
      bit.setPosition(x, y).setTint(color).setDepth(38);
      this.track(bit, {
        kind: 'puff',
        element: 'chemical',
        life: (12 + i) * FEEL.stepMs / 1000,
        scale0: 0.22 * s,
        scale1: 0.55 * s,
        alpha0: 0.7,
        vx: Math.cos(a) * (30 + i * 8),
        vy: Math.sin(a) * (50 + i * 10),
      });
    }
  }

  /** A ring that opens, plus short rays. */
  radHit(x, y, dmg, s, color, life) {
    const ring = this.borrow(TEX.ring);
    if (ring) {
      ring.setPosition(x, y).setTint(color).setDepth(38);
      this.track(ring, { kind: 'spark', element: 'radiation', life: life * 1.2, scale0: 0.2, scale1: 1.45 * s, alpha0: 0.75 });
    }
    const n = 6;
    for (let i = 0; i < n; i++) {
      const bit = this.borrow(TEX.dot);
      if (!bit) break;
      const a = (Math.PI * 2 * i) / n;
      bit.setPosition(x, y).setTint(color).setDepth(39);
      this.track(bit, {
        kind: 'line',
        element: 'radiation',
        life: (8 + (i % 3)) * FEEL.stepMs / 1000,
        scale0: 0.8,
        scale1: 0.3,
        alpha0: 0.9,
        vx: Math.cos(a) * (80 + dmg * 4),
        vy: Math.sin(a) * (80 + dmg * 4),
      });
    }
  }

  bolt(x, y, color, angle) {
    const g = this.scene.add.graphics().setDepth(42);
    g.lineStyle(2, color, 0.95);
    for (let b = 0; b < 3; b++) {
      let px = x;
      let py = y;
      g.beginPath();
      g.moveTo(px, py);
      const ang = angle + (b - 1) * 0.55;
      for (let s = 0; s < 5; s++) {
        px += Math.cos(ang) * 16 + ((s % 2) - 0.5) * 14;
        py += Math.sin(ang) * 16 + ((s % 2 === 0 ? 1 : -1) * 8);
        g.lineTo(px, py);
      }
      g.strokePath();
    }
    this.fx.push({
      kind: 'gfx', g, life: 7 * FEEL.stepMs / 1000, max: 7 * FEEL.stepMs / 1000, alpha0: 1,
    });
  }

  impactFlash() {
    const cam = this.scene.cameras?.main;
    if (!cam || this.flash) return;
    const rect = this.scene.add.rectangle(cam.midPoint.x, cam.midPoint.y, 1400, 800, 0xffffff, 0.28)
      .setScrollFactor(0).setDepth(5000);
    rect.life = 3 * FEEL.stepMs / 1000;
    rect.max = rect.life;
    this.flash = rect;
  }

  bodySprite(fighter) {
    const rig = fighter?.rig;
    if (!rig) return null;
    if (rig.clipA?.visible && rig.sprite && rig.sprite.visible === false) return rig.clipA;
    return rig.sprite || rig.clipA || null;
  }

  afterimage(fighter, alpha = FEEL.afterimageAlpha) {
    if (this.fast || !fighter) return;
    const spr = this.bodySprite(fighter);
    if (!spr?.texture?.key) return;
    const owner = fighter;
    const mine = this.ghostsOf(owner);
    while (mine.length >= FEEL.afterimageCap) this.expire(mine.shift());
    const img = this.borrow(spr.texture.key);
    if (!img) return;
    const frame = spr.frame?.name;
    if (frame != null && img.setFrame) img.setFrame(frame);
    img.setPosition(fighter.x + (fighter.rig?.x || 0), fighter.y + (fighter.rig?.y || 0));
    img.setOrigin?.(spr.originX ?? 0.5, spr.originY ?? 1);
    const face = fighter.facing || 1;
    img.setScale(Math.abs(spr.scaleX || 1) * face, spr.scaleY || 1);
    img.setRotation(spr.rotation || 0);
    const tint = GHOST[fighter.currentMove?.type] ?? 0xfff1c4;
    // A ghost's sheet is already translucent. Multiply by white so the
    // RGBA art stays, and let the fade alpha sit on top of that.
    img.setTint(fighter.charDef?.ghost ? 0xffffff : tint);
    img.setBlendMode(Phaser.BlendModes.NORMAL);
    img.setAlpha(alpha);
    img.setDepth?.(6);
    const life = FEEL.afterimageFrames * FEEL.stepMs / 1000;
    this.track(img, { kind: 'ghost', owner, life, scale0: Math.abs(spr.scaleX || 1), scale1: Math.abs(spr.scaleX || 1), alpha0: alpha, holdScale: true });
  }

  swing(fighter, move) {
    if (this.fast || !fighter) return;
    if (fxReplacesSlash(fighter, move)) return;
    if (move?.kind === 'dash' || move?.kind === 'projectile' || move?.kind === 'burst' || move?.kind === 'beam') return;
    this._swings ??= new Map();
    let g = this._swings.get(fighter);
    if (!g?.scene) {
      g = this.scene.add.graphics();
      g.setDepth(20);
      g.setBlendMode(Phaser.BlendModes.ADD);
      this._swings.set(fighter, g);
    }
    this.paintSlash(g, fighter, move);
  }

  paintSlash(g, fighter, move) {
    const slash = slashPolyline(fighter, 16);
    g.clear();
    if (!slash?.pts?.length) return;
    const color = SPARK[move?.type] ?? 0xfff2a8;
    const thick = Math.max(7, slash.thick * 0.55);
    g.lineStyle(thick, color, 0.9);
    g.beginPath();
    slash.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.strokePath();
    g.lineStyle(Math.max(3, thick * 0.35), 0xffffff, 0.85);
    g.beginPath();
    slash.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.strokePath();
  }

  // The slash is the same swept arc the hit uses, grown with the active frames
  // or fitted through the strike pixels.
  syncStrikes() {
    if (!this._swings) return;
    for (const [fighter, g] of this._swings) {
      const slash = slashPolyline(fighter, 16);
      if (!slash || !g.scene) {
        g.destroy?.();
        this._swings.delete(fighter);
        continue;
      }
      this.paintSlash(g, fighter, fighter.activeHit?.move);
    }
  }

  /**
   * Charge ticks, projectile births and other one-shots. Textured stars
   * and streaks in the element color, stepped here so a capture sees
   * them fade. Not a white ring and not a row of dots.
   */
  sparkle(x, y, color, n = 6) {
    if (this.fast) return;
    const tint = color ?? 0xfff2a8;
    const star = this.borrow(TEX.star);
    if (star) {
      star.setPosition(x, y).setTint(tint).setDepth(36).setBlendMode(Phaser.BlendModes.ADD);
      this.track(star, { kind: 'spark', life: 0.22, scale0: 0.32, scale1: 0.85, alpha0: 0.9 });
    }
    const count = Math.max(3, Math.min(8, n | 0));
    for (let i = 0; i < count; i++) {
      const bit = this.borrow(i % 3 === 0 ? TEX.slash : TEX.streak);
      if (!bit) break;
      const a = (Math.PI * 2 * i) / count + i * 0.2;
      bit.setPosition(x, y).setTint(tint).setRotation(a).setDepth(35).setBlendMode(Phaser.BlendModes.ADD);
      this.track(bit, {
        kind: 'line',
        life: 0.16 + (i % 3) * 0.04,
        scale0: 0.4,
        scale1: 0.8,
        alpha0: 0.85,
        vx: Math.cos(a) * (140 + i * 22),
        vy: Math.sin(a) * (110 + i * 16),
      });
    }
  }

  /**
   * KO hit: a half-second screen flash plus a colored burst on the screen
   * edge the victim is leaving. Lifetimes live on fx, not on a tween, so
   * the capture clock fades them.
   */
  koMoment(color, side = 'right') {
    if (this.fast) return;
    const cam = this.scene.scale;
    const W = cam?.width || 1280;
    const H = cam?.height || 720;
    const life = 0.5;
    const white = this.scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, 0xffffff, 0.82)
      .setScrollFactor(0).setDepth(86);
    this.fx.push({ kind: 'gfx', g: white, life: 0.08, max: 0.08, alpha0: 0.82 });
    const flash = this.scene.add.rectangle(W / 2, H / 2, W + 8, H + 8, color, 0.5)
      .setScrollFactor(0).setDepth(84);
    this.fx.push({ kind: 'gfx', g: flash, life, max: life, alpha0: 0.5 });
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(85);
    g.fillStyle(color, 1);
    const rays = 16;
    const reach = 200;
    if (side === 'left' || side === 'right') {
      const x0 = side === 'right' ? W : 0;
      const dir = side === 'right' ? -1 : 1;
      for (let i = 0; i < rays; i++) {
        const y = ((H + 40) / rays) * i - 10;
        g.fillTriangle(x0, y, x0, y + 28, x0 + dir * reach, y + 14);
      }
    } else {
      const y0 = side === 'bottom' ? H : 0;
      const dir = side === 'bottom' ? -1 : 1;
      for (let i = 0; i < rays; i++) {
        const x = ((W + 40) / rays) * i - 10;
        g.fillTriangle(x, y0, x + 40, y0, x + 20, y0 + dir * reach);
      }
    }
    this.fx.push({ kind: 'gfx', g, life, max: life, alpha0: 0.8 });
  }

  puff(x, y, color, scale = 0.6) {
    if (this.fast) return;
    const keys = [TEX.puff, TEX.puffB, TEX.puffC];
    const key = keys[Math.abs(Math.round(x + y * 3)) % keys.length];
    const img = this.borrow(key);
    if (!img) return;
    const size = scale * (0.65 + ((Math.abs(Math.round(x * 7 + y)) % 5) / 10));
    img.setPosition(x, y).setTint(color).setDepth(12).setAlpha(0.55);
    const life = (10 + (Math.abs(Math.round(x)) % 4)) * FEEL.stepMs / 1000;
    this.track(img, {
      kind: 'puff',
      life,
      scale0: size,
      scale1: size * 0.35,
      alpha0: 0.5,
      vx: ((Math.round(x) % 7) - 3) * 8,
      vy: -28 - (Math.abs(Math.round(y)) % 5) * 6,
    });
  }

  dust(x, y, dir = 1) {
    if (this.fast) return;
    for (let i = 0; i < 5; i++) {
      const bit = this.borrow(i % 2 ? TEX.puffB : TEX.puff);
      if (!bit) return;
      const size = 0.34 + i * 0.07;
      bit.setPosition(x + (i - 2) * 6 * dir, y - 2).setTint(0xcfc6b4).setDepth(8);
      this.track(bit, {
        kind: 'dust',
        life: (10 + i * 2) * FEEL.stepMs / 1000,
        scale0: size,
        scale1: size * 1.35,
        alpha0: 0.62,
        vx: dir * (22 + i * 18),
        vy: -6 - i * 3,
      });
    }
  }

  trail(fighter) {
    if (this.fast || !fighter.launch) return;
    const L = fighter.launch;
    const speed = Math.hypot(L.x, L.y);
    if (speed < (L.speed0 || speed) * 0.4) return;
    if ((fighter._trailTick = (fighter._trailTick || 0) + 1) % 2) return;
    const tint = (fighter._trailTick % 8 === 0)
      ? sparkColor(L.type)
      : 0xb7c0ce;
    this.puff(fighter.x, fighter.y - fighter.bodyH * 0.55, tint, 0.7 + Math.min(0.5, speed / 4000));
  }

  koLine(fighter) {
    if (this.fast) return;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const x = Phaser.Math.Clamp(fighter.x, view.x + 20, view.right - 20);
    const y = Phaser.Math.Clamp(fighter.y, view.y + 20, view.bottom - 20);
    const pal = fighter.charDef.palettes[fighter.paletteIndex]?.body ?? 0xffffff;
    const g = this.scene.add.graphics().setDepth(80);
    const ang = Math.atan2(view.centerY - y, view.centerX - x);
    g.fillStyle(pal, 0.9);
    const tip = (d, a) => [x + Math.cos(ang + a) * d, y + Math.sin(ang + a) * d];
    const [ax, ay] = tip(36, 0.9);
    const [bx, by] = tip(36, -0.9);
    const [cx, cy] = tip(600, 0);
    g.fillTriangle(ax, ay, bx, by, cx, cy);
    const life = 14 * FEEL.stepMs / 1000;
    this.fx.push({ kind: 'gfx', g, life, max: life, alpha0: 0.9 });
    for (let i = 0; i < 8; i++) {
      const bit = this.borrow(TEX.streak);
      if (!bit) break;
      const a = ang + (i - 4) * 0.12;
      bit.setPosition(x, y).setTint(pal).setRotation(a).setDepth(81);
      this.track(bit, {
        kind: 'line',
        life: 10 * FEEL.stepMs / 1000,
        scale0: 0.5,
        scale1: 0.8,
        alpha0: 0.85,
        vx: Math.cos(a) * 280,
        vy: Math.sin(a) * 280,
      });
    }
    this.impactFlash();
    this.addTrauma(0.5);
  }
}
