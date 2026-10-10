import test from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER } from '../src/data/characters.js';
import {
  poseName, arcReach, strikeHits, resolvePush, projectileSpriteSize, projectileHits, rectsOverlap,
  fittedSize, maskBook, debugHitCells, debugDashCells, slashRibbon, hitAabb, maskShown, debugCells,
} from '../src/engine/boxes.js';

const POSE = { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };

function fighter(id, extra = {}) {
  const char = ROSTER.find((c) => c.id === id);
  const x = extra.x ?? 200;
  return {
    x,
    y: extra.y ?? 400,
    facing: extra.facing ?? 1,
    alive: extra.alive !== false,
    state: extra.state ?? 'idle',
    grounded: extra.grounded !== false,
    landing: extra.landing ?? 0,
    input: extra.input ?? {},
    charDef: char,
    bodyW: char.art.bodyW,
    bodyH: char.art.bodyH,
    phasingUntil: extra.phasingUntil ?? 0,
    defenseMove: extra.defenseMove ?? null,
    scene: { simNow: extra.now ?? 1000 },
    rig: extra.rig === undefined ? { maskClip: 'idle', maskFrame: 0, _pose: POSE } : extra.rig,
    body: {
      blocked: { down: extra.grounded !== false },
      touching: { down: false },
      velocity: { x: extra.vx ?? 0, y: 0 },
      position: { x },
      prev: { x },
      prevFrame: { x },
      updateCenter() {},
    },
    ...extra.more,
  };
}

test('every fighter has a body mask that stands on the feet', () => {
  for (const c of ROSTER) {
    const book = maskBook(c.id);
    const idle = book?.clips?.idle?.[0];
    assert.ok(idle?.n > 8, c.id);
    assert.ok(idle.maxY < 12 && idle.maxY > -24, `${c.id} feet at ${idle.maxY}`);
    const h = idle.maxY - idle.minY;
    const bodyH = c.art.bodyH || 100;
    assert.ok(h > bodyH * 0.35 && h < bodyH * 2.4, `${c.id} height ${h} vs ${bodyH}`);
    assert.ok(book.push && book.push.w >= 10 && book.push.h > 16, c.id);
  }
});

test('crouch squashes the mask and jump narrows it', () => {
  const stand = fighter('hydra');
  const crouch = fighter('hydra', { state: 'jumpsquat', rig: null });
  const air = fighter('hydra', { state: 'jump', grounded: false, rig: null });
  assert.ok(fittedSize(crouch).h < fittedSize(stand).h * 0.92);
  assert.ok(fittedSize(air).w < fittedSize(stand).w);
  assert.equal(poseName(fighter('hydra', { state: 'walk' })), 'walk');
  assert.equal(poseName(fighter('hydra', { state: 'attack' })), 'attack');
});

test('a swept arc grows across the active frames and pixel strikes hit', () => {
  const f = fighter('titan');
  f.frameData = { startup: 4, active: 6, recovery: 4 };
  f.activeHit = { move: { rangeW: 80, rangeH: 36, kind: 'melee' }, dir: 1, from: 0, until: 5000 };
  f.attackFrame = 4;
  const early = arcReach(f);
  f.attackFrame = 9;
  const late = arcReach(f);
  assert.ok(early > 0 && late > early);
  f.attackFrame = 2;
  assert.equal(arcReach(f), 0);

  const hog = fighter('hog');
  hog.frameData = { startup: 2, active: 8, recovery: 4 };
  hog.activeHit = { move: { rangeW: 70, rangeH: 36, kind: 'melee' }, dir: 1, from: 0, until: 9000 };
  hog.attackFrame = 4;
  hog.rig = { maskClip: 'attack', maskFrame: 0, _pose: POSE };
  let cells = [];
  const n = maskBook('hog').clips.attack.length;
  for (let i = 0; i < n; i++) {
    hog.rig.maskFrame = i;
    cells = debugHitCells(hog);
    if (cells.length >= 3) break;
  }
  assert.ok(cells.length >= 3, 'hog has a pixel strike');
  const spot = cells[Math.floor(cells.length / 2)];
  const victim = fighter('hydra', { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 + 30 });
  assert.equal(strikeHits(hog, victim), true);
  const far = fighter('hydra', { x: hog.x - 400, y: hog.y });
  assert.equal(strikeHits(hog, far), false);

  hog.activeHit.move.kind = 'dash';
  const near = fighter('hydra', { x: hog.x + 12, y: hog.y });
  assert.equal(strikeHits(hog, near), true);
  assert.equal(strikeHits(hog, far), false);
});

test('grounded fighters push apart and airborne fighters do not', () => {
  const a = fighter('sully', { x: 200 });
  const b = fighter('hydra', { x: 230 });
  a.charDef = { ...a.charDef, stats: { ...a.charDef.stats, weight: 1.4 } };
  const ax = a.x;
  const bx = b.x;
  resolvePush([a, b]);
  assert.ok(a.x < ax, 'heavy still yields some ground');
  assert.ok(b.x > bx, 'light gets pushed more');
  assert.ok(b.x - a.x > bx - ax);
  const air = fighter('hydra', { x: a.x + 20, grounded: false, state: 'fall' });
  const before = air.x;
  resolvePush([a, air]);
  assert.equal(air.x, before);
  const dodge = fighter('boar', { x: a.x + 20, state: 'defending', defenseMove: { phase: true } });
  const dodgeX = dodge.x;
  resolvePush([a, dodge]);
  assert.equal(dodge.x, dodgeX);
});

test('projectile shapes match the drawn sprite and hit a body', () => {
  const orb = projectileSpriteSize({ projectileRadius: 10 });
  const spear = projectileSpriteSize({ projectileRadius: 10, visualShape: 'spearhead' });
  const balloon = projectileSpriteSize({ projectileRadius: 10, vfx: 'balloon' });
  assert.ok(orb.w > spear.w);
  assert.ok(balloon.h > balloon.w);
  assert.ok(rectsOverlap(
    { x: 0, y: 0, width: orb.w, height: orb.h },
    { x: orb.w - 1, y: 0, width: 4, height: 4 },
  ));
  const hog = fighter('hog', { x: 300, y: 400 });
  const shot = {
    gfx: { x: hog.x, y: hog.y - 50 },
    move: { projectileRadius: 14, vfx: 'gust' },
    radius: 14,
    owner: { facing: 1 },
  };
  assert.equal(projectileHits(shot, hog), true);
  shot.gfx = { x: hog.x + 400, y: hog.y };
  assert.equal(projectileHits(shot, hog), false);
});

test('an armed attack draws the volume that lands the hit', () => {
  const boar = fighter('boar', { state: 'attack' });
  boar.frameData = { startup: 1, active: 8, recovery: 4 };
  boar.attackFrame = 3;
  boar.activeHit = { move: { kind: 'dash', rangeW: 96 }, dir: 1, from: 0, until: 5000 };
  assert.ok(debugDashCells(boar).length > 10, 'dash body is the red hit');
  const neighbor = fighter('hydra', { x: boar.x + 12, y: boar.y });
  assert.equal(strikeHits(boar, neighbor), true);
  boar.activeHit = null;
  assert.equal(debugDashCells(boar).length, 0);

  const hog = fighter('hog', { state: 'attack' });
  hog.frameData = { startup: 2, active: 8, recovery: 4 };
  hog.attackFrame = 4;
  hog.activeHit = { move: { kind: 'melee', rangeW: 124, rangeH: 28 }, dir: 1, from: 0, until: 9000 };
  hog.rig.maskClip = 'attack';
  hog.rig.maskFrame = 2;
  assert.ok(debugHitCells(hog).length >= 3, 'blade cells are on the active frame');
  assert.equal(slashRibbon(hog), null);

  const van = fighter('van', { state: 'attack' });
  van.frameData = { startup: 2, active: 8, recovery: 4 };
  van.attackFrame = 4;
  van.activeHit = { move: { rangeW: 72, rangeH: 48 }, dir: 1, from: 0, until: 9000 };
  const ribbon = slashRibbon(van, 8);
  assert.ok(ribbon?.outer?.length >= 8 && ribbon.inner.length >= 8);
  const hb = hitAabb(van);
  const fist = fighter('hydra', { x: (hb.left + hb.right) / 2, y: (hb.top + hb.bottom) / 2 + 20 });
  assert.equal(strikeHits(van, fist), true);
});

test('the overlay skips hidden and KO fighters', () => {
  const hog = fighter('hog');
  assert.equal(maskShown(hog), true);
  assert.ok(debugCells(hog).length > 10);
  hog.visible = false;
  assert.equal(maskShown(hog), false);
  assert.equal(debugCells(hog).length, 0);
  hog.visible = true;
  hog.state = 'ko';
  assert.equal(maskShown(hog), false);
  hog.state = 'idle';
  hog.rig.x = 40;
  const moved = debugCells(hog);
  const home = fighter('hog');
  const still = debugCells(home);
  assert.ok(Math.abs(moved[0].x - still[0].x - 40) < 0.01);
});
