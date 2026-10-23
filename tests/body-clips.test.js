import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVE_SHEETS } from '../src/data/moveSheets.js';
import { artIsUpdated } from '../src/data/updatedArt.js';
import { bodySourceSlug, moveBodySlug } from '../src/data/bodyClips.js';
import { followThroughBlend, guardIdleBlend } from '../src/engine/feel.js';
import { bodySheetMuzzle, clipNameForMove, frameToWorld, sheetFrameIndex, sheetMeta } from '../src/engine/moveSheet.js';
import { cascadePulseArt, shoulderSlashOrigin, shoulderWhipIndex, swingFrameIndex } from '../src/engine/fxArt.js';

const FIGHTERS = ['aaron', 'ace', 'agatha', 'allen', 'amy', 'arsenio', 'aurelius', 'barry', 'ben', 'bianca', 'boar', 'bord', 'brock', 'burke', 'caesar', 'cal', 'cali', 'carter', 'ceres', 'chloe', 'chroma', 'cody', 'collin', 'cooper', 'copernicus', 'curie', 'dash', 'dizzy', 'duke', 'einstein', 'erin', 'europa', 'fermi', 'fey', 'flo', 'flora', 'ford', 'frank', 'gail', 'gertrude', 'goldie', 'haley', 'helen', 'hog', 'holly', 'hoss', 'hydra', 'indy', 'iona', 'ira', 'krypto', 'kyle', 'lana', 'lars', 'lillie', 'liv', 'lucy', 'mac', 'mae', 'maggie', 'manny', 'mendel', 'molly', 'nadia', 'natalie', 'neo', 'neptune', 'nick', 'niobe', 'niko', 'nitra', 'noble', 'ogden', 'oxana', 'oz', 'pablo', 'pat', 'paula', 'percy', 'phillip', 'pit', 'pluto', 'polonius', 'prometheus', 'ray', 'rex', 'rhoda', 'roger', 'ronan', 'ruben', 'ruth', 'saab', 'sam', 'sandy', 'scarlett', 'selena', 'silas', 'sarge', 'sterling', 'sully', 'talia', 'tara', 'tate', 'terra', 'tess', 'tessa', 'tex', 'thor', 'thule', 'titan', 'uri', 'van', 'wolf', 'xander', 'yara', 'yvette', 'zane', 'zora'];

function inCell(json, xy) {
  return Array.isArray(xy) && xy[0] >= 0 && xy[0] < json.frameW && xy[1] >= 0 && xy[1] < json.frameH;
}

/** The compiler keeps an in-cell hand. A tip past the cell uses the reach. */
function placedHand(json, index) {
  const strike = json.strike_hand_xy?.[String(index)];
  const front = json.frames?.[index]?.front_hand_xy;
  const reach = json.strike_reach_xy?.[String(index)];
  const fist = json.anchors?.fist?.[index];
  const xy = inCell(json, strike) ? strike : inCell(json, reach) ? reach : (strike || front || fist);
  return [Math.round(xy[0]), Math.round(xy[1])];
}

function footRowOf(json) {
  if (Number.isFinite(json.foot_row)) return json.foot_row;
  if (Number.isFinite(json.footY) && json.frameH > 0) return Math.round(json.footY * json.frameH) - 1;
  return null;
}

function strikesOf(json) {
  if (Array.isArray(json.strike_frames) && json.strike_frames.length) return [...json.strike_frames];
  const active = json.phases?.active;
  if (Array.isArray(active) && active.length >= 2 && active[1] >= active[0]) {
    const frames = [];
    for (let i = active[0]; i <= active[1]; i++) frames.push(i);
    return frames;
  }
  if (Number.isFinite(json.releaseFrame)) return [json.releaseFrame];
  return [];
}

function worldH(art, def) {
  const sheets = art.sheets;
  // Idle layout for the original sheets lives on the sheet, not the clip.
  const body = def.bodyH ?? def.visibleH ?? sheets.bodyH ?? sheets.visibleH;
  const scale = def.displayScale ?? sheets.displayScale ?? (art.height / body);
  return scale * body;
}

test('per-move body clips keep the idle height and the json foot line', () => {
  for (const id of FIGHTERS) {
    const art = CHARACTERS[id].art;
    const idle = art.sheets.clips.idle;
    const attack = art.sheets.clips.attack;
    // Ben, Bord, and Carter have no generic attack sheet. Titan's old
    // attack sheet stays as the legacy fallback beside the body clips.
    if (attack) assert.equal(attack.file, undefined, `${id} generic attack.png stays the fallback`);
    if (!MOVE_SHEETS[id]) assert.equal(sheetMeta(id, 'attack'), null, id);
    assert.equal(artIsUpdated(CHARACTERS[id], new Set()), true, id);
    const dir = `art-src/imported/body/${id}`;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const json = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
      const moveKey = Object.keys(CHARACTERS[id].moves).find((key) => {
        return moveBodySlug(id, CHARACTERS[id].moves[key]) === json.move;
      });
      assert.ok(moveKey, `${id} ${json.move}`);
      const clipKey = clipNameForMove(id, moveKey);
      assert.equal(clipKey, `body-${moveKey}`, `${id} ${json.move}`);
      const clip = art.sheets.clips[clipKey];
      const meta = sheetMeta(id, clipKey);
      assert.equal(clip.frameW, json.frameW, json.move);
      assert.equal(clip.frameH, json.frameH, json.move);
      assert.equal(clip.count, json.count, json.move);
      assert.equal(clip.visibleH, json.visibleH, json.move);
      assert.equal(clip.file, `${id}_${json.move}.png`, json.move);
      const strikes = strikesOf(json);
      const footRow = footRowOf(json);
      const foot = Math.round(clip.footY * clip.frameH) - 1;
      assert.equal(foot, footRow, `${json.move} foot`);
      assert.ok(Math.abs(worldH(art, clip) - worldH(art, idle)) < 1, `${json.move} height`);
      const sole = frameToWorld(
        [clip.frameW / 2, footRow], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 100, 200,
      );
      assert.ok(Math.abs(sole.y - 200) < 1, `${json.move} sole ${sole.y}`);
      for (const index of strikes) {
        const want = placedHand(json, index);
        assert.deepEqual(meta.anchors.fist[index], want, `${json.move} f${index}`);
        assert.deepEqual(meta.anchors.tip[index], want, `${json.move} tip f${index}`);
      }
      assert.equal(meta.release, strikes[0], json.move);
      const fd = { startup: 4, active: 3, recovery: 4, visible: 11 };
      const shown = sheetFrameIndex(meta, { state: 'attack', fd, attackFrame: fd.startup });
      assert.equal(shown, strikes[0], `${json.move} opens on the strike`);
      // The opening strike can still be chambered (King's Edge). A later
      // strike of the same move has to reach in front of the body.
      // Allen's sheets face left, so the palm sits on the left of the cell.
      let ahead = -Infinity;
      const native = clip.sheetFacing ?? 1;
      for (const index of strikes) {
        const placed = frameToWorld(
          meta.anchors.fist[index], clip.frameW, clip.frameH, clip.footY, clip.displayScale, native, 1, 0, 0,
        );
        if (placed.x > ahead) ahead = placed.x;
      }
      assert.ok(ahead > 0, `${json.move} hand is in front`);
      const png = PNG.sync.read(readFileSync(`${art.sheets.dir}${clip.file}`));
      assert.equal(png.width % clip.frameW, 0, json.move);
      assert.equal(png.height % clip.frameH, 0, json.move);
      const cells = (png.width / clip.frameW) * (png.height / clip.frameH);
      assert.ok(cells >= clip.count, json.move);
      assert.ok(png.width <= 8192 && png.height <= 8192, `${json.move} fits the texture limit`);
    }
  }
});

test('a move with no body clip keeps the generic attack sheet', () => {
  // Smoky Haze has no sheet. Tess still has an authored attack entry, so
  // the guard stays unnamed and the rig holds idle instead of borrowing it.
  // Bone Crush was never redrawn, so it still plays Cal's attack sheet.
  assert.equal(clipNameForMove('tess', 'specialDefense'), null);
  assert.equal(clipNameForMove('cal', 'basicDirectional'), 'attack');
  assert.equal(clipNameForMove('tess', 'basicDirectional'), 'body-basicDirectional');
  assert.ok(sheetMeta('tess', 'attack'));
  assert.ok(CHARACTERS.tess.art.sheets.clips.attack.count > 0);
  assert.ok(CHARACTERS.cal.art.sheets.clips.attack.count > 0);
});

test('Diamagnetic Repel and Quantum Leap keep their rise, and Shell Gore stays wide', () => {
  const repel = CHARACTERS.bianca.art.sheets.clips['body-specialDefense'];
  const repelMeta = sheetMeta('bianca', 'body-specialDefense');
  const repelGround = frameToWorld(
    [repel.frameW / 2, 741], repel.frameW, repel.frameH, repel.footY, repel.displayScale, 1, 1, 0, 0,
  );
  const repelAir = frameToWorld(
    [repel.frameW / 2, 662], repel.frameW, repel.frameH, repel.footY, repel.displayScale, 1, 1, 0, 0,
  );
  assert.ok(Math.abs(repelGround.y) < 1, repelGround.y);
  assert.ok(repelAir.y < repelGround.y - 10, repelAir.y);
  assert.deepEqual(repelMeta.loop, [3, 4]);

  const leap = CHARACTERS.boar.art.sheets.clips['body-basicCharge'];
  const leapMeta = sheetMeta('boar', 'body-basicCharge');
  const landed = frameToWorld(
    [leap.frameW / 2, 820], leap.frameW, leap.frameH, leap.footY, leap.displayScale, 1, 1, 0, 0,
  );
  const airborne = frameToWorld(
    [leap.frameW / 2, 508], leap.frameW, leap.frameH, leap.footY, leap.displayScale, 1, 1, 0, 0,
  );
  assert.ok(Math.abs(landed.y) < 1, landed.y);
  assert.ok(landed.y - airborne.y > 40, airborne.y);
  assert.deepEqual(leapMeta.windup, [0, 5]);
  assert.deepEqual(leapMeta.loop, [0, 2]);
  assert.equal(leapMeta.release, 6);

  const gore = CHARACTERS.boar.art.sheets.clips['body-basicDirectional'];
  const goreMeta = sheetMeta('boar', 'body-basicDirectional');
  assert.equal(gore.frameW, 1827);
  assert.equal(goreMeta.slide, CHARACTERS.boar.moves.basicDirectional.dashSpeed);
  const png = PNG.sync.read(readFileSync(`${CHARACTERS.boar.art.sheets.dir}${gore.file}`));
  assert.ok(png.width <= 8192 && png.height <= 8192);
  assert.ok((png.width / gore.frameW) * (png.height / gore.frameH) >= gore.count);
});

test('Surf\'s Up keeps her feet on the origin and slides forward in code', () => {
  const move = CHARACTERS.cali.moves.basicDirectional;
  const clip = CHARACTERS.cali.art.sheets.clips['body-basicDirectional'];
  const meta = sheetMeta('cali', 'body-basicDirectional');
  assert.equal(clip.file, 'cali_surfs-up.png');
  assert.equal(meta.slide, move.dashSpeed);
  assert.equal(move.kind, 'dash');
  const sole = frameToWorld(
    [clip.frameW / 2, 580], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 0, 0,
  );
  assert.ok(Math.abs(sole.x) < 0.01, sole.x);
  assert.ok(Math.abs(sole.y) < 1, sole.y);
  assert.ok(meta.slide > 0);
});

test('Liquid Metal Splash stays wide and under the texture limit, and the vial rides the fist', () => {
  const splash = CHARACTERS.copernicus.art.sheets.clips['body-specialDirectional'];
  const splashMeta = sheetMeta('copernicus', 'body-specialDirectional');
  assert.equal(splash.frameW, 1033);
  assert.equal(splashMeta.release, 5);
  const png = PNG.sync.read(readFileSync(`${CHARACTERS.copernicus.art.sheets.dir}${splash.file}`));
  assert.ok(png.width <= 8192 && png.height <= 8192);
  assert.equal(Math.floor(png.width / splash.frameW) * Math.floor(png.height / splash.frameH) >= splash.count, true);
  const flung = frameToWorld(
    splashMeta.anchors.fist[5], splash.frameW, splash.frameH, splash.footY, splash.displayScale, 1, 1, 0, 0,
  );
  assert.ok(flung.y < -40, flung.y);

  const vial = JSON.parse(readFileSync('assets/fx/curie/pocket-vial/fx.json', 'utf8'));
  assert.equal(vial.file, undefined);
  assert.equal(vial.fist.file, 'pocket-vial.png');
  assert.ok(vial.fist.pivotY > 0.8);
  const punch = CHARACTERS.curie.art.sheets.clips['body-basicDirectional'];
  const punchMeta = sheetMeta('curie', 'body-basicDirectional');
  assert.equal(punch.frameW, 730);
  assert.equal(punchMeta.anchors.fist.length, punch.count);
  const reach = punchMeta.anchors.fist[3][0] - punch.frameW / 2;
  assert.ok(reach > 300, reach);

  const toss = sheetMeta('curie', 'body-specialDirectional');
  assert.equal(toss.release, 4);
  assert.ok(toss.anchors.fist[5][1] < toss.anchors.fist[4][1]);
});

test('Turbine Gust covers the fingertip where the painted beam was cut off', () => {
  const clip = CHARACTERS.dizzy.art.sheets.clips['body-basicCharge'];
  const meta = sheetMeta('dizzy', 'body-basicCharge');
  assert.deepEqual(meta.anchors.fist[5], [572, 252]);
  assert.ok(meta.anchors.fist[5][0] < clip.frameW);
  const fighter = {
    charDef: CHARACTERS.dizzy,
    currentMoveKey: 'basicCharge',
    facing: 1,
    x: 0,
    y: 0,
    rig: { sheetClip: 'body-basicCharge', sheetFrame: 5, moveKey: 'basicCharge' },
  };
  const raw = frameToWorld(
    meta.anchors.fist[5], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 0, 0,
  );
  const muzzle = bodySheetMuzzle(fighter);
  // The wave's black lead starts the visible gust ahead of the sprite origin,
  // so the origin has to sit well back on the hand.
  assert.ok(raw.x - muzzle.x >= 36, raw.x - muzzle.x);
  assert.ok(Math.abs(muzzle.y - raw.y) < 0.01);
  const lampClip = CHARACTERS.dizzy.art.sheets.clips['body-specialDirectional'];
  const lampMeta = sheetMeta('dizzy', 'body-specialDirectional');
  const lamp = {
    charDef: CHARACTERS.dizzy,
    currentMoveKey: 'specialDirectional',
    facing: 1,
    x: 0,
    y: 0,
    rig: { sheetClip: 'body-specialDirectional', sheetFrame: 2, moveKey: 'specialDirectional' },
  };
  const lampRaw = frameToWorld(
    lampMeta.anchors.fist[2], lampClip.frameW, lampClip.frameH, lampClip.footY, lampClip.displayScale, 1, 1, 0, 0,
  );
  const lampMuzzle = bodySheetMuzzle(lamp);
  assert.ok(Math.abs(lampRaw.x - lampMuzzle.x - 12) < 0.05, lampRaw.x - lampMuzzle.x);

  const wall = sheetMeta('dizzy', 'body-specialDefense');
  const planted = frameToWorld(
    wall.anchors.tip[3], CHARACTERS.dizzy.art.sheets.clips['body-specialDefense'].frameW,
    CHARACTERS.dizzy.art.sheets.clips['body-specialDefense'].frameH,
    CHARACTERS.dizzy.art.sheets.clips['body-specialDefense'].footY,
    CHARACTERS.dizzy.art.sheets.clips['body-specialDefense'].displayScale,
    1, 1, 0, 0,
  );
  assert.ok(Math.abs(planted.y) < 24, planted.y);
  assert.ok(planted.x > 0);
});

test('Afterimage Decay hops back into a guard and fades to idle', () => {
  const clip = CHARACTERS.dash.art.sheets.clips['body-specialDefense'];
  const meta = sheetMeta('dash', 'body-specialDefense');
  assert.equal(clip.file, 'dash_afterimage-decay.png');
  assert.deepEqual(meta.intro, [0, 3]);
  assert.deepEqual(meta.loop, [4, 7]);
  assert.equal(meta.blendIdle, true);
  assert.equal(sheetFrameIndex(meta, { state: 'defending', held: 0 }), 0);
  const introSec = 4 / meta.fps;
  assert.equal(sheetFrameIndex(meta, { state: 'defending', held: introSec * 0.7 }), 2);
  assert.equal(sheetFrameIndex(meta, { state: 'defending', held: introSec + 0.01 }), 4);
  const ground = frameToWorld(
    [clip.frameW / 2, 591], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 0, 0,
  );
  const air = frameToWorld(
    [clip.frameW / 2, 570], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 0, 0,
  );
  assert.ok(Math.abs(ground.y) < 1, ground.y);
  assert.ok(air.y < ground.y - 4, air.y);
  assert.equal(guardIdleBlend(0.5), 0);
  assert.ok(guardIdleBlend(1) > 0.99);
});

test('Heavy Ion Bolt leaves the braced palm, and Half-Life Sprint stays under the texture limit', () => {
  const bolt = CHARACTERS.duke.art.sheets.clips['body-specialDirectional'];
  const boltMeta = sheetMeta('duke', 'body-specialDirectional');
  assert.equal(bolt.file, 'duke_heavy-ion-bolt.png');
  assert.ok(boltMeta.anchors.fist[5][0] > bolt.frameW - 12, boltMeta.anchors.fist[5][0]);
  const palm = frameToWorld(
    boltMeta.anchors.fist[5], bolt.frameW, bolt.frameH, bolt.footY, bolt.displayScale, 1, 1, 0, 0,
  );
  assert.ok(palm.x > 70, palm.x);
  assert.ok(palm.y < -70, palm.y);

  const sprint = CHARACTERS.dash.art.sheets.clips['body-basicCharge'];
  const sprintMeta = sheetMeta('dash', 'body-basicCharge');
  assert.equal(sprintMeta.slide, CHARACTERS.dash.moves.basicCharge.dashSpeed);
  const png = PNG.sync.read(readFileSync(`${CHARACTERS.dash.art.sheets.dir}${sprint.file}`));
  assert.ok(png.width <= 8192 && png.height <= 8192);
  assert.equal(png.width, 7320);
  assert.equal(png.height, 1222);
  const kick = sheetMeta('dash', 'body-basicDirectional');
  assert.equal(kick.slide, CHARACTERS.dash.moves.basicDirectional.dashSpeed);
});

test('Chicago Pile is a swappable sheet, and Fermi\'s other moves keep their hands', () => {
  const pile = CHARACTERS.fermi.art.sheets.clips['body-basicCharge'];
  const pileMeta = sheetMeta('fermi', 'body-basicCharge');
  assert.equal(pile.file, 'fermi_chicago-pile.png');
  assert.equal(pile.frameW, 477);
  assert.deepEqual(pileMeta.loop, [0, 1]);
  assert.deepEqual(pileMeta.active, [2, 6]);
  assert.deepEqual(pileMeta.anchors.fist[2], [429, 202]);
  assert.deepEqual(pileMeta.anchors.fist[5], [473, 245]);
  const stack = frameToWorld(
    pileMeta.anchors.fist[3], pile.frameW, pile.frameH, pile.footY, pile.displayScale, 1, 1, 0, 0,
  );
  assert.ok(stack.x > 40, stack.x);
  assert.ok(stack.y < -70, stack.y);

  const punch = CHARACTERS.fermi.art.sheets.clips['body-basicDirectional'];
  const punchMeta = sheetMeta('fermi', 'body-basicDirectional');
  assert.equal(punch.file, 'fermi_slow-neutron-punch.png');
  assert.ok(punchMeta.anchors.fist[3][0] > punch.frameW - 12, punchMeta.anchors.fist[3][0]);
  const fist = frameToWorld(
    punchMeta.anchors.fist[3], punch.frameW, punch.frameH, punch.footY, punch.displayScale, 1, 1, 0, 0,
  );
  assert.ok(fist.x > 70, fist.x);
  assert.ok(fist.y < -80, fist.y);

  const zone = sheetMeta('fermi', 'body-specialDefense');
  assert.equal(CHARACTERS.fermi.art.sheets.clips['body-specialDefense'].file, 'fermi_exclusion-zone.png');
  assert.deepEqual(zone.loop, [2, 5]);
  assert.equal(zone.blendIdle, undefined);
  assert.equal(sheetFrameIndex(zone, { state: 'defending', animT: 0, fd: null }), zone.active[0]);

  const signal = CHARACTERS.fermi.art.sheets.clips['body-specialDirectional'];
  const signalMeta = sheetMeta('fermi', 'body-specialDirectional');
  assert.equal(signal.file, 'fermi_fermi-paradox.png');
  const raised = frameToWorld(
    signalMeta.anchors.fist[3], signal.frameW, signal.frameH, signal.footY, signal.displayScale, 1, 1, 0, 0,
  );
  assert.ok(raised.y < fist.y, raised.y);
});

test('Riptide slides from a wide lunge, and Magic Number keeps the json foot row', () => {
  const tide = CHARACTERS.flo.art.sheets.clips['body-basicDirectional'];
  const tideMeta = sheetMeta('flo', 'body-basicDirectional');
  assert.equal(tide.file, 'flo_riptide.png');
  assert.equal(tide.frameW, 924);
  assert.equal(tideMeta.slide, CHARACTERS.flo.moves.basicDirectional.dashSpeed);
  assert.ok(tideMeta.anchors.fist[3][0] > tide.frameW - 8, tideMeta.anchors.fist[3][0]);
  const png = PNG.sync.read(readFileSync(`${CHARACTERS.flo.art.sheets.dir}${tide.file}`));
  assert.equal(png.width, 7392);
  assert.ok(png.width <= 8192 && png.height <= 8192);

  const isle = sheetMeta('flo', 'body-basicCharge');
  assert.equal(CHARACTERS.flo.art.sheets.clips['body-basicCharge'].file, 'flo_island-of-stability.png');
  assert.deepEqual(isle.loop, [0, 2]);
  assert.deepEqual(isle.active, [3, 5]);

  const crisis = sheetMeta('flo', 'body-specialDefense');
  assert.equal(CHARACTERS.flo.art.sheets.clips['body-specialDefense'].file, 'flo_identity-crisis.png');
  assert.deepEqual(crisis.loop, [2, 5]);
  assert.equal(crisis.blendIdle, undefined);

  const magic = CHARACTERS.flo.art.sheets.clips['body-specialDirectional'];
  const magicMeta = sheetMeta('flo', 'body-specialDirectional');
  assert.equal(magic.file, 'flo_magic-number.png');
  assert.equal(Math.round(magic.footY * magic.frameH) - 1, 593);
  const cup = frameToWorld(
    magicMeta.anchors.fist[3], magic.frameW, magic.frameH, magic.footY, magic.displayScale, 1, 1, 0, 0,
  );
  const push = frameToWorld(
    magicMeta.anchors.fist[4], magic.frameW, magic.frameH, magic.footY, magic.displayScale, 1, 1, 0, 0,
  );
  assert.ok(push.x > cup.x + 15, push.x - cup.x);
  assert.ok(push.y < cup.y, push.y);
});

test('Transmute Ray leaves the open palm, and Gold Foil holds the raised hands', () => {
  const ray = CHARACTERS.ford.art.sheets.clips['body-specialDirectional'];
  const rayMeta = sheetMeta('ford', 'body-specialDirectional');
  assert.equal(ray.file, 'ford_transmute-ray.png');
  assert.ok(rayMeta.anchors.fist[2][0] > ray.frameW - 30, rayMeta.anchors.fist[2][0]);
  const fighter = {
    charDef: CHARACTERS.ford,
    currentMoveKey: 'specialDirectional',
    facing: 1,
    x: 0,
    y: 0,
    rig: { sheetClip: 'body-specialDirectional', sheetFrame: 2, moveKey: 'specialDirectional' },
  };
  const raw = frameToWorld(
    rayMeta.anchors.fist[2], ray.frameW, ray.frameH, ray.footY, ray.displayScale, 1, 1, 0, 0,
  );
  const muzzle = bodySheetMuzzle(fighter);
  assert.ok(Math.abs(raw.x - muzzle.x - 12) < 0.05, raw.x - muzzle.x);
  assert.ok(Math.abs(raw.y - muzzle.y) < 0.01);

  const dense = sheetMeta('ford', 'body-basicCharge');
  const denseClip = CHARACTERS.ford.art.sheets.clips['body-basicCharge'];
  assert.equal(denseClip.file, 'ford_dense-nucleus.png');
  assert.deepEqual(dense.loop, [0, 2]);
  assert.deepEqual(dense.active, [3, 6]);
  assert.ok(dense.anchors.fist[3][0] > denseClip.frameW - 12, dense.anchors.fist[3][0]);

  const foil = sheetMeta('ford', 'body-specialDefense');
  assert.equal(CHARACTERS.ford.art.sheets.clips['body-specialDefense'].file, 'ford_gold-foil.png');
  assert.deepEqual(foil.loop, [2, 6]);
  assert.equal(sheetFrameIndex(foil, { state: 'defending', animT: 0, fd: null }), 2);
});

test('Beta Turn crouches into a spread, and Alpha Flick leaves the extended hand', () => {
  const turn = sheetMeta('frank', 'body-basicCharge');
  assert.equal(CHARACTERS.frank.art.sheets.clips['body-basicCharge'].file, 'frank_beta-turn.png');
  assert.deepEqual(turn.loop, [0, 3]);
  assert.deepEqual(turn.active, [4, 5]);

  const duck = sheetMeta('frank', 'body-specialDefense');
  assert.equal(CHARACTERS.frank.art.sheets.clips['body-specialDefense'].file, 'frank_trace-amount.png');
  assert.deepEqual(duck.loop, [2, 5]);
  assert.ok(duck.anchors.fist[5][1] > duck.anchors.fist[2][1]);

  const flick = CHARACTERS.frank.art.sheets.clips['body-specialDirectional'];
  const flickMeta = sheetMeta('frank', 'body-specialDirectional');
  assert.equal(flick.file, 'frank_alpha-flick.png');
  assert.equal(flickMeta.release, 2);
  const hand = frameToWorld(
    flickMeta.anchors.fist[2], flick.frameW, flick.frameH, flick.footY, flick.displayScale, 1, 1, 0, 0,
  );
  assert.ok(hand.x > 40, hand.x);
  assert.ok(hand.y < -80, hand.y);

  const jab = CHARACTERS.frank.art.sheets.clips['body-basicDirectional'];
  const jabMeta = sheetMeta('frank', 'body-basicDirectional');
  assert.equal(jab.file, 'frank_vanishing-jab.png');
  assert.ok(jabMeta.anchors.fist[2][0] > jab.frameW - 12, jabMeta.anchors.fist[2][0]);
});

test('Neutron Sink throws from an empty hand, and High-K Gate holds the raised arms', () => {
  const sink = CHARACTERS.haley.art.sheets.clips['body-specialDirectional'];
  const sinkMeta = sheetMeta('haley', 'body-specialDirectional');
  assert.equal(sink.file, 'haley_neutron-sink.png');
  assert.equal(sinkMeta.release, 4);
  assert.deepEqual(sinkMeta.anchors.fist[4], [633, 244]);
  assert.deepEqual(sinkMeta.anchors.fist[5], [683, 151]);
  const wind = frameToWorld(
    sinkMeta.anchors.fist[1], sink.frameW, sink.frameH, sink.footY, sink.displayScale, 1, 1, 0, 0,
  );
  const release = frameToWorld(
    sinkMeta.anchors.fist[4], sink.frameW, sink.frameH, sink.footY, sink.displayScale, 1, 1, 0, 0,
  );
  assert.ok(release.x > wind.x + 20, release.x - wind.x);

  const gate = sheetMeta('haley', 'body-specialDefense');
  assert.equal(CHARACTERS.haley.art.sheets.clips['body-specialDefense'].file, 'haley_high-k-gate.png');
  assert.deepEqual(gate.loop, [2, 7]);
  assert.equal(sheetFrameIndex(gate, { state: 'defending', animT: 0, fd: null }), 2);

  const cutter = sheetMeta('haley', 'body-basicCharge');
  assert.deepEqual(cutter.loop, [0, 4]);
  assert.deepEqual(cutter.active, [5, 6]);
});

test('Pole Piece is a swappable sheet, and Stone Breaker leaves the aimed hand', () => {
  const pole = CHARACTERS.holly.art.sheets.clips['body-specialDirectional'];
  const poleMeta = sheetMeta('holly', 'body-specialDirectional');
  assert.equal(pole.file, 'holly_pole-piece.png');
  assert.equal(pole.frameW, 561);
  assert.deepEqual(poleMeta.active, [4, 5]);
  assert.deepEqual(poleMeta.anchors.fist[4], [556, 112]);
  assert.deepEqual(poleMeta.anchors.fist[5], [554, 126]);

  const beam = CHARACTERS.holly.art.sheets.clips['body-basicCharge'];
  const beamMeta = sheetMeta('holly', 'body-basicCharge');
  assert.equal(beam.file, 'holly_stone-breaker.png');
  assert.equal(beamMeta.release, 2);
  const fighter = {
    charDef: CHARACTERS.holly,
    currentMoveKey: 'basicCharge',
    facing: 1,
    x: 0,
    y: 0,
    rig: { sheetClip: 'body-basicCharge', sheetFrame: 2, moveKey: 'basicCharge' },
  };
  const raw = frameToWorld(
    beamMeta.anchors.fist[2], beam.frameW, beam.frameH, beam.footY, beam.displayScale, 1, 1, 0, 0,
  );
  const muzzle = bodySheetMuzzle(fighter);
  assert.ok(Math.abs(raw.x - muzzle.x - 12) < 0.05, raw.x - muzzle.x);

  const brace = sheetMeta('holly', 'body-specialDefense');
  assert.equal(CHARACTERS.holly.art.sheets.clips['body-specialDefense'].file, 'holly_bend-dont-break.png');
  assert.deepEqual(brace.loop, [2, 6]);
});

test('Quicksilver Lash leaves the thrust hand, and Hoss keeps her gallop and horseshoe', () => {
  const lash = CHARACTERS.hog.art.sheets.clips['body-basicDirectional'];
  const lashMeta = sheetMeta('hog', 'body-basicDirectional');
  assert.equal(lash.file, 'hog_quicksilver-lash.png');
  assert.deepEqual(lashMeta.active, [2, 6]);
  assert.deepEqual(lashMeta.anchors.fist[4], [580, 114]);
  assert.ok(lashMeta.anchors.fist[4][0] > lash.frameW - 12);
  const fighter = {
    charDef: CHARACTERS.hog,
    currentMoveKey: 'basicDirectional',
    facing: 1,
    x: 400,
    y: 560,
    bodyW: 40,
    bodyH: 80,
    rig: { sheetClip: 'body-basicDirectional', sheetFrame: 4, moveKey: 'basicDirectional' },
  };
  const hand = frameToWorld(
    lashMeta.anchors.fist[4], lash.frameW, lash.frameH, lash.footY, lash.displayScale, 1, 1, 400, 560,
  );
  const origin = shoulderSlashOrigin(fighter);
  assert.ok(Math.abs(origin.x - hand.x) < 0.05, origin.x - hand.x);
  assert.ok(Math.abs(origin.y - hand.y) < 0.05, origin.y - hand.y);
  const shoulder = 400 + 40 * 0.25;
  assert.ok(origin.x > shoulder + 40, origin.x - shoulder);
  assert.equal(shoulderWhipIndex(2, lashMeta.active, 12), 4);
  assert.equal(shoulderWhipIndex(4, lashMeta.active, 12), 6);
  assert.equal(shoulderWhipIndex(5, lashMeta.active, 12), 7);
  assert.equal(shoulderWhipIndex(6, lashMeta.active, 12), 8);

  const bulb = sheetMeta('hog', 'body-basicCharge');
  assert.deepEqual(bulb.loop, [0, 4]);
  assert.deepEqual(bulb.active, [5, 6]);
  const guard = sheetMeta('hog', 'body-specialDefense');
  assert.equal(CHARACTERS.hog.art.sheets.clips['body-specialDefense'].file, 'hog_amalgamate.png');
  assert.deepEqual(guard.loop, [2, 6]);

  const gallop = sheetMeta('hoss', 'body-basicCharge');
  assert.equal(CHARACTERS.hoss.art.sheets.clips['body-basicCharge'].file, 'hoss_stampede.png');
  assert.equal(gallop.slide, 780);
  assert.deepEqual(gallop.loop, [0, 3]);
  assert.deepEqual(gallop.active, [4, 6]);
  const magic = sheetMeta('hoss', 'body-specialDefense');
  assert.equal(CHARACTERS.hoss.art.sheets.clips['body-specialDefense'].file, 'hoss_doubly-magic.png');
  assert.deepEqual(magic.loop, [2, 5]);
  const shoe = CHARACTERS.hoss.art.sheets.clips['body-specialDirectional'];
  const shoeMeta = sheetMeta('hoss', 'body-specialDirectional');
  assert.equal(shoe.file, 'hoss_lucky-horseshoe.png');
  assert.equal(shoeMeta.release, 3);
  assert.ok(shoeMeta.anchors.fist[3][0] > shoe.frameW - 12, shoeMeta.anchors.fist[3][0]);
  assert.ok(shoeMeta.anchors.fist[3][1] > 250, shoeMeta.anchors.fist[3][1]);
});

test('Atom Smasher holds the follow-through and fades it back to idle', () => {
  const smash = CHARACTERS.lars.art.sheets.clips['body-specialDirectional'];
  const meta = sheetMeta('lars', 'body-specialDirectional');
  assert.equal(smash.file, 'lars_atom-smasher.png');
  assert.equal(meta.blendIdle, true);
  assert.equal(meta.recovery, null);
  assert.deepEqual(meta.active, [4, 6]);
  assert.ok(meta.anchors.fist[4][0] > smash.frameW - 20, meta.anchors.fist[4][0]);
  const fd = { startup: 3, active: 6, recovery: 20, visible: 29 };
  assert.equal(sheetFrameIndex(meta, { state: 'attack', fd, attackFrame: 3 }), 4);
  assert.equal(sheetFrameIndex(meta, { state: 'attack', fd, attackFrame: 14 }), 6);
  assert.equal(followThroughBlend(fd, 8), 0);
  assert.equal(followThroughBlend(fd, 9), 0);
  assert.ok(followThroughBlend(fd, 28) > 0.99);

  const beam = CHARACTERS.lars.art.sheets.clips['body-basicCharge'];
  const beamMeta = sheetMeta('lars', 'body-basicCharge');
  assert.equal(beam.file, 'lars_cyclotron-beam.png');
  assert.equal(beamMeta.release, 4);
  assert.deepEqual(beamMeta.loop, [0, 3]);
  const fighter = {
    charDef: CHARACTERS.lars,
    currentMoveKey: 'basicCharge',
    facing: 1,
    x: 0,
    y: 0,
    rig: { sheetClip: 'body-basicCharge', sheetFrame: 4, moveKey: 'basicCharge' },
  };
  const raw = frameToWorld(
    beamMeta.anchors.fist[4], beam.frameW, beam.frameH, beam.footY, beam.displayScale, 1, 1, 0, 0,
  );
  const muzzle = bodySheetMuzzle(fighter);
  assert.ok(Math.abs(raw.x - muzzle.x - 12) < 0.05, raw.x - muzzle.x);

  const plates = sheetMeta('lars', 'body-specialDefense');
  assert.equal(CHARACTERS.lars.art.sheets.clips['body-specialDefense'].file, 'lars_dee-plates.png');
  assert.deepEqual(plates.loop, [2, 5]);

  const kilo = sheetMeta('ira', 'body-specialDefense');
  assert.equal(CHARACTERS.ira.art.sheets.clips['body-specialDefense'].file, 'ira_prototype-kilogram.png');
  assert.deepEqual(kilo.loop, [2, 5]);
  const iris = CHARACTERS.ira.art.sheets.clips['body-specialDirectional'];
  const irisMeta = sheetMeta('ira', 'body-specialDirectional');
  assert.equal(iris.file, 'ira_iris-scatter.png');
  assert.equal(irisMeta.release, 3);
  assert.ok(irisMeta.anchors.fist[4][0] > iris.frameW - 20, irisMeta.anchors.fist[4][0]);
});

test('Decay Cascade bursts carry the pulses, and Mac and Mae keep their hands', () => {
  const cascade = CHARACTERS.mac.art.sheets.clips['body-basicCharge'];
  const cascadeMeta = sheetMeta('mac', 'body-basicCharge');
  assert.equal(cascade.file, 'mac_decay-cascade.png');
  assert.deepEqual(cascadeMeta.active, [1, 5]);
  assert.deepEqual(cascadeMeta.loop, [0, 0]);
  for (const i of [1, 2, 3, 4, 5]) {
    const hand = cascadeMeta.anchors.fist[i];
    assert.ok(hand[0] > 0 && hand[0] < cascade.frameW, hand[0]);
    assert.ok(hand[1] > 0 && hand[1] < cascade.frameH, hand[1]);
  }
  const first = cascadePulseArt({ frames: Array(8), fps: 24, scale: 1 }, 0, 5);
  assert.equal(first.scale, 1);
  assert.ok(first.fps >= 72, first.fps);
  assert.ok((first.frames.length / first.fps) * 1000 < 120);
  assert.equal(first.lifeMs, 128);
  const mid = cascadePulseArt({ frames: Array(8), fps: 24, scale: 0.64 }, 2, 5);
  assert.equal(mid.scale, 0.64);
  const last = cascadePulseArt({ frames: Array(24), fps: 16, scale: 0.42 }, 4, 5);
  assert.equal(last.fps, 16);
  assert.equal(last.scale, 0.42);
  assert.equal(last.lifeMs, undefined);

  const hammer = CHARACTERS.mac.art.sheets.clips['body-basicDirectional'];
  const hammerPng = PNG.sync.read(readFileSync('art-src/imported/sheets/mac_red-hammer.png'));
  assert.equal(hammer.file, 'mac_red-hammer.png');
  assert.ok(hammerPng.width <= 8192 && hammerPng.height <= 8192);
  assert.equal(hammerPng.width % hammer.frameW, 0);
  assert.ok(Math.round(hammerPng.width / hammer.frameW) * Math.round(hammerPng.height / hammer.frameH) >= hammer.count);

  const doll = sheetMeta('mac', 'body-specialDefense');
  assert.deepEqual(doll.loop, [2, 5]);
  const fuse = CHARACTERS.mac.art.sheets.clips['body-specialDirectional'];
  const fuseMeta = sheetMeta('mac', 'body-specialDirectional');
  assert.equal(fuseMeta.release, 3);
  assert.ok(fuseMeta.anchors.fist[3][0] > fuse.frameW - 16, fuseMeta.anchors.fist[3][0]);

  const drop = sheetMeta('mae', 'body-basicCharge');
  assert.equal(CHARACTERS.mae.art.sheets.clips['body-basicCharge'].file, 'mae_liquid-drop-split.png');
  assert.equal(drop.release, 5);
  const slip = sheetMeta('mae', 'body-specialDefense');
  assert.deepEqual(slip.active, [4, 6]);
  assert.deepEqual(slip.loop, [4, 6]);
  const split = CHARACTERS.mae.art.sheets.clips['body-specialDirectional'];
  const splitMeta = sheetMeta('mae', 'body-specialDirectional');
  assert.equal(splitMeta.release, 3);
  assert.ok(splitMeta.anchors.fist[3][0] > split.frameW - 20, splitMeta.anchors.fist[3][0]);
});

test('Mendel and Neptune keep their hands, and the trident leaves the fist', () => {
  const dream = CHARACTERS.mendel.art.sheets.clips['body-basicCharge'];
  const dreamMeta = sheetMeta('mendel', 'body-basicCharge');
  assert.equal(dream.file, 'mendel_dream-of-the-table.png');
  assert.deepEqual(dreamMeta.active, [4, 5]);
  assert.deepEqual(dreamMeta.loop, [0, 3]);

  const taps = CHARACTERS.mendel.art.sheets.clips['body-basicDirectional'];
  const tapsMeta = sheetMeta('mendel', 'body-basicDirectional');
  assert.equal(taps.file, 'mendel_one-atom-at-a-time.png');
  assert.deepEqual(tapsMeta.active, [2, 5]);
  assert.ok(tapsMeta.anchors.fist[2][0] > taps.frameW - 16, tapsMeta.anchors.fist[2][0]);

  const square = sheetMeta('mendel', 'body-specialDefense');
  assert.equal(CHARACTERS.mendel.art.sheets.clips['body-specialDefense'].file, 'mendel_empty-square.png');
  assert.deepEqual(square.loop, [3, 5]);

  const drop = CHARACTERS.mendel.art.sheets.clips['body-specialDirectional'];
  const dropMeta = sheetMeta('mendel', 'body-specialDirectional');
  assert.equal(drop.file, 'mendel_group-drop.png');
  assert.equal(dropMeta.release, 4);

  const flask = CHARACTERS.neptune.art.sheets.clips['body-basicCharge'];
  const flaskMeta = sheetMeta('neptune', 'body-basicCharge');
  assert.equal(flask.file, 'neptune_mad-science-flask.png');
  assert.equal(flaskMeta.release, 5);
  assert.ok(flaskMeta.anchors.fist[5][0] > flask.frameW - 16, flaskMeta.anchors.fist[5][0]);

  const thrust = CHARACTERS.neptune.art.sheets.clips['body-basicDirectional'];
  const thrustMeta = sheetMeta('neptune', 'body-basicDirectional');
  assert.equal(thrust.file, 'neptune_trident-thrust.png');
  assert.deepEqual(thrustMeta.active, [3, 5]);
  assert.ok(thrustMeta.anchors.fist[3][0] > thrust.frameW - 16, thrustMeta.anchors.fist[3][0]);

  const coat = sheetMeta('neptune', 'body-specialDefense');
  assert.equal(CHARACTERS.neptune.art.sheets.clips['body-specialDefense'].file, 'neptune_lab-coat-shield.png');
  assert.deepEqual(coat.loop, [2, 6]);

  const seed = CHARACTERS.neptune.art.sheets.clips['body-specialDirectional'];
  const seedMeta = sheetMeta('neptune', 'body-specialDirectional');
  assert.equal(seed.file, 'neptune_breeder-seed.png');
  assert.equal(seedMeta.release, 3);
  assert.ok(seedMeta.anchors.fist[3][0] > seed.frameW - 20, seedMeta.anchors.fist[3][0]);

  const trident = JSON.parse(readFileSync('assets/fx/neptune/trident-thrust/fx.json', 'utf8'));
  assert.equal(trident.anchor, 'fist');
  assert.equal(trident.pivotX, 0);
  assert.deepEqual(trident.swing, [2, 5]);
  assert.equal(swingFrameIndex(0, trident.swing, 8), 2);
  assert.equal(swingFrameIndex(0.375, trident.swing, 8), 3);
  assert.equal(swingFrameIndex(0.75, trident.swing, 8), 4);
  assert.equal(swingFrameIndex(1, trident.swing, 8), 5);
});

test('Niko keeps his hands, and Rising Sun releases on the palm', () => {
  const sun = CHARACTERS.niko.art.sheets.clips['body-basicCharge'];
  const sunMeta = sheetMeta('niko', 'body-basicCharge');
  assert.equal(sun.file, 'niko_rising-sun.png');
  assert.deepEqual(sunMeta.active, [5, 6]);
  assert.deepEqual(sunMeta.loop, [0, 4]);
  assert.equal(sunMeta.release, 5);
  const sunFx = JSON.parse(readFileSync('assets/fx/niko/rising-sun/fx.json', 'utf8'));
  assert.equal(sunFx.scale, 0.42);
  assert.ok(sunFx.heightFrac * sunFx.scale * 132 >= 150, sunFx.heightFrac);

  const combo = CHARACTERS.niko.art.sheets.clips['body-basicDirectional'];
  const comboMeta = sheetMeta('niko', 'body-basicDirectional');
  assert.equal(combo.file, 'niko_three-atom-combo.png');
  assert.deepEqual(comboMeta.active, [1, 6]);
  assert.ok(comboMeta.anchors.fist[1][0] > combo.frameW - 70, comboMeta.anchors.fist[1][0]);
  assert.ok(comboMeta.anchors.fist[6][0] > combo.frameW - 16, comboMeta.anchors.fist[6][0]);

  const wait = sheetMeta('niko', 'body-specialDefense');
  assert.equal(CHARACTERS.niko.art.sheets.clips['body-specialDefense'].file, 'niko_nine-year-wait.png');
  assert.deepEqual(wait.loop, [4, 5]);
  assert.ok(wait.anchors.fist[4][0] > CHARACTERS.niko.art.sheets.clips['body-specialDefense'].frameW - 30);

  const beam = CHARACTERS.niko.art.sheets.clips['body-specialDirectional'];
  const beamMeta = sheetMeta('niko', 'body-specialDirectional');
  assert.equal(beam.file, 'niko_zinc-ion-beam.png');
  assert.equal(beamMeta.release, 4);
  assert.ok(beamMeta.anchors.fist[4][0] > beam.frameW - 30, beamMeta.anchors.fist[4][0]);
});

test('Noble and Ogden keep their hands, and the medal arc extends the swing', () => {
  const vial = CHARACTERS.noble.art.sheets.clips['body-basicCharge'];
  const vialMeta = sheetMeta('noble', 'body-basicCharge');
  assert.equal(vial.file, 'noble_nitroglycerin-vial.png');
  assert.deepEqual(vialMeta.active, [5, 6]);
  assert.deepEqual(vialMeta.loop, [0, 4]);
  assert.equal(vialMeta.release, 5);

  const medal = CHARACTERS.noble.art.sheets.clips['body-basicDirectional'];
  const medalMeta = sheetMeta('noble', 'body-basicDirectional');
  assert.equal(medal.file, 'noble_medal-swing.png');
  assert.deepEqual(medalMeta.active, [3, 5]);
  assert.ok(medalMeta.anchors.fist[5][0] > medal.frameW - 16, medalMeta.anchors.fist[5][0]);

  const prize = sheetMeta('noble', 'body-specialDefense');
  assert.equal(CHARACTERS.noble.art.sheets.clips['body-specialDefense'].file, 'noble_peace-prize.png');
  assert.deepEqual(prize.loop, [2, 5]);

  const ions = CHARACTERS.noble.art.sheets.clips['body-specialDirectional'];
  const ionsMeta = sheetMeta('noble', 'body-specialDirectional');
  assert.equal(ions.file, 'noble_carbon-bombardment.png');
  assert.equal(ionsMeta.release, 3);
  assert.ok(ionsMeta.anchors.fist[3][0] > ions.frameW - 20, ionsMeta.anchors.fist[3][0]);

  const table = CHARACTERS.ogden.art.sheets.clips['body-basicCharge'];
  const tableMeta = sheetMeta('ogden', 'body-basicCharge');
  assert.equal(table.file, 'ogden_end-of-the-table.png');
  assert.deepEqual(tableMeta.active, [4, 5]);
  assert.deepEqual(tableMeta.loop, [0, 3]);

  const jab = CHARACTERS.ogden.art.sheets.clips['body-basicDirectional'];
  const jabMeta = sheetMeta('ogden', 'body-basicDirectional');
  assert.equal(jab.file, 'ogden_light-speed-jab.png');
  assert.deepEqual(jabMeta.active, [2, 5]);
  assert.ok(jabMeta.anchors.fist[5][0] > jab.frameW - 16, jabMeta.anchors.fist[5][0]);
  const jabFx = JSON.parse(readFileSync('assets/fx/ogden/light-speed-jab/fx.json', 'utf8'));
  assert.equal(jabFx.oneshot, true);
  assert.equal(jabFx.anchor, 'fist');
  assert.equal(jabFx.pivotX, 0.02);
  assert.deepEqual(jabFx.swing, [0, 3]);

  const broken = sheetMeta('ogden', 'body-specialDefense');
  assert.equal(CHARACTERS.ogden.art.sheets.clips['body-specialDefense'].file, 'ogden_broken-noble.png');
  assert.deepEqual(broken.loop, [5, 6]);

  const beam = CHARACTERS.ogden.art.sheets.clips['body-specialDirectional'];
  const beamMeta = sheetMeta('ogden', 'body-specialDirectional');
  assert.equal(beam.file, 'ogden_millisecond-beam.png');
  assert.equal(beamMeta.release, 3);
  assert.ok(beamMeta.anchors.fist[3][0] > beam.frameW - 30, beamMeta.anchors.fist[3][0]);

  const arc = JSON.parse(readFileSync('assets/fx/noble/medal-swing/fx.json', 'utf8'));
  assert.equal(arc.oneshot, true);
  assert.equal(arc.fist.file, 'prize-medal.png');
  assert.ok(Math.abs(arc.fist.pivotY - 6 / 176) < 1e-9);
  assert.equal(arc.pivotX, 0.16);
  assert.deepEqual(arc.swing, [2, 4]);
  assert.equal(swingFrameIndex(0, arc.swing, 8), 2);
  assert.equal(swingFrameIndex(0.5, arc.swing, 8), 3);
  assert.equal(swingFrameIndex(1, arc.swing, 8), 4);
  // The body hand barely travels. The cell extends forward from the fist.
  assert.ok(132 * arc.heightFrac * (1 - arc.pivotX) >= 280, arc.heightFrac);
});

test('Oz and Pablo keep their hands, the puff carries the cloud, and the guns leave the fist', () => {
  const slam = CHARACTERS.oz.art.sheets.clips['body-basicCharge'];
  const slamMeta = sheetMeta('oz', 'body-basicCharge');
  assert.equal(slam.file, 'oz_densest-slam.png');
  assert.deepEqual(slamMeta.active, [5, 6]);
  assert.deepEqual(slamMeta.loop, [0, 4]);
  const nib = CHARACTERS.oz.art.sheets.clips['body-basicDirectional'];
  const nibMeta = sheetMeta('oz', 'body-basicDirectional');
  assert.equal(nib.file, 'oz_nib-stab.png');
  assert.deepEqual(nibMeta.active, [3, 5]);
  assert.ok(nibMeta.anchors.fist[5][0] > nib.frameW - 16, nibMeta.anchors.fist[5][0]);
  const nibPng = PNG.sync.read(readFileSync(`${CHARACTERS.oz.art.sheets.dir}${nib.file}`));
  assert.ok(nibPng.width <= 8192 && nibPng.height <= 8192);
  assert.equal(nibPng.width % nib.frameW, 0);
  const rooted = sheetMeta('oz', 'body-specialDefense');
  assert.equal(CHARACTERS.oz.art.sheets.clips['body-specialDefense'].file, 'oz_immovable-object.png');
  assert.deepEqual(rooted.loop, [2, 5]);
  const puff = CHARACTERS.oz.art.sheets.clips['body-specialDirectional'];
  const puffMeta = sheetMeta('oz', 'body-specialDirectional');
  assert.equal(puff.file, 'oz_tetroxide-puff.png');
  assert.equal(puffMeta.release, 4);
  assert.deepEqual(puffMeta.active, [4, 5]);
  assert.ok(puffMeta.anchors.fist[4][0] > puff.frameW - 16, puffMeta.anchors.fist[4][0]);
  const vapour = JSON.parse(readFileSync('assets/fx/oz/tetroxide-puff/fx.json', 'utf8'));
  assert.equal(vapour.anchor, 'body');
  assert.equal(vapour.loop, true);
  assert.equal(vapour.scaleIn, 300);
  assert.ok(vapour.heightFrac >= 2, vapour.heightFrac);

  const gun = CHARACTERS.pablo.art.sheets.clips['body-basicCharge'];
  const gunMeta = sheetMeta('pablo', 'body-basicCharge');
  assert.equal(gun.file, 'pablo_machine-gun.png');
  assert.deepEqual(gunMeta.active, [2, 6]);
  assert.ok(gunMeta.anchors.fist[2][0] > gun.frameW - 30, gunMeta.anchors.fist[2][0]);
  const pipe = CHARACTERS.pablo.art.sheets.clips['body-basicDirectional'];
  const pipeMeta = sheetMeta('pablo', 'body-basicDirectional');
  assert.equal(pipe.file, 'pablo_lead-pipe.png');
  assert.deepEqual(pipeMeta.active, [4, 5]);
  const pipeFx = JSON.parse(readFileSync('assets/fx/pablo/lead-pipe/fx.json', 'utf8'));
  assert.equal(pipeFx.anchor, 'fist');
  assert.equal(pipeFx.fist.file, 'lead-pipe.png');
  const apron = sheetMeta('pablo', 'body-specialDefense');
  assert.equal(CHARACTERS.pablo.art.sheets.clips['body-specialDefense'].file, 'pablo_lead-apron.png');
  assert.deepEqual(apron.loop, [2, 6]);
  const shot = CHARACTERS.pablo.art.sheets.clips['body-specialDirectional'];
  const shotMeta = sheetMeta('pablo', 'body-specialDirectional');
  assert.equal(shot.file, 'pablo_shotgun.png');
  assert.deepEqual(shotMeta.active, [3, 5]);
  assert.ok(shotMeta.anchors.fist[3][0] > shot.frameW - 16, shotMeta.anchors.fist[3][0]);
  assert.equal(CHARACTERS.pablo.moves.specialDirectional.recoilSelf, 200);
  assert.equal(CHARACTERS.pablo.moves.specialDirectional.recoilMs, 120);
});

test('Pat and Pit keep their hands', () => {
  const daughter = CHARACTERS.pat.art.sheets.clips['body-basicCharge'];
  const daughterMeta = sheetMeta('pat', 'body-basicCharge');
  assert.equal(daughter.file, 'pat_proto-daughter.png');
  assert.deepEqual(daughterMeta.active, [4, 5]);
  assert.deepEqual(daughterMeta.loop, [0, 3]);
  assert.equal(daughterMeta.release, 4);
  assert.ok(daughterMeta.anchors.fist[5][0] > daughter.frameW - 16, daughterMeta.anchors.fist[5][0]);
  const sediment = CHARACTERS.pat.art.sheets.clips['body-basicDirectional'];
  const sedimentMeta = sheetMeta('pat', 'body-basicDirectional');
  assert.equal(sediment.file, 'pat_sediment-layer.png');
  assert.deepEqual(sedimentMeta.active, [3, 5]);
  assert.ok(sedimentMeta.anchors.fist[3][0] > sediment.frameW - 20, sedimentMeta.anchors.fist[3][0]);
  const sedimentFx = JSON.parse(readFileSync('assets/fx/pat/sediment-layer/fx.json', 'utf8'));
  assert.equal(sedimentFx.anchor, 'fist');
  assert.equal(sedimentFx.pivotX, 0.12);
  const rewind = sheetMeta('pat', 'body-specialDefense');
  assert.equal(CHARACTERS.pat.art.sheets.clips['body-specialDefense'].file, 'pat_deep-time-rewind.png');
  assert.deepEqual(rewind.loop, [2, 5]);
  const bolt = CHARACTERS.pat.art.sheets.clips['body-specialDirectional'];
  const boltMeta = sheetMeta('pat', 'body-specialDirectional');
  assert.equal(bolt.file, 'pat_twin-hazard-bolt.png');
  assert.equal(boltMeta.release, 3);
  assert.deepEqual(boltMeta.active, [3, 5]);
  assert.ok(boltMeta.anchors.fist[3][0] > bolt.frameW - 50, boltMeta.anchors.fist[3][0]);

  const lamp = CHARACTERS.pit.art.sheets.clips['body-basicCharge'];
  const lampMeta = sheetMeta('pit', 'body-basicCharge');
  assert.equal(lamp.file, 'pit_catalyst-ignition.png');
  assert.deepEqual(lampMeta.active, [4, 5]);
  assert.deepEqual(lampMeta.loop, [0, 3]);
  const lampFx = JSON.parse(readFileSync('assets/fx/pit/catalyst-ignition/fx.json', 'utf8'));
  assert.equal(lampFx.charge.anchor, 'hand');
  assert.equal(lampFx.charge.black, false);
  const scratch = CHARACTERS.pit.art.sheets.clips['body-basicDirectional'];
  const scratchMeta = sheetMeta('pit', 'body-basicDirectional');
  assert.equal(scratch.file, 'pit_record-scratch.png');
  assert.deepEqual(scratchMeta.active, [3, 5]);
  assert.ok(scratchMeta.anchors.fist[5][0] > scratch.frameW - 16, scratchMeta.anchors.fist[5][0]);
  const scratchFx = JSON.parse(readFileSync('assets/fx/pit/record-scratch/fx.json', 'utf8'));
  assert.equal(scratchFx.fist.spin, 12);
  assert.equal(scratchFx.fist.black, false);
  const clamp = sheetMeta('pit', 'body-specialDefense');
  assert.equal(CHARACTERS.pit.art.sheets.clips['body-specialDefense'].file, 'pit_cisplatin-clamp.png');
  assert.deepEqual(clamp.loop, [3, 5]);
  const clampFx = JSON.parse(readFileSync('assets/fx/pit/cisplatin-clamp/fx.json', 'utf8'));
  assert.equal(clampFx.cling.anchor, 'body');
  assert.equal(clampFx.cling.guardAt, 8);
  const flame = CHARACTERS.pit.art.sheets.clips['body-specialDirectional'];
  const flameMeta = sheetMeta('pit', 'body-specialDirectional');
  assert.equal(flame.file, 'pit_flame-test.png');
  assert.equal(flameMeta.release, 3);
  assert.ok(flameMeta.anchors.fist[3][0] > flame.frameW - 30, flameMeta.anchors.fist[3][0]);
  const flameFx = JSON.parse(readFileSync('assets/fx/pit/flame-test/fx.json', 'utf8'));
  assert.ok(Math.abs(flameFx.pivotX - 292 / 320) < 1e-9);
});

test('Pluto keeps his hands, and the pit leaves the fist', () => {
  const mass = CHARACTERS.pluto.art.sheets.clips['body-basicCharge'];
  const massMeta = sheetMeta('pluto', 'body-basicCharge');
  assert.equal(mass.file, 'pluto_critical-mass.png');
  assert.deepEqual(massMeta.active, [4, 5]);
  assert.deepEqual(massMeta.loop, [0, 3]);
  assert.equal(massMeta.release, 4);
  assert.ok(massMeta.anchors.fist[5][0] > mass.frameW - 40, massMeta.anchors.fist[5][0]);
  const palm = CHARACTERS.pluto.art.sheets.clips['body-basicDirectional'];
  const palmMeta = sheetMeta('pluto', 'body-basicDirectional');
  assert.equal(palm.file, 'pluto_decay-heat-palm.png');
  assert.deepEqual(palmMeta.active, [3, 5]);
  assert.ok(palmMeta.anchors.fist[4][0] > palm.frameW - 20, palmMeta.anchors.fist[4][0]);
  const palmFx = JSON.parse(readFileSync('assets/fx/pluto/decay-heat-palm/fx.json', 'utf8'));
  assert.equal(palmFx.anchor, 'fist');
  const demoted = sheetMeta('pluto', 'body-specialDefense');
  assert.equal(CHARACTERS.pluto.art.sheets.clips['body-specialDefense'].file, 'pluto_demoted.png');
  assert.deepEqual(demoted.loop, [2, 5]);
  const pit = CHARACTERS.pluto.art.sheets.clips['body-specialDirectional'];
  const pitMeta = sheetMeta('pluto', 'body-specialDirectional');
  assert.equal(pit.file, 'pluto_plutonium-pit.png');
  assert.equal(pitMeta.release, 3);
  assert.deepEqual(pitMeta.active, [3, 5]);
  assert.ok(pitMeta.anchors.fist[3][0] > pit.frameW - 16, pitMeta.anchors.fist[3][0]);
  const pitFx = JSON.parse(readFileSync('assets/fx/pluto/plutonium-pit/fx.json', 'utf8'));
  assert.equal(pitFx.file, 'plutonium-pit.png');
  assert.equal(pitFx.black, false);
});

test('Ray drinks from a cupped hand, and the uppercut is the rising fist', () => {
  const tonic = CHARACTERS.ray.art.sheets.clips['body-basicCharge'];
  const tonicMeta = sheetMeta('ray', 'body-basicCharge');
  assert.equal(tonic.file, 'ray_radium-tonic.png');
  assert.deepEqual(tonicMeta.loop, [0, 2]);
  assert.equal(tonicMeta.release, 3);
  for (const index of [0, 1, 2, 3, 4, 5]) {
    assert.ok(tonicMeta.anchors.fist[index][1] < 250, tonicMeta.anchors.fist[index][1]);
  }
  assert.deepEqual(tonicMeta.anchors.fist[3], [354, 157]);
  const tonicFx = JSON.parse(readFileSync('assets/fx/ray/radium-tonic/fx.json', 'utf8'));
  assert.equal(tonicFx.charge.anchor, 'hand');
  assert.equal(tonicFx.charge.black, false);
  assert.equal(tonicFx.charge.tilt, 0.85);

  const upper = CHARACTERS.ray.art.sheets.clips['body-basicDirectional'];
  const upperMeta = sheetMeta('ray', 'body-basicDirectional');
  assert.equal(upper.file, 'ray_alpha-uppercut.png');
  assert.deepEqual(upperMeta.active, [3, 5]);
  assert.deepEqual(upperMeta.anchors.fist[3], [337, 188]);
  assert.deepEqual(upperMeta.anchors.fist[4], [347, 296]);
  assert.deepEqual(upperMeta.anchors.fist[5], [401, 137]);
  assert.ok(upperMeta.anchors.fist[5][1] < upperMeta.anchors.fist[2][1] - 200);
  const upperFx = JSON.parse(readFileSync('assets/fx/ray/alpha-uppercut/fx.json', 'utf8'));
  assert.equal(upperFx.anchor, 'fist');
  assert.equal(upperFx.burst.scale, 0.4);

  const halo = sheetMeta('ray', 'body-specialDefense');
  assert.equal(CHARACTERS.ray.art.sheets.clips['body-specialDefense'].file, 'ray_decay-halo.png');
  assert.deepEqual(halo.loop, [2, 5]);
  const splash = CHARACTERS.ray.art.sheets.clips['body-specialDirectional'];
  const splashMeta = sheetMeta('ray', 'body-specialDirectional');
  assert.equal(splash.file, 'ray_luminous-splash.png');
  assert.equal(splashMeta.release, 3);
  assert.deepEqual(splashMeta.anchors.fist[3], [660, 158]);
  assert.ok(splashMeta.anchors.fist[3][0] > splash.frameW - 20);

  const glow = sheetMeta('polonius', 'body-basicCharge');
  assert.equal(CHARACTERS.polonius.art.sheets.clips['body-basicCharge'].file, 'polonius_blue-glow-burst.png');
  assert.deepEqual(glow.loop, [0, 4]);
  assert.ok(glow.anchors.fist[5][1] < 200);
  const rapier = CHARACTERS.polonius.art.sheets.clips['body-basicDirectional'];
  const rapierMeta = sheetMeta('polonius', 'body-basicDirectional');
  assert.equal(rapier.file, 'polonius_rapier-thrust.png');
  assert.deepEqual(rapierMeta.anchors.fist[4], [1368, 217]);
  assert.ok(rapierMeta.anchors.fist[4][0] > rapier.frameW - 8);
  const rapierFx = JSON.parse(readFileSync('assets/fx/polonius/rapier-thrust/fx.json', 'utf8'));
  assert.equal(rapierFx.anchor, 'fist');
  assert.equal(rapierFx.pivotX, 0);
  const arras = sheetMeta('polonius', 'body-specialDefense');
  assert.equal(CHARACTERS.polonius.art.sheets.clips['body-specialDefense'].file, 'polonius_behind-the-arras.png');
  assert.deepEqual(arras.loop, [2, 5]);
  const sweep = sheetMeta('polonius', 'body-specialDirectional');
  assert.equal(CHARACTERS.polonius.art.sheets.clips['body-specialDirectional'].file, 'polonius_static-eliminator.png');
  assert.deepEqual(sweep.anchors.fist[4], [663, 126]);
  const sweepFx = JSON.parse(readFileSync('assets/fx/polonius/static-eliminator/fx.json', 'utf8'));
  assert.equal(sweepFx.anchor, 'fist');
  assert.equal(sweepFx.heightFrac, 1.15);

  const octane = sheetMeta('rex', 'body-basicCharge');
  assert.equal(CHARACTERS.rex.art.sheets.clips['body-basicCharge'].file, 'rex_high-octane.png');
  assert.deepEqual(octane.loop, [0, 3]);
  assert.deepEqual(octane.anchors.fist[6], [584, 309]);
  const edge = CHARACTERS.rex.art.sheets.clips['body-basicDirectional'];
  const edgeMeta = sheetMeta('rex', 'body-basicDirectional');
  assert.equal(edge.file, 'rex_kings-edge.png');
  assert.deepEqual(edgeMeta.anchors.fist[4], [962, 299]);
  assert.deepEqual(edgeMeta.anchors.fist[5], [1181, 345]);
  const edgeFx = JSON.parse(readFileSync('assets/fx/rex/kings-edge/fx.json', 'utf8'));
  assert.equal(edgeFx.oneshot, true);
  assert.deepEqual(edgeFx.swing, [0, 11]);
  const creep = sheetMeta('rex', 'body-specialDefense');
  assert.equal(CHARACTERS.rex.art.sheets.clips['body-specialDefense'].file, 'rex_creep-resistance.png');
  assert.deepEqual(creep.loop, [3, 5]);
  const lash = CHARACTERS.rex.art.sheets.clips['body-specialDirectional'];
  const lashMeta = sheetMeta('rex', 'body-specialDirectional');
  assert.equal(lash.file, 'rex_thermocouple-lash.png');
  assert.deepEqual(lashMeta.anchors.fist[3], [695, 164]);
  assert.ok(lashMeta.anchors.fist[3][0] > lash.frameW - 8);
  const lashFx = JSON.parse(readFileSync('assets/fx/rex/thermocouple-lash/fx.json', 'utf8'));
  assert.equal(lashFx.oneshot, true);
  assert.deepEqual(lashFx.swing, [0, 13]);
  assert.ok(Math.abs(lashFx.pivotX - 40 / 768) < 1e-6);
});

test('Roger points from the sheet hand, and the hook arc covers the short punch', () => {
  const vision = CHARACTERS.roger.art.sheets.clips['body-basicCharge'];
  const visionMeta = sheetMeta('roger', 'body-basicCharge');
  assert.equal(vision.file, 'roger_x-ray-vision.png');
  assert.deepEqual(visionMeta.loop, [0, 4]);
  assert.equal(visionMeta.release, 5);
  assert.deepEqual(visionMeta.anchors.fist[5], [546, 168]);
  const flash = CHARACTERS.roger.art.sheets.clips['body-basicDirectional'];
  const flashMeta = sheetMeta('roger', 'body-basicDirectional');
  assert.equal(flash.file, 'roger_skeleton-flash.png');
  assert.deepEqual(flashMeta.active, [3, 5]);
  assert.ok(flashMeta.anchors.fist[3][0] > flash.frameW - 12, flashMeta.anchors.fist[3][0]);
  const tube = sheetMeta('roger', 'body-specialDefense');
  assert.equal(CHARACTERS.roger.art.sheets.clips['body-specialDefense'].file, 'roger_crookes-tube.png');
  assert.deepEqual(tube.loop, [2, 6]);
  assert.deepEqual(tube.anchors.fist[2], [490, 221]);
  const beam = CHARACTERS.roger.art.sheets.clips['body-specialDirectional'];
  const beamMeta = sheetMeta('roger', 'body-specialDirectional');
  assert.equal(beam.file, 'roger_penetrating-ray.png');
  assert.equal(beamMeta.release, 3);
  assert.deepEqual(beamMeta.anchors.fist[3], [667, 158]);
  assert.deepEqual(beamMeta.anchors.fist[5], [445, 137]);

  const seep = sheetMeta('ronan', 'body-basicCharge');
  assert.equal(CHARACTERS.ronan.art.sheets.clips['body-basicCharge'].file, 'ronan_ground-seep.png');
  assert.deepEqual(seep.loop, [0, 4]);
  assert.ok(seep.anchors.fist[6][1] < 220);
  const hook = CHARACTERS.ronan.art.sheets.clips['body-basicDirectional'];
  const hookMeta = sheetMeta('ronan', 'body-basicDirectional');
  assert.equal(hook.file, 'ronan_half-life-hook.png');
  assert.deepEqual(hookMeta.active, [3, 5]);
  assert.deepEqual(hookMeta.anchors.fist[3], [500, 346]);
  assert.ok(hookMeta.anchors.fist[3][0] > hook.frameW - 8);
  const hookFx = JSON.parse(readFileSync('assets/fx/ronan/half-life-hook/fx.json', 'utf8'));
  assert.equal(hookFx.anchor, 'fist');
  assert.equal(hookFx.heightFrac, 2.2);
  assert.equal(hookFx.pivotX, 0.18);
  assert.deepEqual(hookFx.swing, [0, 7]);
  assert.equal(swingFrameIndex(0, hookFx.swing, 8), 0);
  assert.equal(swingFrameIndex(1, hookFx.swing, 8), 7);
  const spa = sheetMeta('ronan', 'body-specialDefense');
  assert.equal(CHARACTERS.ronan.art.sheets.clips['body-specialDefense'].file, 'ronan_radon-spa.png');
  assert.deepEqual(spa.loop, [2, 5]);
  assert.ok(spa.anchors.fist[2][1] < 500);
  const creep = CHARACTERS.ronan.art.sheets.clips['body-specialDirectional'];
  const creepMeta = sheetMeta('ronan', 'body-specialDirectional');
  assert.equal(creep.file, 'ronan_radon-creep.png');
  assert.equal(creepMeta.release, 3);
  assert.deepEqual(creepMeta.anchors.fist[5], [619, 445]);
  assert.ok(creepMeta.anchors.fist[5][1] < 500);
});

test('Thor hammers overhead, and Thule aims with an empty hand', () => {
  const hammerStrike = CHARACTERS.thor.art.sheets.clips['body-basicDirectional'];
  const hammerStrikeMeta = sheetMeta('thor', 'body-basicDirectional');
  assert.equal(hammerStrike.file, 'thor_fuel-rod-jab.png');
  assert.equal(moveBodySlug('thor', CHARACTERS.thor.moves.basicDirectional), 'fuel-rod-jab');
  assert.equal(hammerStrike.frameW, 741);
  assert.equal(hammerStrike.frameH, 729);
  assert.equal(Math.round(hammerStrike.footY * hammerStrike.frameH) - 1, 710);
  assert.equal(hammerStrikeMeta.release, 5);
  assert.deepEqual(hammerStrikeMeta.active, [5, 6]);
  assert.deepEqual(hammerStrikeMeta.anchors.fist[5], [702, 499]);
  assert.deepEqual(hammerStrikeMeta.anchors.fist[6], [725, 482]);
  const hammer = sheetMeta('thor', 'body-basicCharge');
  assert.equal(CHARACTERS.thor.art.sheets.clips['body-basicCharge'].file, 'thor_thunder-hammer.png');
  assert.deepEqual(hammer.loop, [0, 3]);
  assert.equal(hammer.release, 4);
  assert.deepEqual(hammer.anchors.fist[4], [602, 310]);
  const surge = sheetMeta('thor', 'body-specialDirectional');
  assert.equal(surge.release, 3);
  assert.deepEqual(surge.anchors.fist[4], [665, 154]);
  const blanket = sheetMeta('thor', 'body-specialDefense');
  assert.deepEqual(blanket.loop, [3, 5]);

  const ultima = sheetMeta('thule', 'body-basicCharge');
  assert.equal(CHARACTERS.thule.art.sheets.clips['body-basicCharge'].file, 'thule_ultima-thule.png');
  assert.deepEqual(ultima.loop, [0, 4]);
  assert.equal(ultima.release, 5);
  assert.deepEqual(ultima.anchors.fist[6], [639, 144]);
  const glow = CHARACTERS.thule.art.sheets.clips['body-basicDirectional'];
  const glowMeta = sheetMeta('thule', 'body-basicDirectional');
  assert.equal(glow.file, 'thule_blue-glow-jab.png');
  assert.equal(bodySourceSlug('thule', 'Blue Glow Jab'), 'blue-glow-jab');
  assert.deepEqual(glowMeta.active, [2, 4]);
  assert.deepEqual(glowMeta.anchors.fist[3], [599, 178]);
  const veil = sheetMeta('thule', 'body-specialDefense');
  assert.deepEqual(veil.loop, [3, 5]);
  const aim = CHARACTERS.thule.art.sheets.clips['body-specialDirectional'];
  const aimMeta = sheetMeta('thule', 'body-specialDirectional');
  assert.equal(aim.file, 'thule_handheld-x-ray.png');
  assert.equal(aimMeta.release, 3);
  assert.deepEqual(aimMeta.anchors.fist[3], [678, 172]);
  assert.ok(aimMeta.anchors.fist[3][0] > aim.frameW - 8);
  const unit = JSON.parse(readFileSync('assets/fx/thule/handheld-x-ray/fx.json', 'utf8'));
  assert.equal(unit.unit.file, 'x-ray-unit.png');
  assert.equal(unit.unit.aim, false);
});

test('Sarge, Talia, Tara, Tate, Uri, and Wolf keep their own soles and wide Wolf strips fit', () => {
  const decay = CHARACTERS.sarge.art.sheets.clips['body-specialDirectional'];
  assert.equal(decay.file, 'sarge_decay-mortar.png');
  assert.equal(Math.round(decay.footY * decay.frameH) - 1, 636);
  const poison = CHARACTERS.talia.art.sheets.clips['body-basicCharge'];
  assert.equal(poison.file, 'talia_poisoners-poison.png');
  assert.equal(bodySourceSlug('talia', "Poisoner's Poison"), 'poisoners-poison');
  const cake = CHARACTERS.uri.art.sheets.clips['body-specialDirectional'];
  assert.equal(cake.file, 'uri_yellowcake-lob.png');
  assert.equal(Math.round(cake.footY * cake.frameH) - 1, 779);
  const drill = CHARACTERS.wolf.art.sheets.clips['body-basicDirectional'];
  const piercer = CHARACTERS.wolf.art.sheets.clips['body-specialDirectional'];
  assert.equal(drill.frameW, 1225);
  assert.equal(piercer.frameW, 1046);
  for (const clip of [drill, piercer]) {
    const png = PNG.sync.read(readFileSync(`${CHARACTERS.wolf.art.sheets.dir}${clip.file}`));
    assert.ok(png.width <= 8192 && png.height <= 8192, clip.file);
    assert.ok((png.width / clip.frameW) * (png.height / clip.frameH) >= clip.count, clip.file);
  }
});

test('Cody and Collin keep their sheets, and Kobold Strike does not add a code slide', () => {
  const rod = sheetMeta('cody', 'body-specialDefense');
  assert.equal(CHARACTERS.cody.art.sheets.clips['body-specialDefense'].file, 'cody_control-rod.png');
  assert.deepEqual(rod.loop, [3, 4]);
  const strike = CHARACTERS.collin.moves.basicDirectional;
  assert.equal(strike.dashSpeed, 460);
  const meta = sheetMeta('collin', 'body-basicDirectional');
  assert.equal(CHARACTERS.collin.art.sheets.clips['body-basicDirectional'].file, 'collin_kobold-strike.png');
  assert.equal(meta.slide, 0);
  const shell = sheetMeta('collin', 'body-specialDefense');
  assert.deepEqual(shell.loop, [3, 5]);
});

test('Caesar dashes from the sheet, and Ceria Polish plays the catalytic burn', () => {
  const dash = CHARACTERS.caesar.moves.basicDirectional;
  const clip = CHARACTERS.caesar.art.sheets.clips['body-basicDirectional'];
  const meta = sheetMeta('caesar', 'body-basicDirectional');
  assert.equal(clip.file, 'caesar_rubicon-dash.png');
  assert.equal(meta.slide, dash.dashSpeed);
  const polish = CHARACTERS.ceres.moves.basicDirectional;
  assert.equal(polish.name, 'Ceria Polish');
  assert.equal(moveBodySlug('ceres', polish), 'catalytic-burn');
  assert.equal(CHARACTERS.ceres.art.sheets.clips['body-basicDirectional'].file, 'ceres_catalytic-burn.png');
});

test('Agatha, Barry, and Brock keep their soles, and the drop loops the crouch', () => {
  const tarnish = sheetMeta('agatha', 'body-specialDirectional');
  assert.equal(CHARACTERS.agatha.art.sheets.clips['body-specialDirectional'].file, 'agatha_tarnish-cloud.png');
  assert.deepEqual(tarnish.anchors.fist[3], [441, 178]);
  const drop = sheetMeta('barry', 'body-basicCharge');
  assert.equal(CHARACTERS.barry.art.sheets.clips['body-basicCharge'].file, 'barry_heavyweight-drop.png');
  assert.deepEqual(drop.loop, [0, 3]);
  assert.equal(drop.release, 5);
  const screen = sheetMeta('brock', 'body-specialDefense');
  assert.equal(CHARACTERS.brock.art.sheets.clips['body-specialDefense'].file, 'brock_red-fume-screen.png');
  assert.deepEqual(screen.loop, [3, 5]);
});

test('Ben through Fey play their own sheets, and the left-facing idles do not flip them', () => {
  const expect = {
    ben: ['emerald-lance', 'precision-strike', 'beryllium-mirror', 'gyro-disc'],
    bord: ['heavy-ram', 'crystal-smash', 'boron-carbide-wall', 'ground-shatter'],
    carter: ['diamond-storm', 'diamond-cross', 'diamond-plating', 'graphene-wave'],
    arsenio: ['inheritance-powder', 'paris-green-slash', 'sublimate', 'gray-arsenic-shards'],
    europa: ['phosphor-bloom', 'counterfeit-check', 'neutron-sponge', 'icy-geyser'],
    gertrude: ['mendeleevs-prediction', 'point-contact', 'transistor-gate', 'crystal-radio-wave'],
    goldie: ['mri-contrast', 'magnetocaloric-palm', 'magnetic-chill', 'curie-point-burst'],
    cooper: ['tesla-coil', 'live-wire', 'grounding-rod', 'bronze-sword'],
    fey: ['forge-hammer', 'cold-iron-cut', 'lodestone-guard', 'thermite'],
    titan: ['titanium-ram', 'lance-jab', 'aerospace-plating', 'aero-lance'],
  };
  for (const [id, slugs] of Object.entries(expect)) {
    for (const slug of slugs) {
      const moveKey = Object.keys(CHARACTERS[id].moves).find((key) => moveBodySlug(id, CHARACTERS[id].moves[key]) === slug);
      assert.equal(clipNameForMove(id, moveKey), `body-${moveKey}`, `${id} ${slug}`);
    }
  }
  for (const key of ['body-basicCharge', 'body-basicDirectional', 'body-specialDefense', 'body-specialDirectional']) {
    assert.equal(CHARACTERS.bord.art.sheets.clips[key].sheetFacing, 1, key);
    assert.equal(CHARACTERS.titan.art.sheets.clips[key].sheetFacing, 1, key);
    assert.equal(CHARACTERS.allen.art.sheets.clips[key].sheetFacing, -1, key);
    assert.equal(CHARACTERS.natalie.art.sheets.clips[key].sheetFacing, 1, key);
    assert.equal(CHARACTERS.nitra.art.sheets.clips[key].sheetFacing, key === 'body-basicDirectional' ? 1 : -1, key);
    assert.equal(CHARACTERS.scarlett.art.sheets.clips[key].sheetFacing, 1, key);
    assert.equal(CHARACTERS.ben.art.sheets.clips[key].sheetFacing, undefined, key);
    assert.equal(CHARACTERS.carter.art.sheets.clips[key].sheetFacing, undefined, key);
  }
  assert.equal(CHARACTERS.saab.art.sheets.clips['body-basicDirectional'].sheetFacing, -1);
  assert.equal(CHARACTERS.tex.art.sheets.clips['body-basicDirectional'].sheetFacing, -1);
  assert.equal(CHARACTERS.tex.art.sheets.clips['body-basicCharge'].sheetFacing, undefined);
  assert.equal(CHARACTERS.van.art.sheets.clips['body-specialDirectional'].sheetFacing, -1);
  assert.equal(CHARACTERS.van.art.sheets.clips['body-basicCharge'].sheetFacing, 1);
  assert.equal(CHARACTERS.saab.art.sheets.clips['body-basicCharge'].sheetFacing, undefined);
  assert.equal(CHARACTERS.titan.moves.specialDefense.chalkTint, 0xaab9cd);
  assert.equal(CHARACTERS.titan.moves.specialDefense.vfx, 'pane');
  const ram = sheetMeta('titan', 'body-basicCharge');
  assert.equal(ram.slide, CHARACTERS.titan.moves.basicCharge.dashSpeed);
  const heavy = sheetMeta('bord', 'body-basicCharge');
  assert.equal(heavy.slide, CHARACTERS.bord.moves.basicCharge.dashSpeed);
  for (const [id, file] of [
    ['ben', 'ben_emerald-lance.png'],
    ['ben', 'ben_precision-strike.png'],
    ['ben', 'ben_gyro-disc.png'],
    ['bord', 'bord_heavy-ram.png'],
    ['carter', 'carter_graphene-wave.png'],
    ['fey', 'fey_cold-iron-cut.png'],
    ['titan', 'titan_lance-jab.png'],
  ]) {
    const clip = Object.values(CHARACTERS[id].art.sheets.clips).find((row) => row.file === file);
    const png = PNG.sync.read(readFileSync(`${CHARACTERS[id].art.sheets.dir}${file}`));
    assert.ok(png.width <= 8192 && png.height <= 8192, file);
    assert.ok((png.width / clip.frameW) * (png.height / clip.frameH) >= clip.count, file);
  }
  assert.equal(moveBodySlug('carter', CHARACTERS.carter.moves.basicDirectional), 'diamond-cross');
  assert.equal(moveBodySlug('cooper', CHARACTERS.cooper.moves.basicDirectional), 'live-wire');
  assert.equal(moveBodySlug('fey', CHARACTERS.fey.moves.specialDefense), 'lodestone-guard');
});

test('charge loops the windup and a guard holds the strike frames', () => {
  const ray = sheetMeta('ace', 'body-basicCharge');
  const held = sheetFrameIndex(ray, { state: 'charging', animT: 0, fd: null });
  assert.ok(held >= ray.windup[0] && held <= ray.windup[1]);
  const guard = sheetMeta('ace', 'body-specialDefense');
  const pose = sheetFrameIndex(guard, { state: 'defending', animT: 0.2, fd: null });
  assert.ok(pose >= guard.active[0] && pose <= guard.active[1], pose);
});
