import test from 'node:test';
import assert from 'node:assert';
import {
  FEEL, hitlagFrames, frameData, smashUnits, hitstunFrames, decayLaunch,
  launchVelocity, applyDI, leavesBlast, stripIndex, takeBuffered,
  poseTarget, launchWeight, hitlagShake, frameZoom, easeOutBack,
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

test('attack poses wind up, lunge along the swing, and overshoot on the way out', () => {
  const wind = poseTarget('attack', { facing: 1, phase: 'startup' });
  assert.strictEqual(wind.x, -8);
  assert.strictEqual(wind.sx, 1.08);
  assert.strictEqual(wind.sy, 0.92);
  const strike = poseTarget('attack', { facing: 1, phase: 'active' });
  assert.strictEqual(strike.x, 14);
  assert.strictEqual(strike.sx, 1.1);
  assert.ok(strike.sx > strike.sy);
  const back = poseTarget('attack', { facing: -1, phase: 'startup' });
  assert.strictEqual(back.x, 8);
  const follow = poseTarget('attack', { facing: 1, phase: 'recovery', recT: 0 });
  assert.ok(follow.x >= 14 && follow.x <= 18);
  const mid = poseTarget('attack', { facing: 1, phase: 'recovery', recT: 0.5 });
  assert.ok(mid.x < -4, `follow-through should overshoot, got ${mid.x}`);
  const rest = poseTarget('attack', { facing: 1, phase: 'recovery', recT: 1 });
  assert.ok(Math.abs(rest.x) < 0.01);
  assert.ok(easeOutBack(0.5) > 1);
  const land = poseTarget('idle', { landing: true, facing: 1 });
  assert.strictEqual(land.sx, 1.15);
  assert.strictEqual(land.sy, 0.85);
});

test('launch weight floors light gases and hitlag shake stays horizontal', () => {
  assert.strictEqual(launchWeight(0.624), FEEL.launchWeightFloor);
  assert.strictEqual(launchWeight(1.113), 1.113);
  assert.ok(FEEL.launchWeightFloor >= 0.86 && FEEL.launchWeightFloor <= 0.9);
  const light = hitlagShake(4, 0);
  const heavy = hitlagShake(20, 1);
  assert.strictEqual(light.y, 0);
  assert.strictEqual(heavy.y, 0);
  assert.ok(light.x >= 3 && light.x <= 4);
  assert.strictEqual(heavy.x, -5);
  const tight = frameZoom(80, 80, 1280, 720, 1, FEEL.camMax1);
  assert.ok(tight <= FEEL.camMax1);
  assert.ok(tight < 1.35);
});

test('attack strips hold contact instead of spreading frames evenly', () => {
  const fd = frameData(240, 700);
  const strike = stripIndex(6, fd, fd.startup);
  const contact = stripIndex(6, fd, fd.startup + fd.active);
  assert.strictEqual(strike, 2);
  assert.strictEqual(contact, 3);
  assert.strictEqual(stripIndex(6, fd, 0), 0);
});
