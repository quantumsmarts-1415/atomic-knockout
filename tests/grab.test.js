import test from 'node:test';
import assert from 'node:assert/strict';
import { FEEL } from '../src/engine/feel.js';
import { resolveGrab } from '../src/engine/boxes.js';

test('grab feel constants exist for the walk-into clinch', () => {
  assert.ok(FEEL.grabArmMs > 0);
  assert.ok(FEEL.grabMaxMs > FEEL.grabArmMs);
  assert.ok(FEEL.grabEscapeMash >= 6);
  assert.ok(FEEL.grabThrowKb > 100);
});

test('resolveGrab is safe with stub fighters that have no mask book', () => {
  const mk = (id, x, facing, vx) => ({
    id,
    alive: true,
    x,
    y: 500,
    facing,
    state: 'walk',
    grounded: true,
    bodyW: 40,
    bodyH: 100,
    body: {
      velocity: { x: vx, y: 0 },
      blocked: { down: true },
      touching: { down: true },
      setVelocity() {},
      reset() {},
    },
    charDef: { id, stats: { weight: 1 } },
    input: {},
    beginGrab(victim, time) {
      this.state = 'grabbing';
      this.grabTarget = victim;
      victim.state = 'grabbed';
      victim.grabber = this;
      this._grabbedAt = time;
    },
  });

  const a = mk('a', 400, 1, 180);
  const b = mk('b', 430, -1, 0);
  assert.doesNotThrow(() => resolveGrab([a, b], 0, FEEL));
  assert.doesNotThrow(() => resolveGrab([a, b], FEEL.grabArmMs + 20, FEEL));
});
