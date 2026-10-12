// Batch 3 tunables. Numbers Benjamin did not lock live here so he can
// change them without hunting through move code. FX sheet names are the
// drop-in hook: art lands later under these file names.

export const YARA = {
  risePx: 40,
  glideDamage: 8,
  glideDamageMult: 1.25,
  glideSpeed: 620,
  glideDistanceMult: 1.2,
  maxChargeMs: 800,
  glideDuration: 280,
  mineArmMs: 500,
  mineMax: 1,
  mineRange: 148,
  mineShardDamage: 6,
  mineShardSpeed: 380,
  mineShardLife: 420,
  pinFront: 176,
  pinTall: 120,
};

export const ZORA = {
  bladeDamage: 6,
  bladeDamageMult: 1.5,
  bladeReach: 2.15,
  maxChargeMs: 850,
};

export const RHODA = {
  vacuumRadius: 180,
  stackBonus: 0.25,
  stackMax: 3,
  heatTaken: 0.5,
  kineticTaken: 0.5,
  dazzleMs: 1500,
  coneDeg: 70,
  coneRadius: 210,
  beamDamage: 9,
};

export const PAULA = {
  fullOdds: 0.5,
  partialOdds: 0.25,
  partialAfterMs: 500,
  partialScale: 0.6,
  fullChargeMs: 1000,
  blastDamage: 18,
  blastRadius: 96,
  spongeHeal: 3,
  cloudHealPerSec: 1,
  boltDamage: 6,
  boltDouble: 2,
  boltScale: 1.3,
};

export const SANDY = {
  cryConeDeg: 62,
  cryRadius: 168,
  cryDamage: 8,
  kinTaken: 1.25,
  kinTakenMs: 5000,
  // Proposed extra over the old 160 / 2.8 organ-pipe knockback.
  sledgeKnockback: 220,
  sledgeGrowth: 3.4,
  pestHeat: 1.5,
  pestChem: 1.5,
  canFloorBounces: 1,
  canWallRicochets: 2,
  canBounce: 0.72,
};

export const ERIN = {
  cableDamage: 8,
  cableDamageMult: 1.5,
  cableLengthMult: 2.05,
  cableLen: 156,
  maxChargeMs: 900,
  reflectPower: 1.5,
};

export const YVETTE = {
  clockPeriod: 1000,
  clockSlack: 100,
  clockMult: 3,
  clockMaxChargeMs: 3000,
  stressCap: 2.5,
  counterRange: 180,
  counterDamage: 8,
  metalBonus: 1.5,
};

export const LIV = {
  aimDistance: 220,
  fullChargeMs: 2000,
  blastHeat: 22,
  blastRad: 18,
  blastRadius: 112,
  earlyHeat: 6,
  earlyRadius: 36,
  detonateHeat: 16,
  detonateRad: 14,
  detonateRadius: 90,
  sparkLife: 120,
  sparkDamage: 18.48,
  sparkSpeed: 640,
};

export const TESS = {
  pullMin: 140,
  pullMax: 280,
  hungerDamage: 8,
  hungerDamageMult: 1.35,
  maxChargeMs: 800,
  hazeDps: 2,
  hazeRadius: 92,
  fanDeg: 40,
  fanCount: 6,
  fanSpeed: 520,
};

export const BATCH3_FX = {
  'Maglev Launch': ['maglev-frost-aura-sheet', 'maglev-glide-trail'],
  'Garnet Cut': ['garnet-cut-slash'],
  'Flux Pin': ['flux-pin-lock-sheet'],
  'Ytterby Mine': ['ytterby-mine-sheet'],
  'Ceramic Blade': ['ceramic-blade-grow-sheet', 'zirconia-forge-sparks-sheet', 'ceramic-sweep-arc'],
  'Cubic Cut': ['cubic-cut-sparkle'],
  'Counterfeit Gem': ['carter/diamond-shard', 'carter/diamond-burst'],
  'Catalytic Converter': ['catalytic-vortex-sheet', 'catalyst-charged-glow-sheet'],
  'Rose Thorn': ['rose-thorn-impact'],
  'High Beam': ['high-beam-cone', 'maggie/daze-stars-sheet'],
  'Cold Fusion': ['cold-fusion-cell-sheet', 'cold-fusion-blast', 'kyle/charge-fizzle'],
  'White Gold Jab': ['white-gold-jab-impact'],
  'Hydrogen Sponge': ['hydrogen-sponge-sheet'],
  'Fuel Cell Bolt': ['fuel-cell-bolt'],
  'Tin Cry': ['tin-cry-sonic-blast'],
  'Sledgehammer Swing': ['hammer-boom-impact'],
  'Tin Pest': ['tin-pest-crumble-sheet'],
  'Tin Can Kick': ['tin-can', 'can-ricochet-ping'],
  'Undersea Cable': ['cable-signal-pulse-sheet'],
  'Pink Glass Swipe': ['pink-glass-swipe-arc'],
  'Signal Repeater': ['signal-repeater-sheet'],
  'Resurface Laser': ['resurface-laser', 'strip-protection-shatter'],
  'Lattice Clock': ['lattice-clock-sheet', 'tick-perfect-burst'],
  'Stress Gauge': ['stress-gauge-sheet'],
  'Seismic Read': ['seismic-ripple-sheet'],
  'Fiber Laser': ['fiber-laser-beam'],
  '192 Beams': ['ignition-beams-sheet', 'fusion-ignition-blast'],
  'Chalcogen Hook': ['chalcogen-hook-impact'],
  Hohlraum: ['hohlraum-can-sheet', 'fusion-ignition-blast'],
  'Last Instant': ['last-instant-spark'],
  'Electron Hunger': ['electron-hunger-tether-sheet'],
  'Last Halogen': ['halogen-swipe-arc'],
  'Smoky Haze': ['smoky-haze-sheet'],
  'Six-Atom Spread': ['six-atom-shot', 'atom-pop-impact'],
};

export function fxSheetsFor(name) {
  return BATCH3_FX[name] ?? null;
}
