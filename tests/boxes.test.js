import test from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER } from '../src/data/characters.js';
import { HURTBOXES } from '../src/data/hurtboxes.js';
import {
  hurtboxes, poseName, strikeRect, hitboxes, resolvePush, projectileSpriteSize, rectsOverlap,
} from '../src/engine/boxes.js';

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

test('every fighter has head, torso, and leg boxes that sit on the feet', () => {
  for (const c of ROSTER) {
    const book = HURTBOXES[c.id];
    assert.ok(book?.idle?.head && book.idle.torso && book.idle.legs, c.id);
    assert.ok(book.walk && book.crouch && book.jump && book.attack, c.id);
    const parts = Object.values(book.idle);
    const foot = Math.max(...parts.map((b) => b.y + b.h));
    const top = Math.min(...parts.map((b) => b.y));
    assert.ok(foot < 8 && foot > -12, `${c.id} feet at ${foot}`);
    const h = foot - top;
    assert.ok(h > c.art.bodyH * 0.5 && h < c.art.bodyH * 1.85, `${c.id} height ${h}`);
    assert.ok(book.crouch.head.h < book.idle.head.h, `${c.id} crouch`);
  }
});

test('crouch and jump change the live hurtboxes', () => {
  const stand = hurtboxes(fighter('hydra'));
  const crouch = hurtboxes(fighter('hydra', { state: 'jumpsquat' }));
  const air = hurtboxes(fighter('hydra', { state: 'jump', grounded: false }));
  const standH = Math.max(...stand.map((r) => r.y + r.height)) - Math.min(...stand.map((r) => r.y));
  const crouchH = Math.max(...crouch.map((r) => r.y + r.height)) - Math.min(...crouch.map((r) => r.y));
  const airW = Math.max(...air.map((r) => r.x + r.width)) - Math.min(...air.map((r) => r.x));
  const standW = Math.max(...stand.map((r) => r.x + r.width)) - Math.min(...stand.map((r) => r.x));
  assert.ok(crouchH < standH * 0.8);
  assert.ok(airW < standW);
  assert.equal(poseName(fighter('hydra', { state: 'walk' })), 'walk');
  assert.equal(poseName(fighter('hydra', { state: 'attack' })), 'attack');
});

test('a strike grows across the active frames and stays in front', () => {
  const f = fighter('titan');
  f.frameData = { startup: 4, active: 6 };
  f.activeHit = { move: { rangeW: 80, rangeH: 36, kind: 'melee' }, dir: 1, from: 0, until: 5000 };
  f.attackFrame = 4;
  const early = strikeRect(f);
  f.attackFrame = 9;
  const late = strikeRect(f);
  assert.ok(early && late);
  assert.ok(late.width > early.width);
  assert.ok(early.x > f.x);
  f.attackFrame = 2;
  assert.equal(strikeRect(f), null);
  f.attackFrame = 6;
  f.activeHit.move.kind = 'dash';
  const dash = hitboxes(f);
  assert.equal(dash.length, 3);
});

test('grounded fighters push apart and airborne fighters do not', () => {
  const a = fighter('sully', { x: 200, weight: 1.4 });
  const b = fighter('hydra', { x: 230 });
  a.charDef = { ...a.charDef, stats: { ...a.charDef.stats, weight: 1.4 } };
  const ax = a.x;
  const bx = b.x;
  resolvePush([a, b]);
  assert.ok(a.x < ax, 'heavy still yields some ground');
  assert.ok(b.x > bx, 'light gets pushed more');
  assert.ok(b.x - a.x > bx - ax);
  const gap = b.x - a.x;
  const air = fighter('hydra', { x: a.x + 20, grounded: false, state: 'fall' });
  const before = air.x;
  resolvePush([a, air]);
  assert.equal(air.x, before);
  const dodge = fighter('boar', { x: a.x + 20, state: 'defending', defenseMove: { phase: true } });
  const dodgeX = dodge.x;
  resolvePush([a, dodge]);
  assert.equal(dodge.x, dodgeX);
});

test('projectile boxes match the drawn sprite', () => {
  const orb = projectileSpriteSize({ projectileRadius: 10 });
  const spear = projectileSpriteSize({ projectileRadius: 10, visualShape: 'spearhead' });
  const balloon = projectileSpriteSize({ projectileRadius: 10, vfx: 'balloon' });
  assert.ok(orb.w > spear.w);
  assert.ok(balloon.h > balloon.w);
  assert.ok(rectsOverlap(
    { x: 0, y: 0, width: orb.w, height: orb.h },
    { x: orb.w - 1, y: 0, width: 4, height: 4 },
  ));
});
