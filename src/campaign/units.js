// Turn an Atomic Knockout fighter into tactics-map stats.
//
//   HP    16 + weight*10 + kineticDef*10            (heavier elements are tougher)
//   Pow   2 + 2*sqrt(damage of the basic-directional move, defender-neutral)
//   Def   1 + weight*2                              (flat reduction per hit)
//   Spd   3 + (walk speed - 175)/285 * 10           (hit/avoid, double attacks)
//   Mov   4 / 5 / 6 by walk speed
//   Range 1, or 1-2 for projectile moves and long reaches (rangeW >= 100)
//
// The move's element still matters: damage is scaled by the real balance table
// (resolveMoveDamage attacker -> defender vs. defender-neutral), so a heat move
// into a heat-resistant element is weaker, electrical into a conductor bites, etc.
import { CHARACTERS } from '../data/characters.js';
import { MOVESETS } from '../data/movesets.js';
import { resolveMoveDamage } from '../data/balance.js';

export const MAX_LEVEL = 20;
export const XP_PER_LEVEL = 100;

export function basicMove(charDef) {
  return MOVESETS[charDef.id]?.basicDirectional || charDef.moves?.basicDirectional || null;
}

export function baseStats(charDef) {
  const c = charDef.combat || {};
  const mv = basicMove(charDef);
  const raw = mv ? resolveMoveDamage(mv, charDef, null).total : 4;
  const weight = c.weight ?? 1;
  const speed = c.speed ?? 300;
  const ranged = mv?.kind === 'projectile' || mv?.kind === 'beam' || (mv?.rangeW ?? 0) >= 100;
  return {
    maxHp: Math.round(16 + weight * 10 + (c.kineticDef || 0) * 10),
    power: Math.round(2 + 2 * Math.sqrt(Math.max(0, raw))),
    def: Math.round(1 + weight * 2),
    spd: Math.round(3 + ((speed - 175) / 285) * 10),
    mov: speed < 260 ? 4 : speed < 350 ? 5 : 6,
    range: ranged ? [1, 2] : [1, 1],
  };
}

/** A fresh unit record at `level` (growth applied as the average per level). */
export function makeRecord(id, level = 1, { lord = false } = {}) {
  const charDef = CHARACTERS[id];
  if (!charDef) throw new Error(`unknown fighter ${id}`);
  const b = baseStats(charDef);
  const n = Math.max(0, level - 1);
  if (lord) { b.maxHp += 8; b.def += 1; } // the lord is sturdier than the fighter alone
  return {
    id,
    level,
    xp: 0,
    lord,
    maxHp: b.maxHp + Math.round(1.6 * n),
    hp: b.maxHp + Math.round(1.6 * n),
    power: b.power + Math.round(0.4 * n),
    def: b.def + Math.round(0.3 * n),
    spd: b.spd + Math.round(0.4 * n),
    mov: b.mov,
    range: b.range,
  };
}

/** Full-health copy for the start of a chapter. Keeps level, xp and stats. */
export function restored(rec) {
  return { ...rec, hp: rec.maxHp };
}

/** Add xp; returns the list of level-ups { level, gains } (mutates rec). */
export function awardXp(rec, amount, rng = Math.random) {
  const ups = [];
  if (rec.level >= MAX_LEVEL) return ups;
  rec.xp += Math.max(0, Math.round(amount));
  while (rec.xp >= XP_PER_LEVEL && rec.level < MAX_LEVEL) {
    rec.xp -= XP_PER_LEVEL;
    rec.level += 1;
    const gains = { hp: rng() < 0.6 ? 2 : 1, power: 0, def: 0, spd: 0 };
    if (rng() < 0.45) gains.power = 1;
    if (rng() < 0.30) gains.def = 1;
    if (rng() < 0.40) gains.spd = 1;
    rec.maxHp += gains.hp;
    rec.hp += gains.hp;
    rec.power += gains.power;
    rec.def += gains.def;
    rec.spd += gains.spd;
    ups.push({ level: rec.level, gains });
  }
  if (rec.level >= MAX_LEVEL) rec.xp = 0;
  return ups;
}

export function moveInfo(id) {
  const charDef = CHARACTERS[id];
  const mv = charDef ? basicMove(charDef) : null;
  return { name: mv?.name || 'Strike', move: mv };
}
