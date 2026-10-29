// Combat forecast and resolution. Pure: callers pass an rng.
//
//   hit%   = 78 + 2*(atk.spd - def.spd) - tile avoid        (0..100)
//   crit%  = 5 + (atk.spd - def.spd)                         (0..50), crit = x2 damage
//   damage = round(move damage x elementMult x power-up) + atk.power (flat level bonus) - def.def - tile def
//            then x (1 - guard) when the defender is guarding           (min 1 on a hit)
//   move damage = the move's fighting-game damage % x DAMAGE_SCALE (src/campaign/moves.js);
//                 a charged release uses the move's full-charge damage
//   follow-up: a unit 4+ Spd above the other strikes its BASIC move twice
//   counter: the defender strikes back with its basic move only if the attacker stands inside that move's range
import { CHARACTERS } from '../data/characters.js';
import { resolveMoveDamage } from '../data/balance.js';
import { campaignMoves, basicOf } from './moves.js';
import { terrainAt } from './terrain.js';
import { dist } from './grid.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const DOUBLE_GAP = 4;
export const CRIT_MULT = 2;

/** The unit's moves (plain test units without a `moves` list fall back to their fighter's). */
export function movesOf(unit) {
  return unit.moves || campaignMoves(unit.id);
}

export function basicOfUnit(unit) {
  return movesOf(unit).find((m) => m.key === 'basicDirectional') || basicOf(unit.id);
}

/** Element matchup multiplier for one move from the real balance table, clamped 0.6..1.5. */
export function elementMult(atkId, defId, move = null) {
  const a = CHARACTERS[atkId];
  const d = CHARACTERS[defId];
  const mv = move?.raw || (a ? basicOf(atkId)?.raw : null);
  if (!a || !d || !mv) return 1;
  const neutral = resolveMoveDamage(mv, a, null).total;
  if (!(neutral > 0)) return 1;
  const vs = resolveMoveDamage(mv, a, d).total;
  return clamp(vs / neutral, 0.6, 1.5);
}

function strike(att, def, map, move) {
  const tile = terrainAt(map, def.x, def.y);
  const mult = elementMult(att.id, def.id, move);
  const power = att.status?.power ? att.status.power.mult : 1;
  const weaken = att.status?.weaken ? att.status.weaken.mult : 1;
  const vuln = def.status?.vulnerable ? def.status.vulnerable.mult : 1;
  let raw = Math.round((move.dmg || 0) * mult * power * weaken * vuln) + (att.power || 0) - def.def - (tile?.def || 0);
  if (def.status?.guard) raw = Math.round(raw * (1 - def.status.guard.frac));
  const blind = att.status?.blind ? 30 : 0;
  return {
    mult,
    move,
    dmg: Math.max(1, raw),
    hit: clamp(78 + 2 * (att.spd - def.spd) - (tile?.avoid || 0) - blind, 0, 100),
    crit: clamp(5 + (att.spd - def.spd), 0, 50),
  };
}

export function inRange(unit, dx, dy) {
  const d = Math.abs(dx) + Math.abs(dy);
  return d >= unit.range[0] && d <= unit.range[1];
}

/**
 * What would happen if `att` uses `move` (default: its basic move) on `def` from where each stands now.
 * The defender counters with its basic move when the attacker is inside that move's range.
 */
export function forecast(att, def, map, move = null) {
  const m = move || basicOfUnit(att);
  const d = dist(att.x, att.y, def.x, def.y);
  const out = { dist: d, move: m, att: strike(att, def, map, m), def: null, attHits: 1, defHits: 0 };
  const counter = basicOfUnit(def);
  if (counter && !def.stunned && inRange({ range: counter.range }, att.x - def.x, att.y - def.y)) {
    out.def = strike(def, att, map, counter);
    out.defHits = 1;
  }
  const gap = att.spd - def.spd;
  const basicUse = m.slot === 'basic';
  if (gap >= DOUBLE_GAP && basicUse) out.attHits = 2;
  else if (-gap >= DOUBLE_GAP && out.def) out.defHits = 2;
  return out;
}

/**
 * Play the exchange. Mutates hp on both units and returns the strike log:
 * [{ by:'att'|'def', hit, crit, dmg, targetHp, killed, move }]
 */
export function resolve(att, def, map, rng, move = null) {
  const f = forecast(att, def, map, move);
  const seq = ['att'];
  if (f.def) seq.push('def');
  if (f.attHits === 2) seq.push('att');
  if (f.defHits === 2) seq.push('def');
  const log = [];
  for (const side of seq) {
    const who = side === 'att' ? att : def;
    const tgt = side === 'att' ? def : att;
    if (who.hp <= 0 || tgt.hp <= 0) break;
    const s = side === 'att' ? f.att : f.def;
    const hit = rng() * 100 < s.hit;
    const crit = hit && rng() * 100 < s.crit;
    const dmg = hit ? s.dmg * (crit ? CRIT_MULT : 1) : 0;
    tgt.hp = Math.max(0, tgt.hp - dmg);
    log.push({ by: side, hit, crit, dmg, targetHp: tgt.hp, killed: tgt.hp <= 0, move: s.move });
    if (tgt.hp <= 0) break;
  }
  return { log, forecast: f };
}
