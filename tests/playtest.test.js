import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { portraitCrop, portraitCropIds, portraitFile } from '../src/data/portraitCrops.js';
import { STAGES } from '../src/data/stages.js';
import { queueSelectPortraits } from '../src/engine/selectArt.js';
import { menuPortraitKey, FRINGE_PORTRAIT_IDS } from '../src/ui/portraits.js';
import { idleHalfWidth, connectsAt, sweepHitReach } from '../src/engine/hitReach.js';
import { STRIKE_MIRRORS } from '../src/engine/masks.js';

test('oxana normal kick is a carrying air ring', () => {
  const kick = CHARACTERS.oxana.moves.basicDirectional;
  assert.equal(kick.name, 'Vortex Kick');
  assert.equal(kick.kind, 'projectile');
  assert.equal(kick.shotEnd, 'pierce');
  assert.equal(kick.carry, true);
  assert.equal(kick.multiHit, 4);
  assert.ok(kick.damage * kick.multiHit >= 7 && kick.damage * kick.multiHit <= 12);
  assert.ok(kick.projectileSpeed > 200 && kick.projectileLife > 600);
});

test('brimstone caldera has no floating platform and locks the painted frame', () => {
  const st = STAGES.find((s) => s.id === 'brimstone-caldera');
  assert.equal(st.artLock, true);
  assert.equal(st.platforms.length, 0);
  assert.equal(st.solids.length, 1);
  assert.equal(st.groundY, 539);
});

test('every fighter has a face-centered portrait square', () => {
  const ids = Object.keys(CHARACTERS);
  assert.deepEqual(portraitCropIds().slice().sort(), ids.slice().sort());
  for (const id of ids) {
    const crop = portraitCrop(id);
    assert.ok(crop.frameW > 0 && crop.frameH > 0, id);
    assert.ok(crop.size > 0, id);
    assert.ok(crop.centerX > 0 && crop.centerX < crop.frameW, id);
    assert.ok(crop.centerY > 0 && crop.centerY < crop.frameH * 0.45, `${id} face sits high`);
    const png = PNG.sync.read(readFileSync(portraitFile(id)));
    assert.equal(png.width, png.height, id);
    assert.ok(png.width >= 64, id);
  }
  const lillie = portraitCrop('lillie');
  assert.equal(lillie.method, 'manual');
  assert.equal(lillie.size, 150);
  assert.ok(portraitCrop('oxana').centerY < portraitCrop('oxana').frameH * 0.3);
});

test('lillie walk is the 12-frame modesty redraw', () => {
  const walk = CHARACTERS.lillie.art.sheets.clips.walk;
  assert.deepEqual(walk, {
    count: 12,
    fps: 9.93,
    loop: true,
    frameW: 482,
    frameH: 715,
    footY: 0.9818,
    visibleH: 678,
    bodyH: 678,
    displayScale: 118 / 678,
  });
  const png = PNG.sync.read(readFileSync('art-src/gemini-test/sheets/lillie_walk.png'));
  assert.equal(png.width, 482 * 4);
  assert.equal(png.height, 715 * 3);
});

test('select preload queues face portraits, including the old checker cuts', () => {
  const queued = [];
  const n = queueSelectPortraits({
    image(key, file) { queued.push({ key, file }); },
  }, () => false);
  assert.ok(n >= Object.keys(CHARACTERS).length * 2);
  for (const id of FRINGE_PORTRAIT_IDS) {
    assert.equal(menuPortraitKey(CHARACTERS[id]), `portrait-${id}`);
    assert.ok(queued.some((q) => q.key === `portrait-${id}` && q.file === portraitFile(id)), id);
  }
  assert.ok(queued.every((q) => !q.file.includes('fey_idle')));
});

test('fringe face squares have no baked transparency checker', () => {
  for (const id of FRINGE_PORTRAIT_IDS) {
    const png = PNG.sync.read(readFileSync(portraitFile(id)));
    let hidden = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] === 0 && (png.data[i] || png.data[i + 1] || png.data[i + 2])) hidden += 1;
    }
    assert.equal(hidden, 0, `${id} stores checker RGB in transparent pixels`);
    let differ = 0;
    let match = 0;
    const period = 8;
    for (let y = 0; y < png.height - period * 2; y += 3) {
      for (let x = 0; x < png.width - period * 2; x += 3) {
        const at = (px) => {
          const o = (y * png.width + px) * 4;
          return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
        };
        const a = at(x);
        const b = at(x + period);
        const c = at(x + period * 2);
        if (a[3] < 40 || b[3] < 40) continue;
        const close = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])) < 18;
        if (!close(a, b) && close(a, c) && Math.abs(a[0] + a[1] + a[2] - (b[0] + b[1] + b[2])) > 50) differ += 1;
        else if (close(a, b)) match += 1;
      }
    }
    assert.ok(differ < match, `${id} reads as an ${period}px checker (${differ} vs ${match})`);
  }
  const cut = PNG.sync.read(readFileSync('art-src/helen-cut.png'));
  let cutHidden = 0;
  for (let i = 0; i < cut.data.length; i += 4) {
    const a = cut.data[i + 3];
    if (a === 0 && cut.data[i] > 160 && Math.abs(cut.data[i] - cut.data[i + 1]) < 8) cutHidden += 1;
  }
  assert.ok(cutHidden > 100000, 'helen cut still carries the checker the discs must not use');
});

test('hurtboxes are symmetric and Aaron hits Titan from both sides', () => {
  for (const id of Object.keys(CHARACTERS)) {
    const span = idleHalfWidth(id);
    if (!span) continue;
    assert.ok(Math.abs(span.left - span.right) < 1.5, `${id} ${span.left} ${span.right}`);
  }
  for (const gap of [16, 32, 48]) {
    assert.equal(connectsAt('aaron', 'titan', 'basicDirectional', gap, 1), true, `left ${gap}`);
    assert.equal(connectsAt('aaron', 'titan', 'basicDirectional', gap, -1), true, `right ${gap}`);
  }
  assert.ok(STRIKE_MIRRORS.length > 0);
});

test('melee reach sweep has no one-sided attacks', () => {
  const report = sweepHitReach();
  const one = report.issues.filter((row) => row.kind === 'one-side');
  assert.equal(one.length, 0);
  assert.ok(report.checked > 100000);
});
