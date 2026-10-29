// Combat forecast and resolution. Pure: callers pass an rng.
//
//   hit%   = 78 + 2*(atk.spd - def.spd) - tile avoid        (0..100)
//   crit%  = 5 + (atk.spd - def.spd)                         (0..50), crit = x2 damage
//   damage = round(atk.power * elementMult) - def.def - tile def   (min 1 on a hit)
//   follow-up: a unit 4+ Spd above the other strikes twice
//   counter: the defender strikes back only if the attacker stands inside its range
import { CHARACTERS } from '../data/characters.js';
import { resolveMoveDamage } from '../data/balance.js';
import { basicMove } from './units.js';
import { terrainAt } from './terrain.js';
import { dist } from './grid.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const DOUBLE_GAP = 4;
export const CRIT_MULT = 2;

/** Element matchup multiplier from the real balance table, clamped 0.6..1.5. */
export function elementMult(atkId, defId) {
  const a = CHARACTERS[atkId];
  const d = CHARACTERS[defId];
  const mv = a ? basicMove(a) : null;
  if (!a || !d || !mv) return 1;
  const neutral = resolveMoveDamage(mv, a, null).total;
  if (!(neutral > 0)) return 1;
  const vs = resolveMoveDamage(mv, a, d).total;
  return clamp(vs / neutral, 0.6, 1.5);
}

function strike(att, def, map) {
  const tile = terrainAt(map, def.x, def.y);
  const mult = elementMult(att.id, def.id);
  const raw = Math.round(att.power * mult) - def.def - (tile?.def || 0);
  return {
    mult,
    dmg: Math.max(1, raw),
    hit: clamp(78 + 2 * (att.spd - def.spd) - (tile?.avoid || 0), 0, 100),
    crit: clamp(5 + (att.spd - def.spd), 0, 50),
  };
}

export function inRange(unit, dx, dy) {
  const d = Math.abs(dx) + Math.abs(dy);
  return d >= unit.range[0] && d <= unit.range[1];
}

/** What would happen if `att` attacks `def` from where each stands now. */
export function forecast(att, def, map) {
  const d = dist(att.x, att.y, def.x, def.y);
  const out = { dist: d, att: strike(att, def, map), def: null, attHits: 1, defHits: 0 };
  if (inRange(def, att.x - def.x, att.y - def.y)) {
    out.def = strike(def, att, map);
    out.defHits = 1;
  }
  const gap = att.spd - def.spd;
  if (gap >= DOUBLE_GAP) out.attHits = 2;
  else if (-gap >= DOUBLE_GAP && out.def) out.defHits = 2;
  return out;
}

/**
 * Play the exchange. Mutates hp on both units and returns the strike log:
 * [{ by:'att'|'def', hit, crit, dmg, targetHp, killed }]
 */
export function resolve(att, def, map, rng) {
  const f = forecast(att, def, map);
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
    log.push({ by: side, hit, crit, dmg, targetHp: tgt.hp, killed: tgt.hp <= 0 });
    if (tgt.hp <= 0) break;
  }
  return { log, forecast: f };
}
