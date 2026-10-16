import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const phaserPath = require.resolve('phaser');

mock.module(phaserPath, {
  namedExports: {
    Math: { Clamp: (v, min, max) => Math.min(Math.max(v, min), max) },
    Geom: { Rectangle: class { constructor(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; } } },
    Scene: class Scene {},
    GameObjects: {
      Container: class Container {
        constructor(scene, x, y) { this.scene = scene; this.x = x; this.y = y; }
        setSize() {} setPosition() {} add() {} setVisible() {}
      },
      Sprite: class Sprite {},
    },
    BlendModes: { ADD: 1, NORMAL: 0 },
  },
});

const { default: Fighter } = await import('../src/engine/Fighter.js');

const GRAVITY = 1500;
const DT = 1 / 60;
const FLOOR = 560;

function chain() {
  const o = {
    setOrigin() { return o; }, setScale() { return o; }, setVisible() { return o; },
    setTint() { return o; }, setTintFill() { return o; }, clearTint() { return o; },
    play() { return o; }, setBlendMode() { return o; }, setAlpha() { return o; },
    setPosition() { return o; }, setDepth() { return o; },
  };
  return o;
}

function makeBody(owner) {
  const body = {
    allowGravity: true,
    velocity: { x: 0, y: 0 },
    blocked: { down: false, up: false, left: false, right: false, none: true },
    touching: { down: false, up: false, left: false, right: false, none: true },
    gravity: { y: 0 },
    maxVelocity: { y: 1400 },
    setSize() {},
    setOffset() {},
    setVelocity(x, y) { body.velocity.x = x; body.velocity.y = y; },
    setVelocityX(x) { body.velocity.x = x; },
    setVelocityY(y) { body.velocity.y = y; },
    reset(x, y) { owner.x = x; owner.y = y; },
  };
  return body;
}

function makeScene() {
  return {
    time: { now: 0, delayedCall: () => {} },
    spawnProjectile: () => {},
    resolveBurst: () => {},
    textures: { exists: () => true },
    fighters: [],
    stepMs: 1000 / 60,
    simFast: true,
    physics: { add: { existing: (obj) => { obj.body = makeBody(obj); } } },
    add: {
      image: () => chain(),
      sprite: () => chain(),
      graphics: () => ({
        generateTexture() {}, destroy() {}, clear() {}, fillStyle() {}, fillRect() {},
        fillCircle() {}, lineStyle() {}, strokeLineShape() {}, fillPoint() {},
      }),
      container: () => ({ add() {} }),
      existing() {},
    },
  };
}

const charDef = {
  id: 'still_victim',
  stats: { weight: 1, speed: 200, airJumps: 1, gravityScale: 1, jumpVelocity: 700 },
  defense: { physical: 0 },
  palettes: [{ name: 'Test', skin: 0, body: 0, accent: 0, eye: 0 }],
  art: { use3d: false, sheets: { dir: '', clips: {} } },
  body: { headRadius: 10, torsoWidth: 10, torsoHeight: 10, armLength: 10, armWidth: 10, legLength: 10, legWidth: 10 },
  moves: {},
};

function physics(f) {
  const b = f.body;
  if (b.allowGravity) b.velocity.y += (GRAVITY + (b.gravity.y || 0)) * DT;
  if (b.velocity.y > b.maxVelocity.y) b.velocity.y = b.maxVelocity.y;
  f.x += b.velocity.x * DT;
  f.y += b.velocity.y * DT;
  b.blocked.down = false;
  b.touching.down = false;
  if (f.y >= FLOOR && b.velocity.y >= 0) {
    f.y = FLOOR;
    b.velocity.y = 0;
    b.blocked.down = true;
    b.touching.down = true;
  }
}

// Stand still, get hit, and step the same way the match does: physics, then update.
function hitWhileStill(prior) {
  const scene = makeScene();
  const f = new Fighter(scene, 400, FLOOR, charDef, 0, 0);
  f.rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, facing: 1, attackSwing: 0 };
  f.state = prior.state ?? 'idle';
  f.input = { left: false, right: false, down: false, jump: false, attack: false, special: false };
  f.body.allowGravity = prior.allowGravity ?? false;
  f.body.velocity.x = 0;
  f.body.velocity.y = 0;
  f.body.blocked.down = true;
  f.body.touching.down = true;
  f._gliding = !!prior.gliding;
  f.chargeStart = prior.charging ? 1000 : null;
  f._floatFloor = prior.charging ? FLOOR : null;
  f.percent = 40;
  const move = {
    type: 'kinetic', damage: 12, baseKnockback: 200, knockbackGrowth: 8,
    angleDeg: 45, kind: 'melee',
  };
  f.takeHit({ x: 300, y: FLOOR, facing: 1 }, move, 1000, 1);
  const armed = { state: f.state, gravity: f.body.allowGravity, gliding: f._gliding };
  let t = 1000;
  let minY = f.y;
  let maxAbsX = 0;
  for (let i = 0; i < 100; i++) {
    physics(f);
    t += 1000 / 60;
    f.update(t, 1000 / 60);
    minY = Math.min(minY, f.y);
    maxAbsX = Math.max(maxAbsX, Math.abs(f.body.velocity.x));
  }
  return { armed, y: f.y, minY, maxAbsX, gravity: f.body.allowGravity, x: f.x };
}

test('a still idle fighter falls and takes knockback in hitstun', () => {
  const r = hitWhileStill({ state: 'idle', allowGravity: false });
  assert.strictEqual(r.armed.state, 'hurt');
  assert.strictEqual(r.armed.gravity, true);
  assert.ok(r.minY < FLOOR - 25, `launch should leave the floor, minY ${r.minY}`);
  assert.ok(r.y > r.minY + 40, `should fall after the launch, y ${r.y} apex ${r.minY}`);
  assert.ok(Math.abs(r.x - 400) > 15, `knockback should move them, x ${r.x}`);
  assert.strictEqual(r.gravity, true);
});

test('hitstun turns gravity back on after a charge float or a glide', () => {
  for (const prior of [
    { state: 'charging', allowGravity: false, charging: true },
    { state: 'idle', allowGravity: false, gliding: true },
  ]) {
    const r = hitWhileStill(prior);
    assert.strictEqual(r.armed.state, 'hurt', JSON.stringify(prior));
    assert.strictEqual(r.armed.gravity, true, JSON.stringify(prior));
    assert.strictEqual(r.armed.gliding, false, JSON.stringify(prior));
    assert.ok(r.y > r.minY + 40, `${JSON.stringify(prior)} hung at ${r.y} apex ${r.minY}`);
    assert.ok(Math.abs(r.x - 400) > 15, `${JSON.stringify(prior)} x ${r.x}`);
  }
});
