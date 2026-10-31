import test, { mock } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
mock.module(require.resolve('phaser'), {
  namedExports: {
    Math: { Clamp: (v, min, max) => Math.min(Math.max(v, min), max) },
    Geom: { Rectangle: class {} },
    Scene: class Scene {},
    GameObjects: { Container: class { constructor(s, x, y) { this.scene = s; this.x = x; this.y = y; } setSize() {} setPosition() {} add() {} setVisible() {} }, Sprite: class {} },
    BlendModes: { ADD: 1, NORMAL: 0 },
  },
});
const { default: Fighter } = await import('../src/engine/Fighter.js');

// Hitlag skips the main update and only runs captureEdges. A charge released in that window used to lose its release edge.
function fake(state, held, prevHeld) {
  const buffered = [];
  return { state, input: { attack: held, special: false, jump: false }, _prev: { attack: prevHeld, special: false, jump: false }, pushBuffer: (t, p) => buffered.push(p), buffered };
}

test('a charge button released during hitlag keeps its release edge', () => {
  const f = fake('charging', false, true);
  Fighter.prototype.captureEdges.call(f, 1000);
  assert.equal(f._prev.attack, true, 'the next normal update must still see "released"');
});

test('outside a charge the held state is tracked as before', () => {
  const idle = fake('idle', false, true);
  Fighter.prototype.captureEdges.call(idle, 1000);
  assert.equal(idle._prev.attack, false);
  const charging = fake('charging', true, true);
  Fighter.prototype.captureEdges.call(charging, 1000);
  assert.equal(charging._prev.attack, true);
  const press = fake('attack', true, false);
  Fighter.prototype.captureEdges.call(press, 1000);
  assert.equal(press._prev.attack, true);
  assert.equal(press.buffered.length, 1);
});
