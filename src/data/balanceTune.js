// Balance pass (Nov 3 2026), element-balance step 3. Per-fighter multipliers, one place, easy to read and revert.
//   kb  multiplier on the knockback of the fighter's four moves (base and growth together). 1 = unchanged.
//   cd  multiplier on the fighter's per-move recharge from the stat rework sheet (Fighter.cdMsFor). 1 = unchanged.
// These do not touch the rules: damage is still base + Attack - Defense, Weight + Speed is still 6, and so on.
export const BALANCE_TUNE = {
};
