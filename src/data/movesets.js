// Four-move kits from the character design doc.
// Charge = basicCharge (hold normal). Normal = basicDirectional.
// Defense = specialDefense (hold special). Special = specialDirectional.
// Lillie is intentionally absent — her in-game kit stays as written.

const K = 'kinetic';
const H = 'heat';
const E = 'electrical';
const C = 'chemical';
const R = 'radiation';

function m(name, fields) {
  return {
    duration: 250,
    cooldown: 380,
    baseKnockback: 180,
    knockbackGrowth: 5.4,
    ...fields,
    name,
  };
}

const melee = (name, fields) => m(name, { rangeW: 72, rangeH: 48, ...fields });

export const MOVESETS = {
  hydra: {
    basicCharge: m('Supernova', {
      kind: 'burst', type: H, damage: 9, type2: R, damage2: 7,
      chargeDamageMult: 2.2, chargeKnockbackMult: 1.8, chargeRadiusMult: 2.1,
      maxChargeMs: 900, radius: 64, baseKnockback: 200, knockbackGrowth: 6,
      duration: 280, cooldown: 720, vfx: 'supernova',
      selfDamage: { type: H, damage: 4 }, releaseOnHit: true,
    }),
    basicDirectional: melee('Flame Dash', {
      kind: 'dash', type: K, damage: 7, type2: H, damage2: 6,
      dashSpeed: 720, rangeW: 96, rangeH: 100, baseKnockback: 230,
      knockbackGrowth: 6.2, duration: 300, cooldown: 700, vfx: 'fire',
    }),
    specialDefense: m('Fire Wall', {
      kind: 'wall', frontOnly: true, duration: 520, cooldown: 680,
      blocks: [K, H, C], vfx: 'wall', vfxColor: 0xff5a1f,
      wallDamage: 8, wallType: H, wallKnockback: 200, wallKnockbackGrowth: 5,
      wallRangeW: 28, wallRangeH: 110, wallYFrac: 0.7,
    }),
    specialDirectional: m('Hydrogen Bomb', {
      kind: 'projectile', type: H, damage: 10, type2: R, damage2: 8,
      explodeOnly: true, explodeRadius: 74, vfx: 'mushroom',
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 700,
      baseKnockback: 250, knockbackGrowth: 6.4, duration: 260, cooldown: 980,
    }),
  },

  helen: {
    // Owner: keep her existing bubble attack as Charge. Air Wave moves to Special.
    basicCharge: m('Balloon Bop', {
      kind: 'projectile', type: K, damage: 10,
      chargeDamageMult: 1.7, chargeKnockbackMult: 1.6, chargeRadiusMult: 1.8,
      maxChargeMs: 700, lift: true, vfx: 'balloon',
      baseKnockback: 280, knockbackGrowth: 6.2,
      projectileSpeed: 240, projectileRadius: 28, projectileLife: 1800,
      duration: 260, cooldown: 860,
    }),
    basicDirectional: melee('Noble Gust', {
      type: K, damage: 7, baseKnockback: 300, knockbackGrowth: 7.2,
      rangeW: 82, rangeH: 50, vfx: 'gust', duration: 220, cooldown: 260,
    }),
    specialDefense: m('Bubble Shield', {
      kind: 'shield', duration: 1400, cooldown: 760, vfx: 'bubble', vfxColor: 0xbfefff,
    }),
    specialDirectional: m('Air Wave', {
      kind: 'projectile', type: K, damage: 10, vfx: 'gust',
      baseKnockback: 340, knockbackGrowth: 7,
      projectileSpeed: 360, projectileRadius: 36, projectileLife: 1100,
      duration: 240, cooldown: 860,
    }),
  },

  ben: {
    basicCharge: melee('Resonant Strike', {
      type: K, damage: 8, chargeDamageMult: 2.2, chargeKnockbackMult: 1.7,
      maxChargeMs: 800, baseKnockback: 200, vfx: 'spark',
      secondHit: { atFull: true, scale: 0.55, radius: 100 },
    }),
    basicDirectional: melee('Precision Strike', {
      type: K, damage: 7, sweetSpot: 5, rangeW: 70, vfx: 'strike',
      duration: 250, cooldown: 740,
    }),
    specialDefense: m('Rigid Stance', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.72, noKnockback: true,
      retort: { when: R, type: R, damage: 7, knockback: 160 },
      duration: 700, cooldown: 640, vfx: 'shield',
    }),
    specialDirectional: m('Gyro Disc', {
      kind: 'projectile', type: K, damage: 9, vfx: 'spark',
      returns: true, angleable: true, pierce: false,
      projectileSpeed: 460, projectileRadius: 12, projectileLife: 1100,
      baseKnockback: 190, duration: 240, cooldown: 1180,
    }),
  },

  bord: {
    basicCharge: melee('Heavy Ram', {
      kind: 'dash', type: K, damage: 9, chargeDamageMult: 2,
      chargeKnockbackMult: 1.8, chargeDashMult: 1.35, maxChargeMs: 800,
      breaksBlock: 'full', dashSpeed: 560, rangeW: 88, rangeH: 80,
      baseKnockback: 240, vfx: 'dash',
    }),
    basicDirectional: melee('Crystal Smash', {
      type: K, damage: 11, baseKnockback: 210, rangeW: 70, vfx: 'strike',
      duration: 240, cooldown: 360,
    }),
    specialDefense: m('Boron Carbide Wall', {
      kind: 'wall', frontOnly: true, blocks: [K, H, R], crackAfterHits: 3,
      duration: 800, cooldown: 900, vfx: 'wall', vfxColor: 0x9ad7ff,
      wallDamage: 6, wallType: K, wallKnockback: 180, wallKnockbackGrowth: 4,
      wallRangeW: 30, wallRangeH: 100, wallYFrac: 0.7,
    }),
    specialDirectional: m('Ground Shatter', {
      kind: 'burst', type: K, damage: 12, radius: 88, vfx: 'strike',
      baseKnockback: 220, duration: 300, cooldown: 820,
    }),
  },

  carter: {
    basicCharge: m('Diamond Shard', {
      kind: 'projectile', type: K, damage: 9, chargeDamageMult: 2.1,
      chargeRadiusMult: 1.6, maxChargeMs: 800, breaksBlock: true, vfx: 'spark',
      projectileSpeed: 540, projectileRadius: 10, projectileLife: 700,
      baseKnockback: 210, duration: 240, cooldown: 720,
    }),
    basicDirectional: melee('Diamond Cross', {
      type: K, damage: 9, baseKnockback: 200, rangeW: 70, vfx: 'strike',
      duration: 250, cooldown: 660,
    }),
    specialDefense: m('Diamond Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.78,
      duration: 700, cooldown: 680, vfx: 'shield', vfxColor: 0xd6f4ff,
    }),
    specialDirectional: m('Graphene Wave', {
      kind: 'burst', type: E, damage: 12, radius: 82, vfx: 'spark',
      baseKnockback: 200, duration: 280, cooldown: 980,
    }),
  },

  nitra: {
    basicCharge: melee('Nitrogen Rush', {
      kind: 'dash', type: K, damage: 8, chargeDamageMult: 2, chargeDashMult: 1.4,
      maxChargeMs: 750, dashSpeed: 680, rangeW: 90, rangeH: 88,
      whileCharging: { keep: 0.42, except: [R] },
      baseKnockback: 210, vfx: 'ice',
    }),
    basicDirectional: melee('Frost Fang', {
      type: K, damage: 5, type2: H, damage2: 4,
      onHit: { slow: 1200 }, rangeW: 84, vfx: 'ice', duration: 200, cooldown: 300,
    }),
    specialDefense: m('Inert Shield', {
      kind: 'shield', duration: 900, cooldown: 700, vfx: 'bubble', vfxColor: 0xd8fff8,
    }),
    specialDirectional: m('Cryo Vortex', {
      kind: 'burst', type: H, damage: 10, radius: 96, vfx: 'ice',
      zone: { type: H, damage: 3.2, ms: 2600, radius: 90, tick: 400, slide: true, color: 0xbff6ff },
      baseKnockback: 240, duration: 300, cooldown: 860,
    }),
  },

  oxana: {
    basicCharge: m('Bellows Breath', {
      kind: 'projectile', type: K, damage: 4, flareHeat: 9,
      chargeDamageMult: 1.6, maxChargeMs: 700, vfx: 'gust',
      baseKnockback: 260, knockbackGrowth: 6,
      projectileSpeed: 380, projectileRadius: 32, projectileLife: 1100,
      duration: 240, cooldown: 640,
    }),
    basicDirectional: melee('Vortex Kick', {
      type: K, damage: 8, flareHeat: 6, rangeW: 88, vfx: 'gust',
      duration: 230, cooldown: 320,
    }),
    specialDefense: m('Ozone Layer', {
      blocks: [R], duration: 800, cooldown: 720, vfx: 'shield', vfxColor: 0x9ad7ff,
    }),
    specialDirectional: m('Oxidation Burst', {
      kind: 'burst', type: H, damage: 7, type2: C, damage2: 6,
      radius: 108, rustMetals: true, vfx: 'acid',
      baseKnockback: 190, duration: 280, cooldown: 840,
    }),
  },

  flora: {
    basicCharge: m('Pale Yellow Jet', {
      kind: 'projectile', type: C, damage: 11, type2: H, damage2: 5,
      chemDealtMult: 1.15, chargeDamageMult: 1.7, maxChargeMs: 800,
      vfx: 'acid', vfxColor: 0xe6f27a,
      projectileSpeed: 520, projectileRadius: 14, projectileLife: 560,
      baseKnockback: 180, duration: 240, cooldown: 760,
    }),
    basicDirectional: melee('Etching Jab', {
      type: C, damage: 8, onHit: { corrode: { mult: 0.7, ms: 2000 } },
      vfx: 'acid', duration: 190, cooldown: 300,
    }),
    specialDefense: m('Teflon Coat', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4, debuffImmune: true,
      duration: 800, cooldown: 740, vfx: 'shield', vfxColor: 0xe8ffe8,
    }),
    specialDirectional: m('Radical Cascade', {
      kind: 'burst', type: C, damage: 8, radius: 72, vfx: 'acid',
      chain: { count: 2, scale: 0.62, delay: 180 },
      baseKnockback: 160, duration: 280, cooldown: 900,
    }),
  },

  neo: {
    basicCharge: m('High-Voltage Tube', {
      kind: 'beam', type: E, damage: 8, chargeDamageMult: 1.8,
      chargeLengthMult: 2.5, maxChargeMs: 850, beamLen: 150, beamThick: 22,
      vfx: 'laser', vfxColor: 0xff5a2a, baseKnockback: 170,
      duration: 220, cooldown: 700,
    }),
    basicDirectional: melee('Staff Crack', {
      type: K, damage: 5, type2: E, damage2: 5, vfx: 'spark',
      rangeW: 94, duration: 210, cooldown: 280,
    }),
    specialDefense: m('No Vacancy', {
      blocks: [K, H, E, C, R], frontOnly: true, openAfter: true, vulnerableMs: 650,
      duration: 900, cooldown: 400, vfx: 'shield', vfxColor: 0xff5a2a,
    }),
    specialDirectional: m('Neon Flare', {
      kind: 'burst', type: E, damage: 11, radius: 102, vfx: 'spark', vfxColor: 0xff5a2a,
      onHit: { blind: 800 }, baseKnockback: 170, duration: 260, cooldown: 820,
    }),
  },

  natalie: {
    basicCharge: m('Lake Drop', {
      kind: 'burst', type: K, damage: 8, type2: H, damage2: 7,
      chargeDamageMult: 2.3, chargeKnockbackMult: 2, chargeRadiusMult: 1.8,
      maxChargeMs: 1000, detonateAtFull: true, includeSelf: true,
      radius: 60, vfx: 'supernova', vfxColor: 0xffc14a,
      baseKnockback: 260, knockbackGrowth: 7, duration: 280, cooldown: 860,
    }),
    basicDirectional: melee('Flame Fist', {
      type: K, damage: 5, type2: H, damage2: 5, vfx: 'fire', vfxColor: 0xffc14a,
      duration: 240, cooldown: 500,
    }),
    specialDefense: m('Oil Bath', {
      blocks: [C, H],
      buff: { slippery: 1.4, ms: 2200 },
      duration: 800, cooldown: 740, vfx: 'shield', vfxColor: 0xf2e2a8,
    }),
    specialDirectional: m('Brine Burst', {
      kind: 'burst', type: H, damage: 8, type2: K, damage2: 6,
      radius: 88, baseKnockback: 280, knockbackGrowth: 7.2,
      vfx: 'fire', vfxColor: 0xffc14a, duration: 280, cooldown: 860,
    }),
  },

  maggie: {
    basicCharge: m('Unquenchable', {
      kind: 'buff', duration: 280, cooldown: 1100, maxChargeMs: 600,
      vfx: 'fire', vfxColor: 0xfff2c9,
      buff: { ms: 4000, heatTaken: 0.4, heatOnHit: 3, hits: 8 },
    }),
    basicDirectional: melee('Flare Jab', {
      type: K, damage: 5, type2: H, damage2: 5, vfx: 'fire',
      duration: 250, cooldown: 520,
    }),
    specialDefense: m('Ribbon Guard', {
      blocks: [K],
      retort: { when: H, type: H, damage: 8, knockback: 180 },
      duration: 650, cooldown: 680, vfx: 'shield', vfxColor: 0xfff2c9,
    }),
    specialDirectional: m('Blinding Flare', {
      kind: 'burst', type: H, damage: 11, radius: 86, vfx: 'fire', vfxColor: 0xfff6e0,
      onHit: { blind: 900 }, baseKnockback: 160, duration: 260, cooldown: 1040,
    }),
  },

  allen: {
    basicCharge: m('Thermite Burn', {
      kind: 'beam', type: H, damage: 10, chargeDamageMult: 1.8, chargeLengthMult: 1.8,
      maxChargeMs: 800, beamLen: 130, beamThick: 26, breaksBlock: true,
      vfx: 'laser', vfxColor: 0xff6a1a, baseKnockback: 160,
      duration: 240, cooldown: 760,
    }),
    basicDirectional: melee('Turbine Strike', {
      type: K, damage: 5, multiHit: 3, rangeW: 90, vfx: 'spark',
      baseKnockback: 90, duration: 320, cooldown: 300,
    }),
    specialDefense: m('Oxide Skin', {
      kind: 'oxide', duration: 2000, cooldown: 1600, vfx: 'shield', vfxColor: 0xd8dde6,
    }),
    specialDirectional: m('Turbine Vortex', {
      kind: 'burst', type: E, damage: 10, radius: 100, pull: 320, vfx: 'spark',
      baseKnockback: 80, duration: 300, cooldown: 860,
    }),
  },

  silas: {
    basicCharge: m('Overclock', {
      kind: 'buff', duration: 240, cooldown: 1200, maxChargeMs: 900,
      overclock: { speed: 1.4, ms: 2800, selfHeat: 7 }, vfx: 'spark', vfxColor: 0x4ad6ff,
    }),
    basicDirectional: melee('Crystal Blade', {
      type: K, damage: 9, rangeW: 74, vfx: 'strike', duration: 260, cooldown: 520,
    }),
    specialDefense: m('Silica Pane', {
      blocks: [H, C],
      retort: { when: K, type: K, damage: 7, knockback: 200 },
      duration: 700, cooldown: 760, vfx: 'shield', vfxColor: 0xd6f6ff,
    }),
    specialDirectional: m('Binary Surge', {
      kind: 'burst', type: E, damage: 9, radius: 80, missRetry: true, vfx: 'spark',
      baseKnockback: 170, duration: 240, cooldown: 780,
    }),
  },

  phillip: {
    basicCharge: m('Strike Anywhere', {
      kind: 'burst', type: H, damage: 8, chargeDamageMult: 2.1, chargeRadiusMult: 1.5,
      maxChargeMs: 750, radius: 52, offsetX: 46, vfx: 'fire', vfxColor: 0xfff2c0,
      baseKnockback: 170, duration: 240, cooldown: 680,
    }),
    basicDirectional: melee('Glow Strike', {
      type: K, damage: 7, onHit: { burn: { dps: 2.2, ms: 1400 } },
      vfx: 'fire', vfxColor: 0xe8ffb0, duration: 250, cooldown: 560,
    }),
    specialDefense: m('Red Phosphorus Form', {
      blocks: [H], debuffImmune: true, duration: 900, cooldown: 700,
      vfx: 'shield', vfxColor: 0xff4a4a,
    }),
    specialDirectional: m('Spontaneous Ignition', {
      kind: 'burst', type: H, damage: 9, radius: 78, vfx: 'fire',
      zone: { type: H, damage: 3, ms: 1800, radius: 70, tick: 400, color: 0xff6a1a },
      baseKnockback: 160, duration: 280, cooldown: 860,
    }),
  },

  sully: {
    basicCharge: m('Black Powder', {
      kind: 'burst', type: H, damage: 8, type2: K, damage2: 6,
      chargeDamageMult: 2, chargeRadiusMult: 1.6, maxChargeMs: 800,
      radius: 54, offsetX: 50, vfx: 'supernova', vfxColor: 0xffb020,
      baseKnockback: 230, duration: 260, cooldown: 740,
    }),
    basicDirectional: melee('Brimstone Slam', {
      type: K, damage: 6, type2: H, damage2: 5, vfx: 'fire', vfxColor: 0x6ecbff,
      baseKnockback: 210, duration: 240, cooldown: 360,
    }),
    specialDefense: m('Vulcanized Rubber', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.7,
      retort: { when: K, type: K, damage: 4, knockback: 280 },
      duration: 700, cooldown: 720, vfx: 'shield',
    }),
    specialDirectional: m('Volcanic Eruption', {
      kind: 'burst', type: H, damage: 8, type2: C, damage2: 6,
      radius: 96, vfx: 'cloud', vfxColor: 0xffb020,
      baseKnockback: 200, duration: 320, cooldown: 900,
    }),
  },

  chloe: {
    basicCharge: m('Bleach Out', {
      kind: 'projectile', type: C, damage: 9, stripBuffs: true,
      chargeDamageMult: 1.7, maxChargeMs: 750, vfx: 'acid', vfxColor: 0xe6f27a,
      projectileSpeed: 480, projectileRadius: 16, projectileLife: 600,
      baseKnockback: 150, duration: 240, cooldown: 740,
    }),
    basicDirectional: melee('Toxic Jab', {
      type: C, damage: 8, vfx: 'cloud', vfxColor: 0xd4e857,
      duration: 240, cooldown: 500,
    }),
    specialDefense: m('Salt Bond', {
      kind: 'counter', counterDamage: 6, counterType: C, counterKnockback: 120,
      counterRootMs: 520, rootBonusVs: 'alkali',
      duration: 520, cooldown: 780, vfx: 'shield', vfxColor: 0xf4f4f4,
    }),
    specialDirectional: m('Gas Cloud', {
      kind: 'zone', type: C, damage: 3, vfx: 'cloud', vfxColor: 0xd4e857,
      zone: { type: C, damage: 3.5, ms: 2400, radius: 70, tick: 360, low: true, color: 0xd4e857 },
      baseKnockback: 40, duration: 260, cooldown: 980,
    }),
  },

  aaron: {
    basicCharge: melee('Lazy Haymaker', {
      type: K, damage: 7, chargeDamageMult: 2.8, chargeKnockbackMult: 2,
      maxChargeMs: 1100, rangeW: 78, baseKnockback: 200, vfx: 'strike',
      duration: 280, cooldown: 520,
    }),
    basicDirectional: melee('Inert Guard Strike', {
      type: K, damage: 8, guardStrike: 0.5, vfx: 'strike',
      duration: 240, cooldown: 340,
    }),
    specialDefense: m('Shield Gas', {
      blocks: [H, E], duration: 800, cooldown: 700, vfx: 'shield', vfxColor: 0xc9b6ff,
    }),
    specialDirectional: m('Noble Discharge', {
      kind: 'burst', type: E, damage: 12, radius: 88, vfx: 'spark', vfxColor: 0xc9b6ff,
      baseKnockback: 190, duration: 280, cooldown: 840,
    }),
  },

  kyle: {
    basicCharge: m('Action Potential', {
      kind: 'projectile', type: E, damage: 7, fizzleBelow: 0.9,
      maxChargeMs: 800, onHit: { stun: 450 }, vfx: 'spark', vfxColor: 0xd2b6ff,
      projectileSpeed: 620, projectileRadius: 14, projectileLife: 480,
      baseKnockback: 80, duration: 200, cooldown: 760,
    }),
    basicDirectional: melee('Static Cross', {
      type: K, damage: 5, type2: E, damage2: 4, vfx: 'spark',
      duration: 200, cooldown: 300,
    }),
    specialDefense: m('Ion Channel', {
      kind: 'counter', counterOnTypes: [E, K], counterDamage: 8, counterType: E,
      counterKnockback: 170, duration: 520, cooldown: 740, vfx: 'spark',
    }),
    specialDirectional: m('Nerve Shock', {
      kind: 'burst', type: E, damage: 9, radius: 86, vfx: 'spark',
      onHit: { interrupt: 280 }, baseKnockback: 150, duration: 240, cooldown: 780,
    }),
  },

  cal: {
    basicCharge: m('Calcify', {
      kind: 'buff', duration: 260, cooldown: 1100, maxChargeMs: 700, vfx: 'shield',
      buff: { ms: 4000, kineticTaken: 0.62, bonus: { type: K, damage: 6, hits: 1, name: 'Calcify' } },
    }),
    basicDirectional: melee('Bone Crush', {
      type: K, damage: 10, bonusVsBlock: 0.5, baseKnockback: 220,
      vfx: 'strike', duration: 250, cooldown: 380,
    }),
    specialDefense: m('Quick-Set Cement', {
      kind: 'wall', frontOnly: true, blocks: [K, H], wallRootMs: 420,
      duration: 900, cooldown: 860, vfx: 'cement', vfxColor: 0xd9d3c7,
      wallDamage: 4, wallType: K, wallKnockback: 80, wallKnockbackGrowth: 2,
      wallRangeW: 34, wallRangeH: 96, wallYFrac: 0.65,
    }),
    specialDirectional: m('Marrow Burst', {
      kind: 'burst', type: H, damage: 7, type2: C, damage2: 6,
      radius: 84, vfx: 'acid', vfxColor: 0xffb020,
      baseKnockback: 170, duration: 280, cooldown: 840,
    }),
  },

  scarlett: {
    basicCharge: melee('Afterburner', {
      kind: 'dash', type: K, damage: 7, type2: H, damage2: 5,
      chargeDamageMult: 1.9, chargeDashMult: 1.5, maxChargeMs: 700,
      dashSpeed: 640, rangeW: 100, rangeH: 70, vfx: 'fire',
      baseKnockback: 220, duration: 280, cooldown: 720,
    }),
    basicDirectional: melee('Wing Slash', {
      type: K, damage: 8, rangeW: 100, rangeH: 72, vfx: 'strike',
      duration: 230, cooldown: 290,
    }),
    specialDefense: m('Folded Wings', {
      blocks: [K], reflectProjectiles: 'perfect', perfectMs: 200,
      duration: 600, cooldown: 700, vfx: 'shield',
    }),
    specialDirectional: m('Aerial Dive', {
      kind: 'dive', type: K, damage: 11, radius: 88, diveVY: 460, dashSpeed: 160,
      vfx: 'dash', baseKnockback: 240, duration: 420, cooldown: 860,
    }),
  },

  titan: {
    basicCharge: melee('Titanium Ram', {
      kind: 'dash', type: K, damage: 9, type2: H, damage2: 2,
      chargeDamageMult: 2, chargeDashMult: 1.35, maxChargeMs: 750,
      dashSpeed: 580, rangeW: 96, rangeH: 80, vfx: 'spark',
      baseKnockback: 230, duration: 280, cooldown: 700,
    }),
    basicDirectional: melee('Lance Jab', {
      type: K, damage: 8, rangeW: 84, rangeH: 36, vfx: 'strike',
      duration: 280, cooldown: 700,
    }),
    specialDefense: m('Aerospace Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.62, blocks: [C], noKnockback: true,
      duration: 750, cooldown: 700, vfx: 'shield', vfxColor: 0xb9c6d6,
    }),
    specialDirectional: m('Aero Lance', {
      kind: 'projectile', type: K, damage: 11, pierce: true, visualShape: 'spearhead', vfx: 'strike',
      projectileSpeed: 480, projectileRadius: 10, projectileLife: 700,
      baseKnockback: 220, duration: 240, cooldown: 1100,
    }),
  },

  van: {
    basicCharge: m('Redox Flow', {
      kind: 'buff', redox: true, duration: 220, cooldown: 400, maxChargeMs: 800,
      vfx: 'spark', vfxColor: 0x8af5c9,
    }),
    basicDirectional: melee('Alloy Fist', {
      type: K, damage: 9, breaksBlock: 'weak', vfx: 'strike',
      baseKnockback: 200, duration: 270, cooldown: 800,
    }),
    specialDefense: m('Four-State Guard', {
      cycle: [E, C, H, K], cycleMs: 360,
      duration: 1200, cooldown: 700, vfx: 'spark',
    }),
    specialDirectional: m('Prism Surge', {
      kind: 'burst', type: E, damage: 12, radius: 82, vfx: 'spark', vfxColor: 0x8af5c9,
      baseKnockback: 180, duration: 260, cooldown: 1100,
    }),
  },

  chroma: {
    basicCharge: m('Ruby Laser', {
      kind: 'beam', type: H, damage: 8, chargeDamageMult: 1.7, chargeLengthMult: 2.6,
      maxChargeMs: 900, beamLen: 160, beamThick: 16, vfx: 'laser', vfxColor: 0xff2a3a,
      baseKnockback: 150, duration: 200, cooldown: 720,
    }),
    basicDirectional: melee('Chrome Edge', {
      type: K, damage: 10, rangeW: 74, vfx: 'strike', vfxColor: 0xe8eef2,
      baseKnockback: 190, duration: 280, cooldown: 660,
    }),
    specialDefense: m('Mirror Chrome', {
      reflectProjectiles: true, duration: 700, cooldown: 720,
      vfx: 'shield', vfxColor: 0xe8eef2,
    }),
    specialDirectional: m('Prismatic Shatter', {
      kind: 'burst', type: K, damage: 12, radius: 80, vfx: 'spark', vfxColor: 0xff2a3a,
      baseKnockback: 210, duration: 280, cooldown: 960,
    }),
  },

  // --- pilot roster (Ta, W, Re, Os, Pt). Numbers are the balance pass. ---
  // Knockback growth is set below the kit default (5.4) on the pokes that were
  // launching gases off Elemental Isle while those gases were ahead on percent.
  tara: {
    basicCharge: m('Capacitor Dump', {
      kind: 'beam', type: E, damage: 8, chargeDamageMult: 1.75, chargeLengthMult: 2.15,
      maxChargeMs: 760, beamLen: 148, beamThick: 24, vfx: 'laser', vfxColor: 0x7ec8ff,
      baseKnockback: 150, duration: 200, cooldown: 740,
    }),
    basicDirectional: melee('Tantalizing Hook', {
      type: K, damage: 7, pull: 210, rangeW: 92, rangeH: 42, vfx: 'spark',
      baseKnockback: 40, knockbackGrowth: 1.2, duration: 240, cooldown: 460,
    }),
    specialDefense: m('Tantalus Guard', {
      immune: [C], duration: 820, cooldown: 760, vfx: 'shield', vfxColor: 0xb7f27a,
    }),
    specialDirectional: m('Implant Pin', {
      kind: 'projectile', type: K, damage: 7, visualShape: 'spearhead', vfx: 'strike',
      onHit: { root: 780 }, projectileSpeed: 500, projectileRadius: 7, projectileLife: 520,
      baseKnockback: 70, knockbackGrowth: 2, duration: 220, cooldown: 860,
    }),
  },

  wolf: {
    basicCharge: m('White-Hot Filament', {
      kind: 'burst', type: H, damage: 7, chargeDamageMult: 1.9, chargeRadiusMult: 1.85,
      maxChargeMs: 1200, radius: 56, vfx: 'fire', vfxColor: 0xfff1c2,
      baseKnockback: 160, duration: 280, cooldown: 1100,
    }),
    basicDirectional: melee('Tin Eater', {
      kind: 'dash', type: K, damage: 7, dashSpeed: 440, rangeW: 84, rangeH: 72,
      bonusVsId: { sandy: 2 }, vfx: 'dash', baseKnockback: 170, knockbackGrowth: 3.8,
      duration: 280, cooldown: 760,
    }),
    specialDefense: m('Unmeltable', {
      immune: [H], kind: 'block', onlyReduce: [K], blockReduction: 0.22,
      duration: 780, cooldown: 760, vfx: 'shield', vfxColor: 0xffe2a8,
    }),
    specialDirectional: m('Armor Piercer', {
      kind: 'projectile', type: K, damage: 7, breaksBlock: true, pierce: true,
      visualShape: 'spearhead', vfx: 'strike',
      projectileSpeed: 580, projectileRadius: 7, projectileLife: 460,
      baseKnockback: 190, duration: 220, cooldown: 1280,
    }),
  },

  rex: {
    basicCharge: m('High Octane', {
      kind: 'buff', duration: 200, cooldown: 1200, maxChargeMs: 700, vfx: 'fire', vfxColor: 0xff9a2a,
      buff: { ms: 2200, speed: 1.18, heated: true, armDash: { heat: 5, dashSpeed: 520 } },
    }),
    basicDirectional: melee("King's Edge", {
      type: K, damage: 6, heatEmpower: 3, rangeW: 76, vfx: 'strike',
      baseKnockback: 170, knockbackGrowth: 3.6, duration: 250, cooldown: 720,
    }),
    specialDefense: m('Creep Resistance', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.32, noKnockback: true,
      debuffImmune: true, grabImmune: true,
      duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xd9dde6,
    }),
    specialDirectional: melee('Thermocouple Lash', {
      type: E, damage: 6, rangeW: 112, rangeH: 30, vfx: 'spark', vfxColor: 0xffb45a,
      vsHot: { type: H, damage: 10 },
      baseKnockback: 150, duration: 240, cooldown: 980,
    }),
  },

  oz: {
    basicCharge: m('Densest Slam', {
      kind: 'burst', type: K, damage: 7, chargeDamageMult: 1.75, chargeRadiusMult: 2.15,
      maxChargeMs: 900, radius: 54, vfx: 'strike',
      baseKnockback: 190, knockbackGrowth: 3.2, duration: 300, cooldown: 1120,
    }),
    basicDirectional: melee('Nib Stab', {
      type: K, damage: 7, sweetSpot: 2, rangeW: 46, rangeH: 28, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 2, duration: 200, cooldown: 680,
    }),
    specialDefense: m('Immovable Object', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.55, noKnockback: true,
      recoil: { type: K, damage: 4, knockback: 120 },
      duration: 780, cooldown: 980, vfx: 'shield', vfxColor: 0x9aa4b8,
    }),
    specialDirectional: m('Tetroxide Puff', {
      kind: 'burst', type: C, damage: 5, radius: 68, vfx: 'cloud', vfxColor: 0xc6f07a,
      onHit: { drift: 900 },
      zone: { type: C, damage: 1.8, ms: 1800, radius: 60, tick: 420, color: 0xc6f07a },
      baseKnockback: 110, knockbackGrowth: 2.4, duration: 280, cooldown: 1100,
    }),
  },

  pit: {
    basicCharge: m('Catalyst Ignition', {
      kind: 'burst', type: H, damage: 7, chargeDamageMult: 1.55, chargeRadiusMult: 1.45,
      maxChargeMs: 800, radius: 88, bonusVsState: { gas: 1.7 }, igniteGases: true, gasCloud: 6,
      vfx: 'fire', vfxColor: 0xfff6d0, baseKnockback: 150, duration: 260, cooldown: 980,
    }),
    basicDirectional: melee('Record Scratch', {
      type: K, damage: 6, rangeW: 78, onHit: { interrupt: 220 }, vfx: 'strike',
      baseKnockback: 110, knockbackGrowth: 2, duration: 210, cooldown: 480,
    }),
    specialDefense: m('Cisplatin Clamp', {
      kind: 'counter', counterDamage: 7, counterType: C, rootMs: 700,
      duration: 560, cooldown: 860, vfx: 'shield', vfxColor: 0xe7eef2,
    }),
    specialDirectional: m('Flame Test', {
      kind: 'projectile', type: H, damage: 5, type2: C, damage2: 5, vfx: 'fire',
      projectileSpeed: 460, projectileRadius: 12, projectileLife: 680,
      baseKnockback: 150, duration: 230, cooldown: 900,
    }),
  },

  // --- wave 2. Numbers are the balance pass. Knockback growth stays under
  // the 5.4 default so a heavy metal does not launch the light gases. ---
  caesar: {
    basicCharge: m('Defining Second', {
      kind: 'burst', type: K, damage: 0, radius: 72, chargeRadiusMult: 1.45,
      maxChargeMs: 1000, onHit: { freeze: 180 }, chargeControlMult: 5.5,
      baseKnockback: 0, knockbackGrowth: 0, duration: 220, cooldown: 1180, vfx: 'spark',
    }),
    basicDirectional: melee('Rubicon Dash', {
      kind: 'dash', type: K, damage: 6, type2: H, damage2: 4, hyperArmor: true,
      dashSpeed: 500, rangeW: 90, rangeH: 70, vfx: 'fire',
      baseKnockback: 130, knockbackGrowth: 2.2, duration: 280, cooldown: 820,
    }),
    specialDefense: m('Electron Tribute', {
      kind: 'block', onlyReduce: [C, E], blockReduction: 0.5,
      recoil: { type: C, damage: 3, knockback: 70 },
      duration: 720, cooldown: 860, vfx: 'shield', vfxColor: 0xf2d36b,
    }),
    specialDirectional: m('Fallout Coin', {
      kind: 'projectile', type: R, damage: 2, vfx: 'spark', vfxColor: 0xc6f07a,
      dropZone: { type: R, damage: 1.3, ms: 2000, radius: 50, tick: 420, knockback: 20, growth: 0.2, color: 0xc6f07a },
      projectileSpeed: 360, projectileRadius: 8, projectileLife: 680,
      baseKnockback: 40, knockbackGrowth: 0.5, duration: 220, cooldown: 1080,
    }),
  },

  barry: {
    basicCharge: m('Heavyweight Drop', {
      kind: 'burst', type: K, damage: 6, chargeDamageMult: 1.65, chargeRadiusMult: 1.45,
      maxChargeMs: 900, radius: 54, onHit: { interrupt: 220 }, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 3.2, duration: 280, cooldown: 1040,
    }),
    basicDirectional: melee('Mud Weight', {
      type: K, damage: 6, onHit: { slow: 800 }, rangeW: 74, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 3.4, duration: 240, cooldown: 600,
    }),
    specialDefense: m('Barium Meal', {
      immune: [R], weightMult: 1.45, duration: 800, cooldown: 900, vfx: 'shield', vfxColor: 0xd8d2c4,
    }),
    specialDirectional: m('Poison Pellet', {
      kind: 'projectile', type: C, damage: 3, ground: true, vfx: 'cloud',
      dropZone: { type: C, damage: 1.0, ms: 1400, radius: 42, tick: 420, knockback: 12, growth: 0.2, color: 0x8fbf4a },
      projectileSpeed: 400, projectileRadius: 8, projectileLife: 640,
      baseKnockback: 50, knockbackGrowth: 0.7, duration: 220, cooldown: 1000,
    }),
  },

  ray: {
    basicCharge: m('Radium Tonic', {
      kind: 'buff', maxChargeMs: 1000, duration: 200, cooldown: 1200, vfx: 'spark', vfxColor: 0xd6ff8a,
      selfDamage: { type: R, damage: 3, withCharge: true, noFlinch: true },
      buff: { scaleWithCharge: true, ms: 1800, bonus: { type: R, damage: 2, hits: 2 } },
    }),
    basicDirectional: melee('Alpha Uppercut', {
      type: K, damage: 5, type2: R, damage2: 4, lift: true, rangeW: 50, rangeH: 64, vfx: 'spark',
      baseKnockback: 100, knockbackGrowth: 1.5, duration: 240, cooldown: 560,
    }),
    specialDefense: m('Decay Halo', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4,
      recoil: { type: R, damage: 4, knockback: 80 },
      duration: 720, cooldown: 860, vfx: 'shield', vfxColor: 0xd6ff8a,
    }),
    specialDirectional: m('Luminous Splash', {
      kind: 'projectile', type: R, damage: 2, angleable: true, vfx: 'spark', vfxColor: 0xe8ffb0,
      dropZone: { type: R, damage: 1.1, ms: 1600, radius: 44, tick: 400, knockback: 14, growth: 0.2, color: 0xe8ffb0 },
      projectileSpeed: 400, projectileRadius: 10, projectileLife: 600,
      baseKnockback: 50, knockbackGrowth: 0.8, duration: 220, cooldown: 900,
    }),
  },

  collin: {
    basicCharge: m('Gamma Knife', {
      kind: 'beam', type: R, damage: 11, chargeDamageMult: 1.65, chargeLengthMult: 2.1,
      maxChargeMs: 900, beamLen: 146, beamThick: 16, vfx: 'laser', vfxColor: 0xb7ff6a,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 200, cooldown: 760,
    }),
    basicDirectional: melee('Kobold Strike', {
      kind: 'dash', type: K, damage: 8, onHit: { root: 400 }, dashSpeed: 460,
      rangeW: 80, rangeH: 40, vfx: 'dash',
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 260, cooldown: 680,
    }),
    specialDefense: m('Superalloy Shell', {
      immune: [H], kind: 'block', onlyReduce: [K], blockReduction: 0.35,
      duration: 760, cooldown: 880, vfx: 'shield', vfxColor: 0x8aa4c8,
    }),
    specialDirectional: m('Blue Glaze', {
      kind: 'projectile', type: H, damage: 8, onHit: { slow: 1000 }, vfx: 'fire', vfxColor: 0x3a6adf,
      projectileSpeed: 440, projectileRadius: 10, projectileLife: 540,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 220, cooldown: 680,
    }),
  },

  cooper: {
    basicCharge: m('Electromagnet', {
      kind: 'burst', type: E, damage: 3, pull: 150, chargeDamageMult: 1.35, chargeRadiusMult: 1.4,
      maxChargeMs: 800, radius: 66, vfx: 'spark',
      baseKnockback: 24, knockbackGrowth: 0.5, duration: 260, cooldown: 1040,
    }),
    basicDirectional: melee('Live Wire', {
      type: K, damage: 5, type2: E, damage2: 3, rangeW: 116, rangeH: 28, vfx: 'spark',
      baseKnockback: 130, knockbackGrowth: 3.0, duration: 220, cooldown: 540,
    }),
    specialDefense: m('Grounding Rod', {
      immune: [E],
      zone: { type: E, damage: 1.1, ms: 780, radius: 48, tick: 360, knockback: 20, growth: 0.2, color: 0x7ec8ff },
      duration: 780, cooldown: 900, vfx: 'shield', vfxColor: 0xc47a3a,
    }),
    specialDirectional: m('Verdigris Spray', {
      kind: 'projectile', type: C, damage: 3, vfx: 'cloud', vfxColor: 0x6fbf73,
      onHit: { poison: { dps: 0.4, ms: 1200 }, weaken: { mult: 0.8, ms: 1200 } },
      projectileSpeed: 400, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 40, knockbackGrowth: 0.6, duration: 220, cooldown: 1100,
    }),
  },

  agatha: {
    basicCharge: m('Silver Bullet', {
      kind: 'projectile', type: K, damage: 6, bonusVsBuff: 1.75, chargeDamageMult: 1.55,
      maxChargeMs: 700, vfx: 'strike', vfxColor: 0xe8eef2,
      projectileSpeed: 560, projectileRadius: 6, projectileLife: 460,
      baseKnockback: 280, knockbackGrowth: 4.6, duration: 200, cooldown: 860,
    }),
    basicDirectional: melee('Silver Lining', {
      type: K, damage: 5, type2: E, damage2: 4, rangeW: 86, vfx: 'spark',
      baseKnockback: 160, knockbackGrowth: 3.8, duration: 220, cooldown: 480,
    }),
    specialDefense: m('Photo Negative', {
      immune: [H, R], capture: true, duration: 700, cooldown: 840, vfx: 'shield', vfxColor: 0xd8dde6,
    }),
    specialDirectional: m('Darkroom Print', {
      kind: 'projectile', type: H, damage: 4, replayCapture: true, onHit: { blind: 260 },
      vfx: 'spark', vfxColor: 0xfff6d0,
      projectileSpeed: 520, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 90, knockbackGrowth: 1.5, duration: 220, cooldown: 960,
    }),
  },

  cody: {
    basicCharge: m('Quantum Dot', {
      kind: 'projectile', type: E, damage: 4, chargeDamageMult: 2.3, chargeSpeedMult: 0.42,
      maxChargeMs: 1000, vfx: 'spark', vfxColor: 0xff4a3a,
      projectileSpeed: 640, projectileRadius: 8, projectileLife: 680,
      baseKnockback: 90, knockbackGrowth: 2.4, duration: 200, cooldown: 880,
    }),
    basicDirectional: melee('Battery Prod', {
      type: K, damage: 6, type2: E, damage2: 4, rangeW: 64, vfx: 'spark',
      baseKnockback: 120, knockbackGrowth: 2.6, duration: 210, cooldown: 460,
    }),
    specialDefense: m('Control Rod', {
      immune: [R], kind: 'block', onlyReduce: [H], blockReduction: 0.45,
      duration: 760, cooldown: 880, vfx: 'shield', vfxColor: 0xf0d24a,
    }),
    specialDirectional: m('Yellow Paint Bomb', {
      kind: 'projectile', type: C, damage: 4, vfx: 'cloud', vfxColor: 0xf0d24a,
      onHit: { slow: 1100, poison: { dps: 1.1, ms: 1400 } },
      projectileSpeed: 420, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 60, knockbackGrowth: 1, duration: 220, cooldown: 920,
    }),
  },

  aurelius: {
    basicCharge: m('Midas Touch', {
      type: K, damage: 6, pull: 140, onHit: { freeze: 640 }, rangeW: 56, rangeH: 48,
      maxChargeMs: 700, chargeDamageMult: 1.25, vfx: 'spark', vfxColor: 0xf0c84a,
      baseKnockback: 18, knockbackGrowth: 0.25, duration: 240, cooldown: 960,
    }),
    basicDirectional: melee('Gold Leaf Sweep', {
      type: K, damage: 6, rangeW: 120, rangeH: 34, vfx: 'strike', vfxColor: 0xf0c84a,
      baseKnockback: 100, knockbackGrowth: 3.2, duration: 190, cooldown: 420,
    }),
    specialDefense: m('Golden Visor', {
      immune: [C], reflectTypes: [H, R], duration: 720, cooldown: 900, vfx: 'shield', vfxColor: 0xf0c84a,
    }),
    specialDirectional: m('Ingot Lob', {
      kind: 'projectile', type: K, damage: 7, angleable: true, vfx: 'strike', vfxColor: 0xf0c84a,
      projectileSpeed: 330, projectileRadius: 14, projectileLife: 700,
      baseKnockback: 140, knockbackGrowth: 3.2, duration: 240, cooldown: 860,
    }),
  },

  talia: {
    basicCharge: m('Poisoner\'s Poison', {
      kind: 'burst', type: C, damage: 0, radius: 62, chargeRadiusMult: 1.55, maxChargeMs: 900,
      zone: { type: C, damage: 1.7, ramp: 0.5, ms: 2400, radius: 68, tick: 340, knockback: 8, growth: 0.1, color: 0x9d6bff },
      baseKnockback: 0, knockbackGrowth: 0, duration: 240, cooldown: 860, vfx: 'cloud',
    }),
    basicDirectional: melee('Green Line Stab', {
      type: K, damage: 7, type2: C, damage2: 5, rangeW: 58, vfx: 'strike', vfxColor: 0x7dff6a,
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 180, cooldown: 360,
    }),
    specialDefense: m('Prussian Blue', {
      immune: [C], cleanse: ['poison'], duration: 760, cooldown: 860, vfx: 'shield', vfxColor: 0x2a4ac8,
    }),
    specialDirectional: m('Pale Horse Dart', {
      kind: 'projectile', type: K, damage: 3, vfx: 'strike',
      onHit: { poison: { dps: 6, ms: 360, delay: 1100 } },
      projectileSpeed: 500, projectileRadius: 6, projectileLife: 460,
      baseKnockback: 40, knockbackGrowth: 0.5, duration: 200, cooldown: 920,
    }),
  },

  bianca: {
    basicCharge: m('Hopper Crystal', {
      kind: 'projectile', type: K, damage: 7, pierce: true, chargeDamageMult: 1.35,
      maxChargeMs: 800, vfx: 'spark', vfxColor: 0xc48bff,
      projectileSpeed: 420, projectileRadius: 12, projectileLife: 520,
      baseKnockback: 175, knockbackGrowth: 4.2, duration: 220, cooldown: 720,
    }),
    basicDirectional: melee('Staircase Kick', {
      type: K, damage: 4, multiHit: 3, rangeW: 70, rangeH: 56, vfx: 'strike',
      baseKnockback: 120, knockbackGrowth: 3.8, duration: 320, cooldown: 520,
    }),
    specialDefense: m('Diamagnetic Repel', {
      grabImmune: true, slowProjectiles: 0.28, float: true,
      duration: 700, cooldown: 880, vfx: 'shield', vfxColor: 0xd7c4ff,
    }),
    specialDirectional: m('Pink Bismuth', {
      kind: 'projectile', type: C, damage: 6, vfx: 'cloud', vfxColor: 0xff8ac4,
      dropZone: { type: C, damage: 1.2, ms: 1200, radius: 42, tick: 400, knockback: 16, growth: 0.2, color: 0xff8ac4, cleanseOwner: ['poison'] },
      projectileSpeed: 360, projectileRadius: 12, projectileLife: 600,
      baseKnockback: 100, knockbackGrowth: 2.4, duration: 220, cooldown: 960,
    }),
  },

  polonius: {
    basicCharge: m('Blue Glow Burst', {
      kind: 'burst', type: H, damage: 8, type2: R, damage2: 7, chargeDamageMult: 1.55, chargeRadiusMult: 1.6,
      maxChargeMs: 900, radius: 64, vfx: 'fire', vfxColor: 0x6ad0ff,
      baseKnockback: 140, knockbackGrowth: 3.0, duration: 260, cooldown: 780,
    }),
    basicDirectional: melee('Rapier Thrust', {
      type: K, damage: 6, type2: R, damage2: 5, rangeW: 92, rangeH: 24, vfx: 'strike',
      baseKnockback: 200, knockbackGrowth: 2.5, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Behind the Arras', {
      kind: 'wall', frontOnly: true, backOpen: true, behindMult: 2, pierceMult: 2,
      blocks: [K, H, E, C, R],
      wallDamage: 0, wallType: K, wallKnockback: 0, wallKnockbackGrowth: 0,
      wallRangeW: 26, wallRangeH: 100, wallYFrac: 0.7,
      duration: 640, cooldown: 960, vfx: 'wall', vfxColor: 0x6a4a38,
    }),
    specialDirectional: melee('Static Eliminator', {
      type: R, damage: 9, stripBuffs: true, onHit: { strip: true }, rangeW: 100, rangeH: 36,
      vfx: 'spark', baseKnockback: 60, knockbackGrowth: 0.9, duration: 220, cooldown: 640,
    }),
  },

  tate: {
    basicCharge: m('Self-Vaporize', {
      kind: 'burst', type: H, damage: 8, type2: R, damage2: 7, commit: true,
      chargeDamageMult: 1.45, chargeRadiusMult: 1.45, maxChargeMs: 1000, radius: 78,
      selfDamage: { type: R, damage: 2, withCharge: true, noFlinch: true }, blinkMs: 420,
      vfx: 'fire', vfxColor: 0xfff2a8,
      baseKnockback: 100, knockbackGrowth: 1.6, duration: 260, cooldown: 860,
    }),
    basicDirectional: melee('Targeted Alpha', {
      type: R, damage: 11, breaksBlock: true, rangeW: 52, vfx: 'spark',
      baseKnockback: 80, knockbackGrowth: 1.3, duration: 210, cooldown: 420,
    }),
    specialDefense: m('Never Seen', {
      phase: true, drain: { damage: 1, type: R, every: 1000 },
      duration: 900, cooldown: 1040, vfx: 'shield', vfxColor: 0xc9d6e0,
    }),
    specialDirectional: m('Unstable Bolt', {
      kind: 'projectile', type: C, damage: 7, type2: R, damage2: 6, vfx: 'spark',
      projectileSpeed: 500, projectileRadius: 9, projectileLife: 500,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 210, cooldown: 640,
    }),
  },

  brock: {
    basicCharge: m('Bromos Stench', {
      kind: 'burst', type: C, damage: 8, radius: 72, bonusVsMark: 'stain', markMult: 1.35, onHit: { drift: 650 },
      chargeDamageMult: 1.45, chargeRadiusMult: 1.5, maxChargeMs: 900, vfx: 'cloud', vfxColor: 0x8a3a22,
      baseKnockback: 70, knockbackGrowth: 2.4, duration: 240, cooldown: 780,
    }),
    basicDirectional: m('Caustic Splash', {
      kind: 'projectile', type: C, damage: 7, bonusVsMark: 'stain', markMult: 1.35, vfx: 'cloud',
      projectileSpeed: 460, projectileRadius: 11, projectileLife: 460,
      baseKnockback: 145, knockbackGrowth: 3.4, duration: 200, cooldown: 520,
    }),
    specialDefense: m('Red Fume Screen', {
      softenProjectiles: 0.35,
      zone: { type: C, damage: 0, ms: 800, radius: 68, tick: 360, knockback: 0, growth: 0, onHit: { blind: 480 }, color: 0x8a3a22 },
      duration: 800, cooldown: 900, vfx: 'cloud', vfxColor: 0x8a3a22,
    }),
    specialDirectional: m('Tyrian Purple', {
      kind: 'projectile', type: C, damage: 6, bonusVsMark: 'stain', markMult: 1.35,
      onHit: { mark: 'stain', markMs: 3600 }, vfx: 'cloud', vfxColor: 0x6a2a8a,
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 90, knockbackGrowth: 2.2, duration: 210, cooldown: 700,
    }),
  },

  ceres: {
    basicCharge: m('Ferro Rod Sparks', {
      kind: 'beam', type: H, damage: 10, chargeDamageMult: 1.55, chargeLengthMult: 2,
      maxChargeMs: 800, beamLen: 128, beamThick: 26, vfx: 'fire', vfxColor: 0xffb45a,
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 200, cooldown: 700,
    }),
    basicDirectional: melee('Ceria Polish', {
      type: K, damage: 5, multiHit: 4, bonusVsBlock: 0.8, popShield: true, rangeW: 64, vfx: 'strike',
      baseKnockback: 40, knockbackGrowth: 0.7, duration: 340, cooldown: 400,
    }),
    specialDefense: m('Self-Cleaning', {
      immune: [H], cleanse: ['poison', 'burn', 'slow', 'debuff'],
      duration: 740, cooldown: 880, vfx: 'fire', vfxColor: 0xffd0a0,
    }),
    specialDirectional: m('Dwarf Planet', {
      kind: 'projectile', type: K, damage: 10, ground: true, vfx: 'strike',
      projectileSpeed: 300, projectileRadius: 16, projectileLife: 780,
      baseKnockback: 120, knockbackGrowth: 1.8, duration: 240, cooldown: 760,
    }),
  },

  europa: {
    basicCharge: m('Phosphor Bloom', {
      kind: 'burst', type: R, damage: 10, chargeDamageMult: 1.5, chargeRadiusMult: 1.4,
      maxChargeMs: 900, radius: 72, vfx: 'spark', vfxColor: 0xff4a6a,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 240, cooldown: 760,
    }),
    basicDirectional: melee('Counterfeit Check', {
      type: K, damage: 8, stripBuffs: true, onHit: { strip: true }, breakPhase: true, rangeW: 72, vfx: 'strike',
      baseKnockback: 80, knockbackGrowth: 1.3, duration: 220, cooldown: 400,
    }),
    specialDefense: m('Ice Moon Shell', {
      blocks: [K, H], duration: 760, cooldown: 900, vfx: 'shield', vfxColor: 0xbfe8ff,
    }),
    specialDirectional: m('Banknote Star', {
      kind: 'projectile', type: K, damage: 9, vfx: 'strike', vfxColor: 0xf0d24a,
      projectileSpeed: 480, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 200, cooldown: 600,
    }),
  },

  dizzy: {
    basicCharge: melee('Hard to Get', {
      type: K, damage: 7, whileCharging: { keep: 0.35 }, chargeDamageMult: 1.45,
      maxChargeMs: 800, rangeW: 72, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 3.4, duration: 240, cooldown: 680,
    }),
    basicDirectional: melee('Dizzy Spin', {
      type: K, damage: 5, multiHit: 3, onHit: { drift: 360 }, rangeW: 68, vfx: 'strike',
      baseKnockback: 70, knockbackGrowth: 2.4, duration: 320, cooldown: 420,
    }),
    specialDefense: m('Spin Deflect', {
      reflectProjectiles: true, duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xc48bff,
    }),
    specialDirectional: m('Vertigo Wave', {
      kind: 'projectile', type: K, damage: 8, onHit: { drift: 780 }, vfx: 'gust',
      projectileSpeed: 420, projectileRadius: 14, projectileLife: 540,
      baseKnockback: 90, knockbackGrowth: 2.4, duration: 220, cooldown: 640,
    }),
  },

  erin: {
    basicCharge: m('Undersea Cable', {
      kind: 'beam', type: E, damage: 10, chargeDamageMult: 1.5, chargeLengthMult: 2.05,
      maxChargeMs: 900, beamLen: 156, beamThick: 14, vfx: 'spark', vfxColor: 0xff7ab0,
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 200, cooldown: 700,
    }),
    basicDirectional: melee('Pink Glass Swipe', {
      type: K, damage: 8, rangeW: 76, vfx: 'strike', vfxColor: 0xff8ac4,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 210, cooldown: 400,
    }),
    specialDefense: m('Signal Repeater', {
      retort: { when: E, type: E, damage: 10, knockback: 110, growth: 1.6 },
      duration: 600, cooldown: 900, vfx: 'shield', vfxColor: 0xff7ab0,
    }),
    specialDirectional: m('Resurface Laser', {
      kind: 'beam', type: H, damage: 10, popShield: true, breaksBlock: true,
      beamLen: 136, beamThick: 12, vfx: 'laser', vfxColor: 0xff4a6a,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 200, cooldown: 720,
    }),
  },

  ace: {
    basicCharge: m('Actinic Ray', {
      kind: 'beam', type: R, damage: 6, chargeDamageMult: 1.5, chargeLengthMult: 1.85,
      maxChargeMs: 850, beamLen: 138, beamThick: 16, vfx: 'laser', vfxColor: 0x8ad0ff,
      baseKnockback: 160, knockbackGrowth: 4.2, duration: 200, cooldown: 820,
    }),
    basicDirectional: melee('Ace of Rays', {
      type: K, damage: 5, type2: R, damage2: 5, rangeW: 70, vfx: 'spark',
      baseKnockback: 150, knockbackGrowth: 3.8, duration: 200, cooldown: 420,
    }),
    specialDefense: m('Wild Card', {
      cycle: [K, H, E, C, R], cycleMs: 280, cycleReflect: true,
      duration: 800, cooldown: 960, vfx: 'shield', vfxColor: 0xf0d24a,
    }),
    specialDirectional: m('Royal Flush', {
      kind: 'projectile', type: R, damage: 2.8, fan: 5, fanSpread: 240, vfx: 'spark',
      projectileSpeed: 460, projectileRadius: 6, projectileLife: 460,
      baseKnockback: 60, knockbackGrowth: 1.6, duration: 220, cooldown: 800,
    }),
  },

  thor: {
    basicCharge: m('Thunder Hammer', {
      kind: 'burst', type: K, damage: 6, type2: E, damage2: 5, chargeDamageMult: 1.45, chargeRadiusMult: 1.35,
      maxChargeMs: 900, radius: 58, vfx: 'spark', vfxColor: 0xf0d24a,
      baseKnockback: 120, knockbackGrowth: 1.7, duration: 280, cooldown: 1000,
    }),
    basicDirectional: melee('Thunderclap', {
      type: K, damage: 5, type2: E, damage2: 4, onHit: { interrupt: 140 }, rangeW: 80, vfx: 'spark',
      baseKnockback: 100, knockbackGrowth: 1.5, duration: 200, cooldown: 480,
    }),
    specialDefense: m('Breeder Blanket', {
      immune: [R], fuelFrom: 'radiation', fuelType: R, fuelDamage: 4,
      duration: 800, cooldown: 940, vfx: 'shield', vfxColor: 0xc8b48a,
    }),
    specialDirectional: m('Lantern Mantle', {
      kind: 'projectile', type: H, damage: 5, type2: R, damage2: 4, explodeOnly: true, explodeRadius: 50,
      vfx: 'fire', vfxColor: 0xfff6d0,
      projectileSpeed: 400, projectileRadius: 10, projectileLife: 540,
      baseKnockback: 110, knockbackGrowth: 1.6, duration: 220, cooldown: 960,
    }),
  },
};
