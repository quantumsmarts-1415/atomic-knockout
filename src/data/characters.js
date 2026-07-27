// ---------------------------------------------------------------------------
// CHARACTER DATA — the single source of truth for the roster.
// Adding a new element character = adding one entry here. No engine changes.
//
// Damage types follow the creator notes: every move is heat, current, or
// kinetic, and every character has per-type defense (0-10). Defense reduces
// incoming damage of that type by 5% per point.
//
// Knockback model (Smash-style): launch speed =
//   (baseKnockback + victimPercent * knockbackGrowth) / victimWeight
// Lighter characters (weight < 1) fly farther.
// ---------------------------------------------------------------------------

export const DAMAGE_TYPES = ['heat', 'current', 'kinetic'];

export const CHARACTERS = {
  hydra: {
    id: 'hydra',
    name: 'Hydra',
    element: 'Hydrogen',
    symbol: 'H',
    atomicNumber: 1,
    tagline: 'The lightest element — quick, explosive, everywhere.',
    teach: 'Hydrogen is the lightest and most abundant element in the universe.',
    // Benjamin-supplied render (art-src/hydra.png, background removed to
    // hydra-cut.png). facing: the native image faces LEFT, so it is flipped
    // to match the game's face-right convention. height = display px;
    // bodyW/bodyH = physics hurtbox (tighter than the flame aura).
    art: { key: 'char-hydra', file: 'art-src/hydra-cut.png', facing: -1, height: 170, bodyW: 58, bodyH: 150 },
    stats: {
      speed: 340,          // horizontal run speed (px/s)
      jumpVelocity: 680,   // initial jump speed (px/s, applied upward)
      airJumps: 1,         // extra jumps allowed while airborne
      weight: 0.78,        // < 1 = light, flies farther when hit
      gravityScale: 1.0,   // multiplier on world gravity
    },
    defense: { heat: 1, current: 2, kinetic: 1 }, // hydrogen is not tough
    palettes: [
      { name: 'Sky',    skin: 0xcfe8ff, body: 0x4aa8e8, accent: 0x1c5f9e, eye: 0x10233a },
      { name: 'Flame',  skin: 0xffe3c9, body: 0xe8664a, accent: 0x9e2f1c, eye: 0x3a1710 },
      { name: 'Mint',   skin: 0xd9ffe8, body: 0x3fc98a, accent: 0x1c7a4e, eye: 0x0f2e1e },
      { name: 'Violet', skin: 0xe8dcff, body: 0x8a5fe0, accent: 0x4c2f9e, eye: 0x1d1236 },
    ],
    body: {
      // proportions the rig builder uses (px, at scale 1)
      headRadius: 22,
      torsoWidth: 40,
      torsoHeight: 46,
      armLength: 30,
      armWidth: 11,
      legLength: 26,
      legWidth: 13,
      // flavor: hydrogen gets a single little "electron" antenna orb
      antenna: true,
    },
    moves: {
      basic: {
        name: 'Proton Jab',
        type: 'kinetic',
        damage: 7,
        baseKnockback: 190,
        knockbackGrowth: 7,
        rangeW: 58,   // hitbox width in front of fighter
        rangeH: 46,
        duration: 220,   // ms the swing lasts
        cooldown: 300,
      },
      special: {
        name: 'H-Burst',
        kind: 'burst', // radial explosion centered on self
        type: 'heat',
        damage: 13,
        baseKnockback: 320,
        knockbackGrowth: 9,
        radius: 95,
        duration: 320,
        cooldown: 1300,
        teach: 'Hydrogen gas is highly flammable — it powered early rockets.',
      },
    },
  },

  helen: {
    id: 'helen',
    name: 'Helen',
    element: 'Helium',
    symbol: 'He',
    atomicNumber: 2,
    tagline: 'Floaty, calm, and impossible to pin down.',
    teach: 'Helium is lighter than air and so unreactive it almost never forms compounds.',
    art: { key: 'char-helen', file: 'art-src/helen-cut.png', facing: 1, height: 172, bodyW: 50, bodyH: 155 },
    stats: {
      speed: 265,
      jumpVelocity: 560,
      airJumps: 2,          // extra floaty double jump
      weight: 0.72,
      gravityScale: 0.62,   // noble-gas drift — falls slowly
    },
    defense: { heat: 3, current: 1, kinetic: 2 }, // inert = shrugs off heat
    palettes: [
      { name: 'Sunrise', skin: 0xfff1cf, body: 0xf2b04a, accent: 0xa86f1c, eye: 0x3a2a10 },
      { name: 'Bubble',  skin: 0xe3f6ff, body: 0x6fc6e8, accent: 0x2f7d9e, eye: 0x102e3a },
      { name: 'Rose',    skin: 0xffe3ef, body: 0xe86fa8, accent: 0x9e2f66, eye: 0x3a1024 },
      { name: 'Slate',   skin: 0xe6e6f0, body: 0x8a8aa8, accent: 0x4c4c66, eye: 0x1a1a24 },
    ],
    body: {
      headRadius: 25,       // rounder, balloon-like
      torsoWidth: 48,
      torsoHeight: 42,
      armLength: 26,
      armWidth: 11,
      legLength: 22,
      legWidth: 13,
      antenna: false,
    },
    moves: {
      basic: {
        name: 'Balloon Bop',
        type: 'kinetic',
        damage: 6,
        baseKnockback: 200,
        knockbackGrowth: 6,
        rangeW: 54,
        rangeH: 50,
        duration: 240,
        cooldown: 320,
      },
      special: {
        name: 'Noble Gust',
        kind: 'projectile', // slow drifting orb that pushes hard
        type: 'kinetic',
        damage: 8,
        baseKnockback: 380,
        knockbackGrowth: 8,
        projectileSpeed: 380,
        projectileRadius: 16,
        projectileLife: 900, // ms
        duration: 260,
        cooldown: 1500,
        teach: 'Helium is a noble gas — inert, safe, and used to lift airships.',
      },
    },
  },
};

export const ROSTER = Object.values(CHARACTERS);

// Damage after per-type defense: 5% reduction per defense point.
export function applyDefense(rawDamage, damageType, defense) {
  const points = defense?.[damageType] ?? 0;
  return rawDamage * (1 - Math.min(points, 10) * 0.05);
}
