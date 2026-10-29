// Turn an Atomic Knockout fighter into tactics-map stats.
//
//   HP    60-100 by weight and kinetic defense (heavier elements are tougher); the lord gets +10
//   Dmg   a flat bonus added to every hit: 0 at level 1, +1 for every second level gained
//   Def   1 + weight*2                              (flat reduction per hit, modest next to ~20 damage hits)
//   Spd   3 + (walk speed - 175)/285 * 10           (hit/avoid, double attacks)
//   Mov   4 / 5 / 6 by walk speed
//   Range the union of the fighter's attack moves (src/campaign/moves.js)
//
// Attack damage itself comes from the fighting-game move data (damage % x DAMAGE_SCALE); the move's element still
// matters: the real balance table scales it against the defender (see combat.js elementMult).
import { CHARACTERS } from '../data/characters.js';
import { MOVESETS } from '../data/movesets.js';
import { basicOf, unionRange } from './moves.js';

export const MAX_LEVEL = 20;
export const XP_PER_LEVEL = 100;
export const RECORD_VERSION = 2;
export const HP_PER_LEVEL = 4;           // average; level-ups roll 3 or 5
export const LORD_HP = 10;

export function basicMove(charDef) {
  return MOVESETS[charDef.id]?.basicDirectional || charDef.moves?.basicDirectional || null;
}

export function baseStats(charDef) {
  const c = charDef.combat || {};
  const weight = c.weight ?? 1;
  const speed = c.speed ?? 300;
  const t = Math.max(0, Math.min(1, (weight - 0.58) / 0.9));
  const maxHp = Math.round(Math.max(60, Math.min(100, 60 + 30 * t + 40 * Math.max(0, c.kineticDef || 0))));
  return {
    maxHp,
    power: 0,
    def: Math.round(1 + weight * 2),
    spd: Math.round(3 + ((speed - 175) / 285) * 10),
    mov: speed < 260 ? 4 : speed < 350 ? 5 : 6,
    range: unionRange(charDef.id),
  };
}

/** A fresh unit record at `level` (growth applied as the average per level). */
export function makeRecord(id, level = 1, { lord = false } = {}) {
  const charDef = CHARACTERS[id];
  if (!charDef) throw new Error(`unknown fighter ${id}`);
  const b = baseStats(charDef);
  const n = Math.max(0, level - 1);
  if (lord) { b.maxHp += LORD_HP; b.def += 1; } // the lord is sturdier than the fighter alone
  const hp = b.maxHp + HP_PER_LEVEL * n;
  return {
    v: RECORD_VERSION,
    id,
    level,
    xp: 0,
    lord,
    maxHp: hp,
    hp,
    power: Math.floor(n / 2),
    def: b.def + Math.round(0.3 * n),
    spd: b.spd + Math.round(0.4 * n),
    mov: b.mov,
    range: b.range,
  };
}

/** Older saves (before moves and 60-100 HP): rebuild the stats for the saved level, keep level, xp and lord. */
export function upgradeRecord(rec) {
  if (rec.v >= RECORD_VERSION) return rec;
  const fresh = makeRecord(rec.id, rec.level || 1, { lord: !!rec.lord });
  fresh.xp = rec.xp || 0;
  return fresh;
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
    const gains = { hp: rng() < 0.5 ? 3 : 5, power: rec.level % 2 === 0 ? 1 : 0, def: 0, spd: 0 };
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
  const mv = basicOf(id);
  return { name: mv?.name || 'Strike', move: mv };
}
