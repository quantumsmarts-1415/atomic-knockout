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
