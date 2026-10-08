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

const {
  clipFrameSize,
  clipDisplayLayout,
  loadRosterArt,
  positiveFinite,
  formatLoadPercent,
  attachBootLoadUi,
  default: BootScene,
} = await import('../src/scenes/BootScene.js');
const { Rig } = await import('../src/engine/Rig.js');

const sheets = {
  dir: 'art-src/gemini-test/sheets/',
  frameW: 609,
  frameH: 720,
  footY: 0.9823,
  visibleH: 668,
  clips: {
    idle: { count: 14, fps: 3.6, loop: true },
    walk: { count: 12, fps: 10, loop: true, frameW: 1074, frameH: 720, footY: 0.97, visibleH: 700 },
  },
};

function fakeChar(clipOverrides = sheets.clips) {
  return {
    id: 'testhero',
    palettes: [{ name: 'Sky', skin: 0, body: 0, accent: 0, eye: 0 }],
    art: {
      key: 'char-testhero',
      file: 'art-src/testhero-cut.png',
      facing: 1,
      height: 122,
      use3d: true,
      sheets: { ...sheets, clips: clipOverrides },
    },
    body: { headRadius: 10, torsoWidth: 10, torsoHeight: 10, armLength: 10, armWidth: 10, legLength: 10, legWidth: 10 },
  };
}

test('positiveFinite rejects 0, NaN, Infinity, and non-numbers', () => {
  assert.strictEqual(positiveFinite(609), true);
  assert.strictEqual(positiveFinite(0), false);
  assert.strictEqual(positiveFinite(-1), false);
  assert.strictEqual(positiveFinite(NaN), false);
  assert.strictEqual(positiveFinite(Infinity), false);
  assert.strictEqual(positiveFinite('609'), false);
  assert.strictEqual(positiveFinite(undefined), false);
});

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

test('clipFrameSize throws on non-positive or non-finite resolved size', () => {
  assert.throws(() => clipFrameSize(sheets, { frameW: 0, frameH: 720 }), RangeError);
  assert.throws(() => clipFrameSize(sheets, { frameW: Infinity, frameH: 720 }), RangeError);
  assert.throws(() => clipFrameSize(sheets, { frameW: NaN }), RangeError);
  assert.throws(() => clipFrameSize({ frameW: 609, frameH: 0 }, {}), RangeError);
});

test('clipDisplayLayout applies footY/visibleH independently of frameW/frameH', () => {
  assert.deepStrictEqual(clipDisplayLayout(sheets, sheets.clips.idle), {
    footY: 0.9823,
    visibleH: 668,
  });
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, footY: 0.5, visibleH: 100 }),
    { footY: 0.5, visibleH: 100 },
  );
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, footY: 0.91 }),
    { footY: 0.91, visibleH: 668 },
  );
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, frameW: 1074, frameH: 720 }),
    { footY: 0.9823, visibleH: 668 },
  );
});

test('clipDisplayLayout uses per-clip footY/visibleH when the clip has frameW/frameH', () => {
  assert.deepStrictEqual(clipDisplayLayout(sheets, sheets.clips.walk), {
    footY: 0.97,
    visibleH: 700,
  });
});

test('clipDisplayLayout throws on invalid resolved visibleH or footY', () => {
  assert.throws(() => clipDisplayLayout(sheets, { visibleH: 0 }), RangeError);
  assert.throws(() => clipDisplayLayout(sheets, { visibleH: Infinity }), RangeError);
  assert.throws(() => clipDisplayLayout(sheets, { footY: NaN }), RangeError);
  assert.throws(() => clipDisplayLayout({ footY: 0.9, visibleH: -4 }, {}), RangeError);
});

function loadCapturing() {
  const loads = [];
  const loader = {
    image() {},
    spritesheet(key, url, cfg) { loads.push({ key, url, ...cfg }); },
  };
  return { loads, loader };
}

test('loadRosterArt uses per-clip frame size on an isolated fake roster', () => {
  const { loads, loader } = loadCapturing();
  loadRosterArt(loader, [fakeChar()]);
  const idle = loads.find((l) => l.key === 'char-testhero-idle');
  const walk = loads.find((l) => l.key === 'char-testhero-walk');
  assert.ok(idle, 'idle sheet should load');
  assert.ok(walk, 'walk sheet should load');
  assert.strictEqual(idle.frameWidth, 609);
  assert.strictEqual(idle.frameHeight, 720);
  assert.strictEqual(walk.frameWidth, 1074);
  assert.strictEqual(walk.frameHeight, 720);
  assert.ok(walk.url.endsWith('testhero_walk.png'));
});

test('formatLoadPercent clamps Phaser 0..1 progress to a percent label', () => {
  assert.strictEqual(formatLoadPercent(0), '0%');
  assert.strictEqual(formatLoadPercent(0.42), '42%');
  assert.strictEqual(formatLoadPercent(1), '100%');
  assert.strictEqual(formatLoadPercent(-0.2), '0%');
  assert.strictEqual(formatLoadPercent(1.4), '100%');
  assert.strictEqual(formatLoadPercent(undefined), '0%');
});

function fakeLoadScene() {
  const listeners = {};
  const texts = [];
  const graphics = [];
  const scene = {
    scale: { width: 1280, height: 720 },
    add: {
      graphics() {
        const g = {
          fillStyle() { return this; },
          fillRoundedRect() { return this; },
          strokeRoundedRect() { return this; },
          lineStyle() { return this; },
          fillRect() { this.filled = true; return this; },
          clear() { this.cleared = true; return this; },
          destroy() { this.destroyed = true; },
        };
        graphics.push(g);
        return g;
      },
      text(_x, _y, str) {
        const t = {
          text: str,
          setOrigin() { return this; },
          setText(s) { this.text = s; return this; },
          destroy() { this.destroyed = true; },
        };
        texts.push(t);
        return t;
      },
    },
    load: {
      on(event, cb) { listeners[event] = cb; return this; },
    },
  };
  return { scene, listeners, texts, graphics };
}

test('attachBootLoadUi shows Loading art status, updates percent, destroys on complete', () => {
  const { scene, listeners, texts, graphics } = fakeLoadScene();
  attachBootLoadUi(scene);
  assert.ok(texts.some((t) => /Loading art/i.test(t.text)), 'status text should say Loading art');
  assert.ok(texts.some((t) => t.text === '0%'), 'percent should start at 0%');
  assert.strictEqual(typeof listeners.progress, 'function');
  assert.strictEqual(typeof listeners.complete, 'function');
  listeners.progress(0.5);
  assert.ok(texts.some((t) => t.text === '50%'), 'progress 0.5 should show 50%');
  listeners.complete();
  assert.ok(texts.every((t) => t.destroyed), 'texts destroyed on complete');
  assert.ok(graphics.every((g) => g.destroyed), 'graphics destroyed on complete');
});

test('BootScene.preload attaches load UI then still queues roster images and sheets', () => {
  const loads = [];
  const listeners = {};
  const texts = [];
  const scene = new BootScene();
  scene.scale = { width: 1280, height: 720 };
  scene.add = {
    graphics() {
      return {
        fillStyle() { return this; },
        fillRoundedRect() { return this; },
        strokeRoundedRect() { return this; },
        lineStyle() { return this; },
        fillRect() { return this; },
        clear() { return this; },
        destroy() {},
      };
    },
    text(_x, _y, str) {
      const t = { text: str, setOrigin() { return this; }, setText(s) { this.text = s; return this; }, destroy() {} };
      texts.push(t);
      return t;
    },
  };
  scene.load = {
    on(event, cb) { listeners[event] = cb; return this; },
    image(key, file) { loads.push({ type: 'image', key, file }); },
    spritesheet(key, url, cfg) { loads.push({ type: 'spritesheet', key, url, ...cfg }); },
  };
  scene.preload();
  assert.ok(texts.some((t) => /Loading art/i.test(t.text)));
  assert.ok(listeners.progress, 'should bind this.load.on("progress")');
  assert.ok(listeners.complete, 'should bind this.load.on("complete")');
  const images = loads.filter((l) => l.type === 'image');
  const sheets = loads.filter((l) => l.type === 'spritesheet');
  assert.ok(images.length >= 1, 'roster still images should still queue');
  assert.ok(sheets.length >= 1, 'roster sprite sheets should still queue');
  assert.ok(sheets.some((l) => l.key === 'char-hydra-idle'), 'hydra idle sheet must still load');
  assert.ok(sheets.some((l) => l.key === 'char-hydra-walk'), 'hydra walk sheet must still load');
});

test('loadRosterArt skips a clip with invalid frame size and still loads the rest', () => {
  const { loads, loader } = loadCapturing();
  const errors = [];
  const prev = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    loadRosterArt(loader, [fakeChar({
      idle: { count: 14, fps: 3.6, loop: true },
      walk: { count: 12, fps: 10, loop: true, frameW: 0, frameH: 720 },
    })]);
  } finally {
    console.error = prev;
  }
  assert.ok(loads.find((l) => l.key === 'char-testhero-idle'));
  assert.ok(!loads.find((l) => l.key === 'char-testhero-walk'));
  assert.ok(errors.some((msg) => msg.includes('testhero_walk') || msg.includes('testhero walk') || msg.includes('0x720')));
});

function makeSprite() {
  const sprite = {
    originX: 0.5,
    originY: 0.5,
    scale: 1,
    playKey: null,
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setScale(s) { this.scale = s; return this; },
    setFlipX() { return this; },
    setTint() { return this; },
    setTexture() { return this; },
  };
  sprite.anims = {
    play(key) { sprite.playKey = key; return sprite.anims; },
    stop() {},
    timeScale: 1,
  };
  return sprite;
}

function makeSheetScene(sprite) {
  return {
    textures: { exists: () => true },
    add: { sprite: () => sprite },
  };
}

test('Rig sheet mode uses idle layout then walk layout when clips differ in frame size', () => {
  const sprite = makeSprite();
  const rig = new Rig(makeSheetScene(sprite), fakeChar(), 0);
  assert.ok(rig.sheetMode);
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);

  rig.animate(0.016, 'idle');
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);
  assert.strictEqual(sprite.playKey, 'char-testhero-idle');

  rig.animate(0.016, 'walk');
  assert.strictEqual(sprite.originY, sheets.clips.walk.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.clips.walk.visibleH);
  assert.strictEqual(sprite.playKey, 'char-testhero-walk');

  rig.animate(0.016, 'idle');
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);
});

test('Rig applies walk footY/visibleH even when the clip has no frameW/frameH', () => {
  const sprite = makeSprite();
  const charDef = fakeChar({
    idle: { count: 14, fps: 3.6, loop: true },
    walk: { count: 12, fps: 10, loop: true, footY: 0.91, visibleH: 500 },
  });
  const rig = new Rig(makeSheetScene(sprite), charDef, 0);
  rig.animate(0.016, 'walk');
  assert.strictEqual(sprite.originY, 0.91);
  assert.strictEqual(sprite.scale, 122 / 500);
  assert.strictEqual(sprite.playKey, 'char-testhero-walk');
});

test('Rig keeps the previous layout when a clip visibleH is invalid', () => {
  const sprite = makeSprite();
  const charDef = fakeChar({
    idle: { count: 14, fps: 3.6, loop: true },
    walk: { count: 12, fps: 10, loop: true, visibleH: 0 },
  });
  const rig = new Rig(makeSheetScene(sprite), charDef, 0);
  const prev = console.error;
  console.error = () => {};
  try {
    rig.animate(0.016, 'idle');
    rig.animate(0.016, 'walk');
  } finally {
    console.error = prev;
  }
  assert.strictEqual(sprite.originY, sheets.footY);
  assert.strictEqual(sprite.scale, 122 / sheets.visibleH);
  assert.strictEqual(sprite.playKey, 'char-testhero-walk');
});
