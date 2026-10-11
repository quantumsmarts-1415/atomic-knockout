import test from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_STOCKS, clockEndsRound, isFullRound } from '../src/engine/matchRules.js';

test('a clock never ends a bot round or a tournament match', () => {
  assert.equal(MATCH_STOCKS, 3);
  assert.equal(clockEndsRound(), false);
});

test('a scored round needs a knockout and one fighter left on 3 stocks', () => {
  const timeout = {
    kos: [],
    fighters: [
      { id: 'helen', stocks: 3 },
      { id: 'oxana', stocks: 3 },
    ],
  };
  assert.equal(isFullRound(timeout), false);
  const firstKnockdown = {
    kos: [{ victim: 'oxana', killer: 'helen' }],
    fighters: [
      { id: 'helen', stocks: 3 },
      { id: 'oxana', stocks: 2 },
    ],
  };
  assert.equal(isFullRound(firstKnockdown), false);
  const decided = {
    kos: [
      { victim: 'oxana', killer: 'helen' },
      { victim: 'oxana', killer: 'helen' },
      { victim: 'oxana', killer: 'helen' },
    ],
    fighters: [
      { id: 'helen', stocks: 2 },
      { id: 'oxana', stocks: 0 },
    ],
  };
  assert.equal(isFullRound(decided), true);
  assert.equal(isFullRound(decided, 1), false);
});
