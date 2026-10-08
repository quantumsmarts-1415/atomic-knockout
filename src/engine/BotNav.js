// ---------------------------------------------------------------------------
// BotNav -- multi-level path-finding for CPU fighters on big stages
// (stage.botNav, e.g. Carbon Skyhook). Pure JS (no Phaser) so the stage
// tests can check the exact graph the bots walk.
//
// The stage becomes a graph of walkable surfaces:
//   solid  -- the top of a solid (minus any part another solid sits on)
//   soft   -- a one-way platform
//   stop   -- one stop of an elevator (move.stops); the lift itself is the
//             surface, so a bot boards at a stop and rides to the next one
// and edges the fighter can actually perform:
//   walk    -- same height, touching/adjacent
//   jump    -- up (or across a gap): take off at tx, steer to lx; `need` px
//              of height, checked per character (single vs. double jump)
//   drop    -- hold down on a soft platform at x to fall to the one below
//   walkoff -- walk off a ledge at ex onto what is directly below it
//   board / exit / ride -- elevator stops
// Edges that would fall into nothing are never generated, so following a
// path can't walk a bot off the stage.
// ---------------------------------------------------------------------------
export const NAV_GRAVITY = 1500;
const WALK_GAP = 24;     // px of gap still walked across
const JUMP_GAP = 160;    // widest horizontal gap a jump edge spans
const EDGE_IN = 22;      // take-off/landing stays this far inside a surface

export function jumpReach(stats, gravity = NAV_GRAVITY) {
  const g = gravity * (stats.gravityScale ?? 1);
  const single = stats.jumpVelocity ** 2 / (2 * g);
  const air = (stats.airJumps ?? 0) > 0 ? (stats.jumpVelocity * 0.92) ** 2 / (2 * g) : 0;
  return { single, total: single + air, airJumps: stats.airJumps ?? 0 };
}

// Can this character make the edge? -> null | 'single' | 'double'
export function edgeMode(edge, reach) {
  if (edge.type !== 'jump') return 'single';
  if (edge.need <= reach.single - 14) return 'single';
  if (reach.airJumps > 0 && edge.need <= reach.total - 30) return 'double';
  return null;
}

function subtract(parts, a, b) {
  const out = [];
  for (const [x0, x1] of parts) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out;
}

export function buildNavGraph(stage) {
  const gy = stage.groundY;
  const solids = stage.solids.map((s) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, y: s.y ?? gy, h: s.h ?? 90 }));
  const nodes = [];
  for (const s of solids) {
    let parts = [[s.x0, s.x1]];
    for (const o of solids) if (o !== s && o.y < s.y && o.y + o.h >= s.y - 1) parts = subtract(parts, o.x0, o.x1);
    for (const [x0, x1] of parts) if (x1 - x0 >= 30) nodes.push({ kind: 'solid', x0, x1, y: s.y });
  }
  const lifts = [];
  let mover = 0;
  for (const p of stage.platforms) {
    const x0 = p.x - p.w / 2;
    const x1 = p.x + p.w / 2;
    if (p.move) {
      const idx = mover++;
      if (p.move.axis === 'y' && p.move.stops) {
        const lift = { mover: idx, def: p, x0, x1, stops: [] };
        for (const y of p.move.stops) {
          const n = { kind: 'stop', x0, x1, y, lift };
          lift.stops.push(n);
          nodes.push(n);
        }
        lifts.push(lift);
      }
      continue; // sine movers aren't pathed (no big stage uses them)
    }
    nodes.push({ kind: 'soft', x0, x1, y: p.y });
  }
  nodes.forEach((n, i) => { n.id = i; n.out = []; n.cx = (n.x0 + n.x1) / 2; });
  const statics = nodes.filter((n) => n.kind !== 'stop');

  // first static surface at or below y (strictly below `y + 4`) covering x
  const firstBelow = (x, y, skip) => {
    let best = null;
    for (const n of statics) {
      if (n === skip || x < n.x0 || x > n.x1 || n.y <= y + 4) continue;
      if (!best || n.y < best.y) best = n;
    }
    return best;
  };
  // a solid body in the vertical band (yTop, yBot) overlapping [xa, xb]
  const blocked = (xa, xb, yTop, yBot) => solids.some((s) => s.x1 > xa && s.x0 < xb && s.y > yTop + 4 && s.y < yBot - 4);

  const add = (a, e) => a.out.push({ from: a.id, ...e });
  for (const A of statics) {
    for (const B of statics) {
      if (A === B) continue;
      const gap = Math.max(B.x0 - A.x1, A.x0 - B.x1);
      const dy = A.y - B.y; // > 0: B is higher
      const dist = Math.abs(B.cx - A.cx);
      if (Math.abs(dy) <= 4) {
        if (gap <= WALK_GAP) add(A, { to: B.id, type: 'walk', cost: dist / 300 });
        else if (gap <= JUMP_GAP) addJump(A, B, gap, dy);
        continue;
      }
      if (dy > 4) { addJump(A, B, gap, dy); continue; }
      // B lower
      if (gap < -40 && A.kind === 'soft') {
        // drop through somewhere B is the first surface under A
        const xa = Math.max(A.x0, B.x0) + EDGE_IN;
        const xb = Math.min(A.x1, B.x1) - EDGE_IN;
        for (let x = (xa + xb) / 2, i = 0; i < 12; i++, x = xa + ((xb - xa) * i) / 11) {
          if (firstBelow(x, A.y, A) === B) { add(A, { to: B.id, type: 'drop', x, cost: 0.4 + dist / 600 }); break; }
        }
      }
      if (gap > 10 && gap <= JUMP_GAP) addJump(A, B, gap, dy);
    }
    // walk off each ledge onto whatever is directly below it
    for (const side of [-1, 1]) {
      const ex = side < 0 ? A.x0 : A.x1;
      const landX = ex + side * 34;
      // something at the same height right there means it isn't a ledge
      if (statics.some((n) => n !== A && Math.abs(n.y - A.y) <= 4 && landX >= n.x0 - WALK_GAP && landX <= n.x1 + WALK_GAP)) continue;
      // nor into an elevator shaft (where you land depends on the lift)
      if (lifts.some((L) => landX >= L.x0 - 10 && landX <= L.x1 + 10)) continue;
      const B = firstBelow(landX, A.y, A);
      if (B && !A.out.some((e) => e.to === B.id && e.type === 'walkoff')) {
        add(A, { to: B.id, type: 'walkoff', side, ex, x: landX, cost: 0.5 + Math.abs(ex - A.cx) / 300 });
      }
    }
  }

  function addJump(A, B, gap, dy) {
    if (gap > JUMP_GAP) return;
    let tx;
    let lx;
    if (gap >= 0) {
      // beside: leave from A's edge facing B, land just inside B
      const dir = B.cx > A.cx ? 1 : -1;
      tx = dir > 0 ? A.x1 - EDGE_IN : A.x0 + EDGE_IN;
      lx = dir > 0 ? B.x0 + EDGE_IN + 8 : B.x1 - EDGE_IN - 8;
    } else if (B.kind === 'soft') {
      // under/overlapping a one-way platform: jump up through it
      const oa = Math.max(A.x0, B.x0);
      const ob = Math.min(A.x1, B.x1);
      if (ob - oa >= 50) { tx = lx = (oa + ob) / 2; }
      else {
        // narrow overlap (stair zig-zag): take off under the overlap, land past it
        tx = Math.min(Math.max((oa + ob) / 2, A.x0 + EDGE_IN), A.x1 - EDGE_IN);
        lx = B.cx > tx ? Math.min(B.x1 - EDGE_IN, ob + 30) : Math.max(B.x0 + EDGE_IN, oa - 30);
      }
    } else {
      // a solid above: only reachable around its side
      if (A.x0 < B.x0 - 50) { tx = B.x0 - 30; lx = B.x0 + EDGE_IN + 8; }
      else if (A.x1 > B.x1 + 50) { tx = B.x1 + 30; lx = B.x1 - EDGE_IN - 8; }
      else return;
    }
    if (blocked(Math.min(tx, lx) - 14, Math.max(tx, lx) + 14, Math.min(A.y, B.y), Math.max(A.y, B.y))) return;
    add(A, { to: B.id, type: 'jump', tx, lx, need: Math.max(0, dy), cost: 0.55 + Math.abs(lx - tx) / 300 + Math.abs(tx - A.cx) / 600 });
  }

  // elevator: board/exit where a stop lines up with a surface; ride between stops
  for (const L of lifts) {
    const order = L.stops.slice().sort((a, b) => b.y - a.y);
    order.forEach((S, i) => {
      for (const n of [order[i - 1], order[i + 1]]) {
        if (n) add(S, { to: n.id, type: 'ride', cost: 1 + Math.abs(n.y - S.y) / 220 });
      }
      for (const A of statics) {
        if (Math.abs(A.y - S.y) > 4) continue;
        const gap = Math.max(S.x0 - A.x1, A.x0 - S.x1);
        if (gap > WALK_GAP) continue;
        add(A, { to: S.id, type: 'board', cost: 2.5 });
        add(S, { to: A.id, type: 'exit', cost: 0.3 });
      }
    });
  }

  return {
    nodes,
    lifts,
    liftY: lifts.map((l) => l.def.y),
    liftPrevY: lifts.map((l) => l.def.y),
    firstBelow,
    setLiftY(i, y) { this.liftPrevY[i] = this.liftY[i]; this.liftY[i] = y; },
  };
}

/**
 * The surface node a fighter with feet at (x, y) is standing on, or null.
 * `halfW` is half the fighter's body width: a fighter keeps standing on a
 * platform until its whole body is past the edge, so its center can be up
 * to halfW beyond the surface's end.
 */
export function nodeAt(nav, x, y, slack = 7, halfW = 6) {
  // on the lift (wherever it is right now)?
  for (const L of nav.lifts) {
    const ly = nav.liftY[L.mover];
    if (x >= L.x0 - halfW && x <= L.x1 + halfW && Math.abs(y - ly) <= slack) return liftNode(nav, L);
  }
  let best = null;
  for (const n of nav.nodes) {
    if (n.kind === 'stop') continue;
    if (x < n.x0 - halfW || x > n.x1 + halfW || Math.abs(y - n.y) > slack) continue;
    if (!best || Math.abs(y - n.y) < Math.abs(y - best.y)) best = n;
  }
  return best;
}

// The stop a lift is at, or the next stop it's heading for.
export function liftNode(nav, L) {
  const ly = nav.liftY[L.mover];
  const dir = Math.sign(ly - nav.liftPrevY[L.mover]);
  let best = null;
  for (const s of L.stops) {
    if (Math.abs(s.y - ly) <= 3) return s;
    if (dir !== 0 && Math.sign(s.y - ly) !== dir) continue;
    if (!best || Math.abs(s.y - ly) < Math.abs(best.y - ly)) best = s;
  }
  return best ?? L.stops[0];
}

/** Is the lift parked at this stop (close enough to step on/off)? */
export function liftAt(nav, stop, tol = 5) {
  return Math.abs(nav.liftY[stop.lift.mover] - stop.y) <= tol;
}

/**
 * Cheapest edge path from node `fromId` to `toId` for a character with this
 * jump reach. `banned` is a Set of "from>to" keys to skip (edges that just
 * failed). Returns [] if already there, null if unreachable.
 */
export function findPath(nav, fromId, toId, reach, banned) {
  if (fromId === toId) return [];
  const n = nav.nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(null);
  const done = new Array(n).fill(false);
  dist[fromId] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) return null;
    if (u === toId) break;
    done[u] = true;
    for (const e of nav.nodes[u].out) {
      if (banned?.has(`${e.from}>${e.to}`)) continue;
      const mode = edgeMode(e, reach);
      if (!mode) continue;
      const c = dist[u] + e.cost + (mode === 'double' ? 0.3 : 0);
      if (c < dist[e.to]) { dist[e.to] = c; prev[e.to] = { e, mode }; }
    }
  }
  const path = [];
  for (let v = toId; v !== fromId; v = prev[v].e.from) path.unshift({ ...prev[v].e, mode: prev[v].mode });
  return path;
}

/** Every node id reachable from `fromId` for this reach (for tests). */
export function reachableFrom(nav, fromId, reach) {
  const seen = new Set([fromId]);
  const stack = [fromId];
  while (stack.length) {
    const u = stack.pop();
    for (const e of nav.nodes[u].out) {
      if (seen.has(e.to) || !edgeMode(e, reach)) continue;
      seen.add(e.to);
      stack.push(e.to);
    }
  }
  return seen;
}
