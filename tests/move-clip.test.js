import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipPose,
  clipFrameCount,
  normalizeManifest,
  moveStripUrl,
  moveManifestUrl,
} from '../src/engine/moveClip.js';

const idle = { cellW: 609, cellH: 720, footY: 0.9823, visibleH: 668 };

test('4–8 frames scrub the strip and hold the last frame at t = 1', () => {
  assert.equal(clipPose(0, 8).frame, 0);
  assert.equal(clipPose(0.5, 8).frame, 4);
  assert.equal(clipPose(0.999, 8).frame, 7);
  assert.equal(clipPose(1, 8).frame, 7);
  assert.equal(clipPose(0.5, 8).mode, 'scrub');
  assert.equal(clipPose(0.5, 8).scaleX, 1);
  assert.equal(clipPose(0, 4).frame, 0);
  assert.equal(clipPose(1, 4).frame, 3);
});

test('1 frame stays on cell 0 and squashes then stretches', () => {
  const early = clipPose(0.1, 1);
  const strike = clipPose(0.5, 1);
  assert.equal(early.mode, 'tween');
  assert.equal(early.frame, 0);
  assert.equal(early.frameB, 0);
  assert.ok(early.scaleX > 1 && early.scaleY < 1);
  assert.ok(early.lunge < 0);
  assert.ok(strike.scaleY > 1 && strike.lunge > 0);
});

test('2 frames crossfade from anticipation into the strike', () => {
  const a = clipPose(0, 2);
  const b = clipPose(1, 2);
  assert.equal(a.frame, 0);
  assert.equal(a.frameB, 1);
  assert.equal(a.blend, 0);
  assert.equal(b.blend, 1);
  assert.ok(clipPose(0.34, 2).blend > 0 && clipPose(0.34, 2).blend < 1);
});

test('3 frames move anticipation, strike, then recovery', () => {
  const start = clipPose(0, 3);
  const mid = clipPose(0.45, 3);
  const end = clipPose(1, 3);
  assert.deepEqual([start.frame, start.frameB, start.blend], [0, 1, 0]);
  assert.deepEqual([mid.frame, mid.frameB, mid.blend], [0, 1, 1]);
  assert.deepEqual([end.frame, end.frameB, end.blend], [1, 2, 1]);
});

test('frame counts outside 1–8 are ignored', () => {
  assert.equal(clipFrameCount(0), null);
  assert.equal(clipFrameCount(9), null);
  assert.equal(clipPose(0.5, 0).ok, false);
  assert.equal(clipPose(0.5, 9).ok, false);
});

test('manifest cell size and footY default to the idle cell', () => {
  const norm = normalizeManifest({
    moves: {
      basicDirectional: { frames: 3 },
      specialDefense: { frames: 8, cellW: 400, footY: 0.9 },
      basicCharge: { frames: 12 },
    },
  }, idle);
  assert.deepEqual(norm.moves.basicDirectional, {
    frames: 3, cellW: 609, cellH: 720, footY: 0.9823, visibleH: 668,
  });
  assert.equal(norm.moves.specialDefense.cellW, 400);
  assert.equal(norm.moves.specialDefense.cellH, 720);
  assert.equal(norm.moves.specialDefense.footY, 0.9);
  assert.equal(norm.moves.basicCharge, undefined);
});

test('strip paths use the character id and the move key', () => {
  assert.equal(moveManifestUrl('hydra'), '/public/assets/sprites/moves/hydra/manifest.json');
  assert.equal(moveStripUrl('helen', 'basicCharge'), '/public/assets/sprites/moves/helen/basicCharge.png');
});
