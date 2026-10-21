import assert from 'node:assert/strict';
import test from 'node:test';
import { beamDrawScale } from '../src/engine/fxArt.js';
import { circleHitsSolid, clipBeam, segmentHitsSolid, stageSolids } from '../src/engine/beamClip.js';

const near = {
  kind: 'fighter',
  target: 'near',
  box: { left: 120, right: 160, top: 80, bottom: 180 },
};
const far = {
  kind: 'fighter',
  target: 'far',
  box: { left: 300, right: 340, top: 80, bottom: 180 },
};
const pillar = {
  kind: 'solid',
  box: { left: 200, right: 240, top: 40, bottom: 220, ground: false },
};
const ground = {
  kind: 'solid',
  ground: true,
  box: { left: 0, right: 900, top: 560, bottom: 960, ground: true },
};

function beam(over = {}) {
  return { x: 0, y: 120, dx: 1, dy: 0, maxLen: 400, thick: 0, ...over };
}

test('a beam stops on the nearer fighter and does not reach the one behind', () => {
  const clip = clipBeam(beam(), [far, near]);
  assert.equal(clip.hit.target, 'near');
  assert.equal(clip.length, 120);
  assert.equal(clip.hits.length, 1);
  assert.ok(clip.length < far.box.left);
});

test('a fighter behind the muzzle is not hit', () => {
  const behind = {
    kind: 'fighter',
    target: 'behind',
    box: { left: -80, right: -20, top: 80, bottom: 180 },
  };
  const clip = clipBeam(beam(), [behind, far]);
  assert.equal(clip.hit.target, 'far');
  assert.equal(clip.hits.some((h) => h.target === 'behind'), false);
});

test('a solid in front of a fighter stops the beam', () => {
  const clip = clipBeam(beam(), [far, pillar]);
  assert.equal(clip.hit.kind, 'solid');
  assert.equal(clip.length, 200);
  assert.equal(clip.hits.length, 0);
});

test('pierce keeps the full length and still lists fighters past a solid', () => {
  const clip = clipBeam(beam(), [pillar, near, far], { pierce: true });
  assert.equal(clip.length, 400);
  assert.equal(clip.hit, null);
  assert.deepEqual(clip.hits.map((h) => h.target), ['near', 'far']);
});

test('a horizontal beam over the ground is not clipped to nothing', () => {
  const overIsland = beam({ x: 200, y: 580, maxLen: 300, thick: 40 });
  const clip = clipBeam(overIsland, [ground]);
  assert.equal(clip.length, 300);
  assert.equal(clip.hit, null);
});

test('a downward beam stops on the ground', () => {
  const down = beam({ x: 100, y: 400, dx: 0, dy: 1, maxLen: 300 });
  const clip = clipBeam(down, [ground]);
  assert.equal(clip.hit.kind, 'solid');
  assert.equal(clip.length, 160);
});

test('a muzzle already inside a pillar has no reach', () => {
  const clip = clipBeam(beam({ x: 220, y: 120, maxLen: 200 }), [pillar]);
  assert.equal(clip.length, 0);
  assert.equal(clip.hit.kind, 'solid');
});

test('a projectile circle hits a pillar and misses open air above the ground', () => {
  const solids = [
    { left: 100, right: 140, top: 400, bottom: 560, ground: false },
    { left: 0, right: 800, top: 560, bottom: 960, ground: true },
  ];
  assert.ok(circleHitsSolid(120, 480, 8, solids));
  assert.ok(circleHitsSolid(93, 480, 8, solids));
  assert.equal(circleHitsSolid(90, 480, 8, solids), null);
  assert.equal(circleHitsSolid(400, 500, 8, solids), null);
  assert.equal(circleHitsSolid(400, 555, 8, solids), null);
  assert.ok(circleHitsSolid(400, 564, 8, solids));
  const through = segmentHitsSolid(0, 480, 200, 480, 8, solids);
  assert.ok(through);
  assert.ok(through.x < 100);
  const roll = segmentHitsSolid(0, 570, 400, 570, 8, solids, { ignoreGround: true });
  assert.equal(roll, null);
  const rollPillar = segmentHitsSolid(0, 480, 200, 480, 8, solids, { ignoreGround: true });
  assert.ok(rollPillar);
});

test('stage solids treat a heightless slab as ground and a pillar as a wall', () => {
  const solids = stageSolids({
    groundY: 560,
    solids: [
      { x: 640, w: 990 },
      { x: 640, y: 490, w: 80, h: 70 },
    ],
  });
  assert.equal(solids[0].ground, true);
  assert.equal(solids[0].top, 560);
  assert.equal(solids[1].ground, false);
  assert.equal(solids[1].top, 490);
  assert.equal(solids[1].bottom, 560);
  assert.equal(solids[1].left, 600);
});

test('beam draw scale stays put until a clip shortens the reach', () => {
  const move = { beamLen: 440, beamArtPx: 440, beamCap: 440, _beamScale: 1 };
  assert.equal(beamDrawScale(move), 1);
  assert.equal(beamDrawScale({ ...move, _beamReach: 180 }), 180 / 440);
  assert.equal(beamDrawScale({ beamLen: 160, _beamScale: 1.5, _beamReach: 40 }), 1.5);
});
