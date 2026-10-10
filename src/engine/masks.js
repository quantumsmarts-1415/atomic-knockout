// Per-frame collision masks. Cells are precomputed in the importer.
// Overlap tests AABB-reject, then sample the smaller mask.
import { CELL, MASK_RAW } from '../data/masks.js';
import { attackPhase, poseTarget, stripIndex } from './feel.js';

export { CELL };

const IDENT = { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };
const PT = { x: 0, y: 0 };
const PT2 = { x: 0, y: 0 };
const BB1 = { x0: 0, y0: 0, x1: 0, y1: 0 };
const BB2 = { x0: 0, y0: 0, x1: 0, y1: 0 };

function bytesOf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decode(spec) {
  if (!spec) return null;
  const parts = spec.split('|');
  const ox = +parts[0];
  const oy = +parts[1];
  const cols = +parts[2] | 0;
  const rows = +parts[3] | 0;
  const bits = bytesOf(parts[4]);
  const total = cols * rows;
  const col = new Uint8Array(total);
  const row = new Uint8Array(total);
  let n = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < total; i++) {
    if ((bits[i >> 3] & (1 << (i & 7))) === 0) continue;
    const c = i % cols;
    const r = (i / cols) | 0;
    col[n] = c;
    row[n] = r;
    const x0 = ox + c * CELL;
    const y0 = oy + r * CELL;
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x0 + CELL > maxX) maxX = x0 + CELL;
    if (y0 + CELL > maxY) maxY = y0 + CELL;
    sx += x0 + CELL * 0.5;
    sy += y0 + CELL * 0.5;
    n += 1;
  }
  return {
    ox, oy, cols, rows, bits, n, col, row,
    minX, minY, maxX, maxY,
    cx: n ? sx / n : 0,
    cy: n ? sy / n : 0,
  };
}

const BOOKS = {};
for (const [id, book] of Object.entries(MASK_RAW)) {
  const clips = {};
  for (const [name, frames] of Object.entries(book.clips || {})) {
    clips[name] = frames.map(decode).filter(Boolean);
  }
  const strike = {};
  for (const [name, frames] of Object.entries(book.strike || {})) {
    strike[name] = frames.map((spec) => (spec ? decode(spec) : null));
  }
  const push = book.push;
  BOOKS[id] = {
    clips,
    strike,
    push: push ? { x: push[0], y: push[1], w: push[2], h: push[3] } : null,
  };
}

export function maskBook(id) {
  return BOOKS[id] || null;
}

function poseOf(fighter) {
  const p = fighter?.rig?._pose;
  if (p && typeof p.sx === 'number') return p;
  const st = fighter?.state;
  if (!st || st === 'idle' || st === 'walk' || st === 'ko' || st === 'dead') return IDENT;
  return poseTarget(st, {
    facing: fighter.facing || 1,
    phase: fighter.frameData ? attackPhase(fighter.frameData, fighter.attackFrame || 0) : 'idle',
    recT: 1,
    t: 0,
    step: 0,
    landing: (fighter.landing || 0) > 0,
    vy: fighter.body?.velocity?.y || 0,
    units: fighter.hurtUnits || 0,
    hurtSign: fighter.hurtSign || 1,
  });
}

function trig(pose) {
  const rot = pose.rot || 0;
  if (pose._rot !== rot) {
    pose._rot = rot;
    pose._c = Math.cos(rot);
    pose._s = Math.sin(rot);
  }
  return pose;
}

function bodyScale(fighter) {
  const s = fighter?.rig?.baseScale;
  return s > 0 ? s : 1;
}

// visual: the overlay follows the sprite, including the one-frame render
// offset on the rig. Hit tests stay on the sim position.
function originOf(fighter, visual) {
  if (!visual) return { x: fighter.x, y: fighter.y };
  const rig = fighter.rig;
  return {
    x: fighter.x + (rig?.x || 0),
    y: fighter.y + (rig?.y || 0),
  };
}

function xform(fighter, pose, gx, gy, out, visual) {
  const t = trig(pose);
  const c = t._c;
  const s = t._s;
  const bs = bodyScale(fighter);
  const ux = gx * (pose.sx || 1) * bs;
  const uy = gy * (pose.sy || 1) * bs;
  const rx = ux * c - uy * s;
  const ry = ux * s + uy * c;
  const facing = fighter.facing || 1;
  const o = originOf(fighter, visual);
  out.x = o.x + facing * ((pose.x || 0) * bs + rx);
  out.y = o.y + (pose.y || 0) * bs + ry;
  return out;
}

function fromWorld(fighter, pose, wx, wy, out) {
  const facing = fighter.facing || 1;
  const bs = bodyScale(fighter);
  const lx = (wx - fighter.x) * facing - (pose.x || 0) * bs;
  const ly = (wy - fighter.y) - (pose.y || 0) * bs;
  const t = trig(pose);
  const c = t._c;
  const s = t._s;
  out.x = (lx * c + ly * s) / ((pose.sx || 1) * bs);
  out.y = (-lx * s + ly * c) / ((pose.sy || 1) * bs);
  return out;
}

// The H overlay draws whoever is on screen right now. Hidden, KO'd, and
// dead fighters keep their last sim spot, and drawing those masks leaves
// body-shaped blobs in the sky.
export function maskShown(fighter) {
  if (!fighter || fighter.alive === false) return false;
  if (fighter.state === 'dead' || fighter.state === 'ko') return false;
  if (fighter.visible === false) return false;
  const rig = fighter.rig;
  if (rig && rig.visible === false) return false;
  if (rig?._posingClips) return true;
  if (rig?.sprite && rig.sprite.visible === false) return false;
  return true;
}

function writeAabb(fighter, mask, pose, out) {
  const xs = [mask.minX, mask.maxX];
  const ys = [mask.minY, mask.maxY];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      xform(fighter, pose, xs[i], ys[j], PT);
      if (PT.x < x0) x0 = PT.x;
      if (PT.y < y0) y0 = PT.y;
      if (PT.x > x1) x1 = PT.x;
      if (PT.y > y1) y1 = PT.y;
    }
  }
  const pad = CELL * 0.5 * Math.max(Math.abs(pose.sx || 1), Math.abs(pose.sy || 1));
  out.x0 = x0 - pad;
  out.y0 = y0 - pad;
  out.x1 = x1 + pad;
  out.y1 = y1 + pad;
  return out;
}

function aabbHit(a, b) {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

export function currentClipFrame(fighter) {
  const id = fighter?.charDef?.id;
  const book = BOOKS[id];
  const rig = fighter?.rig;
  let clip = rig?.maskClip;
  let frame = rig?.maskFrame ?? 0;
  if (!clip) {
    const st = fighter?.state;
    if (st === 'walk' && book?.clips?.walk) clip = 'walk';
    else if ((st === 'attack' || st === 'charging' || st === 'defending') && book?.clips?.attack) clip = 'attack';
    else clip = 'idle';
    frame = 0;
  }
  return { book, clip, frame: frame | 0 };
}

export function currentMask(fighter) {
  const { book, clip, frame } = currentClipFrame(fighter);
  const frames = book?.clips?.[clip] || book?.clips?.idle;
  if (!frames?.length) return null;
  const i = Math.min(frames.length - 1, Math.max(0, frame));
  return frames[i];
}

function attackStrip(fighter) {
  const { book, clip, frame } = currentClipFrame(fighter);
  if (clip === 'attack' || clip === 'special') return { book, clip, frame };
  const frames = book?.clips?.attack;
  const n = frames?.length || 1;
  if (fighter?.frameData) {
    return { book, clip: 'attack', frame: stripIndex(n, fighter.frameData, fighter.attackFrame || 0) };
  }
  return { book, clip: 'attack', frame: 0 };
}

export function strikeMask(fighter) {
  const { book, clip, frame } = attackStrip(fighter);
  const frames = book?.strike?.[clip] || (clip === 'special' ? null : book?.strike?.attack);
  if (!frames?.length) return null;
  const i = Math.min(frames.length - 1, Math.max(0, frame));
  return frames[i] || null;
}

function solidAt(mask, gx, gy) {
  const col = Math.floor((gx - mask.ox) / CELL);
  const row = Math.floor((gy - mask.oy) / CELL);
  if ((col | 0) !== col || col < 0 || row < 0 || col >= mask.cols || row >= mask.rows) return false;
  const i = row * mask.cols + col;
  return (mask.bits[i >> 3] & (1 << (i & 7))) !== 0;
}

const SAMPLES = [
  [0.5, 0.5],
  [0.08, 0.08],
  [0.92, 0.08],
  [0.08, 0.92],
  [0.92, 0.92],
];

export function masksOverlap(a, maskA, b, maskB) {
  if (!maskA?.n || !maskB?.n) return false;
  const poseA = poseOf(a);
  const poseB = poseOf(b);
  writeAabb(a, maskA, poseA, BB1);
  writeAabb(b, maskB, poseB, BB2);
  if (!aabbHit(BB1, BB2)) return false;
  const aSmall = maskA.n <= maskB.n;
  const srcF = aSmall ? a : b;
  const srcM = aSmall ? maskA : maskB;
  const srcP = aSmall ? poseA : poseB;
  const dstF = aSmall ? b : a;
  const dstM = aSmall ? maskB : maskA;
  const dstP = aSmall ? poseB : poseA;
  for (let i = 0; i < srcM.n; i++) {
    const left = srcM.ox + srcM.col[i] * CELL;
    const top = srcM.oy + srcM.row[i] * CELL;
    for (let s = 0; s < 5; s++) {
      const gx = left + SAMPLES[s][0] * CELL;
      const gy = top + SAMPLES[s][1] * CELL;
      xform(srcF, srcP, gx, gy, PT);
      fromWorld(dstF, dstP, PT.x, PT.y, PT2);
      if (solidAt(dstM, PT2.x, PT2.y)) return true;
    }
  }
  return false;
}

export function hurtHitsCircle(fighter, cx, cy, radius) {
  const mask = currentMask(fighter);
  if (!mask?.n || !(radius > 0)) return false;
  const pose = poseOf(fighter);
  writeAabb(fighter, mask, pose, BB1);
  if (cx + radius < BB1.x0 || cx - radius > BB1.x1 || cy + radius < BB1.y0 || cy - radius > BB1.y1) return false;
  const reach = radius + CELL * 0.5;
  const r2 = reach * reach;
  for (let i = 0; i < mask.n; i++) {
    const gx = mask.ox + (mask.col[i] + 0.5) * CELL;
    const gy = mask.oy + (mask.row[i] + 0.5) * CELL;
    xform(fighter, pose, gx, gy, PT);
    const dx = PT.x - cx;
    const dy = PT.y - cy;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

export function hurtHitsRect(fighter, rect) {
  const mask = currentMask(fighter);
  if (!mask?.n || !rect) return false;
  const pose = poseOf(fighter);
  writeAabb(fighter, mask, pose, BB1);
  const x1 = rect.x + (rect.width ?? rect.w ?? 0);
  const y1 = rect.y + (rect.height ?? rect.h ?? 0);
  if (BB1.x1 < rect.x || BB1.x0 > x1 || BB1.y1 < rect.y || BB1.y0 > y1) return false;
  const pad = CELL * 0.5;
  for (let i = 0; i < mask.n; i++) {
    const gx = mask.ox + (mask.col[i] + 0.5) * CELL;
    const gy = mask.oy + (mask.row[i] + 0.5) * CELL;
    xform(fighter, pose, gx, gy, PT);
    if (PT.x >= rect.x - pad && PT.x <= x1 + pad && PT.y >= rect.y - pad && PT.y <= y1 + pad) return true;
  }
  return false;
}

function inWindow(fighter) {
  const hit = fighter?.activeHit;
  if (!hit) return false;
  const time = fighter.scene?.simNow ?? fighter.scene?.time?.now ?? 0;
  if (time < hit.from || time > hit.until) return false;
  return true;
}

function activeMelee(fighter) {
  if (!inWindow(fighter)) return false;
  if (fighter.activeHit?.move?.kind === 'dash') return false;
  const fd = fighter.frameData;
  const frame = fighter.attackFrame ?? 0;
  const start = fd?.startup ?? 0;
  const active = Math.max(1, fd?.active ?? 1);
  return frame >= start && frame < start + active;
}

export function parametricArc(fighter) {
  if (!activeMelee(fighter)) return null;
  const move = fighter.activeHit.move || {};
  const fd = fighter.frameData;
  const frame = fighter.attackFrame ?? 0;
  const start = fd?.startup ?? 0;
  const active = Math.max(1, fd?.active ?? 1);
  const u = Math.max(0, Math.min(1, (frame - start) / active));
  const grow = Math.sin(u * Math.PI * 0.5);
  const bodyW = fighter.bodyW ?? fighter.charDef?.art?.bodyW ?? 40;
  const bodyH = fighter.bodyH ?? fighter.charDef?.art?.bodyH ?? 110;
  const reach = move.rangeW ?? Math.round(bodyW * 1.7);
  const thick = Math.max(12, (move.rangeH ?? bodyH * 0.42) * 0.38);
  const r1 = Math.max(22, reach * (0.4 + 0.6 * grow));
  const r0 = Math.max(0, r1 - thick);
  const low = !!(fighter.grounded && fighter.input?.down);
  const chest = bodyH * (low ? 0.34 : 0.58);
  return {
    ox: bodyW * 0.12,
    oy: -chest,
    a0: low ? -0.2 : -1.05,
    a1: low ? 0.95 : 0.45,
    r0,
    r1,
    rMid: (r0 + r1) / 2,
    thick,
    pixel: false,
  };
}

function arcHitsMask(attacker, victim, vmask, arc) {
  const poseV = poseOf(victim);
  const poseA = poseOf(attacker);
  writeAabb(victim, vmask, poseV, BB1);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i <= 6; i++) {
    const a = arc.a0 + (arc.a1 - arc.a0) * (i / 6);
    for (const r of [arc.r0, arc.r1]) {
      xform(attacker, poseA, arc.ox + Math.cos(a) * r, arc.oy - Math.sin(a) * r, PT);
      if (PT.x < x0) x0 = PT.x;
      if (PT.y < y0) y0 = PT.y;
      if (PT.x > x1) x1 = PT.x;
      if (PT.y > y1) y1 = PT.y;
    }
  }
  const pad = CELL * 0.5;
  if (x1 + pad < BB1.x0 || x0 - pad > BB1.x1 || y1 + pad < BB1.y0 || y0 - pad > BB1.y1) return false;
  for (let i = 0; i < vmask.n; i++) {
    const gx = vmask.ox + (vmask.col[i] + 0.5) * CELL;
    const gy = vmask.oy + (vmask.row[i] + 0.5) * CELL;
    xform(victim, poseV, gx, gy, PT);
    fromWorld(attacker, poseA, PT.x, PT.y, PT2);
    const dx = PT2.x - arc.ox;
    const dy = PT2.y - arc.oy;
    const ang = Math.atan2(-dy, dx);
    if (ang < arc.a0 || ang > arc.a1) continue;
    const dist = Math.hypot(dx, dy);
    if (dist >= arc.r0 - pad && dist <= arc.r1 + pad) return true;
  }
  return false;
}

export function strikeHits(attacker, victim) {
  if (!inWindow(attacker) || attacker === victim) return false;
  const vmask = currentMask(victim);
  if (!vmask?.n) return false;
  if (attacker.activeHit?.move?.kind === 'dash') {
    const body = currentMask(attacker);
    if (!body) return false;
    if (masksOverlap(attacker, body, victim, vmask)) return true;
    const poseA = poseOf(attacker);
    const poseV = poseOf(victim);
    writeAabb(attacker, body, poseA, BB1);
    writeAabb(victim, vmask, poseV, BB2);
    BB1.x0 -= 10;
    BB1.x1 += 10;
    if (!aabbHit(BB1, BB2)) return false;
    const pad = 10;
    const rad = 3;
    const pad2 = (pad + CELL * 0.5) * (pad + CELL * 0.5);
    for (let i = 0; i < body.n; i++) {
      const gx = body.ox + (body.col[i] + 0.5) * CELL;
      const gy = body.oy + (body.row[i] + 0.5) * CELL;
      xform(attacker, poseA, gx, gy, PT);
      fromWorld(victim, poseV, PT.x, PT.y, PT2);
      const col = Math.floor((PT2.x - vmask.ox) / CELL);
      const row = Math.floor((PT2.y - vmask.oy) / CELL);
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || r < 0 || c >= vmask.cols || r >= vmask.rows) continue;
          const bit = r * vmask.cols + c;
          if ((vmask.bits[bit >> 3] & (1 << (bit & 7))) === 0) continue;
          const dx = vmask.ox + (c + 0.5) * CELL - PT2.x;
          const dy = vmask.oy + (r + 0.5) * CELL - PT2.y;
          if (dx * dx + dy * dy <= pad2) return true;
        }
      }
    }
    return false;
  }
  if (!activeMelee(attacker)) return false;
  const strike = strikeMask(attacker);
  if (strike?.n >= 3) return masksOverlap(attacker, strike, victim, vmask);
  const arc = parametricArc(attacker);
  return arc ? arcHitsMask(attacker, victim, vmask, arc) : false;
}

function pointInEllipse(lx, ly, rx, ry) {
  if (rx <= 0 || ry <= 0) return false;
  const nx = lx / rx;
  const ny = ly / ry;
  return nx * nx + ny * ny <= 1;
}

function pointInPoly(lx, ly, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][1];
    const yj = poly[j][1];
    const xi = poly[i][0];
    const xj = poly[j][0];
    const hit = ((yi > ly) !== (yj > ly)) && (lx < ((xj - xi) * (ly - yi)) / (yj - yi + 1e-9) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

export function projectileShape(p) {
  const move = p?.move || {};
  const r = p?.radius ?? move.projectileRadius ?? 12;
  const x = p?.gfx?.x ?? 0;
  const y = p?.gfx?.y ?? 0;
  if (move.visualShape === 'spearhead') {
    const rot = p.gfx?.rotation || ((p.owner?.facing === -1) ? Math.PI : 0);
    return {
      kind: 'poly', x, y, rot, r,
      points: [[r * 1.6, 0], [-r * 0.6, -r * 0.7], [-r * 0.2, 0], [-r * 0.6, r * 0.7]],
    };
  }
  if (move.vfx === 'balloon') return { kind: 'ellipse', x, y, rx: r * 0.85, ry: r * 1.05, rot: 0 };
  if (move.vfx === 'gust') return { kind: 'ellipse', x, y, rx: r * 1.1, ry: r * 0.45, rot: 0 };
  return { kind: 'circle', x, y, rx: r * 1.45, ry: r * 1.45, rot: 0 };
}

function pointInProjectile(p, wx, wy, pad) {
  const shape = projectileShape(p);
  const dx = wx - shape.x;
  const dy = wy - shape.y;
  const c = Math.cos(shape.rot || 0);
  const s = Math.sin(shape.rot || 0);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  if (shape.kind === 'poly') {
    if (pointInPoly(lx, ly, shape.points)) return true;
    // A cell overlapping the tip still counts.
    let best = Infinity;
    const poly = shape.points;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((lx - a[0]) * abx + (ly - a[1]) * aby) / (abx * abx + aby * aby + 1e-9)));
      const px = a[0] + abx * t - lx;
      const py = a[1] + aby * t - ly;
      const d = px * px + py * py;
      if (d < best) best = d;
    }
    return best <= pad * pad;
  }
  return pointInEllipse(lx, ly, shape.rx + pad, shape.ry + pad);
}

export function projectileHits(p, fighter) {
  const mask = currentMask(fighter);
  if (!mask?.n || !p?.gfx || p.dead) return false;
  const shape = projectileShape(p);
  const reach = Math.max(shape.rx || 0, shape.r || 0) + CELL;
  const pose = poseOf(fighter);
  writeAabb(fighter, mask, pose, BB1);
  if (shape.x + reach < BB1.x0 || shape.x - reach > BB1.x1 || shape.y + reach < BB1.y0 || shape.y - reach > BB1.y1) {
    return false;
  }
  const pad = CELL * 0.5;
  for (let i = 0; i < mask.n; i++) {
    const gx = mask.ox + (mask.col[i] + 0.5) * CELL;
    const gy = mask.oy + (mask.row[i] + 0.5) * CELL;
    xform(fighter, pose, gx, gy, PT);
    if (pointInProjectile(p, PT.x, PT.y, pad)) return true;
  }
  return false;
}

export function worldAabbOf(fighter, mask) {
  if (!mask?.n) return null;
  const pose = poseOf(fighter);
  writeAabb(fighter, mask, pose, BB1);
  return {
    x: BB1.x0, y: BB1.y0, width: BB1.x1 - BB1.x0, height: BB1.y1 - BB1.y0,
    left: BB1.x0, right: BB1.x1, top: BB1.y0, bottom: BB1.y1,
  };
}

export function hurtAabb(fighter) {
  return worldAabbOf(fighter, currentMask(fighter));
}

export function hitAabb(fighter) {
  if (!inWindow(fighter)) return null;
  if (fighter.activeHit?.move?.kind === 'dash') return hurtAabb(fighter);
  if (!activeMelee(fighter)) return null;
  const strike = strikeMask(fighter);
  if (strike?.n >= 3) return worldAabbOf(fighter, strike);
  const arc = parametricArc(fighter);
  if (!arc) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const pose = poseOf(fighter);
  for (let i = 0; i <= 8; i++) {
    const a = arc.a0 + (arc.a1 - arc.a0) * (i / 8);
    for (const r of [arc.r0, arc.r1]) {
      const gx = arc.ox + Math.cos(a) * r;
      const gy = arc.oy - Math.sin(a) * r;
      xform(fighter, pose, gx, gy, PT);
      if (PT.x < x0) x0 = PT.x;
      if (PT.y < y0) y0 = PT.y;
      if (PT.x > x1) x1 = PT.x;
      if (PT.y > y1) y1 = PT.y;
    }
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, left: x0, right: x1, top: y0, bottom: y1 };
}

function cellWorldRect(fighter, pose, gx, gy) {
  xform(fighter, pose, gx, gy, PT, true);
  const bs = bodyScale(fighter);
  const w = CELL * Math.abs(pose.sx || 1) * bs;
  const h = CELL * Math.abs(pose.sy || 1) * bs;
  return { x: PT.x - w / 2, y: PT.y - h / 2, w, h };
}

export function debugCells(fighter) {
  if (!maskShown(fighter)) return [];
  const mask = currentMask(fighter);
  if (!mask?.n) return [];
  const pose = poseOf(fighter);
  const out = [];
  for (let i = 0; i < mask.n; i++) {
    const gx = mask.ox + (mask.col[i] + 0.5) * CELL;
    const gy = mask.oy + (mask.row[i] + 0.5) * CELL;
    out.push(cellWorldRect(fighter, pose, gx, gy));
  }
  return out;
}

export function debugHitCells(fighter) {
  if (!maskShown(fighter)) return [];
  if (!activeMelee(fighter)) return [];
  const strike = strikeMask(fighter);
  if (!strike?.n) return [];
  const pose = poseOf(fighter);
  const out = [];
  for (let i = 0; i < strike.n; i++) {
    const gx = strike.ox + (strike.col[i] + 0.5) * CELL;
    const gy = strike.oy + (strike.row[i] + 0.5) * CELL;
    out.push(cellWorldRect(fighter, pose, gx, gy));
  }
  return out;
}

function fitArc(mask) {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < mask.n; i++) {
    cx += mask.ox + (mask.col[i] + 0.5) * CELL;
    cy += mask.oy + (mask.row[i] + 0.5) * CELL;
  }
  cx /= mask.n;
  cy /= mask.n;
  const pivotX = cx - Math.max(CELL * 2, Math.abs(cx) * 0.55);
  const pivotY = cy;
  let a0 = 99;
  let a1 = -99;
  let rMin = 1e9;
  let rMax = 0;
  let rSum = 0;
  let used = 0;
  for (let i = 0; i < mask.n; i++) {
    const x = mask.ox + (mask.col[i] + 0.5) * CELL;
    const y = mask.oy + (mask.row[i] + 0.5) * CELL;
    const dx = x - pivotX;
    const dy = y - pivotY;
    if (dx < -CELL) continue;
    const ang = Math.atan2(-dy, dx);
    const r = Math.hypot(dx, dy);
    if (ang < a0) a0 = ang;
    if (ang > a1) a1 = ang;
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    rSum += r;
    used += 1;
  }
  if (used < 3) return null;
  if (a1 - a0 < 0.28) {
    const mid = (a0 + a1) / 2;
    a0 = mid - 0.18;
    a1 = mid + 0.18;
  }
  const thick = Math.max(CELL * 1.8, (rMax - rMin) + CELL);
  const rMid = rSum / used;
  return {
    ox: pivotX, oy: pivotY, a0, a1,
    r0: Math.max(0, rMid - thick / 2),
    r1: rMid + thick / 2,
    rMid, thick, pixel: true,
  };
}

export function slashArc(fighter) {
  if (fighter?.activeHit?.move?.kind === 'dash') return null;
  if (!activeMelee(fighter)) return null;
  const strike = strikeMask(fighter);
  if (strike?.n >= 3) return fitArc(strike) || parametricArc(fighter);
  return parametricArc(fighter);
}

export function slashPolyline(fighter, steps = 12) {
  const arc = slashArc(fighter);
  if (!arc) return null;
  const pose = poseOf(fighter);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = arc.a0 + (arc.a1 - arc.a0) * (i / steps);
    const gx = arc.ox + Math.cos(a) * arc.rMid;
    const gy = arc.oy - Math.sin(a) * arc.rMid;
    xform(fighter, pose, gx, gy, PT, true);
    pts.push({ x: PT.x, y: PT.y });
  }
  return { pts, thick: arc.thick, pixel: !!arc.pixel };
}

export function localPush(fighter) {
  const id = fighter?.charDef?.id;
  return BOOKS[id]?.push || null;
}

export function posedRect(fighter, box) {
  if (!box) return null;
  const pose = poseOf(fighter);
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [gx, gy] of corners) {
    xform(fighter, pose, gx, gy, PT);
    if (PT.x < x0) x0 = PT.x;
    if (PT.y < y0) y0 = PT.y;
    if (PT.x > x1) x1 = PT.x;
    if (PT.y > y1) y1 = PT.y;
  }
  return {
    x: x0, y: y0, width: x1 - x0, height: y1 - y0,
    left: x0, right: x1, top: y0, bottom: y1,
  };
}

export function maskLocalCenter(fighter) {
  const mask = currentMask(fighter);
  if (!mask) return { x: 0, y: 0, width: 0 };
  return { x: mask.cx, y: mask.cy, width: Math.max(1, mask.maxX - mask.minX) };
}

export function fittedSize(fighter) {
  const mask = currentMask(fighter);
  const pose = poseOf(fighter);
  if (!mask) return { w: 0, h: 0 };
  return {
    w: (mask.maxX - mask.minX) * Math.abs(pose.sx || 1),
    h: (mask.maxY - mask.minY) * Math.abs(pose.sy || 1),
  };
}
