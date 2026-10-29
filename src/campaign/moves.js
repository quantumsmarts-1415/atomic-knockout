// Campaign moves: every fighter's four fighting-game moves, turned into tactics actions.
//
//   basicDirectional  -> BASIC    attack, no cooldown, counters when attacked
//   basicCharge       -> CHARGE   takes the whole turn to charge, releases next turn at full power
//                                 (a zero-damage buff in the roster becomes a POWER UP instead)
//   specialDirectional-> SPECIAL  attack, every other turn (cooldown 2)
//   specialDefense    -> GUARD    no attack: shrugs off damage until the next turn
//
// Damage = the move's fighting-game damage % (resolveMoveDamage, defender-neutral) x DAMAGE_SCALE. The scale turns a
// 9% jab into 22 HP of damage so a fight with 60-100 HP units takes about 3-4 hits.
import { CHARACTERS } from '../data/characters.js';
import { MOVESETS } from '../data/movesets.js';
import { resolveMoveDamage } from '../data/balance.js';

export const DAMAGE_SCALE = 2.4;
export const DAMAGE_CAP = 60;            // one hit never exceeds this before defence
export const CHARGE_DEFAULT_MULT = 1.5;
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

/** Reach in tiles [min, max]. Shells need room, beams reach furthest, jabs are adjacent. */
export function rangeOf(mv, pct) {
  switch (mv.kind) {
    case 'projectile': return pct >= 10 ? [2, 2] : [1, 2];
    case 'beam': return [2, 3];
    case 'dash': return [1, 2];
    case 'zone': case 'mine': return [1, 2];
    case 'burst': return (mv.radius ?? 0) >= 80 ? [1, 2] : [1, 1];
    default: return isMelee(mv) && (mv.rangeW ?? 0) >= 100 ? [1, 2] : [1, 1];
  }
}

/** Gameplay effects of a move, as tactics-map effects (see status.js for how each one plays). */
export function effectsOf(mv, slot) {
  const out = [];
  const oh = mv.onHit || {};
  const stunMs = typeof oh.stun === 'number' ? oh.stun : 0;
  if (mv.stunChance || stunMs) out.push({ type: 'stun', chance: mv.stunChance ?? (stunMs >= 1000 ? 0.6 : 0.4) });
  const dot = (kind, spec) => {
    const dps = spec.dps ?? 1.5;
    const ms = spec.untilKo ? 4000 : (spec.ms ?? 3000);
    const turns = ms >= 3000 ? 3 : 2;
    out.push({ type: kind, turns, dmg: Math.max(2, Math.round(dps * (ms / 1000) * DAMAGE_SCALE * 0.5 / turns)) });
  };
  if (oh.burn) dot('burn', oh.burn);
  if (oh.poison) dot('poison', oh.poison);
  if (mv.igniteDamage) out.push({ type: 'burn', turns: 2, dmg: Math.max(2, Math.round(mv.igniteDamage * DAMAGE_SCALE * 0.25)) });
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
  else if (slot !== 'guard' && (mv.baseKnockback ?? 0) * (slot === 'charge' ? (mv.chargeKnockbackMult ?? 1) : 1) >= 200 && isMelee(mv)) out.push({ type: 'push' });
  if (mv.selfDamage?.damage) out.push({ type: 'recoil', dmg: Math.max(2, Math.round(mv.selfDamage.damage * DAMAGE_SCALE * 0.5)) });
  if (slot === 'guard') {
    if (mv.cleanse) out.push({ type: 'cleanse' });
    if (mv.regen || mv.regenEvery) out.push({ type: 'regen', frac: 0.1 });
    if (mv.counterDamage || mv.recoil) {
      const d = mv.counterDamage ?? mv.recoil?.damage ?? 4;
      out.push({ type: 'thorns', dmg: Math.max(3, Math.round(d * DAMAGE_SCALE * 0.5)) });
    }
  }
  return dedupe(out);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((e) => !seen.has(e.type) && seen.add(e.type));
}

function build(id, key, slot, mv, charDef) {
  const pct = resolveMoveDamage(mv, charDef, null).total;
  const base = { key, slot, name: mv.name || key, kind: mv.kind || 'melee', element: mv.type || 'kinetic', pct: Math.round(pct * 10) / 10, raw: mv };
  if (slot === 'guard') {
    const frac = GUARD_BY_KIND[mv.kind] ?? 0.4;
    return { ...base, action: 'guard', attack: false, dmg: 0, range: [0, 0], guard: frac, cd: 0, effects: effectsOf(mv, slot) };
  }
  if (slot === 'charge' && pct <= 0) {
    return { ...base, action: 'power', attack: false, dmg: 0, range: [0, 0], cd: 3, effects: [{ type: 'power', mult: POWER_UP_MULT, turns: 3 }] };
  }
  let useDmg = pct;
  if (slot === 'charge') useDmg = pct * (mv.chargeDamageMult ?? CHARGE_DEFAULT_MULT);
  if (slot === 'special' && pct <= 0) useDmg = 4;
  const dmg = clamp(Math.round(useDmg * DAMAGE_SCALE), 1, DAMAGE_CAP);
  return {
    ...base, action: 'attack', attack: true, dmg, charge: slot === 'charge', cd: slot === 'special' ? SPECIAL_COOLDOWN : 0,
    range: rangeOf(mv, pct), effects: effectsOf(mv, slot),
  };
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
    case 'burn': return `Burn: ${e.dmg} damage/turn for ${e.turns} turns`;
    case 'poison': return `Poison: ${e.dmg} damage/turn for ${e.turns} turns (cannot KO)`;
    case 'freeze': return 'Freeze: target moves 3 less next turn';
    case 'root': return 'Root: target cannot move next turn';
    case 'slow': return 'Slow: target moves 2 less next turn';
    case 'blind': return 'Blind: target hit chance -30% next turn';
    case 'vulnerable': return `Vulnerable: target takes +${Math.round((e.mult - 1) * 100)}% next hit`;
    case 'weaken': return `Corrode: target deals -${Math.round((1 - e.mult) * 100)}% next turn`;
    case 'interrupt': return 'Interrupts a charging target';
    case 'strip': return 'Strips guard and power-ups';
    case 'lifesteal': return `Heals you for ${Math.round(e.frac * 100)}% of damage`;
    case 'pull': return 'Pulls the target 1 tile closer';
    case 'push': return 'Knocks the target back 1 tile';
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
  if (m.action === 'guard') lines.push(`GUARD  takes -${Math.round(m.guard * 100)}% damage until your next turn`);
  else if (m.action === 'power') lines.push('POWER UP  (cooldown 3)');
  else {
    const r = m.range[0] === m.range[1] ? `${m.range[0]}` : `${m.range[0]}-${m.range[1]}`;
    lines.push(`${m.charge ? 'CHARGE' : m.slot === 'special' ? 'SPECIAL' : 'BASIC'}  dmg ${m.dmg} (${m.pct}%)  range ${r}`);
    if (m.charge) lines.push('Charges this turn; release next turn at full power, or cancel');
    if (m.slot === 'special') lines.push('Cooldown: every other turn');
  }
  for (const e of m.effects) lines.push(effectText(e));
  return lines;
}
