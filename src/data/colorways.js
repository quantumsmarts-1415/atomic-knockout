// ---------------------------------------------------------------------------
// Colorways for the reviewed roster (the gold-edge fighters on the select
// table). Each entry is hand-tuned against that fighter's idle sheet:
//
//   base   hue (degrees) of the fighter's dominant painted color. Every
//          alternate names a *target* hue for that color, so "Crimson" on a
//          blue coat and "Crimson" on a green coat both land on crimson.
//   skin   0 = recolor everything (armor, flame, mineral bodies);
//          1 = keep skin tones; { center, width, strength } narrows the
//          protected band for fighters whose outfit sits near skin hues.
//   tint   [hue, amount] colorizes greys/whites — for the lab-coat crowd
//          whose only painted color is a hair highlight.
//   alts   the alternates, in select order. Slot 0 is always the painted
//          standard look and is not listed here.
//
// Fighters outside this table keep their single standard look.
// ---------------------------------------------------------------------------

export const COLORWAYS = {
  // --- period 1–2 -----------------------------------------------------------
  hydra: {
    base: 205, skin: 0,
    alts: [
      { name: 'Ember', hue: 18, val: -0.04 },
      { name: 'Mint', hue: 150 },
      { name: 'Violet', hue: 275 },
      { name: 'Solar', hue: 45, val: -0.06 },
    ],
  },
  helen: {
    base: 210, skin: 1,
    alts: [
      { name: 'Rose', hue: 340 },
      { name: 'Lilac', hue: 275 },
      { name: 'Mint', hue: 150 },
      { name: 'Peach', hue: 30, val: -0.03 },
    ],
  },
  lillie: {
    base: 345, skin: 1,
    alts: [
      { name: 'Violet', hue: 275 },
      { name: 'Azure', hue: 210 },
      { name: 'Verdant', hue: 140 },
      { name: 'Amber', hue: 38 },
    ],
  },
  ben: {
    base: 170, skin: 1,
    alts: [
      { name: 'Sapphire', hue: 220 },
      { name: 'Rosegold', hue: 350, sat: 0.9 },
      { name: 'Slate', hue: 215, sat: 0.35 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  bord: {
    base: 140, skin: 1,
    alts: [
      { name: 'Amber', hue: 38 },
      { name: 'Sapphire', hue: 215 },
      { name: 'Crimson', hue: 355 },
      { name: 'Violet', hue: 280 },
    ],
  },
  carter: {
    base: 230, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Emerald', hue: 150 },
      { name: 'Violet', hue: 285 },
      { name: 'Ember', hue: 22, val: -0.03 },
    ],
  },
  nitra: {
    base: 182, skin: 1,
    alts: [
      { name: 'Violet', hue: 270 },
      { name: 'Crimson', hue: 355 },
      { name: 'Amber', hue: 40, val: -0.04 },
      { name: 'Rose', hue: 330 },
    ],
  },
  oxana: {
    base: 202, skin: 1,
    alts: [
      { name: 'Violet', hue: 275 },
      { name: 'Crimson', hue: 350 },
      { name: 'Amber', hue: 40, val: -0.04 },
      { name: 'Jade', hue: 150 },
    ],
  },
  flora: {
    base: 60, skin: 1,
    alts: [
      { name: 'Violet', hue: 280 },
      { name: 'Crimson', hue: 355 },
      { name: 'Amber', hue: 35 },
      { name: 'Arctic', hue: 195 },
    ],
  },
  neo: {
    base: 8, skin: { center: 14, width: 14, satMax: 0.6 },
    alts: [
      { name: 'Argon', hue: 270 },
      { name: 'Krypton', hue: 190 },
      { name: 'Xenon', hue: 215 },
      { name: 'Helium', hue: 320 },
    ],
  },
  // --- period 3 -------------------------------------------------------------
  natalie: {
    base: 20, skin: { satMax: 0.74 },
    alts: [
      { name: 'Violet', hue: 275 },
      { name: 'Crimson', hue: 350 },
      { name: 'Arctic', hue: 200 },
      { name: 'Verdant', hue: 140 },
    ],
  },
  maggie: {
    base: 10, skin: 1,
    alts: [
      { name: 'Ice', hue: 200, tint: [200, 0.2] },
      { name: 'Rose', hue: 335, tint: [335, 0.18] },
      { name: 'Mint', hue: 150, tint: [150, 0.16] },
      { name: 'Violet', hue: 275, tint: [270, 0.18] },
    ],
  },
  allen: {
    base: 207, skin: 1,
    alts: [
      { name: 'Violet', hue: 275 },
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  silas: {
    base: 215, skin: 1,
    alts: [
      { name: 'Amber Core', hue: 40, val: -0.03 },
      { name: 'Violet Core', hue: 280 },
      { name: 'Crimson Core', hue: 355 },
      { name: 'Jade Core', hue: 150 },
    ],
  },
  phillip: {
    base: 212, skin: 1,
    alts: [
      { name: 'Violet', hue: 280, sat: 1.3 },
      { name: 'Crimson', hue: 355, sat: 1.3 },
      { name: 'Amber', hue: 40, sat: 1.3 },
      { name: 'Jade', hue: 140, sat: 1.3 },
    ],
  },
  sully: {
    base: 28, skin: 0,
    alts: [
      { name: 'Ash', hue: 28, sat: 0.22 },
      { name: 'Obsidian', hue: 28, sat: 0.5, val: -0.22 },
      { name: 'Ember', hue: 5 },
      { name: 'Verdigris', hue: 165 },
    ],
  },
  chloe: {
    base: 50, skin: 1,
    alts: [
      { name: 'Violet', hue: 275, tint: [270, 0.18] },
      { name: 'Crimson', hue: 355, tint: [350, 0.14] },
      { name: 'Arctic', hue: 200, tint: [200, 0.18] },
      { name: 'Mint', hue: 150, tint: [150, 0.14] },
    ],
  },
  aaron: {
    base: 225, skin: 1,
    alts: [
      { name: 'Amber', hue: 40, val: -0.04 },
      { name: 'Jade', hue: 150 },
      { name: 'Crimson', hue: 355 },
      { name: 'Violet', hue: 285 },
    ],
  },
  // --- period 4 -------------------------------------------------------------
  kyle: {
    base: 268, skin: 1,
    alts: [
      { name: 'Amber', hue: 40, val: -0.05 },
      { name: 'Jade', hue: 150 },
      { name: 'Crimson', hue: 355 },
      { name: 'Azure', hue: 205 },
    ],
  },
  cal: {
    base: 25, skin: 0,
    alts: [
      { name: 'Ash', hue: 25, sat: 0.3 },
      { name: 'Arctic', hue: 200, sat: 0.75 },
      { name: 'Violet', hue: 270, sat: 0.8 },
      { name: 'Moss', hue: 90, sat: 0.8 },
    ],
  },
  scarlett: {
    base: 0, skin: { satMax: 0.72 },
    alts: [
      { name: 'Violet', hue: 275 },
      { name: 'Jade', hue: 150 },
      { name: 'Teal', hue: 185 },
      { name: 'Azure', hue: 210 },
    ],
  },
  titan: {
    base: 213, skin: 1,
    alts: [
      { name: 'Gunmetal', hue: 213, sat: 0.3, val: -0.06 },
      { name: 'Aurora', hue: 150 },
      { name: 'Ember', hue: 15 },
      { name: 'Violet', hue: 280 },
    ],
  },
  van: {
    base: 245, skin: 1,
    alts: [
      { name: 'Amber', hue: 40, val: -0.04 },
      { name: 'Crimson', hue: 355 },
      { name: 'Arctic', hue: 195 },
      { name: 'Jade', hue: 150 },
    ],
  },
  chroma: {
    base: 340, skin: 1,
    alts: [
      { name: 'Emerald', hue: 150 },
      { name: 'Ruby', hue: 0 },
      { name: 'Sapphire', hue: 220 },
      { name: 'Gold', hue: 45, val: -0.04 },
    ],
  },
  manny: {
    base: 345, skin: 1,
    alts: [
      { name: 'Violet', hue: 275 },
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Amber', hue: 40 },
    ],
  },
  fey: {
    base: 10, skin: { center: 16, width: 14, satMax: 0.62 },
    alts: [
      { name: 'Cobalt', hue: 215 },
      { name: 'Verdigris', hue: 165 },
      { name: 'Violet', hue: 275 },
      { name: 'Gold', hue: 45 },
    ],
  },
  collin: {
    base: 212, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 280 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  nick: {
    base: 220, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 280 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  cooper: {
    base: 16, skin: { center: 26, width: 12, satMax: 0.68 },
    alts: [
      { name: 'Verdigris', hue: 165 },
      { name: 'Cobalt', hue: 215 },
      { name: 'Violet', hue: 275 },
      { name: 'Rose', hue: 340 },
    ],
  },
  zane: {
    base: 205, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 280 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  gail: {
    base: 10, skin: { center: 14, width: 14, satMax: 0.6 },
    alts: [
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 275 },
      { name: 'Gold', hue: 45 },
    ],
  },
  gertrude: {
    base: 220, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355, tint: [350, 0.1] },
      { name: 'Jade', hue: 150, tint: [150, 0.1] },
      { name: 'Violet', hue: 280, tint: [270, 0.12] },
      { name: 'Amber', hue: 40, tint: [40, 0.1] },
    ],
  },
  arsenio: {
    base: 150, skin: 1,
    alts: [
      { name: 'Violet', hue: 280, sat: 1.35, val: 0.05 },
      { name: 'Crimson', hue: 355, sat: 1.35, val: 0.05 },
      { name: 'Azure', hue: 210, sat: 1.35, val: 0.05 },
      { name: 'Amber', hue: 40, sat: 1.35, val: 0.05 },
    ],
  },
  selena: {
    base: 220, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 280 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  // Brock's coat and face are the same umber; no mask separates them, so his
  // alternates stay in the warm family and move value and saturation instead.
  brock: {
    base: 24, skin: 0,
    alts: [
      { name: 'Ash', hue: 24, sat: 0.35 },
      { name: 'Night', hue: 24, val: -0.18 },
      { name: 'Bronze', hue: 34, sat: 1.3 },
      { name: 'Ember', hue: 12, sat: 1.3 },
    ],
  },
  krypto: {
    base: 255, skin: 1,
    alts: [
      { name: 'Teal', hue: 185 },
      { name: 'Rose', hue: 335 },
      { name: 'Amber', hue: 40, val: -0.05 },
      { name: 'Jade', hue: 150 },
    ],
  },
  ruben: {
    base: 210, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 280 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  // --- period 5 and beyond ----------------------------------------------------
  yara: {
    base: 220, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 280 },
      { name: 'Amber', hue: 40, val: -0.04 },
    ],
  },
  zora: {
    base: 10, skin: 1,
    alts: [
      { name: 'Rose', hue: 335, tint: [335, 0.18] },
      { name: 'Ice', hue: 200, tint: [200, 0.2] },
      { name: 'Mint', hue: 150, tint: [150, 0.16] },
      { name: 'Violet', hue: 275, tint: [270, 0.18] },
    ],
  },
  rhoda: {
    base: 340, skin: 1,
    alts: [
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Amber', hue: 40, val: -0.04 },
      { name: 'Crimson', hue: 0 },
    ],
  },
  paula: {
    base: 30, skin: { center: 28, width: 14 },
    alts: [
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 275 },
      { name: 'Rose', hue: 340 },
    ],
  },
  sandy: {
    base: 18, skin: { center: 18, width: 14 },
    alts: [
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 275 },
      { name: 'Crimson', hue: 355 },
    ],
  },
  erin: {
    base: 335, skin: 1,
    alts: [
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Amber', hue: 40, val: -0.04 },
      { name: 'Violet', hue: 275 },
    ],
  },
  yvette: {
    base: 18, skin: { center: 22, width: 12, satMax: 0.76 },
    alts: [
      { name: 'Azure', hue: 210 },
      { name: 'Jade', hue: 150 },
      { name: 'Violet', hue: 275 },
      { name: 'Rose', hue: 335 },
    ],
  },
  liv: {
    base: 42, skin: { center: 26, width: 10, satMax: 0.8 },
    alts: [
      { name: 'Rose', hue: 340 },
      { name: 'Azure', hue: 205 },
      { name: 'Lilac', hue: 275 },
      { name: 'Mint', hue: 150 },
    ],
  },
  tess: {
    base: 258, skin: 1,
    alts: [
      { name: 'Crimson', hue: 355 },
      { name: 'Teal', hue: 185 },
      { name: 'Amber', hue: 40, val: -0.05 },
      { name: 'Jade', hue: 150 },
    ],
  },
};

export const COLORWAY_IDS = Object.keys(COLORWAYS);

/** Hue-only chip color for UI swatches: the target hue at a readable S/V. */
export function chipHex(hueDeg, sat = 0.62, val = 0.84) {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = val * (1 - sat);
  const q = val * (1 - f * sat);
  const t = val * (1 - (1 - f) * sat);
  const [r, g, b] = [[val, t, p], [q, val, p], [p, val, t], [p, q, val], [t, p, val], [val, p, q]][i % 6];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
