import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ROSTER } from '../src/data/characters.js';
import { REWORK_FIGHTERS, RING_FIGHTERS, knockbackResistance, gravityScaleOf, walkSpeedOf, airJumpsOf } from '../src/data/statRework.js';
import { ELEMENT_STATS } from '../src/data/elementStats.js';
import { RING_COEF, BENJAMIN_COEF, ringKnockbackResistance, ringGravityScale, ringWalkSpeed, ringAirJumps } from '../src/data/ringBalance.js';
import { BALANCE_TUNE } from '../src/data/balanceTune.js';

const TYPES = ['kinetic', 'heat', 'chemical', 'electrical', 'radiation'];

test('element stats follow the sheet rules for every fighter', () => {
  for (const c of ROSTER) {
    const f = ELEMENT_STATS[c.id];
    assert.ok(f, `${c.id} has an element row`);
    assert.equal(f.w + f.s, 6, `${c.id} weight + speed`);
    assert.ok(f.w >= 1 && f.w <= 5, `${c.id} weight range`);
    const noble = REWORK_FIGHTERS[c.id].def.chemical == null;
    for (const side of ['atk', 'def']) {
      for (const t of TYPES) {
        const v = f[side][t];
        if (t === 'chemical' && noble) assert.equal(v, null, `${c.id} noble gas has no chemical`);
        else assert.ok(Number.isInteger(v) && v >= 0 && v <= 10, `${c.id} ${side} ${t} ${v}`);
      }
    }
    const sum = TYPES.reduce((t, k) => t + (f.atk[k] ?? 0) + (f.def[k] ?? 0), 0);
    assert.equal(sum, noble ? 24 : 30, `${c.id} attack + defense budget`);
  }
});

test("Hydra's and Helen's rows are exactly Benjamin's", () => {
  for (const id of ['hydra', 'helen']) {
    assert.deepEqual(RING_FIGHTERS[id], REWORK_FIGHTERS[id]);
    assert.deepEqual(ELEMENT_STATS[id].atk, REWORK_FIGHTERS[id].atk);
    assert.deepEqual(ELEMENT_STATS[id].def, REWORK_FIGHTERS[id].def);
    assert.equal(ELEMENT_STATS[id].w, 1);
  }
  assert.deepEqual(Object.keys(BALANCE_TUNE.hydra ?? { kb: 1 }).filter((k) => k !== 'kb'), [], 'Hydra only gets a knockback knob');
});

test('weight follows real atomic mass and the real element shows in the stats', () => {
  const byZ = (id) => CHARACTERS[id].atomicNumber;
  const mean = (w) => {
    const z = ROSTER.filter((c) => ELEMENT_STATS[c.id].w === w).map((c) => byZ(c.id));
    return z.reduce((a, b) => a + b, 0) / z.length;
  };
  for (let w = 1; w < 5; w++) assert.ok(mean(w) < mean(w + 1), `weight ${w} is lighter than ${w + 1}`);
  assert.ok(ELEMENT_STATS.flora.atk.chemical >= 8, 'fluorine hits hard with chemicals');
  assert.ok(ELEMENT_STATS.wolf.def.heat >= 5, 'tungsten shrugs off heat');
  assert.ok(ELEMENT_STATS.ray.atk.radiation > ELEMENT_STATS.cooper.atk.radiation, 'radium is more radioactive than copper');
  assert.ok(ELEMENT_STATS.cooper.atk.electrical > ELEMENT_STATS.oxana.atk.electrical, 'copper conducts');
  assert.ok(ELEMENT_STATS.oxana.def.electrical > ELEMENT_STATS.cooper.def.electrical, 'oxygen insulates');
});

test('the Campaign keeps the sheet stats', () => {
  for (const c of ROSTER) assert.equal(c.rework, REWORK_FIGHTERS[c.id], `${c.id} Campaign row is the sheet`);
});

test("with Benjamin's coefficients the Ring physics are his formulas", () => {
  const saved = JSON.parse(JSON.stringify(RING_COEF));
  try {
    Object.assign(RING_COEF, BENJAMIN_COEF);
    for (let w = 1; w <= 5; w++) {
      assert.equal(ringKnockbackResistance(w), knockbackResistance(w));
      assert.equal(ringGravityScale(w), gravityScaleOf(w));
      assert.equal(ringWalkSpeed(6 - w), walkSpeedOf(6 - w));
      assert.equal(ringAirJumps(6 - w), airJumpsOf(6 - w));
    }
  } finally { Object.assign(RING_COEF, saved); }
});

test('every global coefficient is sane', () => {
  for (const k of ['kbResBase', 'kbResPerW', 'gravBase', 'gravPerW', 'walkBase', 'walkPerS']) assert.ok(RING_COEF[k] > 0, k);
  for (const k of ['projectileMult', 'areaMult', 'chargeMult', 'counterMult', 'healMult', 'dotMult']) assert.ok(RING_COEF[k] > 0.2 && RING_COEF[k] < 3, k);
  for (const g of ['atkWeight', 'defWeight', 'typeMult']) for (const t of TYPES) assert.ok(RING_COEF[g][t] > 0.2 && RING_COEF[g][t] < 3, `${g}.${t}`);
  for (const c of ROSTER) assert.ok(CHARACTERS[c.id].stats.gravityScale > 0 && CHARACTERS[c.id].stats.weight > 0);
});
