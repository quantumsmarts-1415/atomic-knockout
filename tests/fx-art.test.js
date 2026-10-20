import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROSTER } from '../src/data/characters.js';
import { classifyRoster, fxFolder, moveSlug } from '../src/data/attackFx.js';
import { auraFrame, beamDrawScale, blackThreshold, breakFrames, burnVisual, chargeFrac, chargeTint, chargeWaveAlpha, cloudIgnitionScale, contentSpan, curieFade, curiePulse, fadeLoopFrames, flameTestColor, flareCover, flareEmbers, flareShower, fxFadeAlpha, fxFrameIndex, fxGameplayScale, fxShrink, handheldUnit, impactRadiusScale, keyNearBlack, lumaToAlpha, pixelsPerSource, pileCount, playsFinalImpact, pullFieldSize, rasterAlpha, reverseFrameOrder, rotorTurns, sheetPlayOrder, shellFrame, slashArtReplacesStroke, sliceGrid, sliceHorizontal, rodOrbitPoint, stackPipIndex, stageSpanSize, stepFxProjectile, stickAim, survivedPipAlpha, surgeAlpha, surgeBeamScale, throwGrowth, tintToward, trailBackOffset, vacancySignFrame, vacancySignPoint } from '../src/engine/fxArt.js';
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

test('niobe sheets keep the pulse full size and tessa only clings the cool shimmer', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const ring = read('assets/fx/niobe/particle-ring/fx.json');
  assert.equal(ring.file, 'particle-ring-beam-anim.png');
  assert.equal(ring.frames, 24);
  assert.equal(ring.fps, 12);
  assert.equal(ring.stretch, 'length');
  assert.equal(ring.pivot, 'left');
  assert.equal(ring.hit, false);
  assert.equal(ring.black, 24);
  assert.equal(fs.existsSync('assets/fx/niobe/particle-ring/particle-ring-beam-anim.png'), true);
  const edge = read('assets/fx/niobe/anodized-edge/fx.json');
  assert.equal(edge.frames, 23);
  assert.equal(edge.fps, 11.5);
  assert.equal(edge.oneshot, true);
  assert.equal(edge.anchor, 'contact');
  assert.equal(edge.hit, false);
  assert.equal(fs.existsSync('assets/fx/niobe/anodized-edge/anodized-edge-slash-anim.png'), true);
  const stone = read('assets/fx/niobe/weeping-stone/fx.json');
  assert.equal(stone.loop, true);
  assert.equal(stone.fps, 10.105);
  assert.equal(stone.blend, 'normal');
  assert.equal(stone.black, 24);
  assert.equal(stone.anchor, 'body');
  assert.equal(fs.existsSync('assets/fx/niobe/weeping-stone/weeping-stone-shell-anim.png'), true);
  const pulse = read('assets/fx/niobe/mri-pulse/fx.json');
  assert.equal(pulse.file, 'mri-pulse-wave-anim.png');
  assert.equal(pulse.frames, 24);
  assert.equal(pulse.fps, 12);
  assert.equal(pulse.stretch, 'length');
  assert.equal(pulse.fit, 'length');
  assert.equal(pulse.pivot, 'left');
  assert.equal(pulse.hit, false);
  assert.equal(pulse.scale, undefined);
  assert.equal(fs.existsSync('assets/fx/niobe/mri-pulse/mri-pulse-wave-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/niobe/mri-pulse/mri-pulse-wave-anim.gif'), false);
  const cool = read('assets/fx/tessa/peltier-punch/fx.json');
  assert.equal(cool.file, 'peltier-punch-impact-anim.png');
  assert.equal(cool.frames, 23);
  assert.equal(cool.cling.file, 'peltier-cool-status-anim.png');
  assert.equal(cool.cling.loop, true);
  assert.equal(cool.cling.fps, 12);
  assert.equal(cool.cling.anchor, 'body');
  assert.equal(cool.cling.heightFrac, 1);
  assert.equal(cool.cling.blend, 'add');
  assert.equal(fs.existsSync('assets/fx/tessa/peltier-punch/peltier-cool-status-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/tessa/peltier-punch/peltier-cool-status-anim.gif'), false);
  assert.equal(fs.existsSync('assets/fx/tessa/garlic-breath/fx.json'), true);
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

test('molly agatha indy and saab sheets match the batch handoffs', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const rod = read('assets/fx/molly/red-hot-rod/fx.json');
  assert.equal(rod.frames, 24);
  assert.equal(rod.fps, 12);
  assert.equal(rod.blend, 'add');
  assert.equal(rod.loop, false);
  assert.equal(rod.fit, 'length');
  assert.equal(rod.stretch, 'length');
  assert.equal(rod.pivot, 'left');
  const slide = read('assets/fx/molly/grease-slide/fx.json');
  assert.equal(slide.frames, 24);
  assert.equal(slide.fps, 12);
  assert.equal(slide.blend, 'normal');
  assert.equal(slide.loop, false);
  const lube = read('assets/fx/molly/dry-lube/fx.json');
  assert.equal(lube.frames, 24);
  assert.equal(lube.fps, 24);
  assert.equal(lube.blend, 'screen');
  assert.equal(lube.black, 64);
  assert.equal(lube.loop, true);
  assert.equal(lube.anchor, 'body');
  const enzyme = read('assets/fx/molly/nitrogenase/fx.json');
  assert.equal(enzyme.blend, 'screen');
  assert.equal(enzyme.loop, true);
  assert.equal(enzyme.fps, 24);
  const bullet = read('assets/fx/agatha/silver-bullet/fx.json');
  assert.equal(bullet.frames, 22);
  assert.equal(bullet.fps, 11);
  assert.equal(bullet.blend, 'normal');
  assert.equal(bullet.pivot, 'right');
  const slash = read('assets/fx/agatha/current-slash/fx.json');
  assert.equal(slash.frames, 24);
  assert.equal(slash.fps, 12);
  assert.equal(slash.blend, 'add');
  assert.equal(slash.oneshot, true);
  const flash = read('assets/fx/agatha/mirror-flash/fx.json');
  assert.equal(flash.frames, 24);
  assert.equal(flash.fps, 12);
  assert.equal(flash.blend, 'add');
  assert.equal(flash.heightFrac, 0.58);
  assert.equal(flash.maxAlpha, 0.45);
  const tarnish = read('assets/fx/agatha/tarnish-cloud/fx.json');
  assert.equal(tarnish.blend, 'normal');
  assert.equal(tarnish.loop, true);
  assert.equal(tarnish.fps, 24);
  const film = read('assets/fx/indy/invisible-film/fx.json');
  assert.equal(film.frames, 24);
  assert.equal(film.cols, 3);
  assert.equal(film.rows, 8);
  assert.equal(film.fps, 24);
  assert.equal(film.blend, 'add');
  assert.equal(film.loop, true);
  assert.equal(film.pivot, 'bottom');
  const seal = read('assets/fx/indy/sticky-seal/fx.json');
  assert.equal(seal.frames, 24);
  assert.equal(seal.fps, 12);
  assert.equal(seal.blend, 'add');
  assert.equal(seal.oneshot, true);
  const solder = read('assets/fx/indy/solder-whip/fx.json');
  assert.equal(solder.frames, 21);
  assert.equal(solder.cols, 3);
  assert.equal(solder.rows, 7);
  assert.equal(solder.fps, 10.5);
  assert.equal(solder.blend, 'add');
  assert.equal(fs.existsSync('assets/fx/indy/putty-guard/fx.json'), true);
  const shot = read('assets/fx/saab/sniper-round/fx.json');
  assert.equal(shot.frames, 22);
  assert.equal(shot.fps, 11);
  assert.equal(shot.blend, 'add');
  assert.equal(shot.charge.file, 'sniper-charge-stages.png');
  assert.equal(shot.charge.frames, 3);
  assert.equal(shot.charge.cols, 3);
  assert.equal(shot.charge.rows, 1);
  assert.equal(shot.charge.loop, false);
  assert.equal(shot.charge.pulse, 1);
  const dust = read('assets/fx/saab/toxic-dust-cloud/fx.json');
  assert.equal(dust.blend, 'screen');
  assert.equal(dust.fps, 12);
  assert.equal(dust.cling.file, 'toxic-cough-status-anim.png');
  assert.equal(dust.cling.frames, 24);
  assert.equal(dust.cling.cols, 6);
  assert.equal(dust.cling.rows, 4);
  assert.equal(dust.cling.fps, 12);
  assert.equal(dust.cling.loop, true);
  assert.equal(dust.cling.anchor, 'body');
  assert.equal(dust.cling.heightFrac, 1);
  const retardant = read('assets/fx/saab/flame-retardant/fx.json');
  assert.equal(retardant.loop, true);
  assert.equal(retardant.fps, 24);
  assert.equal(retardant.blend, 'screen');
  assert.equal(retardant.anchor, 'body');
  const needles = read('assets/fx/saab/stibnite-needles/fx.json');
  assert.equal(needles.frames, 24);
  assert.equal(needles.fps, 12);
  assert.equal(needles.blend, 'add');
  for (const id of ['molly', 'agatha', 'indy', 'saab']) {
    const root = `assets/fx/${id}`;
    for (const name of fs.readdirSync(root)) {
      const dir = `${root}/${name}`;
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        assert.equal(file.endsWith('.gif') || file.endsWith('.jpg'), false, `${dir}/${file}`);
        if (file.endsWith('.png')) assert.equal(fs.existsSync(`${dir}/${file}`), true);
      }
    }
  }
});

test('batch 11 sheets match the approved handoffs', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const tremor = read('assets/fx/tessa/tellus-tremor/fx.json');
  assert.equal(tremor.blend, 'normal');
  assert.equal(tremor.pivot, 'bottom');
  assert.equal(tremor.aim, false);
  assert.equal(tremor.loop, false);
  const phase = read('assets/fx/tessa/phase-rewrite/fx.json');
  assert.equal(phase.frames, 32);
  assert.equal(phase.fps, 6.68);
  assert.equal(phase.loop, true);
  assert.equal(phase.anchor, 'body');
  const pile = read('assets/fx/iona/touch-powder/fx.json');
  assert.equal(pile.file, 'touch-powder-pile.png');
  assert.equal(pile.black, false);
  assert.equal(pile.blend, 'normal');
  assert.equal(pile.burst.file, 'touch-powder-blast-anim.png');
  assert.equal(pile.burst.heightFrac, 0.58);
  assert.equal(pile.burst.maxAlpha, 0.45);
  const vapor = read('assets/fx/iona/violet-vapor/fx.json');
  assert.equal(vapor.blend, 'normal');
  assert.equal(vapor.aim, false);
  const tick = read('assets/fx/caesar/defining-second/fx.json');
  assert.equal(tick.heightFrac, 0.58);
  assert.equal(tick.maxAlpha, 0.45);
  assert.equal(tick.cling.file, 'time-freeze-status-anim.png');
  assert.equal(tick.cling.loop, true);
  const coin = read('assets/fx/caesar/fallout-coin/fx.json');
  assert.equal(coin.frames, 32);
  assert.equal(coin.fps, 6.45);
  assert.equal(coin.blend, 'normal');
  assert.equal(coin.loop, true);
  assert.equal(coin.stain.loop, true);
  const pellet = read('assets/fx/barry/poison-pellet/fx.json');
  assert.equal(pellet.projectile.loop, true);
  assert.equal(pellet.projectile.spin, 8);
  assert.equal(pellet.projectile.blend, 'normal');
  assert.equal(pellet.detonate.file, 'poison-pellet-cloud-anim.png');
  const strike = read('assets/fx/lana/hidden-strike/fx.json');
  assert.equal(strike.anchor, 'trail');
  assert.equal(strike.pivot, 'right');
  assert.equal(strike.pivotY, 0.701);
  const glow = read('assets/fx/lana/regenerative-charge/fx.json');
  assert.equal(glow.charge.anchor, 'body');
  assert.equal(glow.charge.loop, true);
  const putty = read('assets/fx/indy/putty-guard/fx.json');
  assert.equal(putty.blend, 'normal');
  assert.equal(putty.loop, true);
  assert.equal(putty.fps, 19.2);
  assert.equal(putty.anchor, 'body');
  for (const id of ['tessa', 'iona', 'xander', 'caesar', 'barry', 'lana']) {
    const root = `assets/fx/${id}`;
    for (const name of fs.readdirSync(root)) {
      const dir = `${root}/${name}`;
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        assert.equal(file.endsWith('.gif') || file.endsWith('.jpg'), false, `${dir}/${file}`);
      }
    }
  }
});

test('europa sheets match the approved handoff', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const check = read('assets/fx/europa/counterfeit-check/fx.json');
  assert.equal(check.impact.file, 'counterfeit-check-impact-anim.png');
  assert.equal(check.impact.frames, 24);
  assert.equal(check.impact.cols, 4);
  assert.equal(check.impact.rows, 6);
  assert.equal(check.impact.fps, 16);
  assert.equal(check.impact.blend, 'add');
  assert.equal(check.impact.hit, false);
  const crack = read('assets/fx/europa/icy-geyser/fx.json').warn;
  assert.equal(crack.file, 'icy-geyser-crack-anim.png');
  assert.equal(crack.loop, true);
  assert.equal(crack.frames, 24);
  assert.equal(crack.fps, 16);
  assert.ok(crack.scale >= 0.5 && crack.scale <= 0.7);
  assert.ok(Math.abs(crack.pivotX - 0.5) < 1e-6);
  assert.ok(Math.abs(crack.pivotY - 350 / 576) < 0.002);
  assert.equal(crack.crop, undefined);
  const plume = read('assets/fx/europa/icy-geyser/fx.json').burst;
  assert.equal(plume.file, 'icy-geyser-plume-anim.png');
  assert.equal(plume.pivot, 'bottom');
  assert.equal(plume.anchor, 'ground');
  assert.equal(plume.loop, false);
  const rods = read('assets/fx/europa/neutron-sponge/fx.json');
  assert.equal(rods.file, 'control-rod.png');
  assert.equal(rods.pivotX, 0.5);
  assert.equal(rods.pivotY, 0.5);
  assert.equal(rods.aim, false);
  assert.equal(rods.spin, 7);
  assert.equal(rods.black, false);
  assert.equal(rods.glow.file, 'control-rod-radiation.png');
  assert.equal(rods.glow.spin, 7);
  assert.equal(rods.glow.aim, false);
  const left = rodOrbitPoint({ x: 100, y: 200, bodyW: 40, bodyH: 80 }, 0, 0, { period: 1100, orbit: 1.05 });
  const right = rodOrbitPoint({ x: 100, y: 200, bodyW: 40, bodyH: 80 }, 0, 1, { period: 1100, orbit: 1.05 });
  assert.ok(left.x > 100);
  assert.ok(right.x < 100);
  assert.ok(Math.abs((left.y + right.y) / 2 - (200 - 40)) < 1);
  const root = 'assets/fx/europa';
  for (const name of fs.readdirSync(root)) {
    const dir = `${root}/${name}`;
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      assert.equal(file.endsWith('.gif') || file.endsWith('.jpg'), false, `${dir}/${file}`);
    }
  }
});

test('mri, palm, flex punch, and floor speaker match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const mri = read('assets/fx/goldie/mri-contrast/fx.json');
  assert.equal(mri.file, 'mri-scan-ring-anim.png');
  assert.equal(mri.frames, 16);
  assert.equal(mri.fps, 16);
  assert.equal(mri.scaleWith, 'radius');
  assert.equal(mri.span, 'cell');
  assert.equal(mri.hit, false);
  const cell = 480;
  const outer = 0.95 * (cell / 2);
  const shown = outer * ((132 * mri.heightFrac) / cell);
  assert.ok(Math.abs(shown - 78) < 1, `ring radius ${shown}`);
  assert.equal(mri.charge.anchor, 'hand');
  assert.equal(mri.charge.scaleWith, 'alpha');
  assert.equal(mri.charge.loop, true);
  assert.equal(mri.charge.fps, 12);
  assert.equal(mri.cling.file, 'mri-stun-status-anim.png');
  assert.equal(mri.cling.frames, 24);
  assert.equal(mri.cling.fps, 24);
  assert.equal(mri.cling.anchor, 'body');
  const palm = read('assets/fx/goldie/magnetocaloric-palm/fx.json').impact;
  assert.equal(palm.frames, 24);
  assert.equal(palm.fps, 16);
  assert.equal(palm.flip, true);
  assert.equal(palm.pivotX, 0.5);
  const flex = read('assets/fx/terra/flex-punch/fx.json').impact;
  assert.equal(flex.file, 'flex-punch-impact-anim.png');
  assert.equal(flex.flip, true);
  assert.equal(flex.frames, 24);
  const floor = read('assets/fx/terra/floor-speaker/fx.json');
  assert.equal(floor.file, 'floor-speaker-status-anim.png');
  assert.equal(floor.frames, 24);
  assert.equal(floor.fps, 12);
  assert.equal(floor.loop, true);
  assert.equal(floor.tile, true);
  assert.equal(floor.anchor, 'ground');
  assert.equal(floor.fit, 'pixel');
  assert.ok(Math.abs(floor.pivotY - (192 - 40) / 192) < 0.001);
});

test('haley cutter, kick, gate, and disc match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const cutter = read('assets/fx/haley/plasma-cutter/fx.json');
  assert.equal(cutter.file, 'plasma-cutter-slash-anim.png');
  assert.equal(cutter.frames, 12);
  assert.equal(cutter.fps, 24);
  assert.equal(cutter.loop, false);
  assert.equal(cutter.flip, true);
  assert.equal(cutter.oneshot, true);
  assert.ok(Math.abs(cutter.pivotX - 220 / 512) < 1e-6);
  assert.equal(cutter.charge.scaleWith, 'alpha');
  assert.equal(cutter.charge.anchor, 'body');
  assert.equal(cutter.charge.frames, 12);
  assert.equal(cutter.charge.fps, 24);
  const kick = read('assets/fx/haley/carbide-kick/fx.json');
  assert.equal(kick.file, undefined);
  assert.equal(kick.impact.frames, 24);
  assert.equal(kick.impact.fps, 16);
  assert.ok(kick.impact.scale >= 0.4 && kick.impact.scale <= 0.6);
  assert.ok(Math.abs(kick.impact.pivotX - 294 / 588) < 1e-6);
  assert.ok(Math.abs(kick.impact.pivotY - 291 / 576) < 1e-6);
  const gate = read('assets/fx/haley/high-k-gate/fx.json');
  assert.equal(gate.blend, 'normal');
  assert.equal(gate.black, false);
  assert.equal(gate.loop, true);
  assert.equal(gate.frames, 24);
  assert.equal(gate.fps, 12);
  assert.equal(gate.anchor, 'ground-front');
  assert.ok(Math.abs(gate.pivotY - 500 / 512) < 1e-6);
  assert.equal(gate.shatter.frames, 16);
  assert.equal(gate.shatter.fps, 24);
  assert.equal(gate.shatter.loop, false);
  assert.equal(gate.shatter.heightFrac, gate.heightFrac);
  assert.ok(Math.abs(gate.shatter.pivotY - gate.pivotY) < 1e-9);
  const disc = read('assets/fx/haley/neutron-sink/fx.json');
  assert.equal(disc.file, 'hafnium-disc.png');
  assert.equal(disc.black, false);
  assert.equal(disc.aim, false);
  assert.ok(Math.abs(disc.pivotX - 96 / 192) < 1e-6);
  assert.ok(Math.abs(disc.pivotY - 96 / 192) < 1e-6);
  assert.ok(disc.spin > Math.PI * 4 && disc.spin < Math.PI * 8);
  assert.equal(disc.cling.frames, 24);
  assert.equal(disc.cling.loop, true);
  assert.equal(disc.cling.anchor, 'body');
  for (const file of fs.readdirSync('assets/fx/haley', { recursive: true })) {
    const name = String(file);
    assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
  }
});

test('thule glow jab, far throw, aurora, and x-ray match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const ultima = read('assets/fx/thule/ultima-thule/fx.json');
  assert.equal(ultima.frames, 12);
  assert.equal(ultima.fps, 24);
  assert.equal(ultima.loop, true);
  assert.ok(Math.abs(ultima.pivotX - 420 / 512) < 1e-6);
  assert.ok(Math.abs(ultima.pivotY - 80 / 160) < 1e-6);
  assert.equal(ultima.charge.scaleWith, 'alpha');
  assert.equal(ultima.charge.anchor, 'body');
  assert.equal(ultima.impact.scaleTo, 'radius');
  assert.equal(ultima.impact.flashRadius, 290);
  assert.equal(ultima.impact.frames, 24);
  assert.equal(ultima.impact.fps, 16);
  assert.ok(Math.abs(ultima.impact.pivotX - 294 / 588) < 1e-6);
  assert.ok(Math.abs(ultima.impact.pivotY - 282 / 576) < 1e-6);
  const flash = impactRadiusScale({ projectileRadius: 18 }, ultima.impact);
  assert.ok(Math.abs(flash - 18 / 290) < 1e-9);
  const near = throwGrowth(0, { reach: 1000, mult: 1.85, stretch: 1.45 });
  const far = throwGrowth(1000, { reach: 1000, mult: 1.85, stretch: 1.45 });
  assert.equal(near.damageMult, 1);
  assert.equal(near.stretch, 1);
  assert.ok(Math.abs(far.damageMult - 1.85) < 1e-9);
  assert.ok(far.stretch > near.stretch);
  assert.ok(far.alpha > near.alpha);
  const jab = read('assets/fx/thule/blue-glow-jab/fx.json');
  assert.equal(jab.file, undefined);
  assert.equal(jab.fist.frames, 24);
  assert.equal(jab.fist.fps, 24);
  assert.equal(jab.impact.frames, 10);
  assert.equal(jab.impact.fps, 24);
  const veil = read('assets/fx/thule/aurora-veil/fx.json');
  assert.equal(veil.anchor, 'body');
  assert.equal(veil.loop, true);
  assert.equal(veil.dazzle.frames, 24);
  assert.equal(veil.dazzle.anchor, 'body');
  const ray = read('assets/fx/thule/handheld-x-ray/fx.json');
  assert.equal(ray.frames, 6);
  assert.equal(ray.fit, 'pixel');
  assert.ok(Math.abs(ray.pivotX - 40 / 640) < 1e-6);
  assert.ok(Math.abs(ray.pivotY - 180 / 360) < 1e-6);
  assert.equal(ray.unit.black, false);
  assert.equal(ray.unit.aim, false);
  assert.ok(Math.abs(ray.unit.nozzleX - 240 / 256) < 1e-6);
  assert.ok(Math.abs(ray.unit.nozzleY - 105 / 192) < 1e-6);
  const scale = beamDrawScale({ beamLen: 520, beamArtPx: 480, beamCap: 520, _beamScale: 1 });
  assert.ok(Math.abs(scale - 520 / 480) < 1e-9);
  const unit = {
    pivotX: 0.5, pivotY: 0.5, nozzleX: 240 / 256, nozzleY: 105 / 192,
    frames: [{ displayW: 200, displayH: 150 }],
  };
  const right = handheldUnit({ x: 100, y: 200, facing: 1, bodyW: 40, bodyH: 80 }, unit);
  const left = handheldUnit({ x: 100, y: 200, facing: -1, bodyW: 40, bodyH: 80 }, unit);
  assert.ok(right.nozzle.x > right.x);
  assert.ok(left.nozzle.x < left.x);
  assert.ok(Math.abs(right.nozzle.y - left.nozzle.y) < 1e-6);
  for (const file of fs.readdirSync('assets/fx/thule', { recursive: true })) {
    const name = String(file);
    assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
  }
});

test('holly laser, calibration, bend, and pole piece match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const laser = read('assets/fx/holly/stone-breaker/fx.json');
  assert.equal(laser.file, 'holmium-laser-beam-anim.png');
  assert.equal(laser.frames, 6);
  assert.equal(laser.fps, 24);
  assert.equal(laser.loop, true);
  assert.equal(laser.fit, 'pixel');
  assert.ok(Math.abs(laser.pivotX - 60 / 1280) < 1e-6);
  assert.ok(Math.abs(laser.pivotY - 120 / 240) < 1e-6);
  assert.equal(laser.charge.scaleWith, 'alpha');
  assert.equal(laser.charge.anchor, 'body');
  assert.equal(laser.impact.flip, true);
  assert.equal(laser.impact.frames, 12);
  const tap = beamDrawScale({ beamLen: 136, beamArtPx: 1100, beamCap: 1100, _beamScale: 1 });
  assert.ok(Math.abs(tap - 136 / 1100) < 1e-9);
  const full = beamDrawScale({ beamLen: 136, beamArtPx: 1100, beamCap: 1100, _beamScale: 1.7 });
  assert.ok(full > tap && full < 1);
  const strike = read('assets/fx/holly/calibration-strike/fx.json');
  assert.equal(strike.file, undefined);
  assert.equal(strike.impact.frames, 14);
  assert.equal(strike.impact.fps, 24);
  assert.equal(strike.impact.pivotX, 0.5);
  const bend = read('assets/fx/holly/bend-dont-break/fx.json');
  assert.equal(bend.anchor, 'body');
  assert.equal(bend.loop, true);
  assert.equal(bend.frames, 24);
  const pole = read('assets/fx/holly/pole-piece/fx.json');
  assert.equal(pole.file, 'pole-piece.png');
  assert.equal(pole.black, false);
  assert.equal(pole.aim, false);
  assert.ok(Math.abs(pole.pivotX - 128 / 256) < 1e-6);
  assert.ok(Math.abs(pole.pivotY - 138 / 256) < 1e-6);
  assert.ok(Math.abs(pole.spin - 2.5 * Math.PI * 2) < 1e-3);
  assert.equal(pole.field.loop, true);
  assert.equal(pole.field.frames, 24);
  assert.equal(pole.impact.scaleTo, 'radius');
  assert.equal(pole.impact.flashRadius, 290);
  assert.equal(pole.impact.frames, 24);
  assert.ok(Math.abs(pole.impact.pivotX - 294 / 588) < 1e-6);
  assert.ok(Math.abs(pole.impact.pivotY - 289 / 576) < 1e-6);
  const scale = impactRadiusScale({ projectileRadius: 22 }, pole.impact);
  assert.ok(Math.abs(scale - 22 / 290) < 1e-9);
  assert.equal(pullFieldSize(110), 220);
  for (const file of fs.readdirSync('assets/fx/holly', { recursive: true })) {
    const name = String(file);
    assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
  }
});

test('dizzy turbine, motor, rod wall, and spotlight match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const gust = read('assets/fx/dizzy/turbine-gust/fx.json');
  assert.equal(gust.file, 'turbine-gust-wave-anim.png');
  assert.equal(gust.frames, 18);
  assert.equal(gust.fps, 15);
  assert.equal(gust.flip, true);
  assert.ok(Math.abs(gust.pivotX - 60 / 1024) < 1e-6);
  assert.equal(gust.pivotY, 0.5);
  assert.equal(gust.scaleWith, 'charge');
  assert.equal(gust.charge.anchor, 'body');
  assert.equal(gust.charge.scaleWith, 'alpha');
  assert.equal(gust.rotor.file, 'turbine-rotor.png');
  assert.equal(gust.rotor.aim, false);
  assert.equal(gust.rotor.black, false);
  const punch = read('assets/fx/dizzy/ev-motor-punch/fx.json');
  assert.equal(punch.file, undefined);
  assert.equal(punch.impact.frames, 16);
  assert.equal(punch.impact.fps, 22);
  const impactSec = punch.impact.frames / punch.impact.fps;
  assert.ok(impactSec >= 0.6 && impactSec <= 0.8, `impact plays in ${impactSec}s`);
  assert.deepEqual(punch.impact.hitScales, [0.42, 0.5, 0.58]);
  for (const scale of punch.impact.hitScales) {
    assert.ok(scale >= 0.4 && scale <= 0.6);
  }
  assert.ok(punch.impact.hitScales[2] > punch.impact.hitScales[1]);
  assert.ok(punch.impact.hitScales[1] > punch.impact.hitScales[0]);
  assert.equal(punch.impact.hitRots.length, 3);
  assert.equal(punch.motor.file, 'gauntlet-motor.png');
  assert.equal(punch.motor.spinTurns, 10);
  assert.equal(punch.motor.aim, false);
  assert.equal(punch.spark.loop, true);
  const wall = read('assets/fx/dizzy/control-rod-wall/fx.json');
  assert.equal(wall.file, 'rod-wall-rise-anim.png');
  assert.equal(wall.frames, 12);
  assert.equal(wall.fps, 24);
  assert.equal(wall.loop, false);
  assert.equal(wall.reverseOnRelease, true);
  assert.equal(wall.anchor, 'ground');
  assert.ok(Math.abs(wall.pivotY - (640 - 40) / 640) < 1e-6);
  assert.equal(wall.hold.file, 'rod-wall-hold-anim.png');
  assert.equal(wall.hold.loop, true);
  assert.equal(wall.hold.frames, 24);
  const flash = read('assets/fx/dizzy/stage-light-flash/fx.json');
  assert.equal(flash.file, 'stage-light-beam-anim.png');
  assert.equal(flash.fit, 'pixel');
  assert.ok(Math.abs(flash.pivotX - 60 / 1280) < 1e-6);
  assert.ok(Math.abs(flash.pivotY - 200 / 400) < 1e-6);
  assert.equal(flash.flip, undefined);
  assert.equal(flash.cling.anchor, 'body');
  assert.equal(flash.cling.loop, true);
  assert.equal(rotorTurns(0), 1);
  assert.equal(rotorTurns(1), 6);
  assert.equal(chargeWaveAlpha(0), 0.4);
  assert.equal(chargeWaveAlpha(1), 1);
  assert.equal(chargeFrac({ _chargeFrac: 0.5 }), 0.5);
  assert.ok(Math.abs(fxGameplayScale({ _chargeFrac: 1 }, { scaleWith: 'charge' }) - 1.28) < 1e-9);
  assert.deepEqual(reverseFrameOrder(4), [3, 2, 1, 0]);
  const up = stickAim({ facing: 1, input: { jump: true } });
  assert.ok(Math.abs(up.y + 1) < 1e-9);
  const idle = stickAim({ facing: -1, input: {} });
  assert.equal(idle.x, -1);
  for (const file of fs.readdirSync('assets/fx/dizzy', { recursive: true })) {
    const name = String(file);
    assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
  }
});

test('terra sonar and phosphor bolt match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const sonar = read('assets/fx/terra/sonar-pulse/fx.json');
  assert.equal(sonar.file, 'sonar-pulse-anim.png');
  assert.equal(sonar.frames, 18);
  assert.equal(sonar.cols, 3);
  assert.equal(sonar.rows, 6);
  assert.equal(sonar.fps, 15);
  assert.equal(sonar.fit, 'stage');
  assert.equal(sonar.fromBody, true);
  assert.equal(sonar.hit, false);
  assert.ok(Math.abs(sonar.pivotX - 60 / 1280) < 1e-6);
  assert.equal(sonar.pivotY, 0.5);
  assert.equal(sonar.charge.file, 'alloy-flex-charge-anim.png');
  assert.equal(sonar.charge.anchor, 'body');
  assert.equal(sonar.charge.loop, true);
  assert.equal(sonar.charge.scaleWith, 'alpha');
  const bolt = read('assets/fx/terra/green-phosphor-bolt/fx.json');
  assert.equal(bolt.file, 'green-phosphor-bolt-anim.png');
  assert.equal(bolt.frames, 12);
  assert.equal(bolt.fps, 24);
  assert.equal(bolt.loop, true);
  assert.ok(Math.abs(bolt.pivotX - 400 / 512) < 1e-6);
  assert.equal(bolt.pivotY, 0.5);
  assert.equal(bolt.crop, undefined);
  assert.equal(bolt.impact.file, 'green-phosphor-bolt-impact-anim.png');
  assert.equal(bolt.impact.frames, 24);
  assert.equal(bolt.impact.fps, 16);
  assert.ok(bolt.impact.scale >= 0.3 && bolt.impact.scale <= 0.4);
  assert.equal(bolt.impact.hit, false);
});

test('phosphor bloom, magnetic chill, and curie point match the arrived sheets', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const bloom = read('assets/fx/europa/phosphor-bloom/fx.json');
  assert.equal(bloom.file, 'phosphor-bloom-burst-anim.png');
  assert.equal(bloom.frames, 24);
  assert.equal(bloom.cols, 4);
  assert.equal(bloom.rows, 6);
  assert.equal(bloom.fps, 16);
  assert.equal(bloom.blend, 'add');
  assert.equal(bloom.hit, false);
  assert.equal(bloom.pivotX, 0.5);
  assert.equal(bloom.pivotY, 0.5);
  assert.equal(bloom.anchor, undefined);
  assert.equal(bloom.charge.file, 'uv-soak-charge-anim.png');
  assert.equal(bloom.charge.frames, 24);
  assert.equal(bloom.charge.cols, 6);
  assert.equal(bloom.charge.rows, 4);
  assert.equal(bloom.charge.fps, 12);
  assert.equal(bloom.charge.loop, true);
  assert.equal(bloom.charge.anchor, 'body');
  assert.equal(bloom.charge.scaleWith, 'alpha');
  const chill = read('assets/fx/goldie/magnetic-chill/fx.json');
  assert.equal(chill.file, 'magnetic-chill-status-anim.png');
  assert.equal(chill.frames, 24);
  assert.equal(chill.fps, 12);
  assert.equal(chill.loop, true);
  assert.equal(chill.anchor, 'body');
  assert.equal(chill.blend, 'add');
  const curie = read('assets/fx/goldie/curie-point-burst/fx.json');
  assert.equal(curie.projectile.file, 'curie-orb-cool.png');
  assert.equal(curie.projectile.black, false);
  assert.equal(curie.projectile.aim, false);
  assert.equal(curie.hot.file, 'curie-orb-hot.png');
  assert.equal(curie.hot.black, false);
  assert.equal(curie.burst.file, 'curie-point-burst-blast-anim.png');
  assert.equal(curie.burst.frames, 24);
  assert.equal(curie.burst.fps, 16);
  assert.equal(curie.burst.blend, 'add');
  assert.ok(curie.burst.heightFrac <= 1.6, 'the dense blast stays inside the nearby radius');
  assert.ok(curie.burst.heightFrac >= 1.1);
  assert.equal(curieFade(0.2), 0);
  assert.equal(curieFade(0.45), 0);
  assert.ok(Math.abs(curieFade(1) - 1) < 1e-9);
  assert.ok(curieFade(0.725) > 0.4 && curieFade(0.725) < 0.6);
  assert.equal(curiePulse(0.2, 400), 1);
  assert.ok(curiePulse(0.8, 0) >= 1);
  for (const root of ['assets/fx/europa/phosphor-bloom', 'assets/fx/goldie', 'assets/fx/terra', 'assets/fx/tara', 'assets/fx/rex', 'assets/fx/wolf', 'assets/fx/oz', 'assets/fx/ira', 'assets/fx/aurelius', 'assets/fx/pit', 'assets/fx/hog', 'assets/fx/talia', 'assets/fx/pablo', 'assets/fx/bianca']) {
    const dirs = fs.statSync(root).isDirectory() && fs.readdirSync(root).some((name) => fs.statSync(`${root}/${name}`).isDirectory())
      ? fs.readdirSync(root).map((name) => `${root}/${name}`).filter((dir) => fs.statSync(dir).isDirectory())
      : [root];
    for (const dir of dirs) {
      for (const file of fs.readdirSync(dir)) {
        assert.equal(file.endsWith('.gif') || file.endsWith('.jpg') || file.endsWith('.py'), false, `${dir}/${file}`);
      }
    }
  }
});

test('tara and rex sheets match the arrived centres and flashes', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const dump = read('assets/fx/tara/capacitor-dump/fx.json');
  assert.equal(dump.file, 'capacitor-dump-discharge-anim.png');
  assert.equal(dump.frames, 10);
  assert.equal(dump.fps, 24);
  assert.equal(dump.hit, false);
  assert.ok(Math.abs(dump.pivotX - 40 / 720) < 1e-6);
  assert.ok(Math.abs(dump.pivotY - 200 / 400) < 1e-6);
  assert.equal(dump.charge.fillFrames, 20);
  assert.equal(dump.charge.frames, 24);
  assert.equal(dump.charge.anchor, 'body');
  const bash = read('assets/fx/tara/bone-plate-bash/fx.json');
  assert.equal(bash.file, undefined);
  assert.equal(bash.fist.black, false);
  assert.ok(Math.abs(bash.fist.pivotX - 56 / 512) < 1e-6);
  assert.ok(Math.abs(bash.fist.pivotY - 80 / 160) < 1e-6);
  assert.equal(bash.impact.scaleTo, 'radius');
  assert.equal(bash.impact.flashRadius, 290);
  assert.equal(bash.impact.frames, 24);
  assert.equal(bash.impact.fps, 16);
  assert.ok(Math.abs(bash.impact.pivotX - 294 / 588) < 1e-6);
  assert.ok(Math.abs(bash.impact.pivotY - 294 / 570) < 1e-6);
  assert.ok(Math.abs(impactRadiusScale({ hitRadius: 36 }, bash.impact) - 36 / 290) < 1e-9);
  assert.equal(bash.heal.frames, 12);
  const guard = read('assets/fx/tara/tantalus-guard/fx.json');
  assert.equal(guard.anchor, 'body');
  assert.equal(guard.loop, true);
  assert.ok(Math.abs(guard.fizz.pivotY - 120 / 160) < 1e-6);
  const pin = read('assets/fx/tara/implant-pin/fx.json');
  assert.equal(pin.black, false);
  assert.equal(pin.aim, true);
  assert.ok(Math.abs(pin.pivotX - 369 / 384) < 1e-6);
  assert.ok(Math.abs(pin.pivotY - 32 / 64) < 1e-6);
  assert.equal(pin.cling.anchor, 'feet');
  assert.equal(pin.cling.loop, true);
  assert.ok(Math.abs(pin.cling.pivotY - 88 / 128) < 1e-6);
  const octane = read('assets/fx/rex/high-octane/fx.json');
  assert.equal(octane.frames, 24);
  assert.equal(octane.fps, 16);
  assert.equal(octane.scaleTo, 'radius');
  assert.equal(octane.flashRadius, 290);
  assert.equal(octane.hard, 0.62);
  assert.ok(Math.abs(octane.pivotX - 294 / 588) < 1e-6);
  assert.ok(Math.abs(octane.pivotY - 252 / 540) < 1e-6);
  const boom = impactRadiusScale({ radius: 96 }, octane);
  assert.ok(Math.abs(boom - (96 / 290) * 0.62) < 1e-9);
  assert.ok(boom < impactRadiusScale({ radius: 96 }, { scaleTo: 'radius', flashRadius: 290 }));
  assert.equal(octane.charge.scaleWith, 'alpha');
  assert.equal(octane.boost.frames, 12);
  assert.equal(octane.boost.fps, 24);
  assert.equal(octane.boost.flip, true);
  const slash = read('assets/fx/rex/kings-edge/fx.json');
  assert.equal(slash.frames, 12);
  assert.equal(slash.fps, 24);
  assert.equal(slash.flip, true);
  assert.equal(slash.oneshot, true);
  const creep = read('assets/fx/rex/creep-resistance/fx.json');
  assert.equal(creep.anchor, 'body');
  assert.equal(creep.loop, true);
  assert.equal(creep.ring.loop, true);
  assert.ok(Math.abs(creep.ring.pivotY - 88 / 128) < 1e-6);
  const lash = read('assets/fx/rex/thermocouple-lash/fx.json');
  assert.equal(lash.frames, 14);
  assert.equal(lash.fps, 24);
  assert.ok(Math.abs(lash.pivotX - 40 / 768) < 1e-6);
  assert.ok(Math.abs(lash.pivotY - 192 / 384) < 1e-6);
  assert.equal(lash.hot.scaleTo, 'radius');
  assert.equal(lash.spark.scaleTo, 'radius');
  assert.ok(lash.hot.flashRadius < lash.spark.flashRadius);
  assert.ok(Math.abs(lash.hot.pivotX - 144 / 288) < 1e-6);
  assert.ok(Math.abs(lash.spark.pivotY - 144 / 288) < 1e-6);
  for (const id of ['tara', 'rex', 'wolf']) {
    for (const file of fs.readdirSync(`assets/fx/${id}`, { recursive: true })) {
      const name = String(file);
      assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
    }
  }
});

test('wolf sheets match the filament, drill, and penetrator', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const filament = read('assets/fx/wolf/white-hot-filament/fx.json');
  assert.equal(filament.file, 'filament-heat-burst-anim.png');
  assert.equal(filament.frames, 14);
  assert.equal(filament.fps, 24);
  assert.equal(filament.anchor, 'body');
  assert.equal(filament.scaleWith, 'hold');
  assert.equal(filament.hit, false);
  assert.equal(filament.charge.frames, 24);
  assert.equal(filament.charge.fps, 12);
  assert.equal(filament.charge.loop, true);
  assert.equal(filament.charge.anchor, 'body');
  assert.equal(filament.charge.scaleWith, 'alpha');
  assert.equal(filament.charge.tintFrom, 0xff7820);
  assert.equal(filament.charge.tintTo, 0xfffaf0);
  const tap = fxGameplayScale({ _chargeFrac: 0 }, { scaleWith: 'hold' });
  const full = fxGameplayScale({ _chargeFrac: 1 }, { scaleWith: 'hold' });
  assert.ok(Math.abs(tap - 0.42) < 1e-9);
  assert.ok(Math.abs(full - 1) < 1e-9);
  assert.ok(full > tap);
  assert.equal(chargeTint(0xff7820, 0xfffaf0, 0), 0xff7820);
  assert.equal(chargeTint(0xff7820, 0xfffaf0, 1), 0xfffaf0);
  assert.equal(chargeTint(0xff7820, 0xfffaf0, 0.5), 0xffb988);
  const drill = read('assets/fx/wolf/carbide-drill/fx.json');
  assert.equal(drill.file, undefined);
  assert.equal(drill.fist.black, false);
  assert.equal(drill.fist.loop, true);
  assert.equal(drill.fist.frames, 8);
  assert.equal(drill.fist.fps, 24);
  assert.ok(Math.abs(drill.fist.pivotX - 500 / 512) < 1e-9);
  assert.ok(Math.abs(drill.fist.pivotY - 64 / 128) < 1e-9);
  assert.equal(drill.spark.loop, false);
  assert.equal(drill.spark.frames, 12);
  assert.ok(Math.abs(drill.spark.pivotX - 320 / 384) < 1e-9);
  assert.ok(Math.abs(drill.spark.pivotY - 128 / 256) < 1e-9);
  assert.equal(drill.impact.scaleTo, 'radius');
  assert.equal(drill.impact.flashRadius, 290);
  assert.equal(drill.impact.hard, undefined);
  assert.equal(drill.impact.frames, 24);
  assert.equal(drill.impact.fps, 16);
  assert.ok(Math.abs(drill.impact.pivotX - 294 / 588) < 1e-9);
  assert.ok(Math.abs(drill.impact.pivotY - 290 / 576) < 1e-9);
  assert.ok(Math.abs(impactRadiusScale({ hitRadius: 96 }, drill.impact) - 96 / 290) < 1e-9);
  assert.equal(playsFinalImpact({ multiHit: 5, _hitIndex: 1 }), false);
  assert.equal(playsFinalImpact({ multiHit: 5, _hitIndex: 5 }), true);
  assert.equal(playsFinalImpact({ damage: 3 }), true);
  const guard = read('assets/fx/wolf/unmeltable/fx.json');
  assert.equal(guard.anchor, 'body');
  assert.equal(guard.loop, true);
  assert.equal(guard.frames, 24);
  const dart = read('assets/fx/wolf/armor-piercer/fx.json');
  assert.equal(dart.black, false);
  assert.equal(dart.aim, true);
  assert.ok(Math.abs(dart.pivotX - 435 / 448) < 1e-9);
  assert.ok(Math.abs(dart.pivotY - 48 / 96) < 1e-9);
  assert.equal(dart.trail.loop, true);
  assert.equal(dart.trail.frames, 8);
  assert.ok(Math.abs(dart.trail.pivotX - 470 / 512) < 1e-9);
  assert.ok(Math.abs(dart.trail.pivotY - 48 / 96) < 1e-9);
  assert.ok(Math.abs(dart.trail.lagFrac - (435 - 40) / 448) < 1e-9);
  assert.ok(Math.abs(trailBackOffset(448, dart.trail.lagFrac) - 395) < 1e-4);
  assert.equal(dart.impact.frames, 10);
  assert.equal(dart.impact.fps, 24);
  assert.equal(dart.impact.loop, false);
});

test('oz, ira, and aurelius sheets keep the arrived centres', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const slam = read('assets/fx/oz/densest-slam/fx.json');
  assert.equal(slam.anchor, 'ground');
  assert.equal(slam.scaleTo, 'radius');
  assert.equal(slam.flashRadius, 300);
  assert.equal(slam.hit, false);
  assert.ok(Math.abs(slam.pivotX - 326 / 653) < 1e-9);
  assert.ok(Math.abs(slam.pivotY - 297 / 298) < 1e-9);
  assert.equal(slam.charge.anchor, 'body');
  assert.equal(slam.charge.scaleWith, 'alpha');
  assert.equal(slam.charge.rumble, true);
  assert.equal(slam.wave.stretch, 'length');
  assert.ok(Math.abs(slam.wave.pivotY - 200 / 256) < 1e-9);
  const nib = read('assets/fx/oz/nib-stab/fx.json');
  assert.equal(nib.fist.black, false);
  assert.ok(Math.abs(nib.fist.pivotX - 238 / 256) < 1e-9);
  assert.ok(Math.abs(nib.fist.pivotY - 48 / 96) < 1e-9);
  const puff = read('assets/fx/oz/tetroxide-puff/fx.json');
  assert.equal(puff.anchor, 'body');
  assert.equal(puff.loop, true);
  assert.equal(puff.scaleIn, 300);
  const impact = read('assets/fx/ira/extinction-layer/fx.json');
  assert.equal(impact.anchor, 'ground');
  assert.equal(impact.scaleTo, 'radius');
  assert.equal(impact.flashRadius, 200);
  assert.equal(impact.frames, 23);
  assert.equal(impact.fps, 15.333);
  assert.ok(Math.abs(impact.pivotX - 468 / 937) < 1e-9);
  assert.ok(Math.abs(impact.pivotY - 364 / 365) < 1e-9);
  assert.equal(impact.charge.anchor, 'predict');
  assert.equal(impact.charge.floor, true);
  assert.ok(Math.abs(impact.charge.pivotY - 110 / 160) < 1e-9);
  assert.ok(Math.abs(impact.trail.pivotX - 470 / 640) < 1e-9);
  assert.ok(Math.abs(impact.trail.pivotY - 470 / 640) < 1e-9);
  assert.equal(impact.trail.flat, true);
  assert.equal(impact.meteor.spin, 2.2);
  const plug = read('assets/fx/ira/spark-plug/fx.json');
  assert.ok(Math.abs(plug.fist.pivotX - 238 / 256) < 1e-9);
  assert.ok(Math.abs(plug.fist.pivotY - 44 / 96) < 1e-9);
  const iris = read('assets/fx/ira/iris-scatter/fx.json');
  for (const type of ['kinetic', 'heat', 'electrical', 'chemical']) {
    assert.equal(iris.shards[type].file, `iris-shard-${type}.png`);
    assert.ok(Math.abs(iris.shards[type].pivotX - 182 / 192) < 1e-9);
    assert.ok(Math.abs(iris.shards[type].pivotY - 48 / 96) < 1e-9);
  }
  const ingot = read('assets/fx/aurelius/ingot-lob/fx.json');
  assert.equal(ingot.black, false);
  assert.equal(ingot.spin, 2.2);
  assert.ok(Math.abs(ingot.pivotX - 128 / 256) < 1e-9);
  assert.ok(Math.abs(ingot.pivotY - 90 / 160) < 1e-9);
  assert.equal(ingot.impact.scale, 0.5);
  assert.equal(ingot.impact.scaleTo, undefined);
  assert.equal(impactRadiusScale({ projectileRadius: 14 }, ingot.impact), null);
  assert.ok(Math.abs(ingot.impact.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(ingot.impact.pivotY - 287 / 572) < 1e-9);
  const visor = read('assets/fx/aurelius/golden-visor/fx.json');
  assert.equal(visor.anchor, 'body');
  assert.equal(visor.visor.black, false);
  assert.equal(visor.visor.flip, true);
  assert.ok(Math.abs(visor.reflect.pivotX - 60 / 448) < 1e-9);
  assert.ok(Math.abs(visor.reflect.pivotY - 128 / 256) < 1e-9);
  const contact = read('assets/fx/aurelius/circuit-contact/fx.json');
  assert.equal(contact.file, undefined);
  assert.equal(contact.impact.frames, 12);
  assert.equal(contact.impact.pivotX, 0.5);
  for (const id of ['oz', 'ira', 'aurelius']) {
    for (const file of fs.readdirSync(`assets/fx/${id}`, { recursive: true })) {
      const name = String(file);
      assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
    }
  }
});

test('pit sheets scale the cloud ignition and tint the flame test', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const lamp = read('assets/fx/pit/catalyst-ignition/fx.json');
  assert.equal(lamp.charge.anchor, 'hand');
  assert.equal(lamp.charge.black, false);
  assert.equal(lamp.glow.scaleWith, 'alpha');
  assert.equal(lamp.glow.frames, 24);
  assert.equal(lamp.glow.fps, 12);
  assert.equal(lamp.ignite.frames, 24);
  assert.equal(lamp.ignite.fps, 24);
  assert.equal(lamp.ignite.hit, false);
  assert.ok(Math.abs(lamp.ignite.pivotX - 307 / 615) < 1e-9);
  assert.ok(Math.abs(lamp.ignite.pivotY - 289 / 586) < 1e-9);
  const cloud = cloudIgnitionScale(64, 615, 0.6);
  assert.ok(Math.abs(cloud - (128 * 0.6) / 615) < 1e-9);
  assert.ok(cloudIgnitionScale(64, 615, 0.9) <= (128 * 0.7) / 615);
  assert.ok(cloudIgnitionScale(64, 615, 0.2) >= (128 * 0.5) / 615);
  const scratch = read('assets/fx/pit/record-scratch/fx.json');
  assert.equal(scratch.fist.black, false);
  assert.equal(scratch.fist.spin, 12);
  assert.ok(Math.abs(scratch.fist.pivotX - 192 / 384) < 1e-9);
  assert.equal(scratch.impact.flip, true);
  assert.equal(scratch.impact.frames, 10);
  assert.equal(scratch.impact.fps, 24);
  const clamp = read('assets/fx/pit/cisplatin-clamp/fx.json');
  assert.equal(clamp.cling.guardAt, 8);
  assert.equal(clamp.cling.anchor, 'body');
  assert.equal(clamp.cling.frames, 24);
  const snap = { frames: Array.from({ length: 24 }, () => ({})), fps: 24, guardAt: 8 };
  assert.equal(fxFrameIndex(snap, 0), 0);
  assert.equal(fxFrameIndex(snap, (7 / 24) * 1000), 7);
  assert.ok(fxFrameIndex(snap, 1000) >= 8);
  const loop = read('assets/fx/pit/flame-test/fx.json');
  assert.equal(loop.black, false);
  assert.ok(Math.abs(loop.pivotX - 292 / 320) < 1e-9);
  assert.ok(Math.abs(loop.pivotY - 48 / 96) < 1e-9);
  assert.ok(Math.abs(loop.impact.pivotY - 324 / 384) < 1e-9);
  assert.equal(flameTestColor('Na'), 0xffc83c);
  assert.equal(flameTestColor('Li'), 0xff3c50);
  assert.equal(flameTestColor('Cu'), 0x50ffa0);
  assert.equal(flameTestColor('Pt'), 0xfff3d6);
  for (const file of fs.readdirSync('assets/fx/pit', { recursive: true })) {
    const name = String(file);
    assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, name);
  }
});

test('batch 23 sheets scale the bright openings and keep the props', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const bulb = read('assets/fx/hog/thermometer-burst/fx.json');
  assert.equal(bulb.scaleTo, 'radius');
  assert.equal(bulb.flashRadius, 230);
  assert.ok(Math.abs(bulb.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(bulb.pivotY - 287 / 569) < 1e-9);
  assert.equal(bulb.charge.scaleMin, 0.5);
  assert.equal(bulb.charge.scaleMax, 1.3);
  assert.equal(bulb.heated.file, 'thermometer-bulb-heated.png');
  assert.equal(bulb.charge.black, false);
  const lash = read('assets/fx/hog/quicksilver-lash/fx.json');
  assert.equal(lash.anchor, 'shoulder');
  assert.equal(lash.pivotX, 0);
  assert.equal(lash.black, false);
  const fin = read('assets/fx/pablo/machine-gun/fx.json');
  assert.equal(fin.impact.scaleTo, 'radius');
  assert.equal(fin.impact.flashRadius, 180);
  assert.equal(fin.impact.replacesSpark, true);
  assert.ok(Math.abs(fin.impact.pivotX - 246 / 493) < 1e-9);
  assert.ok(Math.abs(fin.muzzle.pivotX - 60 / 192) < 1e-9);
  assert.equal(fin.muzzle.randomRot, true);
  assert.equal(fin.black, false);
  const kick = read('assets/fx/bianca/staircase-kick/fx.json');
  assert.equal(kick.impact.scaleTo, 'radius');
  assert.equal(kick.impact.flashRadius, 230);
  assert.ok(Math.abs(kick.impact.pivotX - 287 / 575) < 1e-9);
  assert.equal(kick.spark.rise, 0.22);
  const eruption = read('assets/fx/bianca/hopper-crystal/fx.json');
  assert.equal(eruption.anchor, 'ground');
  assert.equal(eruption.pivotY, 1);
  assert.equal(eruption.pivotX, 0);
  assert.equal(eruption.black, false);
  const cloud = read('assets/fx/talia/poisoners-poison/fx.json');
  assert.equal(cloud.maxAlpha, 0.18);
  assert.equal(cloud.cling.rampAlpha, true);
  assert.equal(impactRadiusScale({ radius: 64 }, { scaleTo: 'radius', flashRadius: 230 }), 64 / 230);
  assert.equal(impactRadiusScale({ hitRadius: 34, projectileRadius: 7 }, { scaleTo: 'radius', flashRadius: 180 }), 34 / 180);
  assert.equal(impactRadiusScale({ hitRadius: 56 }, { scaleTo: 'radius', flashRadius: 230 }), 56 / 230);
  for (const id of ['hog', 'talia', 'pablo', 'bianca']) {
    for (const file of fs.readdirSync(`assets/fx/${id}`, { recursive: true })) {
      const name = String(file);
      assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, `${id}/${name}`);
    }
  }
});

test('batch 23 part 2 scales the bright openings and anchors the seep', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const glow = read('assets/fx/polonius/blue-glow-burst/fx.json');
  assert.equal(glow.scaleTo, 'radius');
  assert.equal(glow.flashRadius, 230);
  assert.ok(Math.abs(glow.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(glow.pivotY - 287 / 575) < 1e-9);
  assert.equal(glow.charge.scaleWith, 'alpha');
  assert.equal(glow.charge.anchor, 'body');
  assert.equal(glow.cling.anchor, 'body');
  const curtain = read('assets/fx/polonius/behind-the-arras/fx.json');
  assert.equal(curtain.black, false);
  assert.equal(curtain.anchor, 'ground-front');
  assert.ok(Math.abs(curtain.pivotY - 380 / 384) < 1e-9);
  assert.equal(curtain.block.file, 'arras-block-anim.png');
  assert.equal(curtain.pierce.file, 'arras-pierce-anim.png');
  const vapor = read('assets/fx/tate/self-vaporize/fx.json');
  assert.equal(vapor.scaleTo, 'radius');
  assert.equal(vapor.flashRadius, 230);
  assert.ok(Math.abs(vapor.pivotY - 287 / 570) < 1e-9);
  assert.equal(vapor.linger.file, 'reappear-shimmer-anim.png');
  const unseen = read('assets/fx/tate/never-seen/fx.json');
  assert.equal(unseen.anchor, 'body');
  assert.equal(unseen.maxAlpha, 0.55);
  const rise = read('assets/fx/ronan/ground-seep/fx.json');
  assert.equal(rise.anchor, 'ground');
  assert.equal(rise.scaleTo, 'radius');
  assert.equal(rise.flashRadius, 300);
  assert.ok(Math.abs(rise.pivotX - 296 / 593) < 1e-9);
  assert.ok(Math.abs(rise.pivotY - 474 / 475) < 1e-9);
  assert.equal(rise.launch.pivotY, 1);
  assert.ok(Math.abs(rise.trail.pivotY - 80 / 96) < 1e-9);
  assert.equal(impactRadiusScale({ radius: 46 }, { scaleTo: 'radius', flashRadius: 300 }), 46 / 300);
  const creep = read('assets/fx/ronan/radon-creep/fx.json');
  assert.equal(creep.loop, true);
  assert.ok(creep.pivotY > 0.9);
  const turn = read('assets/fx/frank/beta-turn/fx.json');
  assert.equal(turn.scaleTo, undefined);
  assert.equal(turn.scale, 0.46);
  assert.ok(Math.abs(turn.pivotX - 287 / 575) < 1e-9);
  assert.equal(turn.boost.anchor, 'body');
  assert.equal(turn.boost.loop, true);
  const trace = read('assets/fx/frank/trace-amount/fx.json');
  assert.equal(trace.shatter.file, 'trace-counter-anim.png');
  const tonic = read('assets/fx/ray/radium-tonic/fx.json');
  assert.equal(tonic.charge.black, false);
  assert.equal(tonic.charge.anchor, 'hand');
  assert.equal(tonic.charge.tilt, 0.85);
  assert.ok(Math.abs(tonic.charge.pivotY - 246 / 256) < 1e-9);
  assert.equal(tonic.glow.scaleWith, 'alpha');
  const upper = read('assets/fx/ray/alpha-uppercut/fx.json');
  assert.equal(upper.burst.scaleTo, undefined);
  assert.equal(upper.burst.scale, 0.4);
  assert.ok(Math.abs(upper.burst.pivotX - 287 / 575) < 1e-9);
  const deck = read('assets/fx/ace/neutron-deck/fx.json');
  assert.equal(deck.blend, 'normal');
  assert.equal(deck.impact.scaleTo, 'radius');
  assert.equal(deck.impact.flashRadius, 230);
  assert.ok(Math.abs(deck.impact.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(deck.impact.pivotY - 287 / 574) < 1e-9);
  const card = read('assets/fx/ace/ace-of-rays/fx.json');
  assert.equal(card.fist.black, false);
  assert.equal(card.fist.file, 'glowing-card.png');
  const beam = read('assets/fx/ace/actinic-ray/fx.json');
  assert.equal(beam.pivotX, 0);
  assert.equal(beam.charge.scaleWith, 'alpha');
  assert.equal(impactRadiusScale({ hitRadius: 56, projectileRadius: 14 }, { scaleTo: 'radius', flashRadius: 230 }), 56 / 230);
  const flask = read('assets/fx/neptune/mad-science-flask/fx.json');
  assert.equal(flask.impact.scaleTo, 'radius');
  assert.equal(flask.impact.flashRadius, 230);
  assert.equal(flask.glow.scaleWith, 'alpha');
  assert.ok(Math.abs(flask.glow.pivotY - 200 / 256) < 1e-9);
  const blast = read('assets/fx/pluto/critical-mass/fx.json');
  assert.equal(blast.scaleTo, 'radius');
  assert.equal(blast.flashRadius, 230);
  assert.equal(blast.charge.scaleWith, 'charge');
  assert.equal(blast.warn.file, 'critical-window-cue-anim.png');
  const arc = read('assets/fx/uri/chain-reaction/fx.json');
  assert.equal(arc.arc.span, 304);
  assert.ok(Math.abs(arc.arc.pivotX - 40 / 384) < 1e-9);
  assert.equal(arc.scaleTo, undefined);
  const hazard = read('assets/fx/pat/twin-hazard-bolt/fx.json');
  assert.equal(hazard.impact.scaleTo, undefined);
  assert.equal(hazard.impact.scale, 0.42);
  const dart = read('assets/fx/uri/penetrator-dart/fx.json');
  assert.ok(Math.abs(dart.pierce.pivotX - 100 / 320) < 1e-9);
  assert.equal(dart.black, false);
  const mass = read('assets/fx/einstein/mass-energy/fx.json');
  assert.equal(mass.scaleTo, 'radius');
  assert.equal(mass.flashRadius, 230);
  assert.equal(mass.hit, false);
  assert.ok(Math.abs(mass.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(mass.pivotY - 287 / 565) < 1e-9);
  assert.equal(impactRadiusScale({ radius: 74, hitRadius: 74 }, mass), 74 / 230);
  assert.equal(mass.charge.anchor, 'body');
  const jab = read('assets/fx/einstein/time-dilation/fx.json');
  assert.equal(jab.oneshot, true);
  assert.equal(jab.cling.anchor, 'body');
  assert.equal(jab.cling.loop, true);
  const thought = read('assets/fx/einstein/thought-experiment/fx.json');
  assert.equal(thought.block.file, 'thought-block-anim.png');
  assert.equal(thought.linger.file, 'ghost-replay-tint-anim.png');
  const rain = read('assets/fx/einstein/fallout-rain/fx.json');
  assert.equal(rain.launch.frames, 32);
  assert.equal(rain.shower.frames, 16);
  assert.equal(rain.shower.tilt, 0.42);
  const pile = read('assets/fx/fermi/chicago-pile/fx.json');
  assert.equal(pile.scaleTo, undefined);
  assert.equal(pile.scale, 0.42);
  assert.equal(pile.scaleWith, 'radius');
  assert.equal(pile.charge.scaleWith, 'alpha');
  assert.equal(pile.shards.graphite.black, false);
  assert.equal(pile.shards.uranium.black, false);
  assert.equal(pileCount(0), 1);
  assert.equal(pileCount(1), 8);
  const neutron = read('assets/fx/fermi/slow-neutron-punch/fx.json');
  assert.ok(Math.abs(neutron.pivotX - 316 / 384) < 1e-9);
  assert.equal(neutron.aim, true);
  const zone = read('assets/fx/fermi/exclusion-zone/fx.json');
  assert.equal(zone.anchor, 'body');
  assert.equal(zone.reflect.frames, 6);
  const signal = read('assets/fx/fermi/fermi-paradox/fx.json');
  assert.ok(Math.abs(signal.pivotX - 158 / 192) < 1e-9);
  assert.equal(signal.spark.frames, 6);
  const dream = read('assets/fx/mendel/dream-of-the-table/fx.json');
  assert.equal(dream.charge.file, 'dozing-status-anim.png');
  assert.equal(dream.boost.anchor, 'body');
  const taps = read('assets/fx/mendel/one-atom-at-a-time/fx.json');
  assert.equal(taps.spark.frames, 4);
  assert.equal(taps.impact.replacesSpark, true);
  const square = read('assets/fx/mendel/empty-square/fx.json');
  assert.equal(square.anchor, 'front');
  assert.equal(square.block.file, 'square-swallow-anim.png');
  const column = read('assets/fx/mendel/group-drop/fx.json');
  assert.equal(column.black, false);
  assert.equal(column.pivotY, 1);
  assert.equal(column.impact.scaleTo, undefined);
  assert.equal(column.impact.scale, 0.42);
  assert.ok(Math.abs(column.impact.pivotX - 287 / 575) < 1e-9);
  const alarm = read('assets/fx/amy/alarm-blare/fx.json');
  assert.equal(alarm.scaleTo, undefined);
  assert.equal(alarm.scale, 0.42);
  assert.equal(alarm.scaleWith, 'radius');
  assert.ok(Math.abs(alarm.pivotX - 287 / 575) < 1e-9);
  assert.equal(alarm.wave.flip, true);
  assert.ok(Math.abs(alarm.wave.pivotX - 40 / 448) < 1e-9);
  const ionBeam = read('assets/fx/amy/ionizing-beam/fx.json');
  assert.equal(ionBeam.pivotX, 0);
  assert.equal(ionBeam.frames, 12);
  assert.equal(beamDrawScale({ beamLen: 440, beamArtPx: 440, beamCap: 440, _beamScale: 1 }), 1);
  assert.equal(beamDrawScale({ beamLen: 900, beamArtPx: 440, beamCap: 440, _beamScale: 2 }), 1);
  const nobel = read('assets/fx/curie/double-nobel/fx.json');
  assert.equal(nobel.scaleTo, undefined);
  assert.equal(nobel.scale, 0.42);
  assert.equal(nobel.impact.file, 'nobel-chemical-hit-anim.png');
  assert.equal(nobel.shards.medal.black, false);
  assert.ok(Math.abs(nobel.shards.medal.pivotX - 56 / 112) < 1e-9);
  const ore = read('assets/fx/curie/pitchblende-toss/fx.json');
  assert.equal(ore.black, false);
  assert.equal(ore.spin, 6);
  assert.equal(ore.hold.file, 'pitchblende-dust-cloud-anim.png');
  assert.equal(ore.hold.loop, true);
  const cell = read('assets/fx/burke/hot-cell/fx.json');
  assert.equal(cell.crackFrames, true);
  assert.equal(cell.frames, 4);
  assert.equal(cell.cols, 4);
  assert.equal(cell.black, false);
  assert.equal(cell.anchor, 'body');
  assert.equal(cell.shatter.frames, 12);
  const express = read('assets/fx/burke/express-shipment/fx.json');
  assert.equal(express.impact.scaleTo, undefined);
  assert.equal(express.impact.scale, 0.42);
  assert.ok(Math.abs(express.impact.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(express.impact.pivotY - 287 / 559) < 1e-9);
  const stored = fxGameplayScale({ storeHits: { cap: 20 }, _stored: 0, radius: 70 }, { scale: 0.7, scaleWith: 'stored' });
  const fullStore = fxGameplayScale({ storeHits: { cap: 20 }, _stored: 20, radius: 70 }, { scale: 0.7, scaleWith: 'stored' });
  assert.equal(stored, 0.7 * 0.55);
  assert.equal(fullStore, 0.7 * 1.4);
  const burst = read('assets/fx/cali/neutron-kickstart/fx.json');
  assert.equal(burst.scaleTo, undefined);
  assert.equal(burst.scale, 0.42);
  assert.ok(Math.abs(burst.pivotY - 260 / 512) < 1e-9);
  assert.equal(burst.boost.file, 'kickstart-boost-status-anim.png');
  const probe = read('assets/fx/cali/prospecting-probe/fx.json');
  assert.equal(probe.black, false);
  assert.equal(probe.aim, true);
  const wave = read('assets/fx/cali/surf-s-up/fx.json');
  assert.equal(wave.anchor, 'trail');
  assert.equal(wave.flip, true);
  const cyclotron = read('assets/fx/lars/cyclotron-beam/fx.json');
  assert.equal(cyclotron.pivotX, 0);
  assert.equal(cyclotron.frames, 10);
  assert.equal(beamDrawScale({ beamLen: 220, beamArtPx: 552, beamCap: 460, _beamScale: 1 }), 220 / 552);
  assert.equal(beamDrawScale({ beamLen: 220, beamArtPx: 552, beamCap: 460, _beamScale: 4 }), 460 / 552);
  const smash = read('assets/fx/lars/atom-smasher/fx.json');
  assert.equal(smash.impact.scaleTo, undefined);
  assert.equal(smash.impact.scale, 0.42);
  assert.ok(Math.abs(smash.impact.pivotY - 284 / 572) < 1e-9);
  const punch = read('assets/fx/ford/dense-nucleus/fx.json');
  assert.equal(punch.scaleTo, 'radius');
  assert.equal(punch.flashRadius, 230);
  assert.equal(punch.anchor, 'contact');
  assert.equal(impactRadiusScale({ hitRadius: 46 }, punch), 46 / 230);
  const ray = read('assets/fx/ford/transmute-ray/fx.json');
  assert.equal(ray.pivotX, 0);
  assert.equal(ray.cling.loop, true);
  assert.equal(beamDrawScale({ beamLen: 240, beamArtPx: 554, beamCap: 460, _beamScale: 3 }), 460 / 554);
  const foil = read('assets/fx/ford/gold-foil/fx.json');
  assert.equal(foil.black, false);
  assert.equal(foil.anchor, 'front');
  assert.equal(foil.block.frames, 6);
  assert.equal(foil.reflect.frames, 8);
  const reign = read('assets/fx/duke/long-reign/fx.json');
  assert.equal(reign.charge.scaleWith, 'survived');
  assert.equal(survivedPipAlpha(0), 0.2);
  assert.ok(Math.abs(survivedPipAlpha(6) - 0.6) < 1e-9);
  assert.equal(survivedPipAlpha(12), 1);
  const split = read('assets/fx/duke/fission-split/fx.json');
  assert.equal(split.arc.stretch, 'length');
  assert.equal(split.arc.file, 'fission-merge-zap-anim.png');
  const ion = read('assets/fx/duke/heavy-ion-bolt/fx.json');
  assert.equal(ion.impact.scaleTo, undefined);
  assert.equal(ion.impact.scale, 0.42);
  assert.equal(ion.aim, true);
  const barks = read('assets/fx/sarge/sound-off/fx.json');
  assert.equal(barks.charge.anchor, 'head');
  assert.equal(barks.glow.stackSeconds, true);
  assert.equal(barks.glow.frames, 6);
  assert.equal(barks.glow.rows, 6);
  assert.equal(stackPipIndex(6, 0), 0);
  assert.equal(stackPipIndex(6, 1000), 1);
  assert.equal(stackPipIndex(6, 2000), 2);
  assert.equal(stackPipIndex(6, 2850), 5);
  const flurry = read('assets/fx/sarge/six-count-flurry/fx.json');
  assert.equal(flurry.spark.frames, 5);
  assert.equal(flurry.impact.replacesSpark, true);
  const slab = read('assets/fx/sarge/periodic-shield/fx.json');
  assert.equal(slab.crackFrames, true);
  assert.equal(slab.frames, 4);
  assert.equal(slab.black, false);
  assert.equal(slab.anchor, 'front');
  const mortar = read('assets/fx/sarge/decay-mortar/fx.json');
  assert.equal(mortar.black, false);
  assert.equal(mortar.aim, true);
  assert.equal(mortar.impact.scaleTo, undefined);
  assert.equal(mortar.impact.scale, 0.42);
  assert.equal(mortar.trail.pivotX, 1);
  const slam = read('assets/fx/thor/thunder-hammer/fx.json');
  assert.equal(slam.scaleTo, 'radius');
  assert.equal(slam.flashRadius, 230);
  assert.ok(Math.abs(slam.pivotY - 287 / 533) < 1e-9);
  assert.equal(slam.charge.black, false);
  assert.equal(slam.charge.anchor, 'hand');
  assert.equal(slam.glow.scaleWith, 'alpha');
  assert.equal(slam.glow.rise, 0.85);
  assert.equal(impactRadiusScale({ radius: 58 }, slam), 58 / 230);
  const fuelJab = read('assets/fx/thor/fuel-rod-jab/fx.json');
  assert.equal(fuelJab.oneshot, true);
  assert.equal(fuelJab.fist.anchor, 'hand');
  assert.equal(fuelJab.fist.black, false);
  assert.equal(fuelJab.impact.frames, 10);
  const blanket = read('assets/fx/thor/breeder-blanket/fx.json');
  assert.equal(blanket.anchor, 'front');
  assert.equal(blanket.loop, true);
  assert.equal(blanket.absorb.frames, 12);
  assert.equal(blanket.glow.surgePips, true);
  assert.equal(blanket.glow.frames, 5);
  assert.equal(blanket.glow.rows, 5);
  assert.equal(blanket.glow.cols, 1);
  const reactor = read('assets/fx/thor/reactor-surge/fx.json');
  assert.equal(reactor.scaleWith, 'surge');
  assert.equal(reactor.pivotX, 0);
  assert.ok(Math.abs(reactor.pivotY - 200 / 256) < 1e-9);
  assert.equal(surgeBeamScale(0, 4), 0.5);
  assert.equal(surgeBeamScale(4, 4), 1);
  assert.equal(surgeAlpha({ _surge: 0, surgeCap: 4 }), 0.35);
  assert.equal(surgeAlpha({ _surge: 4, surgeCap: 4 }), 1);
  assert.equal(beamDrawScale({ beamLen: 360, beamArtPx: 620, _beamScale: 0.5 }), 180 / 620);
  assert.equal(beamDrawScale({ beamLen: 360, beamArtPx: 620, _beamScale: 1 }), 360 / 620);
  const leapFx = read('assets/fx/boar/quantum-leap/fx.json');
  assert.equal(leapFx.file, 'quantum-vanish-anim.png');
  assert.equal(leapFx.charge.anchor, 'body');
  assert.equal(leapFx.burst.scaleTo, undefined);
  assert.equal(leapFx.burst.scale, 0.42);
  assert.ok(Math.abs(leapFx.burst.pivotX - 287 / 575) < 1e-9);
  assert.ok(Math.abs(leapFx.burst.pivotY - 287 / 574) < 1e-9);
  const goreFx = read('assets/fx/boar/shell-gore/fx.json');
  assert.equal(goreFx.anchor, 'head');
  assert.equal(goreFx.loop, true);
  assert.equal(goreFx.impact.frames, 8);
  const waveForm = read('assets/fx/boar/complementarity/fx.json');
  assert.equal(waveForm.anchor, 'body');
  assert.equal(waveForm.ghost, 0.4);
  assert.equal(waveForm.loop, true);
  const lineFx = read('assets/fx/boar/spectral-line/fx.json');
  assert.equal(lineFx.pivotX, 0);
  assert.equal(lineFx.frames, 10);
  assert.equal(beamDrawScale({ beamLen: 300, beamArtPx: 600, beamCap: 560, _beamScale: 1 }), 300 / 600);
  assert.equal(beamDrawScale({ beamLen: 300, beamArtPx: 600, beamCap: 560, _beamScale: 3 }), 560 / 600);
  const sprintFx = read('assets/fx/dash/half-life-sprint/fx.json');
  assert.equal(sprintFx.oneshot, true);
  assert.equal(sprintFx.flip, true);
  assert.equal(sprintFx.charge.scaleWith, 'alpha');
  assert.equal(sprintFx.charge.anchor, 'body');
  const blinkFx = read('assets/fx/dash/blink-kick/fx.json');
  assert.equal(blinkFx.file, 'blink-dissolve-anim.png');
  assert.equal(blinkFx.impact.frames, 8);
  assert.deepEqual(reverseFrameOrder(blinkFx.frames), [7, 6, 5, 4, 3, 2, 1, 0]);
  const decayFx = read('assets/fx/dash/afterimage-decay/fx.json');
  assert.equal(decayFx.anchor, 'afterimage');
  assert.equal(decayFx.file, 'afterimage-tint-anim.png');
  assert.equal(decayFx.shatter.scaleTo, 'radius');
  assert.equal(decayFx.shatter.flashRadius, 230);
  assert.ok(Math.abs(decayFx.shatter.pivotY - 287 / 569) < 1e-9);
  assert.equal(impactRadiusScale({ hitRadius: 48 }, decayFx.shatter), 48 / 230);
  const dartFx = read('assets/fx/dash/darmstadt-dart/fx.json');
  assert.equal(dartFx.loop, true);
  assert.equal(dartFx.aim, true);
  assert.equal(dartFx.frames, 4);
  for (const id of ['polonius', 'tate', 'ronan', 'frank', 'ray', 'ace', 'pat', 'uri', 'neptune', 'pluto', 'einstein', 'fermi', 'mendel', 'amy', 'curie', 'burke', 'cali', 'lars', 'ford', 'duke', 'sarge', 'thor', 'boar', 'dash', 'noble', 'roger', 'niko', 'flo']) {
    for (const file of fs.readdirSync(`assets/fx/${id}`, { recursive: true })) {
      const name = String(file);
      assert.equal(name.endsWith('.gif') || name.endsWith('.jpg') || name.endsWith('.py'), false, `${id}/${name}`);
    }
  }
});

test('noble, roger, niko, and flo scale only the bright openings', () => {
  const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
  const vial = read('assets/fx/noble/nitroglycerin-vial/fx.json');
  assert.equal(vial.scaleTo, 'radius');
  assert.equal(vial.flashRadius, 230);
  assert.ok(Math.abs(vial.pivotX - 287 / 575) < 1e-9);
  assert.equal(vial.charge.tremble, true);
  assert.equal(vial.charge.black, false);
  assert.equal(vial.glow.scaleWith, 'alpha');
  assert.equal(impactRadiusScale({ radius: 60 }, vial), 60 / 230);
  const medal = read('assets/fx/noble/medal-swing/fx.json');
  assert.equal(medal.oneshot, true);
  assert.equal(medal.fist.file, 'prize-medal.png');
  assert.ok(Math.abs(medal.fist.pivotY - 6 / 176) < 1e-9);
  const truce = read('assets/fx/noble/peace-prize/fx.json');
  assert.equal(truce.anchor, 'body');
  assert.equal(truce.loop, true);
  assert.equal(truce.burst.frames, 12);
  const ions = read('assets/fx/noble/carbon-bombardment/fx.json');
  assert.equal(ions.loop, true);
  assert.equal(ions.impact.frames, 6);

  const flash = read('assets/fx/roger/skeleton-flash/fx.json');
  assert.equal(flash.scaleTo, 'radius');
  assert.equal(flash.flashRadius, 230);
  assert.ok(Math.abs(flash.pivotY - 262 / 512) < 1e-9);
  assert.equal(flash.impact.file, 'x-ray-flash-anim.png');
  assert.equal(impactRadiusScale({ hitRadius: 48 }, flash), 48 / 230);
  const ray = read('assets/fx/roger/penetrating-ray/fx.json');
  assert.equal(ray.pivotX, 0);
  assert.equal(beamDrawScale({ beamLen: 340, beamArtPx: 640, beamCap: 600, _beamScale: 1 }), 340 / 640);
  assert.equal(beamDrawScale({ beamLen: 340, beamArtPx: 640, beamCap: 600, _beamScale: 3 }), 600 / 640);
  const tube = read('assets/fx/roger/crookes-tube/fx.json');
  assert.equal(tube.black, false);
  assert.equal(tube.anchor, 'body');
  assert.equal(tube.shatter.frames, 8);
  const vision = read('assets/fx/roger/x-ray-vision/fx.json');
  assert.equal(vision.oneshot, true);
  assert.equal(vision.reticle.file, 'weak-spot-reticle.png');

  const sun = read('assets/fx/niko/rising-sun/fx.json');
  assert.equal(sun.scale, 0.42);
  assert.equal(sun.scaleTo, undefined);
  assert.equal(sun.charge.loop, false);
  const combo = read('assets/fx/niko/three-atom-combo/fx.json');
  assert.equal(combo.impact.replacesSpark, true);
  assert.equal(combo.spark.frames, 6);
  const wait = read('assets/fx/niko/nine-year-wait/fx.json');
  assert.equal(wait.fillHold, true);
  assert.equal(wait.frames, 36);
  assert.equal(wait.shatter.frames, 10);
  const zinc = read('assets/fx/niko/zinc-ion-beam/fx.json');
  assert.equal(zinc.pivotX, 0);
  assert.equal(beamDrawScale({ beamLen: 250, beamArtPx: 500, beamCap: 460, _beamScale: 1 }), 250 / 500);
  assert.equal(beamDrawScale({ beamLen: 250, beamArtPx: 500, beamCap: 460, _beamScale: 4 }), 460 / 500);

  const wave = read('assets/fx/flo/island-of-stability/fx.json');
  assert.equal(wave.scale, 0.42);
  assert.equal(wave.scaleTo, undefined);
  assert.ok(Math.abs(wave.pivotY - 287 / 480) < 1e-9);
  assert.equal(wave.cling.loop, true);
  const tide = read('assets/fx/flo/riptide/fx.json');
  assert.equal(tide.oneshot, true);
  assert.equal(tide.flip, true);
  const crisis = read('assets/fx/flo/identity-crisis/fx.json');
  assert.equal(crisis.loop, true);
  assert.equal(crisis.fps, 12);
  const orb = read('assets/fx/flo/magic-number/fx.json');
  assert.equal(orb.loop, true);
  assert.equal(orb.fizzle.frames, 10);
});
