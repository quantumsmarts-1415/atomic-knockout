import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVE_SHEETS } from '../src/data/moveSheets.js';
import { artIsUpdated } from '../src/data/updatedArt.js';
import { bodySourceSlug, hasBodyClips } from '../src/data/bodyClips.js';
import { followThroughBlend, guardIdleBlend } from '../src/engine/feel.js';
import { bodySheetMuzzle, clipNameForMove, frameToWorld, sheetFrameIndex, sheetMeta } from '../src/engine/moveSheet.js';
import { cascadePulseArt, shoulderSlashOrigin, shoulderWhipIndex } from '../src/engine/fxArt.js';

const FIGHTERS = ['ace', 'amy', 'aurelius', 'bianca', 'boar', 'burke', 'cali', 'copernicus', 'curie', 'dash', 'dizzy', 'duke', 'einstein', 'fermi', 'flo', 'ford', 'frank', 'haley', 'hog', 'holly', 'hoss', 'ira', 'lars', 'mac', 'mae', 'mendel', 'neptune'];

function inCell(json, xy) {
  return Array.isArray(xy) && xy[0] >= 0 && xy[0] < json.frameW && xy[1] >= 0 && xy[1] < json.frameH;
}

/** The compiler keeps an in-cell hand. A tip past the cell uses the reach. */
function placedHand(json, index) {
  const strike = json.strike_hand_xy?.[String(index)];
  const front = json.frames?.[index]?.front_hand_xy;
  const reach = json.strike_reach_xy?.[String(index)];
  const xy = inCell(json, strike) ? strike : inCell(json, reach) ? reach : (strike || front);
  return [Math.round(xy[0]), Math.round(xy[1])];
}

function worldH(art, def) {
  const body = def.bodyH ?? def.visibleH;
  const scale = def.displayScale ?? (art.height / body);
  return scale * body;
}

test('per-move body clips keep the idle height and the json foot line', () => {
  for (const id of FIGHTERS) {
    const art = CHARACTERS[id].art;
    const idle = art.sheets.clips.idle;
    const attack = art.sheets.clips.attack;
    assert.equal(attack.file, undefined, `${id} generic attack.png stays the fallback`);
    assert.equal(sheetMeta(id, 'attack'), null, id);
    assert.equal(artIsUpdated(CHARACTERS[id], new Set()), true, id);
    const dir = `art-src/imported/body/${id}`;
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
      const json = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
      const moveKey = Object.keys(CHARACTERS[id].moves).find((key) => {
        return bodySourceSlug(id, CHARACTERS[id].moves[key]?.name) === json.move;
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
      const foot = Math.round(clip.footY * clip.frameH) - 1;
      assert.equal(foot, json.foot_row, `${json.move} foot`);
      assert.ok(Math.abs(worldH(art, clip) - worldH(art, idle)) < 1, `${json.move} height`);
      const sole = frameToWorld(
        [clip.frameW / 2, json.foot_row], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 100, 200,
      );
      assert.ok(Math.abs(sole.y - 200) < 1, `${json.move} sole ${sole.y}`);
      for (const index of json.strike_frames) {
        const want = placedHand(json, index);
        assert.deepEqual(meta.anchors.fist[index], want, `${json.move} f${index}`);
        assert.deepEqual(meta.anchors.tip[index], want, `${json.move} tip f${index}`);
      }
      assert.equal(meta.release, json.strike_frames[0], json.move);
      const fd = { startup: 4, active: 3, recovery: 4, visible: 11 };
      const shown = sheetFrameIndex(meta, { state: 'attack', fd, attackFrame: fd.startup });
      assert.equal(shown, json.strike_frames[0], `${json.move} opens on the strike`);
      const hand = frameToWorld(
        meta.anchors.fist[shown], clip.frameW, clip.frameH, clip.footY, clip.displayScale, 1, 1, 0, 0,
      );
      assert.ok(hand.x > 0, `${json.move} hand is in front`);
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
  const id = Object.keys(CHARACTERS).find((key) => !hasBodyClips(key) && !MOVE_SHEETS[key] && CHARACTERS[key].art?.sheets?.clips?.attack);
  assert.ok(id);
  assert.equal(clipNameForMove(id, 'basicDirectional'), null);
  assert.equal(clipNameForMove(id, 'basicCharge'), null);
  assert.ok(CHARACTERS[id].art.sheets.clips.attack.count > 0);
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
});

test('charge loops the windup and a guard holds the strike frames', () => {
  const ray = sheetMeta('ace', 'body-basicCharge');
  const held = sheetFrameIndex(ray, { state: 'charging', animT: 0, fd: null });
  assert.ok(held >= ray.windup[0] && held <= ray.windup[1]);
  const guard = sheetMeta('ace', 'body-specialDefense');
  const pose = sheetFrameIndex(guard, { state: 'defending', animT: 0.2, fd: null });
  assert.ok(pose >= guard.active[0] && pose <= guard.active[1], pose);
});
