import test from 'node:test';
import assert from 'node:assert/strict';
import { hudLayout, fitLabelSize } from '../src/ui/hudLayout.js';

const W = 1280;
const H = 720;

function assertInside(n) {
  const slots = hudLayout(n, W, H);
  assert.equal(slots.length, n);
  for (const slot of slots) {
    assert.ok(slot.left >= 8, `${n} players: panel starts at ${slot.left}`);
    assert.ok(slot.right <= W - 8, `${n} players: panel ends at ${slot.right}`);
    assert.ok(slot.top >= 0 && slot.bottom <= H, `${n} players: panel leaves the screen vertically`);
    assert.ok(slot.panelW >= 160, `${n} players: panel is ${slot.panelW}px wide`);
  }
  const ordered = [...slots].sort((a, b) => a.left - b.left);
  for (let i = 1; i < ordered.length; i++) {
    const gap = ordered[i].left - ordered[i - 1].right;
    assert.ok(gap >= 8, `${n} players: panels overlap or sit ${gap}px apart`);
  }
}

test('2, 3, and 4 player HUD panels stay on screen and do not overlap', () => {
  for (const n of [2, 3, 4]) assertInside(n);
});

test('a 1v1 keeps the corner panels', () => {
  const [a, b] = hudLayout(2, W, H);
  assert.ok(Math.abs(a.x - 240) < 0.5);
  assert.ok(Math.abs(b.x - (W - 240)) < 0.5);
  assert.equal(a.panelW, 260);
});

test('a long CPU label shrinks instead of running into the percent', () => {
  const size = fitLabelSize('Scarlett · S (CPU)', 120, 16, 11);
  assert.ok(size < 16);
  assert.ok(size >= 11);
  assert.ok('Tara · Ta (CPU)'.length * size * 0.56 <= 160);
});
