import test from 'node:test';
import assert from 'node:assert';
import { frameData } from '../src/engine/feel.js';
import { CHARACTERS } from '../src/data/characters.js';
import { HIT_HOLD_F } from '../src/data/hitTiming.js';

const STEP = 1000 / 60;

test('hitHoldF moves frames from endlag into the active window and keeps the move the same length', () => {
  const plain = frameData(240, 600, { startupF: 4 }, STEP);
  const held = frameData(240, 600, { startupF: 4, hitHoldF: 6 }, STEP);
  assert.equal(held.startup, plain.startup);
  assert.equal(held.active, plain.active + 6);
  assert.equal(held.recovery, plain.recovery - 6);
  assert.equal(held.visible, plain.visible);
  assert.equal(held.total, plain.total);
});

test('hitHoldF never eats the last two frames of endlag', () => {
  const held = frameData(240, 0, { hitHoldF: 99 }, STEP);
  assert.equal(held.recovery, 2);
});

test('every listed move carries its hold and keeps startup and visible length', () => {
  let n = 0;
  for (const [id, slots] of Object.entries(HIT_HOLD_F)) {
    for (const [key, frames] of Object.entries(slots)) {
      const mv = CHARACTERS[id].moves[key];
      assert.equal(mv.hitHoldF, frames, `${id}.${key}`);
      const base = frameData(mv.duration, mv.cooldown ?? 0, { ...mv, hitHoldF: 0 }, STEP);
      const now = frameData(mv.duration, mv.cooldown ?? 0, mv, STEP);
      assert.equal(now.startup, base.startup, `${id}.${key} startup`);
      assert.equal(now.visible, base.visible, `${id}.${key} visible`);
      assert.ok(now.active > base.active, `${id}.${key} active grows`);
      n++;
    }
  }
  assert.ok(n >= 20);
});
