import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const phaserPath = require.resolve('phaser');

mock.module(phaserPath, {
  namedExports: {
    Math: { Clamp: (v, min, max) => Math.min(Math.max(v, min), max) },
    Scene: class Scene {},
    GameObjects: {
      Container: class Container {
        constructor(scene, x, y) { this.scene = scene; this.x = x; this.y = y; }
        add() {}
        setScale(sx, sy) { this.scaleX = sx; this.scaleY = sy ?? sx; return this; }
      },
    },
  },
});

const { clipFrameSize, clipDisplayLayout } = await import('../src/scenes/BootScene.js');
const { Rig } = await import('../src/engine/Rig.js');

const sheets = {
  frameW: 609,
  frameH: 720,
  footY: 0.9823,
  visibleH: 668,
  clips: {
    idle: { count: 14, fps: 3.6, loop: true },
    walk: { count: 12, fps: 10, loop: true, frameW: 1074, frameH: 720, footY: 0.97, visibleH: 700 },
  },
};

test('clipFrameSize uses shared sheets size when the clip omits frameW/frameH', () => {
  assert.deepStrictEqual(clipFrameSize(sheets, sheets.clips.idle), { frameW: 609, frameH: 720 });
});

test('clipFrameSize uses per-clip frameW/frameH when present', () => {
  assert.deepStrictEqual(clipFrameSize(sheets, sheets.clips.walk), { frameW: 1074, frameH: 720 });
});

test('clipFrameSize mixes per-clip and shared when only one dimension is set', () => {
  assert.deepStrictEqual(
    clipFrameSize(sheets, { count: 8, frameW: 800 }),
    { frameW: 800, frameH: 720 },
  );
});

test('clipDisplayLayout keeps shared origin/scale unless the clip has its own frame size', () => {
  assert.deepStrictEqual(clipDisplayLayout(sheets, sheets.clips.idle), {
    footY: 0.9823,
    visibleH: 668,
  });
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, footY: 0.5, visibleH: 100 }),
    { footY: 0.9823, visibleH: 668 },
  );
});

test('clipDisplayLayout uses per-clip footY/visibleH when the clip has frameW/frameH', () => {
  assert.deepStrictEqual(clipDisplayLayout(sheets, sheets.clips.walk), {
    footY: 0.97,
    visibleH: 700,
  });
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, frameW: 1074, frameH: 720 }),
    { footY: 0.9823, visibleH: 668 },
  );
});

function makeSprite() {
  return {
    originX: 0.5,
    originY: 0.5,
    scale: 1,
    playKey: null,
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setScale(s) { this.scale = s; return this; },
    setFlipX() { return this; },
    setTint() { return this; },
    setTexture() { return this; },
    anims: { play(key) { this.playKey = key; return this; }, stop() {}, timeScale: 1 },
  };
}

function makeSheetScene(sprite) {
  return {
    textures: { exists: () => true },
    add: { sprite: () => sprite },
  };
}

const charDef = {
  id: 'hydra',
  palettes: [{ name: 'Sky', skin: 0, body: 0, accent: 0, eye: 0 }],
  art: {
    key: 'char-hydra',
    facing: 1,
    height: 122,
    use3d: true,
    sheets,
  },
  body: { headRadius: 10, torsoWidth: 10, torsoHeight: 10, armLength: 10, armWidth: 10, legLength: 10, legWidth: 10 },
};

test('Rig sheet mode uses idle layout then walk layout when clips differ in frame size', () => {
  const sprite = makeSprite();
  const rig = new Rig(makeSheetScene(sprite), charDef, 0);
  assert.ok(rig.sheetMode);
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);

  rig.animate(0.016, 'idle');
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);
  assert.strictEqual(sprite.playKey, 'char-hydra-idle');

  rig.animate(0.016, 'walk');
  assert.strictEqual(sprite.originY, sheets.clips.walk.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.clips.walk.visibleH);
  assert.strictEqual(sprite.playKey, 'char-hydra-walk');

  rig.animate(0.016, 'idle');
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);
});
