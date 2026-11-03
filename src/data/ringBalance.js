// ---------------------------------------------------------------------------
// Smash Ring global balance coefficients (element-balance branch, Nov 3 2026).
// ONE place for every global tuning number of the Smash Ring. The defaults reproduce Benjamin's formulas exactly
// (statRework.js); every value that differs from its default is a departure from his rules and is listed in
// /workspace/aksheet/element_balance_2026-11-03.md for his sign-off. The Campaign never reads this file.
//
//   Weight (W) and Speed (S = 6 - W) physics
//     knockback resistance  kbResBase + kbResPerW * W          Benjamin: 0.5 + W/4
//     gravity scale         gravBase + gravPerW * W            Benjamin: 0.5 + W/5   (jump height stays constant)
//     walk speed            walkBase + walkPerS * S            Benjamin: 150 + 40 S
//     air jumps             ceil(S / 2) + airJumpAdd           Benjamin: ceil(S / 2)
//   Damage  (Benjamin: base + Attack - Defense, averaged over the move's types)
//     atkWeight[type]       value of one Attack point          Benjamin: 1
//     defWeight[type]       value of one Defense point         Benjamin: 1
//     typeMult[type]        multiplier on all damage of a type Benjamin: 1
//   Move traits (multiplier on the finished hit)
//     projectileMult  moves the sheet calls Traveling    areaMult  moves with an area (burst, cone, blast)
//     chargeMult      the charge slot                    counterMult  the defense slot (counters)
//   Over time
//     healMult   amount of every heal       dotMult   burn and poison per second
// ---------------------------------------------------------------------------
export const RING_COEF = {
  kbResBase: 0.5, kbResPerW: 0.25,
  gravBase: 0.5, gravPerW: 0.2,
  walkBase: 150, walkPerS: 40,
  airJumpAdd: 0,
  atkWeight: { kinetic: 1, heat: 1, chemical: 1, electrical: 1, radiation: 1 },
  defWeight: { kinetic: 1, heat: 1, chemical: 1, electrical: 1, radiation: 1 },
  typeMult: { kinetic: 1, heat: 1, chemical: 1, electrical: 1, radiation: 1 },
  projectileMult: 1, areaMult: 1, chargeMult: 1, counterMult: 1,
  healMult: 1, dotMult: 1,
};

/** Benjamin's defaults, for the sign-off table and the tests. */
export const BENJAMIN_COEF = Object.freeze({
  kbResBase: 0.5, kbResPerW: 0.25, gravBase: 0.5, gravPerW: 0.2, walkBase: 150, walkPerS: 40, airJumpAdd: 0,
  projectileMult: 1, areaMult: 1, chargeMult: 1, counterMult: 1, healMult: 1, dotMult: 1,
});

export const ringKnockbackResistance = (w) => RING_COEF.kbResBase + RING_COEF.kbResPerW * w;
export const ringGravityScale = (w) => RING_COEF.gravBase + RING_COEF.gravPerW * w;
export const ringWalkSpeed = (s) => RING_COEF.walkBase + RING_COEF.walkPerS * s;
export const ringAirJumps = (s) => Math.ceil(s / 2) + RING_COEF.airJumpAdd;
