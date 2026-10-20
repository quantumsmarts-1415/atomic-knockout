import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVE_SHEETS } from '../src/data/moveSheets.js';
import { artIsUpdated, fighterIdsFromFxIndex, REVIEWED_THROUGH } from '../src/data/updatedArt.js';

function fxIdsOnDisk() {
  return new Set(
    readdirSync('assets/fx').filter((name) => {
      if (name === 'status') return false;
      return statSync(`assets/fx/${name}`).isDirectory();
    }),
  );
}

test('gold marks the reviewed roster plus later sheet or effect fighters', () => {
  const fxIds = fxIdsOnDisk();
  const extras = ['yara', 'zora', 'rhoda', 'paula', 'sandy', 'erin', 'yvette', 'liv', 'tess'];
  for (const id of extras) {
    assert.ok(MOVE_SHEETS[id], `${id} move sheet`);
    assert.ok(CHARACTERS[id].atomicNumber > REVIEWED_THROUGH, id);
    assert.equal(artIsUpdated(CHARACTERS[id], fxIds), true, id);
  }
  for (const fighter of Object.values(CHARACTERS)) {
    const expect = fighter.atomicNumber <= REVIEWED_THROUGH
      || !!MOVE_SHEETS[fighter.id]
      || fxIds.has(fighter.id);
    assert.equal(artIsUpdated(fighter, fxIds), expect, fighter.id);
  }
  assert.equal(artIsUpdated(CHARACTERS.lucy, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.tex, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.krypto, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ruben, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.sterling, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.cody, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ruth, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.niobe, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.tessa, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.molly, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.agatha, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.indy, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.saab, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ogden, fxIds), false);
});

test('a later fighter lights up from a new effect folder or move sheet', () => {
  const sterling = { id: 'sterling', atomicNumber: 38 };
  assert.equal(artIsUpdated(sterling, new Set()), false);
  assert.equal(artIsUpdated(sterling, new Set(['sterling'])), true);
  assert.equal(artIsUpdated({ id: 'nova', atomicNumber: 99 }, new Set(), { nova: { attack: {} } }), true);
});

test('the effect index ignores the shared status folder', () => {
  const ids = fighterIdsFromFxIndex([
    'hydra/supernova/fx.json',
    'status/poison/fx.json',
    'yara/maglev/burst.png',
  ]);
  assert.deepEqual([...ids].sort(), ['hydra', 'yara']);
});
