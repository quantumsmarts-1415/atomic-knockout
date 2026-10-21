// Beams and projectiles stop at the first fighter hurtbox or solid.
// `pierce` (default off) is the only flag that keeps traveling through both.
// Horizontal beams ignore ground slabs so a chest shot over an island is not
// cut to nothing. Pillars (solids with a height) always block. A downward
// aim also stops on the ground volume.

function finite(n, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

/** World AABBs for stage solids. Ground slabs are marked and extend downward. */
export function stageSolids(stage, groundY = 560) {
  const gy = stage?.groundY ?? groundY ?? 560;
  const out = [];
  for (const s of stage?.solids || []) {
    if (!(s?.w > 0)) continue;
    const left = s.x - s.w / 2;
    const right = s.x + s.w / 2;
    if (s.h == null) {
      const top = s.y ?? gy;
      out.push({ left, right, top, bottom: top + 400, ground: true });
    } else if (s.h > 0) {
      const top = s.y ?? gy;
      out.push({ left, right, top, bottom: top + s.h, ground: false });
    }
  }
  return out;
}

function isGround(blocker) {
  return !!(blocker?.ground || blocker?.box?.ground);
}

/** Entry distance along a unit ray, or null on a miss. 0 if the origin is inside. */
export function rayBoxEntry(x, y, ux, uy, box) {
  if (!box) return null;
  const left = finite(box.left);
  const right = finite(box.right);
  const top = finite(box.top);
  const bottom = finite(box.bottom);
  if (!(right > left) || !(bottom > top)) return null;
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    [ux, x, left, right],
    [uy, y, top, bottom],
  ];
  for (const [u, origin, a, b] of axes) {
    if (Math.abs(u) < 1e-8) {
      if (origin < a || origin > b) return null;
      continue;
    }
    let t1 = (a - origin) / u;
    let t2 = (b - origin) / u;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return tmin < 0 ? 0 : tmin;
}

function expandBox(box, pad) {
  const p = pad > 0 ? pad : 0;
  return {
    left: box.left - p,
    right: box.right + p,
    top: box.top - p,
    bottom: box.bottom + p,
    ground: box.ground,
  };
}

/**
 * Clip a beam to the first blocker.
 * spec: { x, y, dx, dy, maxLen, thick }
 * blockers: [{ kind: 'solid'|'fighter', box, target, ground }]
 * Pierce keeps the full length and reports every fighter inside it.
 */
export function clipBeam(spec, blockers, opts = {}) {
  const maxLen = Math.max(0, finite(spec?.maxLen));
  let dx = finite(spec?.dx);
  let dy = finite(spec?.dy);
  if (dx === 0 && dy === 0) dx = 1;
  const mag = Math.hypot(dx, dy) || 1;
  const ux = dx / mag;
  const uy = dy / mag;
  const horizontal = Math.abs(uy) <= 0.2;
  const pad = Math.max(0, finite(spec?.thick) * 0.5);
  const origin = { x: finite(spec?.x), y: finite(spec?.y) };
  const end = { x: origin.x + ux * maxLen, y: origin.y + uy * maxLen };
  const pierce = !!opts.pierce;
  const hits = [];
  let best = null;

  for (const blocker of blockers || []) {
    if (!blocker?.box) continue;
    if (horizontal && isGround(blocker)) continue;
    const entry = rayBoxEntry(origin.x, origin.y, ux, uy, expandBox(blocker.box, pad));
    if (entry == null || entry > maxLen + 1e-4) continue;
    const point = { x: origin.x + ux * entry, y: origin.y + uy * entry };
    const rec = { ...blocker, dist: entry, point };
    if (blocker.kind === 'fighter') hits.push(rec);
    if (pierce) continue;
    const closer = !best || entry < best.dist - 1e-4;
    const tieFighter = best && Math.abs(entry - best.dist) <= 1e-4
      && blocker.kind === 'fighter' && best.kind !== 'fighter';
    if (closer || tieFighter) best = rec;
  }

  hits.sort((a, b) => a.dist - b.dist);
  if (pierce) return { length: maxLen, hit: null, point: end, hits };
  if (!best) return { length: maxLen, hit: null, point: end, hits: [] };
  return {
    length: Math.max(0, best.dist),
    hit: best,
    point: best.point,
    hits: best.kind === 'fighter' ? [best] : [],
  };
}

/** First solid a segment enters. `t` is 0–1 along the segment. Radius expands the box. */
export function segmentHitsSolid(x0, y0, x1, y1, radius, solids, opts = {}) {
  const ignoreGround = !!opts.ignoreGround;
  const pad = Math.max(0, finite(radius));
  const dx = finite(x1) - finite(x0);
  const dy = finite(y1) - finite(y0);
  let best = null;
  for (const solid of solids || []) {
    if (!solid) continue;
    if (ignoreGround && solid.ground) continue;
    // Pillars stop the body. The ground waits until the center crosses the top.
    const box = expandBox(solid, solid.ground ? 0 : pad);
    const t = raySegmentT(finite(x0), finite(y0), dx, dy, box);
    if (t == null) continue;
    if (best && t >= best.t) continue;
    best = {
      t,
      x: finite(x0) + dx * t,
      y: finite(y0) + dy * t,
      solid,
    };
  }
  return best;
}

function raySegmentT(x, y, dx, dy, box) {
  let tmin = 0;
  let tmax = 1;
  const axes = [
    [dx, x, box.left, box.right],
    [dy, y, box.top, box.bottom],
  ];
  for (const [d, origin, a, b] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (origin < a || origin > b) return null;
      continue;
    }
    let t1 = (a - origin) / d;
    let t2 = (b - origin) / d;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0 || tmin > 1) return null;
  return tmin;
}

export function circleHitsSolid(x, y, radius, solids, opts = {}) {
  return segmentHitsSolid(x, y, x, y, radius, solids, opts);
}
