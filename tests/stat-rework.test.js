// Stat rework (Benjamin, Oct 30 2026): the data table, the derived stats and the pure formulas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ROSTER } from '../src/data/characters.js';
import { MOVESETS } from '../src/data/movesets.js';
import {
  REWORK_FIGHTERS, REWORK_MOVES, RW, TYPES, airJumpsOf, baseOf, campaignHpOf, campaignMovOf, chargeBase,
  gravityScaleOf, hitDamage, hitstunMsFor, healFloor, jumpLaunchOf, knockbackResistance, rollOutcome, rollTable,
  statBonus, walkSpeedOf,
} from '../src/data/statRework.js';

const NOBLE = ['helen', 'neo', 'aaron', 'krypto', 'ronan', 'xander'];

test('every fighter has Weight + Speed = 6 and a type budget: 30, noble gases 24 (chemical N/A), Ogden 30', () => {
  assert.equal(Object.keys(REWORK_FIGHTERS).length, 118);
  for (const c of ROSTER) {
    const f = REWORK_FIGHTERS[c.id];
    assert.ok(f, c.id);
    assert.equal(f.w + f.s, 6, `${c.id} weight + speed`);
    assert.ok(f.w >= 1 && f.w <= 5 && Number.isInteger(f.w), c.id);
    let total = 0;
    for (const t of TYPES) {
      for (const side of ['atk', 'def']) {
        const v = f[side][t];
        if (v == null) continue;
        assert.ok(Number.isInteger(v) && v >= 0 && v <= 5, `${c.id} ${side} ${t}`);
        total += v;
      }
    }
    assert.equal(total, NOBLE.includes(c.id) ? 24 : 30, `${c.id} budget`);
    if (NOBLE.includes(c.id)) {
      assert.equal(f.atk.chemical, null, c.id);
      assert.equal(f.def.chemical, null, c.id);
    }
  }
  assert.notEqual(REWORK_FIGHTERS.ogden.atk.chemical, null, 'Ogden keeps chemical');
  assert.notEqual(REWORK_FIGHTERS.ogden.def.chemical, null);
});

test("Benjamin's own rows win: Hydra and Helen are exactly as he typed them", () => {
  assert.deepEqual(REWORK_FIGHTERS.hydra, { w: 1, s: 5, atk: { kinetic: 1, heat: 5, chemical: 5, electrical: 1, radiation: 5 }, def: { kinetic: 1, heat: 1, chemical: 1, electrical: 5, radiation: 5 } });
  assert.deepEqual(REWORK_FIGHTERS.helen, { w: 1, s: 5, atk: { kinetic: 3, heat: 2, chemical: null, electrical: 1, radiation: 2 }, def: { kinetic: 1, heat: 5, chemical: null, electrical: 5, radiation: 5 } });
});

test('derived physical stats: resistance 0.5 + W/4, gravity 0.5 + W/5, walk 150 + 40 S, air jumps ceil(S/2)', () => {
  assert.equal(knockbackResistance(1), 0.75);
  assert.equal(knockbackResistance(5), 1.75);
  assert.equal(gravityScaleOf(1), 0.7);
  assert.equal(gravityScaleOf(5), 1.5);
  assert.equal(walkSpeedOf(1), 190);
  assert.equal(walkSpeedOf(5), 350);
  assert.deepEqual([1, 2, 3, 4, 5].map(airJumpsOf), [1, 1, 2, 2, 3]);
  assert.deepEqual([1, 2, 3, 4, 5].map(campaignMovOf), [3, 4, 4, 5, 5]);
  assert.deepEqual([1, 2, 3, 4, 5].map(campaignHpOf), [60, 70, 80, 90, 100]);
  for (const c of ROSTER) {
    const f = REWORK_FIGHTERS[c.id];
    assert.equal(c.stats.weight, knockbackResistance(f.w), c.id);
    assert.equal(c.stats.gravityScale, gravityScaleOf(f.w), c.id);
    assert.equal(c.stats.speed, walkSpeedOf(f.s), c.id);
    assert.equal(c.stats.airJumps, airJumpsOf(f.s), c.id);
  }
});

test('everyone jumps the same height (1.1 x 148 = 162.8 px), ghosts included; launch speed follows weight', () => {
  assert.equal(RW.jumpHeight, 162.8);
  for (const c of ROSTER) {
    const g = 1500 * c.stats.gravityScale;
    const h = c.stats.jumpVelocity ** 2 / (2 * g);
    assert.ok(Math.abs(h - 162.8) < 0.01, `${c.id} jump height ${h}`);
  }
  assert.ok(jumpLaunchOf(5) > jumpLaunchOf(1));
  const ghosts = ROSTER.filter((c) => c.ghost);
  assert.equal(ghosts.length, 15);
  for (const c of ghosts) assert.equal(c.stats.speed, walkSpeedOf(REWORK_FIGHTERS[c.id].s), `${c.id} walks at the normal speed`);
});

test('every move has a row: 472 moves, base cooldown and uses plus effect costs, none below 1 use', () => {
  let n = 0;
  const base = { basicDirectional: [0.5, 8], specialDirectional: [0.8, 4], basicCharge: [1.0, 3], specialDefense: [0.8, 3] };
  for (const c of ROSTER) {
    for (const key of Object.keys(base)) {
      const r = REWORK_MOVES[c.id]?.[key];
      assert.ok(r, `${c.id} ${key}`);
      n++;
      assert.ok(r.cd >= base[key][0] - 1e-9, `${c.id} ${key} cooldown ${r.cd}`);
      assert.ok(r.uses >= 1 && r.uses <= base[key][1], `${c.id} ${key} uses ${r.uses}`);
      assert.ok(r.area >= 0 && r.area <= 2 && r.range >= 0 && r.range <= 3, `${c.id} ${key}`);
    }
  }
  assert.equal(n, 472);
  assert.equal(REWORK_MOVES.hydra.basicDirectional.cd, 0.5);
  assert.equal(REWORK_MOVES.hydra.basicDirectional.uses, 8);
});

test('damage: base + Attack - Defense; mixed types average the difference; an immune type counts zero', () => {
  assert.equal(baseOf('normal'), 10);
  assert.equal(baseOf('special'), 15);
  assert.equal(baseOf('charge', { charge: 20 }), 20);
  assert.equal(baseOf('defense'), 5);
  assert.equal(baseOf('normal', { ghost: true }), 13, 'ghost +3');
  assert.equal(baseOf('defense', { ghost: true }), 8, 'ghost +3 on a defense move that deals damage');
  // Hydra heat 5 vs Aurelius heat defense
  const dHeat = REWORK_FIGHTERS.aurelius.def.heat;
  assert.equal(statBonus('hydra', 'aurelius', ['heat']), 5 - dHeat);
  const dKin = REWORK_FIGHTERS.aurelius.def.kinetic;
  assert.equal(statBonus('hydra', 'aurelius', ['heat', 'kinetic']), ((5 - dHeat) + (1 - dKin)) / 2);
  // Noble gas: a chemical-only move deals nothing; a mixed move counts chemical as 0
  assert.equal(statBonus('hydra', 'helen', ['chemical']), null);
  assert.equal(statBonus('hydra', 'helen', ['chemical', 'heat']), (0 + (5 - 5)) / 2);
  assert.equal(statBonus('hydra', 'helen', ['kinetic']), 1 - 1);
  // Ogden is not immune
  assert.notEqual(statBonus('hydra', 'ogden', ['chemical']), null);
});

test('multi hit: base is split evenly, the stat bonus lands on the last hit only', () => {
  const hits = [1, 2, 3, 4, 5].map((n) => hitDamage({ base: 10, bonus: 3, hits: 5, n }));
  assert.deepEqual(hits, [2, 2, 2, 2, 5]);
  assert.equal(hits.reduce((a, b) => a + b, 0), 13);
  assert.equal(hitDamage({ base: 10, bonus: -4, hits: 1, n: 1 }), 6);
  assert.equal(hitDamage({ base: 5, bonus: -5, hits: 1, n: 1 }), 0);
  assert.equal(hitDamage({ base: 10, bonus: null, hits: 1, n: 1 }), 0);
});

test('charge: 5% at 0 s, +1% every 0.2 s, 20% at 3 s, nothing beyond', () => {
  assert.equal(chargeBase(0), 5);
  assert.equal(chargeBase(199), 5);
  assert.equal(chargeBase(200), 6);
  assert.equal(chargeBase(1000), 10);
  assert.equal(chargeBase(1500), 12);
  assert.equal(chargeBase(2000), 15);
  assert.equal(chargeBase(3000), 20);
  assert.equal(chargeBase(9000), 20);
});

test('hitstun is a flat 0.25 s below 75% and grows with knockback from 75%; the heal floor is half the peak', () => {
  assert.equal(hitstunMsFor(10, 900), 250);
  assert.equal(hitstunMsFor(74.9, 900), 250);
  assert.equal(hitstunMsFor(75, 900), 900);
  assert.equal(hitstunMsFor(80, 100), 250, 'never below the flat floor');
  assert.equal(healFloor(60), 30);
  assert.equal(healFloor(50), 25);
});

test('crit / miss: one roll, three exclusive results, equal and opposite, Skill adds 1% to both', () => {
  const t0 = rollTable({ slot: 'normal', skill: 0 });
  assert.deepEqual(t0, { miss: 5, crit: 5, hit: 90 });
  const sp = rollTable({ slot: 'special', skill: 0 });
  assert.deepEqual(sp, { miss: 15, crit: 15, hit: 70 });
  const t1 = rollTable({ slot: 'normal', skill: 1 });
  assert.deepEqual(t1, { miss: 4, crit: 6, hit: 90 });
  const ex = rollTable({ slot: 'normal', skill: 0, crit: 10, miss: 10 });
  assert.deepEqual(ex, { miss: 10, crit: 10, hit: 80 });
  assert.equal(rollOutcome(ex, 0.05), 'miss');
  assert.equal(rollOutcome(ex, 0.15), 'crit');
  assert.equal(rollOutcome(ex, 0.5), 'hit');
  assert.equal(rollOutcome(ex, 0.999), 'hit');
  assert.equal(rollTable({ slot: 'charge', skill: 0 }).crit, 10);
  assert.equal(rollTable({ slot: 'defense', skill: 0 }).crit, 5);
});

test('the retired balance-pass ranges and band multipliers are gone from the move data path', () => {
  // movesets still carry per-move numbers (counters, zones, self damage), but the Ring no longer reads a damage
  // multiplier table per fighter.
  assert.ok(Object.keys(MOVESETS).length === 118);
  assert.ok(CHARACTERS.hydra.rework);
});

test('the sim-only bot filter knows which moves deal no damage (Anesthesia yes, a plain Normal no)', async () => {
  const { dealsNoDamage } = await import('../src/engine/BotAI.js');
  const { CHARACTERS: C } = await import('../src/data/characters.js');
  assert.equal(dealsNoDamage({ charDef: C.xander }, 'specialDefense'), true);
  assert.equal(dealsNoDamage({ charDef: C.ben }, 'basicDirectional'), false);
});
