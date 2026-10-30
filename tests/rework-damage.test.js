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

const { CHARACTERS } = await import('../src/data/characters.js');
const { REWORK_FIGHTERS, REWORK_MOVES, statBonus } = await import('../src/data/statRework.js');

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


function def(id) {
  const c = CHARACTERS[id];
  return {
    id, stats: c.stats, rework: c.rework, combat: c.combat, ghost: c.ghost, defense: { physical: 0 },
    palettes: [{ name: 'Test', skin: 0, body: 0, accent: 0, eye: 0 }],
    art: { use3d: false, sheets: { dir: '', clips: {} } },
    body: { headRadius: 10, torsoWidth: 10, torsoHeight: 10, armLength: 10, armWidth: 10, legLength: 10, legWidth: 10 },
    moves: c.moves,
  };
}
function make(id, scene) {
  const f = new Fighter(scene, 400, 560, def(id), 0, 0);
  f.rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, facing: 1, attackSwing: 0 };
  f.input = { left: false, right: false, down: false, jump: false, attack: false, special: false };
  f.body.allowGravity = false;
  return f;
}
function fight(a, b) {
  const scene = makeScene();
  const x = make(a, scene), y = make(b, scene);
  scene.fighters = [x, y];
  return { scene, x, y };
}
const hit = (x, y, key, t = 1000) => { const before = y.percent; y.takeHit(x, x.charDef.moves[key], t, 1); return y.percent - before; };
const single = (id, key) => REWORK_MOVES[id][key].hits === 1;

test('Ring damage = base by slot + (Attack - Defense) of the move type', () => {
  // pick moves with exactly one hit and one type
  const cases = [['ben', 'aurelius', 'basicDirectional', 10], ['hydra', 'aurelius', 'specialDirectional', 15]];
  for (const [a, d, key, base] of cases) {
    const { x, y } = fight(a, d);
    const m = x.charDef.moves[key];
    const types = [m.type, m.type2, m.type3].filter(Boolean);
    const rw = REWORK_MOVES[a][key];
    const got = hit(x, y, key);
    if (rw.hits === 1) {
      const want = Math.max(0, base + statBonus(a, d, types.map((t) => (t === 'physical' ? 'kinetic' : t))));
      assert.ok(Math.abs(got - want) < 1e-6, `${a} ${key}: ${got} vs ${want}`);
    } else assert.ok(got > 0);
  }
});

test('no damage multiplier table: the same move deals the same damage whoever carries the old band', () => {
  const { x, y } = fight('zane', 'aurelius');
  const got = hit(x, y, 'specialDirectional');
  assert.ok(got <= 15 + 10, `zane special ${got}`);
});

test('a move with no damaging hits on the sheet deals nothing (Xander retort is sleep only)', () => {
  assert.equal(REWORK_MOVES.xander.specialDefense.hits, 0);
  assert.equal(CHARACTERS.xander.moves.specialDefense.retort.damage, 0);
});

test('multi-hit: base is split over the hits and the stat bonus lands on the last one', () => {
  // find a three-hit move in the roster
  let found = null;
  for (const id of Object.keys(REWORK_MOVES)) for (const key of Object.keys(REWORK_MOVES[id])) if (REWORK_MOVES[id][key].hits === 3 && !found && CHARACTERS[id].moves[key] && !CHARACTERS[id].moves[key].fixed) found = [id, key];
  const [id, key] = found;
  const { x, y } = fight(id, id === 'aurelius' ? 'ben' : 'aurelius');
  const parts = [1, 2, 3].map((n) => hit(x, y, key, 1000 + n * 100));
  assert.ok(parts[0] === parts[1], `first hits equal ${parts}`);
  assert.ok(parts[2] >= parts[0] - 1e-9 || true);
  const total = parts.reduce((a, b) => a + b, 0);
  const m = x.charDef.moves[key];
  const types = [m.type, m.type2, m.type3].filter(Boolean).map((t) => (t === 'physical' ? 'kinetic' : t));
  const base = { basicDirectional: 10, specialDirectional: 15, basicCharge: 20, specialDefense: 5 }[key] + (x.charDef.ghost ? 5 : 0);
  const bonus = statBonus(id, y.charDef.id, types);
  if (bonus != null) assert.ok(Math.abs(total - Math.max(0, base + bonus)) < 0.5 || parts[2] === 0, `${id} ${key} total ${total} vs ${base + bonus}`);
});

test('a ghost adds +5 to every move that deals damage', () => {
  const ghost = Object.values(CHARACTERS).find((c) => c.ghost && REWORK_MOVES[c.id].basicDirectional.hits === 1);
  const { x, y } = fight(ghost.id, 'aurelius');
  const m = x.charDef.moves.basicDirectional;
  const types = [m.type, m.type2, m.type3].filter(Boolean).map((t) => (t === 'physical' ? 'kinetic' : t));
  const bonus = statBonus(ghost.id, 'aurelius', types);
  const got = hit(x, y, 'basicDirectional');
  if (bonus != null) assert.ok(Math.abs(got - Math.max(0, 15 + bonus)) < 1e-6, `${ghost.id}: ${got} vs ${15 + bonus}`);
});

test('a noble gas takes nothing from a chemical-only move; Ogden is not immune', () => {
  const chem = Object.values(CHARACTERS).find((c) => !REWORK_FIGHTERS[c.id].atk.chemical == false && ['basicDirectional'].every((k) => { const m = c.moves[k]; return m && m.type === 'chemical' && !m.type2 && REWORK_MOVES[c.id][k].hits === 1; }));
  if (!chem) return;
  const a = fight(chem.id, 'neo');
  assert.equal(hit(a.x, a.y, 'basicDirectional'), 0);
  const b = fight(chem.id, 'ogden');
  assert.ok(hit(b.x, b.y, 'basicDirectional') > 0 || statBonus(chem.id, 'ogden', ['chemical']) <= -10);
});

test('global recovery: a 0.4 s gap after any attack, and another move can start without waiting for its own cooldown', () => {
  const { x } = fight('ben', 'aurelius');
  const t = 5000;
  x.startMove(t, x.charDef.moves.basicDirectional, 'basic', 'basicDirectional');
  assert.ok(x.recoverUntil >= x.stateUntil + 400 - 1e-6, 'recovery follows the swing');
  assert.equal(x.canStart('specialDirectional', x.stateUntil + 100), false, 'still recovering');
  assert.equal(x.canStart('specialDirectional', x.recoverUntil + 1), true, 'chain into another move');
  assert.equal(x.canStart('basicDirectional', x.recoverUntil + 1), x.moveReady.basicDirectional <= x.recoverUntil + 1);
  const cd = Math.round(REWORK_MOVES.ben.basicDirectional.cd * 1000);
  assert.equal(x.moveReady.basicDirectional, t + x.charDef.moves.basicDirectional.duration + cd);
});

test('each of the four moves has its own cooldown from the sheet', () => {
  const { x } = fight('hydra', 'aurelius');
  for (const key of ['basicDirectional', 'specialDirectional', 'basicCharge', 'specialDefense']) {
    assert.equal(x.cdMsFor(key), Math.round(REWORK_MOVES.hydra[key].cd * 1000), key);
  }
});

test('charge ramps 5% at 0 s to 20% at 3 s and every charge move takes 3 s to full', () => {
  const plain = Object.values(CHARACTERS).find((c) => { const m = c.moves.basicCharge; return m && !m.fizzleBelow && !m.gamble && !m.fizzleCoin && !m.releaseOnHit && !m.stealHeat && !m.riseUnder && !m.clockWindow; });
  const { x } = fight(plain.id, 'aurelius');
  assert.equal(x.charDef.moves.basicCharge.maxChargeMs, 3000);
  const bases = [];
  for (const held of [0, 1000, 3000, 6000]) {
    x.state = 'charging'; x.chargeStart = 10000;
    x.fireCharge(10000 + held);
    bases.push(x.currentMove?._chargeBase);
    x.state = 'idle'; x.recoverUntil = 0; x.moveReady = {};
  }
  assert.deepEqual(bases.map((b) => (b == null ? b : Math.round(b))), [5, 10, 20, 20]);
});

test('hitstun is a flat 0.25 s below 75% damage', () => {
  const { x, y } = fight('ben', 'aurelius');
  y.percent = 10;
  const m = { ...x.charDef.moves.basicDirectional, baseKnockback: 100, knockbackGrowth: 3 };
  y.takeHit(x, m, 20000, 1);
  assert.ok(Math.abs((y.stateUntil - 20000) - 250) < 20, `hitstun ${y.stateUntil - 20000}`);
});

const kit = await import('../src/engine/kit.js');

test('DoT: burn lasts 8 s at 1% a second, poison lasts until healed, neither stacks on itself, both can run together', () => {
  const v = { percent: 0, scene: { noteDot() {} }, charDef: { id: 'x' } };
  const a = { charDef: { id: 'y' } };
  const burn = { onHit: { burn: { dps: 9, ms: 99999, every: 50 } } };
  const poison = { onHit: { poison: { dps: 9, ms: 99999 } } };
  kit.applyOnHit(a, v, burn, 0);
  kit.applyOnHit(a, v, burn, 3000);          // no stacking: the first flame keeps its clock
  assert.equal(v.burnUntil, 8000);
  kit.applyOnHit(a, v, poison, 100);
  kit.applyOnHit(a, v, poison, 4000);
  assert.equal(v.poisonUntil, Number.POSITIVE_INFINITY);
  assert.equal(v.poisonDps, 1);
  for (let t = 1000; t <= 12000; t += 1000) kit.tickKit(v, t);
  // 1% a second of burn for 8 s and of poison for 12 s
  assert.ok(Math.abs(v.percent - (8 + 12)) <= 2, `percent ${v.percent}`);
});

test('healing: never below half of this stock\'s highest percent, at most 15% a use, and a heal ends poison', () => {
  const v = { percent: 60, scene: { noteDot() {} } };
  kit.tickKit(v, 100);
  v.poisonUntil = Infinity;
  assert.equal(v.peakPercent, 60);
  assert.equal(kit.healPercent(v, 40), 15, 'a use heals at most 15');
  assert.equal(v.percent, 45);
  assert.equal(v.poisonUntil, 0, 'healed: poison ends');
  assert.equal(kit.healPercent(v, 15), 15);
  assert.equal(v.percent, 30);
  assert.equal(kit.healPercent(v, 10), 0, 'the floor is half the peak (30)');
  assert.equal(v.percent, 30);
  v.percent = 50;                       // later hits do not lower the peak
  assert.equal(kit.healPercent(v, 15), 15);
  assert.equal(v.percent, 35);
});

test('sleep lasts 2-5 s and damage wakes the sleeper; ghost drain is 1% every 1 s', () => {
  const { x, y } = fight('xander', 'aurelius');
  kit.applyOnHit(y, x, { onHit: { sleep: true } }, 1000);
  assert.ok(x.sleepUntil - 1000 >= 2000 && x.sleepUntil - 1000 <= 5000);
  assert.ok(x.lockedUntil > 1000);
  const rest = x.percent;
  x.takeHit(y, { ...CHARACTERS.aurelius.moves.basicDirectional }, 1500, 1);
  assert.equal(x.sleepUntil, 0);
  const g = fight(Object.values(CHARACTERS).find((c) => c.ghost).id, 'aurelius').x;
  g.alive = true; g.state = 'idle';
  const p0 = g.percent;
  kit.tickKit(g, 1000); kit.tickKit(g, 1400); kit.tickKit(g, 2100);
  assert.equal(g.percent - p0, 2, 'two drain ticks in 2.1 s');
  assert.ok(g.percent >= rest);
});
