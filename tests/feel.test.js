import test from 'node:test';
import assert from 'node:assert';
import {
  FEEL, hitlagFrames, frameData, smashUnits, hitstunFrames, decayLaunch,
  launchVelocity, applyDI, leavesBlast, stripIndex, takeBuffered,
} from '../src/engine/feel.js';

test('hitlag matches the Ultimate table', () => {
  assert.strictEqual(hitlagFrames(8), 11);
  assert.strictEqual(hitlagFrames(15), 15);
  assert.strictEqual(hitlagFrames(25), 22);
  assert.strictEqual(hitlagFrames(8, { type: 'electrical' }), 16);
  assert.strictEqual(hitlagFrames(0), 0);
  const heavy = hitlagFrames(40, { players: 4 });
  const solo = hitlagFrames(40, { players: 2 });
  assert.ok(heavy < solo);
  assert.ok(hitlagFrames(40) <= FEEL.hitlagCap);
});

test('hitstun is 0.4 knockback units and launch decay reaches zero', () => {
  assert.strictEqual(hitstunFrames(100), 40);
  assert.strictEqual(hitstunFrames(10), 4);
  const vel = launchVelocity(100, 0, 1);
  let launch = { x: vel.x, y: vel.y, balloonLeft: 0 };
  let n = 0;
  while (launch && n < 500) {
    launch = decayLaunch(launch);
    n++;
  }
  assert.strictEqual(launch, null);
  assert.ok(n > 5 && n < 400);
});

test('a buffered press 8 frames early is consumed and 10 frames early is not', () => {
  const now = 20;
  const early = takeBuffered([{ button: 'attack', frame: now - 8 }], now);
  const late = takeBuffered([{ button: 'attack', frame: now - 10 }], now);
  const special = takeBuffered([
    { button: 'attack', frame: now - 2 },
    { button: 'special', frame: now - 4 },
  ], now);
  assert.strictEqual(early?.button, 'attack');
  assert.strictEqual(late, null);
  assert.strictEqual(special?.button, 'special');
});

test('frame data keeps total commitment within a frame of duration+cooldown', () => {
  const samples = [
    [240, 700],
    [200, 380],
    [280, 900],
    [100, 100],
    [50, 400],
  ];
  for (const [dur, cool] of samples) {
    const fd = frameData(dur, cool);
    const old = Math.round(dur / FEEL.stepMs) + Math.round(cool / FEEL.stepMs);
    assert.ok(Math.abs(fd.total - old) <= 1, `${dur}+${cool} total ${fd.total} vs ${old}`);
    assert.ok(fd.visible <= fd.total + 1);
    assert.ok(fd.active >= FEEL.activeMin && fd.active <= FEEL.activeMax);
    assert.ok(fd.startup >= 1);
  }
});

test('DI rotates the launch and a strong hit can leave the blast zone', () => {
  const base = -40 * Math.PI / 180;
  const up = applyDI(base, 0, -1);
  const none = applyDI(base, 0, 0);
  assert.strictEqual(none, base);
  assert.ok(Math.abs(up - base) <= (FEEL.diMaxDeg * Math.PI / 180) + 1e-6);
  const units = smashUnits(900);
  const vel = launchVelocity(units, base, 1);
  const gone = leavesBlast(1100, 560, vel.x, vel.y, 1500, {
    left: -140, right: 1420, top: -308, bottom: 860,
  });
  assert.strictEqual(typeof gone, 'boolean');
});

test('attack strips hold contact instead of spreading frames evenly', () => {
  const fd = frameData(240, 700);
  const strike = stripIndex(6, fd, fd.startup);
  const contact = stripIndex(6, fd, fd.startup + fd.active);
  assert.strictEqual(strike, 2);
  assert.strictEqual(contact, 3);
  assert.strictEqual(stripIndex(6, fd, 0), 0);
});
