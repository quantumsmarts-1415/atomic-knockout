// Hurt masks, strike masks, and a narrow grounded pushbox.
// Masks are game pixels from the feet, art facing right, then posed and mirrored.
import {
  currentMask, hurtAabb, hitAabb, localPush, posedRect, debugCells, debugHitCells,
  debugDashCells, strikeHits, hurtHitsCircle, hurtHitsRect, projectileHits, projectileShape,
  slashPolyline, slashRibbon, parametricArc, fittedSize, maskLocalCenter, maskBook, maskShown,
  fxPlacementHits,
} from './masks.js';

export {
  strikeHits, hurtHitsCircle, hurtHitsRect, projectileHits, projectileShape,
  slashPolyline, slashRibbon, debugCells, debugHitCells, debugDashCells,
  fittedSize, maskLocalCenter, maskBook, hitAabb, maskShown, fxPlacementHits,
};

export function poseName(fighter) {
  if (!fighter) return 'idle';
  if (fighter.state === 'attack' || fighter.state === 'charging') return 'attack';
  if (fighter.state === 'jump' || fighter.state === 'fall') return 'jump';
  const grounded = fighter.grounded ?? !!(fighter.body?.blocked?.down || fighter.body?.touching?.down);
  if (fighter.state === 'jumpsquat' || (fighter.landing > 0) || (grounded && fighter.input?.down)) return 'crouch';
  if (fighter.state === 'walk') return 'walk';
  return 'idle';
}

export function hurtboxes(fighter) {
  return debugCells(fighter).map((r) => ({
    x: r.x, y: r.y, width: r.w, height: r.h, left: r.x, right: r.x + r.w, top: r.y, bottom: r.y + r.h,
  }));
}

export function hurtUnion(fighter) {
  return hurtAabb(fighter) || {
    x: fighter.x - 20, y: fighter.y - 100, width: 40, height: 100,
    left: fighter.x - 20, right: fighter.x + 20, top: fighter.y - 100, bottom: fighter.y,
  };
}

export function pushbox(fighter) {
  const grounded = fighter.grounded ?? !!(fighter.body?.blocked?.down || fighter.body?.touching?.down);
  const time = fighter.scene?.simNow ?? fighter.scene?.time?.now ?? 0;
  const dodging = (fighter.phasingUntil > time)
    || (fighter.state === 'defending' && fighter.defenseMove?.phase);
  if (!grounded || dodging || !fighter.alive || fighter.state === 'ko' || fighter.state === 'dead') return null;
  return posedRect(fighter, localPush(fighter));
}

export function hitboxes(fighter) {
  const cells = debugHitCells(fighter);
  if (cells.length) {
    return cells.map((r) => ({
      x: r.x, y: r.y, width: r.w, height: r.h, left: r.x, right: r.x + r.w, top: r.y, bottom: r.y + r.h,
    }));
  }
  const arc = parametricArc(fighter);
  if (!arc) return [];
  const hb = hitAabb(fighter);
  return hb ? [hb] : [];
}

export function strikeRect(fighter) {
  const hb = hitAabb(fighter);
  if (!hb || fighter.activeHit?.move?.kind === 'dash') return null;
  return hb;
}

export function arcReach(fighter) {
  const arc = parametricArc(fighter);
  return arc ? arc.r1 : 0;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function circleHitsRects(cx, cy, radius, rects) {
  const r2 = radius * radius;
  for (const h of rects) {
    const nx = Math.max(h.x, Math.min(cx, h.x + h.width));
    const ny = Math.max(h.y, Math.min(cy, h.y + h.height));
    const dx = cx - nx;
    const dy = cy - ny;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

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
  body.position.x += dx;
  if (body.prev) body.prev.x += dx;
  if (body.prevFrame) body.prevFrame.x += dx;
  body.updateCenter?.();
}

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

export function maskReady(fighter) {
  return !!currentMask(fighter)?.n;
}
