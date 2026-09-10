import test from 'node:test';
import assert from 'node:assert';
import { CHARACTERS } from '../src/data/characters.js';

test('Roster wall defenses define all hazard rect dimensions', () => {
  for (const [id, def] of Object.entries(CHARACTERS)) {
    const sd = def.moves.specialDefense;
    if (sd && sd.kind === 'wall') {
      assert.ok(sd.wallRangeW !== undefined, `${id} specialDefense.wallRangeW is missing`);
      assert.ok(sd.wallRangeH !== undefined, `${id} specialDefense.wallRangeH is missing`);
      assert.ok(sd.wallYFrac !== undefined, `${id} specialDefense.wallYFrac is missing`);
      assert.ok(sd.wallKnockbackGrowth !== undefined, `${id} specialDefense.wallKnockbackGrowth is missing`);
    }
  }
});
