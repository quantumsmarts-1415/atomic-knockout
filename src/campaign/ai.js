// Enemy AI: pick the tile + target with the best trade, else approach.
//   score = damage dealt (+60 for a kill, +8 if the target is the lord)
//           - 0.6 * expected counter damage + 2 * tile defense
// 'hold' units only act once a player unit is inside move+attack reach
// (from turn 8 they advance too, so a battle can't stall; 'boss' never leaves its post). 'aggressive' units always advance.
import { reachable, ringTiles, distanceField, key, dist } from './grid.js';
import { forecast } from './combat.js';
import { terrainAt } from './terrain.js';

function expected(f, side) {
  const s = f[side];
  if (!s) return 0;
  const hits = side === 'att' ? f.attHits : f.defHits;
  return s.dmg * (s.hit / 100) * (1 + s.crit / 100) * hits;
}

export function planEnemy(state, unit) {
  const reach = reachable(state.map, unit, state.units);
  const foes = state.units.filter((u) => u.alive && u.team !== unit.team);
  if (!foes.length) return { to: { x: unit.x, y: unit.y }, target: null };
  const origin = { x: unit.x, y: unit.y };
  let best = null;
  for (const stop of reach.stops.values()) {
    const tile = terrainAt(state.map, stop.x, stop.y);
    for (const t of ringTiles(state.map, stop.x, stop.y, unit.range[0], unit.range[1])) {
      const foe = foes.find((f) => f.x === t.x && f.y === t.y);
      if (!foe) continue;
      const ghost = { ...unit, x: stop.x, y: stop.y };
      const f = forecast(ghost, foe, state.map);
      const dealt = expected(f, 'att');
      const taken = expected(f, 'def');
      const kill = dealt >= foe.hp ? 60 : 0;
      const score = dealt + kill + (foe.lord ? 8 : 0) - 0.6 * taken + 2 * (tile?.def || 0) - stop.cost * 0.05;
      if (!best || score > best.score) best = { to: { x: stop.x, y: stop.y }, target: foe, score };
    }
  }
  if (best) return best;
  if (unit.ai === 'boss' || (unit.ai === 'hold' && state.turn < 8)) return { to: origin, target: null };
  // approach: minimise remaining path cost to the nearest foe
  const field = distanceField(state.map, foes.map((f) => ({ x: f.x, y: f.y })));
  let spot = null;
  for (const stop of reach.stops.values()) {
    const d = field.get(key(stop.x, stop.y));
    if (d == null) continue;
    const score = d * 10 + (dist(stop.x, stop.y, unit.x, unit.y) === 0 ? 1 : 0);
    if (!spot || score < spot.score) spot = { to: { x: stop.x, y: stop.y }, score };
  }
  return { to: spot ? spot.to : origin, target: null };
}
