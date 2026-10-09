import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateBody, clipBodyLayout, summarizeBodies, combineBody, elbowFoot, elbowHead } from '../src/engine/bodyLayout.js';

function fill(frameH, spans) {
  const counts = new Int32Array(frameH);
  for (const [y0, y1, n] of spans) {
    for (let y = y0; y <= y1; y++) counts[y] = n;
  }
  return counts;
}

test('a hair spike and a hem stay out of and in the body', () => {
  // Thin hair, a one-row hair puff, then a head and a coat that narrows at the hem.
  const counts = fill(720, [
    [16, 36, 12],
    [40, 50, 90],
    [56, 74, 8],
    [80, 700, 80],
    [701, 712, 40],
  ]);
  counts[400] = 300;
  const body = estimateBody(counts, 720);
  assert.ok(body.bodyTop >= 76 && body.bodyTop <= 84, `head ${body.bodyTop}`);
  assert.ok(body.foot >= 708, `foot ${body.foot}`);
  assert.ok(body.bodyH < body.fullH);
});

test('a sparse glow under the shoes does not drop the foot line', () => {
  const counts = fill(400, [
    [40, 320, 100],
    [321, 390, 6],
  ]);
  counts[180] = 220;
  const body = estimateBody(counts, 400);
  assert.ok(body.foot <= 324, `foot ${body.foot}`);
  assert.ok(body.foot >= 318, `foot ${body.foot}`);
});

test('standing height ignores a crouch in the same clip', () => {
  const stand = { foot: 100, bodyTop: 20, bodyH: 81, top: 10, fullH: 91 };
  const crouch = { foot: 100, bodyTop: 40, bodyH: 61, top: 30, fullH: 71 };
  const summary = summarizeBodies([crouch, crouch, stand, stand, stand], 128);
  assert.equal(summary.bodyH, 81);
  assert.equal(summary.foot, 100);
});

test('a side lock of hair can move the crown down, a tiny sole wisp cannot', () => {
  const full = { top: 14, bot: 708, bodyTop: 40, foot: 708, fullH: 695, bodyH: 669 };
  const body = combineBody(full, { bodyTop: 78 }, { foot: 700 });
  assert.equal(body.bodyTop, 78);
  assert.equal(body.foot, 708);
});

test('a glow hanging under the shoes is not the foot line', () => {
  const full = { top: 16, bot: 1270, bodyTop: 16, foot: 1270, fullH: 1255, bodyH: 1255 };
  const body = combineBody(full, { bodyTop: 40 }, { foot: 1004 });
  assert.equal(body.foot, 1004);
  assert.ok(body.bodyH < 1100);
});

test('a window that would cut off the head is ignored', () => {
  const full = { top: 8, bot: 680, bodyTop: 20, foot: 670, fullH: 673, bodyH: 651 };
  const body = combineBody(full, { bodyTop: 300 }, { foot: 670 });
  assert.equal(body.bodyTop, 20);
});

test('the foot line stops where a wider window starts including a glow', () => {
  assert.equal(elbowFoot([894, 937, 1109, 1279]), 937);
  assert.equal(elbowFoot([700, 704, 708]), 708);
});

test('the crown stays narrow unless that window missed the skull', () => {
  assert.equal(elbowHead([73, 70]), 70);
  assert.equal(elbowHead([109, 43, 40]), 43);
});

test('clip layout fits the body to the display height', () => {
  const layout = clipBodyLayout(138, { footY: 0.97, bodyH: 600, visibleH: 690 }, {});
  assert.equal(layout.bodyH, 600);
  assert.equal(layout.visibleH, 600);
  assert.ok(Math.abs(layout.displayScale - 138 / 600) < 1e-9);
});

test('a stored displayScale is the scale that gets applied', () => {
  const layout = clipBodyLayout(138, { footY: 0.9, visibleH: 100 }, { displayScale: 0.2, bodyH: 500, footY: 0.95 });
  assert.equal(layout.displayScale, 0.2);
  assert.equal(layout.footY, 0.95);
  assert.equal(layout.bodyH, 500);
});
