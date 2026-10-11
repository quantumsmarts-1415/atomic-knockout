import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVE_SHEETS } from '../src/data/moveSheets.js';
import {
  frameToWorld, sheetDrawsWeapon, sheetFrameIndex, sheetFxPoint, sheetMeta, sheetReleasePoint,
} from '../src/engine/moveSheet.js';
import { overhandToss } from '../src/engine/fxArt.js';

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

test('call 2 sheets match their clip cells', () => {
  const expect = {
    maggie: ['attack', 'charge', 'special'],
    natalie: ['attack', 'charge', 'special'],
    oxana: ['attack', 'special'],
    phillip: ['attack', 'charge', 'special'],
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
  assert.equal(CHARACTERS.maggie.art.sheets.clips.special.file, 'maggie_charge.png');
  assert.equal(CHARACTERS.oxana.art.sheets.clips.attack.frameW, 918);
  assert.equal(CHARACTERS.phillip.art.sheets.clips.charge.frameW, 554);
  assert.equal(MOVE_SHEETS.maggie.attack.windup, undefined);
  assert.equal(MOVE_SHEETS.oxana.charge, undefined);
});

test('maggie gathers through the flare windup, and the release frame is the flash', () => {
  const flare = sheetMeta('maggie', 'charge');
  assert.equal(sheetFrameIndex(flare, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(flare, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(flare, { state: 'charging', animT: 6 / 18 }), 0);
  const fd = { startup: 4, active: 3, recovery: 6, visible: 13 };
  assert.equal(sheetFrameIndex(flare, { state: 'attack', fd, attackFrame: 4 }), 6);
  assert.equal(sheetFrameIndex(sheetMeta('maggie', 'special'), { state: 'attack', fd, attackFrame: 4 }), 6);
});

test('lake drop loops the gather, and brine burst opens on its release frame', () => {
  const lake = sheetMeta('natalie', 'charge');
  assert.deepEqual(lake.loop, [1, 3]);
  assert.equal(sheetFrameIndex(lake, { state: 'charging', animT: 0 }), 1);
  assert.equal(sheetFrameIndex(lake, { state: 'charging', animT: 2 / 18 }), 3);
  assert.equal(sheetFrameIndex(lake, { state: 'charging', animT: 3 / 18 }), 1);
  const fd = { startup: 6, active: 4, recovery: 8, visible: 18 };
  assert.equal(sheetFrameIndex(sheetMeta('natalie', 'special'), { state: 'attack', fd, attackFrame: 6 }), 8);
});

test('natalie move sheets face right while her idle faces left', () => {
  const art = CHARACTERS.natalie.art;
  assert.equal(art.facing, -1);
  for (const name of ['attack', 'charge', 'special']) {
    assert.equal(art.sheets.clips[name].sheetFacing, 1);
  }
  const def = art.sheets.clips.special;
  const fist = MOVE_SHEETS.natalie.special.anchors.fist[8];
  assert.ok(fist[0] > def.frameW / 2);
  const forward = frameToWorld(
    fist, def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500,
  );
  const mirrored = frameToWorld(
    fist, def.frameW, def.frameH, def.footY, def.displayScale, -1, 1, 400, 500,
  );
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'specialDirectional',
    charDef: CHARACTERS.natalie,
    rig: { moveKey: 'specialDirectional', sheetClip: 'special', sheetFrame: 8 },
  };
  assert.deepEqual(sheetFxPoint(fighter, 'melee'), forward);
  assert.ok(forward.x > 400);
  assert.ok(mirrored.x < 400);
});

test('phosphor flare leaves the hand along a 60 degree overhand line', () => {
  const tip = overhandToss(100, 200, 1, 200);
  assert.ok(Math.abs(tip.x - 200) < 1e-9);
  assert.ok(Math.abs(tip.y - (200 - 200 * Math.cos(Math.PI / 6))) < 1e-9);
  assert.ok(Math.abs(tip.rotation - Math.PI / 6) < 1e-9);
  const left = overhandToss(100, 200, -1, 200);
  assert.ok(Math.abs(left.x - 0) < 1e-9);
  assert.ok(left.y < 200);
  assert.ok(left.rotation < 0);
  const art = CHARACTERS.phillip.art;
  const def = art.sheets.clips.charge;
  const hand = MOVE_SHEETS.phillip.charge.anchors.tip[6];
  assert.equal(MOVE_SHEETS.phillip.charge.release, 6);
  const world = frameToWorld(
    hand, def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500,
  );
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'basicCharge',
    charDef: CHARACTERS.phillip,
    rig: { moveKey: 'basicCharge', sheetClip: 'charge', sheetFrame: 6 },
  };
  assert.deepEqual(sheetReleasePoint(fighter, 'shot'), world);
  assert.ok(world.x > 400);
  assert.ok(world.y < 500);
});

test('call 5 attack sheets match their clip cells', () => {
  const names = ['chloe', 'rhoda', 'sandy', 'sully', 'van', 'yara', 'cal', 'kyle'];
  for (const id of names) {
    const art = CHARACTERS[id].art;
    const def = art.sheets.clips.attack;
    const file = `${art.sheets.dir}${def.file || `${id}_attack.png`}`;
    const png = pngSize(file);
    assert.equal(png.w % def.frameW, 0, `${id} width`);
    assert.equal(png.h % def.frameH, 0, `${id} height`);
    const cells = (png.w / def.frameW) * (png.h / def.frameH);
    assert.ok(cells >= def.count, `${id} cells ${cells}`);
    assert.equal(def.displayScale, art.height / def.visibleH);
    assert.equal(MOVE_SHEETS[id].charge, undefined);
    assert.equal(MOVE_SHEETS[id].special, undefined);
  }
  assert.equal(CHARACTERS.sully.art.sheets.clips.attack.count, 11);
  assert.equal(CHARACTERS.rhoda.art.sheets.clips.attack.count, 8);
  assert.equal(CHARACTERS.rhoda.art.sheets.clips.attack.fps, 20);
  assert.equal(CHARACTERS.chloe.art.sheets.clips.attack.sheetFacing, 1);
  assert.equal(CHARACTERS.cal.art.sheets.clips.attack.sheetFacing, 1);
  assert.equal(CHARACTERS.van.art.facing, -1);
  assert.equal(CHARACTERS.van.art.sheets.clips.attack.sheetFacing, undefined);
});

test('rose thorn and garnet cut open on their release frames', () => {
  const fd = { startup: 4, active: 3, recovery: 6, visible: 13 };
  assert.equal(sheetFrameIndex(sheetMeta('rhoda', 'attack'), { state: 'attack', fd, attackFrame: 4 }), 3);
  assert.equal(sheetFrameIndex(sheetMeta('yara', 'attack'), { state: 'attack', fd, attackFrame: 4 }), 7);
  const slam = sheetMeta('sully', 'attack');
  const swing = { startup: 3, active: 4, recovery: 4, visible: 11 };
  assert.equal(sheetFrameIndex(slam, { state: 'attack', fd: swing, attackFrame: 0 }), 0);
  assert.equal(sheetFrameIndex(slam, { state: 'attack', fd: swing, attackFrame: 10 }), 10);
});

test('a right-facing attack on a left-facing idle stays in front', () => {
  const art = CHARACTERS.chloe.art;
  assert.equal(art.facing, -1);
  const def = art.sheets.clips.attack;
  const forward = frameToWorld([700, 200], def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500);
  const mirrored = frameToWorld([700, 200], def.frameW, def.frameH, def.footY, def.displayScale, -1, 1, 400, 500);
  assert.ok(forward.x > 400);
  assert.ok(mirrored.x < 400);
  const rhoda = CHARACTERS.rhoda.art.sheets.clips.attack;
  const fist = MOVE_SHEETS.rhoda.attack.anchors.fist[3];
  assert.ok(fist[0] > rhoda.frameW / 2);
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'basicDirectional',
    charDef: CHARACTERS.rhoda,
    rig: { moveKey: 'basicDirectional', sheetClip: 'attack', sheetFrame: 3 },
  };
  const world = frameToWorld(
    fist, rhoda.frameW, rhoda.frameH, rhoda.footY, rhoda.displayScale, 1, 1, 400, 500,
  );
  assert.deepEqual(sheetReleasePoint(fighter, 'shot'), world);
  assert.ok(world.x > 400);
});

test('call 3 sheets match their clip cells', () => {
  const expect = {
    allen: ['attack', 'charge', 'special'],
    titan: ['attack'],
    liv: ['attack'],
    selena: ['attack'],
    silas: ['attack', 'charge', 'special'],
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
  const titanWalk = CHARACTERS.titan.art.sheets.clips.walk;
  assert.equal(titanWalk.count, 12);
  assert.equal(titanWalk.fps, 12);
  assert.equal(titanWalk.loop, true);
  assert.equal(CHARACTERS.silas.art.sheets.clips.charge.file, 'silas_special.png');
  assert.equal(CHARACTERS.allen.art.facing, -1);
  assert.equal(CHARACTERS.titan.art.facing, -1);
  assert.equal(CHARACTERS.allen.art.sheets.clips.attack.sheetFacing, undefined);
  assert.equal(CHARACTERS.titan.art.sheets.clips.attack.sheetFacing, undefined);
  assert.equal(CHARACTERS.titan.art.sheets.clips.walk.sheetFacing, undefined);
  assert.equal(MOVE_SHEETS.titan.charge, undefined);
  assert.equal(MOVE_SHEETS.titan.special, undefined);
  assert.equal(MOVE_SHEETS.liv.charge, undefined);
  assert.equal(MOVE_SHEETS.selena.special, undefined);
});

test('thermite loops the spray and the whip opens on the cable', () => {
  const charge = sheetMeta('allen', 'charge');
  assert.deepEqual(charge.loop, [6, 9]);
  assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 0 }), 6);
  assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 3 / 18 }), 9);
  assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 4 / 18 }), 6);
  const fd = { startup: 4, active: 3, recovery: 6, visible: 13 };
  assert.equal(sheetFrameIndex(charge, { state: 'attack', fd, attackFrame: 4 }), 5);
  assert.equal(sheetFrameIndex(sheetMeta('allen', 'attack'), { state: 'attack', fd, attackFrame: 4 }), 4);
  assert.equal(sheetFrameIndex(sheetMeta('allen', 'special'), { state: 'attack', fd, attackFrame: 4 }), 6);
});

test('overclock loops the gather and binary surge opens on the burst', () => {
  const charge = sheetMeta('silas', 'charge');
  const special = sheetMeta('silas', 'special');
  assert.equal(charge.loop, undefined);
  assert.deepEqual(charge.windup, [0, 5]);
  assert.deepEqual(charge.anchors, special.anchors);
  assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 6 / 18 }), 0);
  const fd = { startup: 4, active: 3, recovery: 6, visible: 13 };
  assert.equal(sheetFrameIndex(special, { state: 'attack', fd, attackFrame: 4 }), 6);
});

test('a left-facing whip release stays in front', () => {
  const art = CHARACTERS.allen.art;
  const def = art.sheets.clips.attack;
  const fist = MOVE_SHEETS.allen.attack.anchors.fist[4];
  assert.ok(fist[0] < def.frameW / 2);
  const world = frameToWorld(
    fist, def.frameW, def.frameH, def.footY, def.displayScale, -1, 1, 400, 500,
  );
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'basicDirectional',
    charDef: CHARACTERS.allen,
    rig: { _authoredSheet: true, moveKey: 'basicDirectional', sheetClip: 'attack', sheetFrame: 4 },
  };
  assert.deepEqual(sheetFxPoint(fighter, 'melee'), world);
  assert.deepEqual(sheetReleasePoint(fighter, 'melee'), world);
  assert.ok(world.x > 400);
  const lance = CHARACTERS.titan.art.sheets.clips.attack;
  const tip = MOVE_SHEETS.titan.attack.anchors.fist[6];
  assert.ok(tip[0] < lance.frameW / 2);
});

test('the whip sheet hides the separate cable', () => {
  const allen = {
    charDef: { id: 'allen' },
    rig: { _authoredSheet: true, sheetClip: 'attack' },
  };
  assert.equal(sheetDrawsWeapon(allen), true);
  assert.equal(sheetDrawsWeapon({
    charDef: { id: 'allen' },
    rig: { _authoredSheet: true, sheetClip: 'charge' },
  }), false);
  assert.equal(sheetDrawsWeapon({
    charDef: { id: 'titan' },
    rig: { _authoredSheet: true, sheetClip: 'attack' },
  }), false);
  assert.equal(sheetDrawsWeapon({
    charDef: { id: 'allen' },
    rig: { _authoredSheet: false, sheetClip: 'attack' },
  }), false);
});
