// Hit audit fix: a move with its own painted clip hits with that clip's art, never with a stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { derivedStrike, strikeMask, maskBook, CELL } from '../src/engine/masks.js';

const fighter = (id, clip, frame, attackFrame = 4) => ({
  charDef: { id, art: {} }, facing: 1, state: 'attack', x: 0, y: 0, attackFrame, bodyW: 40,
  frameData: { startup: 3, active: 6, recovery: 8, visible: 17 },
  rig: { maskClip: clip, maskFrame: frame, baseScale: 1, _pose: { sx: 1, sy: 1, rot: 0, x: 0, y: 0 } },
  activeHit: { move: { rangeW: 70 } },
});

test('Ruth, Kyle and Roger (whose Normal never connected) now strike with the part of the art that reaches out', () => {
  const cases = [['ruth', 3, 95], ['kyle', 5, 40], ['roger', 3, 75]];
  for (const [id, frame, reach] of cases) {
    const clip = 'body-basicDirectional';
    const d = derivedStrike(id, clip, frame);
    assert.ok(d && d.n >= 3, `${id}: painted strike exists`);
    assert.ok(d.maxX >= reach, `${id}: reaches ${d.maxX} >= ${reach}`);
    const s = strikeMask(fighter(id, clip, frame));
    assert.ok(s && s.maxX >= reach, `${id}: strikeMask uses it (${s?.maxX})`);
  }
});

test('the painted strike never drops cells the old strike shape had', () => {
  let checked = 0;
  for (const id of ['ruth', 'rex', 'sarge', 'prometheus']) {
    const book = maskBook(id);
    const legacy = book.strike?.attack?.find((m) => m?.n >= 3);
    if (!legacy) continue;
    const clip = 'body-basicDirectional';
    for (let frame = 0; frame < book.clips[clip].length; frame++) {
      const d = derivedStrike(id, clip, frame);
      if (!d) continue;
      const f = fighter(id, clip, frame);
      const u = strikeMask(f);
      const lg = book.strike.attack[Math.min(book.strike.attack.length - 1, 0)];
      if (!u || !lg) continue;
      assert.ok(u.n >= d.n, `${id} f${frame}: union (${u.n}) holds the painted cells (${d.n})`);
      checked++;
    }
  }
  assert.ok(checked > 0);
  assert.equal(CELL, 5);
});

test('a fighter with no strike data keeps its arc unless the art reaches past it', () => {
  const f = fighter('bord', 'body-basicDirectional', 3);
  f.activeHit.move.rangeW = 200;
  assert.equal(strikeMask(f), null, 'arc stays when the art stops inside rangeW');
});
