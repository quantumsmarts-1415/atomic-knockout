// Campaign moves: every fighter's four fighting-game moves, turned into tactics actions (stat rework, Oct 2026).
//
//   basicDirectional  -> BASIC    attack, counters when attacked
//   basicCharge       -> CHARGE   takes the whole turn to charge, releases next turn at full power
//                                 (a move with no damaging hits on the sheet becomes a POWER UP instead)
//   specialDirectional-> SPECIAL  attack, every other turn (cooldown 2)
//   specialDefense    -> GUARD    no attack: shrugs off damage until the next turn
//
// Damage is flat HP, the same numbers as the Smash Ring percent: base by slot (Normal 10, Special 15, Charge 20,
// Defense 5, ghosts +3) plus the average (Attack - Defense) over the move's types, split over its hits with the bonus
// on the last one (see combat.js). Range, hits and the number of uses per map come from the rework sheet
// (src/data/statReworkData.js); a move with the sheet's `heal` flag is a healing move.
import { CHARACTERS } from '../data/characters.js';
import { MOVESETS } from '../data/movesets.js';
import { canonicalType } from '../data/balance.js';
import { RW, REWORK_SLOT_OF_CAMPAIGN, baseOf, canonical, moveRework } from '../data/statRework.js';

export const SPECIAL_COOLDOWN = 2;       // turns: usable, rests one turn, usable again
export const POWER_UP_MULT = 1.35;

const SLOTS = [
  ['basicDirectional', 'basic'],
  ['basicCharge', 'charge'],
  ['specialDirectional', 'special'],
  ['specialDefense', 'guard'],
];

const GUARD_BY_KIND = { block: 0.5, wall: 0.5, shield: 0.6, counter: 0.35, oxide: 0.5 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isMelee = (mv) => !mv.kind || mv.kind === 'melee';

/** Gameplay effects of a move, as tactics-map effects (see status.js for how each one plays). */
export function effectsOf(mv, slot) {
  const out = [];
  const oh = mv.onHit || {};
  const stunMs = typeof oh.stun === 'number' ? oh.stun : 0;
  if (mv.stunChance || stunMs) out.push({ type: 'stun', chance: mv.stunChance ?? (stunMs >= 1000 ? 0.6 : 0.4) });
  // Stat rework: burn lasts 2 turns (3 then 4 damage), poison does 3 a turn until the target is healed; neither stacks on itself.
  if (oh.burn || mv.igniteDamage) out.push({ type: 'burn', turns: RW.campaignBurn.length, dmgs: RW.campaignBurn });
  if (oh.poison) out.push({ type: 'poison', turns: Infinity, dmg: RW.campaignPoison });
  if (oh.sleep || mv.retort?.sleep) out.push({ type: 'sleep', min: RW.sleepTurns[0], max: RW.sleepTurns[1] });
  if (oh.freeze) out.push({ type: 'freeze', turns: 1 });
  else if (oh.root) out.push({ type: 'root', turns: 1 });
  else if (oh.slow || oh.slowHit || mv.slowHit || oh.attackSlow) out.push({ type: 'slow', turns: 1 });
  if (oh.blind || oh.dazzle) out.push({ type: 'blind', turns: 1 });
  if (oh.vulnerable || mv.markMult || oh.mark) out.push({ type: 'vulnerable', turns: 1, mult: 1.3 });
  if (oh.corrode) out.push({ type: 'weaken', turns: 1, mult: 0.75 });
  if (oh.interrupt) out.push({ type: 'interrupt' });
  if (oh.strip || mv.stripBuffs) out.push({ type: 'strip' });
  if (oh.heal || mv.drain || mv.chargeHeal) out.push({ type: 'lifesteal', frac: 0.3 });
  if (mv.pull || mv.yank) out.push({ type: 'pull' });
  else if (slot !== 'guard' && (((mv.baseKnockback ?? 0) * (slot === 'charge' ? (mv.chargeKnockbackMult ?? 1) : 1)) >= 200 || (mv.knockbackGrowth ?? 0) > 6.5)) out.push({ type: 'push' });
  if (mv.selfDamage?.damage) out.push({ type: 'recoil', dmg: Math.max(2, Math.round(mv.selfDamage.damage * 0.9)) });
  if (slot === 'guard') {
    if (mv.cleanse) out.push({ type: 'cleanse' });
    if (mv.retort?.sleep) out.push({ type: 'sleepback' });
    if (mv.regen || mv.regenEvery) out.push({ type: 'regen', frac: 0.1 });
    if (mv.counterDamage || mv.recoil) {
      const d = mv.counterDamage ?? mv.recoil?.damage ?? 4;
      out.push({ type: 'thorns', dmg: Math.max(3, Math.round(d * 0.9)) });
    }
  }
  return dedupe(out);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((e) => !seen.has(e.type) && seen.add(e.type));
}

/** Damage types a move deals in (kinetic spelled the new way). */
function typesOf(mv) {
  const out = [];
  const add = (type, amount) => { if (type && amount > 0) out.push(canonical(canonicalType(type))); };
  add(mv.type, mv.damage);
  add(mv.type2, mv.damage2);
  add(mv.type3, mv.damage3);
  if (Array.isArray(mv.hits)) for (const h of mv.hits) add(h.type, h.damage);
  return [...new Set(out)];
}

function build(id, key, slot, mv, charDef) {
  const row = moveRework(id, key) || { hits: 1, range: 1, uses: 4, cd: 1 };
  const types = typesOf(mv);
  const rwSlot = REWORK_SLOT_OF_CAMPAIGN[slot];
  const dealsDamage = row.hits > 0 && types.length > 0;
  const hits = dealsDamage ? row.hits : 0;
  const base = dealsDamage ? baseOf(rwSlot, { ghost: !!charDef?.ghost }) : 0;
  const reach = Math.max(1, row.range || 1);
  const range = [1, reach];
  const uses = Math.max(1, row.uses || 1);
  const common = { key, slot, name: mv.name || key, kind: mv.kind || 'melee', element: types[0] || canonical(canonicalType(mv.type || 'kinetic')), types, hits, base, pct: base, uses, raw: mv };
  if (slot === 'guard') {
    const frac = GUARD_BY_KIND[mv.kind] ?? 0.4;
    return { ...common, action: 'guard', attack: false, dmg: 0, range: [0, 0], guard: frac, cd: 0, effects: effectsOf(mv, slot) };
  }
  if (slot === 'charge' && !dealsDamage) {
    return { ...common, action: 'power', attack: false, dmg: 0, range: [0, 0], cd: 3, effects: [{ type: 'power', mult: POWER_UP_MULT, turns: 3 }] };
  }
  return {
    ...common, action: 'attack', attack: true, dmg: base, charge: slot === 'charge', cd: slot === 'special' ? SPECIAL_COOLDOWN : 0,
    range, effects: effectsOf(mv, slot),
  };
}

// Healers: these fighters get a fifth action, HEAL, on a wounded ally 1-2 tiles away. It takes the turn like a guard.
// To change who heals, edit this table (name = the action's name; the FX art comes from the fighter's guard move).
export const HEALERS = {
  helen: 'Soothing Breeze',
  oxana: 'Breath of Life',
  iona: 'Antiseptic Mist',
  lana: 'Restoring Glow',
};
export const HEAL_FRAC = 0.3;     // of the ally's max HP
export const HEAL_MIN = 12;
export const HEAL_RANGE = [1, 2];

export function isHealer(id) { return Object.prototype.hasOwnProperty.call(HEALERS, id); }

/** How much a heal restores `target` (never more than the missing HP). */
export function healAmount(target) {
  const missing = Math.max(target.worstMissing ?? 0, target.maxHp - target.hp);
  const cap = target.maxHp - Math.floor(missing * RW.healFloorFrac);   // never heal above max HP minus half the worst damage taken
  return Math.max(0, Math.min(cap - target.hp, target.maxHp - target.hp, Math.max(HEAL_MIN, Math.round(target.maxHp * HEAL_FRAC))));
}

const healCache = new Map();
/** The healer's HEAL move, or null for everyone else. */
export function healMoveOf(id) {
  if (!isHealer(id)) return null;
  if (!healCache.has(id)) {
    const guard = campaignMoves(id).find((m) => m.action === 'guard') || null;
    healCache.set(id, {
      key: 'heal', slot: 'heal', name: HEALERS[id], kind: 'heal', element: 'kinetic', pct: 0, raw: {},
      action: 'heal', attack: false, dmg: 0, range: HEAL_RANGE, cd: 0, effects: [], frac: HEAL_FRAC, min: HEAL_MIN, fxFrom: guard,
    });
  }
  return healCache.get(id);
}

const cache = new Map();

/** The unit's four campaign moves in menu order (basic, charge, special, guard). */
export function campaignMoves(id) {
  if (cache.has(id)) return cache.get(id);
  const charDef = CHARACTERS[id];
  const set = MOVESETS[id] || charDef?.moves || {};
  const out = [];
  for (const [key, slot] of SLOTS) if (set[key]) out.push(build(id, key, slot, set[key], charDef));
  cache.set(id, out);
  return out;
}

export function moveByKey(id, key) {
  return campaignMoves(id).find((m) => m.key === key) || null;
}

export function basicOf(id) {
  return moveByKey(id, 'basicDirectional');
}

/** Union of the attack ranges: what the map shows as the unit's threat reach. */
export function unionRange(id) {
  const atk = campaignMoves(id).filter((m) => m.attack);
  if (!atk.length) return [1, 1];
  return [Math.min(...atk.map((m) => m.range[0])), Math.max(...atk.map((m) => m.range[1]))];
}

/** One-line description of an effect for move info. */
export function effectText(e) {
  switch (e.type) {
    case 'stun': return `Stun ${Math.round(e.chance * 100)}%: target skips its next turn`;
    case 'burn': return `Burn: ${e.dmgs.join(' then ')} damage over ${e.turns} turns (does not stack)`;
    case 'poison': return `Poison: ${e.dmg} damage/turn until healed (cannot KO, does not stack)`;
    case 'sleep': return `Sleep: target skips ${e.min}-${e.max} turns; damage wakes it`;
    case 'sleepback': return 'Attackers fall asleep';
    case 'freeze': return 'Freeze: target moves 3 less next turn';
    case 'root': return 'Root: target cannot move next turn';
    case 'slow': return 'Slow: target moves 2 less next turn';
    case 'blind': return 'Blind: target hit chance -30% on its next turn';
    case 'vulnerable': return `Vulnerable: target takes +${Math.round((e.mult - 1) * 100)}% damage until its next turn ends`;
    case 'weaken': return `Corrode: target deals -${Math.round((1 - e.mult) * 100)}% next turn`;
    case 'interrupt': return 'Interrupts a charging target';
    case 'strip': return 'Strips the target\'s guard and power-ups';
    case 'lifesteal': return `Heals you for ${Math.round(e.frac * 100)}% of damage`;
    case 'pull': return 'Pulls the target 1 tile closer';
    case 'push': return 'Knocks the target back 1 tile (blocked: 2 damage instead)';
    case 'recoil': return `Recoil: you take ${e.dmg}`;
    case 'cleanse': return 'Cleanses your status effects';
    case 'regen': return `Regenerate ${Math.round(e.frac * 100)}% max HP next turn`;
    case 'thorns': return `Attackers take ${e.dmg} damage`;
    case 'power': return `Power up: +${Math.round((e.mult - 1) * 100)}% damage for ${e.turns - 1} turns`;
    default: return e.type;
  }
}

/** Menu / info text for a move. */
export function describeMove(m) {
  const lines = [];
  if (m.action === 'heal') lines.push(`HEAL  restores ${Math.round(m.frac * 100)}% of an ally's max HP (at least ${m.min})`, `range ${m.range[0]}-${m.range[1]}, allies only; the whole action. Healing earns EXP.`);
  else if (m.action === 'guard') lines.push(`GUARD  takes -${Math.round(m.guard * 100)}% damage until your next turn`);
  else if (m.action === 'power') lines.push('POWER UP  (cooldown 3)');
  else {
    const r = m.range[0] === m.range[1] ? `${m.range[0]}` : `${m.range[0]}-${m.range[1]}`;
    const hitsTxt = m.hits > 1 ? ` x${m.hits} hits` : '';
    lines.push(`${m.charge ? 'CHARGE' : m.slot === 'special' ? 'SPECIAL' : 'BASIC'}  base ${m.base}${hitsTxt} + stat bonus  range ${r}  uses ${m.uses}`);
    if (m.charge) lines.push('Charges this turn; release next turn at full power, or cancel');
    if (m.slot === 'special') lines.push('Cooldown: every other turn');
  }
  for (const e of m.effects) lines.push(effectText(e));
  return lines;
}
