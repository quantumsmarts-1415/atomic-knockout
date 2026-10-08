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
      kind: 'projectile', type: K, damage: 8,
      chargeDamageMult: 1.7, chargeKnockbackMult: 1.6, chargeRadiusMult: 1.8,
      maxChargeMs: 700, lift: true, vfx: 'balloon',
      baseKnockback: 280, knockbackGrowth: 6.2,
      projectileSpeed: 340, projectileRadius: 16, projectileLife: 1000,
      duration: 260, cooldown: 860,
    }),
    basicDirectional: melee('Noble Gust', {
      type: K, damage: 5, baseKnockback: 300, knockbackGrowth: 7.2,
      rangeW: 64, rangeH: 50, vfx: 'gust', duration: 220, cooldown: 320,
    }),
    specialDefense: m('Bubble Shield', {
      kind: 'shield', duration: 1400, cooldown: 760, vfx: 'bubble', vfxColor: 0xbfefff,
    }),
    specialDirectional: m('Air Wave', {
      kind: 'projectile', type: K, damage: 7, vfx: 'gust',
      baseKnockback: 340, knockbackGrowth: 7,
      projectileSpeed: 480, projectileRadius: 28, projectileLife: 620,
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
      type: K, damage: 7, sweetSpot: 5, rangeW: 78, vfx: 'strike',
      duration: 200, cooldown: 300,
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
      baseKnockback: 190, duration: 240, cooldown: 780,
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
      type: K, damage: 9, baseKnockback: 200, rangeW: 76, vfx: 'strike',
      duration: 220, cooldown: 340,
    }),
    specialDefense: m('Diamond Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.78,
      duration: 700, cooldown: 680, vfx: 'shield', vfxColor: 0xd6f4ff,
    }),
    specialDirectional: m('Graphene Wave', {
      kind: 'burst', type: E, damage: 12, radius: 92, vfx: 'spark',
      baseKnockback: 200, duration: 280, cooldown: 820,
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
      onHit: { slow: 700 }, vfx: 'ice', duration: 200, cooldown: 320,
    }),
    specialDefense: m('Inert Shield', {
      kind: 'shield', duration: 900, cooldown: 700, vfx: 'bubble', vfxColor: 0xd8fff8,
    }),
    specialDirectional: m('Cryo Vortex', {
      kind: 'burst', type: H, damage: 10, radius: 84, vfx: 'ice',
      zone: { type: H, damage: 2, ms: 1600, radius: 78, tick: 400, slide: true, color: 0xbff6ff },
      baseKnockback: 180, duration: 300, cooldown: 860,
    }),
  },

  oxana: {
    basicCharge: m('Bellows Breath', {
      kind: 'projectile', type: K, damage: 4, flareHeat: 9,
      chargeDamageMult: 1.6, maxChargeMs: 700, vfx: 'gust',
      baseKnockback: 260, knockbackGrowth: 6,
      projectileSpeed: 500, projectileRadius: 26, projectileLife: 520,
      duration: 240, cooldown: 640,
    }),
    basicDirectional: melee('Vortex Kick', {
      type: K, damage: 8, flareHeat: 6, rangeW: 74, vfx: 'gust',
      duration: 230, cooldown: 340,
    }),
    specialDefense: m('Ozone Layer', {
      blocks: [R], duration: 800, cooldown: 720, vfx: 'shield', vfxColor: 0x9ad7ff,
    }),
    specialDirectional: m('Oxidation Burst', {
      kind: 'burst', type: H, damage: 7, type2: C, damage2: 6,
      radius: 86, rustMetals: true, vfx: 'acid',
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
      rangeW: 84, duration: 210, cooldown: 320,
    }),
    specialDefense: m('No Vacancy', {
      blocks: [K, H, E, C, R], frontOnly: true, openAfter: true, vulnerableMs: 650,
      duration: 900, cooldown: 400, vfx: 'shield', vfxColor: 0xff5a2a,
    }),
    specialDirectional: m('Neon Flare', {
      kind: 'burst', type: E, damage: 11, radius: 90, vfx: 'spark', vfxColor: 0xff5a2a,
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
      duration: 210, cooldown: 300,
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
      duration: 200, cooldown: 300,
    }),
    specialDefense: m('Ribbon Guard', {
      blocks: [K],
      retort: { when: H, type: H, damage: 8, knockback: 180 },
      duration: 650, cooldown: 680, vfx: 'shield', vfxColor: 0xfff2c9,
    }),
    specialDirectional: m('Blinding Flare', {
      kind: 'burst', type: H, damage: 11, radius: 96, vfx: 'fire', vfxColor: 0xfff6e0,
      onHit: { blind: 900 }, baseKnockback: 160, duration: 260, cooldown: 880,
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
      type: K, damage: 4, multiHit: 3, rangeW: 78, vfx: 'spark',
      baseKnockback: 90, duration: 320, cooldown: 360,
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
      type: K, damage: 9, rangeW: 80, vfx: 'strike', duration: 210, cooldown: 330,
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
      vfx: 'fire', vfxColor: 0xe8ffb0, duration: 210, cooldown: 330,
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
      duration: 190, cooldown: 300,
    }),
    specialDefense: m('Salt Bond', {
      kind: 'counter', counterDamage: 6, counterType: C, counterKnockback: 120,
      counterRootMs: 520, rootBonusVs: 'alkali',
      duration: 520, cooldown: 780, vfx: 'shield', vfxColor: 0xf4f4f4,
    }),
    specialDirectional: m('Gas Cloud', {
      kind: 'zone', type: C, damage: 3, vfx: 'cloud', vfxColor: 0xd4e857,
      zone: { type: C, damage: 3.5, ms: 2400, radius: 78, tick: 360, low: true, color: 0xd4e857 },
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
      duration: 230, cooldown: 340,
    }),
    specialDefense: m('Folded Wings', {
      blocks: [K], reflectProjectiles: 'perfect', perfectMs: 200,
      duration: 600, cooldown: 700, vfx: 'shield',
    }),
    specialDirectional: m('Aerial Dive', {
      kind: 'dive', type: K, damage: 11, radius: 78, diveVY: 780, dashSpeed: 220,
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
      type: K, damage: 8, rangeW: 118, rangeH: 36, vfx: 'strike',
      duration: 230, cooldown: 340,
    }),
    specialDefense: m('Aerospace Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.62, blocks: [C], noKnockback: true,
      duration: 750, cooldown: 700, vfx: 'shield', vfxColor: 0xb9c6d6,
    }),
    specialDirectional: m('Aero Lance', {
      kind: 'projectile', type: K, damage: 11, pierce: true, visualShape: 'spearhead', vfx: 'strike',
      projectileSpeed: 640, projectileRadius: 10, projectileLife: 620,
      baseKnockback: 220, duration: 240, cooldown: 780,
    }),
  },

  van: {
    basicCharge: m('Redox Flow', {
      kind: 'buff', redox: true, duration: 220, cooldown: 400, maxChargeMs: 800,
      vfx: 'spark', vfxColor: 0x8af5c9,
    }),
    basicDirectional: melee('Alloy Fist', {
      type: K, damage: 9, breaksBlock: 'weak', vfx: 'strike',
      baseKnockback: 200, duration: 230, cooldown: 350,
    }),
    specialDefense: m('Four-State Guard', {
      cycle: [E, C, H, K], cycleMs: 360,
      duration: 1200, cooldown: 700, vfx: 'spark',
    }),
    specialDirectional: m('Prism Surge', {
      kind: 'burst', type: E, damage: 12, radius: 90, vfx: 'spark', vfxColor: 0x8af5c9,
      baseKnockback: 180, duration: 260, cooldown: 800,
    }),
  },

  chroma: {
    basicCharge: m('Ruby Laser', {
      kind: 'beam', type: H, damage: 8, chargeDamageMult: 1.7, chargeLengthMult: 2.6,
      maxChargeMs: 900, beamLen: 160, beamThick: 16, vfx: 'laser', vfxColor: 0xff2a3a,
      baseKnockback: 150, duration: 200, cooldown: 720,
    }),
    basicDirectional: melee('Chrome Edge', {
      type: K, damage: 10, rangeW: 80, vfx: 'strike', vfxColor: 0xe8eef2,
      baseKnockback: 190, duration: 210, cooldown: 330,
    }),
    specialDefense: m('Mirror Chrome', {
      reflectProjectiles: true, duration: 700, cooldown: 720,
      vfx: 'shield', vfxColor: 0xe8eef2,
    }),
    specialDirectional: m('Prismatic Shatter', {
      kind: 'burst', type: K, damage: 12, radius: 92, vfx: 'spark', vfxColor: 0xff2a3a,
      baseKnockback: 210, duration: 280, cooldown: 840,
    }),
  },
};
