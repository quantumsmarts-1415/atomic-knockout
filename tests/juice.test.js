import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const phaserPath = require.resolve('phaser');

mock.module(phaserPath, {
  namedExports: {
    BlendModes: { NORMAL: 0, ADD: 1 },
    Math: { Clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) },
  },
});

const { Juice } = await import('../src/engine/juice.js');
const { FEEL } = await import('../src/engine/feel.js');

function fakeImage() {
  return {
    active: false,
    visible: false,
    alpha: 1,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    tint: null,
    filled: false,
    blend: null,
    depth: 0,
    key: '',
    setActive(v) { this.active = v; return this; },
    setVisible(v) { this.visible = v; return this; },
    setAlpha(v) { this.alpha = v; return this; },
    setScale(x, y) { this.scaleX = x; this.scaleY = y ?? x; return this; },
    setRotation(v) { this.rotation = v; return this; },
    clearTint() { this.tint = null; return this; },
    setTint(c) { this.tint = c; this.filled = false; return this; },
    setTintFill(c) { this.tint = c; this.filled = true; return this; },
    setBlendMode(m) { this.blend = m; return this; },
    setTexture(k) { this.key = k; return this; },
    setFrame(f) { this.frameName = f; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setOrigin() { return this; },
    setDepth(d) { this.depth = d; return this; },
  };
}

function fakeScene() {
  return {
    simFast: false,
    textures: { exists: () => true },
    add: {
      image: () => fakeImage(),
      graphics: () => ({
        clear() { return this; },
        lineStyle() { return this; },
        beginPath() { return this; },
        moveTo() { return this; },
        lineTo() { return this; },
        strokePath() { return this; },
        fillStyle() { return this; },
        fillTriangle() { return this; },
        setDepth() { return this; },
        setAlpha(a) { this.alpha = a; return this; },
        destroy() { this.dead = true; },
        alpha: 1,
        dead: false,
      }),
      rectangle: () => ({
        setScrollFactor() { return this; },
        setDepth() { return this; },
        setAlpha(a) { this.alpha = a; return this; },
        destroy() { this.dead = true; },
        dead: false,
        alpha: 1,
        life: 0,
        max: 1,
      }),
    },
    cameras: {
      main: {
        midPoint: { x: 640, y: 360 },
        worldView: { x: 0, y: 0, right: 1280, bottom: 720, centerX: 640, centerY: 360 },
      },
    },
  };
}

function fighter(id) {
  return {
    id,
    x: 400,
    y: 560,
    facing: 1,
    currentMove: { type: 'heat' },
    rig: {
      x: 0,
      y: 0,
      sprite: {
        visible: true,
        texture: { key: `sheet-${id}` },
        frame: { name: 2 },
        originX: 0.5,
        originY: 1,
        scaleX: 0.4,
        scaleY: 0.4,
        rotation: 0,
      },
    },
  };
}

test('afterimages are capped, tinted, and gone after a dozen frames', () => {
  const juice = new Juice(fakeScene());
  const ira = fighter('ira');
  for (let i = 0; i < 6; i++) juice.afterimage(ira, 0.42);
  const ghosts = juice.fx.filter((f) => f.kind === 'ghost');
  assert.ok(ghosts.length <= FEEL.afterimageCap);
  assert.strictEqual(ghosts.length, 4);
  for (const g of ghosts) {
    assert.ok(g.alpha0 >= 0.35 && g.alpha0 <= 0.5);
    assert.strictEqual(g.img.filled, false);
    assert.strictEqual(g.img.blend, 0);
    assert.ok(g.img.tint != null);
  }
  for (let i = 0; i < 12; i++) juice.update(1 / 60);
  assert.strictEqual(juice.effectCount(), 0);
  assert.ok(juice.pool.every((p) => !p.active));
});

test('hit sparks and smoke return to the pool', () => {
  const juice = new Juice(fakeScene());
  juice.hit(400, 500, 16, 'electrical', -0.7);
  juice.puff(400, 560, 0xbbbbbb, 0.8);
  assert.ok(juice.effectCount() > 0);
  const spark = juice.fx.find((f) => f.kind === 'spark');
  assert.ok(spark);
  assert.strictEqual(spark.img.filled, false);
  assert.ok(spark.scale1 > spark.scale0);
  for (let i = 0; i < 24; i++) juice.update(1 / 60);
  assert.strictEqual(juice.effectCount(), 0);
  assert.ok(juice.pool.every((p) => !p.active));
});
