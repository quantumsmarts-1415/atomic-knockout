import assert from 'node:assert/strict';
import test from 'node:test';
import { MOVESETS } from '../src/data/movesets.js';
import {
  shotEndOf, shotIgnoresGround, shotRemovedOnFighter, shotStoppedBySolid,
} from '../src/engine/shotEnd.js';

function eachShot(fn) {
  for (const [id, kit] of Object.entries(MOVESETS)) {
    for (const [slot, move] of Object.entries(kit)) {
      if (!move) continue;
      if (move.kind === 'projectile') fn(id, move);
      if (move.also?.kind === 'projectile') fn(id, move.also);
    }
  }
}

test('every projectile has an explicit shotEnd and keeps its old contact rule', () => {
  const counts = { despawn: 0, stick: 0, linger: 0, pierce: 0 };
  eachShot((id, move) => {
    assert.ok(['despawn', 'stick', 'linger', 'pierce'].includes(move.shotEnd), `${id} ${move.name}`);
    assert.equal(shotEndOf(move), move.shotEnd);
    counts[move.shotEnd] += 1;
    if (move.pierce) assert.equal(move.shotEnd, 'pierce');
    if (move.stick) assert.equal(move.shotEnd, 'stick');
    if (move.hatch || move.dropZone) assert.equal(move.shotEnd, 'linger');
    if (move.shotEnd === 'despawn' || move.shotEnd === 'linger') assert.equal(shotRemovedOnFighter(move), true);
    if (move.shotEnd === 'stick' || move.shotEnd === 'pierce') assert.equal(shotRemovedOnFighter(move), false);
    if (move.shotEnd === 'despawn') {
      const travel = move.can || move.returns || move.stageBounce || move.ricochet || move._ghost;
      assert.equal(shotStoppedBySolid(move), !travel);
    } else {
      assert.equal(shotStoppedBySolid(move), false);
    }
  });
  assert.deepEqual(counts, { despawn: 87, stick: 2, linger: 7, pierce: 5 });
});

test('stick, pierce, and placed hazards are not popped by a wall', () => {
  const pin = MOVESETS.tara.specialDirectional;
  const sink = MOVESETS.haley.specialDirectional;
  const tide = MOVESETS.lillie.specialDirectional;
  const coin = MOVESETS.caesar.specialDirectional;
  const pellet = MOVESETS.barry.specialDirectional;
  const seed = MOVESETS.neptune.specialDirectional;
  const bomb = MOVESETS.hydra.specialDirectional;
  assert.equal(pin.shotEnd, 'stick');
  assert.equal(sink.shotEnd, 'stick');
  assert.equal(tide.shotEnd, 'pierce');
  assert.equal(coin.shotEnd, 'linger');
  assert.equal(pellet.shotEnd, 'linger');
  assert.equal(seed.shotEnd, 'linger');
  assert.equal(bomb.shotEnd, 'despawn');
  assert.equal(shotStoppedBySolid(pin), false);
  assert.equal(shotStoppedBySolid(coin), false);
  assert.equal(shotStoppedBySolid(seed), false);
  assert.equal(shotStoppedBySolid(bomb), true);
  assert.equal(shotRemovedOnFighter(pin), false);
  assert.equal(shotRemovedOnFighter(tide), false);
  // The coin and the seed still end on a body. The patch and the plant stay.
  assert.equal(shotRemovedOnFighter(coin), true);
  assert.equal(shotRemovedOnFighter(seed), true);
  assert.equal(coin.dropZone.ms, 10000);
  assert.ok(seed.hatch);
});

test('ground riders and returning shots are not eaten by the floor', () => {
  const tremor = MOVESETS.tessa.specialDirectional;
  const disc = MOVESETS.ben.specialDirectional;
  const can = MOVESETS.sandy.specialDirectional;
  const paradox = MOVESETS.fermi.specialDirectional;
  const ghost = MOVESETS.goldie.specialDirectional;
  assert.equal(tremor.shotEnd, 'despawn');
  assert.equal(shotIgnoresGround(tremor), true);
  assert.equal(shotStoppedBySolid(tremor), true);
  assert.equal(shotStoppedBySolid(disc), false);
  assert.equal(shotStoppedBySolid(can), false);
  assert.equal(shotStoppedBySolid(paradox), false);
  assert.equal(shotStoppedBySolid(ghost), false);
  assert.equal(shotRemovedOnFighter(disc), true);
  assert.equal(shotRemovedOnFighter(can), true);
});

test('zones and mines are not projectiles, so the wall rule never pops them', () => {
  const peel = MOVESETS.kyle.specialDirectional;
  const powder = MOVESETS.iona.specialDirectional;
  const mine = MOVESETS.yara.specialDirectional;
  assert.equal(peel.kind, 'zone');
  assert.equal(peel.zone.trap, true);
  assert.equal(powder.kind, 'zone');
  assert.equal(powder.zone.trap, true);
  assert.equal(mine.kind, 'mine');
  assert.equal(peel.shotEnd, undefined);
  assert.equal(mine.shotEnd, undefined);
});
