// Enemy AI: pick the tile + target with the best trade, else approach.
//   score = damage dealt (+60 for a kill, +8 if the target is the lord)
//           - 0.6 * expected counter damage + 2 * tile defense
// 'hold' units only act once a player unit is inside move+attack reach
// (from turn 8, or their `wake` turn, they advance too, so a battle can't stall; 'boss' never leaves its post). 'aggressive' units always advance.
import { reachable, ringTiles, distanceField, key, dist, hostile } from './grid.js';
import { forecast } from './combat.js';
import { terrainAt } from './terrain.js';
import { healAmount } from './moves.js';

function expected(f, side) {
  const s = f[side];
  if (!s) return 0;
  const hits = side === 'att' ? f.attHits : f.defHits;
  return s.dmg * (s.hit / 100) * (1 + s.crit / 100) * hits;
}

/** Best attack for a unit over every tile it can reach and every move it can fire, or null. */
function bestAttack(state, unit, reach, foes, moves) {
  let best = null;
  for (const stop of reach.stops.values()) {
    const tile = terrainAt(state.map, stop.x, stop.y);
    for (const move of moves) {
      for (const t of ringTiles(state.map, stop.x, stop.y, move.range[0], move.range[1])) {
        const foe = foes.find((f) => f.x === t.x && f.y === t.y);
        if (!foe) continue;
        const ghost = { ...unit, x: stop.x, y: stop.y };
        const f = forecast(ghost, foe, state.map, move);
        const dealt = expected(f, 'att');
        const taken = expected(f, 'def');
        const kill = dealt >= foe.hp ? 60 : 0;
        // a special or release is worth a turn only when it hits harder; basic moves keep the tie
        const score = dealt + kill + (foe.lord ? 8 : 0) - 0.6 * taken + 2 * (tile?.def || 0) - stop.cost * 0.05 + (move.slot === 'special' ? 1 : 0);
        if (!best || score > best.score) best = { to: { x: stop.x, y: stop.y }, target: foe, move, score, dealt, kill: kill > 0 };
      }
    }
  }
  return best;
}

export function planEnemy(state, unit) {
  const reach = reachable(state.map, unit, state.units);
  const foes = state.units.filter((u) => u.alive && hostile(unit, u));
  if (!foes.length) return { to: { x: unit.x, y: unit.y }, target: null };
  const origin = { x: unit.x, y: unit.y };
  // a charged move: release it on the best target in reach, otherwise let the charge go and act normally
  if (unit.charging) {
    const rel = state.chargedMove(unit);
    const hit = rel ? bestAttack(state, unit, reach, foes, [rel]) : null;
    if (hit) return hit;
    return { ...planNormal(state, unit, reach, foes, origin), cancelCharge: true };
  }
  return planNormal(state, unit, reach, foes, origin);
}

/** A healer's best heal: the most wounded ally it can reach (lord and boss first), from the tile nearest to it. */
function bestHeal(state, unit, reach) {
  const move = unit.moves.find((m) => m.action === 'heal');
  if (!move) return null;
  let best = null;
  const stops = unit.ai === 'boss' ? [{ x: unit.x, y: unit.y, cost: 0 }] : [...reach.stops.values()];
  for (const stop of stops) {
    for (const t of ringTiles(state.map, stop.x, stop.y, move.range[0], move.range[1])) {
      const ally = state.unitAt(t.x, t.y);
      if (!ally || ally === unit || ally.team !== unit.team || !ally.alive) continue;
      const missing = ally.maxHp - ally.hp;
      if (missing < Math.min(healAmount({ ...ally, hp: 0 }) * 0.6, ally.maxHp * 0.3)) continue; // not worth a turn
      const score = missing / ally.maxHp * 100 + (ally.lord || ally.boss ? 10 : 0) - stop.cost * 0.5;
      if (!best || score > best.score) best = { to: { x: stop.x, y: stop.y }, target: null, heal: { move, ally }, score };
    }
  }
  return best;
}

function planNormal(state, unit, reach, foes, origin) {
  const moves = state.usableAttacks(unit);
  const best = bestAttack(state, unit, reach, foes, moves);
  // a healer patches up wounded allies before it fights, unless it can take a kill right now
  if (!best || !best.kill) {
    const heal = bestHeal(state, unit, reach);
    if (heal) return heal;
  }
  if (best) {
    // wounded and no kill on offer: brace instead (guard moves exist for every fighter that has a defense slot)
    const guard = unit.moves.find((m) => m.action === 'guard');
    if (guard && !best.kill && unit.hp < unit.maxHp * 0.35 && state.rng() < 0.4) return { to: best.to, target: null, guard };
    // a charge pays off when the hit it makes is much bigger than anything available now
    const charge = unit.moves.find((m) => m.charge && m.attack);
    if (charge && !best.kill && unit.ai !== 'boss' && state.rng() < 0.3) {
      const ghost = { ...unit, x: best.to.x, y: best.to.y };
      const big = expected(forecast(ghost, best.target, state.map, charge), 'att');
      if (big > best.dealt * 1.5) return { to: best.to, target: null, charge };
    }
    return best;
  }
  if (unit.ai === 'boss' || (unit.ai === 'hold' && state.turn < (unit.wake || 8)) || (unit.wake && state.turn < unit.wake)) return { to: origin, target: null };
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
