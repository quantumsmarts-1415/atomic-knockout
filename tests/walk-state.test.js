import test from 'node:test';
import assert from 'node:assert/strict';
import { decayLaunch } from '../src/engine/feel.js';

test('decayLaunch spends residual knockback instead of stacking forever', () => {
  let launch = { x: 120, y: -180, balloonLeft: 0 };
  for (let i = 0; i < 40; i++) launch = decayLaunch(launch);
  assert.equal(launch, null);
});

test('bord walk sheetFacing opposes idle so the walk is not mirrored backwards', async () => {
  const { CHARACTERS } = await import('../src/data/characters.js');
  const bord = CHARACTERS.bord;
  assert.equal(bord.art.facing, -1);
  assert.equal(bord.art.sheets.clips.walk.sheetFacing, 1);
});

test('hydra jump is capped below the raw density-derived floater', async () => {
  const { CHARACTERS } = await import('../src/data/characters.js');
  assert.ok(CHARACTERS.hydra.stats.jumpVelocity <= 720);
});
