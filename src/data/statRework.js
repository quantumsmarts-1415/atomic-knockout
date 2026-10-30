// ---------------------------------------------------------------------------
// Stat rework (Benjamin, Oct 30 2026). One place for every number and formula
// of the rework, so the Smash Ring engine and the Campaign read the same rules.
// Source of truth: the "Stat Rework Rules" and "Benjamin's Stat Rework" tabs of the
// Balance Pass sheet; the per-fighter / per-move values live in statReworkData.js.
//
//   Weight + Speed        whole numbers 1-5, always summing to 6
//   Weight                knockback resistance 0.5 + W/4 (0.75-1.75), gravity scale 0.5 + W/5, Campaign HP 50 + 10 W
//   Speed                 walk speed 150 + 40 S, air jumps ceil(S/2), Campaign MOV floor(3 + S/2)
//   Jump height           constant 1.1 x Sully's 148 px; launch speed = sqrt(2 g h) so every fighter reaches it
//   Damage                base (Normal 10, Special 15, Charge 20, Defense 5) + Attack(type) - Defense(type)
//   Mixed type            the (Attack - Defense) bonus is averaged over the move's types; an immune type counts 0
//   Multi hit             base split evenly over the hits; the stat bonus lands on the LAST hit
//   Charge                3 s to full: 5% base, +1% every 0.2 s up to 20%; the stat bonus goes on top
//   Ghosts                +5 base on every move that deals damage; 1% self damage per second
// ---------------------------------------------------------------------------
import { REWORK_FIGHTERS, REWORK_MOVES } from './statReworkData.js';

export { REWORK_FIGHTERS, REWORK_MOVES };

export const TYPES = ['kinetic', 'heat', 'chemical', 'electrical', 'radiation'];

export const RW = Object.freeze({
  worldGravity: 1500,
  standingHeight: 148,                 // Sully, art.height
  jumpHeight: Math.round(1.1 * 148 * 10) / 10,   // 162.8 px
  airJumpMult: 0.92,
  baseDamage: Object.freeze({ normal: 10, special: 15, charge: 20, defense: 5 }),
  ghostBonus: 5,
  ghostDrainPct: 1,
  ghostDrainMs: 1000,
  // Charge
  chargeMs: 3000,
  chargeStartPct: 5,
  chargeStepPct: 1,
  chargeStepMs: 200,
  chargeMaxPct: 20,
  // Timing
  recoveryMs: 400,                     // global: no attack can start sooner after the last one ended
  hitstunMs: 250,                      // flat below the scaling threshold
  hitstunScaleFrom: 75,                // percent; from here hitstun grows with knockback, as before
  // Damage over time (no Attack/Defense)
  dotPct: 1,
  dotTickMs: 1000,
  burnMs: 8000,                        // Smash Ring burn: 8 s; poison lasts until healed
  campaignBurn: [3, 4],                // two turns, +1 each turn
  campaignPoison: 3,                   // per turn until healed
  // Healing
  healFloorFrac: 0.5,                  // can only heal down to half of the highest percent reached this stock
  // Sleep
  sleepRingMs: [2000, 5000],
  sleepTurns: [1, 3],
  // Knockback in Campaign
  pushTiles: 1,
  blockedPushDamage: 2,
  // Crit and miss
  critMult: 2,
  critMiss: Object.freeze({ normal: 5, special: 15, charge: 10, defense: 5 }),   // crit% == miss%
  skillStart: 1,
  skillMax: 10,
  skillPerPoint: 1,                    // +1% hit and +1% crit per Skill point
  skillChance: 0.25,
  statCap: 10,
  // Campaign movement and HP
  campaignHpBase: 50,
  campaignHpPerWeight: 10,
});

export const SLOT_OF_KEY = Object.freeze({
  basicDirectional: 'normal',
  specialDirectional: 'special',
  basicCharge: 'charge',
  specialDefense: 'defense',
});
export const KEY_OF_SLOT = Object.freeze({
  normal: 'basicDirectional', special: 'specialDirectional', charge: 'basicCharge', defense: 'specialDefense',
});

// ---- derived core stats ----------------------------------------------------
export const knockbackResistance = (w) => 0.5 + w / 4;
export const gravityScaleOf = (w) => 0.5 + w / 5;
export const walkSpeedOf = (s) => 150 + 40 * s;
export const airJumpsOf = (s) => Math.ceil(s / 2);
export const campaignHpOf = (w) => RW.campaignHpBase + RW.campaignHpPerWeight * w;
export const campaignMovOf = (s) => Math.floor(3 + s / 2);
/** Ground jump launch speed (px/s) that reaches the constant jump height under this weight's gravity. */
export function jumpLaunchOf(w) {
  const g = RW.worldGravity * gravityScaleOf(w);
  return Math.sqrt(2 * g * RW.jumpHeight);
}

export function fighterRework(id) {
  return REWORK_FIGHTERS[id] || null;
}

export function moveRework(id, key) {
  return REWORK_MOVES[id]?.[key] || null;
}

/** The fighter's Attack (side 'atk') or Defense ('def') number for a type, or null when N/A (noble gas chemical). */
export function typeStat(id, side, type) {
  const f = REWORK_FIGHTERS[id];
  if (!f) return 0;
  const v = f[side]?.[canonical(type)];
  return v == null ? null : v;
}

export function canonical(type) {
  return type === 'physical' ? 'kinetic' : type;
}

/** True when the defender cannot be hurt by this type at all (a noble gas against chemical). */
export function isImmuneType(defId, type) {
  const f = REWORK_FIGHTERS[defId];
  return !!f && f.def[canonical(type)] == null;
}

// ---- damage ----------------------------------------------------------------
/** Base percent of a slot for a given attacker (ghosts add +5 on any move that deals damage). */
export function baseOf(slot, { ghost = false, charge = null } = {}) {
  let base = RW.baseDamage[slot] ?? 0;
  if (slot === 'charge' && charge != null) base = charge;
  if (ghost && base > 0) base += RW.ghostBonus;
  return base;
}

/** Charge ramp: 5% at 0 s, +1% every 0.2 s, 20% at 3 s. */
export function chargeBase(heldMs) {
  const steps = Math.min(15, Math.max(0, Math.floor(heldMs / RW.chargeStepMs)));
  return RW.chargeStartPct + steps * RW.chargeStepPct;
}

/**
 * The stat bonus of a move: the average of (Attack - Defense) over its types.
 * An immune type counts as zero in the average. Returns null when EVERY type is immune
 * (the move then deals no damage at all).
 */
export function statBonus(atkId, defId, types) {
  const list = [...new Set((types || []).map(canonical))];
  if (!list.length) return 0;
  const f = REWORK_FIGHTERS[defId];
  if (f && list.every((t) => f.def[t] == null)) return null;
  let sum = 0;
  for (const t of list) {
    if (f && f.def[t] == null) continue;           // immune: zero
    const a = typeStat(atkId, 'atk', t) ?? 0;      // a noble gas has no chemical attack
    const d = f ? f.def[t] : 0;
    sum += a - d;
  }
  return sum / list.length;
}

/**
 * Damage of one hit. `hits` = how many hits the move lands per use, `n` = which hit this is (1-based).
 * The base is split evenly; the stat bonus is added on the last hit only.
 */
export function hitDamage({ base, bonus, hits = 1, n = 1 }) {
  if (bonus == null) return 0;
  const h = Math.max(1, hits);
  const share = base / h;
  return Math.max(0, share + (n >= h ? bonus : 0));
}

/** Whole move in one number (all hits landed): base + bonus, never below 0. */
export function moveDamage(base, bonus) {
  if (bonus == null) return 0;
  return Math.max(0, base + bonus);
}

// ---- timing ----------------------------------------------------------------
/** Hitstun in ms: flat 0.25 s below 75% damage; from 75% it grows with knockback (`scaledMs`, today's formula). */
export function hitstunMsFor(percent, scaledMs) {
  if (percent < RW.hitstunScaleFrom) return RW.hitstunMs;
  return Math.max(RW.hitstunMs, scaledMs);
}

// ---- healing ---------------------------------------------------------------
/** Lowest percent a heal can bring a fighter to: half of the highest percent reached this stock. */
export function healFloor(peakPercent) {
  return peakPercent * RW.healFloorFrac;
}

// ---- Campaign crit / miss / skill -----------------------------------------
/**
 * One roll, three exclusive results. `crit` and `miss` are percents (crit never misses).
 * Skill adds +1% hit (miss down) and +1% crit per point.
 * Returns { miss, hit, crit } percents that sum to 100.
 */
export function rollTable({ slot = 'normal', skill = 1, avoid = 0, crit = null, miss = null }) {
  const base = RW.critMiss[slot] ?? 5;
  const c0 = crit ?? base;
  const m0 = miss ?? base;
  let c = c0 + skill * RW.skillPerPoint;
  let m = m0 - skill * RW.skillPerPoint + avoid;
  c = Math.max(0, Math.min(100, c));
  m = Math.max(0, Math.min(100 - c, m));
  return { miss: m, crit: c, hit: 100 - m - c };
}

export function rollOutcome(table, roll01) {
  const r = roll01 * 100;
  if (r < table.miss) return 'miss';
  if (r < table.miss + table.crit) return 'crit';
  return 'hit';
}
