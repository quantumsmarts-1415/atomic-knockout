// ---------------------------------------------------------------------------
// Juice — pooled hit sparks, trails, dust, afterimages and trauma shake.
// Visual only. Every entry point returns immediately when scene.simFast.
// ---------------------------------------------------------------------------
import * as Phaser from 'phaser';
import { FEEL, TYPE_COLOR, traumaForHit, traumaOffset } from './feel.js';

const TEX = {
  dot: 'juice-dot',
  streak: 'juice-streak',
  star: 'juice-star',
  puff: 'juice-puff',
  ring: 'juice-ring',
};

function makeTextures(scene) {
  if (scene.textures.exists(TEX.dot)) return;
  const paint = (key, w, h, draw) => {
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  paint(TEX.dot, 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(16, 16, 8);
  });
  paint(TEX.streak, 48, 12, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 2, 48, 8, 4);
  });
  paint(TEX.star, 64, 64, (g) => {
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const len = i % 2 === 0 ? 30 : 16;
      g.fillTriangle(
        32 + Math.cos(a) * len, 32 + Math.sin(a) * len,
        32 + Math.cos(a + 0.4) * 5, 32 + Math.sin(a + 0.4) * 5,
        32 + Math.cos(a - 0.4) * 5, 32 + Math.sin(a - 0.4) * 5,
      );
    }
  });
  paint(TEX.puff, 48, 48, (g) => {
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(24, 24, 18);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(16, 20, 10);
    g.fillCircle(32, 22, 9);
  });
  paint(TEX.ring, 64, 64, (g) => {
    g.lineStyle(4, 0xffffff, 1);
    g.strokeCircle(32, 32, 26);
  });
}

export class Juice {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
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
    img.setBlendMode(Phaser.BlendModes.ADD);
    this.live++;
    return img;
  }

  release(img, delay) {
    const done = () => {
      if (!img.active) return;
      img.setActive(false).setVisible(false);
      this.live = Math.max(0, this.live - 1);
    };
    if (delay > 0) this.scene.time.delayedCall(delay, done);
    else done();
  }

  addTrauma(amount) {
    if (this.fast || !(amount > 0)) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  shakeOffset(timeSec, zoom) {
    let mode = 'full';
    try { mode = localStorage.getItem('ak-shake') || 'full'; } catch { /* node tests */ }
    const off = traumaOffset(this.trauma, timeSec, zoom, mode);
    return off;
  }

  update(dt) {
    if (this.fast) return;
    this.trauma = Math.max(0, this.trauma - FEEL.traumaDecay * dt);
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.life -= dt;
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
    const s = Math.min(1, Math.max(0, dmg / 20));
    const color = TYPE_COLOR[type] ?? 0xffffff;
    const star = this.borrow(TEX.star);
    if (star) {
      star.setPosition(x, y).setTint(color).setScale(0.35 + 0.2 * s);
      this.scene.tweens.add({
        targets: star,
        scale: 0.6 + 0.9 * s,
        alpha: 0,
        duration: (6 + 6 * s) * FEEL.stepMs,
        ease: 'Quad.easeOut',
        onComplete: () => this.release(star, 0),
      });
    }
    for (let r = 0; r < (dmg >= 12 ? 2 : 1); r++) {
      const ring = this.borrow(TEX.ring);
      if (!ring) break;
      ring.setPosition(x, y).setTint(color).setScale(0.2);
      this.scene.tweens.add({
        targets: ring,
        scale: (30 + 50 * s) / 32,
        alpha: 0,
        duration: 10 * FEEL.stepMs,
        ease: 'Quad.easeOut',
        delay: r * 30,
        onComplete: () => this.release(ring, 0),
      });
    }
    const n = 6 + Math.round(14 * s);
    for (let i = 0; i < n; i++) {
      const bit = this.borrow(i % 3 === 0 ? TEX.streak : TEX.dot);
      if (!bit) break;
      const along = (i / n) < 0.7;
      const spread = along ? (Math.random() - 0.5) * 0.8 : (Math.random() - 0.5) * Math.PI;
      const a = angle + Math.PI + spread;
      const dist = (40 + Math.random() * (80 + 120 * s));
      bit.setPosition(x, y).setTint(color).setRotation(a);
      bit.setScale(type === 'chemical' ? 0.35 : 0.25 + Math.random() * 0.3);
      const spec = {
        targets: bit,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist + (type === 'heat' ? -30 - 40 * Math.random() : type === 'chemical' ? 20 + 30 * Math.random() : 0),
        alpha: 0,
        duration: 120 + Math.random() * 140 + (type === 'heat' ? 200 : 0),
        ease: 'Quad.easeOut',
        onComplete: () => this.release(bit, 0),
      };
      this.scene.tweens.add(spec);
    }
    if (type === 'electrical') this.bolt(x, y, color);
    if (type === 'radiation') this.pulseRing(x, y, color);
    if (dmg >= 15) this.impactFlash();
    this.addTrauma(traumaForHit(dmg, false));
  }

  bolt(x, y, color) {
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const draw = () => {
      g.clear();
      g.lineStyle(2, color, 0.9);
      for (let b = 0; b < 3; b++) {
        let px = x;
        let py = y;
        g.beginPath();
        g.moveTo(px, py);
        const ang = -Math.PI / 2 + (b - 1) * 0.7;
        for (let s = 0; s < 5; s++) {
          px += Math.cos(ang) * 14 + (Math.random() - 0.5) * 16;
          py += Math.sin(ang) * 14 + (Math.random() - 0.5) * 16;
          g.lineTo(px, py);
        }
        g.strokePath();
      }
    };
    draw();
    this.scene.time.delayedCall(6 * FEEL.stepMs, () => g.destroy());
  }

  pulseRing(x, y, color) {
    for (let i = 0; i < 2; i++) {
      const ring = this.borrow(TEX.ring);
      if (!ring) return;
      ring.setPosition(x, y).setTint(color).setScale(0.3);
      this.scene.tweens.add({
        targets: ring, scale: 1.4, alpha: 0, duration: 220, delay: i * 90,
        ease: 'Sine.easeOut', onComplete: () => this.release(ring, 0),
      });
    }
  }

  impactFlash() {
    const cam = this.scene.cameras?.main;
    if (!cam || this.flash) return;
    const rect = this.scene.add.rectangle(cam.midPoint.x, cam.midPoint.y, 1400, 800, 0xffffff, 0.35)
      .setScrollFactor(0).setDepth(5000).setBlendMode(Phaser.BlendModes.ADD);
    this.flash = rect;
    this.scene.tweens.add({
      targets: rect, alpha: 0, duration: 50, ease: 'Quad.easeOut',
      onComplete: () => { rect.destroy(); this.flash = null; },
    });
  }

  afterimage(fighter, alpha) {
    if (this.fast || !fighter?.rig?.sprite) return;
    const spr = fighter.rig.sprite;
    if (!spr.texture?.key) return;
    const img = this.borrow(spr.texture.key);
    if (!img) return;
    const frame = spr.frame?.name;
    if (frame != null) img.setFrame(frame);
    img.setPosition(fighter.x + (fighter.rig.x || 0), fighter.y + (fighter.rig.y || 0));
    img.setOrigin(spr.originX, spr.originY);
    img.setScale(spr.scaleX * (fighter.facing || 1), spr.scaleY);
    img.setTintFill(TYPE_COLOR[fighter.currentMove?.type] ?? 0xffffff);
    img.setAlpha(alpha);
    this.scene.tweens.add({
      targets: img, alpha: 0, duration: 90, ease: 'Quad.easeOut',
      onComplete: () => this.release(img, 0),
    });
  }

  swing(fighter, move) {
    if (this.fast || !fighter) return;
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(20);
    const facing = fighter.facing || 1;
    const reach = (move?.rangeW ?? 72) * 0.8;
    const a0 = facing === 1 ? -60 * Math.PI / 180 : Math.PI - 40 * Math.PI / 180;
    const a1 = facing === 1 ? 40 * Math.PI / 180 : Math.PI + 60 * Math.PI / 180;
    this.arcs.push({
      g, x: fighter.x + facing * fighter.bodyW * 0.2, y: fighter.y - fighter.bodyH * 0.65,
      r: Math.max(36, reach), a0, a1,
      color: TYPE_COLOR[move?.type] ?? 0xffffff,
      life: 8 * FEEL.stepMs / 1000, max: 8 * FEEL.stepMs / 1000,
    });
  }

  puff(x, y, color, scale = 0.6) {
    if (this.fast) return;
    const img = this.borrow(TEX.puff);
    if (!img) return;
    img.setPosition(x, y).setTint(color).setScale(scale * 0.5).setAlpha(0.6);
    this.scene.tweens.add({
      targets: img, scale: scale * 1.4, alpha: 0, duration: 500, ease: 'Quad.easeOut',
      onComplete: () => this.release(img, 0),
    });
  }

  dust(x, y, dir = 1) {
    if (this.fast) return;
    for (let i = 0; i < 4; i++) {
      const bit = this.borrow(TEX.puff);
      if (!bit) return;
      bit.setPosition(x, y).setScale(0.25).setAlpha(0.7).setTint(0xd8d2c4);
      this.scene.tweens.add({
        targets: bit,
        x: x + dir * (20 + Math.random() * 40),
        y: y - 6 - Math.random() * 14,
        alpha: 0,
        duration: 250,
        ease: 'Quad.easeOut',
        onComplete: () => this.release(bit, 0),
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
      ? (TYPE_COLOR[L.type] ?? 0x9aa3b2)
      : 0x9aa3b2;
    this.puff(fighter.x, fighter.y - fighter.bodyH * 0.55, tint, 0.55);
  }

  koLine(fighter) {
    if (this.fast) return;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const x = Phaser.Math.Clamp(fighter.x, view.x + 20, view.right - 20);
    const y = Phaser.Math.Clamp(fighter.y, view.y + 20, view.bottom - 20);
    const pal = fighter.charDef.palettes[fighter.paletteIndex]?.body ?? 0xffffff;
    const g = this.scene.add.graphics().setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
    const ang = Math.atan2(view.centerY - y, view.centerX - x);
    g.fillStyle(pal, 0.9);
    const tip = (d, a) => [x + Math.cos(ang + a) * d, y + Math.sin(ang + a) * d];
    const [ax, ay] = tip(36, 0.9);
    const [bx, by] = tip(36, -0.9);
    const [cx, cy] = tip(600, 0);
    g.fillTriangle(ax, ay, bx, by, cx, cy);
    this.scene.tweens.add({
      targets: g, alpha: 0, duration: 300, ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
    for (let i = 0; i < 24; i++) {
      const bit = this.borrow(TEX.streak);
      if (!bit) break;
      const a = ang + (Math.random() - 0.5) * 0.8;
      bit.setPosition(x, y).setTint(pal).setRotation(a).setScale(0.4);
      this.scene.tweens.add({
        targets: bit,
        x: x + Math.cos(a) * (80 + Math.random() * 180),
        y: y + Math.sin(a) * (80 + Math.random() * 180),
        alpha: 0, duration: 280, ease: 'Quad.easeOut',
        onComplete: () => this.release(bit, 0),
      });
    }
    this.impactFlash();
    this.addTrauma(0.5);
  }
}
