import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROSTER } from '../src/data/characters.js';
import { classifyRoster, fxFolder, moveSlug } from '../src/data/attackFx.js';
import { auraFrame, blackThreshold, breakFrames, burnVisual, contentSpan, fadeLoopFrames, flareCover, flareEmbers, flareShower, fxFadeAlpha, fxFrameIndex, fxGameplayScale, fxShrink, keyNearBlack, lumaToAlpha, pixelsPerSource, rasterAlpha, sheetPlayOrder, shellFrame, sliceGrid, sliceHorizontal, tintToward, vacancySignFrame, vacancySignPoint } from '../src/engine/fxArt.js';
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

test('a puddle grows through frames 1-4 then the last frame shrinks and fades', () => {
  const art = {
    frames: [0, 1, 2, 3],
    fps: 10,
    fadeAfter: true,
    shrinkAfter: true,
    fadeMs: 200,
  };
  assert.equal(art.frames.length, 4);
  assert.equal(fxFrameIndex(art, 0), 0);
  assert.equal(fxFrameIndex(art, 100), 1);
  assert.equal(fxFrameIndex(art, 200), 2);
  assert.equal(fxFrameIndex(art, 300), 3);
  assert.equal(fxFrameIndex(art, 500), 3);
  assert.equal(fxFadeAlpha(art, 400), 1);
  assert.equal(fxShrink(art, 400), 1);
  assert.equal(fxFadeAlpha(art, 500), 0.5);
  assert.equal(fxShrink(art, 500), 0.5);
  assert.equal(fxFadeAlpha(art, 600), 0);
  assert.equal(fxShrink(art, 600), 0);
});

test('natalie puddle sits at her feet and the salt line mirrors', () => {
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/natalie/${folder}/fx.json`, 'utf8'));
  const lake = read('lake-drop');
  assert.equal(lake.file, 'lake-drop-explosion-anim.png');
  assert.equal(lake.frames, 24);
  assert.equal(lake.cols, 4);
  assert.equal(lake.rows, 6);
  assert.equal(lake.blend, 'screen');
  assert.equal(lake.luma, true);
  assert.equal(lake.loop, false);
  assert.equal(lake.scale, 1.25);
  assert.equal(lake.scaleWith, 'radius');
  assert.equal(lake.hit, false);
  assert.equal(lake.charge.blend, 'add');
  assert.equal(lake.charge.frames, 4);
  assert.equal(lake.charge.anchor, 'feet');
  assert.equal(lake.charge.pivot, 'bottom');
  assert.equal(lake.charge.shrinkAfter, true);
  assert.equal(lake.charge.fadeAfter, true);
  const fist = read('flame-fist');
  assert.equal(fist.anchor, 'fist');
  assert.equal(fist.pivot, 'right');
  assert.equal(fist.hit, false);
  assert.equal(fist.blend, 'add');
  const spikes = read('brine-burst');
  assert.equal(spikes.frames, 6);
  assert.equal(spikes.bothSides, true);
  assert.equal(spikes.pivot, 'bottom-left');
  assert.equal(spikes.anchor, 'ground');
  assert.equal(spikes.hit, false);
});

test('allen and silas sheets key solid metal and keep the break frames', () => {
  assert.equal(sheetPlayOrder('allen/thermite-burn'), null);
  assert.equal(blackThreshold({ blend: 'normal', black: 16 }), 16);
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/${folder}/fx.json`, 'utf8'));
  assert.equal(fs.existsSync('assets/fx/allen/oxide-skin/fx.json'), false);
  const whip = read('allen/power-line-whips');
  assert.equal(whip.blend, 'normal');
  assert.equal(whip.anchor, 'contact');
  assert.equal(whip.hit, false);
  const burn = read('allen/thermite-burn');
  assert.equal(burn.file, 'thermite-spray-anim.png');
  assert.equal(burn.frames, 24);
  assert.equal(burn.blend, 'add');
  assert.equal(burn.scale, 1.25);
  assert.equal(burn.pivot, 'left');
  assert.equal(burn.hit, false);
  assert.equal(burn.stretch, 'length');
  assert.equal(burn.cling.frames, 4);
  assert.equal(burn.cling.loop, true);
  assert.equal(fs.existsSync('assets/fx/allen/thermite-burn/thermite-spray-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/allen/thermite-burn/sheet.png'), true);
  const vortex = read('allen/turbine-vortex');
  assert.equal(vortex.cols, 3);
  assert.equal(vortex.rows, 2);
  assert.equal(vortex.frames, 6);
  assert.equal(vortex.blend, 'add');
  assert.equal(vortex.hit, false);
  const over = read('silas/overclock');
  assert.equal(over.cols, 3);
  assert.equal(over.rows, 2);
  assert.equal(over.anchor, 'aura');
  assert.equal(over.heatAt, 4);
  assert.equal(over.hit, false);
  const blade = read('silas/crystal-blade');
  assert.equal(blade.blend, 'normal');
  assert.equal(blade.anchor, 'contact');
  assert.equal(blade.hit, false);
  assert.equal(blade.shatter.file, 'shatter.png');
  assert.equal(blade.shatter.blend, 'normal');
  const pane = read('silas/silica-pane');
  assert.equal(pane.blend, 'normal');
  assert.equal(pane.holdAt, 0);
  assert.equal(pane.breakFrom, 2);
  assert.equal(pane.anchor, 'front');
  assert.equal(pane.hit, false);
  const surge = read('silas/binary-surge');
  assert.equal(surge.cols, 3);
  assert.equal(surge.rows, 2);
  assert.equal(surge.frames, 6);
  assert.equal(surge.hit, false);
  const shell = { frames: [0, 1, 2, 3], holdAt: 1, fps: 10 };
  assert.equal(shellFrame(shell, 0), 0);
  assert.equal(shellFrame(shell, 200), 1);
  assert.equal(shellFrame({ frames: [0, 1, 2, 3], holdAt: 0, fps: 10 }, 500), 0);
  assert.equal(auraFrame(6, 4, false, 0, 0), 0);
  assert.equal(auraFrame(6, 4, false, 0.5, 0), 2);
  assert.equal(auraFrame(6, 4, true, 1, 0), 4);
  assert.equal(auraFrame(6, 4, true, 1, 90), 5);
  assert.equal(auraFrame(6, 4, false, null, 0, 12), 0);
  const broken = breakFrames({ frames: ['a', 'b', 'c', 'd'], breakFrom: 2, fps: 10, blend: 'normal' });
  assert.deepStrictEqual(broken.frames, ['c', 'd']);
  const shards = breakFrames({ shatter: { frames: ['burst'] }, frames: ['blade'], breakFrom: 2 });
  assert.deepStrictEqual(shards.frames, ['burst']);
});

test('flora sheets keep the jet and both cascade sides', () => {
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/flora/${folder}/fx.json`, 'utf8'));
  const jet = read('pale-yellow-jet');
  assert.equal(jet.pivot, 'left');
  assert.equal(jet.blend, 'add');
  assert.equal(jet.hit, false);
  assert.equal(fs.existsSync('assets/fx/flora/teflon-coat/fx.json'), false);
  const cascade = read('radical-cascade');
  assert.equal(cascade.frames, 6);
  assert.equal(cascade.bothSides, true);
  assert.equal(cascade.pivot, 'left');
  assert.equal(cascade.crop, undefined);
  const jab = read('etching-jab');
  assert.equal(jab.anchor, 'contact');
});

test('neo tube rings run dim to bright and the sign flickers after the steady pair', () => {
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/neo/${folder}/fx.json`, 'utf8'));
  const tube = read('high-voltage-tube');
  assert.equal(tube.blend, 'add');
  assert.equal(tube.hit, false);
  assert.equal(tube.stretch, 'length');
  assert.equal(tube.fit, 'length');
  assert.equal(tube.pivot, 'left');
  assert.equal(tube.charge.frames, 7);
  assert.equal(tube.charge.anchor, 'body');
  assert.equal(fs.existsSync('assets/fx/neo/high-voltage-tube/object.png'), true);
  assert.equal(fs.existsSync('assets/fx/neo/high-voltage-tube/sheet.png'), true);
  const sign = read('no-vacancy');
  assert.equal(sign.frames, 4);
  assert.equal(sign.sign, true);
  assert.equal(sign.anchor, 'front');
  assert.equal(sign.hit, false);
  assert.equal(vacancySignFrame(4, 0, 0, 540), 0);
  assert.equal(vacancySignFrame(4, 180, 180, 540), 1);
  assert.equal(vacancySignFrame(4, 360, 360, 540), 0);
  assert.equal(vacancySignFrame(4, 540, 0, 540), 2);
  assert.equal(vacancySignFrame(4, 600, 70, 540), 3);
  assert.equal(vacancySignFrame(4, 700, 140, 540), 2);
  const at = vacancySignPoint(
    { x: 100, y: 400, facing: 1, bodyW: 40 },
    { pivotY: 1, frames: [{ displayH: 200 }] },
  );
  assert.equal(at.x, 136);
  assert.equal(at.y, 300);
  const staff = read('staff-crack');
  assert.equal(staff.anchor, 'contact');
  assert.equal(staff.hit, false);
  const flash = read('neon-flash');
  assert.equal(flash.file, 'neon-flash-burst-anim.png');
  assert.equal(flash.frames, 24);
  assert.equal(flash.blend, 'add');
  assert.equal(flash.scale, 1.25);
  assert.equal(flash.tint, '#ff5a2a');
  assert.ok(flash.tintAmount > 0.5);
  assert.equal(flash.hit, false);
  assert.equal(fs.existsSync('assets/fx/neo/neon-flash/neon-flash-burst-anim.png'), true);
});

test('maggie ribbon wraps then holds the guard, and the flare sits on contact', () => {
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/maggie/${folder}/fx.json`, 'utf8'));
  const aura = read('unquenchable');
  assert.equal(aura.blend, 'add');
  assert.equal(aura.hit, false);
  assert.equal(aura.spriteAura, true);
  assert.equal(aura.anchor, 'aura');
  assert.equal(aura.frames, 6);
  assert.equal(fs.existsSync('assets/fx/maggie/unquenchable/sheet.png'), true);
  assert.equal(fs.existsSync('assets/fx/maggie/unquenchable/texture.png'), true);
  const ribbon = read('ribbon-guard');
  assert.equal(ribbon.blend, 'add');
  assert.equal(ribbon.hit, false);
  assert.equal(ribbon.frames, 4);
  assert.equal(ribbon.guardAt, 2);
  assert.equal(ribbon.anchor, 'body');
  assert.equal(ribbon.ignite.file, 'ignite.png');
  assert.equal(fs.existsSync('assets/fx/maggie/ribbon-guard/ignite.png'), true);
  const frame = 1000 / 12;
  const guard = { frames: [0, 1, 2, 3], fps: 12, guardAt: 2, loop: true };
  assert.equal(fxFrameIndex(guard, 0), 0);
  assert.equal(fxFrameIndex(guard, frame), 1);
  assert.equal(fxFrameIndex(guard, frame * 2), 2);
  assert.equal(fxFrameIndex(guard, frame * 3), 3);
  assert.equal(fxFrameIndex(guard, frame * 4), 2);
  assert.equal(fxFrameIndex(guard, frame * 5), 3);
  const jab = read('flare-jab');
  assert.equal(jab.blend, 'add');
  assert.equal(jab.hit, false);
  assert.equal(jab.anchor, 'contact');
  const flare = read('blinding-flare');
  assert.equal(flare.file, 'blinding-flare-burst-anim.png');
  assert.equal(flare.frames, 24);
  assert.equal(flare.blend, 'add');
  assert.equal(flare.scale, 1.25);
  assert.equal(flare.loop, false);
  assert.equal(flare.hit, false);
  assert.equal(fs.existsSync('assets/fx/maggie/blinding-flare/blinding-flare-burst-anim.png'), true);
  assert.equal(flare.stars.frames, 4);
  assert.ok(flare.stars.squash > 0 && flare.stars.squash < 0.5);
  assert.equal(fs.existsSync('assets/fx/maggie/blinding-flare/stars.png'), true);
});

function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('phillip sheets keep the upright flare and the five-round tracer', () => {
  const read = (folder) => JSON.parse(fs.readFileSync(`assets/fx/phillip/${folder}/fx.json`, 'utf8'));
  const flare = read('phosphor-flare');
  assert.equal(flare.blend, 'add');
  assert.equal(flare.hit, false);
  assert.equal(flare.launch.file, 'launch.png');
  assert.equal(flare.launch.pivot, 'bottom');
  assert.equal(flare.ember.file, 'flare-ember-large-anim.png');
  assert.equal(flare.ember.frames, 24);
  assert.equal(flare.ember.loop, true);
  assert.equal(flare.ember.blend, 'add');
  assert.equal(flare.spark.file, 'flare-ember-small-anim.png');
  assert.equal(flare.spark.frames, 18);
  assert.equal(flare.spark.loop, true);
  assert.equal(flare.cinder.file, 'flare-ember-large.png');
  assert.equal(flare.mote.file, 'flare-ember-small.png');
  assert.equal(flare.puff.file, 'flare-smoke-puff-anim.png');
  assert.equal(flare.puff.loop, false);
  assert.equal(flare.puff.blend, 'screen');
  assert.equal(flare.puff.luma, true);
  assert.ok(flare.puff.scale > 1 && flare.puff.scale < 1.1);
  const launch = pngSize('assets/fx/phillip/phosphor-flare/launch.png');
  assert.ok(launch.height > launch.width * 1.5, `${launch.width}x${launch.height}`);
  assert.equal(pngSize('assets/fx/phillip/phosphor-flare/flare-ember-large-anim.png').width, 3132);
  assert.equal(pngSize('assets/fx/phillip/phosphor-flare/flare-ember-small-anim.png').width, 3150);
  assert.equal(pngSize('assets/fx/phillip/phosphor-flare/flare-smoke-puff-anim.png').height, 4092);
  const tap = flareShower({ rainSpread: 150, projectileLife: 650, rain: 5 });
  const full = flareShower({ rainSpread: 360, projectileLife: 650, rain: 5, _chargeFrac: 1 });
  assert.equal(tap.count, 10);
  assert.equal(full.count, 24);
  assert.ok(full.width > tap.width);
  assert.ok(Math.abs(tap.radius * 1.45 * 2 - tap.width / tap.rain) < 30);
  const laid = flareEmbers({ rainSpread: 360, projectileLife: 650, rain: 5, _chargeFrac: 1 }, 118, 7);
  assert.equal(laid.pieces.length, full.count);
  assert.equal(new Set(laid.pieces.map((p) => p.kind)).size, 4);
  assert.ok(laid.pieces.some((p) => p.smoke));
  for (const piece of laid.pieces) {
    const landed = piece.x + piece.vx * (laid.life / 1000);
    assert.ok(Math.abs(piece.x) <= laid.width / 2, piece.x);
    assert.ok(Math.abs(landed) <= laid.width / 2 + 8, landed);
  }
  const sheet = flareCover({ rainSpread: 150, projectileLife: 650 }, 118);
  assert.equal(sheet.width, 221);
  const tracers = read('tracers');
  assert.equal(tracers.blend, 'add');
  assert.equal(tracers.hit, false);
  assert.equal(tracers.pivot, 'right');
  assert.equal(tracers.muzzle.pivot, 'left');
  assert.equal(tracers.muzzle.file, 'muzzle.png');
  assert.equal(fs.existsSync('assets/fx/phillip/tracers/object.png'), true);
  assert.equal(fs.existsSync('assets/fx/phillip/tracers/muzzle.png'), true);
  assert.equal(fs.existsSync('assets/fx/phillip/red-phosphorus-form/fx.json'), false);
  const step = 1000 / 10;
  const formed = { frames: [0, 1, 2, 3], fps: 10, guardAt: 2, loop: true };
  assert.equal(fxFrameIndex(formed, 0), 0);
  assert.equal(fxFrameIndex(formed, step), 1);
  assert.equal(fxFrameIndex(formed, step * 2), 2);
  assert.equal(fxFrameIndex(formed, step * 3), 3);
  assert.equal(fxFrameIndex(formed, step * 4), 2);
  const wp = read('spontaneous-ignition');
  assert.equal(wp.hit, false);
  assert.equal(wp.impact.file, 'wp-burst-anim.png');
  assert.equal(wp.impact.frames, 24);
  assert.equal(wp.impact.blend, 'screen');
  assert.equal(wp.impact.luma, true);
  assert.equal(wp.impact.scale, 1.25);
  assert.equal(wp.cling.frames, 4);
  assert.equal(wp.cling.loop, true);
  assert.equal(fs.existsSync('assets/fx/phillip/spontaneous-ignition/wp-burst-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/phillip/spontaneous-ignition/sheet.png'), true);
  const cling = { frames: ['wp'] };
  const shared = { frames: ['fire'] };
  assert.equal(burnVisual(cling, shared), cling);
  assert.equal(burnVisual(null, shared), shared);
  assert.equal(burnVisual(null, null), null);
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

test('a looping sheet crossfades its tail into the first frame', () => {
  const px = (r) => {
    const data = new Uint8ClampedArray(4);
    data[0] = r;
    data[3] = 255;
    return { keyed: data, width: 1, height: 1 };
  };
  const slices = [px(0), px(100), px(200), px(255)];
  fadeLoopFrames(slices, 3);
  assert.equal(slices[0].keyed[0], 0);
  assert.equal(slices[1].keyed[0], 75);
  assert.equal(slices[2].keyed[0], 100);
  assert.equal(slices[3].keyed[0], 64);
  const [r, g] = tintToward(220, 160, 40, 0xff5a2a, 0.62);
  assert.ok(r > g, `${r},${g}`);
  assert.ok(g < 160);
  const mega = JSON.parse(fs.readFileSync('assets/fx/lillie/mega-discharge/fx.json', 'utf8'));
  assert.equal(mega.file, 'mega-discharge-peak-anim.png');
  assert.equal(mega.frames, 24);
  assert.equal(mega.blend, 'add');
  assert.equal(mega.scale, 1.25);
  assert.equal(mega.scaleWith, 'radius');
  assert.equal(mega.peak, undefined);
  const tornado = JSON.parse(fs.readFileSync('assets/fx/nitra/mini-tornado/fx.json', 'utf8'));
  assert.equal(tornado.projectile.file, 'tornado-anim.png');
  assert.equal(tornado.projectile.frames, 24);
  assert.equal(tornado.projectile.loop, true);
  assert.equal(tornado.projectile.loopFade, 3);
  assert.equal(tornado.projectile.scaleWith, 'shot');
  assert.equal(tornado.charge.file, 'grow.png');
  assert.equal(fs.existsSync('assets/fx/lillie/mega-discharge/mega-discharge-peak-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/nitra/mini-tornado/tornado-anim.png'), true);
});

test('push 2 flow sheets replace the batch 2 stills', () => {
  const expect = {
    'assets/fx/helen/air-wave/fx.json': { file: 'air-wave-anim.png', frames: 24, blend: 'add', fps: 9.796, luma: undefined },
    'assets/fx/sully/black-powder/fx.json': { file: 'black-powder-blast-anim.png', frames: 24, blend: 'screen', fps: 10.435, luma: true },
    'assets/fx/sully/volcanic-eruption/fx.json': { file: 'volcanic-eruption-anim.png', frames: 24, blend: 'add', fps: 11.321, luma: undefined },
    'assets/fx/chloe/gas-cloud/fx.json': { file: 'gas-cloud-anim.png', frames: 23, blend: 'screen', fps: 11.129, luma: true },
  };
  for (const [path, want] of Object.entries(expect)) {
    const meta = JSON.parse(fs.readFileSync(path, 'utf8'));
    assert.equal(meta.file, want.file);
    assert.equal(meta.frames, want.frames);
    assert.equal(meta.cols, 4);
    assert.equal(meta.rows, 6);
    assert.equal(meta.blend, want.blend);
    assert.equal(meta.fps, want.fps);
    assert.equal(meta.loop, false);
    assert.equal(meta.scale, 1.25);
    assert.equal(meta.luma, want.luma);
    assert.equal(meta.crop, undefined);
    assert.equal(meta.hit, false);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, want.file)), true);
  }
  const powder = JSON.parse(fs.readFileSync('assets/fx/sully/black-powder/fx.json', 'utf8'));
  assert.equal(powder.scaleWith, 'radius');
  const cloud = JSON.parse(fs.readFileSync('assets/fx/chloe/gas-cloud/fx.json', 'utf8'));
  assert.equal(cloud.anchor, 'ground');
});

test('flow sheets replace the still supernova and keep the charge scale', () => {
  const nova = JSON.parse(fs.readFileSync('assets/fx/hydra/supernova/fx.json', 'utf8'));
  assert.equal(nova.file, 'supernova-peak-anim.png');
  assert.equal(nova.frames, 24);
  assert.equal(nova.cols, 4);
  assert.equal(nova.rows, 6);
  assert.equal(nova.fps, 14.4);
  assert.equal(nova.blend, 'screen');
  assert.equal(nova.luma, true);
  assert.equal(nova.loop, false);
  assert.equal(nova.scale, 1.25);
  assert.equal(nova.scaleWith, 'radius');
  assert.equal(nova.peak, undefined);
  assert.equal(fs.existsSync('assets/fx/hydra/supernova/supernova-peak-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/natalie/lake-drop/lake-drop-explosion-anim.png'), true);
});

test('charged radius scales a supernova sprite from 1x to 2x', () => {
  const tap = { radius: 64, _baseRadius: 64, fxScale: 'radius' };
  const half = { radius: 96, _baseRadius: 64, fxScale: 'radius' };
  const full = { radius: 128, _baseRadius: 64, fxScale: 'radius' };
  assert.equal(fxGameplayScale(tap, null), 1);
  assert.equal(fxGameplayScale(half, { scaleWith: 'radius' }), 1.5);
  assert.equal(fxGameplayScale(full, { scaleWith: 'radius', scale: 1 }), 2);
  assert.equal(fxGameplayScale(full, { scaleWith: 'radius', scale: 1.25 }), 2.5);
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
