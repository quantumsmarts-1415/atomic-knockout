import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROSTER } from '../src/data/characters.js';
import { classifyRoster, fxFolder, moveSlug } from '../src/data/attackFx.js';
import { blackThreshold, contentSpan, fxFadeAlpha, fxFrameIndex, fxGameplayScale, keyNearBlack, lumaToAlpha, pixelsPerSource, rasterAlpha, sheetPlayOrder, sliceGrid, sliceHorizontal } from '../src/engine/fxArt.js';
import { fxPlacementHits, projectileHits } from '../src/engine/boxes.js';

test('every move has a folder, a type, and a score', () => {
  const rows = classifyRoster(ROSTER);
  assert.equal(rows.length, ROSTER.length * 4);
  const types = new Set(rows.map((row) => row.objectType));
  for (const type of ['projectile', 'thrown', 'beam', 'extend', 'area or burst', 'slash arc', 'shield']) {
    assert.equal(types.has(type), true, type);
  }
  for (const row of rows) {
    assert.equal(row.folder, fxFolder(row.fighterId, row.move));
    assert.match(row.folder, /^assets\/fx\/[a-z0-9-]+\/[a-z0-9-]+$/);
    assert.ok(row.width > 0 && row.height > 0, row.move);
    assert.ok(row.score >= 1 && row.score <= 5, row.move);
    assert.match(row.spec, /transparent PNG/i);
    assert.match(row.spec, /pointing right/i);
  }
  const hog = rows.find((row) => row.fighterId === 'hog' && row.move === 'Quicksilver Lash');
  assert.equal(hog.objectType, 'extend');
  assert.equal(moveSlug('Night-Glow Hook'), 'night-glow-hook');
  const wave = rows.find((row) => row.fighterId === 'helen' && row.move === 'Air Wave');
  assert.equal(wave.objectType, 'projectile');
  assert.equal(wave.family, 'wave');
  const bomb = rows.find((row) => row.fighterId === 'hydra' && row.move === 'Hydrogen Bomb');
  assert.equal(bomb.objectType, 'thrown');
});

test('alpha above half fills a hit mask and clear pixels do not', () => {
  const width = 20;
  const height = 10;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 3] = x < 10 ? 255 : 0;
    }
  }
  const mask = rasterAlpha({
    data, width, height, displayW: 20, displayH: 10, pivotX: 0.5, pivotY: 0.5,
  });
  assert.ok(mask.n >= 3);
  assert.ok(mask.minX < 0);
  assert.ok(mask.maxX <= 1);

  const clear = rasterAlpha({
    data: new Uint8ClampedArray(16), width: 2, height: 2, displayW: 10, displayH: 10, pivotX: 0.5, pivotY: 0.5,
  });
  assert.equal(clear.n, 0);
});

test('near-black pixels drop out of an additive hit mask', () => {
  const width = 8;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const o = i * 4;
    data[o] = x < 4 ? 4 : 255;
    data[o + 1] = x < 4 ? 4 : 220;
    data[o + 2] = x < 4 ? 4 : 80;
    data[o + 3] = 255;
  }
  const keyed = keyNearBlack(data, width, height, blackThreshold({ blend: 'add' }));
  let dark = 0;
  let bright = 0;
  for (let x = 0; x < width; x++) {
    const a = keyed[(x) * 4 + 3];
    if (x < 4) dark += a;
    else bright += a;
  }
  assert.equal(dark, 0);
  assert.ok(bright > 0);
  const mask = rasterAlpha({
    data: keyed, width, height, displayW: 40, displayH: 20, pivotX: 0.5, pivotY: 0.5,
  });
  assert.ok(mask.n > 0);
  assert.ok(mask.minX >= -2);
});

test('a grid sheet is row-major', () => {
  const width = 4;
  const height = 2;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data[i * 4] = i + 1;
  const bottomLeft = sliceGrid(data, width, height, 2, 2, 2);
  assert.equal(bottomLeft.width, 2);
  assert.equal(bottomLeft.height, 1);
  assert.equal(bottomLeft.data[0], 5);
  assert.equal(sliceGrid(data, width, height, 2, 2, 0).data[0], 1);
  assert.equal(sliceGrid(data, width, height, 2, 2, 1).data[0], 3);
  assert.equal(sliceGrid(data, width, height, 2, 2, 3).data[0], 7);
});

test('luminance alpha keeps mid-gray smoke and clears near-black', () => {
  const data = new Uint8ClampedArray(8);
  data.set([4, 4, 4, 255, 90, 70, 40, 255]);
  const out = lumaToAlpha(data, 2, 1, blackThreshold({ blend: 'add' }));
  assert.equal(out[3], 0);
  assert.ok(out[7] > 80 && out[7] < 255);
  assert.equal(out[4], 90);
  assert.equal(out[5], 70);
  assert.equal(out[6], 40);
});

test('visible pixels, not the canvas, set the on-screen size', () => {
  const height = 122;
  const span = contentSpan({ w: 653, h: 400 }, 'width');
  const px = pixelsPerSource(height, 1.5, span);
  assert.equal(span, 653);
  assert.ok(Math.abs(653 * px - height * 1.5) < 0.001);
  assert.ok(Math.abs(pixelsPerSource(height, 1.3, 1513) * 1513 - height * 1.3) < 0.001);
});

test('a puddle sheet plays 1, 2, 3, 4, 6, 5 and then fades', () => {
  const art = {
    frames: [0, 1, 2, 3, 4, 5],
    order: [0, 1, 2, 3, 5, 4],
    fps: 10,
    fadeAfter: true,
    fadeMs: 200,
  };
  assert.equal(fxFrameIndex(art, 0), 0);
  assert.equal(fxFrameIndex(art, 100), 1);
  assert.equal(fxFrameIndex(art, 200), 2);
  assert.equal(fxFrameIndex(art, 300), 3);
  assert.equal(fxFrameIndex(art, 400), 5);
  assert.equal(fxFrameIndex(art, 500), 4);
  assert.equal(fxFrameIndex(art, 900), 4);
  assert.equal(fxFadeAlpha(art, 600), 1);
  assert.equal(fxFadeAlpha(art, 700), 0.5);
  assert.equal(fxFadeAlpha(art, 800), 0);
});

test('a thermite sheet plays 1, 4, 2, 3', () => {
  const order = sheetPlayOrder('allen/thermite-burn');
  assert.deepStrictEqual(order, [0, 3, 1, 2]);
  const art = { frames: [0, 1, 2, 3], order, fps: 8 };
  assert.equal(fxFrameIndex(art, 0), 0);
  assert.equal(fxFrameIndex(art, 125), 3);
  assert.equal(fxFrameIndex(art, 250), 1);
  assert.equal(fxFrameIndex(art, 375), 2);
  assert.equal(fxFrameIndex(art, 500), 2);
});

test('flora sheets keep the jet, the coat flash, and both cascade sides', () => {
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/flora/${folder}/fx.json`, 'utf8'));
  const jet = read('pale-yellow-jet');
  assert.equal(jet.pivot, 'left');
  assert.equal(jet.blend, 'add');
  assert.equal(jet.hit, false);
  const coat = read('teflon-coat');
  assert.equal(coat.frames, 4);
  assert.equal(coat.releaseFlash, true);
  assert.equal(coat.loop, undefined);
  const cascade = read('radical-cascade');
  assert.equal(cascade.frames, 6);
  assert.equal(cascade.bothSides, true);
  assert.equal(cascade.pivot, 'left');
  assert.equal(cascade.crop, undefined);
  const jab = read('etching-jab');
  assert.equal(jab.anchor, 'contact');
});

test('a horizontal sheet splits into even frames', () => {
  const data = new Uint8ClampedArray(8 * 2 * 4);
  for (let x = 0; x < 8; x++) {
    data[x * 4] = x < 4 ? 10 : 200;
    data[x * 4 + 3] = 255;
  }
  const right = sliceHorizontal(data, 8, 1, 2, 1);
  assert.equal(right.width, 4);
  assert.equal(right.data[0], 200);
  assert.equal(sliceHorizontal(data, 8, 1, 2, 0).data[0], 10);
});

test('charged radius scales a supernova sprite from 1x to 2x', () => {
  const tap = { radius: 64, _baseRadius: 64, fxScale: 'radius' };
  const half = { radius: 96, _baseRadius: 64, fxScale: 'radius' };
  const full = { radius: 128, _baseRadius: 64, fxScale: 'radius' };
  assert.equal(fxGameplayScale(tap, null), 1);
  assert.equal(fxGameplayScale(half, { scaleWith: 'radius' }), 1.5);
  assert.equal(fxGameplayScale(full, { scaleWith: 'radius', scale: 1 }), 2);
  assert.equal(fxGameplayScale({ radius: 192, _baseRadius: 64, fxScale: 'radius' }, { scaleWith: 'radius' }), 3);
  assert.equal(fxGameplayScale({ radius: 80 }, null), 1);
});

test('a dropped-in mask hits the body it covers and misses when it is moved away', () => {
  const hog = {
    x: 200,
    y: 400,
    facing: 1,
    alive: true,
    state: 'idle',
    grounded: true,
    charDef: ROSTER.find((c) => c.id === 'hog'),
    bodyW: 40,
    bodyH: 90,
    scene: { simNow: 1000 },
    rig: { maskClip: 'idle', maskFrame: 0, _pose: { rot: 0, sx: 1, sy: 1, x: 0, y: 0 } },
  };
  hog.bodyH = hog.charDef.art.bodyH;
  hog.bodyW = hog.charDef.art.bodyW;
  const width = 40;
  const height = 40;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  const mask = rasterAlpha({
    data, width, height, displayW: 80, displayH: 80, pivotX: 0.5, pivotY: 0.5,
  });
  assert.equal(fxPlacementHits({ mask, x: hog.x, y: hog.y - 40, rot: 0, scale: 1 }, hog), true);
  assert.equal(fxPlacementHits({ mask, x: hog.x + 400, y: hog.y, rot: 0, scale: 1 }, hog), false);
  const shot = {
    gfx: { x: hog.x + 400, y: hog.y, rotation: 0 },
    move: { projectileRadius: 10, vfx: 'gust' },
    radius: 10,
    dead: false,
    fxMask: mask,
  };
  assert.equal(projectileHits(shot, hog), false);
  shot.gfx.x = hog.x;
  shot.gfx.y = hog.y - 30;
  assert.equal(projectileHits(shot, hog), true);
});
