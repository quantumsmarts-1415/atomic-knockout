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

test('push 2 call 1 body sheets match their clip cells', () => {
  const expect = {
    titan: ['charge', 'defense', 'special'],
    van: ['special'],
    sully: ['defense', 'special'],
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
      assert.equal(def.sheetFacing, undefined);
    }
  }
  const surge = sheetMeta('van', 'special');
  assert.equal(surge.release, 5);
  assert.deepEqual(surge.windup, [0, 4]);
  assert.deepEqual(surge.active, [5, 6]);
  assert.equal(surge.anchors.feet[0][0], 626);
  assert.equal(sheetMeta('titan', 'charge').count, 12);
  const brace = sheetMeta('sully', 'defense');
  assert.equal(brace.gather, true);
  assert.deepEqual(brace.loop, [3, 8]);
  assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 0 }), 3);
  assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 5 / 18 }), 8);
  assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 6 / 18 }), 3);
  assert.equal(sheetMeta('sully', 'special').release, 8);
  const ram = sheetMeta('titan', 'charge');
  assert.equal(sheetFrameIndex(ram, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(ram, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(ram, { state: 'charging', animT: 6 / 18 }), 0);
  const fd = { startup: 4, active: 6, recovery: 6, visible: 16 };
  assert.equal(sheetFrameIndex(surge, { state: 'attack', fd, attackFrame: 4 }), 5);
});

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

test('natalie idle, walk, and move sheets face right', () => {
  const art = CHARACTERS.natalie.art;
  assert.equal(art.facing, -1);
  assert.equal(art.sheets.clips.idle.sheetFacing, 1);
  assert.equal(art.sheets.clips.walk.sheetFacing, 1);
  assert.equal(art.sheets.clips.walk.count, 12);
  assert.equal(art.sheets.clips.walk.frameW, 636);
  for (const name of ['attack', 'charge', 'defense', 'special']) {
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
    if (id !== 'chloe' && id !== 'cal' && id !== 'kyle' && id !== 'sully' && id !== 'yara' && id !== 'sandy' && id !== 'rhoda' && id !== 'van') assert.equal(MOVE_SHEETS[id].charge, undefined);
    if (id !== 'van' && id !== 'sully' && id !== 'chloe' && id !== 'cal' && id !== 'kyle' && id !== 'yara' && id !== 'rhoda' && id !== 'sandy') assert.equal(MOVE_SHEETS[id].special, undefined);
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
  const bodyName = 'body-specialDirectional';
  const rhoda = CHARACTERS.rhoda.art.sheets.clips[bodyName];
  const rose = sheetMeta('rhoda', bodyName);
  const fist = rose.anchors.tip[rose.release];
  assert.ok(fist[0] > rhoda.frameW / 2);
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'specialDirectional',
    charDef: CHARACTERS.rhoda,
    rig: { moveKey: 'specialDirectional', sheetClip: 'attack', sheetFrame: rose.release },
  };
  const world = frameToWorld(
    fist, rhoda.frameW, rhoda.frameH, rhoda.footY, rhoda.displayScale,
    rhoda.sheetFacing ?? CHARACTERS.rhoda.art.facing ?? 1, 1, 400, 500,
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
  assert.equal(MOVE_SHEETS.titan.charge.count, 12);
  assert.equal(MOVE_SHEETS.titan.charge.release, 6);
  assert.equal(MOVE_SHEETS.titan.special.release, 6);
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
  // The whip-yank body sheet is the release. Its foot row sits about 0.1px
  // off the older attack clip, and the shot still leaves in front of him.
  const bodyName = 'body-basicDirectional';
  const bodyDef = art.sheets.clips[bodyName];
  const bodyMeta = sheetMeta('allen', bodyName);
  const hand = bodyMeta.anchors.fist[bodyMeta.release];
  const release = frameToWorld(
    hand, bodyDef.frameW, bodyDef.frameH, bodyDef.footY, bodyDef.displayScale,
    bodyDef.sheetFacing ?? art.facing ?? 1, 1, 400, 500,
  );
  assert.deepEqual(sheetReleasePoint(fighter, 'melee'), release);
  assert.ok(release.x > 400);
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
    charDef: { id: 'titan' },
    currentMoveKey: 'basicDirectional',
    rig: { _authoredSheet: true, sheetClip: 'body-basicDirectional' },
  }), true);
  assert.equal(sheetDrawsWeapon({
    charDef: { id: 'titan' },
    currentMoveKey: 'specialDirectional',
    rig: { _authoredSheet: true, sheetClip: 'body-specialDirectional' },
  }), false);
  assert.equal(sheetDrawsWeapon({
    charDef: { id: 'allen' },
    rig: { _authoredSheet: false, sheetClip: 'attack' },
  }), false);
});

test('call 4 sheets match their clip cells', () => {
  const expect = {
    chroma: ['attack'],
    gail: ['attack'],
    paula: ['attack'],
    zora: ['attack'],
    aaron: ['attack'],
    erin: ['attack'],
    scarlett: ['attack'],
    tess: ['attack'],
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
    if (id !== 'aaron' && id !== 'chroma' && id !== 'gail' && id !== 'scarlett' && id !== 'paula' && id !== 'tess' && id !== 'zora' && id !== 'erin') {
      assert.equal(MOVE_SHEETS[id].charge, undefined);
      assert.equal(MOVE_SHEETS[id].special, undefined);
    }
  }
  const walk = CHARACTERS.aaron.art.sheets.clips.walk;
  assert.equal(walk.count, 12);
  assert.equal(walk.fps, 10.29);
  assert.equal(walk.loop, true);
  assert.equal(walk.displayScale, CHARACTERS.aaron.art.height / walk.visibleH);
  assert.equal(CHARACTERS.aaron.art.facing, 1);
  assert.equal(CHARACTERS.aaron.art.sheets.clips.attack.sheetFacing, undefined);
  assert.equal(CHARACTERS.chroma.art.facing, -1);
  assert.equal(CHARACTERS.scarlett.art.facing, -1);
  assert.equal(CHARACTERS.chroma.art.sheets.clips.attack.sheetFacing, 1);
  assert.equal(CHARACTERS.scarlett.art.sheets.clips.attack.sheetFacing, 1);
});

test('embrittle opens on the grab, and a right-facing attack stays in front', () => {
  const gail = sheetMeta('gail', 'attack');
  assert.equal(gail.release, 3);
  const fd = { startup: 4, active: 4, recovery: 6, visible: 14 };
  assert.equal(sheetFrameIndex(gail, { state: 'attack', fd, attackFrame: 4 }), 3);
  assert.ok(sheetFrameIndex(gail, { state: 'attack', fd, attackFrame: 0 }) < 3);
  const def = CHARACTERS.gail.art.sheets.clips.attack;
  const fist = MOVE_SHEETS.gail.attack.anchors.fist[3];
  assert.ok(fist[0] > def.frameW / 2);
  const world = frameToWorld(
    fist, def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500,
  );
  const fighter = {
    x: 400,
    y: 500,
    facing: 1,
    currentMoveKey: 'basicDirectional',
    charDef: CHARACTERS.gail,
    rig: { moveKey: 'basicDirectional', sheetClip: 'attack', sheetFrame: 3 },
  };
  assert.deepEqual(sheetReleasePoint(fighter, 'melee'), world);
  assert.ok(world.x > 400);
  for (const id of ['chroma', 'scarlett']) {
    const art = CHARACTERS[id].art;
    const clip = art.sheets.clips.attack;
    const ahead = frameToWorld(
      [clip.frameW * 0.8, 200], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 400, 500,
    );
    assert.ok(ahead.x > 400, id);
  }
});

test('push 2 call 3 body sheets match their clip cells', () => {
  const expect = {
    aaron: ['attack', 'charge', 'special'],
    allen: ['defense'],
    cal: ['defense', 'special'],
    chloe: ['charge', 'defense', 'special'],
    chroma: ['charge', 'defense', 'special'],
  };
  const facing = {
    aaron: undefined,
    allen: undefined,
    cal: 1,
    chloe: 1,
    chroma: 1,
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
      assert.equal(def.sheetFacing, facing[id]);
    }
  }
  assert.equal(CHARACTERS.aaron.art.sheets.clips.attack.frameW, 621);
  assert.equal(sheetMeta('aaron', 'attack').release, 6);
  const haymaker = sheetMeta('aaron', 'charge');
  assert.equal(sheetFrameIndex(haymaker, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(haymaker, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(haymaker, { state: 'charging', animT: 6 / 18 }), 0);
  assert.equal(sheetMeta('aaron', 'special').release, 6);
  const oxide = sheetMeta('allen', 'defense');
  assert.equal(oxide.gather, true);
  assert.deepEqual(oxide.loop, [3, 8]);
  assert.equal(sheetFrameIndex(oxide, { state: 'defending', animT: 0 }), 3);
  assert.equal(sheetFrameIndex(oxide, { state: 'defending', animT: 5 / 18 }), 8);
  assert.equal(sheetFrameIndex(oxide, { state: 'defending', animT: 6 / 18 }), 3);
  assert.equal(oxide.anchors.feet[0][0], 284);
  assert.ok(oxide.anchors.feet[0][0] < CHARACTERS.allen.art.sheets.clips.defense.frameW / 2);
  const chrome = sheetMeta('chroma', 'defense');
  assert.equal(chrome.gather, true);
  assert.deepEqual(chrome.loop, [3, 8]);
  assert.equal(sheetFrameIndex(chrome, { state: 'defending', animT: 0 }), 3);
  const pour = sheetMeta('cal', 'defense');
  const bond = sheetMeta('chloe', 'defense');
  assert.equal(pour.gather, true);
  assert.deepEqual(pour.loop, [0, 11]);
  assert.equal(sheetFrameIndex(pour, { state: 'defending', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(pour, { state: 'defending', animT: 11 / 18 }), 11);
  assert.equal(sheetFrameIndex(pour, { state: 'defending', animT: 12 / 18 }), 0);
  assert.deepEqual(bond.loop, [0, 11]);
  assert.equal(sheetMeta('chloe', 'charge').release, 6);
  assert.equal(sheetMeta('chloe', 'special').release, 5);
  assert.equal(sheetMeta('cal', 'special').release, 6);
  assert.equal(sheetMeta('chroma', 'charge').release, 5);
  assert.equal(sheetMeta('chroma', 'special').release, 6);
  assert.equal(sheetMeta('chroma', 'special').anchors.feet[10], null);
  const guard = CHARACTERS.aaron.art.sheets.clips.attack;
  const fist = MOVE_SHEETS.aaron.attack.anchors.fist[6];
  assert.ok(fist[0] > guard.frameW / 2);
  const world = frameToWorld(
    fist, guard.frameW, guard.frameH, guard.footY, guard.displayScale, 1, 1, 400, 500,
  );
  assert.ok(world.x > 400);
});

test('push 2 call 4 body sheets match their clip cells', () => {
  const expect = {
    flora: ['defense'],
    gail: ['charge', 'special'],
    kyle: ['charge', 'defense', 'special'],
    maggie: ['defense'],
    natalie: ['defense'],
    nitra: ['defense'],
    oxana: ['charge', 'defense'],
    phillip: ['defense'],
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
      const wantFacing = id === 'natalie' ? 1 : undefined;
      assert.equal(def.sheetFacing, wantFacing, `${id} ${name} facing`);
    }
  }
  for (const id of ['flora', 'maggie', 'natalie', 'nitra', 'phillip']) {
    const brace = sheetMeta(id, 'defense');
    assert.equal(brace.gather, true, id);
    assert.deepEqual(brace.loop, [3, 8], id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 0 }), 3, id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 5 / 18 }), 8, id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 6 / 18 }), 3, id);
  }
  const ozone = sheetMeta('oxana', 'defense');
  assert.deepEqual(ozone.loop, [3, 8]);
  assert.equal(sheetFrameIndex(ozone, { state: 'defending', animT: 0 }), 3);
  const breath = sheetMeta('oxana', 'charge');
  assert.equal(breath.release, 5);
  assert.equal(sheetFrameIndex(breath, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(breath, { state: 'charging', animT: 4 / 18 }), 4);
  assert.equal(sheetFrameIndex(breath, { state: 'charging', animT: 5 / 18 }), 0);
  const arc = sheetMeta('gail', 'charge');
  assert.equal(sheetFrameIndex(arc, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(arc, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(arc, { state: 'charging', animT: 6 / 18 }), 0);
  assert.equal(sheetMeta('gail', 'special').release, 4);
  const channel = sheetMeta('kyle', 'defense');
  assert.equal(channel.gather, true);
  assert.deepEqual(channel.loop, [0, 11]);
  assert.equal(sheetFrameIndex(channel, { state: 'defending', animT: 11 / 18 }), 11);
  assert.equal(sheetMeta('kyle', 'special').release, 1);
  const shell = CHARACTERS.nitra.art.sheets.clips.defense;
  const fist = MOVE_SHEETS.nitra.defense.anchors.fist[3];
  assert.ok(fist[0] < shell.frameW / 2);
  assert.equal(MOVE_SHEETS.nitra.defense.anchors.feet[0][0], 234);
  const world = frameToWorld(
    fist, shell.frameW, shell.frameH, shell.footY, shell.displayScale, -1, 1, 400, 500,
  );
  assert.ok(world.x > 400);
  const led = CHARACTERS.gail.art.sheets.clips.special;
  const ledFist = MOVE_SHEETS.gail.special.anchors.fist[4];
  assert.ok(ledFist[0] > led.frameW / 2);
  assert.equal(CHARACTERS.maggie.art.sheets.clips.special.file, 'maggie_charge.png');
});

test('push 2 call 5 body sheets match their clip cells', () => {
  const expect = {
    scarlett: ['charge', 'defense', 'special'],
    selena: ['attack', 'charge', 'defense'],
    silas: ['defense'],
    sully: ['charge', 'special'],
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
      assert.equal(def.sheetFacing, id === 'scarlett' ? 1 : undefined, `${id} ${name}`);
    }
  }
  const burn = sheetMeta('scarlett', 'charge');
  assert.equal(burn.release, 5);
  assert.equal(sheetFrameIndex(burn, { state: 'charging', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(burn, { state: 'charging', animT: 4 / 18 }), 4);
  assert.equal(sheetFrameIndex(burn, { state: 'charging', animT: 5 / 18 }), 0);
  assert.equal(burn.anchors.feet.filter((p) => p == null).length, 2);
  const wings = sheetMeta('scarlett', 'defense');
  assert.equal(wings.gather, true);
  assert.deepEqual(wings.loop, [0, 11]);
  assert.equal(sheetFrameIndex(wings, { state: 'defending', animT: 11 / 18 }), 11);
  assert.equal(sheetMeta('scarlett', 'special').release, 6);
  const kick = sheetMeta('selena', 'attack');
  assert.equal(kick.release, 4);
  assert.equal(kick.anchors.feet.filter((p) => p == null).length, 7);
  const copy = sheetMeta('selena', 'defense');
  assert.equal(copy.gather, true);
  assert.deepEqual(copy.loop, [3, 8]);
  assert.equal(sheetFrameIndex(copy, { state: 'defending', animT: 0 }), 3);
  const conductor = sheetMeta('selena', 'charge');
  assert.equal(sheetFrameIndex(conductor, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(conductor, { state: 'charging', animT: 6 / 18 }), 0);
  const pane = sheetMeta('silas', 'defense');
  assert.equal(pane.gather, true);
  assert.deepEqual(pane.loop, [0, 11]);
  assert.equal(CHARACTERS.silas.art.sheets.clips.charge.file, 'silas_special.png');
  const powder = sheetMeta('sully', 'charge');
  assert.equal(powder.release, 6);
  assert.equal(sheetFrameIndex(powder, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(powder, { state: 'charging', animT: 6 / 18 }), 0);
  const eruption = sheetMeta('sully', 'special');
  assert.deepEqual(eruption.active, [8, 9]);
  assert.equal(eruption.anchors.feet[0][0], 369);
  const led = CHARACTERS.scarlett.art.sheets.clips.special;
  const fist = MOVE_SHEETS.scarlett.special.anchors.fist[6];
  assert.ok(fist[0] > led.frameW / 2);
  const world = frameToWorld(
    fist, led.frameW, led.frameH, led.footY, led.displayScale, 1, 1, 400, 500,
  );
  assert.ok(world.x > 400);
});

test('push 3 call 1 body sheets match their clip cells', () => {
  const expect = {
    yara: ['charge', 'defense', 'special'],
    paula: ['charge', 'defense', 'special'],
    liv: ['charge', 'defense', 'special'],
    sandy: ['charge'],
  };
  for (const [id, names] of Object.entries(expect)) {
    const art = CHARACTERS[id].art;
    assert.equal(art.facing, 1, id);
    for (const name of names) {
      const def = art.sheets.clips[name];
      const file = `${art.sheets.dir}${def.file || `${id}_${name}.png`}`;
      const png = pngSize(file);
      assert.equal(png.w % def.frameW, 0, `${id} ${name} width`);
      assert.equal(png.h % def.frameH, 0, `${id} ${name} height`);
      const cells = (png.w / def.frameW) * (png.h / def.frameH);
      assert.ok(cells >= def.count, `${id} ${name} cells ${cells}`);
      assert.equal(def.displayScale, art.height / def.visibleH);
      assert.equal(def.sheetFacing, undefined, `${id} ${name}`);
    }
  }
  assert.equal(CHARACTERS.sandy.art.sheets.clips.attack.frameW, 942);
  assert.equal(sheetMeta('yara', 'attack').release, 7);
  assert.equal(CHARACTERS.liv.art.sheets.clips.idle.displayScale, 0.13497);
  assert.equal(CHARACTERS.liv.art.sheets.clips.walk.fps, 10.29);
  const launch = sheetMeta('yara', 'charge');
  assert.equal(launch.release, 11);
  assert.equal(launch.recovery, undefined);
  assert.equal(launch.anchors.feet.filter((p) => p == null).length, 5);
  assert.equal(sheetFrameIndex(launch, { state: 'charging', animT: 10 / 18 }), 10);
  assert.equal(sheetFrameIndex(launch, { state: 'charging', animT: 11 / 18 }), 0);
  const held = { startup: 4, active: 3, recovery: 6, visible: 13 };
  assert.equal(sheetFrameIndex(launch, { state: 'attack', fd: held, attackFrame: 8 }), 11);
  for (const id of ['yara', 'paula', 'liv']) {
    const brace = sheetMeta(id, 'defense');
    assert.equal(brace.gather, true, id);
    assert.deepEqual(brace.loop, [3, 8], id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 0 }), 3, id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 5 / 18 }), 8, id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 6 / 18 }), 3, id);
  }
  const beams = sheetMeta('liv', 'charge');
  assert.equal(beams.release, 2);
  assert.equal(sheetFrameIndex(beams, { state: 'charging', animT: 1 / 18 }), 1);
  assert.equal(sheetFrameIndex(beams, { state: 'charging', animT: 2 / 18 }), 0);
  const fusion = sheetMeta('paula', 'charge');
  assert.equal(fusion.release, 6);
  assert.equal(sheetFrameIndex(fusion, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(fusion, { state: 'charging', animT: 6 / 18 }), 0);
  assert.equal(CHARACTERS.paula.art.sheets.clips.special.file, 'paula_charge.png');
  assert.deepEqual(sheetMeta('paula', 'special').anchors, fusion.anchors);
  assert.equal(sheetMeta('paula', 'special').release, 6);
  const cry = sheetMeta('sandy', 'charge');
  assert.equal(cry.release, 9);
  assert.equal(sheetFrameIndex(cry, { state: 'charging', animT: 8 / 18 }), 8);
  assert.equal(sheetFrameIndex(cry, { state: 'charging', animT: 9 / 18 }), 0);
  const shots = [
    ['yara', 'charge', 11],
    ['paula', 'charge', 6],
    ['liv', 'charge', 2],
    ['sandy', 'charge', 9],
  ];
  for (const [id, clip, frame] of shots) {
    const def = CHARACTERS[id].art.sheets.clips[clip];
    const tip = MOVE_SHEETS[id][clip].anchors.tip[frame];
    assert.ok(tip[0] > def.frameW / 2, `${id} ${clip}`);
    const world = frameToWorld(
      tip, def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500,
    );
    const fighter = {
      x: 400,
      y: 500,
      facing: 1,
      currentMoveKey: 'basicCharge',
      charDef: CHARACTERS[id],
      rig: { moveKey: 'basicCharge', sheetClip: clip, sheetFrame: frame },
    };
    assert.deepEqual(sheetReleasePoint(fighter, 'shot'), world, `${id} ${clip}`);
    assert.ok(world.x > 400, `${id} ${clip} world`);
  }
});

test('push 3 call 3 body sheets match their clip cells', () => {
  const expect = {
    tess: ['charge', 'special'],
    yvette: ['charge', 'defense', 'special'],
    zora: ['defense'],
  };
  for (const [id, names] of Object.entries(expect)) {
    const art = CHARACTERS[id].art;
    assert.equal(art.facing, 1, id);
    for (const name of names) {
      const def = art.sheets.clips[name];
      const png = pngSize(`${art.sheets.dir}${id}_${name}.png`);
      assert.equal(png.w % def.frameW, 0, `${id} ${name} width`);
      assert.equal(png.h % def.frameH, 0, `${id} ${name} height`);
      const cells = (png.w / def.frameW) * (png.h / def.frameH);
      assert.ok(cells >= def.count, `${id} ${name} cells ${cells}`);
      assert.equal(def.displayScale, art.height / def.visibleH);
      assert.equal(def.sheetFacing, undefined, `${id} ${name}`);
    }
  }
  assert.equal(CHARACTERS.tess.art.sheets.clips.attack.frameW, 788);
  assert.equal(CHARACTERS.tess.art.sheets.clips.idle.displayScale, 0.13043);
  assert.equal(CHARACTERS.tess.art.sheets.clips.walk.fps, 11.52);
  assert.equal(CHARACTERS.zora.art.sheets.clips.attack.frameW, 792);
  assert.equal(sheetMeta('yvette', 'attack').release, 8);
  const hunger = sheetMeta('tess', 'charge');
  assert.equal(hunger.release, 3);
  assert.equal(sheetFrameIndex(hunger, { state: 'charging', animT: 2 / 18 }), 2);
  assert.equal(sheetFrameIndex(hunger, { state: 'charging', animT: 3 / 18 }), 0);
  assert.equal(sheetMeta('tess', 'special').release, 5);
  const clock = sheetMeta('yvette', 'charge');
  assert.equal(clock.release, 6);
  assert.equal(clock.anchors.feet.filter((p) => p == null).length, 6);
  assert.equal(sheetFrameIndex(clock, { state: 'charging', animT: 5 / 18 }), 5);
  assert.equal(sheetFrameIndex(clock, { state: 'charging', animT: 6 / 18 }), 0);
  const laser = sheetMeta('yvette', 'special');
  assert.equal(laser.count, 11);
  assert.equal(laser.fps, 17);
  assert.equal(laser.release, 5);
  assert.equal(CHARACTERS.yvette.art.sheets.clips.special.count, 11);
  assert.equal(CHARACTERS.yvette.art.sheets.clips.special.fps, 17);
  for (const id of ['yvette', 'zora']) {
    const brace = sheetMeta(id, 'defense');
    assert.equal(brace.gather, true, id);
    assert.deepEqual(brace.loop, [3, 8], id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 0 }), 3, id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 5 / 18 }), 8, id);
    assert.equal(sheetFrameIndex(brace, { state: 'defending', animT: 6 / 18 }), 3, id);
  }
  const shots = [
    ['tess', 'charge', 3],
    ['yvette', 'special', 5],
    ['zora', 'defense', 3],
  ];
  for (const [id, clip, frame] of shots) {
    const def = CHARACTERS[id].art.sheets.clips[clip];
    const tip = MOVE_SHEETS[id][clip].anchors.tip[frame];
    assert.ok(tip[0] > def.frameW / 2, `${id} ${clip}`);
    const world = frameToWorld(
      tip, def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500,
    );
    const fighter = {
      x: 400,
      y: 500,
      facing: 1,
      currentMoveKey: clip === 'defense' ? 'specialDefense' : clip === 'special' ? 'specialDirectional' : 'basicCharge',
      charDef: CHARACTERS[id],
      rig: { sheetClip: clip, sheetFrame: frame },
    };
    assert.deepEqual(sheetReleasePoint(fighter, 'shot'), world, `${id} ${clip}`);
    assert.ok(world.x > 400, `${id} ${clip} world`);
  }
});

test('push 3 call 2 body sheets match their clip cells', () => {
  const expect = {
    erin: ['charge', 'defense', 'special'],
    rhoda: ['charge', 'defense', 'special'],
    sandy: ['special'],
    zora: ['charge', 'special'],
  };
  for (const [id, names] of Object.entries(expect)) {
    const art = CHARACTERS[id].art;
    assert.equal(art.facing, 1, id);
    for (const name of names) {
      const def = art.sheets.clips[name];
      const png = pngSize(`${art.sheets.dir}${id}_${name}.png`);
      assert.equal(png.w % def.frameW, 0, `${id} ${name} width`);
      assert.equal(png.h % def.frameH, 0, `${id} ${name} height`);
      const cells = (png.w / def.frameW) * (png.h / def.frameH);
      assert.ok(cells >= def.count, `${id} ${name} cells ${cells}`);
      assert.equal(def.count, 12, id);
      assert.equal(def.fps, 18, id);
      assert.equal(def.displayScale, art.height / def.visibleH);
      assert.equal(def.sheetFacing, undefined, `${id} ${name}`);
    }
  }
  assert.equal(CHARACTERS.sandy.art.sheets.clips.attack.frameW, 942);
  assert.equal(CHARACTERS.zora.art.sheets.clips.attack.frameW, 792);
  assert.equal(CHARACTERS.erin.art.sheets.clips.attack.frameW, 772);
  assert.equal(CHARACTERS.rhoda.art.sheets.clips.attack.count, 8);
  assert.equal(CHARACTERS.rhoda.art.sheets.clips.attack.fps, 20);
  assert.equal(MOVE_SHEETS.sandy.defense, undefined);
  for (const id of ['erin', 'rhoda', 'zora']) {
    const charge = sheetMeta(id, 'charge');
    assert.equal(charge.gather, undefined, id);
    assert.equal(charge.release, 6, id);
    assert.deepEqual(charge.windup, [0, 5], id);
    assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 5 / 18 }), 5, id);
    assert.equal(sheetFrameIndex(charge, { state: 'charging', animT: 6 / 18 }), 0, id);
  }
  const guard = sheetMeta('rhoda', 'defense');
  assert.equal(guard.gather, true);
  assert.deepEqual(guard.loop, [3, 8]);
  assert.equal(sheetFrameIndex(guard, { state: 'defending', animT: 0 }), 3);
  assert.equal(sheetFrameIndex(guard, { state: 'defending', animT: 5 / 18 }), 8);
  assert.equal(sheetFrameIndex(guard, { state: 'defending', animT: 6 / 18 }), 3);
  const repeater = sheetMeta('erin', 'defense');
  assert.equal(repeater.gather, true);
  assert.deepEqual(repeater.loop, [0, 11]);
  assert.equal(sheetFrameIndex(repeater, { state: 'defending', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(repeater, { state: 'defending', animT: 11 / 18 }), 11);
  assert.equal(sheetFrameIndex(repeater, { state: 'defending', animT: 12 / 18 }), 0);
  const beam = sheetMeta('rhoda', 'special');
  assert.equal(beam.release, 4);
  assert.deepEqual(beam.active, [4, 8]);
  assert.deepEqual(beam.loop, [4, 8]);
  assert.equal(beam.gather, undefined);
  assert.equal(sheetMeta('sandy', 'special').release, 6);
  assert.equal(sheetMeta('zora', 'special').release, 6);
  assert.equal(sheetMeta('erin', 'special').release, 4);
  assert.deepEqual(MOVE_SHEETS.sandy.special.anchors.feet[0], [493, 863]);
  const shots = [
    ['erin', 'charge', 6, 'basicCharge'],
    ['erin', 'special', 4, 'specialDirectional'],
    ['rhoda', 'charge', 6, 'basicCharge'],
    ['rhoda', 'special', 4, 'specialDirectional'],
    ['sandy', 'special', 6, 'specialDirectional'],
    ['zora', 'charge', 6, 'basicCharge'],
    ['zora', 'special', 6, 'specialDirectional'],
  ];
  for (const [id, clip, frame, moveKey] of shots) {
    const def = CHARACTERS[id].art.sheets.clips[clip];
    const tip = MOVE_SHEETS[id][clip].anchors.tip[frame];
    if (id === 'erin' && clip === 'charge') {
      assert.deepEqual(tip, MOVE_SHEETS.erin.charge.anchors.fist[frame], 'charge FX sits on the hand');
    }
    assert.ok(tip[0] > def.frameW / 2, `${id} ${clip}`);
    const world = frameToWorld(
      tip, def.frameW, def.frameH, def.footY, def.displayScale, 1, 1, 400, 500,
    );
    const fighter = {
      x: 400,
      y: 500,
      facing: 1,
      currentMoveKey: moveKey,
      charDef: CHARACTERS[id],
      rig: { sheetClip: clip, sheetFrame: frame },
    };
    assert.deepEqual(sheetReleasePoint(fighter, 'shot'), world, `${id} ${clip}`);
    assert.ok(world.x > 400, `${id} ${clip} world`);
  }
});

test('call 6 walks match their clip cells', () => {
  const expect = {
    allen: { fps: 9.6, sheetFacing: undefined },
    silas: { fps: 7.58, sheetFacing: undefined },
    phillip: { fps: 9, sheetFacing: undefined },
    sully: { fps: 8, sheetFacing: undefined },
    kyle: { fps: 11.08, sheetFacing: undefined },
    cal: { fps: 7.38, sheetFacing: 1 },
    van: { fps: 11.52, sheetFacing: undefined },
  };
  for (const [id, spec] of Object.entries(expect)) {
    const art = CHARACTERS[id].art;
    const def = art.sheets.clips.walk;
    const png = pngSize(`${art.sheets.dir}${id}_walk.png`);
    assert.equal(png.w % def.frameW, 0, `${id} width`);
    assert.equal(png.h % def.frameH, 0, `${id} height`);
    const cells = (png.w / def.frameW) * (png.h / def.frameH);
    assert.ok(cells >= def.count, `${id} cells ${cells}`);
    assert.equal(def.count, 12);
    assert.equal(def.fps, spec.fps);
    assert.equal(def.loop, true);
    assert.equal(def.displayScale, art.height / def.visibleH);
    assert.equal(def.sheetFacing, spec.sheetFacing);
    assert.equal(MOVE_SHEETS[id].walk, undefined);
  }
  assert.equal(CHARACTERS.cal.art.facing, -1);
  assert.equal(CHARACTERS.allen.art.facing, -1);
  assert.equal(CHARACTERS.van.art.facing, -1);
});

test('oxana walk and manny attack use the redo cells', () => {
  const walk = CHARACTERS.oxana.art.sheets.clips.walk;
  const walkPng = pngSize('art-src/gemini-test/sheets/oxana_walk.png');
  assert.equal(walk.count, 12);
  assert.equal(walk.fps, 10.29);
  assert.equal(walk.loop, true);
  assert.deepEqual({ frameW: walk.frameW, frameH: walk.frameH, footY: walk.footY }, {
    frameW: 570, frameH: 1012, footY: 0.9881,
  });
  assert.equal(walk.visibleH, 976);
  assert.equal(walkPng.w, walk.frameW * 4);
  assert.equal(walkPng.h, walk.frameH * 3);
  assert.equal(walk.displayScale, CHARACTERS.oxana.art.height / walk.visibleH);

  const attack = CHARACTERS.manny.art.sheets.clips.attack;
  const attackPng = pngSize('art-src/imported/sheets/manny_attack.png');
  assert.deepEqual({ frameW: attack.frameW, frameH: attack.frameH, footY: attack.footY }, {
    frameW: 713, frameH: 740, footY: 0.977,
  });
  assert.equal(attack.count, 12);
  assert.equal(attack.fps, 18);
  assert.equal(attack.visibleH, 560);
  assert.equal(attack.displayScale, CHARACTERS.manny.art.height / attack.visibleH);
  assert.equal(attackPng.w, 713 * 4);
  assert.equal(attackPng.h, 740 * 3);
  const meta = sheetMeta('manny', 'attack');
  assert.equal(meta.release, 6);
  assert.deepEqual(meta.windup, [0, 5]);
  assert.deepEqual(meta.active, [6, 6]);
  assert.deepEqual(meta.recovery, [7, 11]);
  assert.deepEqual(meta.anchors.fist[6], [706, 329]);
  assert.deepEqual(meta.anchors.tip[6], [706, 329]);
  assert.deepEqual(meta.anchors.feet[0], [182, 722]);
});

test('van redo clips keep their own cells, and guard and redox use those frames', () => {
  const art = CHARACTERS.van.art;
  const expect = {
    walk: { frameW: 1222, frameH: 720, footY: 0.9899, fps: 11.52, file: 'van_walk.png', cols: 3, rows: 4 },
    attack: { frameW: 1222, frameH: 724, footY: 0.9903, fps: 18, file: 'van_attack.png', cols: 3, rows: 4 },
    special: { frameW: 1222, frameH: 733, footY: 0.9727, fps: 18, file: 'van_special.png', cols: 3, rows: 4 },
  };
  for (const [name, spec] of Object.entries(expect)) {
    const def = art.sheets.clips[name];
    const png = pngSize(`${art.sheets.dir}${spec.file}`);
    assert.equal(def.frameW, spec.frameW, name);
    assert.equal(def.frameH, spec.frameH, name);
    assert.equal(def.footY, spec.footY, name);
    assert.equal(def.fps, spec.fps, name);
    assert.equal(def.visibleH, 684, name);
    assert.equal(def.displayScale, art.height / def.visibleH, name);
    assert.equal(png.w, spec.frameW * spec.cols, name);
    assert.equal(png.h, spec.frameH * spec.rows, name);
  }
  const guard = sheetMeta('van', 'defense');
  assert.equal(guard.plays, 'attack');
  assert.equal(guard.pingPong, true);
  assert.deepEqual(guard.loop, [0, 1]);
  assert.equal(sheetFrameIndex(guard, { state: 'defending', animT: 0 }), 0);
  assert.equal(sheetFrameIndex(guard, { state: 'defending', animT: 1 / 18 }), 1);
  assert.equal(sheetFrameIndex(guard, { state: 'defending', animT: 2 / 18 }), 0);
  const redox = sheetMeta('van', 'charge');
  assert.equal(redox.plays, 'special');
  assert.equal(redox.pingPong, true);
  assert.deepEqual(redox.loop, [2, 4]);
  assert.equal(sheetFrameIndex(redox, { state: 'charging', animT: 0 }), 2);
  assert.equal(sheetFrameIndex(redox, { state: 'charging', animT: 1 / 18 }), 3);
  assert.equal(sheetFrameIndex(redox, { state: 'charging', animT: 2 / 18 }), 4);
  assert.equal(sheetFrameIndex(redox, { state: 'charging', animT: 3 / 18 }), 3);
  assert.equal(sheetFrameIndex(redox, { state: 'charging', animT: 4 / 18 }), 2);
  const fist = sheetMeta('van', 'attack');
  assert.deepEqual(fist.anchors.fist[6], [336, 122]);
  assert.deepEqual(fist.anchors.feet[6], [707, 716]);
  assert.deepEqual(sheetMeta('van', 'special').anchors.fist[5], [320, 277]);
  assert.deepEqual(sheetMeta('van', 'special').anchors.feet[5], [711, 725]);
});

test('rank 1-2 redraws use their own cells', () => {
  const walks = {
    chloe: { frameW: 666, frameH: 1072, footY: 0.9879, fps: 9.93, sheetFacing: 1, cols: 4, rows: 3 },
    chroma: { frameW: 666, frameH: 1036, footY: 0.9865, fps: 11.52, sheetFacing: 1, cols: 4, rows: 3 },
  };
  for (const [id, spec] of Object.entries(walks)) {
    const art = CHARACTERS[id].art;
    const def = art.sheets.clips.walk;
    const png = pngSize(`${art.sheets.dir}${id}_walk.png`);
    assert.equal(def.frameW, spec.frameW, id);
    assert.equal(def.frameH, spec.frameH, id);
    assert.equal(def.footY, spec.footY, id);
    assert.equal(def.fps, spec.fps, id);
    assert.equal(def.loop, true, id);
    assert.equal(def.count, 12, id);
    assert.equal(def.sheetFacing, spec.sheetFacing, id);
    assert.equal(def.displayScale, art.height / def.visibleH, id);
    assert.equal(png.w, spec.frameW * spec.cols, id);
    assert.equal(png.h, spec.frameH * spec.rows, id);
    assert.equal(MOVE_SHEETS[id].walk, undefined, id);
  }
  const liv = CHARACTERS.liv.art.sheets.clips.defense;
  const livPng = pngSize('art-src/imported/sheets/liv_defense.png');
  assert.equal(liv.frameW, 668);
  assert.equal(liv.frameH, 1011);
  assert.equal(liv.footY, 0.9792);
  assert.equal(livPng.w, 668 * 6);
  assert.equal(livPng.h, 1011 * 2);
  assert.deepEqual(sheetMeta('liv', 'defense').anchors.fist[1], [544, 538]);
  assert.deepEqual(sheetMeta('liv', 'defense').anchors.feet[1], [283, 998]);
  const eruption = CHARACTERS.sully.art.sheets.clips.special;
  const eruptionPng = pngSize('art-src/gemini-test/sheets/sully_special.png');
  assert.equal(eruption.frameW, 603);
  assert.equal(eruption.frameH, 790);
  assert.equal(eruption.footY, 0.9443);
  assert.equal(eruption.displayScale, CHARACTERS.sully.art.height / eruption.visibleH);
  assert.equal(eruptionPng.w, 603 * 6);
  assert.equal(eruptionPng.h, 790 * 2);
  assert.deepEqual(sheetMeta('sully', 'special').anchors.feet[0], [369, 745]);
  assert.deepEqual(sheetMeta('sully', 'special').anchors.feet[8], [465, 710]);
  assert.deepEqual(sheetMeta('sully', 'special').anchors.fist[8], [576, 163]);
});

test('ben walk uses the idle body height', () => {
  const art = CHARACTERS.ben.art;
  const def = art.sheets.clips.walk;
  const png = pngSize(`${art.sheets.dir}ben_walk.png`);
  assert.equal(def.count, 12);
  assert.equal(def.fps, 9.93);
  assert.equal(def.loop, true);
  assert.equal(def.frameW, 832);
  assert.equal(def.frameH, 1283);
  assert.equal(def.footY, 0.9337);
  assert.equal(def.visibleH, 1180);
  assert.equal(def.displayScale, art.height / def.visibleH);
  assert.equal(def.sheetFacing, undefined);
  assert.equal(png.w, 832 * 4);
  assert.equal(png.h, 1283 * 3);
  assert.equal(MOVE_SHEETS.ben, undefined);
});

test('hydra and helen walks use the defringed cells', () => {
  const walks = {
    hydra: { frameW: 1242, frameH: 720, footY: 0.9741, visibleH: 674, height: 122, cols: 6, rows: 6 },
    helen: { frameW: 1244, frameH: 692, footY: 0.9665, visibleH: 621, height: 138, cols: 6, rows: 6 },
  };
  for (const [id, spec] of Object.entries(walks)) {
    const art = CHARACTERS[id].art;
    const def = art.sheets.clips.walk;
    const png = pngSize(`${art.sheets.dir}${id}_walk.png`);
    assert.equal(def.count, 33, id);
    assert.equal(def.fps, 10, id);
    assert.equal(def.loop, true, id);
    assert.equal(def.frameW, spec.frameW, id);
    assert.equal(def.frameH, spec.frameH, id);
    assert.equal(def.footY, spec.footY, id);
    assert.equal(def.visibleH, spec.visibleH, id);
    assert.equal(def.displayScale, spec.height / spec.visibleH, id);
    assert.equal(png.w, spec.frameW * spec.cols, id);
    assert.equal(png.h, spec.frameH * spec.rows, id);
  }
});

test('rank 1-3 redraws use their own cells', () => {
  const walks = {
    natalie: { frameW: 636, frameH: 1028, footY: 0.9864, fps: 10.67, sheetFacing: 1, cols: 4, rows: 3, dir: 'art-src/gemini-test/sheets/' },
    nitra: { frameW: 444, frameH: 684, footY: 0.9795, fps: 9.29, sheetFacing: 1, cols: 4, rows: 3, dir: 'art-src/gemini-test/sheets/' },
    rhoda: { frameW: 854, frameH: 1041, footY: 0.9866, fps: 9, sheetFacing: undefined, cols: 4, rows: 3, dir: 'art-src/imported/sheets/' },
    scarlett: { frameW: 562, frameH: 1004, footY: 0.9861, fps: 12.52, sheetFacing: 1, cols: 4, rows: 3, dir: 'art-src/gemini-test/sheets/' },
  };
  for (const [id, spec] of Object.entries(walks)) {
    const art = CHARACTERS[id].art;
    const def = art.sheets.clips.walk;
    const png = pngSize(`${spec.dir}${id}_walk.png`);
    assert.equal(def.frameW, spec.frameW, id);
    assert.equal(def.frameH, spec.frameH, id);
    assert.equal(def.footY, spec.footY, id);
    assert.equal(def.fps, spec.fps, id);
    assert.equal(def.loop, true, id);
    assert.equal(def.count, 12, id);
    assert.equal(def.sheetFacing, spec.sheetFacing, id);
    assert.equal(def.visibleH, art.sheets.clips.idle.visibleH, id);
    assert.equal(def.displayScale, art.height / def.visibleH, id);
    assert.equal(png.w, spec.frameW * spec.cols, id);
    assert.equal(png.h, spec.frameH * spec.rows, id);
    assert.equal(MOVE_SHEETS[id].walk, undefined, id);
  }
  const burn = CHARACTERS.scarlett.art.sheets.clips.charge;
  const burnPng = pngSize('art-src/gemini-test/sheets/scarlett_charge.png');
  assert.equal(burn.frameW, 862);
  assert.equal(burn.frameH, 1014);
  assert.equal(burn.footY, 0.9862);
  assert.equal(burnPng.w, 862 * 4);
  assert.equal(burnPng.h, 1014 * 3);
  assert.deepEqual(sheetMeta('scarlett', 'charge').anchors.fist[6], [799, 286]);
  assert.deepEqual(sheetMeta('scarlett', 'charge').anchors.feet[5], [330, 996]);
  assert.equal(sheetMeta('scarlett', 'charge').anchors.feet[6], null);
});
