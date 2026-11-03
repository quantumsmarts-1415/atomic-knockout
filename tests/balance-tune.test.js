import test from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER, CHARACTERS } from '../src/data/characters.js';
import { RING_FIGHTERS as REWORK_FIGHTERS } from '../src/data/statRework.js';
import { BALANCE_STATS } from '../src/data/balanceStats.js';
import { BALANCE_TUNE } from '../src/data/balanceTune.js';

test('balance tune only names real fighters and keeps multipliers sane', () => {
  for (const [id, t] of Object.entries(BALANCE_TUNE)) {
    assert.ok(CHARACTERS[id], `${id} is not a fighter`);
    for (const k of Object.keys(t)) assert.ok(['kb', 'cd'].includes(k), `${id}: unknown knob ${k}`);
    if (t.kb != null) assert.ok(t.kb >= 0.3 && t.kb <= 3, `${id} kb ${t.kb}`);
    if (t.cd != null) assert.ok(t.cd >= 0.4 && t.cd <= 2.5, `${id} cd ${t.cd}`);
  }
});

test('the stat rules still hold for every fighter after balancing', () => {
  for (const c of ROSTER) {
    const f = REWORK_FIGHTERS[c.id];
    if (!f) continue;
    assert.equal(f.w + f.s, 6, `${c.id} weight+speed`);
    const all = [...Object.values(f.atk), ...Object.values(f.def)];
    for (const v of all) assert.ok(v == null || (v >= 0 && v <= 10), `${c.id} stat range`);
    const sum = all.reduce((s, v) => s + (v ?? 0), 0);
    assert.equal(sum, f.atk.chemical == null ? 24 : 30, `${c.id} attack+defense budget`);
  }
  assert.ok(!BALANCE_STATS.hydra && !BALANCE_STATS.helen, 'Hydra and Helen stats are Benjamin\'s own');
  assert.deepEqual(REWORK_FIGHTERS.hydra.atk, { kinetic: 1, heat: 5, chemical: 5, electrical: 1, radiation: 5 });
});

test('moves that fire several separate projectiles split the base between them', () => {
  assert.equal(CHARACTERS.ira.moves.specialDirectional.rwHits, 4);
  assert.equal(CHARACTERS.carter.moves.basicCharge.rwHits, 8);
  assert.equal(CHARACTERS.einstein.moves.specialDirectional.rwHits, 5);
  assert.equal(CHARACTERS.yara.moves.specialDirectional.rwHits, 4);
});
