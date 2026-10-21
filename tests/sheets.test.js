import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { createRequire } from 'node:module';
import fs from 'node:fs';

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
  fitSheetGrid,
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

test('fitSheetGrid packs a 12-frame strip that is taller than the GPU limit', () => {
  const grid = fitSheetGrid(2272, 720, 12, 8192);
  assert.deepStrictEqual(grid, { cols: 3, rows: 4, width: 6816, height: 2880 });
});

test('fitSheetGrid returns null when a single cell exceeds the GPU limit', () => {
  assert.equal(fitSheetGrid(9000, 100, 2, 8192), null);
  assert.equal(fitSheetGrid(0, 720, 12, 8192), null);
});

test('allen attack sheet is taller than 8192 and still packs under that limit', () => {
  const buf = fs.readFileSync('art-src/gemini-test/sheets/allen_attack.png');
  assert.equal(buf.toString('ascii', 12, 16), 'IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(width, 2272);
  assert.ok(height > 8192);
  const grid = fitSheetGrid(width, 720, 12, 8192);
  assert.equal(grid.cols * grid.rows, 12);
  assert.ok(grid.width <= 8192 && grid.height <= 8192);
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
    bodyH: 668,
    displayScale: null,
  });
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, footY: 0.5, visibleH: 100 }),
    { footY: 0.5, visibleH: 100, bodyH: 100, displayScale: null },
  );
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, footY: 0.91 }),
    { footY: 0.91, visibleH: 668, bodyH: 668, displayScale: null },
  );
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { count: 8, frameW: 1074, frameH: 720 }),
    { footY: 0.9823, visibleH: 668, bodyH: 668, displayScale: null },
  );
});

test('clipDisplayLayout uses per-clip footY/visibleH when the clip has frameW/frameH', () => {
  assert.deepStrictEqual(clipDisplayLayout(sheets, sheets.clips.walk), {
    footY: 0.97,
    visibleH: 700,
    bodyH: 700,
    displayScale: null,
  });
});

test('a stored displayScale is the sprite scale for that clip', () => {
  assert.deepStrictEqual(
    clipDisplayLayout(sheets, { footY: 0.8, bodyH: 500, displayScale: 0.25 }),
    { footY: 0.8, visibleH: 500, bodyH: 500, displayScale: 0.25 },
  );
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

test('BootScene.preload queues portraits up front and sheets only for a playtest match', () => {
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
  assert.ok(images.some((l) => l.key === 'char-hydra'), 'title portrait queues');
  assert.ok(images.some((l) => l.key === 'char-natalie'), 'title partner portrait queues');
  assert.ok(!images.some((l) => l.key === 'char-silas'), 'the rest of the roster waits until it is picked');
  assert.ok(images.some((l) => l.key.endsWith('-thumb')), 'stage thumbnails queue');
  assert.ok(!images.some((l) => /-layer\d+$/.test(l.key)), 'full stage layers wait for the match');
  assert.equal(sheets.length, 0, 'fighter sheets wait until select or the match');

  loads.length = 0;
  const prev = globalThis.window;
  globalThis.window = { location: { search: '?playtest=hydra' } };
  try {
    scene.preload();
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
  const matchSheets = loads.filter((l) => l.type === 'spritesheet');
  assert.ok(matchSheets.some((l) => l.key === 'char-hydra-idle'), 'hydra idle sheet loads for that match');
  assert.ok(matchSheets.some((l) => l.key === 'char-hydra-walk'), 'hydra walk sheet loads for that match');
  assert.ok(matchSheets.every((l) => l.key.startsWith('char-hydra-')), 'a hydra playtest does not queue the rest of the roster');
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

test('Rig uses a stored displayScale instead of art.height / visibleH', () => {
  const sprite = makeSprite();
  const charDef = fakeChar({
    idle: { count: 14, fps: 3.6, loop: true, displayScale: 0.2, bodyH: 400 },
    walk: { count: 12, fps: 10, loop: true, footY: 0.9, bodyH: 300, displayScale: 0.4 },
  });
  const rig = new Rig(makeSheetScene(sprite), charDef, 0);
  assert.strictEqual(sprite.scale, 0.2);
  rig.animate(0.016, 'walk');
  assert.strictEqual(sprite.originY, 0.9);
  assert.strictEqual(sprite.scale, 0.4);
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

test('sprite-mode Rig keeps the fitted cutout scale across animate', () => {
  const sprite = makeSprite();
  sprite.height = 800;
  sprite.scaleX = 1;
  sprite.scaleY = 1;
  sprite.setScale = function setScale(x, y) {
    this.scaleX = x;
    this.scaleY = y ?? x;
    this.scale = x;
    return this;
  };
  const charDef = {
    id: 'cutout-hero',
    palettes: [{ name: 'Sky', skin: 0, body: 0, accent: 0, eye: 0 }],
    art: {
      key: 'char-cutout-hero',
      file: 'art-src/cutout-hero-cut.png',
      facing: 1,
      height: 124,
    },
    body: { headRadius: 10, torsoWidth: 10, torsoHeight: 10, armLength: 10, armWidth: 10, legLength: 10, legWidth: 10 },
  };
  const scene = {
    textures: { exists: (key) => key === 'char-cutout-hero' },
    add: { image: () => sprite, sprite: () => sprite },
  };
  const rig = new Rig(scene, charDef, 0);
  assert.ok(rig.spriteMode);
  assert.ok(Math.abs(sprite.scaleX - 124 / 800) < 1e-6);
  rig.baseScale = 1.05;
  rig.animate(0.016, 'idle');
  assert.ok(Math.abs(sprite.scaleX - 124 / 800) < 1e-6, `sprite scale stayed fitted, got ${sprite.scaleX}`);
  assert.ok(Math.abs(rig.scaleY - 1.05) < 1e-6);
});
