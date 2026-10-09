import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { buildSelectSlots, COMING_SOON } from '../src/data/periodic.js';
import { prepareMove, tickGhostDrain, weakestType } from '../src/engine/kit.js';
import { interceptHit } from '../src/engine/defense.js';
import { TUNING } from '../src/data/balance.js';

const PART1 = [
  'curie', 'pat', 'uri', 'neptune', 'pluto', 'amy', 'burke', 'cali', 'einstein',
  'mendel', 'noble', 'fermi', 'lars', 'duke', 'hoss', 'dash', 'copernicus', 'niko', 'flo',
];
const PART2 = ['ogden', 'ford', 'boar', 'roger', 'gertrude', 'nadia', 'niobe', 'prometheus', 'zora'];
const FEMALE = new Set(['curie', 'pat', 'amy', 'cali', 'flo', 'gertrude', 'nadia', 'niobe', 'zora']);
const GHOSTS = ['duke', 'hoss', 'dash', 'copernicus', 'niko', 'flo', 'ford', 'boar', 'roger', 'ogden', 'sarge', 'mae', 'mac', 'liv', 'tess'];
const SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];

test('wave 5 part 1 is on the roster with the doc genders', () => {
  assert.strictEqual(Object.keys(CHARACTERS).length, 118);
  for (const id of [...PART1, ...PART2]) {
    const c = CHARACTERS[id];
    assert.ok(c, id);
    if (PART1.includes(id)) assert.strictEqual(c.atomicNumber > 90, true, id);
    for (const slot of SLOTS) assert.ok(c.moves[slot]?.name, `${id} ${slot}`);
    const teach = c.teach || '';
    if (FEMALE.has(id)) assert.match(teach, /\b(she|her)\b/i, id);
    else assert.match(teach, /\b(he|his|him)\b/i, id);
  }
});

test('ghosts drain, stay light, and keep translucent sheets', () => {
  for (const id of GHOSTS) {
    const c = CHARACTERS[id];
    assert.strictEqual(c.ghost, true, id);
    assert.strictEqual(c.stats.weight, TUNING.weightClamp[0], id);
    assert.ok(c.stats.speed < 220, id);
    const png = PNG.sync.read(readFileSync(`art-src/imported/sheets/${id}_idle.png`));
    let ink = 0;
    let partial = 0;
    for (let i = 3; i < png.data.length; i += 4) {
      const a = png.data[i];
      if (a > 8) {
        ink++;
        if (a < 250) partial++;
      }
    }
    assert.ok(ink > 1000, `${id} sheet has ink`);
    assert.ok(partial / ink > 0.12, `${id} alpha was flattened`);
  }
  const ghost = {
    charDef: { ghost: true },
    alive: true,
    state: 'idle',
    percent: 10,
    damageTaken: 0,
    takenByType: {},
    _ghostDrainAt: 0,
  };
  tickGhostDrain(ghost, 500);
  assert.strictEqual(ghost.percent, 11);
  ghost.drainPauseUntil = 2000;
  tickGhostDrain(ghost, 1000);
  assert.strictEqual(ghost.percent, 11);
});

test('the ghost row is fully playable', () => {
  const slots = buildSelectSlots(CHARACTERS);
  const row = slots.filter((s) => s.n >= 104 && s.n <= 118);
  assert.strictEqual(row.length, 15);
  assert.deepStrictEqual(row.map((s) => s.row), Array(15).fill(6));
  for (const id of ['ford', 'duke', 'sarge', 'boar', 'hoss', 'mae', 'dash', 'roger', 'copernicus', 'niko', 'flo', 'mac', 'liv', 'tess', 'ogden']) {
    assert.ok(row.some((s) => s.charId === id), id);
  }
  assert.strictEqual(row.filter((s) => s.soon).length, 0);
  assert.strictEqual(COMING_SOON.size, 0);
  assert.strictEqual(slots.filter((s) => s.soon).length, 0);
  assert.strictEqual(slots.filter((s) => s.charId).length, 118);
});

test('wave 5 move flags change the hit the way the doc describes', () => {
  const jab = { name: 'Self-Sharpening Jab', type: 'kinetic', damage: 6, sharpen: { step: 2, cap: 10 } };
  const uri = { _sharpenName: 'Self-Sharpening Jab', _sharpen: 3 };
  const sharpened = prepareMove(jab, uri, { charDef: {} }, 0);
  assert.strictEqual(sharpened.damage, 10);

  const reign = { name: 'Long Reign', type: 'kinetic', damage: 12, perSecond: 1, perSecondCap: 16 };
  const duke = { bornAt: 0 };
  const aged = prepareMove(reign, duke, { charDef: {} }, 5000);
  assert.strictEqual(aged.damage, 17);

  const muted = prepareMove(
    { name: 'Medal Swing', type: 'kinetic', damage: 8 },
    { muteAllUntil: 1000 },
    { charDef: {} },
    100,
  );
  assert.strictEqual(muted.damage, 0);

  const defender = {
    state: 'defending',
    defenseMove: { rewind: true },
  };
  const gate = interceptHit(defender, { x: 0 }, { type: 'kinetic', damage: 8 }, 0);
  assert.strictEqual(gate.result, 'negate');
  assert.strictEqual(gate.rewind, true);

  const heavy = weakestType({ kineticDef: 0.4, heatDef: -0.2, elecTaken: 1, radDef: 0.2, noble: false });
  assert.strictEqual(heavy, 'heat');
});
