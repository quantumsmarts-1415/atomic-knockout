import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROSTER } from '../src/data/characters.js';
import { classifyRoster, fxFolder, moveSlug } from '../src/data/attackFx.js';
import { auraFrame, blackThreshold, breakFrames, burnVisual, contentSpan, fadeLoopFrames, flareCover, flareEmbers, flareShower, fxFadeAlpha, fxFrameIndex, fxGameplayScale, fxShrink, keyNearBlack, lumaToAlpha, pixelsPerSource, rasterAlpha, sheetPlayOrder, shellFrame, slashArtReplacesStroke, sliceGrid, sliceHorizontal, stageSpanSize, stepFxProjectile, tintToward, vacancySignFrame, vacancySignPoint } from '../src/engine/fxArt.js';
import { fxPlacementHits, projectileHits } from '../src/engine/boxes.js';
import { interceptHit } from '../src/engine/defense.js';

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
    'assets/fx/helen/air-wave/fx.json': { file: 'air-wave-anim.png', frames: 24, blend: 'add', fps: 14, luma: undefined },
    'assets/fx/sully/black-powder/fx.json': { file: 'black-powder-blast-anim.png', frames: 24, blend: 'screen', fps: 10.435, luma: true },
    'assets/fx/sully/volcanic-eruption/fx.json': { file: 'volcanic-eruption-anim.png', frames: 24, blend: 'add', fps: 11.321, luma: undefined },
    'assets/fx/chloe/gas-cloud/fx.json': { file: 'gas-cloud-anim.png', frames: 23, blend: 'screen', fps: 11.129, luma: true },
    'assets/fx/aaron/noble-discharge/fx.json': { file: 'noble-discharge-anim.png', frames: 24, blend: 'add', fps: 11.429, luma: undefined },
    'assets/fx/cal/slime-splash/fx.json': { file: 'quicklime-splash-anim.png', frames: 24, blend: 'screen', fps: 15, luma: true },
    'assets/fx/scarlett/afterburner/fx.json': { file: 'afterburner-plume-anim.png', frames: 24, blend: 'add', fps: 10.286, luma: undefined, loop: true },
  };
  for (const [path, want] of Object.entries(expect)) {
    const meta = JSON.parse(fs.readFileSync(path, 'utf8'));
    assert.equal(meta.file, want.file);
    assert.equal(meta.frames, want.frames);
    assert.equal(meta.cols, 4);
    assert.equal(meta.rows, 6);
    assert.equal(meta.blend, want.blend);
    assert.equal(meta.fps, want.fps);
    assert.equal(meta.loop, want.loop ?? false);
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
  const plume = JSON.parse(fs.readFileSync('assets/fx/scarlett/afterburner/fx.json', 'utf8'));
  assert.equal(plume.anchor, 'trail');
  assert.deepEqual(plume.order, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
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

test('gemini fx sheets replace the placeholder stills', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(rel, 'utf8'));
  const kyle = read('assets/fx/kyle/action-potential/fx.json');
  assert.equal(kyle.file, 'action-potential-pulse-anim.png');
  assert.equal(kyle.frames, 24);
  assert.equal(kyle.loop, false);
  assert.equal(kyle.blend, 'add');
  assert.equal(kyle.once, true);
  assert.equal(kyle.hit, false);
  assert.equal(kyle.spriteAura, undefined);
  const aaron = read('assets/fx/aaron/lazy-haymaker/fx.json');
  assert.equal(aaron.file, 'lazy-glow-aura-sheet.jpg');
  assert.equal(aaron.frames, 6);
  assert.equal(aaron.anchor, 'aura');
  assert.equal(aaron.blend, 'add');
  assert.equal(aaron.spriteAura, undefined);
  assert.equal(aaron.hit, false);
  const rocket = read('assets/fx/scarlett/micro-rocket/fx.json');
  assert.equal(rocket.projectile.file, 'micro-rocket.jpg');
  assert.equal(rocket.projectile.blend, 'normal');
  assert.equal(rocket.detonate.file, 'rocket-explosion-anim.png');
  assert.equal(rocket.detonate.frames, 24);
  assert.equal(rocket.detonate.loop, false);
  assert.equal(rocket.detonate.blend, 'add');
  assert.equal(rocket.detonate.smokeFrom, 18);
  assert.equal(rocket.detonate.anchor, 'point');
  assert.equal(rocket.hit, false);
  const ram = read('assets/fx/titan/titanium-ram/fx.json');
  assert.equal(ram.file, 'titanium-sparks-sheet.jpg');
  assert.equal(ram.frames, 4);
  assert.equal(ram.anchor, 'trail');
  assert.equal(ram.pivot, 'right');
  assert.equal(ram.releaseImpact, true);
  assert.equal(ram.impact.file, 'ram-impact-anim.png');
  assert.equal(ram.impact.frames, 24);
  assert.equal(ram.impact.loop, false);
  assert.equal(ram.hit, false);
  const jab = read('assets/fx/titan/lance-jab/fx.json');
  assert.equal(jab.blend, 'normal');
  assert.equal(jab.anchor, 'fist');
  assert.equal(jab.pivot, 'left');
  const lance = read('assets/fx/titan/aero-lance/fx.json');
  assert.equal(lance.projectile.blend, 'normal');
  assert.equal(lance.trail.file, 'lance-trail.jpg');
  assert.equal(lance.trail.blend, 'add');
  assert.equal(lance.trail.pivot, 'right');
  const redox = read('assets/fx/van/redox-flow/fx.json');
  assert.equal(redox.anchor, 'aura');
  assert.equal(redox.spriteAura, undefined);
  assert.equal(redox.frames, 4);
  assert.equal(redox.blend, 'add');
  const surge = read('assets/fx/van/prism-surge/fx.json');
  assert.equal(surge.frames, 4);
  assert.equal(surge.peak.file, 'prism-surge-burst-anim.png');
  assert.equal(surge.peak.frames, 24);
  assert.equal(surge.peak.loop, false);
  assert.equal(surge.peak.blend, 'add');
  assert.equal(surge.peakFrame, 1);
  const beam = read('assets/fx/chroma/ruby-laser/fx.json');
  assert.equal(beam.file, 'ruby-laser-beam-anim.png');
  assert.equal(beam.frames, 24);
  assert.equal(beam.loop, false);
  assert.equal(beam.stretch, 'length');
  assert.equal(beam.pivot, 'left');
  assert.equal(beam.charge.file, 'ruby-charge-glow.jpg');
  assert.equal(beam.charge.anchor, 'body');
  const shatter = read('assets/fx/chroma/prismatic-shatter/fx.json');
  assert.equal(shatter.file, 'prismatic-shatter-anim.png');
  assert.equal(shatter.frames, 22);
  assert.equal(shatter.fps, 24.444);
  assert.equal(shatter.loop, false);
  assert.equal(shatter.blend, 'add');
  assert.equal(shatter.fit, 'width');
  assert.equal(shatter.heightFrac, 1.3);
  const pop = read('assets/fx/manny/dry-cell-lob/fx.json');
  assert.equal(pop.projectile.blend, 'normal');
  assert.equal(pop.detonate.luma, true);
  assert.equal(pop.detonate.blend, 'normal');
  assert.equal(pop.detonate.anchor, 'point');
  const glob = read('assets/fx/manny/permanganate-splash/fx.json');
  assert.equal(glob.projectile.blend, 'normal');
  assert.equal(glob.detonate.file, 'permanganate-splash-anim.png');
  assert.equal(glob.detonate.frames, 24);
  assert.equal(glob.detonate.loop, false);
  assert.equal(glob.detonate.blend, 'screen');
  assert.equal(glob.stain.file, 'purple-stain-sheet.jpg');
  assert.equal(glob.stain.frames, 4);
  assert.equal(glob.stain.blend, 'normal');
  assert.equal(glob.stain.loop, true);
  assert.equal(glob.hit, false);
  const files = [
    kyle.file, aaron.file, rocket.projectile.file, rocket.detonate.file,
    ram.file, ram.impact.file, jab.file, lance.projectile.file, lance.trail.file,
    redox.file, 'alloy-fist-impact.jpg', surge.file, surge.peak.file,
    beam.file, beam.charge.file, 'chrome-edge-slash.jpg', shatter.file,
    glob.projectile.file, glob.detonate.file, glob.stain.file,
    pop.projectile.file, pop.detonate.file,
  ];
  const dirs = {
    'action-potential-pulse-anim.png': 'assets/fx/kyle/action-potential/',
    'lazy-glow-aura-sheet.jpg': 'assets/fx/aaron/lazy-haymaker/',
    'micro-rocket.jpg': 'assets/fx/scarlett/micro-rocket/',
    'rocket-explosion-anim.png': 'assets/fx/scarlett/micro-rocket/',
    'titanium-sparks-sheet.jpg': 'assets/fx/titan/titanium-ram/',
    'ram-impact-anim.png': 'assets/fx/titan/titanium-ram/',
    'titanium-lance.jpg': 'assets/fx/titan/lance-jab/',
    'lance-trail.jpg': 'assets/fx/titan/aero-lance/',
    'redox-flow-aura-sheet.jpg': 'assets/fx/van/redox-flow/',
    'alloy-fist-impact.jpg': 'assets/fx/van/alloy-fist/',
    'prism-surge-sheet.jpg': 'assets/fx/van/prism-surge/',
    'prism-surge-burst-anim.png': 'assets/fx/van/prism-surge/',
    'ruby-laser-beam-anim.png': 'assets/fx/chroma/ruby-laser/',
    'ruby-charge-glow.jpg': 'assets/fx/chroma/ruby-laser/',
    'chrome-edge-slash.jpg': 'assets/fx/chroma/chrome-edge/',
    'prismatic-shatter-anim.png': 'assets/fx/chroma/prismatic-shatter/',
    'permanganate-glob.jpg': 'assets/fx/manny/permanganate-splash/',
    'permanganate-splash-anim.png': 'assets/fx/manny/permanganate-splash/',
    'purple-stain-sheet.jpg': 'assets/fx/manny/permanganate-splash/',
    'dry-cell-battery.jpg': 'assets/fx/manny/dry-cell-lob/',
    'dry-cell-pop.jpg': 'assets/fx/manny/dry-cell-lob/',
  };
  for (const name of files) assert.equal(fs.existsSync(dirs[name] + name), true, name);
  assert.equal(fs.existsSync('assets/fx/titan/aero-lance/titanium-lance.jpg'), true);
});

test('a one-shot pulse keeps the size of the frame it is showing', () => {
  const seen = [];
  const p = {
    born: 0,
    fxFrames: ['a', 'b', 'c'],
    fxFps: 10,
    fxOnce: true,
    fxDisplayWs: [10, 20, 40],
    fxDisplayHs: [8, 16, 32],
    move: { roll: true, vx: 1 },
    vx: 1,
    gfx: {
      setTexture(key) { this.key = key; },
      setDisplaySize(w, h) { seen.push([this.key, w, h]); },
      rotation: 1,
      scaleX: 1,
      scaleY: 1,
      setScale(x, y) { this.scaleX = x; this.scaleY = y; },
    },
  };
  stepFxProjectile(p, 0);
  stepFxProjectile(p, 100);
  stepFxProjectile(p, 400);
  assert.deepEqual(seen, [['a', 10, 8], ['b', 20, 16], ['c', 40, 32]]);
  assert.equal(p.gfx.key, 'c');
  assert.equal(p.gfx.rotation, 0);
});

test('a falling meteorite keeps its painted orientation', () => {
  const p = {
    born: 0,
    fxFrames: ['rock'],
    fxFps: 8,
    fxAim: false,
    vx: -40,
    vy: 560,
    gfx: {
      key: 'rock',
      rotation: 1.2,
      scaleX: 2,
      scaleY: 3,
      setTexture() {},
      setDisplaySize() {},
      setScale(x, y) { this.scaleX = x; this.scaleY = y; },
    },
  };
  stepFxProjectile(p, 50);
  assert.equal(p.gfx.rotation, 0);
  assert.equal(p.gfx.scaleX, -2);
  assert.equal(p.gfx.scaleY, 3);
});

test('gemini fx call 1 wires fey, collin, and nick', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(rel, 'utf8'));
  const same = (a, b) => fs.readFileSync(a).equals(fs.readFileSync(b));
  const hammer = read('assets/fx/fey/forge-hammer/fx.json');
  assert.equal(hammer.file, 'forge-hammer-impact-anim.png');
  assert.equal(hammer.frames, 24);
  assert.equal(hammer.loop, false);
  assert.equal(hammer.blend, 'add');
  assert.equal(hammer.anchor, 'ground');
  assert.equal(hammer.pivot, 'bottom');
  assert.equal(hammer.hit, false);
  assert.equal(hammer.charge.file, 'blowtorch-flame-sheet.jpg');
  assert.equal(hammer.charge.frames, 4);
  assert.equal(hammer.charge.loop, true);
  assert.equal(hammer.charge.flip, true);
  assert.equal(hammer.charge.anchor, 'body');
  assert.equal(hammer.spriteAura, undefined);
  const iron = read('assets/fx/fey/cold-iron-cut/fx.json');
  assert.equal(iron.file, 'cold-iron-slash.jpg');
  assert.equal(iron.blend, 'add');
  assert.equal(iron.anchor, 'fist');
  assert.equal(iron.pivot, 'left');
  assert.equal(iron.hit, false);
  const field = read('assets/fx/fey/lodestone-guard/fx.json');
  assert.equal(field.file, 'lodestone-field-sheet.jpg');
  assert.equal(field.frames, 4);
  assert.equal(field.loop, true);
  assert.equal(field.anchor, 'body');
  assert.equal(field.blend, 'add');
  assert.equal(field.hit, false);
  assert.equal(field.spriteAura, undefined);
  const thermite = read('assets/fx/fey/thermite/fx.json');
  const allen = read('assets/fx/allen/thermite-burn/fx.json');
  assert.deepEqual(thermite, allen);
  assert.equal(thermite.file, 'thermite-spray-anim.png');
  assert.equal(thermite.blend, 'add');
  assert.equal(thermite.hit, false);
  assert.equal(thermite.cling.file, 'sheet.png');
  assert.equal(same('assets/fx/fey/thermite/thermite-spray-anim.png', 'assets/fx/allen/thermite-burn/thermite-spray-anim.png'), true);
  assert.equal(same('assets/fx/fey/thermite/sheet.png', 'assets/fx/allen/thermite-burn/sheet.png'), true);
  assert.equal(same('assets/fx/fey/thermite/object.png', 'assets/fx/allen/thermite-burn/object.png'), true);
  const gamma = read('assets/fx/collin/gamma-knife/fx.json');
  assert.equal(gamma.file, 'gamma-knife-arc-anim.png');
  assert.equal(gamma.frames, 24);
  assert.equal(gamma.loop, false);
  assert.equal(gamma.blend, 'add');
  assert.equal(gamma.stretch, 'length');
  assert.equal(gamma.pivot, 'left');
  assert.equal(gamma.hit, false);
  assert.equal(gamma.charge.file, 'gamma-charge-glow.jpg');
  assert.equal(gamma.charge.anchor, 'body');
  const kobold = read('assets/fx/collin/kobold-strike/fx.json');
  assert.equal(kobold.blend, 'add');
  assert.equal(kobold.anchor, 'ground');
  assert.equal(kobold.hit, false);
  assert.equal(fs.existsSync('assets/fx/collin/superalloy-shell/fx.json'), false);
  const glaze = read('assets/fx/collin/blue-glaze/fx.json');
  assert.equal(glaze.projectile.file, 'blue-glaze-glob.jpg');
  assert.equal(glaze.projectile.blend, 'normal');
  assert.equal(glaze.detonate.file, 'blue-glaze-splash.jpg');
  assert.equal(glaze.detonate.blend, 'add');
  assert.equal(glaze.detonate.anchor, 'point');
  assert.equal(glaze.hit, false);
  const snap = read('assets/fx/nick/memory-snap/fx.json');
  assert.equal(snap.file, 'memory-snap-burst.jpg');
  assert.equal(snap.blend, 'add');
  assert.equal(snap.pivot, 'left');
  assert.equal(snap.flip, true);
  assert.equal(snap.hit, false);
  const coin = read('assets/fx/nick/nickel-and-dime/fx.json');
  assert.equal(coin.projectile.file, 'coin-spin-sheet.jpg');
  assert.equal(coin.projectile.frames, 4);
  assert.equal(coin.projectile.loop, true);
  assert.equal(coin.projectile.blend, 'normal');
  assert.equal(coin.hit, false);
  assert.equal(fs.existsSync('assets/fx/nick/electroplate/fx.json'), false);
  const meteor = read('assets/fx/nick/meteorite-drop/fx.json');
  assert.equal(meteor.projectile.file, 'meteorite-anim.png');
  assert.equal(meteor.projectile.frames, 23);
  assert.equal(meteor.projectile.loop, false);
  assert.equal(meteor.projectile.once, true);
  assert.equal(meteor.projectile.blend, 'normal');
  assert.equal(meteor.projectile.aim, false);
  assert.equal(meteor.projectile.heightFrac, 0.85);
  assert.equal(meteor.detonate.file, 'meteor-impact-anim.png');
  assert.equal(meteor.detonate.frames, 24);
  assert.equal(meteor.detonate.loop, false);
  assert.equal(meteor.detonate.blend, 'add');
  assert.equal(meteor.detonate.smokeFrom, 19);
  assert.equal(meteor.detonate.anchor, 'ground');
  assert.equal(meteor.detonate.pivot, 'bottom');
  assert.equal(meteor.detonate.heightFrac, 2.1);
  assert.equal(meteor.hit, false);
  const files = [
    [hammer.file, 'assets/fx/fey/forge-hammer/'],
    [hammer.charge.file, 'assets/fx/fey/forge-hammer/'],
    [iron.file, 'assets/fx/fey/cold-iron-cut/'],
    [field.file, 'assets/fx/fey/lodestone-guard/'],
    [gamma.file, 'assets/fx/collin/gamma-knife/'],
    [gamma.charge.file, 'assets/fx/collin/gamma-knife/'],
    [kobold.file, 'assets/fx/collin/kobold-strike/'],
    [glaze.projectile.file, 'assets/fx/collin/blue-glaze/'],
    [glaze.detonate.file, 'assets/fx/collin/blue-glaze/'],
    [snap.file, 'assets/fx/nick/memory-snap/'],
    [coin.projectile.file, 'assets/fx/nick/nickel-and-dime/'],
    [meteor.projectile.file, 'assets/fx/nick/meteorite-drop/'],
    [meteor.detonate.file, 'assets/fx/nick/meteorite-drop/'],
  ];
  for (const [name, dir] of files) assert.equal(fs.existsSync(dir + name), true, name);
});

test('gemini fx wires cooper and zane', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(rel, 'utf8'));
  const tesla = read('assets/fx/cooper/tesla-coil/fx.json');
  assert.equal(tesla.file, 'tesla-coil-arcs-anim.png');
  assert.equal(tesla.frames, 24);
  assert.equal(tesla.loop, false);
  assert.equal(tesla.blend, 'add');
  assert.equal(tesla.hit, false);
  assert.equal(tesla.charge.file, 'tesla-coil-arcs-anim.png');
  assert.equal(tesla.charge.frames, 24);
  assert.equal(tesla.charge.loop, true);
  assert.equal(tesla.charge.anchor, 'body');
  assert.equal(tesla.charge.blend, 'add');
  const wire = read('assets/fx/cooper/live-wire/fx.json');
  assert.equal(wire.file, 'live-wire-whip-sheet.jpg');
  assert.equal(wire.frames, 4);
  assert.equal(wire.blend, 'normal');
  assert.equal(wire.pivot, 'left');
  assert.equal(wire.anchor, 'fist');
  assert.equal(wire.hit, false);
  const rod = read('assets/fx/cooper/grounding-rod/fx.json');
  assert.equal(rod.file, 'grounding-sparks-sheet.jpg');
  assert.equal(rod.frames, 4);
  assert.equal(rod.loop, true);
  assert.equal(rod.blend, 'add');
  assert.equal(rod.anchor, 'ground');
  assert.equal(rod.pivot, 'bottom');
  assert.equal(rod.hit, false);
  const sword = read('assets/fx/cooper/bronze-sword/fx.json');
  assert.equal(sword.file, 'bronze-sword-slash.jpg');
  assert.equal(sword.blend, 'add');
  assert.equal(sword.anchor, 'fist');
  assert.equal(sword.hit, false);
  const dip = read('assets/fx/zane/hot-dip-galvanize/fx.json');
  assert.equal(dip.file, 'molten-zinc-splash-anim.png');
  assert.equal(dip.frames, 24);
  assert.equal(dip.loop, false);
  assert.equal(dip.blend, 'normal');
  assert.equal(dip.luma, true);
  assert.equal(dip.hit, false);
  assert.equal(dip.bothSides, undefined);
  assert.equal(dip.charge.file, 'zinc-kettle-sheet.jpg');
  assert.equal(dip.charge.frames, 4);
  assert.equal(dip.charge.loop, true);
  assert.equal(dip.charge.anchor, 'feet');
  assert.equal(dip.charge.pivot, 'bottom');
  assert.equal(dip.charge.blend, 'add');
  const brass = read('assets/fx/zane/brass-knuckles/fx.json');
  assert.equal(brass.blend, 'add');
  assert.equal(brass.anchor, 'fist');
  assert.equal(brass.hit, false);
  const anode = read('assets/fx/zane/sacrificial-anode/fx.json');
  assert.equal(anode.file, 'anode-absorb-burst.jpg');
  assert.equal(anode.blend, 'normal');
  assert.equal(anode.hit, false);
  assert.equal(anode.spriteAura, undefined);
  const fume = read('assets/fx/zane/fume-fever/fx.json');
  assert.equal(fume.file, 'fume-fever-cloud.jpg');
  assert.equal(fume.blend, 'screen');
  assert.equal(fume.luma, true);
  assert.equal(fume.anchor, 'ground');
  assert.equal(fume.hit, false);
  const files = [
    [tesla.file, 'assets/fx/cooper/tesla-coil/'],
    [wire.file, 'assets/fx/cooper/live-wire/'],
    [rod.file, 'assets/fx/cooper/grounding-rod/'],
    [sword.file, 'assets/fx/cooper/bronze-sword/'],
    [dip.file, 'assets/fx/zane/hot-dip-galvanize/'],
    [dip.charge.file, 'assets/fx/zane/hot-dip-galvanize/'],
    [brass.file, 'assets/fx/zane/brass-knuckles/'],
    [anode.file, 'assets/fx/zane/sacrificial-anode/'],
    [fume.file, 'assets/fx/zane/fume-fever/'],
  ];
  for (const [name, dir] of files) assert.equal(fs.existsSync(dir + name), true, name);
  const guard = {
    state: 'defending',
    defenseMove: { name: 'Sacrificial Anode', absorbTypes: ['chemical', 'electrical'] },
    x: 0,
    y: 0,
  };
  const absorbed = interceptHit(guard, { x: 40 }, { type: 'electrical', damage: 6 }, 0);
  assert.equal(absorbed.result, 'negate');
  assert.equal(absorbed.endDefense, true);
  assert.equal(absorbed.absorb, true);
  const kinetic = interceptHit(guard, { x: 40 }, { type: 'kinetic', damage: 6 }, 0);
  assert.equal(kinetic.absorb, undefined);
});

test('gemini fx wires gail and gertrude', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(rel, 'utf8'));
  assert.equal(moveSlug("Mendeleev's Prediction"), 'mendeleev-s-prediction');
  const arc = read('assets/fx/gail/superconductor-arc/fx.json');
  assert.equal(arc.file, 'superconductor-arcs-anim.png');
  assert.equal(arc.frames, 24);
  assert.equal(arc.loop, false);
  assert.equal(arc.lifeMs, undefined);
  assert.equal(arc.blend, 'add');
  assert.equal(arc.hit, false);
  assert.equal(arc.charge.file, 'superconductor-arcs-anim.png');
  assert.equal(arc.charge.anchor, 'body');
  assert.equal(arc.charge.loop, true);
  assert.equal(arc.charge.blend, 'add');
  const seep = read('assets/fx/gail/embrittle/fx.json');
  assert.equal(seep.file, 'gallium-seep-sheet.jpg');
  assert.equal(seep.blend, 'normal');
  assert.equal(seep.pivot, 'top');
  assert.equal(seep.anchor, 'fist');
  assert.equal(seep.hit, false);
  assert.equal(seep.cling.file, 'gallium-seep-sheet.jpg');
  assert.equal(seep.cling.blend, 'normal');
  assert.equal(seep.cling.loop, true);
  const melt = read('assets/fx/gail/melt-down/fx.json');
  assert.equal(melt.file, 'melt-puddle-sheet.jpg');
  assert.equal(melt.frames, 6);
  assert.equal(melt.blend, 'normal');
  assert.equal(melt.anchor, 'ground');
  assert.equal(melt.pivot, 'bottom');
  assert.equal(melt.puddle, true);
  assert.equal(melt.holdAt, 3);
  assert.equal(melt.breakFrom, 4);
  assert.equal(melt.hit, false);
  const led = read('assets/fx/gail/blue-led/fx.json');
  assert.equal(led.file, 'blue-led-beam-anim.png');
  assert.equal(led.frames, 23);
  assert.equal(led.loop, false);
  assert.equal(led.blend, 'add');
  assert.equal(led.fit, 'length');
  assert.equal(led.stretch, 'length');
  assert.equal(led.pivot, 'left');
  assert.equal(led.hit, false);
  const predict = read('assets/fx/gertrude/mendeleev-s-prediction/fx.json');
  assert.equal(predict.file, 'prediction-strike-anim.png');
  assert.equal(predict.frames, 24);
  assert.equal(predict.loop, false);
  assert.equal(predict.blend, 'add');
  assert.equal(predict.pivot, 'bottom');
  assert.equal(predict.hit, false);
  assert.equal(predict.charge.file, 'prediction-marker-sheet.jpg');
  assert.equal(predict.charge.frames, 4);
  assert.equal(predict.charge.loop, true);
  assert.equal(predict.charge.anchor, 'predict');
  const jab = read('assets/fx/gertrude/point-contact/fx.json');
  assert.equal(jab.blend, 'add');
  assert.equal(jab.anchor, 'fist');
  assert.equal(jab.hit, false);
  const gate = read('assets/fx/gertrude/transistor-gate/fx.json');
  assert.equal(gate.file, 'transistor-gate-sheet.jpg');
  assert.equal(gate.frames, 4);
  assert.equal(gate.loop, false);
  assert.equal(gate.blend, 'add');
  assert.equal(gate.anchor, 'body');
  assert.equal(gate.hit, false);
  assert.equal(gate.spriteAura, undefined);
  const wave = read('assets/fx/gertrude/crystal-radio-wave/fx.json');
  assert.equal(wave.projectile.file, 'radio-wave-sheet.jpg');
  assert.equal(wave.projectile.frames, 4);
  assert.equal(wave.projectile.loop, true);
  assert.equal(wave.projectile.blend, 'add');
  assert.equal(wave.hit, false);
  assert.equal(fs.existsSync('assets/fx/gertrude/thermal-lens/fx.json'), false);
  const files = [
    [arc.file, 'assets/fx/gail/superconductor-arc/'],
    [seep.file, 'assets/fx/gail/embrittle/'],
    [seep.cling.file, 'assets/fx/gail/embrittle/'],
    [melt.file, 'assets/fx/gail/melt-down/'],
    [led.file, 'assets/fx/gail/blue-led/'],
    [predict.file, 'assets/fx/gertrude/mendeleev-s-prediction/'],
    [predict.charge.file, 'assets/fx/gertrude/mendeleev-s-prediction/'],
    [jab.file, 'assets/fx/gertrude/point-contact/'],
    [gate.file, 'assets/fx/gertrude/transistor-gate/'],
    [wave.projectile.file, 'assets/fx/gertrude/crystal-radio-wave/'],
  ];
  for (const [name, dir] of files) assert.equal(fs.existsSync(dir + name), true, name);
  const risen = breakFrames({ frames: ['a', 'b', 'c', 'd', 'e', 'f'], breakFrom: 4, fps: 8, blend: 'normal' });
  assert.deepEqual(risen.frames, ['e', 'f']);
});

test('gemini fx wires arsenio and selena', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(rel, 'utf8'));
  assert.equal(moveSlug('Gray Arsenic Shards'), 'gray-arsenic-shards');
  assert.equal(moveSlug('Paris Green Slash'), 'paris-green-slash');
  const powder = read('assets/fx/arsenio/inheritance-powder/fx.json');
  assert.equal(powder.projectile.file, 'inheritance-powder-puff.jpg');
  assert.equal(powder.projectile.blend, 'screen');
  assert.equal(powder.projectile.luma, true);
  assert.equal(powder.projectile.aim, false);
  assert.equal(powder.hit, false);
  const slash = read('assets/fx/arsenio/paris-green-slash/fx.json');
  assert.equal(slash.file, 'paris-green-slash.jpg');
  assert.equal(slash.blend, 'add');
  assert.equal(slash.anchor, 'fist');
  assert.equal(slash.hit, false);
  const vapor = read('assets/fx/arsenio/sublimate/fx.json');
  assert.equal(vapor.file, 'sublimate-vapor-sheet.jpg');
  assert.equal(vapor.frames, 4);
  assert.equal(vapor.blend, 'screen');
  assert.equal(vapor.luma, true);
  assert.equal(vapor.anchor, 'body');
  assert.equal(vapor.holdAt, 2);
  assert.equal(vapor.breakFrom, 3);
  assert.equal(vapor.ghost, 0.18);
  assert.equal(vapor.hit, false);
  assert.equal(vapor.burst.file, 'sublimate-counter-burst.jpg');
  assert.equal(vapor.burst.blend, 'normal');
  const shards = read('assets/fx/arsenio/gray-arsenic-shards/fx.json');
  assert.equal(shards.projectile.file, 'arsenic-shard.jpg');
  assert.equal(shards.projectile.blend, 'normal');
  assert.equal(shards.projectile.aim, undefined);
  assert.equal(shards.hit, false);
  assert.equal(shards.detonate.file, 'arsenic-shatter.jpg');
  assert.equal(shards.detonate.blend, 'normal');
  assert.equal(shards.detonate.anchor, 'point');
  const poison = read('assets/fx/status/poison/fx.json');
  assert.equal(poison.file, 'poison-status-sheet.jpg');
  assert.equal(poison.frames, 4);
  assert.equal(poison.loop, true);
  assert.equal(poison.blend, 'screen');
  assert.equal(poison.luma, true);
  assert.equal(poison.pivot, 'bottom');
  assert.equal(poison.anchor, 'feet');
  assert.equal(poison.hit, false);
  assert.equal(fs.existsSync('assets/fx/status/poison/poison-status-sheet.jpg'), true);
  assert.equal(fs.existsSync('assets/fx/arsenio/gray-arsenic-shards/poison-status-sheet.jpg'), false);
  const bolt = read('assets/fx/selena/photoconductor/fx.json');
  assert.equal(bolt.file, 'photoconductor-lightning-anim.png');
  assert.equal(bolt.frames, 23);
  assert.equal(bolt.loop, false);
  assert.equal(bolt.blend, 'add');
  assert.equal(bolt.fit, 'length');
  assert.equal(bolt.stretch, 'length');
  assert.equal(bolt.pivot, 'left');
  assert.equal(bolt.hit, false);
  assert.equal(bolt.charge.file, 'light-soak-anim.png');
  assert.equal(bolt.charge.frames, 24);
  assert.equal(bolt.charge.cols, 3);
  assert.equal(bolt.charge.rows, 8);
  assert.equal(bolt.charge.loop, true);
  assert.equal(bolt.charge.blend, 'add');
  assert.equal(bolt.charge.anchor, 'body');
  assert.equal(bolt.charge.spans, undefined);
  const kick = read('assets/fx/selena/crescent-kick/fx.json');
  assert.equal(kick.file, 'crescent-kick-arc.jpg');
  assert.equal(kick.blend, 'add');
  assert.equal(kick.anchor, 'fist');
  assert.equal(kick.hit, false);
  const scan = read('assets/fx/selena/photocopy/fx.json');
  assert.equal(scan.file, 'photocopy-scan-sheet.jpg');
  assert.equal(scan.frames, 4);
  assert.equal(scan.loop, true);
  assert.equal(scan.blend, 'add');
  assert.equal(scan.span, 'cell');
  assert.equal(scan.crop, undefined);
  assert.equal(scan.anchor, 'body');
  assert.equal(scan.hit, false);
  const moon = read('assets/fx/selena/moonbeam/fx.json');
  assert.equal(moon.file, 'moonbeam-anim.png');
  assert.equal(moon.frames, 24);
  assert.equal(moon.loop, false);
  assert.equal(moon.blend, 'add');
  assert.equal(moon.fit, 'length');
  assert.equal(moon.stretch, 'length');
  assert.equal(moon.pivot, 'left');
  assert.equal(moon.hit, false);
  const stench = read('assets/fx/brock/bromos-stench/fx.json');
  assert.equal(stench.file, 'stench-fume-burst-anim.png');
  assert.equal(stench.frames, 24);
  assert.equal(stench.loop, false);
  assert.equal(stench.blend, 'screen');
  assert.equal(stench.fit, 'width');
  assert.equal(stench.heightFrac, 1.45);
  assert.equal(stench.pivot, 'center');
  assert.equal(stench.hit, false);
  const files = [
    [powder.projectile.file, 'assets/fx/arsenio/inheritance-powder/'],
    [slash.file, 'assets/fx/arsenio/paris-green-slash/'],
    [vapor.file, 'assets/fx/arsenio/sublimate/'],
    [vapor.burst.file, 'assets/fx/arsenio/sublimate/'],
    [shards.projectile.file, 'assets/fx/arsenio/gray-arsenic-shards/'],
    [shards.detonate.file, 'assets/fx/arsenio/gray-arsenic-shards/'],
    [poison.file, 'assets/fx/status/poison/'],
    [bolt.file, 'assets/fx/selena/photoconductor/'],
    [bolt.charge.file, 'assets/fx/selena/photoconductor/'],
    [kick.file, 'assets/fx/selena/crescent-kick/'],
    [scan.file, 'assets/fx/selena/photocopy/'],
    [moon.file, 'assets/fx/selena/moonbeam/'],
    [stench.file, 'assets/fx/brock/bromos-stench/'],
  ];
  for (const [name, dir] of files) assert.equal(fs.existsSync(dir + name), true, name);
  assert.equal(shellFrame({ frames: [0, 1, 2, 3], holdAt: 2, fps: 8 }, 500), 2);
  const cond = breakFrames({ frames: [0, 1, 2, 3], breakFrom: 3, fps: 8, blend: 'screen' });
  assert.deepEqual(cond.frames, [3]);
});

test('batch 2 wave 1 keeps the sheets the later flow art did not replace', () => {
  const read = (rel) => JSON.parse(fs.readFileSync(rel, 'utf8'));
  const rows = [
    ['assets/fx/helen/noble-gust/fx.json', null, 'add'],
    ['assets/fx/helen/bubble-shield/fx.json', null, 'screen'],
    ['assets/fx/helen/balloon-bop/fx.json', 'projectile', 'normal'],
    ['assets/fx/sully/brimstone-slam/fx.json', null, 'add'],
    ['assets/fx/chloe/bleach-out/fx.json', 'projectile', 'add'],
    ['assets/fx/chloe/toxic-jab/fx.json', null, 'screen'],
    ['assets/fx/chloe/salt-bond/fx.json', 'shatter', 'add'],
    ['assets/fx/status/on-fire-small/fx.json', null, 'add'],
    ['assets/fx/status/smoke-wisp/fx.json', null, 'screen'],
    ['assets/fx/aaron/inert-guard-strike/fx.json', null, 'screen'],
    ['assets/fx/aaron/shield-gas/fx.json', null, 'screen'],
    ['assets/fx/kyle/static-cross/fx.json', null, 'add'],
    ['assets/fx/kyle/ion-channel/fx.json', 'shatter', 'add'],
    ['assets/fx/kyle/banana-peel/fx.json', null, 'normal'],
    ['assets/fx/cal/bone-crush/fx.json', null, 'normal'],
    ['assets/fx/cal/quick-set-cement/fx.json', null, 'normal'],
  ];
  for (const [path, side, blend] of rows) {
    const meta = read(path);
    const spec = side ? meta[side] : meta;
    assert.equal(spec.blend, blend, path);
    const file = spec.file || (spec.frames > 1 ? 'sheet.png' : 'object.png');
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, file)), true, path);
  }
  const wave = read('assets/fx/helen/air-wave/fx.json');
  assert.equal(wave.file, 'air-wave-anim.png');
  assert.equal(wave.charge.file, 'sheet.png');
  assert.equal(wave.charge.frames, 6);
  const powder = read('assets/fx/sully/black-powder/fx.json');
  assert.equal(powder.file, 'black-powder-blast-anim.png');
  assert.equal(powder.charge.file, 'fuse.png');
  assert.equal(powder.charge.loop, true);
  const sulfur = read('assets/fx/sully/volcanic-eruption/fx.json').gas;
  assert.equal(sulfur.file, 'sulfur.png');
  assert.equal(sulfur.blend, 'screen');
  assert.equal(sulfur.luma, true);
  const pulse = read('assets/fx/kyle/action-potential/fx.json');
  assert.equal(pulse.file, 'action-potential-pulse-anim.png');
  assert.equal(pulse.frames, 24);
  assert.equal(pulse.loop, false);
  assert.equal(pulse.fizzle.file, 'fizzle.png');
  assert.equal(pulse.fizzle.blend, 'add');
  const cement = read('assets/fx/cal/quick-set-cement/fx.json');
  assert.equal(cement.holdAt, 3);
  assert.equal(cement.anchor, 'ground-front');
  assert.deepEqual(cement.linger.order, [0, 1, 2, 3, 2, 1]);
  const bubble = read('assets/fx/helen/bubble-shield/fx.json');
  assert.equal(bubble.holdAt, 1);
  assert.equal(bubble.breakFrom, 2);
  assert.equal(fs.existsSync('assets/fx/cal/calcify/fx.json'), false);
});

test('lucy pairs a blade with the slash and spans annihilation to the stage', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const city = read('assets/fx/lucy/city-of-light/fx.json');
  assert.equal(city.file, 'city-of-light-burst-anim.png');
  assert.equal(city.scaleWith, 'radius');
  assert.equal(city.blend, 'add');
  assert.equal(fs.existsSync('assets/fx/lucy/city-of-light/city-of-light-burst-anim.png'), true);
  const blade = read('assets/fx/lucy/final-lanthanide/fx.json');
  assert.equal(blade.keepSlash, true);
  assert.equal(blade.hit, false);
  assert.equal(blade.anchor, 'fist');
  const flash = read('assets/fx/lucy/scintillator/fx.json');
  assert.equal(flash.anchor, 'body');
  assert.equal(flash.loop, true);
  assert.equal(flash.hit, false);
  const rays = read('assets/fx/lucy/annihilation-pair/fx.json');
  assert.equal(rays.fit, 'stage');
  assert.equal(rays.hit, false);
  assert.equal(rays.cols, 2);
  assert.equal(rays.rows, 12);
  const art = { frames: [{}], objectType: 'slash arc', keepSlash: true };
  assert.equal(slashArtReplacesStroke(art), false);
  assert.equal(slashArtReplacesStroke({ frames: [{}], objectType: 'slash arc' }), true);
  const wide = stageSpanSize({ world: { width: 2560 } }, { displayW: 1280, displayH: 238 });
  assert.equal(wide.w, 2560);
  assert.ok(Math.abs(wide.h - 476) < 0.01);
  const normal = stageSpanSize({}, { displayW: 1280, displayH: 238 });
  assert.equal(normal.w, 1280);
  assert.equal(normal.h, 238);
});

test('sterling sheets scale the seeker down and loop the flare', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const seeker = read('assets/fx/sterling/bone-seeker/fx.json');
  assert.equal(seeker.file, 'bone-seeker-pulse-anim.png');
  assert.equal(seeker.frames, 24);
  assert.equal(seeker.fps, 13.043);
  assert.equal(seeker.once, true);
  assert.equal(seeker.heightFrac, 0.48);
  assert.equal(seeker.scale, 0.7);
  assert.equal(seeker.hit, false);
  assert.equal(fs.existsSync('assets/fx/sterling/bone-seeker/bone-seeker-pulse-anim.png'), true);
  const hook = read('assets/fx/sterling/night-glow-hook/fx.json');
  assert.equal(hook.anchor, 'contact');
  assert.equal(hook.oneshot, true);
  assert.equal(hook.hit, false);
  assert.equal(fs.existsSync('assets/fx/sterling/night-glow-hook/night-glow-hook-impact-anim.png'), true);
  const flare = read('assets/fx/sterling/road-flare/fx.json');
  assert.equal(flare.loop, true);
  assert.equal(flare.fps, 9.6);
  assert.equal(flare.anchor, 'front');
  assert.equal(fs.existsSync('assets/fx/sterling/road-flare/road-flare-burn-anim.png'), true);
  const rocket = read('assets/fx/sterling/crimson-rocket/fx.json');
  assert.equal(rocket.hit, false);
  assert.equal(rocket.projectile.file, 'crimson-rocket-burst-anim.png');
  assert.equal(rocket.projectile.frames, 22);
  assert.equal(rocket.projectile.fps, 11);
  assert.equal(rocket.projectile.once, true);
  assert.equal(rocket.projectile.heightFrac, 0.36);
  assert.equal(rocket.projectile.aim, false);
  assert.equal(rocket.detonate.file, 'crimson-rocket-burst-anim.png');
  assert.equal(rocket.detonate.frames, 22);
  assert.equal(rocket.detonate.loop, false);
  assert.equal(rocket.detonate.blend, 'add');
  assert.equal(rocket.detonate.heightFrac, 1.2);
  assert.equal(rocket.detonate.anchor, 'point');
  assert.equal(fs.existsSync('assets/fx/sterling/crimson-rocket/crimson-rocket-burst-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/sterling/crimson-rocket/crimson-rocket-burst-anim.gif'), false);
  const glow = read('assets/fx/sterling/night-glow-hook/fx.json');
  assert.equal(glow.cling.file, 'night-glow-status-anim.png');
  assert.equal(glow.cling.loop, true);
  assert.equal(glow.cling.fps, 12);
  assert.equal(glow.cling.anchor, 'body');
  assert.equal(glow.cling.heightFrac, 1);
  assert.equal(fs.existsSync('assets/fx/sterling/night-glow-hook/night-glow-status-anim.png'), true);
});

test('cody and ruth sheets keep the paint coat and the swap line apart', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const dot = read('assets/fx/cody/quantum-dot/fx.json');
  assert.equal(dot.loop, true);
  assert.equal(dot.fps, 9.6);
  assert.equal(dot.aim, false);
  assert.equal(dot.hit, false);
  const rods = read('assets/fx/cody/control-rod/fx.json');
  assert.equal(rods.loop, true);
  assert.equal(rods.anchor, 'body');
  assert.equal(rods.blend, 'normal');
  const paint = read('assets/fx/cody/yellow-paint-bomb/fx.json');
  assert.equal(paint.cling.file, 'paint-coat-status-anim.png');
  assert.equal(paint.cling.loop, true);
  assert.equal(paint.cling.blend, 'normal');
  assert.equal(paint.cling.black, false);
  assert.equal(paint.detonate.frames, 23);
  const line = read('assets/fx/ruth/metathesis-line/fx.json');
  assert.equal(line.file, 'metathesis-line-tile.png');
  assert.equal(fs.existsSync('assets/fx/ruth/metathesis-swap/fx.json'), true);
  assert.notEqual(line.file, read('assets/fx/ruth/metathesis-swap/fx.json').file);
  const crack = read('assets/fx/ruth/ammonia-crack/fx.json');
  assert.equal(crack.blend, 'screen');
  assert.equal(crack.pivot, 'left');
  const dye = read('assets/fx/ruth/sunlight-dye/fx.json');
  assert.equal(dye.stretch, 'length');
  assert.equal(dye.pivot, 'left');
});

test('tex sheets match the technetium handoff', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const burst = read('assets/fx/tex/metastable-flash/fx.json');
  assert.equal(burst.file, 'metastable-flash-burst-anim.png');
  assert.equal(burst.frames, 24);
  assert.equal(burst.fps, 13.2);
  assert.equal(burst.scaleWith, 'radius');
  assert.equal(burst.fit, 'height');
  assert.equal(burst.pivot, 'center');
  assert.equal(burst.hit, false);
  assert.equal(fs.existsSync('assets/fx/tex/metastable-flash/metastable-flash-burst-anim.png'), true);
  const lasso = read('assets/fx/tex/tracer-lasso/fx.json');
  assert.equal(lasso.file, 'tracer-lasso-whip-anim.png');
  assert.equal(lasso.fps, 13.714);
  assert.equal(lasso.pivot, 'left');
  assert.equal(lasso.oneshot, true);
  assert.equal(lasso.hit, false);
  assert.equal(fs.existsSync('assets/fx/tex/tracer-lasso/tracer-lasso-whip-anim.png'), true);
  const draw = read('assets/fx/tex/quick-draw/fx.json');
  assert.equal(draw.shatter.file, 'quick-draw-flash-anim.png');
  assert.equal(draw.shatter.fps, 12);
  assert.equal(draw.shatter.pivot, 'left');
  assert.equal(draw.hit, false);
  assert.equal(fs.existsSync('assets/fx/tex/quick-draw/quick-draw-flash-anim.png'), true);
  const flash = read('assets/fx/tex/gamma-camera/fx.json');
  assert.equal(flash.file, 'gamma-camera-flash-anim.png');
  assert.equal(flash.frames, 24);
  assert.equal(flash.cols, 4);
  assert.equal(flash.rows, 6);
  assert.equal(flash.fps, 13.395);
  assert.equal(flash.loop, false);
  assert.equal(flash.blend, 'add');
  assert.equal(flash.black, 24);
  assert.equal(flash.fit, 'stage');
  assert.equal(flash.pivot, 'left');
  assert.equal(flash.hit, false);
  assert.equal(fs.existsSync('assets/fx/tex/gamma-camera/gamma-camera-flash-anim.png'), true);
});
