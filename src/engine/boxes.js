// Hurtboxes, strike hitboxes, and grounded pushboxes.
// Local boxes are game pixels from the feet, art facing right.
// y is the top of the box (negative is above the feet).
import { HURTBOXES } from '../data/hurtboxes.js';

const PARTS = ['head', 'torso', 'legs'];

export function poseName(fighter) {
  if (!fighter) return 'idle';
  if (fighter.state === 'attack' || fighter.state === 'charging') return 'attack';
  if (fighter.state === 'jump' || fighter.state === 'fall') return 'jump';
  const grounded = fighter.grounded ?? !!(fighter.body?.blocked?.down || fighter.body?.touching?.down);
  if (fighter.state === 'jumpsquat' || (fighter.landing > 0) || (grounded && fighter.input?.down)) return 'crouch';
  if (fighter.state === 'walk') return 'walk';
  return 'idle';
}

export function localParts(fighter) {
  const id = fighter?.charDef?.id;
  const book = HURTBOXES[id];
  const pose = poseName(fighter);
  const parts = book?.[pose] || book?.idle;
  if (parts) return parts;
  const w = fighter?.bodyW ?? fighter?.charDef?.art?.bodyW ?? 40;
  const h = fighter?.bodyH ?? fighter?.charDef?.art?.bodyH ?? 110;
  const headH = h * 0.24;
  const torsoH = h * 0.4;
  const legH = h - headH - torsoH;
  return {
    head: { x: -w * 0.31, y: -h, w: w * 0.62, h: headH },
    torso: { x: -w * 0.48, y: -h + headH, w: w * 0.96, h: torsoH },
    legs: { x: -w * 0.36, y: -legH, w: w * 0.72, h: legH },
  };
}

function worldRect(fighter, box) {
  const dir = fighter.facing || 1;
  const left = dir === 1 ? fighter.x + box.x : fighter.x - box.x - box.w;
  const top = fighter.y + box.y;
  return { x: left, y: top, width: box.w, height: box.h, left, right: left + box.w, top, bottom: top + box.h };
}

export function hurtboxes(fighter) {
  const parts = localParts(fighter);
  return PARTS.filter((name) => parts[name]).map((name) => worldRect(fighter, parts[name]));
}

export function hurtUnion(fighter) {
  const list = hurtboxes(fighter);
  if (!list.length) {
    const w = fighter.bodyW ?? 40;
    const h = fighter.bodyH ?? 110;
    return { x: fighter.x - w / 2, y: fighter.y - h, width: w, height: h };
  }
  const x0 = Math.min(...list.map((r) => r.x));
  const y0 = Math.min(...list.map((r) => r.y));
  const x1 = Math.max(...list.map((r) => r.right));
  const y1 = Math.max(...list.map((r) => r.bottom));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, left: x0, right: x1, top: y0, bottom: y1 };
}

export function pushbox(fighter) {
  const grounded = fighter.grounded ?? !!(fighter.body?.blocked?.down || fighter.body?.touching?.down);
  const time = fighter.scene?.simNow ?? fighter.scene?.time?.now ?? 0;
  const dodging = (fighter.phasingUntil > time)
    || (fighter.state === 'defending' && fighter.defenseMove?.phase);
  if (!grounded || dodging || !fighter.alive || fighter.state === 'ko' || fighter.state === 'dead') return null;
  const parts = localParts(fighter);
  const bits = [parts.torso, parts.legs].filter(Boolean);
  if (!bits.length) return null;
  const x0 = Math.min(...bits.map((b) => b.x));
  const x1 = Math.max(...bits.map((b) => b.x + b.w));
  const y0 = Math.min(...bits.map((b) => b.y));
  const y1 = Math.max(...bits.map((b) => b.y + b.h));
  const inset = (x1 - x0) * 0.1;
  return worldRect(fighter, { x: x0 + inset, y: y0, w: Math.max(8, x1 - x0 - inset * 2), h: y1 - y0 });
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// The slash grows across the active frames and ends at the move's reach,
// which is also where the swing graphic is drawn.
export function strikeRect(fighter) {
  const hit = fighter.activeHit;
  if (!hit) return null;
  const time = fighter.scene?.simNow ?? fighter.scene?.time?.now ?? 0;
  if (time < hit.from || time > hit.until) return null;
  const move = hit.move;
  if (move?.kind === 'dash') return null;
  const fd = fighter.frameData;
  const frame = fighter.attackFrame ?? 0;
  const start = fd?.startup ?? 0;
  const active = Math.max(1, fd?.active ?? 1);
  if (frame < start || frame >= start + active) return null;
  const u = clamp((frame - start) / active, 0, 1);
  const grow = Math.sin(u * Math.PI * 0.5);
  const reach = move.rangeW ?? Math.round((fighter.bodyW ?? 40) * 1.7);
  const thick = move.rangeH ?? Math.round((fighter.bodyH ?? 100) * 0.42);
  const len = Math.max(16, reach * (0.38 + 0.62 * grow));
  const dir = hit.dir || fighter.facing || 1;
  const hand = (fighter.bodyW ?? 40) * 0.22;
  const low = fighter.grounded && fighter.input?.down;
  const chest = (fighter.bodyH ?? 100) * (low ? 0.34 : 0.58);
  const y = fighter.y - chest - thick * 0.42;
  const x = dir === 1 ? fighter.x + hand : fighter.x - hand - len;
  return { x, y, width: len, height: thick, left: x, right: x + len, top: y, bottom: y + thick, dir };
}

export function hitboxes(fighter) {
  const hit = fighter.activeHit;
  if (!hit) return [];
  const time = fighter.scene?.simNow ?? fighter.scene?.time?.now ?? 0;
  if (time < hit.from || time > hit.until) return [];
  if (hit.move?.kind === 'dash') {
    return hurtboxes(fighter).map((r) => {
      const pad = (fighter.facing || 1) === 1 ? 10 : 0;
      const back = (fighter.facing || 1) === 1 ? 0 : 10;
      return {
        x: r.x - back, y: r.y, width: r.width + pad + back, height: r.height,
        left: r.x - back, right: r.right + pad, top: r.y, bottom: r.bottom,
      };
    });
  }
  const strike = strikeRect(fighter);
  return strike ? [strike] : [];
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function circleHitsRects(cx, cy, radius, rects) {
  const r2 = radius * radius;
  for (const h of rects) {
    const nx = clamp(cx, h.x, h.x + h.width);
    const ny = clamp(cy, h.y, h.y + h.height);
    const dx = cx - nx;
    const dy = cy - ny;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

// Visual size of a projectile, matching the graphic drawn in BattleScene.
export function projectileSpriteSize(move) {
  const r = move?.projectileRadius ?? 12;
  if (move?.visualShape === 'spearhead') return { w: r * 2.2, h: r * 1.4 };
  if (move?.vfx === 'balloon') return { w: r * 1.7, h: r * 2.1 };
  if (move?.vfx === 'gust') return { w: r * 2.2, h: r * 0.9 };
  return { w: r * 2.9, h: r * 2.9 };
}

export function projectileRect(p) {
  const size = p.spriteW ? { w: p.spriteW, h: p.spriteH } : projectileSpriteSize(p.move);
  const x = p.gfx.x - size.w / 2;
  const y = p.gfx.y - size.h / 2;
  return { x, y, width: size.w, height: size.h };
}

function weightOf(f) {
  return Math.max(0.35, f.charDef?.stats?.weight ?? 1);
}

function nudge(f, dx) {
  if (!dx) return;
  f.x += dx;
  const body = f.body;
  if (!body?.position) return;
  // Keep the physics body on the sprite. prevFrame moves with it so the
  // post-step sync does not apply this push a second time.
  body.position.x += dx;
  if (body.prev) body.prev.x += dx;
  if (body.prevFrame) body.prevFrame.x += dx;
  body.updateCenter?.();
}

// Soft horizontal separation. Heavier fighters give less ground.
// Airborne fighters and dodges are not in the list.
export function resolvePush(fighters) {
  const standing = [];
  for (const f of fighters) {
    const box = pushbox(f);
    if (box) standing.push({ f, box });
  }
  for (let i = 0; i < standing.length; i++) {
    for (let j = i + 1; j < standing.length; j++) {
      const A = standing[i];
      const B = standing[j];
      const overlapX = Math.min(A.box.right ?? A.box.x + A.box.width, B.box.right ?? B.box.x + B.box.width)
        - Math.max(A.box.x, B.box.x);
      const overlapY = Math.min(A.box.bottom ?? A.box.y + A.box.height, B.box.bottom ?? B.box.y + B.box.height)
        - Math.max(A.box.y, B.box.y);
      if (overlapX <= 0.5 || overlapY <= 0.5) continue;
      const wa = weightOf(A.f);
      const wb = weightOf(B.f);
      const left = A.f.x <= B.f.x ? A : B;
      const right = left === A ? B : A;
      const pushLeft = overlapX * (weightOf(right.f) / (wa + wb));
      const pushRight = overlapX - pushLeft;
      nudge(left.f, -pushLeft);
      nudge(right.f, pushRight);
      const lv = left.f.body?.velocity;
      const rv = right.f.body?.velocity;
      if (lv && lv.x > 0) lv.x *= 0.2;
      if (rv && rv.x < 0) rv.x *= 0.2;
    }
  }
}
