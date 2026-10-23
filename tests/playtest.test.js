import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import { portraitCrop, portraitCropIds } from '../src/data/portraitCrops.js';
import { STAGES } from '../src/data/stages.js';
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

test('every fighter has a face crop, and Lillie and Oxana are not centered on a wide cut', () => {
  for (const c of Object.values(CHARACTERS)) {
    const crop = portraitCrop(c.id);
    assert.ok(crop.cx > 0.1 && crop.cx < 0.9, c.id);
    assert.ok(crop.cy > 0.02 && crop.cy < 0.6, c.id);
    assert.ok(crop.zoom >= 3 && crop.zoom <= 8, c.id);
  }
  assert.ok(portraitCropIds().length >= 100);
  assert.ok(portraitCrop('lillie').cx > 0.6);
  assert.ok(portraitCrop('oxana').cy < 0.25);
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
