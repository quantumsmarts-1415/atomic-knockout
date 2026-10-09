// ---------------------------------------------------------------------------
// Balance — every combat tuning constant and the formulas that turn an
// element's real-world numbers into modifiers on a shared base.
//
// A modifier of 0 means "no change". Gases, liquids and missing kinetic
// data are 0. Final stats are `base * (1 + modifier)` for movement and
// outgoing damage, and `incoming * (1 - modifier)` for defenses that reduce
// damage (a negative defense modifier increases damage taken).
//
// Raw inputs span orders of magnitude (density 0.00009–22 g/cm³,
// conductivity 0–63 MS/m), so the curves are logarithmic and clamped.
// Change TUNING, not the call sites. See docs/balance.md.
// ---------------------------------------------------------------------------

export const TUNING = {
  // Movement. Density (log, gases and solids on separate stretches) shifts
  // these. t = 0 is the lightest gas, t = 1 is osmium-dense.
  baseSpeed: 310,          // px/s
  speedSpan: 0.36,         // lightest +36%, densest -36%
  baseJump: 680,           // px/s upward
  jumpSpan: 0.28,
  baseWeight: 1,
  weightSpan: 0.38,        // denser = heavier = less knockback / shorter flight
  gravityLight: 0.76,      // gravityScale at t = 0
  gravityHeavy: 1.14,      // gravityScale at t = 1
  speedClamp: [175, 460],
  jumpClamp: [460, 940],
  weightClamp: [0.58, 1.48],

  // Density normalization anchors (g/cm³).
  gasDensityLo: 0.00008,
  gasDensityHi: 0.02,      // gases occupy t in [0, gasTHi]
  gasTHi: 0.25,
  solidDensityLo: 0.4,
  solidDensityHi: 22.6,    // osmium
  solidTLo: 0.30,

  // Kinetic attack from Mohs hardness. 0 Mohs → modifier 0.
  // Mohs 10 (diamond) → +mohsMax.
  mohsMax: 0.50,

  // Kinetic defense from ultimate tensile strength (MPa), log scaled.
  // 0 MPa → modifier 0. tensileRef is the "very strong metal" anchor.
  tensileRef: 1200,
  tensileMax: 0.42,

  // Heat defense from boiling point (K), log distance from heatRefK.
  // Below the reference (cold gases) take MORE heat damage.
  heatRefK: 500,
  heatLogSpan: 2.2,
  heatDefClamp: [-0.32, 0.42],

  // Electrical attack grows with log conductivity. 0 S → modifier 0.
  // 63 MS/m (silver) is the top of the measured table.
  condAttackRef: 63,
  elecAtkMax: 0.40,

  // Electrical damage TAKEN is a bell on log10(conductivity).
  // Mid-range conductivity takes the most; both extremes take less.
  // Explicit 0 (insulator / gas) sits on the low tail, not at "missing".
  elecMidLog: 0.45,        // ~2.8 MS/m
  elecSigma: 0.95,
  elecResist: 0.28,        // extremes: take 28% less than base
  elecVuln: 0.20,          // peak: take 20% more than base
  condFloor: 1e-5,         // log stand-in for a true insulator
  elecTakenClamp: [0.55, 1.35],

  // Radiation defense = density position t * radMax. Missing density → 0.
  radMax: 0.38,

  // Chemical damage scales with |EN_attacker − EN_defender|.
  // Difference 0 → modifier 0 (base damage). Noble gases take none.
  chemPerEn: 0.16,
  chemClamp: [0, 1.85],

  // Global safety clamps so a future element can't delete or one-shot.
  incomingClamp: [0.22, 1.75],

  // Launch speed multiplier. Weight order is unchanged; this only shortens
  // the flight so a light gas is not stocked at low percent.
  knockbackScale: 0.72,

  // A blast that includes its owner (Lake Drop) is not a designed self-cost.
  // It still knocks her back, at this fraction, so the move stays risky.
  // Explicit isSelf moves (Supernova) keep full damage and no knockback.
  selfDamageMult: 0.75,
  selfKnockbackScale: 0.40,
};

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** 0 = lightest gas, 1 = densest metal. null when density is missing. */
export function densityT(density) {
  if (!(density > 0)) return null;
  const T = TUNING;
  if (density < T.gasDensityHi) {
    const u = (Math.log10(density) - Math.log10(T.gasDensityLo))
      / (Math.log10(T.gasDensityHi) - Math.log10(T.gasDensityLo));
    return clamp(u, 0, 1) * T.gasTHi;
  }
  const u = (Math.log10(density) - Math.log10(T.solidDensityLo))
    / (Math.log10(T.solidDensityHi) - Math.log10(T.solidDensityLo));
  return T.solidTLo + clamp(u, 0, 1) * (1 - T.solidTLo);
}

function around(base, span, t) {
  // t 0 → base * (1 + span), t 0.5 → base, t 1 → base * (1 - span)
  return base * (1 + span * (1 - 2 * t));
}

/** Log-bell in [0, 1], peaking at elecMidLog. */
export function electricalBell(conductivity) {
  const T = TUNING;
  const c = conductivity > 0 ? conductivity : T.condFloor;
  const x = Math.log10(c);
  const z = (x - T.elecMidLog) / T.elecSigma;
  return Math.exp(-0.5 * z * z);
}

/** Multiplier on electrical damage taken. 1 = no modifier. */
export function electricalTakenMult(conductivity) {
  if (conductivity == null) return 1; // missing data: no modifier
  const T = TUNING;
  const bell = electricalBell(conductivity);
  const mult = 1 - T.elecResist + (T.elecResist + T.elecVuln) * bell;
  return clamp(mult, T.elecTakenClamp[0], T.elecTakenClamp[1]);
}

export function canonicalType(type) {
  if (type === 'physical') return 'kinetic';
  return type;
}

/**
 * Build the combat profile for one element record
 * `{ density, mohs, tensile, boiling, conductivity, en, noble, state, family, metal }`.
 * conductivity / en / density may be null when the value is unpublished.
 * conductivity 0 is a real insulator (bell-curve tail), not "missing".
 */
export function deriveProfile(el) {
  const T = TUNING;
  const t = densityT(el.density);
  const neutralMove = {
    speed: T.baseSpeed,
    jumpVelocity: T.baseJump,
    weight: T.baseWeight,
    gravityScale: 1,
  };
  const move = t == null ? neutralMove : {
    speed: clamp(around(T.baseSpeed, T.speedSpan, t), T.speedClamp[0], T.speedClamp[1]),
    jumpVelocity: clamp(around(T.baseJump, T.jumpSpan, t), T.jumpClamp[0], T.jumpClamp[1]),
    // Inverse of speed: t = 0 is light, t = 1 is heavy.
    weight: clamp(T.baseWeight * (1 + T.weightSpan * (2 * t - 1)), T.weightClamp[0], T.weightClamp[1]),
    gravityScale: clamp(T.gravityLight + t * (T.gravityHeavy - T.gravityLight), 0.7, 1.2),
  };

  const mohs = el.mohs > 0 ? el.mohs : 0;
  const tensile = el.tensile > 0 ? el.tensile : 0;
  const kineticAtk = mohs <= 0 ? 0 : (mohs / 10) * T.mohsMax;
  const kineticDef = tensile <= 0 ? 0
    : (Math.log10(1 + tensile) / Math.log10(1 + T.tensileRef)) * T.tensileMax;

  let heatDef = 0;
  if (el.boiling > 0) {
    heatDef = (Math.log10(el.boiling) - Math.log10(T.heatRefK)) / T.heatLogSpan;
    heatDef = clamp(heatDef, T.heatDefClamp[0], T.heatDefClamp[1]);
  }

  const elecAtk = !(el.conductivity > 0) ? 0
    : (Math.log10(1 + el.conductivity) / Math.log10(1 + T.condAttackRef)) * T.elecAtkMax;

  return {
    ...move,
    densityT: t,
    kineticAtk,
    kineticDef,
    heatDef,
    elecAtk,
    elecTaken: electricalTakenMult(el.conductivity),
    radDef: t == null ? 0 : t * T.radMax,
    en: el.en == null ? null : el.en,
    noble: !!el.noble,
    metal: !!el.metal,
    family: el.family ?? null,
    state: el.state ?? null,
  };
}

function outgoingMult(type, combat) {
  if (!combat) return 1;
  type = canonicalType(type);
  if (type === 'kinetic') return 1 + (combat.kineticAtk || 0);
  if (type === 'electrical') return 1 + (combat.elecAtk || 0);
  return 1;
}

function incomingMult(type, atk, def) {
  if (!def) return 1;
  const T = TUNING;
  type = canonicalType(type);
  let mult = 1;
  if (type === 'kinetic') mult = 1 - (def.kineticDef || 0);
  else if (type === 'heat') mult = 1 - (def.heatDef || 0);
  else if (type === 'electrical') mult = def.elecTaken ?? 1;
  else if (type === 'radiation') mult = 1 - (def.radDef || 0);
  else if (type === 'chemical') {
    if (def.noble) return 0;
    if (atk?.en == null || def.en == null) return 1;
    mult = 1 + T.chemPerEn * Math.abs(atk.en - def.en);
    return clamp(mult, T.chemClamp[0], T.chemClamp[1]);
  }
  return clamp(mult, T.incomingClamp[0], T.incomingClamp[1]);
}

/**
 * One damage packet after attacker and defender modifiers.
 * `opts.kinDefMult` is a runtime corrosion debuff (1 = none).
 * `opts.heatTakenMult` stacks on top (Unquenchable and similar).
 */
export function resolvePacket(amount, type, atkCombat, defCombat, opts = {}) {
  if (!(amount > 0)) return 0;
  let dmg = amount * outgoingMult(type, atkCombat);
  if (opts.ignoreDefense) return dmg < 0 ? 0 : dmg;
  let mult = incomingMult(type, atkCombat, defCombat);
  if (canonicalType(type) === 'kinetic' && opts.kinDefMult != null) mult *= opts.kinDefMult;
  if (canonicalType(type) === 'kinetic' && opts.kineticTakenMult != null) mult *= opts.kineticTakenMult;
  if (canonicalType(type) === 'heat' && opts.heatTakenMult != null) mult *= opts.heatTakenMult;
  if (canonicalType(type) === 'chemical' && opts.chemTakenMult != null) mult *= opts.chemTakenMult;
  if (canonicalType(type) === 'chemical' && opts.chemDealtMult != null) dmg *= opts.chemDealtMult;
  dmg *= mult;
  if (opts.takenMult) dmg *= opts.takenMult;
  return dmg < 0 ? 0 : dmg;
}

/** Sum every packet on a move. Accepts type/damage plus type2/damage2. */
export function resolveMoveDamage(move, attackerDef, defenderDef, opts = {}) {
  const packets = [];
  const push = (type, amount) => {
    if (type && amount > 0) packets.push({ type: canonicalType(type), amount });
  };
  push(move.type, move.damage);
  push(move.type2, move.damage2);
  if (Array.isArray(move.hits)) {
    for (const h of move.hits) push(h.type, h.damage);
  }
  const atk = attackerDef?.combat ?? null;
  const def = defenderDef?.combat ?? null;
  const out = [];
  let total = 0;
  for (const p of packets) {
    const dealt = resolvePacket(p.amount, p.type, atk, def, opts);
    out.push({ type: p.type, base: p.amount, dealt });
    total += dealt;
  }
  return { total, packets: out };
}
