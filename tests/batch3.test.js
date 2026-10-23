import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVESETS } from '../src/data/movesets.js';
import { ERIN, LIV, PAULA, RHODA, SANDY, TESS, YARA, YVETTE, ZORA } from '../src/data/batch3.js';
import { clockPerfect, fanVelocity, gambleFizzle, glideAim, inPinZone, nearestInFront } from '../src/engine/batch3.js';
import { interceptHit } from '../src/engine/defense.js';
import { prepareMove, stripProtection } from '../src/engine/kit.js';
import { resolvePacket } from '../src/data/balance.js';
import { coatSpec } from '../src/engine/coat.js';
import { mulberry32 } from '../src/engine/rng.js';

const kit = (id) => MOVESETS[id];

test('batch 3 kits match the approved names and flags', () => {
  const names = (id) => Object.values(kit(id)).map((m) => m.name);
  assert.deepEqual(names('yara'), ['Maglev Launch', 'Garnet Cut', 'Flux Pin', 'Ytterby Mine']);
  assert.deepEqual(names('zora'), ['Ceramic Blade', 'Cubic Cut', 'Zircaloy Cladding', 'Counterfeit Gem']);
  assert.deepEqual(names('rhoda'), ['Catalytic Converter', 'Rose Thorn', 'Tarnish Guard', 'High Beam']);
  assert.deepEqual(names('paula'), ['Cold Fusion', 'White Gold Jab', 'Hydrogen Sponge', 'Fuel Cell Bolt']);
  assert.deepEqual(names('sandy'), ['Tin Cry', 'Sledge Slam', 'Tin Pest', 'Tin Can Kick']);
  assert.deepEqual(names('erin'), ['Undersea Cable', 'Pink Glass Swipe', 'Signal Repeater', 'Resurface Laser']);
  assert.deepEqual(names('yvette'), ['Lattice Clock', 'Stress Gauge', 'Seismic Read', 'Fiber Laser']);
  assert.deepEqual(names('liv'), ['192 Beams', 'Chalcogen Hook', 'Hohlraum', 'Last Instant']);
  assert.deepEqual(names('tess'), ['Electron Hunger', 'Last Halogen', 'Smoky Haze', 'Six-Atom Spread']);

  const yara = kit('yara');
  assert.equal(yara.basicDirectional.type2, undefined);
  assert.equal(yara.basicCharge.floatRise, YARA.risePx);
  assert.equal(yara.basicCharge.aimOnRelease, true);
  assert.equal(yara.basicCharge.passThrough, true);
  assert.equal(yara.specialDefense.pinFreeze, true);
  assert.equal(yara.specialDefense.pinProjectiles.front, YARA.pinFront);
  assert.equal(yara.specialDirectional.kind, 'mine');
  assert.equal(yara.specialDirectional.mineMax, YARA.mineMax);
  assert.equal(yara.specialDirectional.mineArmMs, YARA.mineArmMs);
  assert.ok(yara.basicCharge.fxSheets.includes('maglev-frost-aura-sheet'));

  const zora = kit('zora');
  assert.equal(zora.basicCharge.ignoreReductions, true);
  assert.equal(zora.basicCharge.breaksBlock, undefined);
  assert.equal(zora.basicCharge.chargeRangeMult, ZORA.bladeReach);
  assert.deepEqual(zora.specialDefense.immune, ['radiation', 'heat']);
  assert.equal(zora.specialDirectional.fxReuse.projectile, 'carter/diamond-shard');
  assert.equal(coatSpec(zora.specialDefense).color, 0x6e747c);

  const rhoda = kit('rhoda');
  assert.equal(rhoda.basicCharge.kind, 'buff');
  assert.equal(rhoda.basicCharge.eatZones.gas, true);
  assert.equal(rhoda.basicCharge.eatZones.stackPercent, RHODA.stackBonus);
  assert.equal(rhoda.basicCharge.eatZones.stackMax, RHODA.stackMax);
  assert.equal(rhoda.specialDefense.reduceTypes.heat, RHODA.heatTaken);
  assert.equal(rhoda.specialDefense.reduceTypes.kinetic, RHODA.kineticTaken);
  assert.equal(rhoda.specialDirectional.coneDeg, RHODA.coneDeg);
  assert.equal(rhoda.specialDirectional.onHit.dazzle.ms, RHODA.dazzleMs);
  assert.equal(coatSpec(rhoda.specialDefense).gloss > 0.4, true);

  const paula = kit('paula');
  assert.equal(paula.basicCharge.fizzleCoin, undefined);
  assert.equal(paula.basicCharge.selfDamage, undefined);
  assert.equal(paula.basicCharge.gamble.fullOdds, PAULA.fullOdds);
  assert.equal(paula.basicCharge.gamble.partialOdds, PAULA.partialOdds);
  assert.equal(paula.basicCharge.gamble.partialAfterMs, PAULA.partialAfterMs);
  assert.equal(paula.specialDefense.absorbGas, true);
  assert.equal(paula.specialDefense.absorbHeal, PAULA.spongeHeal);
  assert.equal(paula.specialDirectional.gasBolt, PAULA.boltDouble);

  const sandy = kit('sandy');
  assert.equal(sandy.basicDirectional.baseKnockback, SANDY.sledgeKnockback);
  assert.equal(sandy.basicCharge.onHit.kineticTaken.mult, SANDY.kinTaken);
  assert.equal(sandy.basicCharge.onHit.kineticTaken.ms, SANDY.kinTakenMs);
  assert.equal(sandy.specialDefense.passThrough, true);
  assert.equal(sandy.specialDefense.takenWhile.chemical, SANDY.pestChem);
  assert.equal(sandy.specialDirectional.can.floor, SANDY.canFloorBounces);
  assert.equal(sandy.specialDirectional.can.walls, SANDY.canWallRicochets);
  assert.equal(coatSpec({ name: 'Tin Cry' }).matte, true);

  const erin = kit('erin');
  assert.equal(erin.basicCharge.ground, true);
  assert.equal(erin.basicCharge.slam, true);
  assert.deepEqual(erin.specialDefense.reflectTypes, ['electrical', 'radiation']);
  assert.equal(erin.specialDefense.reflectPower, ERIN.reflectPower);
  assert.equal(erin.specialDirectional.stripProtection, true);

  const yvette = kit('yvette');
  assert.equal(yvette.basicCharge.clockWindow.fromStart, true);
  assert.equal(yvette.basicCharge.clockWindow.period, YVETTE.clockPeriod);
  assert.equal(yvette.basicCharge.clockWindow.slack, YVETTE.clockSlack);
  assert.equal(yvette.basicCharge.clockWindow.mult, YVETTE.clockMult);
  assert.equal(yvette.basicDirectional.percentScale.cap, YVETTE.stressCap);
  assert.equal(yvette.basicDirectional.bonusVsPercent, undefined);
  assert.equal(yvette.specialDefense.seismicOnly, true);
  assert.equal(yvette.specialDefense.counterRange, YVETTE.counterRange);
  assert.equal(yvette.specialDirectional.bonusVsMetal, YVETTE.metalBonus);

  const liv = kit('liv');
  assert.equal(liv.basicCharge.fizzleBelow, undefined);
  assert.equal(liv.basicCharge.maxChargeMs, LIV.fullChargeMs);
  assert.equal(liv.basicCharge.offsetX, LIV.aimDistance);
  assert.equal(liv.basicCharge.earlyBlast.damage, LIV.earlyHeat);
  assert.deepEqual(liv.specialDefense.detonateOn, ['heat', 'kinetic']);
  assert.equal(liv.specialDirectional.projectileLife, LIV.sparkLife);

  const tess = kit('tess');
  assert.equal(tess.basicCharge.yank, true);
  assert.equal(tess.basicCharge.pull, undefined);
  assert.equal(tess.basicCharge.yankMin, TESS.pullMin);
  assert.equal(tess.basicCharge.yankMax, TESS.pullMax);
  assert.equal(tess.specialDefense.untargetable, true);
  assert.equal(tess.specialDefense.fadeAlpha, 0.15);
  assert.equal(tess.specialDefense.zone.percentOnly, true);
  assert.equal(tess.specialDefense.zone.gas, true);
  assert.equal(tess.specialDefense.zone.damage, TESS.hazeDps);
  assert.equal(tess.specialDirectional.fanDeg, TESS.fanDeg);
  assert.equal(tess.specialDirectional.fan, TESS.fanCount);
});

test('gas and seismic tags are on the moves those kits read', () => {
  assert.equal(kit('chloe').specialDirectional.gas, true);
  assert.equal(kit('chloe').specialDirectional.zone.gas, true);
  assert.equal(kit('chloe').basicCharge.gas, true);
  assert.equal(kit('chloe').basicDirectional.gas, true);
  assert.equal(kit('brock').basicCharge.gas, true);
  assert.equal(kit('brock').specialDefense.zone.gas, true);
  assert.equal(kit('zane').specialDirectional.gas, true);
  assert.equal(kit('arsenio').basicCharge.gas, true);
  assert.equal(kit('oxana').basicCharge.gas, true);
  assert.equal(kit('sully').specialDirectional.gas, true);
  assert.equal(kit('kyle').basicCharge.slam, true);
  assert.equal(kit('sully').basicDirectional.slam, true);
  assert.equal(kit('lillie').specialDirectional.slam, true);
  assert.equal(kit('fey').basicCharge.slam, true);
  assert.equal(kit('nick').specialDirectional.slam, true);
  assert.equal(kit('cal').basicDirectional.slam, true);
  assert.equal(kit('ruben').basicCharge.slam, true);
  // Tellus Tremor rides the floor. The old `ground` tag meant a shot that
  // drops onto the floor; Seismic Read treats a floor rider as the slam.
  assert.equal(kit('tessa').specialDirectional.floor, true);
  assert.equal(kit('tessa').specialDirectional.ground, undefined);
  const read = interceptHit(
    { state: 'defending', x: 0, y: 0, defenseMove: kit('yvette').specialDefense },
    { x: 40, y: 0 },
    kit('tessa').specialDirectional,
    0,
  );
  assert.equal(read.result, 'counter');
});

test('lattice clock ticks from the start of the charge', () => {
  const window = { period: YVETTE.clockPeriod, slack: YVETTE.clockSlack };
  assert.equal(clockPerfect(0, window), false);
  assert.equal(clockPerfect(100, window), false);
  assert.equal(clockPerfect(899, window), false);
  assert.equal(clockPerfect(900, window), true);
  assert.equal(clockPerfect(1000, window), true);
  assert.equal(clockPerfect(1100, window), true);
  assert.equal(clockPerfect(1200, window), false);
  assert.equal(clockPerfect(2000, window), true);
  assert.equal(clockPerfect(3000, window), true);
});

test('stress gauge scales with percent and keeps the old formula for other moves', () => {
  const gauge = { type: 'kinetic', damage: 12, percentScale: { cap: YVETTE.stressCap } };
  assert.equal(prepareMove(gauge, {}, { percent: 0 }).damage, 12);
  assert.equal(prepareMove(gauge, {}, { percent: 100 }).damage, 24);
  assert.equal(prepareMove(gauge, {}, { percent: 200 }).damage, 30);
  const old = { type: 'kinetic', damage: 10, bonusVsPercent: 0.65 };
  assert.equal(prepareMove(old, {}, { percent: 100 }).damage, 16.5);
});

test('final lanthanide triples above 150 percent and scintillator stuns radiation', () => {
  const strike = kit('lucy').basicDirectional;
  assert.equal(strike.name, 'Final Lanthanide');
  assert.equal(strike.type, 'kinetic');
  assert.equal(prepareMove(strike, {}, { percent: 150 }).damage, 9);
  assert.equal(prepareMove(strike, {}, { percent: 151 }).damage, 27);
  const guard = kit('lucy').specialDefense;
  assert.deepEqual(guard.immune, ['radiation']);
  assert.equal(guard.retort.stun, 440);
  assert.equal(guard.retort.blind, undefined);
  const pair = kit('lucy').specialDirectional;
  assert.equal(pair.alsoBehind, true);
  assert.equal(pair.type, 'radiation');
  const slam = kit('sandy').basicDirectional;
  assert.equal(slam.name, 'Sledge Slam');
  assert.equal(slam.type, 'kinetic');
  assert.equal(slam.baseKnockback, SANDY.sledgeKnockback);
  assert.equal(slam.explodeOnly, undefined);
});

test('cold fusion odds are seedable and a fizzle does nothing', () => {
  const spec = kit('paula').basicCharge.gamble;
  const max = PAULA.fullChargeMs;
  assert.deepEqual(gambleFizzle(100, max, spec, 0), { fizzle: true, scale: 0 });
  assert.deepEqual(gambleFizzle(500, max, spec, 0.2), { fizzle: false, scale: PAULA.partialScale });
  assert.deepEqual(gambleFizzle(500, max, spec, 0.3), { fizzle: true, scale: 0 });
  assert.deepEqual(gambleFizzle(1000, max, spec, 0.49), { fizzle: false, scale: 1 });
  assert.deepEqual(gambleFizzle(1000, max, spec, 0.5), { fizzle: true, scale: 0 });
  const rng = mulberry32(7);
  const a = gambleFizzle(1000, max, spec, rng());
  const again = mulberry32(7);
  assert.deepEqual(gambleFizzle(1000, max, spec, again()), a);
});

test('ceramic blade ignores armor reductions and still takes element defense', () => {
  const opts = { ignoreReductions: true, kineticTakenMult: 1.25, takenMult: 2 };
  assert.equal(resolvePacket(10, 'kinetic', null, { kineticDef: 0.2 }, opts), 8);
  assert.equal(resolvePacket(10, 'kinetic', null, { kineticDef: 0.2 }, { kineticTakenMult: 1.25, takenMult: 2 }), 20);
});

test('seismic read only answers tagged ground or slam hits, and only counters in range', () => {
  const defense = kit('yvette').specialDefense;
  const yvette = { x: 0, y: 0, state: 'defending', defenseMove: defense };
  const near = { x: 40, y: 0 };
  const slam = interceptHit(yvette, near, { slam: true, type: 'kinetic', damage: 8 }, 0);
  assert.equal(slam.result, 'counter');
  assert.equal(slam.counter.damage, YVETTE.counterDamage);
  const jab = interceptHit(yvette, near, { type: 'kinetic', damage: 6, kind: 'melee' }, 0);
  assert.equal(jab.result, 'pass');
  const far = interceptHit(yvette, { x: 400, y: 0 }, { ground: true, type: 'kinetic', damage: 8 }, 0);
  assert.equal(far.result, 'negate');
  assert.equal(far.counter, undefined);
});

test('signal repeater sends electrical or radiation back at the tunable power', () => {
  const erin = { x: 0, y: 0, state: 'defending', defenseMove: kit('erin').specialDefense };
  const shot = interceptHit(erin, { x: 30, y: 0 }, { type: 'electrical', damage: 8 }, 0);
  assert.equal(shot.result, 'counter');
  assert.equal(shot.counter.type, 'electrical');
  assert.equal(shot.counter.damage, 8 * ERIN.reflectPower);
  const kinetic = interceptHit(erin, { x: 30, y: 0 }, { type: 'kinetic', damage: 8 }, 0);
  assert.equal(kinetic.result, 'pass');
});

test('hohlraum detonates on heat or kinetic and lets other types through', () => {
  const liv = { x: 0, y: 0, state: 'defending', defenseMove: kit('liv').specialDefense };
  const heat = interceptHit(liv, { x: 20, y: 0 }, { type: 'heat', damage: 6 }, 0);
  assert.equal(heat.result, 'negate');
  assert.equal(heat.endDefense, true);
  assert.equal(heat.detonate.type, 'heat');
  assert.equal(heat.detonate.damage, LIV.detonateHeat);
  const chem = interceptHit(liv, { x: 20, y: 0 }, { type: 'chemical', damage: 6 }, 0);
  assert.equal(chem.result, 'pass');
  const rad = interceptHit(liv, { x: 20, y: 0 }, { type: 'radiation', damage: 6 }, 0);
  assert.equal(rad.result, 'pass');
});

test('resurface strip drops protections and leaves debuffs', () => {
  const fighter = {
    state: 'defending',
    defenseMove: { name: 'Tarnish Guard' },
    alpha: 0.4,
    burnUntil: 5000,
    burnSticky: false,
    poisonUntil: 4000,
    kinDefMult: 0.7,
    kinDefMultUntil: 9000,
    kineticResistMult: 0.62,
    kineticResistUntil: 9000,
    scene: { time: { now: 1000 }, dropPins() {}, clearOwnedZones() {} },
  };
  assert.equal(stripProtection(fighter), true);
  assert.equal(fighter.state, 'idle');
  assert.equal(fighter.defenseMove, null);
  assert.equal(fighter.burnUntil, 5000);
  assert.equal(fighter.poisonUntil, 4000);
  assert.equal(fighter.kinDefMult, 0.7);
  assert.equal(fighter.kineticResistUntil, 0);
});

test('six-atom fan is a 40 degree cone and maglev aim has eight directions', () => {
  const speed = TESS.fanSpeed;
  const top = fanVelocity(speed, 0, TESS.fanCount, TESS.fanDeg);
  const mid = fanVelocity(speed, 2.5, TESS.fanCount, TESS.fanDeg);
  const low = fanVelocity(speed, TESS.fanCount - 1, TESS.fanCount, TESS.fanDeg);
  const half = (TESS.fanDeg / 2) * Math.PI / 180;
  assert.ok(Math.abs(top.vy - Math.sin(-half) * speed) < 1e-6);
  assert.ok(Math.abs(low.vy - Math.sin(half) * speed) < 1e-6);
  assert.ok(Math.abs(mid.vy) < 1e-6);
  assert.deepEqual(glideAim({}, -1), { x: -1, y: 0 });
  const diag = glideAim({ right: true, jump: true }, 1);
  assert.ok(Math.abs(diag.x - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(diag.y + Math.SQRT1_2) < 1e-9);
});

test('flux pin is a zone in front and electron hunger picks the nearest front foe', () => {
  const yara = { x: 100, y: 200, facing: 1, bodyH: 80 };
  const pin = { front: YARA.pinFront, tall: YARA.pinTall };
  assert.equal(inPinZone(yara, 140, 170, pin), true);
  assert.equal(inPinZone(yara, 40, 170, pin), false);
  const owner = { x: 0, y: 0, facing: 1 };
  const behind = { x: -30, y: 0, alive: true, state: 'idle' };
  const far = { x: 200, y: 0, alive: true, state: 'idle' };
  const near = { x: 80, y: 10, alive: true, state: 'idle' };
  const haze = {
    x: 40, y: 0, alive: true, state: 'defending', defenseMove: { untargetable: true },
  };
  assert.equal(nearestInFront(owner, [behind, far, haze, near], TESS.pullMax), near);
  assert.equal(nearestInFront(owner, [haze], TESS.pullMax), null);
});
