// Smash Ring balance pass (2026-10-29): base-damage ranges per slot, the 0.5-1.5 s recharge band,
// and the light-fighter normal-attack string. Base damage only: poison, burn, radiation clouds and other
// damage-over-time are not counted. Per use = every hit of a multi-hit move, at full charge for charge moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ROSTER } from '../src/data/characters.js';
import { hitsPerUse, resolveMoveDamage } from '../src/data/balance.js';
import { stringStep, STRING_WINDOW } from '../src/engine/swingString.js';

const RANGE = { basicDirectional: [5, 12], specialDirectional: [13, 20], basicCharge: [20, 30], counter: [13, 20] };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const weightScore = (w) => 1 + 9 * clamp((w - 0.58) / (1.48 - 0.58), 0, 1);
const counterOf = (m) => m.counterDamage || m.retort?.damage || m.phaseRetort?.damage || m.recoil?.damage || 0;
const perUse = (c, m, key) => resolveMoveDamage(m, c, null).total * hitsPerUse(m) * (key === 'basicCharge' ? (m.chargeDamageMult ?? 1) : 1);

test('every damaging normal / special / charge move and every counter sits in its base-damage range', () => {
  const out = [];
  for (const c of ROSTER) {
    for (const [key, [lo, hi]] of Object.entries(RANGE)) {
      if (key === 'counter') {
        const d = counterOf(c.moves.specialDefense || {});
        if (d && (d < lo - 0.35 || d > hi + 0.35)) out.push(`${c.id} counter ${d}`);
        continue;
      }
      const m = c.moves[key];
      const d = m ? perUse(c, m, key) : 0;
      if (d > 0 && (d < lo - 0.35 || d > hi + 0.35)) out.push(`${c.id} ${key} ${d.toFixed(2)} not in ${lo}-${hi}`);
    }
  }
  assert.deepEqual(out, []);
});

test('every move recharges between 0.5 and 1.5 s, except the short swings of a light fighter\'s string', () => {
  const out = [];
  for (const c of ROSTER) {
    for (const [key, m] of Object.entries(c.moves)) {
      if (m.string) { assert.equal(key, 'basicDirectional'); assert.equal(m.cooldown, 1000, `${c.id} string rest`); continue; }
      if (m.cooldown < 500 || m.cooldown > 1500) out.push(`${c.id} ${key} ${m.cooldown}`);
    }
  }
  assert.deepEqual(out, []);
});

test('a string stays a data field of the normal attack: 2-3 swings, 0.2-0.3 s apart (stat rework: no longer tied to weight)', () => {
  const lights = [];
  for (const c of ROSTER) {
    const s = c.moves.basicDirectional.string;
    if (s) { lights.push(c.id); assert.ok(s.hits >= 2 && s.hits <= 3 && s.gap >= 200 && s.gap <= 300, c.id); }
  }
  assert.ok(lights.length >= 5, lights.join(','));
});

test('the string: swings 1..n-1 recharge by the gap, the last swing by the full cooldown, a lapsed string restarts', () => {
  const move = { name: 'Jab', duration: 200, cooldown: 1000, string: { hits: 3, gap: 250 } };
  let t = 0; let st = null;
  const a = stringStep(st, move, t); st = a.state;
  assert.deepEqual([a.n, a.recharge], [1, 250]);
  t += 200 + 250;
  const b = stringStep(st, move, t); st = b.state;
  assert.deepEqual([b.n, b.recharge], [2, 250]);
  t += 200 + 250;
  const c = stringStep(st, move, t); st = c.state;
  assert.deepEqual([c.n, c.recharge, c.last], [3, 1000, true]);
  // after the last swing the next one starts a fresh string
  t += 200 + 1000;
  const d = stringStep(st, move, t); st = d.state;
  assert.deepEqual([d.n, d.recharge], [1, 250]);
  // waiting past the window lets a half-finished string lapse
  t += 200 + 250 + STRING_WINDOW + 1;
  const e = stringStep(st, move, t);
  assert.equal(e.n, 1);
});
