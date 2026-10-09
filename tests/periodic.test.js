import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import {
  PERIODIC_ELEMENTS, TABLE_COLS, buildSelectSlots, stepSlot, tableCell,
} from '../src/data/periodic.js';

test('the select table has all 118 elements on unique cells', () => {
  assert.strictEqual(PERIODIC_ELEMENTS.length, 118);
  const seen = new Set();
  for (const e of PERIODIC_ELEMENTS) {
    assert.ok(e.col >= 0 && e.col < TABLE_COLS, `${e.sym} col`);
    assert.ok(e.row >= 0 && e.row <= 9, `${e.sym} row`);
    const key = `${e.row},${e.col}`;
    assert.ok(!seen.has(key), `overlap at ${key}`);
    seen.add(key);
  }
  assert.deepStrictEqual(tableCell(73), { row: 5, col: 4 });
  assert.deepStrictEqual(tableCell(1), { row: 0, col: 0 });
  assert.deepStrictEqual(tableCell(2), { row: 0, col: 17 });
});

test('D-pad steps follow the table, including the f-block and the pilots', () => {
  const slots = buildSelectSlots(CHARACTERS);
  const at = (z) => slots.findIndex((s) => s.n === z);
  assert.strictEqual(slots[stepSlot(slots, at(73), 1, 0)].n, 74);
  assert.strictEqual(slots[stepSlot(slots, at(73), -1, 0)].n, 72);
  assert.strictEqual(slots[stepSlot(slots, at(73), 0, -1)].n, 41);
  assert.strictEqual(slots[stepSlot(slots, at(73), 0, 1)].n, 105);
  assert.strictEqual(slots[stepSlot(slots, at(57), 0, -1)].n, 39);
  assert.strictEqual(slots[stepSlot(slots, at(1), 1, 0)].n, 2);
  assert.strictEqual(slots[stepSlot(slots, at(2), -1, 0)].n, 1);
  for (const id of ['tara', 'wolf', 'rex', 'oz', 'pit']) {
    assert.ok(slots.some((s) => s.charId === id), id);
  }
  assert.strictEqual(slots.filter((s) => s.charId).length, Object.keys(CHARACTERS).length);
});
