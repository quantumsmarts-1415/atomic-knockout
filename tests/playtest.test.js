import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import { STAGES } from '../src/data/stages.js';
import { queueSelectPortraits } from '../src/engine/selectArt.js';
import { menuPortraitKey, FRINGE_PORTRAIT_IDS } from '../src/ui/portraits.js';
import { idleHalfWidth, connectsAt, sweepHitReach } from '../src/engine/hitReach.js';
import { STRIKE_MIRRORS } from '../src/engine/masks.js';
import { advanceSafeLoad } from '../src/engine/safeLoad.js';

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

test('damage discs use the cut, and checker cuts stay on the symbol', () => {
  assert.equal(menuPortraitKey(CHARACTERS.hydra), 'char-hydra');
  assert.equal(menuPortraitKey(CHARACTERS.lillie), 'char-lillie');
  for (const id of FRINGE_PORTRAIT_IDS) assert.equal(menuPortraitKey(CHARACTERS[id]), null, id);
  const queued = [];
  const n = queueSelectPortraits({
    image(key, file) { queued.push({ key, file }); },
  }, () => false);
  assert.equal(n, Object.keys(CHARACTERS).length);
  assert.ok(queued.some((q) => q.key === 'char-helen' && q.file === CHARACTERS.helen.art.file));
  assert.ok(queued.every((q) => !String(q.key).startsWith('portrait-')));
  assert.ok(queued.every((q) => !String(q.file).includes('assets/portraits/')));
});

test('a stalled art load skips the hung file and keeps pulling the queue', () => {
  const skipped = [];
  const warnings = [];
  const prev = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  const hung = {
    key: 'char-hung',
    url: 'hung.png',
    state: 11,
    __akSeen: 0,
    xhrLoader: {
      abort() { this.aborted = true; },
    },
  };
  const inflight = {
    size: 1,
    getArray() { return [hung]; },
    contains(file) { return file === hung && this.size > 0; },
  };
  const list = { size: 2, getArray() { return []; } };
  const queue = { size: 0, getArray() { return []; } };
  let nudged = 0;
  const loader = {
    state: 1,
    maxParallelDownloads: 4,
    list,
    inflight,
    queue,
    checkLoadQueue() { nudged += 1; },
    nextFile(file, ok) {
      assert.equal(file, hung);
      assert.equal(ok, false);
      inflight.size = 0;
    },
  };
  try {
    advanceSafeLoad(loader, 50000, 20000, skipped);
  } finally {
    console.warn = prev;
  }
  assert.equal(hung.xhrLoader.aborted, true);
  assert.deepEqual(skipped, ['char-hung']);
  assert.equal(nudged, 1);
  assert.ok(warnings.some((line) => line.includes('timeout') && line.includes('char-hung')));
});

test('lillie walk is the 33-frame sheet that matches her masks', () => {
  const walk = CHARACTERS.lillie.art.sheets.clips.walk;
  assert.deepEqual(walk, {
    count: 33,
    fps: 10,
    loop: true,
    frameW: 692,
    frameH: 706,
    footY: 0.9929,
    visibleH: 634,
    bodyH: 634,
    displayScale: 0.18612,
  });
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
