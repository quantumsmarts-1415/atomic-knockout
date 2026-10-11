import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVE_SHEETS } from '../src/data/moveSheets.js';
import {
  frameToWorld, sheetFrameIndex, sheetFxPoint, sheetMeta, sheetReleasePoint,
} from '../src/engine/moveSheet.js';

function pngSize(path) {
  const buf = readFileSync(path);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('call 1 sheets match their clip cells', () => {
  const expect = {
    nitra: ['attack', 'charge', 'special'],
    flora: ['attack', 'charge', 'special'],
    lillie: ['attack', 'charge', 'special', 'defense'],
    yvette: ['attack'],
  };
  for (const [id, names] of Object.entries(expect)) {
    const art = CHARACTERS[id].art;
    for (const name of names) {
      const def = art.sheets.clips[name];
      const file = `${art.sheets.dir}${def.file || `${id}_${name}.png`}`;
      const png = pngSize(file);
      assert.equal(png.w % def.frameW, 0, `${id} ${name} width`);
      assert.equal(png.h % def.frameH, 0, `${id} ${name} height`);
      const cells = (png.w / def.frameW) * (png.h / def.frameH);
      assert.ok(cells >= def.count, `${id} ${name} cells ${cells}`);
      assert.equal(def.displayScale, art.height / def.visibleH);
    }
  }
  assert.equal(CHARACTERS.lillie.art.sheets.clips.defense.file, 'lillie_charge.png');
  assert.equal(MOVE_SHEETS.nitra.attack.anchors, undefined);
  assert.equal(MOVE_SHEETS.nitra.charge.release, 7);
  assert.deepEqual(MOVE_SHEETS.nitra.charge.loop, [2, 5]);
});

test('charge gather loops, and the release frame opens the active window', () => {
  const nitra = sheetMeta('nitra', 'charge');
  assert.equal(sheetFrameIndex(nitra, { state: 'charging', animT: 0 }), 2);
  assert.equal(sheetFrameIndex(nitra, { state: 'charging', animT: 1 / 18 }), 3);
  assert.equal(sheetFrameIndex(nitra, { state: 'charging', animT: 4 / 18 }), 2);
  const fd = { startup: 5, active: 4, recovery: 8, visible: 17 };
  assert.equal(sheetFrameIndex(nitra, { state: 'attack', fd, attackFrame: 5 }), 7);
  assert.ok(sheetFrameIndex(nitra, { state: 'attack', fd, attackFrame: 4 }) < 7);

  const lillie = sheetMeta('lillie', 'defense');
  assert.equal(lillie.gather, true);
  assert.equal(sheetFrameIndex(lillie, { state: 'defending', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(lillie, { state: 'defending', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(lillie, { state: 'defending', animT: 6 / 18 }), 0);
});

test('a null recovery holds the last active frame', () => {
  const flora = sheetMeta('flora', 'attack');
  assert.equal(flora.recovery, null);
  const fd = { startup: 3, active: 6, recovery: 4, visible: 13 };
  assert.equal(sheetFrameIndex(flora, { state: 'attack', fd, attackFrame: 3 }), 10);
  assert.equal(sheetFrameIndex(flora, { state: 'attack', fd, attackFrame: 9 }), 11);
  assert.equal(sheetFrameIndex(flora, { state: 'attack', fd, attackFrame: 12 }), 11);
});

test('spark jab steps use jab, second jab, then the straight', () => {
  const jab = sheetMeta('lillie', 'attack');
  const fd = { startup: 3, active: 2, recovery: 6, visible: 11 };
  assert.equal(sheetFrameIndex(jab, { state: 'attack', fd, attackFrame: 3, comboStep: 1 }), 1);
  assert.equal(sheetFrameIndex(jab, { state: 'attack', fd, attackFrame: 3, comboStep: 2 }), 3);
  assert.equal(sheetFrameIndex(jab, { state: 'attack', fd, attackFrame: 3, comboStep: 3 }), 6);
  assert.equal(sheetFrameIndex(jab, { state: 'attack', fd, attackFrame: 10, comboStep: 3 }), 11);
});

test('gust with no phases spreads the twelve frames across the swing', () => {
  const gust = sheetMeta('nitra', 'attack');
  const fd = { startup: 3, active: 4, recovery: 5, visible: 12 };
  assert.equal(sheetFrameIndex(gust, { state: 'attack', fd, attackFrame: 0 }), 0);
  const last = sheetFrameIndex(gust, { state: 'attack', fd, attackFrame: 11 });
  assert.ok(last >= 10 && last <= 11, `last frame ${last}`);
});

test('left-facing sheet pixels land in front after the rig flip', () => {
  const right = frameToWorld([80, 90], 100, 100, 1, 1, 1, 1, 0, 200);
  assert.equal(right.x, 30);
  assert.equal(right.y, 190);
  // Fist on the left of a left-facing frame is the forward hand.
  const flipped = frameToWorld([20, 90], 100, 100, 1, 1, -1, 1, 0, 200);
  assert.equal(flipped.x, 30);
  const facingLeft = frameToWorld([20, 90], 100, 100, 1, 1, -1, -1, 0, 200);
  assert.equal(facingLeft.x, -30);
});

test('release and live anchors use the clip scale and the rig flip', () => {
  const art = CHARACTERS.nitra.art;
  const def = art.sheets.clips.charge;
  const fist = MOVE_SHEETS.nitra.charge.anchors.fist[7];
  const tip = MOVE_SHEETS.nitra.charge.anchors.tip[7];
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'basicCharge',
    charDef: CHARACTERS.nitra,
    rig: { moveKey: 'basicCharge', sheetClip: 'charge', sheetFrame: 7 },
  };
  const world = (anchor) => frameToWorld(
    anchor, def.frameW, def.frameH, def.footY, def.displayScale, art.facing, 1, 400, 500,
  );
  const live = sheetFxPoint(fighter, 'melee');
  const released = sheetReleasePoint(fighter, 'shot');
  assert.deepEqual(live, world(fist));
  assert.deepEqual(released, world(tip));
  assert.ok(live.x > 400);
  assert.ok(released.x > 400);
});
