// Turn an Atomic Knockout fighter into tactics-map stats (stat rework, Oct 2026).
//
//   HP     50 + 10 x Weight (60 to 100); the lord gets +10. A level-up adds Weight more HP.
//   MOV    floor(3 + Speed / 2) tiles. Speed (SPD, 1-5) only sets travel distance: no hit, crit, dodge or double attacks.
//   Atk/Def  the fighter's ten type numbers from the rework sheet (Attack and Defense per damage type, cap 10 here).
//            Damage = move base + the average (Attack - Defense) over the move's types, flat (see combat.js).
//   Skill  starts at 1 (lord 2), max 10: +1% hit and +1% crit per point. A level-up has a 25% chance to add one.
//   Level-up  +Weight HP, +1 to ONE Attack/Defense stat (chosen by weight: stats the fighter leans toward come up more
//            often, cap 10), 25% chance of +1 Skill. Level cap 20, 100 XP per level.
//   Range  the union of the fighter's attack moves (src/campaign/moves.js)
import { CHARACTERS } from '../data/characters.js';
import { MOVESETS } from '../data/movesets.js';
import { basicOf, unionRange } from './moves.js';
import { RW, TYPES, campaignHpOf, campaignMovOf } from '../data/statRework.js';
import { mulberry32 } from '../engine/rng.js';

export const MAX_LEVEL = 20;
export const XP_PER_LEVEL = 100;
export const RECORD_VERSION = 3;
export const LORD_HP = 10;
export const LORD_SKILL = 1;

export function basicMove(charDef) {
  return MOVESETS[charDef.id]?.basicDirectional || charDef.moves?.basicDirectional || null;
}

const copyTable = (t) => ({ ...t });

export function baseStats(charDef) {
  const rw = charDef.rework || { w: 3, s: 3, atk: {}, def: {} };
  return {
    maxHp: campaignHpOf(rw.w),
    weight: rw.w,
    spd: rw.s,
    mov: campaignMovOf(rw.s),
    skill: RW.skillStart,
    atk: copyTable(rw.atk),
    dst: copyTable(rw.def),
    range: unionRange(charDef.id),
  };
}

/**
 * One level-up, applied to `rec` (mutates). Returns what grew: { hp, stat: { side, type } | null, skill }.
 * `side` is 'atk' or 'dst'. Stats that are N/A / immune (a noble gas's chemical) never grow; a stat at the cap is skipped.
 */
export function levelUp(rec, rng = Math.random) {
  const gains = { hp: rec.weight ?? 3, stat: null, skill: 0 };
  rec.maxHp += gains.hp;
  rec.hp += gains.hp;
  const pool = [];
  for (const [side, table] of [['atk', rec.atk], ['dst', rec.dst]]) {
    if (!table) continue;
    for (const type of TYPES) {
      const v = table[type];
      if (v == null || v >= RW.statCap) continue;
      pool.push({ side, type, w: v + 1 });      // leanings: the higher the stat, the likelier it comes up again
    }
  }
  if (pool.length) {
    let roll = rng() * pool.reduce((t, e) => t + e.w, 0);
    let pick = pool[pool.length - 1];
    for (const e of pool) { roll -= e.w; if (roll < 0) { pick = e; break; } }
    rec[pick.side][pick.type] += 1;
    gains.stat = { side: pick.side, type: pick.type };
  }
  if ((rec.skill ?? 1) < RW.skillMax && rng() < RW.skillChance) {
    rec.skill = (rec.skill ?? 1) + 1;
    gains.skill = 1;
  }
  return gains;
}

/** A fresh unit record at `level` (its level-ups are rolled from a seed built from the fighter and level, so it is stable). */
export function makeRecord(id, level = 1, { lord = false } = {}) {
  const charDef = CHARACTERS[id];
  if (!charDef) throw new Error(`unknown fighter ${id}`);
  const b = baseStats(charDef);
  if (lord) { b.maxHp += LORD_HP; b.skill = Math.min(RW.skillMax, b.skill + LORD_SKILL); } // the lord is sturdier than the fighter alone
  const rec = {
    v: RECORD_VERSION,
    id,
    level: 1,
    xp: 0,
    lord,
    maxHp: b.maxHp,
    hp: b.maxHp,
    weight: b.weight,
    spd: b.spd,
    mov: b.mov,
    skill: b.skill,
    atk: b.atk,
    dst: b.dst,
    range: b.range,
  };
  let seed = 2166136261;
  for (const ch of `${id}:${level}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rng = mulberry32(seed);
  for (let l = 2; l <= level; l++) { rec.level = l; levelUp(rec, rng); }
  rec.level = Math.max(1, level);
  return rec;
}

/** Older saves (before the stat rework): rebuild the stats for the saved level, keep level, xp and lord. */
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
    ups.push({ level: rec.level, gains: levelUp(rec, rng) });
  }
  if (rec.level >= MAX_LEVEL) rec.xp = 0;
  return ups;
}

export function moveInfo(id) {
  const mv = basicOf(id);
  return { name: mv?.name || 'Strike', move: mv };
}
