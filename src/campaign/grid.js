// Pure grid helpers: map parsing, movement range (Dijkstra with terrain cost),
// attack range, paths. No Phaser.
import { GLYPH_TO_TERRAIN, TERRAIN } from './terrain.js';

export const key = (x, y) => `${x},${y}`;
export const dist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

export function parseMap(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const tiles = rows.map((r, y) => {
    if (r.length !== w) throw new Error(`map row ${y} has ${r.length} columns, expected ${w}`);
    return [...r].map((ch) => {
      const id = GLYPH_TO_TERRAIN[ch];
      if (!id) throw new Error(`unknown map glyph "${ch}" in row ${y}`);
      return id;
    });
  });
  return { w, h, tiles };
}

export function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.w && y < map.h;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Tiles a unit can reach. It can walk through allies but not enemies, and it
 * cannot stop on an occupied tile. Returns Map<key, { x, y, cost, prev }>.
 * Includes the unit's own tile at cost 0.
 */
export function reachable(map, unit, units) {
  const occ = new Map();
  for (const u of units) if (u.alive && u !== unit) occ.set(key(u.x, u.y), u);
  const best = new Map();
  best.set(key(unit.x, unit.y), { x: unit.x, y: unit.y, cost: 0, prev: null });
  const open = [{ x: unit.x, y: unit.y, cost: 0 }];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    if (cur.cost > best.get(key(cur.x, cur.y)).cost) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const step = TERRAIN[map.tiles[ny][nx]].cost;
      if (!Number.isFinite(step)) continue;
      const blocker = occ.get(key(nx, ny));
      if (blocker && blocker.team !== unit.team) continue;
      const cost = cur.cost + step;
      if (cost > unit.mov) continue;
      const k = key(nx, ny);
      const prior = best.get(k);
      if (prior && prior.cost <= cost) continue;
      best.set(k, { x: nx, y: ny, cost, prev: key(cur.x, cur.y) });
      open.push({ x: nx, y: ny, cost });
    }
  }
  // tiles a unit may end on
  const stops = new Map();
  for (const [k, v] of best) if (!occ.has(k)) stops.set(k, v);
  return { all: best, stops };
}

/** Walk back through `prev` to a list of {x,y} from the start to `to`. */
export function pathTo(reach, to) {
  const out = [];
  let k = key(to.x, to.y);
  while (k) {
    const n = reach.all.get(k);
    if (!n) return [];
    out.unshift({ x: n.x, y: n.y });
    k = n.prev;
  }
  return out;
}

/** Tiles within [min,max] Manhattan distance of (x,y) that are on the map. */
export function ringTiles(map, x, y, min, max) {
  const out = [];
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < min || d > max) continue;
      if (inBounds(map, x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
    }
  }
  return out;
}

/** Every tile a unit could hit this turn: attack ring around each stop. */
export function threatTiles(map, unit, reach) {
  const set = new Map();
  const [min, max] = unit.range;
  for (const s of reach.stops.values()) {
    for (const t of ringTiles(map, s.x, s.y, min, max)) set.set(key(t.x, t.y), t);
  }
  return set;
}

/** Cost-to-reach map from a set of goal tiles, ignoring units (for AI approach). */
export function distanceField(map, goals) {
  const best = new Map();
  const open = [];
  for (const g of goals) { best.set(key(g.x, g.y), 0); open.push({ x: g.x, y: g.y, cost: 0 }); }
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    if (cur.cost > best.get(key(cur.x, cur.y))) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const step = TERRAIN[map.tiles[ny][nx]].cost;
      if (!Number.isFinite(step)) continue;
      const cost = cur.cost + step;
      const k = key(nx, ny);
      if (best.has(k) && best.get(k) <= cost) continue;
      best.set(k, cost);
      open.push({ x: nx, y: ny, cost });
    }
  }
  return best;
}
