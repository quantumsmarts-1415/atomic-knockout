import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { buildSelectSlots, COMING_SOON } from '../src/data/periodic.js';
import { interceptHit } from '../src/engine/defense.js';
import { measureFrames } from '../tools/import-lib.js';
import { TUNING } from '../src/data/balance.js';

const WAVE6 = ['sarge', 'mac', 'mae', 'liv', 'tess'];
const FEMALE = new Set(['mae', 'liv', 'tess']);
const SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];
const NAMES = {
  sarge: ['Sound Off', 'Six-Count Flurry', 'Periodic Shield', 'Decay Mortar'],
  mae: ['Liquid Drop Split', 'Overlooked', 'Border Slip', 'Neutron Splitter'],
  mac: ['Decay Cascade', 'Red Hammer', 'Nesting Doll', 'Short Fuse'],
  liv: ['192 Beams', 'Chalcogen Hook', 'Hohlraum', 'Last Instant'],
  tess: ['Electron Hunger', 'Last Halogen', 'Smoky Haze', 'Six-Atom Spread'],
};

const WALK12 = [
  'ace', 'agatha', 'arsenio', 'aurelius', 'barry', 'bianca', 'boar', 'brock', 'burke', 'caesar', 'cali', 'ceres',
  'collin', 'cooper', 'copernicus', 'curie', 'dash', 'dizzy', 'duke', 'erin', 'europa', 'fey', 'flo', 'frank',
  'gail', 'gertrude', 'goldie', 'hog', 'holly', 'hoss', 'indy', 'ira', 'krypto',
];
const STILL8 = [
  'amy', 'cody', 'einstein', 'fermi', 'ford', 'haley', 'iona', 'manny', 'nadia', 'nick', 'paula', 'pit',
  'prometheus', 'saab', 'talia', 'tate', 'tex',
  'lana', 'lars', 'lucy', 'mendel', 'molly', 'neptune', 'niko', 'niobe', 'noble', 'ogden', 'oz', 'pablo', 'pat',
  'percy', 'pluto', 'polonius', 'ray', 'rex', 'rhoda', 'roger', 'ronan', 'ruben', 'ruth', 'sam', 'sandy',
  'selena', 'sterling', 'tara', 'terra', 'tessa', 'thor', 'thule', 'uri', 'wolf', 'xander', 'yara', 'yvette', 'zane', 'zora',
];

function gridFrames(png, count, frameW, frameH) {
  const cols = Math.ceil(Math.sqrt(count));
  const frames = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const frame = new PNG({ width: frameW, height: frameH });
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const si = ((row * frameH + y) * png.width + (col * frameW + x)) << 2;
        const di = (y * frameW + x) << 2;
        frame.data[di] = png.data[si];
        frame.data[di + 1] = png.data[si + 1];
        frame.data[di + 2] = png.data[si + 2];
        frame.data[di + 3] = png.data[si + 3];
      }
    }
    frames.push(frame);
  }
  return frames;
}

test('wave 6 ghosts are playable with the doc moves and pronouns', () => {
  assert.strictEqual(Object.keys(CHARACTERS).length, 118);
  assert.strictEqual(COMING_SOON.size, 0);
  const slots = buildSelectSlots(CHARACTERS);
  assert.strictEqual(slots.filter((s) => s.charId).length, 118);
  assert.strictEqual(slots.filter((s) => s.soon).length, 0);
  for (const id of WAVE6) {
    const c = CHARACTERS[id];
    assert.strictEqual(c.ghost, true, id);
    assert.strictEqual(c.stats.weight, TUNING.weightClamp[0], id);
    const names = SLOTS.map((slot) => c.moves[slot].name);
    assert.deepStrictEqual(names, NAMES[id], id);
    const teach = c.teach || '';
    if (FEMALE.has(id)) assert.match(teach, /\b(she|her)\b/i, id);
    else assert.match(teach, /\b(he|his|him)\b/i, id);
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
    assert.ok(partial / ink > 0.12, `${id} alpha was flattened`);
  }
  assert.strictEqual(CHARACTERS.sarge.moves.basicCharge.unblockAtFull, true);
  assert.strictEqual(CHARACTERS.sarge.moves.basicDirectional.multiHit, 6);
  assert.strictEqual(CHARACTERS.mae.moves.specialDirectional.splitOnHit, true);
  assert.strictEqual(CHARACTERS.mac.moves.basicCharge.pulses.length, 5);
  assert.strictEqual(CHARACTERS.mac.moves.specialDefense.crackAfterHits, 3);
  assert.strictEqual(CHARACTERS.liv.moves.basicCharge.fizzleBelow, 0.95);
  assert.strictEqual(CHARACTERS.liv.moves.specialDefense.reflectAs, 'radiation');
  assert.strictEqual(CHARACTERS.tess.moves.specialDirectional.fan, 6);
  assert.strictEqual(CHARACTERS.tess.moves.specialDefense.phase, true);
});

test('hohlraum sends heat and lasers back as radiation', () => {
  const defender = {
    state: 'defending',
    defenseMove: CHARACTERS.liv.moves.specialDefense,
  };
  const heat = interceptHit(defender, { x: 0 }, { type: 'heat', damage: 10 }, 0);
  assert.strictEqual(heat.result, 'counter');
  assert.strictEqual(heat.counter.type, 'radiation');
  const kinetic = interceptHit(defender, { x: 0 }, { type: 'kinetic', damage: 10 }, 0);
  assert.strictEqual(kinetic.result, 'pass');
});

test('walk12 keeps the cell, foot line, and idle body height', () => {
  for (const id of WALK12) {
    const sheets = CHARACTERS[id].art.sheets;
    const walk = sheets.clips.walk;
    const idle = sheets.clips.idle;
    assert.strictEqual(walk.count, 12, id);
    assert.ok(walk.fps > 0, id);
    assert.ok(Math.abs(walk.bodyH - idle.bodyH) <= 2, `${id} body`);
    assert.ok(Math.abs(walk.footY - idle.footY) <= 0.015, `${id} footY`);
    assert.strictEqual(walk.visibleH, walk.bodyH, id);
    const png = PNG.sync.read(readFileSync(`art-src/imported/sheets/${id}_walk.png`));
    const frames = gridFrames(png, walk.count, walk.frameW, walk.frameH);
    const measured = measureFrames(frames);
    const targetFoot = Math.round(walk.footY * walk.frameH) - 1;
    assert.ok(Math.abs(measured.foot - targetFoot) <= 1, `${id} drawn foot ${measured.foot} vs ${targetFoot}`);
    assert.ok(Math.abs(measured.bodyH - walk.bodyH) <= 4, `${id} drawn body ${measured.bodyH} vs ${walk.bodyH}`);
  }
  for (const id of STILL8) {
    assert.strictEqual(CHARACTERS[id].art.sheets.clips.walk.count, 8, id);
  }
});
