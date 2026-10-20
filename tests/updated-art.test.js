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
  assert.equal(artIsUpdated(CHARACTERS.iona, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.xander, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.caesar, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.barry, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.lana, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.europa, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.goldie, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.terra, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.dizzy, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.holly, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.thule, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.haley, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.tara, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.rex, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.wolf, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.oz, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ira, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.aurelius, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.pit, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.hog, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.talia, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.pablo, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.bianca, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.polonius, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.tate, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ronan, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.frank, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ray, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ace, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.pat, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.uri, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.neptune, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.pluto, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.einstein, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.fermi, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.mendel, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.amy, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.curie, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.burke, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.cali, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.lars, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ford, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.duke, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.sarge, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.thor, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.boar, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.dash, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.noble, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.roger, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.niko, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.flo, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.mac, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.ogden, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.hoss, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.mae, fxIds), true);
  assert.equal(artIsUpdated(CHARACTERS.copernicus, fxIds), true);
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
