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
      kind: 'burst', type: H, damage: 5, type2: R, damage2: 3,
      // A tap is the small burst. Full charge is 3x the radius, damage, and
      // knockback. Self-damage only creeps up. fxScale grows dropped-in art
      // with that same radius.
      chargeDamageMult: 3, chargeKnockbackMult: 3, chargeRadiusMult: 3,
      maxChargeMs: 900, radius: 64, baseKnockback: 200, knockbackGrowth: 6,
      duration: 280, cooldown: 720, vfx: 'supernova', fxScale: 'radius',
      selfDamage: { type: H, damage: 4, chargeMult: 1.5 }, releaseOnHit: true,
    }),
    basicDirectional: melee('Flame Dash', {
      kind: 'dash', type: K, damage: 3, type2: H, damage2: 3,
      dashSpeed: 720, rangeW: 96, rangeH: 100, baseKnockback: 180,
      knockbackGrowth: 3.4, duration: 300, cooldown: 780, vfx: 'fire',
    }),
    specialDefense: m('Fire Wall', {
      kind: 'wall', frontOnly: true, duration: 520, cooldown: 680,
      blocks: [K, H, C], vfx: 'wall', vfxColor: 0xff5a1f,
      wallDamage: 8, wallType: H, wallKnockback: 200, wallKnockbackGrowth: 5,
      wallRangeW: 28, wallRangeH: 110, wallYFrac: 0.7,
    }),
    specialDirectional: m('Hydrogen Bomb', {
      kind: 'projectile', type: H, damage: 6, type2: R, damage2: 4,
      explodeOnly: true, explodeRadius: 74, vfx: 'mushroom',
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 700,
      baseKnockback: 190, knockbackGrowth: 3.6, duration: 260, cooldown: 980,
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
      type: K, damage: 11, baseKnockback: 300, knockbackGrowth: 7.2,
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
      type: K, damage: 5, chargeDamageMult: 2.2, chargeKnockbackMult: 1.7,
      maxChargeMs: 800, baseKnockback: 200, vfx: 'spark',
      secondHit: { atFull: true, scale: 0.55, radius: 100 },
    }),
    basicDirectional: melee('Precision Strike', {
      type: K, damage: 4, sweetSpot: 5, rangeW: 70, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 3.6, duration: 250, cooldown: 740,
    }),
    specialDefense: m('Rigid Stance', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.72, noKnockback: true,
      retort: { when: R, type: R, damage: 7, knockback: 160 },
      duration: 700, cooldown: 640, vfx: 'shield',
    }),
    specialDirectional: m('Gyro Disc', {
      kind: 'projectile', type: K, damage: 6, vfx: 'spark',
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
      baseKnockback: 180, knockbackGrowth: 2.4, vfx: 'dash',
    }),
    basicDirectional: melee('Crystal Smash', {
      type: K, damage: 8, baseKnockback: 160, knockbackGrowth: 3.0, rangeW: 70, vfx: 'strike',
      duration: 240, cooldown: 480,
    }),
    specialDefense: m('Boron Carbide Wall', {
      kind: 'wall', frontOnly: true, blocks: [K, H, R], crackAfterHits: 3,
      duration: 800, cooldown: 900, vfx: 'wall', vfxColor: 0x9ad7ff,
      wallDamage: 6, wallType: K, wallKnockback: 180, wallKnockbackGrowth: 4,
      wallRangeW: 30, wallRangeH: 100, wallYFrac: 0.7,
    }),
    specialDirectional: m('Ground Shatter', {
      kind: 'burst', type: K, damage: 9, radius: 88, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 2.6, duration: 300, cooldown: 820,
    }),
  },

  carter: {
    basicCharge: m('Diamond Shard', {
      kind: 'projectile', type: K, damage: 6, chargeDamageMult: 2.1,
      chargeRadiusMult: 1.6, maxChargeMs: 800, breaksBlock: true, vfx: 'spark',
      projectileSpeed: 540, projectileRadius: 10, projectileLife: 700,
      baseKnockback: 210, duration: 240, cooldown: 720,
    }),
    basicDirectional: melee('Diamond Cross', {
      type: K, damage: 6, baseKnockback: 200, rangeW: 70, vfx: 'strike',
      duration: 250, cooldown: 660,
    }),
    specialDefense: m('Diamond Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.78,
      duration: 700, cooldown: 680, vfx: 'shield', vfxColor: 0xd6f4ff,
    }),
    specialDirectional: m('Graphene Wave', {
      kind: 'burst', type: E, damage: 8, radius: 82, vfx: 'spark',
      baseKnockback: 200, duration: 280, cooldown: 980,
    }),
  },

  nitra: {
    basicCharge: melee('Nitrogen Rush', {
      kind: 'dash', type: K, damage: 7, chargeDamageMult: 2, chargeDashMult: 1.4,
      maxChargeMs: 750, dashSpeed: 680, rangeW: 90, rangeH: 88,
      whileCharging: { keep: 0.42, except: [R] },
      baseKnockback: 210, vfx: 'ice',
    }),
    basicDirectional: melee('Frost Fang', {
      type: K, damage: 4, type2: H, damage2: 4,
      onHit: { slow: 1200 }, rangeW: 84, vfx: 'ice', duration: 200, cooldown: 300,
    }),
    specialDefense: m('Inert Shield', {
      kind: 'shield', duration: 900, cooldown: 700, vfx: 'bubble', vfxColor: 0xd8fff8,
    }),
    specialDirectional: m('Cryo Vortex', {
      kind: 'burst', type: H, damage: 9, radius: 96, vfx: 'ice',
      zone: { type: H, damage: 3.2, ms: 2600, radius: 90, tick: 400, slide: true, color: 0xbff6ff },
      baseKnockback: 240, duration: 300, cooldown: 860,
    }),
  },

  oxana: {
    basicCharge: m('Bellows Breath', {
      kind: 'projectile', type: K, damage: 6, flareHeat: 9,
      chargeDamageMult: 1.6, maxChargeMs: 700, vfx: 'gust',
      baseKnockback: 260, knockbackGrowth: 6,
      projectileSpeed: 380, projectileRadius: 32, projectileLife: 1100,
      duration: 240, cooldown: 640,
    }),
    basicDirectional: melee('Vortex Kick', {
      type: K, damage: 10, flareHeat: 6, rangeW: 88, vfx: 'gust',
      duration: 230, cooldown: 320,
    }),
    specialDefense: m('Ozone Layer', {
      blocks: [R], duration: 800, cooldown: 720, vfx: 'shield', vfxColor: 0x9ad7ff,
    }),
    specialDirectional: m('Oxidation Burst', {
      kind: 'burst', type: H, damage: 9, type2: C, damage2: 8,
      radius: 108, rustMetals: true, vfx: 'acid',
      baseKnockback: 190, duration: 280, cooldown: 840,
    }),
  },

  flora: {
    basicCharge: m('Pale Yellow Jet', {
      kind: 'projectile', type: C, damage: 7, type2: H, damage2: 3,
      chemDealtMult: 1.15, chargeDamageMult: 1.7, maxChargeMs: 800,
      vfx: 'acid', vfxColor: 0xe6f27a,
      projectileSpeed: 520, projectileRadius: 14, projectileLife: 560,
      baseKnockback: 180, duration: 240, cooldown: 760,
    }),
    basicDirectional: melee('Etching Jab', {
      type: C, damage: 5, onHit: { corrode: { mult: 0.7, ms: 2000 } },
      vfx: 'acid', duration: 190, cooldown: 300,
    }),
    specialDefense: m('Teflon Coat', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4, debuffImmune: true,
      duration: 800, cooldown: 740, vfx: 'shield', vfxColor: 0xe8ffe8,
    }),
    specialDirectional: m('Radical Cascade', {
      kind: 'burst', type: C, damage: 5, radius: 72, vfx: 'acid',
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
      type: K, damage: 5, type2: E, damage2: 4, vfx: 'spark',
      rangeW: 94, duration: 210, cooldown: 340,
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
      kind: 'burst', type: K, damage: 6, type2: H, damage2: 5,
      chargeDamageMult: 2.3, chargeKnockbackMult: 2, chargeRadiusMult: 1.8,
      maxChargeMs: 1000, detonateAtFull: true, includeSelf: true,
      radius: 60, vfx: 'supernova', vfxColor: 0xffc14a,
      baseKnockback: 280, knockbackGrowth: 6.5, duration: 280, cooldown: 860,
    }),
    basicDirectional: melee('Flame Fist', {
      type: K, damage: 14, type2: H, damage2: 14, vfx: 'fire', vfxColor: 0xffc14a,
      baseKnockback: 185, knockbackGrowth: 4.7,
      duration: 240, cooldown: 440,
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
      type: K, damage: 6.7, type2: H, damage2: 6.7, vfx: 'fire',
      duration: 250, cooldown: 520,
    }),
    specialDefense: m('Ribbon Guard', {
      blocks: [K],
      retort: { when: H, type: H, damage: 9, knockback: 198 },
      duration: 650, cooldown: 680, vfx: 'shield', vfxColor: 0xfff2c9,
    }),
    specialDirectional: m('Blinding Flare', {
      kind: 'burst', type: H, damage: 13.4, radius: 86, vfx: 'fire', vfxColor: 0xfff6e0,
      onHit: { blind: 900 }, baseKnockback: 176, duration: 260, cooldown: 1040,
    }),
  },

  allen: {
    basicCharge: m('Thermite Burn', {
      kind: 'beam', type: H, damage: 8, chargeDamageMult: 1.8, chargeLengthMult: 1.8,
      maxChargeMs: 800, beamLen: 130, beamThick: 26, breaksBlock: true,
      vfx: 'laser', vfxColor: 0xff6a1a, baseKnockback: 160,
      duration: 240, cooldown: 760,
    }),
    basicDirectional: melee('Turbine Strike', {
      type: K, damage: 4, multiHit: 3, rangeW: 90, vfx: 'spark',
      baseKnockback: 90, duration: 320, cooldown: 300,
    }),
    specialDefense: m('Oxide Skin', {
      kind: 'oxide', duration: 2000, cooldown: 1600, vfx: 'shield', vfxColor: 0xd8dde6,
    }),
    specialDirectional: m('Turbine Vortex', {
      kind: 'burst', type: E, damage: 8, radius: 100, pull: 320, vfx: 'spark',
      baseKnockback: 80, duration: 300, cooldown: 860,
    }),
  },

  silas: {
    basicCharge: m('Overclock', {
      kind: 'buff', duration: 240, cooldown: 1200, maxChargeMs: 900,
      overclock: { speed: 1.4, ms: 2800, selfHeat: 7 }, vfx: 'spark', vfxColor: 0x4ad6ff,
    }),
    basicDirectional: melee('Crystal Blade', {
      type: K, damage: 13.44, rangeW: 74, vfx: 'strike', duration: 260, cooldown: 520,
    }),
    specialDefense: m('Silica Pane', {
      blocks: [H, C],
      retort: { when: K, type: K, damage: 7.84, knockback: 224 },
      duration: 700, cooldown: 760, vfx: 'shield', vfxColor: 0xd6f6ff,
    }),
    specialDirectional: m('Binary Surge', {
      kind: 'burst', type: E, damage: 12.32, radius: 80, missRetry: true, vfx: 'spark',
      baseKnockback: 190.4, duration: 240, cooldown: 780,
    }),
  },

  phillip: {
    basicCharge: m('Strike Anywhere', {
      kind: 'burst', type: H, damage: 8, chargeDamageMult: 2.1, chargeRadiusMult: 1.5,
      maxChargeMs: 750, radius: 52, offsetX: 46, vfx: 'fire', vfxColor: 0xfff2c0,
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 240, cooldown: 680,
    }),
    basicDirectional: melee('Glow Strike', {
      type: K, damage: 7, onHit: { burn: { dps: 1.6, ms: 1300 } },
      baseKnockback: 160, knockbackGrowth: 3.0,
      vfx: 'fire', vfxColor: 0xe8ffb0, duration: 250, cooldown: 560,
    }),
    specialDefense: m('Red Phosphorus Form', {
      blocks: [H], debuffImmune: true, duration: 900, cooldown: 700,
      vfx: 'shield', vfxColor: 0xff4a4a,
    }),
    specialDirectional: m('Spontaneous Ignition', {
      kind: 'burst', type: H, damage: 8, radius: 78, vfx: 'fire',
      zone: { type: H, damage: 2.2, ms: 1600, radius: 66, tick: 400, color: 0xff6a1a },
      baseKnockback: 150, knockbackGrowth: 2.8, duration: 280, cooldown: 860,
    }),
  },

  sully: {
    basicCharge: m('Black Powder', {
      kind: 'burst', type: H, damage: 9, type2: K, damage2: 7,
      chargeDamageMult: 2, chargeRadiusMult: 1.6, maxChargeMs: 800,
      radius: 54, offsetX: 50, vfx: 'supernova', vfxColor: 0xffb020,
      baseKnockback: 230, duration: 260, cooldown: 740,
    }),
    basicDirectional: melee('Brimstone Slam', {
      type: K, damage: 7, type2: H, damage2: 5, vfx: 'fire', vfxColor: 0x6ecbff,
      baseKnockback: 210, duration: 240, cooldown: 360,
    }),
    specialDefense: m('Vulcanized Rubber', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.7,
      retort: { when: K, type: K, damage: 4, knockback: 280 },
      duration: 700, cooldown: 720, vfx: 'shield',
    }),
    specialDirectional: m('Volcanic Eruption', {
      kind: 'burst', type: H, damage: 9, type2: C, damage2: 7,
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
      type: C, damage: 6, vfx: 'cloud', vfxColor: 0xd4e857,
      baseKnockback: 140, knockbackGrowth: 2.8,
      duration: 240, cooldown: 560,
    }),
    specialDefense: m('Salt Bond', {
      kind: 'counter', counterDamage: 6, counterType: C, counterKnockback: 120,
      counterRootMs: 520, rootBonusVs: 'alkali',
      duration: 520, cooldown: 780, vfx: 'shield', vfxColor: 0xf4f4f4,
    }),
    specialDirectional: m('Gas Cloud', {
      kind: 'zone', type: C, damage: 3, vfx: 'cloud', vfxColor: 0xd4e857,
      zone: { type: C, damage: 2.2, ms: 2000, radius: 64, tick: 400, low: true, color: 0xd4e857 },
      baseKnockback: 40, duration: 260, cooldown: 980,
    }),
  },

  aaron: {
    basicCharge: melee('Lazy Haymaker', {
      type: K, damage: 7.7, chargeDamageMult: 2.8, chargeKnockbackMult: 2,
      maxChargeMs: 1100, rangeW: 78, baseKnockback: 216, vfx: 'strike',
      duration: 280, cooldown: 520,
    }),
    basicDirectional: melee('Inert Guard Strike', {
      type: K, damage: 8.8, guardStrike: 0.5, vfx: 'strike',
      duration: 240, cooldown: 340,
    }),
    specialDefense: m('Shield Gas', {
      blocks: [H, E], duration: 800, cooldown: 700, vfx: 'shield', vfxColor: 0xc9b6ff,
    }),
    specialDirectional: m('Noble Discharge', {
      kind: 'burst', type: E, damage: 13.2, radius: 88, vfx: 'spark', vfxColor: 0xc9b6ff,
      baseKnockback: 205.2, duration: 280, cooldown: 840,
    }),
  },

  kyle: {
    basicCharge: m('Action Potential', {
      kind: 'projectile', type: E, damage: 8, fizzleBelow: 0.9,
      maxChargeMs: 800, onHit: { stun: 450 }, vfx: 'spark', vfxColor: 0xd2b6ff,
      projectileSpeed: 620, projectileRadius: 14, projectileLife: 480,
      baseKnockback: 80, duration: 200, cooldown: 760,
    }),
    basicDirectional: melee('Static Cross', {
      type: K, damage: 6, type2: E, damage2: 4, vfx: 'spark',
      baseKnockback: 140, knockbackGrowth: 2.6,
      duration: 200, cooldown: 420,
    }),
    specialDefense: m('Ion Channel', {
      kind: 'counter', counterOnTypes: [E, K], counterDamage: 8, counterType: E,
      counterKnockback: 170, duration: 520, cooldown: 740, vfx: 'spark',
    }),
    specialDirectional: m('Nerve Shock', {
      kind: 'burst', type: E, damage: 8, radius: 86, vfx: 'spark',
      onHit: { interrupt: 280 }, baseKnockback: 110, knockbackGrowth: 2.2, duration: 240, cooldown: 780,
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
      kind: 'dash', type: K, damage: 6, type2: H, damage2: 4,
      chargeDamageMult: 1.9, chargeDashMult: 1.5, maxChargeMs: 700,
      dashSpeed: 640, rangeW: 100, rangeH: 70, vfx: 'fire',
      baseKnockback: 220, duration: 280, cooldown: 720,
    }),
    basicDirectional: melee('Wing Slash', {
      type: K, damage: 7, rangeW: 100, rangeH: 72, vfx: 'strike',
      duration: 230, cooldown: 290,
    }),
    specialDefense: m('Folded Wings', {
      blocks: [K], reflectProjectiles: 'perfect', perfectMs: 200,
      duration: 600, cooldown: 700, vfx: 'shield',
    }),
    specialDirectional: m('Aerial Dive', {
      kind: 'dive', type: K, damage: 10, radius: 88, diveVY: 460, dashSpeed: 160,
      vfx: 'dash', baseKnockback: 240, duration: 420, cooldown: 860,
    }),
  },

  titan: {
    basicCharge: melee('Titanium Ram', {
      kind: 'dash', type: K, damage: 6, type2: H, damage2: 1,
      chargeDamageMult: 2, chargeDashMult: 1.35, maxChargeMs: 750,
      dashSpeed: 580, rangeW: 96, rangeH: 80, vfx: 'spark',
      baseKnockback: 230, duration: 280, cooldown: 700,
    }),
    basicDirectional: melee('Lance Jab', {
      type: K, damage: 5, rangeW: 84, rangeH: 36, vfx: 'strike',
      baseKnockback: 170, knockbackGrowth: 3.8, duration: 280, cooldown: 700,
    }),
    specialDefense: m('Aerospace Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.62, blocks: [C], noKnockback: true,
      duration: 750, cooldown: 700, vfx: 'shield', vfxColor: 0xb9c6d6,
    }),
    specialDirectional: m('Aero Lance', {
      kind: 'projectile', type: K, damage: 7, pierce: true, visualShape: 'spearhead', vfx: 'strike',
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
      type: K, damage: 7, breaksBlock: 'weak', vfx: 'strike',
      baseKnockback: 200, duration: 270, cooldown: 800,
    }),
    specialDefense: m('Four-State Guard', {
      cycle: [E, C, H, K], cycleMs: 360,
      duration: 1200, cooldown: 700, vfx: 'spark',
    }),
    specialDirectional: m('Prism Surge', {
      kind: 'burst', type: E, damage: 9, radius: 82, vfx: 'spark', vfxColor: 0x8af5c9,
      baseKnockback: 180, duration: 260, cooldown: 1100,
    }),
  },

  chroma: {
    basicCharge: m('Ruby Laser', {
      kind: 'beam', type: H, damage: 6, chargeDamageMult: 1.7, chargeLengthMult: 2.6,
      maxChargeMs: 900, beamLen: 160, beamThick: 16, vfx: 'laser', vfxColor: 0xff2a3a,
      baseKnockback: 150, duration: 200, cooldown: 720,
    }),
    basicDirectional: melee('Chrome Edge', {
      type: K, damage: 8, rangeW: 74, vfx: 'strike', vfxColor: 0xe8eef2,
      baseKnockback: 190, duration: 280, cooldown: 660,
    }),
    specialDefense: m('Mirror Chrome', {
      reflectProjectiles: true, duration: 700, cooldown: 720,
      vfx: 'shield', vfxColor: 0xe8eef2,
    }),
    specialDirectional: m('Prismatic Shatter', {
      kind: 'burst', type: K, damage: 10, radius: 80, vfx: 'spark', vfxColor: 0xff2a3a,
      baseKnockback: 210, duration: 280, cooldown: 960,
    }),
  },

  // --- pilot roster (Ta, W, Re, Os, Pt). Numbers are the balance pass. ---
  // Knockback growth is set below the kit default (5.4) on the pokes that were
  // launching gases off Elemental Isle while those gases were ahead on percent.
  tara: {
    basicCharge: m('Capacitor Dump', {
      kind: 'beam', type: E, damage: 6, chargeDamageMult: 1.75, chargeLengthMult: 2.15,
      maxChargeMs: 760, beamLen: 148, beamThick: 24, vfx: 'laser', vfxColor: 0x7ec8ff,
      baseKnockback: 140, knockbackGrowth: 3.0, duration: 200, cooldown: 740,
    }),
    basicDirectional: melee('Tantalizing Hook', {
      type: K, damage: 4, pull: 210, rangeW: 92, rangeH: 42, vfx: 'spark',
      baseKnockback: 40, knockbackGrowth: 1.2, duration: 240, cooldown: 460,
    }),
    specialDefense: m('Tantalus Guard', {
      immune: [C], duration: 820, cooldown: 760, vfx: 'shield', vfxColor: 0xb7f27a,
    }),
    specialDirectional: m('Implant Pin', {
      kind: 'projectile', type: K, damage: 5, visualShape: 'spearhead', vfx: 'strike',
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
      type: K, damage: 8, heatEmpower: 3, rangeW: 76, vfx: 'strike',
      baseKnockback: 150, knockbackGrowth: 2.8, duration: 250, cooldown: 560,
    }),
    specialDefense: m('Creep Resistance', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.32, noKnockback: true,
      debuffImmune: true, grabImmune: true,
      duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xd9dde6,
    }),
    specialDirectional: melee('Thermocouple Lash', {
      type: E, damage: 8, rangeW: 112, rangeH: 30, vfx: 'spark', vfxColor: 0xffb45a,
      vsHot: { type: H, damage: 11 },
      baseKnockback: 140, knockbackGrowth: 2.2, duration: 240, cooldown: 720,
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
      kind: 'burst', type: K, damage: 11, chargeDamageMult: 1.65, chargeRadiusMult: 1.45,
      maxChargeMs: 900, radius: 54, onHit: { interrupt: 220 }, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 3.2, duration: 280, cooldown: 1040,
    }),
    basicDirectional: melee('Mud Weight', {
      type: K, damage: 12, onHit: { slow: 800 }, rangeW: 74, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 3.4, duration: 240, cooldown: 600,
    }),
    specialDefense: m('Barium Meal', {
      immune: [R], weightMult: 1.45, duration: 800, cooldown: 900, vfx: 'shield', vfxColor: 0xd8d2c4,
    }),
    specialDirectional: m('Poison Pellet', {
      kind: 'projectile', type: C, damage: 6, ground: true, vfx: 'cloud',
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
      type: K, damage: 11, type2: R, damage2: 9, lift: true, rangeW: 50, rangeH: 64, vfx: 'spark',
      baseKnockback: 110, knockbackGrowth: 1.8, duration: 240, cooldown: 480,
    }),
    specialDefense: m('Decay Halo', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4,
      recoil: { type: R, damage: 4, knockback: 80 },
      duration: 720, cooldown: 860, vfx: 'shield', vfxColor: 0xd6ff8a,
    }),
    specialDirectional: m('Luminous Splash', {
      kind: 'projectile', type: R, damage: 4, angleable: true, vfx: 'spark', vfxColor: 0xe8ffb0,
      dropZone: { type: R, damage: 1.1, ms: 1600, radius: 44, tick: 400, knockback: 14, growth: 0.2, color: 0xe8ffb0 },
      projectileSpeed: 400, projectileRadius: 10, projectileLife: 600,
      baseKnockback: 50, knockbackGrowth: 0.8, duration: 220, cooldown: 900,
    }),
  },

  collin: {
    basicCharge: m('Gamma Knife', {
      kind: 'beam', type: R, damage: 9, chargeDamageMult: 1.65, chargeLengthMult: 2.1,
      maxChargeMs: 900, beamLen: 146, beamThick: 16, vfx: 'laser', vfxColor: 0xb7ff6a,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 200, cooldown: 760,
    }),
    basicDirectional: melee('Kobold Strike', {
      kind: 'dash', type: K, damage: 7, onHit: { root: 400 }, dashSpeed: 460,
      rangeW: 80, rangeH: 40, vfx: 'dash',
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 260, cooldown: 680,
    }),
    specialDefense: m('Superalloy Shell', {
      immune: [H], kind: 'block', onlyReduce: [K], blockReduction: 0.35,
      duration: 760, cooldown: 880, vfx: 'shield', vfxColor: 0x8aa4c8,
    }),
    specialDirectional: m('Blue Glaze', {
      kind: 'projectile', type: H, damage: 7, onHit: { slow: 1000 }, vfx: 'fire', vfxColor: 0x3a6adf,
      projectileSpeed: 440, projectileRadius: 10, projectileLife: 540,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 220, cooldown: 680,
    }),
  },

  cooper: {
    basicCharge: m('Electromagnet', {
      kind: 'burst', type: E, damage: 2.9, pull: 150, chargeDamageMult: 1.35, chargeRadiusMult: 1.4,
      maxChargeMs: 800, radius: 66, vfx: 'spark',
      baseKnockback: 23, knockbackGrowth: 0.48, duration: 260, cooldown: 1040,
    }),
    basicDirectional: melee('Live Wire', {
      type: K, damage: 4.8, type2: E, damage2: 2.9, rangeW: 116, rangeH: 28, vfx: 'spark',
      baseKnockback: 124.8, knockbackGrowth: 2.88, duration: 220, cooldown: 540,
    }),
    specialDefense: m('Grounding Rod', {
      immune: [E],
      zone: { type: E, damage: 1.06, ms: 780, radius: 48, tick: 360, knockback: 19.2, growth: 0.19, color: 0x7ec8ff },
      duration: 780, cooldown: 900, vfx: 'shield', vfxColor: 0xc47a3a,
    }),
    specialDirectional: m('Verdigris Spray', {
      kind: 'projectile', type: C, damage: 2.9, vfx: 'cloud', vfxColor: 0x6fbf73,
      onHit: { poison: { dps: 0.4, ms: 1200 }, weaken: { mult: 0.8, ms: 1200 } },
      projectileSpeed: 400, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 38.4, knockbackGrowth: 0.58, duration: 220, cooldown: 1100,
    }),
  },

  agatha: {
    basicCharge: m('Silver Bullet', {
      kind: 'projectile', type: K, damage: 5, bonusVsBuff: 1.75, chargeDamageMult: 1.55,
      maxChargeMs: 700, vfx: 'strike', vfxColor: 0xe8eef2,
      projectileSpeed: 560, projectileRadius: 6, projectileLife: 460,
      baseKnockback: 280, knockbackGrowth: 4.6, duration: 200, cooldown: 860,
    }),
    basicDirectional: melee('Silver Lining', {
      type: K, damage: 4, type2: E, damage2: 3, rangeW: 86, vfx: 'spark',
      baseKnockback: 160, knockbackGrowth: 3.8, duration: 220, cooldown: 480,
    }),
    specialDefense: m('Photo Negative', {
      immune: [H, R], capture: true, duration: 700, cooldown: 840, vfx: 'shield', vfxColor: 0xd8dde6,
    }),
    specialDirectional: m('Darkroom Print', {
      kind: 'projectile', type: H, damage: 3, replayCapture: true, onHit: { blind: 260 },
      vfx: 'spark', vfxColor: 0xfff6d0,
      projectileSpeed: 520, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 90, knockbackGrowth: 1.5, duration: 220, cooldown: 960,
    }),
  },

  cody: {
    basicCharge: m('Quantum Dot', {
      kind: 'projectile', type: E, damage: 3, chargeDamageMult: 2.3, chargeSpeedMult: 0.42,
      maxChargeMs: 1000, vfx: 'spark', vfxColor: 0xff4a3a,
      projectileSpeed: 640, projectileRadius: 8, projectileLife: 680,
      baseKnockback: 90, knockbackGrowth: 2.4, duration: 200, cooldown: 880,
    }),
    basicDirectional: melee('Battery Prod', {
      type: K, damage: 5, type2: E, damage2: 3, rangeW: 64, vfx: 'spark',
      baseKnockback: 120, knockbackGrowth: 2.6, duration: 210, cooldown: 460,
    }),
    specialDefense: m('Control Rod', {
      immune: [R], kind: 'block', onlyReduce: [H], blockReduction: 0.45,
      duration: 760, cooldown: 880, vfx: 'shield', vfxColor: 0xf0d24a,
    }),
    specialDirectional: m('Yellow Paint Bomb', {
      kind: 'projectile', type: C, damage: 3, vfx: 'cloud', vfxColor: 0xf0d24a,
      onHit: { slow: 1100, poison: { dps: 1.1, ms: 1400 } },
      projectileSpeed: 420, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 60, knockbackGrowth: 1, duration: 220, cooldown: 920,
    }),
  },

  aurelius: {
    basicCharge: m('Midas Touch', {
      type: K, damage: 7.5, pull: 140, onHit: { freeze: 640 }, rangeW: 56, rangeH: 48,
      maxChargeMs: 700, chargeDamageMult: 1.25, vfx: 'spark', vfxColor: 0xf0c84a,
      baseKnockback: 16.9, knockbackGrowth: 0.23, duration: 240, cooldown: 960,
    }),
    basicDirectional: melee('Gold Leaf Sweep', {
      type: K, damage: 7.5, rangeW: 120, rangeH: 34, vfx: 'strike', vfxColor: 0xf0c84a,
      baseKnockback: 94, knockbackGrowth: 3.01, duration: 190, cooldown: 420,
    }),
    specialDefense: m('Golden Visor', {
      immune: [C], reflectTypes: [H, R], duration: 720, cooldown: 900, vfx: 'shield', vfxColor: 0xf0c84a,
    }),
    specialDirectional: m('Ingot Lob', {
      kind: 'projectile', type: K, damage: 7.5, angleable: true, vfx: 'strike', vfxColor: 0xf0c84a,
      projectileSpeed: 330, projectileRadius: 14, projectileLife: 700,
      baseKnockback: 131.6, knockbackGrowth: 3.01, duration: 240, cooldown: 860,
    }),
  },

  talia: {
    basicCharge: m('Poisoner\'s Poison', {
      kind: 'burst', type: C, damage: 1, radius: 62, chargeRadiusMult: 1.55, maxChargeMs: 900,
      zone: { type: C, damage: 1.7, ramp: 0.5, ms: 2400, radius: 68, tick: 340, knockback: 8, growth: 0.1, color: 0x9d6bff },
      baseKnockback: 0, knockbackGrowth: 0, duration: 240, cooldown: 860, vfx: 'cloud',
    }),
    basicDirectional: melee('Green Line Stab', {
      type: K, damage: 4, type2: C, damage2: 3, rangeW: 58, vfx: 'strike', vfxColor: 0x7dff6a,
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 180, cooldown: 360,
    }),
    specialDefense: m('Prussian Blue', {
      immune: [C], cleanse: ['poison'], duration: 760, cooldown: 860, vfx: 'shield', vfxColor: 0x2a4ac8,
    }),
    specialDirectional: m('Pale Horse Dart', {
      kind: 'projectile', type: K, damage: 1, vfx: 'strike',
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
      kind: 'burst', type: H, damage: 9, type2: R, damage2: 8, chargeDamageMult: 1.55, chargeRadiusMult: 1.6,
      maxChargeMs: 900, radius: 64, vfx: 'fire', vfxColor: 0x6ad0ff,
      baseKnockback: 140, knockbackGrowth: 3.0, duration: 260, cooldown: 780,
    }),
    basicDirectional: melee('Rapier Thrust', {
      type: K, damage: 7, type2: R, damage2: 6, rangeW: 92, rangeH: 24, vfx: 'strike',
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
      type: R, damage: 10, stripBuffs: true, onHit: { strip: true }, rangeW: 100, rangeH: 36,
      vfx: 'spark', baseKnockback: 60, knockbackGrowth: 0.9, duration: 220, cooldown: 640,
    }),
  },

  tate: {
    basicCharge: m('Self-Vaporize', {
      kind: 'burst', type: H, damage: 5, type2: R, damage2: 5, commit: true,
      chargeDamageMult: 1.45, chargeRadiusMult: 1.45, maxChargeMs: 1000, radius: 78,
      selfDamage: { type: R, damage: 2, withCharge: true, noFlinch: true }, blinkMs: 420,
      vfx: 'fire', vfxColor: 0xfff2a8,
      baseKnockback: 100, knockbackGrowth: 1.6, duration: 260, cooldown: 860,
    }),
    basicDirectional: melee('Targeted Alpha', {
      type: R, damage: 8, breaksBlock: true, rangeW: 52, vfx: 'spark',
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 210, cooldown: 360,
    }),
    specialDefense: m('Never Seen', {
      phase: true, drain: { damage: 1, type: R, every: 1000 },
      duration: 900, cooldown: 1040, vfx: 'shield', vfxColor: 0xc9d6e0,
    }),
    specialDirectional: m('Unstable Bolt', {
      kind: 'projectile', type: C, damage: 5, type2: R, damage2: 5, vfx: 'spark',
      projectileSpeed: 500, projectileRadius: 9, projectileLife: 500,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 210, cooldown: 560,
    }),
  },

  brock: {
    basicCharge: m('Bromos Stench', {
      kind: 'burst', type: C, damage: 7, radius: 72, bonusVsMark: 'stain', markMult: 1.35, onHit: { drift: 650 },
      chargeDamageMult: 1.45, chargeRadiusMult: 1.5, maxChargeMs: 900, vfx: 'cloud', vfxColor: 0x8a3a22,
      baseKnockback: 70, knockbackGrowth: 2.4, duration: 240, cooldown: 780,
    }),
    basicDirectional: m('Caustic Splash', {
      kind: 'projectile', type: C, damage: 5, bonusVsMark: 'stain', markMult: 1.35, vfx: 'cloud',
      projectileSpeed: 460, projectileRadius: 11, projectileLife: 460,
      baseKnockback: 145, knockbackGrowth: 3.4, duration: 200, cooldown: 520,
    }),
    specialDefense: m('Red Fume Screen', {
      softenProjectiles: 0.35,
      zone: { type: C, damage: 0, ms: 800, radius: 68, tick: 360, knockback: 0, growth: 0, onHit: { blind: 480 }, color: 0x8a3a22 },
      duration: 800, cooldown: 900, vfx: 'cloud', vfxColor: 0x8a3a22,
    }),
    specialDirectional: m('Tyrian Purple', {
      kind: 'projectile', type: C, damage: 5, bonusVsMark: 'stain', markMult: 1.35,
      onHit: { mark: 'stain', markMs: 3600 }, vfx: 'cloud', vfxColor: 0x6a2a8a,
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 90, knockbackGrowth: 2.2, duration: 210, cooldown: 700,
    }),
  },

  ceres: {
    basicCharge: m('Ferro Rod Sparks', {
      kind: 'beam', type: H, damage: 8, chargeDamageMult: 1.55, chargeLengthMult: 2,
      maxChargeMs: 800, beamLen: 128, beamThick: 26, vfx: 'fire', vfxColor: 0xffb45a,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 640,
    }),
    basicDirectional: melee('Ceria Polish', {
      type: K, damage: 3, multiHit: 4, bonusVsBlock: 0.8, popShield: true, rangeW: 64, vfx: 'strike',
      baseKnockback: 40, knockbackGrowth: 0.7, duration: 340, cooldown: 400,
    }),
    specialDefense: m('Self-Cleaning', {
      immune: [H], cleanse: ['poison', 'burn', 'slow', 'debuff'],
      duration: 740, cooldown: 880, vfx: 'fire', vfxColor: 0xffd0a0,
    }),
    specialDirectional: m('Dwarf Planet', {
      kind: 'projectile', type: K, damage: 6, ground: true, vfx: 'strike',
      projectileSpeed: 300, projectileRadius: 16, projectileLife: 780,
      baseKnockback: 140, knockbackGrowth: 2.4, duration: 240, cooldown: 640,
    }),
  },

  europa: {
    basicCharge: m('Phosphor Bloom', {
      kind: 'burst', type: R, damage: 9, chargeDamageMult: 1.5, chargeRadiusMult: 1.4,
      maxChargeMs: 900, radius: 72, vfx: 'spark', vfxColor: 0xff4a6a,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 240, cooldown: 760,
    }),
    basicDirectional: melee('Counterfeit Check', {
      type: K, damage: 7, stripBuffs: true, onHit: { strip: true }, breakPhase: true, rangeW: 72, vfx: 'strike',
      baseKnockback: 80, knockbackGrowth: 1.3, duration: 220, cooldown: 400,
    }),
    specialDefense: m('Ice Moon Shell', {
      blocks: [K, H], duration: 760, cooldown: 900, vfx: 'shield', vfxColor: 0xbfe8ff,
    }),
    specialDirectional: m('Banknote Star', {
      kind: 'projectile', type: K, damage: 8, vfx: 'strike', vfxColor: 0xf0d24a,
      projectileSpeed: 480, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 200, cooldown: 600,
    }),
  },

  dizzy: {
    basicCharge: melee('Hard to Get', {
      type: K, damage: 5, whileCharging: { keep: 0.35 }, chargeDamageMult: 1.45,
      maxChargeMs: 800, rangeW: 72, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 3.4, duration: 240, cooldown: 680,
    }),
    basicDirectional: melee('Dizzy Spin', {
      type: K, damage: 3, multiHit: 3, onHit: { drift: 360 }, rangeW: 68, vfx: 'strike',
      baseKnockback: 70, knockbackGrowth: 2.4, duration: 320, cooldown: 420,
    }),
    specialDefense: m('Spin Deflect', {
      reflectProjectiles: true, duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xc48bff,
    }),
    specialDirectional: m('Vertigo Wave', {
      kind: 'projectile', type: K, damage: 6, onHit: { drift: 780 }, vfx: 'gust',
      projectileSpeed: 420, projectileRadius: 14, projectileLife: 540,
      baseKnockback: 90, knockbackGrowth: 2.4, duration: 220, cooldown: 640,
    }),
  },

  erin: {
    basicCharge: m('Undersea Cable', {
      kind: 'beam', type: E, damage: 8, chargeDamageMult: 1.5, chargeLengthMult: 2.05,
      maxChargeMs: 900, beamLen: 156, beamThick: 14, vfx: 'spark', vfxColor: 0xff7ab0,
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 200, cooldown: 700,
    }),
    basicDirectional: melee('Pink Glass Swipe', {
      type: K, damage: 6, rangeW: 76, vfx: 'strike', vfxColor: 0xff8ac4,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 210, cooldown: 400,
    }),
    specialDefense: m('Signal Repeater', {
      retort: { when: E, type: E, damage: 10, knockback: 110, growth: 1.6 },
      duration: 600, cooldown: 900, vfx: 'shield', vfxColor: 0xff7ab0,
    }),
    specialDirectional: m('Resurface Laser', {
      kind: 'beam', type: H, damage: 8, popShield: true, breaksBlock: true,
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
      kind: 'burst', type: K, damage: 7, type2: E, damage2: 6, chargeDamageMult: 1.45, chargeRadiusMult: 1.35,
      maxChargeMs: 900, radius: 58, vfx: 'spark', vfxColor: 0xf0d24a,
      baseKnockback: 120, knockbackGrowth: 1.7, duration: 280, cooldown: 1000,
    }),
    basicDirectional: melee('Thunderclap', {
      type: K, damage: 6, type2: E, damage2: 4, onHit: { interrupt: 140 }, rangeW: 80, vfx: 'spark',
      baseKnockback: 100, knockbackGrowth: 1.5, duration: 200, cooldown: 480,
    }),
    specialDefense: m('Breeder Blanket', {
      immune: [R], fuelFrom: 'radiation', fuelType: R, fuelDamage: 4,
      duration: 800, cooldown: 940, vfx: 'shield', vfxColor: 0xc8b48a,
    }),
    specialDirectional: m('Lantern Mantle', {
      kind: 'projectile', type: H, damage: 6, type2: R, damage2: 4, explodeOnly: true, explodeRadius: 50,
      vfx: 'fire', vfxColor: 0xfff6d0,
      projectileSpeed: 400, projectileRadius: 10, projectileLife: 540,
      baseKnockback: 110, knockbackGrowth: 1.6, duration: 220, cooldown: 960,
    }),
  },

  frank: {
    basicCharge: m('Beta Turn', {
      kind: 'buff', duration: 220, cooldown: 980, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xffe08a,
      buff: { ms: 2600, weight: 1.32, scaleWithCharge: true, bonus: { type: R, damage: 4, hits: 4, name: 'Beta Turn' } },
    }),
    basicDirectional: melee('Vanishing Jab', {
      type: K, damage: 6, type2: R, damage2: 4, rangeW: 64, rangeH: 40, vfx: 'spark', vfxColor: 0xffe08a,
      baseKnockback: 120, knockbackGrowth: 2.4, duration: 160, cooldown: 360,
    }),
    specialDefense: m('Trace Amount', {
      phase: true, phaseRetort: { type: R, damage: 8, knockback: 90, growth: 1.6 },
      duration: 460, cooldown: 880, vfx: 'shield', vfxColor: 0xfff2c4,
    }),
    specialDirectional: m('Alpha Flick', {
      kind: 'projectile', type: R, damage: 10, vfx: 'spark', vfxColor: 0xffd36a,
      projectileSpeed: 540, projectileRadius: 8, projectileLife: 360,
      baseKnockback: 150, knockbackGrowth: 2.8, duration: 180, cooldown: 520,
    }),
  },

  manny: {
    basicCharge: m('Permanganate Splash', {
      kind: 'projectile', type: C, damage: 4, chargeDamageMult: 1.55, maxChargeMs: 850,
      vfx: 'acid', vfxColor: 0x7a2ea8,
      projectileSpeed: 420, projectileRadius: 12, projectileLife: 520,
      stainAtFull: { type: C, damage: 0.78, ms: 1500, radius: 46, tick: 360, color: 0x7a2ea8, onHit: { burn: { dps: 1.1, ms: 1200 } } },
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 220, cooldown: 800,
    }),
    basicDirectional: melee('Rock Crusher', {
      type: K, damage: 4, bonusVsBlock: 0.6, rangeW: 70, vfx: 'strike', vfxColor: 0x6b4a8a,
      baseKnockback: 130, knockbackGrowth: 2.6, duration: 230, cooldown: 460,
    }),
    specialDefense: m('Work Hardening', {
      kind: 'block', onlyReduce: [K, H], blockReduction: 0.28, harden: true, hardenStep: 0.11, hardenCap: 0.76,
      hardenLinger: 1800, hardenLingerStep: 0.07,
      duration: 780, cooldown: 860, vfx: 'shield', vfxColor: 0x8a6aa8,
    }),
    specialDirectional: m('Dry Cell Lob', {
      kind: 'projectile', type: E, damage: 4, explodeOnly: true, explodeRadius: 48, vfx: 'spark', vfxColor: 0xc45cff,
      projectileSpeed: 380, projectileRadius: 10, projectileLife: 620,
      baseKnockback: 100, knockbackGrowth: 2, duration: 220, cooldown: 700,
    }),
  },

  fey: {
    basicCharge: m('Forge Hammer', {
      kind: 'burst', type: K, damage: 6, type2: H, damage2: 5, chargeDamageMult: 1.6, chargeRadiusMult: 1.3,
      maxChargeMs: 900, radius: 54, vfx: 'fire', vfxColor: 0xff6a2a,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 280, cooldown: 880,
    }),
    basicDirectional: melee('Cold Iron Cut', {
      type: K, damage: 7, stripBuffs: true, rangeW: 78, vfx: 'strike', vfxColor: 0xc8d0d8,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 460,
    }),
    specialDefense: m('Lodestone Guard', {
      reflectMetals: true, duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xd85a4a,
    }),
    specialDirectional: m('Rust Bloom', {
      kind: 'projectile', type: C, damage: 4, vfx: 'cloud', vfxColor: 0xc4552a,
      onHit: { poison: { dps: 1.2, ms: 1400 }, corrode: { mult: 0.72, ms: 2000 } },
      projectileSpeed: 400, projectileRadius: 11, projectileLife: 500,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 680,
    }),
  },

  nick: {
    basicCharge: melee('Memory Snap', {
      kind: 'dash', type: K, damage: 8, chargeDamageMult: 1.5, chargeDashMult: 1.25,
      maxChargeMs: 800, dashSpeed: 520, rangeW: 84, rangeH: 64, vfx: 'dash', vfxColor: 0xcfd6dc,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 240, cooldown: 780,
    }),
    basicDirectional: melee('Nickel and Dime', {
      type: K, damage: 5, multiHit: 2, bonusVsBlock: 0.5, rangeW: 68, vfx: 'strike', vfxColor: 0xd8dde4,
      baseKnockback: 90, knockbackGrowth: 2, duration: 240, cooldown: 440,
    }),
    specialDefense: m('Electroplate', {
      immune: [C], kind: 'block', onlyReduce: [H], blockReduction: 0.5,
      duration: 680, cooldown: 800, vfx: 'shield', vfxColor: 0xb7e3c2,
    }),
    specialDirectional: m('Meteorite Drop', {
      kind: 'projectile', type: K, damage: 5, type2: H, damage2: 4, ground: true, angleable: true,
      vfx: 'strike', vfxColor: 0x8a93a0,
      projectileSpeed: 340, projectileRadius: 12, projectileLife: 700,
      baseKnockback: 130, knockbackGrowth: 2.4, duration: 220, cooldown: 700,
    }),
  },

  molly: {
    basicCharge: m('Red-Hot Rod', {
      kind: 'beam', type: K, damage: 6, type2: H, damage2: 7, chargeDamageMult: 1.4, chargeLengthMult: 1.9,
      maxChargeMs: 900, beamLen: 140, beamThick: 18, vfx: 'fire', vfxColor: 0xff4a3a,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 220, cooldown: 760,
    }),
    basicDirectional: melee('Grease Slide', {
      kind: 'dash', type: K, damage: 7, onHit: { slow: 450 }, dashSpeed: 500,
      rangeW: 96, rangeH: 40, vfx: 'dash', vfxColor: 0x6a7078,
      baseKnockback: 80, knockbackGrowth: 1.8, duration: 240, cooldown: 500,
    }),
    specialDefense: m('Dry Lube', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4, noKnockback: true,
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0x9aa3ad,
    }),
    specialDirectional: m('Nitrogenase', {
      kind: 'zone', type: C, damage: 2, vfx: 'cloud', vfxColor: 0x7dcea0,
      zone: { type: C, damage: 0.7, ms: 1100, radius: 56, tick: 460, color: 0x7dcea0, bonusVsId: { nitra: 2 } },
      baseKnockback: 40, knockbackGrowth: 0.6, duration: 240, cooldown: 860,
    }),
  },

  paula: {
    basicCharge: m('Cold Fusion', {
      kind: 'burst', type: H, damage: 14, fizzleCoin: true, chargeDamageMult: 1.15,
      maxChargeMs: 1000, radius: 68, selfDamage: { type: H, damage: 3, noFlinch: true },
      vfx: 'fire', vfxColor: 0xfff6d8,
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 260, cooldown: 920,
    }),
    basicDirectional: melee('White Gold Jab', {
      type: K, damage: 7, rangeW: 66, vfx: 'strike', vfxColor: 0xf4f0e6,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 190, cooldown: 400,
    }),
    specialDefense: m('Hydrogen Sponge', {
      absorbState: 'gas', fuelHeal: 4, fuelType: E, fuelDamage: 6,
      duration: 700, cooldown: 860, vfx: 'shield', vfxColor: 0xd7ecff,
    }),
    specialDirectional: m('Fuel Cell Bolt', {
      kind: 'projectile', type: E, damage: 6, vfx: 'spark', vfxColor: 0x8fd0ff,
      projectileSpeed: 500, projectileRadius: 10, projectileLife: 480,
      baseKnockback: 100, knockbackGrowth: 2, duration: 200, cooldown: 540,
    }),
  },

  haley: {
    basicCharge: m('Plasma Cutter', {
      kind: 'beam', type: H, damage: 4, type2: E, damage2: 3, chargeDamageMult: 1.45, chargeLengthMult: 1.8,
      maxChargeMs: 850, beamLen: 132, beamThick: 16, vfx: 'laser', vfxColor: 0x7ef0ff,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 200, cooldown: 820,
    }),
    basicDirectional: melee('Carbide Kick', {
      type: K, damage: 4, type2: H, damage2: 3, rangeW: 74, vfx: 'strike', vfxColor: 0xffb45a,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 210, cooldown: 500,
    }),
    specialDefense: m('High-K Gate', {
      immune: [E], duration: 640, cooldown: 800, vfx: 'shield', vfxColor: 0x9ad7ff,
    }),
    specialDirectional: m('Neutron Sink', {
      kind: 'projectile', type: K, damage: 4, vfx: 'spark', vfxColor: 0xb8c4d4,
      onHit: { mute: 'radiation', muteMs: 2600 },
      projectileSpeed: 440, projectileRadius: 11, projectileLife: 560,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 200, cooldown: 760,
    }),
  },

  ira: {
    basicCharge: m('Extinction Layer', {
      kind: 'burst', type: K, damage: 4, type2: H, damage2: 4, chargeDamageMult: 1.55, chargeRadiusMult: 1.25,
      maxChargeMs: 1200, radius: 52, vfx: 'strike', vfxColor: 0xd8d2c8,
      baseKnockback: 100, knockbackGrowth: 1.6, duration: 300, cooldown: 1200,
    }),
    basicDirectional: melee('Spark Plug', {
      type: K, damage: 4, type2: E, damage2: 3, bonusVsState: { gas: 1.55 }, rangeW: 64, vfx: 'spark', vfxColor: 0xffe08a,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 480,
    }),
    specialDefense: m('Prototype Kilogram', {
      flatHit: 8, duration: 640, cooldown: 980, vfx: 'shield', vfxColor: 0xe6e2da,
    }),
    specialDirectional: m('Iris Scatter', {
      kind: 'projectile', type: K, damage: 1.8, fanTypes: [K, H, E, C], fanSpread: 220, vfx: 'spark',
      projectileSpeed: 440, projectileRadius: 7, projectileLife: 420,
      baseKnockback: 70, knockbackGrowth: 1.6, duration: 220, cooldown: 720,
    }),
  },

  hog: {
    basicCharge: melee('Puddle Rise', {
      type: K, damage: 8.8, lift: true, slide: 170,
      whileCharging: { keep: 0, except: [H, E, C] },
      maxChargeMs: 800, rangeW: 70, rangeH: 64, vfx: 'strike', vfxColor: 0xc0c6cc,
      baseKnockback: 143, knockbackGrowth: 2.42, duration: 240, cooldown: 820,
    }),
    basicDirectional: melee('Quicksilver Lash', {
      type: K, damage: 5.5, type2: C, damage2: 5.5, rangeW: 124, rangeH: 28, vfx: 'strike', vfxColor: 0xd5dbe2,
      baseKnockback: 88, knockbackGrowth: 1.76, duration: 210, cooldown: 480,
    }),
    specialDefense: m('Amalgamate', {
      amalgam: true, amalgamMult: 0.66, amalgamVs: { aurelius: 0.38 }, amalgamMs: 2400,
      duration: 700, cooldown: 880, vfx: 'shield', vfxColor: 0xb9c2cc,
    }),
    specialDirectional: m("Hatter's Fume", {
      kind: 'zone', type: C, damage: 2.2, vfx: 'cloud', vfxColor: 0x8a9aa8,
      zone: { type: C, damage: 1.65, ms: 1500, radius: 70, tick: 380, color: 0x8a9aa8, onHit: { drift: 650, blind: 320 } },
      baseKnockback: 33, knockbackGrowth: 0.44, duration: 240, cooldown: 860,
    }),
  },

  gail: {
    basicCharge: m('Superconductor Arc', {
      kind: 'burst', type: E, damage: 5, chargeDamageMult: 1.4, chargeRadiusMult: 1.35,
      maxChargeMs: 850, radius: 72, vfx: 'spark', vfxColor: 0x9ae7ff,
      zone: { type: E, damage: 1.7, ms: 1500, radius: 78, tick: 320, color: 0x9ae7ff },
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Embrittle', {
      type: K, damage: 5, bonusVsId: { allen: 2 }, onHit: { root: 420, corrode: { mult: 0.7, ms: 2000 } },
      rangeW: 62, vfx: 'strike', vfxColor: 0xc8d4de,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 210, cooldown: 460,
    }),
    specialDefense: m('Body-Heat Melt', {
      noKnockback: true, buff: { heatTaken: 1.4, ms: 700 },
      duration: 700, cooldown: 840, vfx: 'shield', vfxColor: 0xd5e6f2,
    }),
    specialDirectional: m('Blue LED', {
      kind: 'beam', type: E, damage: 4, type2: H, damage2: 4, beamLen: 148, beamThick: 12,
      vfx: 'laser', vfxColor: 0x4aa8ff,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 180, cooldown: 460,
    }),
  },

  indy: {
    basicCharge: m('Invisible Film', {
      kind: 'zone', type: E, damage: 2, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xb9d4e8,
      zone: { type: E, damage: 2.6, ms: 1900, radius: 74, tick: 340, low: true, color: 0x9ec4d8 },
      baseKnockback: 40, knockbackGrowth: 0.6, duration: 220, cooldown: 900,
    }),
    basicDirectional: melee('Sticky Seal', {
      type: K, damage: 7, onHit: { root: 480 }, rangeW: 66, vfx: 'strike', vfxColor: 0xd8dee6,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Putty Guard', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.5, noKnockback: true,
      duration: 700, cooldown: 820, vfx: 'shield', vfxColor: 0xc5ced6,
    }),
    specialDirectional: melee('Solder Whip', {
      type: H, damage: 6, type2: K, damage2: 5, lift: true, rangeW: 128, rangeH: 32, vfx: 'spark', vfxColor: 0xe8eef4,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 220, cooldown: 480,
    }),
  },

  pablo: {
    basicCharge: m('Lead Balloon', {
      kind: 'burst', type: K, damage: 13, chargeDamageMult: 1.55, chargeRadiusMult: 1.25,
      maxChargeMs: 1000, radius: 56, vfx: 'strike', vfxColor: 0x8d939c,
      baseKnockback: 150, knockbackGrowth: 2.4, duration: 280, cooldown: 860,
    }),
    basicDirectional: melee('Lead Pipe', {
      type: K, damage: 11, onHit: { interrupt: 200 }, rangeW: 76, vfx: 'strike', vfxColor: 0x6e7580,
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 220, cooldown: 380,
    }),
    specialDefense: m('Lead Apron', {
      immune: [R], kind: 'block', onlyReduce: [H], blockReduction: 0.5,
      duration: 720, cooldown: 840, vfx: 'shield', vfxColor: 0x9aa3ae,
    }),
    specialDirectional: m('Sinker Cast', {
      kind: 'projectile', type: K, damage: 9, pull: 200, vfx: 'strike', vfxColor: 0x7d868f,
      projectileSpeed: 400, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 40, knockbackGrowth: 0.8, duration: 220, cooldown: 680,
    }),
  },

  arsenio: {
    basicCharge: m('Inheritance Powder', {
      kind: 'projectile', type: C, damage: 5, chargeDamageMult: 1.4, maxChargeMs: 800,
      onHit: { poison: { dps: 1.6, ms: 1400, inherit: true } },
      vfx: 'cloud', vfxColor: 0x7fbf4a,
      projectileSpeed: 400, projectileRadius: 12, projectileLife: 520,
      baseKnockback: 50, knockbackGrowth: 1, duration: 220, cooldown: 760,
    }),
    basicDirectional: melee('Paris Green Slash', {
      type: K, damage: 5, type2: C, damage2: 4, rangeW: 80, vfx: 'strike', vfxColor: 0x6aaa3a,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 480,
    }),
    specialDefense: m('Sublimate', {
      phase: true, phaseRetort: { type: C, damage: 5, knockback: 75, growth: 1.3 },
      duration: 480, cooldown: 900, vfx: 'shield', vfxColor: 0xb6e38a,
    }),
    specialDirectional: m('Green Wallpaper', {
      kind: 'zone', type: C, damage: 1, vfx: 'cloud', vfxColor: 0x8fbf62,
      zone: { type: C, damage: 1.1, ms: 1800, radius: 66, tick: 400, low: true, color: 0x8fbf62, onHit: { slow: 600 } },
      baseKnockback: 30, knockbackGrowth: 0.4, duration: 240, cooldown: 900,
    }),
  },

  iona: {
    basicCharge: m('Violet Vapor', {
      kind: 'projectile', type: C, damage: 7, pierce: true, chargeDamageMult: 1.35,
      maxChargeMs: 800, onHit: { blind: 520 }, vfx: 'cloud', vfxColor: 0x8a5cff,
      projectileSpeed: 280, projectileRadius: 18, projectileLife: 720,
      baseKnockback: 50, knockbackGrowth: 1, duration: 220, cooldown: 800,
    }),
    basicDirectional: melee('Tincture Swab', {
      type: C, damage: 7, onHit: { heal: 2 }, rangeW: 64, vfx: 'cloud', vfxColor: 0xc7a6ff,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 190, cooldown: 400,
    }),
    specialDefense: m('Iodide Shield', {
      immune: [R], cleanse: ['burn'], duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xd4c4ff,
    }),
    specialDirectional: m('Touch Powder', {
      kind: 'projectile', type: K, damage: 5, type2: H, damage2: 6, explodeOnly: true, explodeRadius: 46,
      vfx: 'fire', vfxColor: 0xfff2a0,
      projectileSpeed: 200, projectileRadius: 8, projectileLife: 1500,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 200, cooldown: 760,
    }),
  },

  krypto: {
    basicCharge: m('Excimer Laser', {
      kind: 'beam', type: R, damage: 5, type2: H, damage2: 4, chargeDamageMult: 1.4, chargeLengthMult: 1.55,
      maxChargeMs: 800, beamLen: 108, beamThick: 12, vfx: 'laser', vfxColor: 0xd7c4ff,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 180, cooldown: 700,
    }),
    basicDirectional: melee('Super Pounce', {
      kind: 'dash', type: K, damage: 7, dashSpeed: 660, rangeW: 90, rangeH: 56, vfx: 'dash', vfxColor: 0xe6d8ff,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 220, cooldown: 420,
    }),
    specialDefense: m('Flash Tube Counter', {
      kind: 'counter', counterType: E, counterDamage: 7, counterKnockback: 70, counterKnockbackGrowth: 1.4,
      counterStun: 280, counterBlind: 220,
      duration: 460, cooldown: 820, vfx: 'spark', vfxColor: 0xf4e8ff,
    }),
    specialDirectional: m('Meter Line', {
      kind: 'projectile', type: E, damage: 7, tipBonus: 4, tipAt: 240, vfx: 'spark', vfxColor: 0xc9b6ff,
      projectileSpeed: 520, projectileRadius: 8, projectileLife: 520,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 180, cooldown: 540,
    }),
  },

  lana: {
    basicCharge: m('Regenerative Charge', {
      kind: 'burst', type: E, damage: 10, perTravel: 140, perTravelCap: 5, chargeDamageMult: 1.25,
      maxChargeMs: 800, radius: 64, vfx: 'spark', vfxColor: 0x8fd0c8,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 240, cooldown: 820,
    }),
    basicDirectional: melee('Hidden Strike', {
      kind: 'dash', type: K, damage: 9, stillBonus: 1.45, dashSpeed: 440, rangeW: 80, rangeH: 50,
      vfx: 'dash', vfxColor: 0xb7ddd4,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 220, cooldown: 460,
    }),
    specialDefense: m('Lens Bend', {
      reflectProjectiles: true, duration: 620, cooldown: 820, vfx: 'shield', vfxColor: 0xd8fff4,
    }),
    specialDirectional: melee('Cracking Catalyst', {
      type: K, damage: 10, onHit: { corrode: { mult: 0.68, ms: 2200 } }, rangeW: 70, vfx: 'strike', vfxColor: 0x9ec8be,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 440,
    }),
  },

  goldie: {
    basicCharge: m('MRI Contrast', {
      kind: 'burst', type: E, damage: 4, chargeRadiusMult: 1.3, maxChargeMs: 800, radius: 78,
      onHit: { mark: 'scan', markMs: 2400, vulnerable: 1.08, vulnerableMs: 2000 },
      vfx: 'spark', vfxColor: 0xb8f0ff,
      baseKnockback: 30, knockbackGrowth: 0.4, duration: 240, cooldown: 880,
    }),
    basicDirectional: melee('Magnetocaloric Palm', {
      type: K, damage: 7, type2: H, damage2: 6, rangeW: 66, vfx: 'strike', vfxColor: 0xffd0a0,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Magnetic Chill', {
      immune: [H], cleanse: ['burn'], duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xd8f4ff,
    }),
    specialDirectional: melee('Room-Temp Magnet', {
      type: K, damage: 7, pull: 160, rangeW: 88, vfx: 'spark', vfxColor: 0xc8e6f4,
      baseKnockback: 100, knockbackGrowth: 2, duration: 230, cooldown: 540,
    }),
  },

  holly: {
    basicCharge: m('Stone Breaker', {
      kind: 'beam', type: H, damage: 9, chargeDamageMult: 1.4, chargeLengthMult: 1.7,
      bonusVsId: { carter: 2, bord: 2, silas: 2 },
      maxChargeMs: 900, beamLen: 136, beamThick: 16, vfx: 'laser', vfxColor: 0xffb0c8,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 200, cooldown: 780,
    }),
    basicDirectional: melee('Calibration Strike', {
      type: K, damage: 7, ignoreDefense: true, rangeW: 68, vfx: 'strike', vfxColor: 0xf2c4d4,
      baseKnockback: 80, knockbackGrowth: 1.3, duration: 190, cooldown: 440,
    }),
    specialDefense: m("Bend Don't Break", {
      kind: 'block', onlyReduce: [K], blockReduction: 0.45, noKnockback: true,
      duration: 720, cooldown: 840, vfx: 'shield', vfxColor: 0xf0b8cc,
    }),
    specialDirectional: melee('Pole Piece', {
      type: K, damage: 8, attractProjectiles: 16, rangeW: 72, vfx: 'spark', vfxColor: 0xe8a0b8,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 240, cooldown: 520,
    }),
  },

  lucy: {
    basicCharge: m('City of Light', {
      kind: 'burst', type: H, damage: 12, chargeDamageMult: 1.4, chargeRadiusMult: 1.3,
      maxChargeMs: 850, radius: 64, vfx: 'fire', vfxColor: 0xfff4c8,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 240, cooldown: 640,
    }),
    basicDirectional: melee('Final Lanthanide', {
      type: K, damage: 9, bonusVsStun: 1.4, rangeW: 74, vfx: 'strike', vfxColor: 0xf0e2b0,
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 200, cooldown: 380,
    }),
    specialDefense: m('Scintillator', {
      immune: [R], retort: { when: R, type: R, damage: 2, knockback: 40, growth: 0.4, blind: 440 },
      duration: 620, cooldown: 840, vfx: 'shield', vfxColor: 0xfff8d8,
    }),
    specialDirectional: m('Annihilation Pair', {
      kind: 'projectile', type: R, damage: 9, alsoBehind: true, vfx: 'spark', vfxColor: 0xfff2a8,
      projectileSpeed: 480, projectileRadius: 8, projectileLife: 420,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 640,
    }),
  },

  percy: {
    basicCharge: m('Frozen Light', {
      kind: 'beam', type: H, damage: 9, delayMs: 200, chargeDamageMult: 1.35, chargeLengthMult: 1.2,
      maxChargeMs: 800, beamLen: 220, beamThick: 18, vfx: 'laser', vfxColor: 0xd6ff4a,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 220, cooldown: 760,
    }),
    basicDirectional: melee('Green Twin Strike', {
      type: K, damage: 6, multiHit: 2, rangeW: 76, vfx: 'strike', vfxColor: 0x8fdb4a,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 240, cooldown: 400,
    }),
    specialDefense: m("Welder's Goggles", {
      frontOnly: true, blocks: [H], debuffImmune: true, cleanse: ['blind'],
      duration: 640, cooldown: 840, vfx: 'shield', vfxColor: 0xc6e85a,
    }),
    specialDirectional: m('Green Glass Shard', {
      kind: 'projectile', type: K, damage: 8, explodeOnly: true, explodeRadius: 50,
      vfx: 'spark', vfxColor: 0xc6f070,
      projectileSpeed: 460, projectileRadius: 8, projectileLife: 420,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 540,
    }),
  },

  rhoda: {
    basicCharge: m('Catalytic Converter', {
      kind: 'burst', type: H, damage: 9, chargeDamageMult: 1.3, chargeRadiusMult: 1.2,
      maxChargeMs: 850, radius: 52, eatZones: { radius: 150, type: 'chemical', bonus: 2, bonusType: 'heat' },
      vfx: 'fire', vfxColor: 0xf0b4c8,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Rose Thorn', {
      type: K, damage: 9, rangeW: 68, vfx: 'strike', vfxColor: 0xe07090,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 160, cooldown: 340,
    }),
    specialDefense: m('Tarnish Guard', {
      immune: [C], cleanse: ['debuff', 'poison'],
      duration: 640, cooldown: 860, vfx: 'shield', vfxColor: 0xf2c4d4,
    }),
    specialDirectional: m('High Beam', {
      kind: 'beam', type: H, damage: 9, beamLen: 180, beamThick: 36, onHit: { blind: 320 },
      vfx: 'laser', vfxColor: 0xfff2c4,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 520,
    }),
  },

  ronan: {
    basicCharge: m('Ground Seep', {
      kind: 'burst', type: R, damage: 9.5, chargeDamageMult: 1.2, riseUnder: true,
      maxChargeMs: 800, radius: 46, vfx: 'cloud', vfxColor: 0xd4f5a8,
      baseKnockback: 47.52, knockbackGrowth: 0.95, duration: 240, cooldown: 980,
    }),
    basicDirectional: melee('Decay Daughters', {
      type: K, damage: 8.32, rangeW: 68, vfx: 'strike', vfxColor: 0xc6e88a,
      zone: { type: R, damage: 0.66, ms: 900, radius: 40, tick: 460, color: 0xd4f5a8, knockback: 9.5, growth: 0.12 },
      baseKnockback: 83.16, knockbackGrowth: 1.54, duration: 200, cooldown: 460,
    }),
    specialDefense: m('Radon Spa', {
      regen: 1.5, regenEvery: 450,
      zone: { type: R, damage: 0.59, ms: 800, radius: 46, tick: 480, color: 0xe4ffb0, knockback: 7.13, growth: 0.12 },
      duration: 700, cooldown: 1000, vfx: 'shield', vfxColor: 0xd8f0a0,
    }),
    specialDirectional: m('Radon Creep', {
      kind: 'projectile', type: R, damage: 7.13, ground: true, vfx: 'cloud', vfxColor: 0xc6e070,
      dropZone: { type: R, damage: 0.66, ms: 1000, radius: 42, tick: 460, color: 0xc6e070, knockback: 7.13, growth: 0.12 },
      projectileSpeed: 280, projectileRadius: 12, projectileLife: 700,
      baseKnockback: 35.64, knockbackGrowth: 0.71, duration: 220, cooldown: 640,
    }),
  },

  ruben: {
    basicCharge: m('Condensate Collapse', {
      kind: 'dash', type: H, damage: 10, chargeDamageMult: 1.25, chargeDashMult: 1.1,
      maxChargeMs: 800, dashSpeed: 360, onHit: { freeze: 240 }, rangeW: 90, rangeH: 70,
      vfx: 'dash', vfxColor: 0x9ad7ff,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 260, cooldown: 760,
    }),
    basicDirectional: melee('Molten Palm', {
      type: K, damage: 8, type2: H, damage2: 6, rangeW: 74, vfx: 'fire', vfxColor: 0xff6a4a,
      zone: { type: H, damage: 0.6, ms: 800, radius: 34, tick: 420, color: 0xff6a4a, knockback: 10, growth: 0.15 },
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Laser Cooling', {
      immune: [H], onStruck: { slow: 600 },
      duration: 620, cooldown: 860, vfx: 'shield', vfxColor: 0xb7e4ff,
    }),
    specialDirectional: m('Violet Ember', {
      kind: 'projectile', type: H, damage: 4, igniteAt: 0.35, igniteDamage: 8, igniteRadius: 56,
      vfx: 'fire', vfxColor: 0xc44ad4,
      projectileSpeed: 400, projectileRadius: 8, projectileLife: 620,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 560,
    }),
  },

  ruth: {
    basicCharge: m('Sunlight Dye', {
      kind: 'beam', type: E, damage: 5, chargeDamageMult: 1.4, chargeLengthMult: 1.3,
      maxChargeMs: 850, beamLen: 180, beamThick: 16, vfx: 'laser', vfxColor: 0xffe08a,
      baseKnockback: 70, knockbackGrowth: 1.3, duration: 200, cooldown: 820,
    }),
    basicDirectional: melee('Hardener Hook', {
      type: K, damage: 5, breaksBlock: true, rangeW: 70, vfx: 'strike', vfxColor: 0xc8d0d8,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 460,
    }),
    specialDefense: m('Metathesis Swap', {
      kind: 'counter', counterType: K, counterDamage: 3, swap: true,
      counterKnockback: 30, counterKnockbackGrowth: 0.4,
      duration: 480, cooldown: 980, vfx: 'shield', vfxColor: 0xd8e4f0,
    }),
    specialDirectional: m('Grubbs Catalyst', {
      kind: 'projectile', type: C, damage: 3, vfx: 'spark', vfxColor: 0x8fd0c8,
      onHit: { chemVulnerable: 2, chemVulnerableMs: 2200 },
      projectileSpeed: 420, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 40, knockbackGrowth: 0.8, duration: 200, cooldown: 640,
    }),
  },

  saab: {
    basicCharge: m('Printing Press', {
      type: K, damage: 7, chargeDamageMult: 1.35, maxChargeMs: 800,
      onHit: { mark: 'type', markMs: 4200 }, rangeW: 80, rangeH: 48, vfx: 'strike', vfxColor: 0x9aa0a8,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 240, cooldown: 800,
    }),
    basicDirectional: melee('Kohl Swipe', {
      type: K, damage: 4, type2: C, damage2: 4, bonusVsMark: 'type', markMult: 1.4,
      onHit: { blind: 340 }, rangeW: 72, vfx: 'strike', vfxColor: 0x3a3a42,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Flame Retardant', {
      immune: [H], cleanse: ['burn'],
      duration: 640, cooldown: 840, vfx: 'shield', vfxColor: 0xd0d4d8,
    }),
    specialDirectional: m('Stibnite Needles', {
      kind: 'projectile', type: K, damage: 2.2, fan: 4, fanSpread: 200,
      bonusVsMark: 'type', markMult: 1.4, vfx: 'spark', vfxColor: 0xb8bcc2,
      projectileSpeed: 500, projectileRadius: 5, projectileLife: 360,
      baseKnockback: 50, knockbackGrowth: 1.2, duration: 200, cooldown: 560,
    }),
  },

  sam: {
    basicCharge: m('Heatproof Magnet', {
      kind: 'dash', type: K, damage: 5, type2: H, damage2: 4, chargeDamageMult: 1.3, chargeDashMult: 1.15,
      maxChargeMs: 800, dashSpeed: 500, rangeW: 88, rangeH: 70, vfx: 'dash', vfxColor: 0xffb070,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 260, cooldown: 800,
    }),
    basicDirectional: melee('Samarskite Smash', {
      type: K, damage: 7, rangeW: 74, vfx: 'strike', vfxColor: 0xc4a070,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 210, cooldown: 400,
    }),
    specialDefense: m('Mine Shaft Duck', {
      phase: 'overhead', phaseRetort: { type: K, damage: 4, knockback: 80, growth: 1.4 },
      duration: 420, cooldown: 980, vfx: 'shield', vfxColor: 0x8a7048,
    }),
    specialDirectional: m('Pickaxe Toss', {
      kind: 'projectile', type: K, damage: 6, returns: true, vfx: 'strike', vfxColor: 0xb89870,
      projectileSpeed: 440, projectileRadius: 10, projectileLife: 780,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 200, cooldown: 560,
    }),
  },

  sandy: {
    basicCharge: m('Tin Cry', {
      kind: 'burst', type: K, damage: 8, chargeDamageMult: 1.35, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: 70, onHit: { corrode: { mult: 0.75, ms: 1800 } },
      vfx: 'gust', vfxColor: 0xe8eef2,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 240, cooldown: 800,
    }),
    basicDirectional: melee('Organ Pipe Swing', {
      type: K, damage: 8, rangeW: 86, vfx: 'strike', vfxColor: 0xd8dee6,
      baseKnockback: 160, knockbackGrowth: 2.8, duration: 220, cooldown: 460,
    }),
    specialDefense: m('Tin Pest', {
      immune: [K], buff: { heatTaken: 1.5, ms: 700 },
      duration: 560, cooldown: 900, vfx: 'shield', vfxColor: 0xc8ced4,
    }),
    specialDirectional: m('Tin Can Kick', {
      kind: 'projectile', type: K, damage: 6, ground: true, ricochet: 2, vfx: 'strike', vfxColor: 0xd0d6dc,
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 900,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 200, cooldown: 560,
    }),
  },

  selena: {
    basicCharge: m('Photoconductor', {
      kind: 'beam', type: E, damage: 8, chargeDamageMult: 1.4, chargeLengthMult: 1.25,
      maxChargeMs: 800, beamLen: 210, beamThick: 16, vfx: 'laser', vfxColor: 0xfff0a0,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 800,
    }),
    basicDirectional: melee('Crescent Kick', {
      type: K, damage: 8, replayCapture: 'type', rangeW: 74, vfx: 'strike', vfxColor: 0xf0e6c0,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 200, cooldown: 400,
    }),
    specialDefense: m('Photocopy', {
      immune: [K, H, E, C, R], capture: true,
      duration: 460, cooldown: 1000, vfx: 'shield', vfxColor: 0xfff6d8,
    }),
    specialDirectional: m('Moonbeam', {
      kind: 'beam', type: E, damage: 7, beamLen: 160, beamThick: 18, vfx: 'laser', vfxColor: 0xf4f0ff,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 180, cooldown: 500,
    }),
  },

  sterling: {
    basicCharge: m('Bone Seeker', {
      kind: 'projectile', type: R, damage: 7.4, homing: 6, bonusVsMark: 'glow', markMult: 1.5,
      chargeDamageMult: 1.3, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xfff4c0,
      projectileSpeed: 340, projectileRadius: 10, projectileLife: 900,
      baseKnockback: 74.2, knockbackGrowth: 1.38, duration: 200, cooldown: 760,
    }),
    basicDirectional: melee('Night-Glow Hook', {
      type: K, damage: 6.4, onHit: { mark: 'glow', markMs: 7000 }, rangeW: 74, vfx: 'strike', vfxColor: 0xe8ffb0,
      baseKnockback: 106, knockbackGrowth: 2.12, duration: 200, cooldown: 420,
    }),
    specialDefense: m('Road Flare', {
      kind: 'block', blockReduction: 0.35, noKnockback: true, onStruck: { blind: 500, miss: true },
      zone: { type: H, damage: 1.06, ms: 700, radius: 42, tick: 420, color: 0xff4a2a, knockback: 17, growth: 0.21 },
      duration: 600, cooldown: 860, vfx: 'fire', vfxColor: 0xff4a2a,
    }),
    specialDirectional: m('Crimson Rocket', {
      kind: 'projectile', type: H, damage: 5.3, type2: K, damage2: 4.2, vfx: 'fire', vfxColor: 0xff3040,
      projectileSpeed: 480, projectileRadius: 9, projectileLife: 420,
      baseKnockback: 116.6, knockbackGrowth: 2.12, duration: 200, cooldown: 520,
    }),
  },

  terra: {
    basicCharge: m('Sonar Pulse', {
      kind: 'beam', type: K, damage: 7, breakPhase: true, onHit: { reveal: true },
      chargeDamageMult: 1.3, chargeLengthMult: 1.15, maxChargeMs: 800,
      beamLen: 520, beamThick: 16, vfx: 'gust', vfxColor: 0xb8f0c8,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 220, cooldown: 820,
    }),
    basicDirectional: melee('Flex Punch', {
      type: K, damage: 8, sweetSpot: 3, rangeW: 76, vfx: 'strike', vfxColor: 0x7dcea0,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 210, cooldown: 420,
    }),
    specialDefense: m('Floor Speaker', {
      retort: { type: K, damage: 6, knockback: 170, growth: 1.8 },
      duration: 480, cooldown: 960, vfx: 'shield', vfxColor: 0x9ad7b0,
    }),
    specialDirectional: m('Green Phosphor Bolt', {
      kind: 'projectile', type: R, damage: 8, vfx: 'spark', vfxColor: 0x8ef07a,
      projectileSpeed: 480, projectileRadius: 8, projectileLife: 440,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 540,
    }),
  },

  tessa: {
    basicCharge: m('Peltier Punch', {
      type: H, damage: 9, chargeDamageMult: 1.25, maxChargeMs: 800,
      buff: { heatTaken: 0.6, ms: 2000 }, rangeW: 70, rangeH: 48, vfx: 'fire', vfxColor: 0xff8844,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 220, cooldown: 780,
    }),
    basicDirectional: melee('Garlic Breath', {
      type: C, damage: 6, onHit: { interrupt: 220 }, rangeW: 72, rangeH: 46, vfx: 'cloud', vfxColor: 0xe8e0c0,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 180, cooldown: 400,
    }),
    specialDefense: m('Phase Rewrite', {
      kind: 'shield', healOnBlock: 7,
      duration: 640, cooldown: 980, vfx: 'shield', vfxColor: 0xd8d0ea,
    }),
    specialDirectional: m('Tellus Tremor', {
      kind: 'projectile', type: K, damage: 8, ground: true, vfx: 'strike', vfxColor: 0xc4b49a,
      projectileSpeed: 360, projectileRadius: 14, projectileLife: 560,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 220, cooldown: 540,
    }),
  },

  tex: {
    basicCharge: m('Metastable Flash', {
      kind: 'burst', type: R, damage: 14, chargeDamageMult: 1.3, chargeRadiusMult: 1.15,
      maxChargeMs: 900, radius: 64, vfx: 'spark', vfxColor: 0xe8ffb0,
      baseKnockback: 70, knockbackGrowth: 1.3, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Tracer Lasso', {
      type: K, damage: 7, type2: R, damage2: 7, breakPhase: true,
      onHit: { mark: 'tracer', markMs: 5000, reveal: true }, rangeW: 104, vfx: 'spark', vfxColor: 0xd4ff9a,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 210, cooldown: 460,
    }),
    specialDefense: m('Quick Draw', {
      kind: 'counter', counterType: R, counterDamage: 7,
      counterKnockback: 80, counterKnockbackGrowth: 1.4,
      duration: 480, cooldown: 900, vfx: 'shield', vfxColor: 0xe4f0c8,
    }),
    specialDirectional: m('Gamma Camera', {
      kind: 'beam', type: R, damage: 11, hitMarked: 'tracer', beamLen: 210, beamThick: 28,
      vfx: 'laser', vfxColor: 0xeeffb0,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 180, cooldown: 560,
    }),
  },

  thule: {
    basicCharge: m('Ultima Thule', {
      kind: 'projectile', type: K, damage: 8, tipBonus: 4, tipAt: 200, chargeDamageMult: 1.25,
      maxChargeMs: 800, vfx: 'spark', vfxColor: 0xc8e6ff,
      projectileSpeed: 540, projectileRadius: 8, projectileLife: 640,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 800,
    }),
    basicDirectional: melee('Polar Night', {
      type: K, damage: 7, type2: H, damage2: 5, onHit: { freeze: 240 }, rangeW: 74, vfx: 'strike', vfxColor: 0xb7d4ff,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Aurora Veil', {
      kind: 'block', blockReduction: 0.52, noKnockback: true, onStruck: { blind: 420, miss: true },
      duration: 600, cooldown: 840, vfx: 'shield', vfxColor: 0xb8f0c8,
    }),
    specialDirectional: m('Handheld X-Ray', {
      kind: 'beam', type: R, damage: 9, beamLen: 150, beamThick: 32, vfx: 'laser', vfxColor: 0xd0e8ff,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 180, cooldown: 500,
    }),
  },

  xander: {
    basicCharge: m('Ion Thruster', {
      kind: 'dash', type: E, damage: 8.5, chargeDamageMult: 1.2, chargeDashMult: 1.1,
      maxChargeMs: 800, dashSpeed: 520, rangeW: 96, rangeH: 80, vfx: 'dash', vfxColor: 0x7ec8ff,
      baseKnockback: 74.2, knockbackGrowth: 1.38, duration: 260, cooldown: 760,
    }),
    basicDirectional: melee('Arc Lamp Jab', {
      type: K, damage: 4.2, type2: E, damage2: 5.3, onHit: { blind: 280 }, rangeW: 70, vfx: 'spark', vfxColor: 0xc8e4ff,
      baseKnockback: 63.6, knockbackGrowth: 1.27, duration: 180, cooldown: 420,
    }),
    specialDefense: m('Anesthesia', {
      retort: { type: C, damage: 3.2, knockback: 21.2, growth: 0.32, stun: 420 },
      duration: 620, cooldown: 860, vfx: 'shield', vfxColor: 0xd8e8ff,
    }),
    specialDirectional: m('Xenon Strobe', {
      kind: 'beam', type: E, damage: 7.4, beamLen: 190, beamThick: 24, onHit: { slow: 500 },
      vfx: 'laser', vfxColor: 0x9ad0ff,
      baseKnockback: 42.4, knockbackGrowth: 0.85, duration: 180, cooldown: 540,
    }),
  },

  yara: {
    basicCharge: m('Maglev Launch', {
      kind: 'dash', type: K, damage: 8, chargeDamageMult: 1.25, chargeDashMult: 1.2,
      maxChargeMs: 800, dashSpeed: 620, rangeW: 96, rangeH: 70, vfx: 'dash', vfxColor: 0xe8eef8,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 280, cooldown: 780,
    }),
    basicDirectional: melee('Garnet Cut', {
      type: K, damage: 6, type2: H, damage2: 5, rangeW: 74, vfx: 'strike', vfxColor: 0xe07070,
      baseKnockback: 100, knockbackGrowth: 1.9, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Flux Pin', {
      pinProjectiles: 160, duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xd8e4ff,
    }),
    specialDirectional: m('Ytterby Mine', {
      kind: 'projectile', type: K, damage: 8, ground: true, explodeOnly: true, explodeRadius: 48,
      vfx: 'strike', vfxColor: 0xf0e6c8,
      projectileSpeed: 340, projectileRadius: 10, projectileLife: 640,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 620,
    }),
  },

  yvette: {
    basicCharge: m('Lattice Clock', {
      kind: 'burst', type: K, damage: 12, chargeDamageMult: 1.2,
      clockWindow: { period: 410, slack: 85, mult: 1.9 },
      maxChargeMs: 900, radius: 50, vfx: 'spark', vfxColor: 0xe8e0ff,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 220, cooldown: 900,
    }),
    basicDirectional: melee('Stress Gauge', {
      type: K, damage: 12, bonusVsPercent: 0.65, rangeW: 74, vfx: 'strike', vfxColor: 0xd0c4e8,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 200, cooldown: 420,
    }),
    specialDefense: m('Seismic Read', {
      blockGround: true, counterType: K, counterDamage: 6,
      counterKnockback: 110, counterKnockbackGrowth: 1.5,
      duration: 460, cooldown: 1000, vfx: 'shield', vfxColor: 0xc8c0d8,
    }),
    specialDirectional: m('Fiber Laser', {
      kind: 'beam', type: H, damage: 12, bonusVsMetal: 1.3, beamLen: 210, beamThick: 14,
      vfx: 'laser', vfxColor: 0xffd0a0,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 180, cooldown: 520,
    }),
  },

  zane: {
    basicCharge: m('Hot-Dip Galvanize', {
      kind: 'burst', type: H, damage: 7, chargeDamageMult: 1.3, chargeRadiusMult: 1.15,
      maxChargeMs: 850, radius: 56, buff: { chemTaken: 0.62, ms: 2400 },
      vfx: 'fire', vfxColor: 0xd8dce2,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 240, cooldown: 820,
    }),
    basicDirectional: melee('Brass Knuckles', {
      type: K, damage: 8, rangeW: 68, vfx: 'strike', vfxColor: 0xe0c070,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 200, cooldown: 400,
    }),
    specialDefense: m('Sacrificial Anode', {
      absorbTypes: [C, E], regrow: 2400,
      duration: 700, cooldown: 400, vfx: 'shield', vfxColor: 0xc8d0d8,
    }),
    specialDirectional: m('Fume Fever', {
      kind: 'projectile', type: C, damage: 6, onHit: { slow: 480 }, vfx: 'cloud', vfxColor: 0xd8dde4,
      projectileSpeed: 380, projectileRadius: 14, projectileLife: 480,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 200, cooldown: 560,
    }),
  },

  pat: {
    basicCharge: m('Proto Daughter', {
      kind: 'projectile', type: R, damage: 8, homing: 7, chargeDamageMult: 1.4,
      maxChargeMs: 800, vfx: 'spark', vfxColor: 0x9dff7a,
      projectileSpeed: 300, projectileRadius: 10, projectileLife: 900,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 220, cooldown: 820,
    }),
    basicDirectional: melee('Sediment Layer', {
      type: K, damage: 7, onHit: { slow: 420 }, rangeW: 74, vfx: 'strike', vfxColor: 0xd8c48a,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 200, cooldown: 420,
    }),
    specialDefense: m('Deep Time Rewind', {
      rewind: true, duration: 800, cooldown: 1100, vfx: 'shield', vfxColor: 0xc8e0ff,
    }),
    specialDirectional: m('Twin Hazard Bolt', {
      kind: 'projectile', type: C, damage: 6, type2: R, damage2: 6, vfx: 'cloud', vfxColor: 0xc57bff,
      projectileSpeed: 460, projectileRadius: 9, projectileLife: 520,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 200, cooldown: 560,
    }),
  },

  uri: {
    basicCharge: m('Chain Reaction', {
      kind: 'burst', type: R, damage: 6.9, type2: H, damage2: 5.2, chargeDamageMult: 1.45, chargeRadiusMult: 1.25,
      maxChargeMs: 900, radius: 72, vfx: 'fire', vfxColor: 0xffe08a,
      chain: { count: 2, fromHits: true, scale: 0.55, delay: 140, radiusScale: 0.62 },
      baseKnockback: 94.6, knockbackGrowth: 1.55, duration: 260, cooldown: 980,
    }),
    basicDirectional: melee('Self-Sharpening Jab', {
      type: K, damage: 5.2, sharpen: { step: 2, cap: 10 }, rangeW: 70, vfx: 'strike', vfxColor: 0xe8d090,
      baseKnockback: 86, knockbackGrowth: 1.55, duration: 180, cooldown: 340,
    }),
    specialDefense: m('DU Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.82, noKnockback: true,
      duration: 700, cooldown: 860, vfx: 'shield', vfxColor: 0xc8c0a0,
    }),
    specialDirectional: m('Yellowcake Lob', {
      kind: 'projectile', type: R, damage: 5.2, type2: C, damage2: 4.3, explodeOnly: true, explodeRadius: 56,
      vfx: 'cloud', vfxColor: 0xffe14a,
      zone: { type: R, damage: 1.2, ms: 1600, radius: 52, tick: 400, color: 0xffe14a },
      projectileSpeed: 340, projectileRadius: 12, projectileLife: 700,
      baseKnockback: 77.4, knockbackGrowth: 1.38, duration: 220, cooldown: 860,
    }),
  },

  neptune: {
    basicCharge: m('Tidal Surge', {
      kind: 'dash', type: K, damage: 10.2, angleDeg: 0, chargeDamageMult: 1.3, chargeDashMult: 1.25,
      maxChargeMs: 800, dashSpeed: 560, rangeW: 100, rangeH: 70, vfx: 'gust', vfxColor: 0x7ec8ff,
      baseKnockback: 244, knockbackGrowth: 3.9, duration: 280, cooldown: 820,
    }),
    basicDirectional: melee('Trident Thrust', {
      type: K, damage: 3.8, type2: R, damage2: 3.8, multiHit: 3, rangeW: 86, vfx: 'strike', vfxColor: 0x9ad0ff,
      baseKnockback: 85.4, knockbackGrowth: 1.46, duration: 240, cooldown: 460,
    }),
    specialDefense: m('Far Orbit', {
      phase: true, phaseRetort: { type: K, damage: 9, knockback: 219.6, growth: 2.68 },
      duration: 520, cooldown: 980, vfx: 'shield', vfxColor: 0x8ec4ff,
    }),
    specialDirectional: m('Breeder Seed', {
      kind: 'projectile', type: H, damage: 9, type2: R, damage2: 7.7, explodeOnly: true, explodeRadius: 58,
      delayMs: 900, vfx: 'fire', vfxColor: 0xffb45a,
      projectileSpeed: 280, projectileRadius: 10, projectileLife: 1400,
      baseKnockback: 122, knockbackGrowth: 2.07, duration: 220, cooldown: 900,
    }),
  },

  pluto: {
    basicCharge: m('Critical Mass', {
      kind: 'burst', type: H, damage: 10.7, type2: R, damage2: 10.7, chargeDamageMult: 2.05, chargeRadiusMult: 1.4,
      maxChargeMs: 900, radius: 64, vfx: 'supernova', vfxColor: 0xffd24a,
      overhold: { grace: 240, damage: 18.8, damage2: 18.8, radius: 86 },
      baseKnockback: 173.6, knockbackGrowth: 2.98, duration: 260, cooldown: 980,
    }),
    basicDirectional: melee('Decay-Heat Palm', {
      type: H, damage: 8, type2: R, damage2: 8, rangeW: 70, vfx: 'fire', vfxColor: 0xffb060,
      baseKnockback: 124, knockbackGrowth: 2.23, duration: 200, cooldown: 420,
    }),
    specialDefense: m('Demoted', {
      phase: 'overhead', shrink: 0.62, duration: 760, cooldown: 900, vfx: 'shield', vfxColor: 0xd0c8b0,
    }),
    specialDirectional: m('Deep Space Probe', {
      kind: 'projectile', type: R, damage: 0, pierce: true, vfx: 'spark', vfxColor: 0xffe08a,
      pulse: { type: R, damage: 4.56, every: 360, radius: 58 },
      projectileSpeed: 140, projectileRadius: 8, projectileLife: 2800,
      baseKnockback: 24.8, knockbackGrowth: 0.37, duration: 220, cooldown: 1100,
    }),
  },

  amy: {
    basicCharge: m('Alarm Blare', {
      kind: 'burst', type: K, damage: 10.6, onHit: { stun: 280 }, chargeDamageMult: 1.35, chargeRadiusMult: 1.3,
      maxChargeMs: 750, radius: 86, vfx: 'gust', vfxColor: 0xfff2a8,
      baseKnockback: 111.6, knockbackGrowth: 1.86, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Test Button', {
      type: K, damage: 6.6, type2: R, damage2: 6.6, rangeW: 64, vfx: 'spark', vfxColor: 0xd0ff9a,
      baseKnockback: 99.2, knockbackGrowth: 1.74, duration: 160, cooldown: 360,
    }),
    specialDefense: m('Ion Chamber', {
      immune: [C], absorbState: 'gas', fuelType: K, fuelDamage: 2.6,
      retort: { type: K, damage: 5.3, knockback: 272.8, growth: 2.98 },
      duration: 720, cooldown: 900, vfx: 'shield', vfxColor: 0xe8ffb0,
    }),
    specialDirectional: m('Chirping Detector', {
      kind: 'zone', type: R, damage: 2.6, vfx: 'spark', vfxColor: 0xd8ffb0,
      zone: { type: R, damage: 3.17, ms: 2800, radius: 56, tick: 380, color: 0xd8ffb0 },
      baseKnockback: 49.6, knockbackGrowth: 0.74, duration: 200, cooldown: 900,
    }),
  },

  curie: {
    basicCharge: m('Double Nobel', {
      kind: 'burst', type: R, damage: 11.8, chargeDamageMult: 1.35, chargeRadiusMult: 1.15,
      maxChargeMs: 800, radius: 58, vfx: 'spark', vfxColor: 0xfff6c8,
      chain: { count: 1, delay: 160, type: C, damage: 11.8, radiusScale: 0.9 },
      baseKnockback: 122.4, knockbackGrowth: 2.18, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Pocket Vial', {
      type: K, damage: 8.9, type2: R, damage2: 7.4, rangeW: 68, vfx: 'spark', vfxColor: 0xe8ffb0,
      baseKnockback: 122.4, knockbackGrowth: 2.18, duration: 190, cooldown: 400,
    }),
    specialDefense: m('Spectrometer Scan', {
      kind: 'block', blockReduction: 0.7, scanWeak: true, scanDamage: 10.4,
      duration: 560, cooldown: 960, vfx: 'shield', vfxColor: 0xd8f0ff,
    }),
    specialDirectional: m('Pitchblende Toss', {
      kind: 'projectile', type: R, damage: 10.4, explodeOnly: true, explodeRadius: 48, vfx: 'cloud', vfxColor: 0xc8e070,
      zone: { type: R, damage: 2.37, ms: 1400, radius: 46, tick: 360, color: 0xc8e070 },
      projectileSpeed: 380, projectileRadius: 11, projectileLife: 640,
      baseKnockback: 108.8, knockbackGrowth: 1.9, duration: 210, cooldown: 780,
    }),
  },

  burke: {
    basicCharge: m('Bombarded Target', {
      kind: 'burst', type: R, damage: 7.6, chargeDamageMult: 1.3, storeHits: { per: 4, cap: 20 },
      maxChargeMs: 1000, radius: 70, vfx: 'spark', vfxColor: 0xffd24a,
      baseKnockback: 108, knockbackGrowth: 1.84, duration: 240, cooldown: 900,
    }),
    basicDirectional: melee('Golden Bear Swipe', {
      type: K, damage: 8.6, rangeW: 82, vfx: 'strike', vfxColor: 0xf0c84a,
      baseKnockback: 129.6, knockbackGrowth: 2.16, duration: 210, cooldown: 420,
    }),
    specialDefense: m('Hot Cell', {
      blocks: [K, H, E, C, R], crackAfterHits: 4,
      duration: 900, cooldown: 1000, vfx: 'shield', vfxColor: 0xd8d4c8,
    }),
    specialDirectional: m('Express Shipment', {
      kind: 'projectile', type: R, damage: 17.3, vfx: 'spark', vfxColor: 0xfff0a0,
      projectileSpeed: 680, projectileRadius: 8, projectileLife: 260,
      baseKnockback: 151.2, knockbackGrowth: 2.59, duration: 180, cooldown: 720,
    }),
  },

  cali: {
    basicCharge: m('Neutron Kickstart', {
      kind: 'burst', type: R, damage: 8.1, chargeDamageMult: 1.35, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: 68, vfx: 'spark', vfxColor: 0xc8ff9a,
      buff: { ms: 2800, bonus: { type: R, damage: 3.6, hits: 3, name: 'Neutron Kickstart' } },
      baseKnockback: 72, knockbackGrowth: 1.26, duration: 240, cooldown: 900,
    }),
    basicDirectional: melee('Surf\'s Up', {
      kind: 'dash', type: K, damage: 7.2, dashSpeed: 540, rangeW: 96, rangeH: 64, vfx: 'gust', vfxColor: 0x8ecfff,
      baseKnockback: 108, knockbackGrowth: 1.8, duration: 260, cooldown: 480,
    }),
    specialDefense: m('Stunt Double', {
      absorbTypes: [K, H, E, C, R],
      duration: 640, cooldown: 1100, vfx: 'shield', vfxColor: 0xfff0c8,
    }),
    specialDirectional: m('Prospecting Probe', {
      kind: 'beam', type: R, damage: 7.2, bonusVsMetal: 1.45, bonusVsId: { aurelius: 1.8 },
      beamLen: 200, beamThick: 16, vfx: 'laser', vfxColor: 0xe8ff9a,
      baseKnockback: 63, knockbackGrowth: 1.17, duration: 180, cooldown: 560,
    }),
  },

  einstein: {
    basicCharge: m('Mass-Energy', {
      kind: 'burst', type: H, damage: 17.2, type2: R, damage2: 17.2, chargeDamageMult: 1.5, chargeRadiusMult: 1.3,
      maxChargeMs: 850, radius: 74, vfx: 'supernova', vfxColor: 0xfff6d0,
      selfDamage: { type: R, damage: 2, withCharge: true, noFlinch: true },
      baseKnockback: 193.49, knockbackGrowth: 3.27, duration: 260, cooldown: 1000,
    }),
    basicDirectional: melee('Time Dilation', {
      type: K, damage: 9.39, onHit: { slow: 520 }, rangeW: 72, vfx: 'strike', vfxColor: 0xd8e8ff,
      baseKnockback: 104.19, knockbackGrowth: 1.78, duration: 190, cooldown: 420,
    }),
    specialDefense: m('Thought Experiment', {
      replay: true, counterKnockback: 223.26, counterKnockbackGrowth: 2.93,
      duration: 480, cooldown: 1000, vfx: 'shield', vfxColor: 0xe8e0ff,
    }),
    specialDirectional: m('Fallout Rain', {
      kind: 'projectile', type: R, damage: 6.22, rain: 5, vfx: 'cloud', vfxColor: 0xd8ffb0,
      projectileSpeed: 80, projectileRadius: 8, projectileLife: 900,
      baseKnockback: 59.54, knockbackGrowth: 1.04, duration: 220, cooldown: 860,
    }),
  },

  fermi: {
    basicCharge: m('Chicago Pile', {
      kind: 'burst', type: R, damage: 7.2, type2: H, damage2: 6.3, chargeDamageMult: 1.5, chargeRadiusMult: 1.35,
      maxChargeMs: 1000, radius: 80, vfx: 'fire', vfxColor: 0xffd0a0,
      baseKnockback: 90, knockbackGrowth: 1.53, duration: 260, cooldown: 980,
    }),
    basicDirectional: m('Slow Neutron Punch', {
      kind: 'projectile', type: K, damage: 6.3, type2: R, damage2: 4.5, slowHit: true, vfx: 'spark', vfxColor: 0xfff2c8,
      projectileSpeed: 150, projectileRadius: 12, projectileLife: 700,
      baseKnockback: 81, knockbackGrowth: 1.44, duration: 220, cooldown: 460,
    }),
    specialDefense: m('Exclusion Zone', {
      phase: true, reflectProjectiles: true,
      phaseRetort: { type: K, damage: 1.8, knockback: 234, growth: 2.16 },
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xe8e8ff,
    }),
    specialDirectional: m('Fermi Paradox', {
      kind: 'burst', type: R, damage: 7.2, unseen: true, radius: 460, vfx: 'spark', vfxColor: 0xd0e0ff,
      baseKnockback: 72, knockbackGrowth: 1.26, duration: 220, cooldown: 860,
    }),
  },

  mendel: {
    basicCharge: m('Dream of the Table', {
      kind: 'buff', maxChargeMs: 900, vfx: 'spark', vfxColor: 0xfff6d8,
      buff: { ms: 4000, kineticTaken: 0.7, bonus: { type: K, damage: 4.6, hits: 4, name: 'Dream of the Table' } },
      duration: 200, cooldown: 1100,
    }),
    basicDirectional: melee('One Atom at a Time', {
      type: K, damage: 2.3, multiHit: 5, rangeW: 64, vfx: 'strike', vfxColor: 0xe8e0c8,
      baseKnockback: 46, knockbackGrowth: 0.8, duration: 260, cooldown: 400,
    }),
    specialDefense: m('Empty Square', {
      phase: true, duration: 560, cooldown: 900, vfx: 'shield', vfxColor: 0xf4f0e0,
    }),
    specialDirectional: m('Group Drop', {
      kind: 'projectile', type: K, damage: 9.2, type2: R, damage2: 6.9, fromAbove: true, fallSpeed: 460,
      vfx: 'strike', vfxColor: 0xe0d8c0,
      projectileSpeed: 40, projectileRadius: 16, projectileLife: 700,
      baseKnockback: 161, knockbackGrowth: 2.53, duration: 220, cooldown: 700,
    }),
  },

  noble: {
    basicCharge: m('Dynamite Stick', {
      kind: 'burst', type: K, damage: 9.8, type2: H, damage2: 8.5, chargeDamageMult: 1.7, chargeRadiusMult: 1.25,
      maxChargeMs: 800, radius: 60, vfx: 'fire', vfxColor: 0xff8844,
      overhold: { grace: 200, damage: 14.6, damage2: 12.2, radius: 48 },
      baseKnockback: 153.4, knockbackGrowth: 2.6, duration: 220, cooldown: 860,
    }),
    basicDirectional: melee('Medal Swing', {
      type: K, damage: 13.4, rangeW: 92, vfx: 'strike', vfxColor: 0xf0d24a,
      baseKnockback: 188.8, knockbackGrowth: 3.54, duration: 210, cooldown: 380,
    }),
    specialDefense: m('Peace Prize', {
      kind: 'counter', counterDamage: 0, counterType: K, counterKnockback: 0, counterKnockbackGrowth: 0,
      truce: { ms: 480, push: 220 },
      duration: 420, cooldown: 1100, vfx: 'shield', vfxColor: 0xfff6d0,
    }),
    specialDirectional: m('Blasting Cap', {
      kind: 'projectile', type: K, damage: 8.5, type2: H, damage2: 7.3, igniteAt: 0.62,
      igniteDamage: 9, igniteType: H, igniteRadius: 52, vfx: 'fire', vfxColor: 0xff7040,
      projectileSpeed: 420, projectileRadius: 7, projectileLife: 700,
      baseKnockback: 141.6, knockbackGrowth: 2.36, duration: 180, cooldown: 640,
    }),
  },

  lars: {
    basicCharge: m('Cyclotron Beam', {
      kind: 'beam', type: R, damage: 7.7, chargeDamageMult: 1.45, chargeLengthMult: 1.4,
      maxChargeMs: 850, beamLen: 220, beamThick: 16, vfx: 'laser', vfxColor: 0xc8f0ff,
      baseKnockback: 68.64, knockbackGrowth: 1.2, duration: 200, cooldown: 820,
    }),
    basicDirectional: melee('Spiral Fist', {
      type: K, damage: 6.82, rangeW: 74, vfx: 'strike', vfxColor: 0xd0e8ff,
      baseKnockback: 94.38, knockbackGrowth: 1.63, duration: 200, cooldown: 400,
    }),
    specialDefense: m('Dee Plates', {
      reflectProjectiles: true, duration: 640, cooldown: 860, vfx: 'shield', vfxColor: 0xd8e8ff,
    }),
    specialDirectional: m('Atom Smasher', {
      kind: 'projectile', type: R, damage: 6.82, type2: K, damage2: 6.05, vfx: 'spark', vfxColor: 0xe8f4ff,
      projectileSpeed: 560, projectileRadius: 9, projectileLife: 480,
      baseKnockback: 120.12, knockbackGrowth: 2.06, duration: 190, cooldown: 620,
    }),
  },

  duke: {
    basicCharge: m('Long Reign', {
      kind: 'burst', type: K, damage: 9.4, type2: R, damage2: 7.52, perSecond: 0.66, perSecondCap: 9.4,
      chargeDamageMult: 1.25, maxChargeMs: 700, radius: 62, vfx: 'spark', vfxColor: 0xfff2c0,
      baseKnockback: 159.8, knockbackGrowth: 3.38, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Ducal Cleave', {
      type: K, damage: 11.28, type2: R, damage2: 8.46, rangeW: 96, rangeH: 56, vfx: 'strike', vfxColor: 0xffe8a0,
      baseKnockback: 178.6, knockbackGrowth: 3.95, duration: 320, cooldown: 560,
    }),
    specialDefense: m('Fission Split', {
      phase: true,
      zone: { type: R, damage: 3.76, ms: 500, radius: 70, tick: 200, color: 0xc8ff9a },
      duration: 480, cooldown: 980, vfx: 'shield', vfxColor: 0xd8ffc0,
    }),
    specialDirectional: m('Heavy Ion Bolt', {
      kind: 'projectile', type: K, damage: 11.28, type2: R, damage2: 8.46, vfx: 'spark', vfxColor: 0xfff6c0,
      projectileSpeed: 540, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 188, knockbackGrowth: 4.14, duration: 200, cooldown: 780,
    }),
  },

  hoss: {
    basicCharge: m('Stampede', {
      kind: 'dash', type: K, damage: 11, type2: R, damage2: 8, chargeDamageMult: 1.25, chargeDashMult: 1.2,
      maxChargeMs: 700, dashSpeed: 780, hyperArmor: true, rangeW: 110, rangeH: 80, vfx: 'dash', vfxColor: 0xffe0a0,
      baseKnockback: 180, knockbackGrowth: 3.8, duration: 320, cooldown: 900,
    }),
    basicDirectional: melee('Iron Hoof', {
      type: K, damage: 12, rangeW: 78, vfx: 'strike', vfxColor: 0xe8d8c0,
      zone: { type: K, damage: 4, ms: 280, radius: 64, tick: 280, low: true, color: 0xe8d8c0, knockback: 80, growth: 1.2 },
      baseKnockback: 180, knockbackGrowth: 4.2, duration: 240, cooldown: 460,
    }),
    specialDefense: m('Doubly Magic', {
      kind: 'block', blockReduction: 0.78, noKnockback: true,
      duration: 700, cooldown: 1000, vfx: 'shield', vfxColor: 0xf0e8d0,
    }),
    specialDirectional: m('Lucky Horseshoe', {
      kind: 'projectile', type: K, damage: 12, luckyEvery: 4, ground: true, vfx: 'strike', vfxColor: 0xffd24a,
      projectileSpeed: 360, projectileRadius: 12, projectileLife: 640,
      baseKnockback: 190, knockbackGrowth: 4.0, duration: 200, cooldown: 700,
    }),
  },

  dash: {
    basicCharge: m('Triple Dash', {
      kind: 'dash', type: K, damage: 9.9, type2: R, damage2: 7.2, weaveEvery: 7, hyperArmor: true,
      chargeDamageMult: 1.2, maxChargeMs: 500, dashSpeed: 880, rangeW: 90, rangeH: 70, vfx: 'dash', vfxColor: 0xd0f0ff,
      baseKnockback: 158.4, knockbackGrowth: 3.52, duration: 420, cooldown: 900,
    }),
    basicDirectional: melee('Blink Kick', {
      kind: 'dash', type: K, damage: 10.8, type2: R, damage2: 7.2, dashSpeed: 700, rangeW: 84, rangeH: 64,
      vfx: 'dash', vfxColor: 0xe8f4ff,
      baseKnockback: 176, knockbackGrowth: 3.87, duration: 200, cooldown: 420,
    }),
    specialDefense: m('Afterimage Decay', {
      phase: true, leaveAfterimage: true,
      phaseRetort: { type: R, damage: 8.1, knockback: 123.2, growth: 2.11 },
      duration: 420, cooldown: 860, vfx: 'shield', vfxColor: 0xe8f8ff,
    }),
    specialDirectional: m('Darmstadt Dart', {
      kind: 'projectile', type: R, damage: 12.6, vfx: 'spark', vfxColor: 0xf4fbff,
      projectileSpeed: 780, projectileRadius: 4, projectileLife: 280,
      baseKnockback: 176, knockbackGrowth: 3.7, duration: 140, cooldown: 640,
    }),
  },

  copernicus: {
    basicCharge: m('Heliocentric', {
      kind: 'burst', type: K, damage: 16, chargeDamageMult: 1.25, chargeRadiusMult: 1.35,
      maxChargeMs: 800, radius: 120, pull: { radius: 200, speed: 140 }, vfx: 'gust', vfxColor: 0xfff2c8,
      baseKnockback: 200, knockbackGrowth: 4.0, duration: 240, cooldown: 860,
    }),
    basicDirectional: m('Revolution', {
      kind: 'burst', type: K, damage: 13, type2: R, damage2: 8, radius: 78, vfx: 'spark', vfxColor: 0xfff6d0,
      baseKnockback: 200, knockbackGrowth: 4.4, duration: 260, cooldown: 520,
    }),
    specialDefense: m('Evaporate', {
      immune: [K], duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xe8f0ff,
    }),
    specialDirectional: m('Orrery Shot', {
      kind: 'projectile', type: K, damage: 14, type2: R, damage2: 10, orbitMs: 420, orbitRadius: 56,
      vfx: 'spark', vfxColor: 0xfff0c0,
      projectileSpeed: 480, projectileRadius: 10, projectileLife: 1100,
      baseKnockback: 240, knockbackGrowth: 5.2, duration: 200, cooldown: 860,
    }),
  },

  niko: {
    basicCharge: m('Rising Sun', {
      kind: 'burst', type: H, damage: 14.9, type2: R, damage2: 14.9, chargeDamageMult: 1.3, chargeRadiusMult: 1.25,
      maxChargeMs: 800, radius: 80, vfx: 'fire', vfxColor: 0xffb060,
      baseKnockback: 212.4, knockbackGrowth: 4.72, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Three-Atom Combo', {
      type: R, damage: 7.4, multiHit: 3, rangeW: 74, vfx: 'spark', vfxColor: 0xffd0a0,
      baseKnockback: 94.4, knockbackGrowth: 1.89, duration: 280, cooldown: 460,
    }),
    specialDefense: m('Nine-Year Wait', {
      kind: 'counter', counterType: R, counterDamage: 19.8,
      counterKnockback: 236, counterKnockbackGrowth: 4.72,
      duration: 700, cooldown: 1100, vfx: 'shield', vfxColor: 0xffe0c0,
    }),
    specialDirectional: m('Zinc Ion Beam', {
      kind: 'beam', type: R, damage: 17.4, type2: K, damage2: 12.4, beamLen: 250, beamThick: 18,
      vfx: 'laser', vfxColor: 0xffe8c0,
      baseKnockback: 188.8, knockbackGrowth: 4.01, duration: 180, cooldown: 700,
    }),
  },

  flo: {
    basicCharge: m('Island of Stability', {
      kind: 'burst', type: R, damage: 11.5, chargeDamageMult: 1.25, chargeRadiusMult: 1.3,
      maxChargeMs: 900, radius: 84, pauseDrain: 5000, vfx: 'spark', vfxColor: 0xd8ffc8,
      baseKnockback: 124.8, knockbackGrowth: 2.65, duration: 240, cooldown: 1000,
    }),
    basicDirectional: melee('Riptide', {
      kind: 'dash', type: K, damage: 9, type2: R, damage2: 6.6, angleDeg: 0, dashSpeed: 700,
      rangeW: 100, rangeH: 64, vfx: 'gust', vfxColor: 0xc8e8ff,
      baseKnockback: 132.6, knockbackGrowth: 2.81, duration: 280, cooldown: 520,
    }),
    specialDefense: m('Identity Crisis', {
      cycle: [K, C], cycleMs: 280,
      duration: 800, cooldown: 960, vfx: 'shield', vfxColor: 0xe8e0ff,
    }),
    specialDirectional: m('Magic Number', {
      kind: 'projectile', type: R, damage: 12.3, vfx: 'spark', vfxColor: 0xf4fff0,
      projectileSpeed: 500, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 148.2, knockbackGrowth: 3.12, duration: 180, cooldown: 820,
    }),
  },

  zora: {
    basicCharge: melee('Ceramic Blade', {
      type: K, damage: 8, breaksBlock: true, chargeDamageMult: 1.5, chargeRangeMult: 1.85,
      maxChargeMs: 850, rangeW: 64, rangeH: 46, vfx: 'strike', vfxColor: 0xe8eef4,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 240, cooldown: 780,
    }),
    basicDirectional: melee('Cubic Cut', {
      type: K, damage: 8, rangeW: 70, vfx: 'spark', vfxColor: 0xf4fbff,
      baseKnockback: 120, knockbackGrowth: 2.1, duration: 190, cooldown: 400,
    }),
    specialDefense: m('Zircaloy Cladding', {
      immune: [R], kind: 'block', onlyReduce: [H], blockReduction: 0.78,
      duration: 720, cooldown: 880, vfx: 'shield', vfxColor: 0xd8e4ee,
    }),
    specialDirectional: m('Counterfeit Gem', {
      kind: 'projectile', type: K, damage: 7, explodeOnly: true, explodeRadius: 54, vfx: 'spark', vfxColor: 0xf7fbff,
      projectileSpeed: 420, projectileRadius: 8, projectileLife: 520,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 200, cooldown: 640,
    }),
  },

  niobe: {
    basicCharge: m('Particle Ring', {
      kind: 'beam', type: E, damage: 3.51, type2: R, damage2: 2.96, chargeDamageMult: 1.45, chargeLengthMult: 1.35,
      maxChargeMs: 850, beamLen: 200, beamThick: 18, vfx: 'laser', vfxColor: 0xb8d0ff,
      baseKnockback: 44.93, knockbackGrowth: 0.8, duration: 220, cooldown: 840,
    }),
    basicDirectional: melee('Anodized Edge', {
      type: K, damage: 2.96, sharpen: { step: 1, cap: 5 }, rangeW: 76, vfx: 'strike', vfxColor: 0x9ad0ff,
      baseKnockback: 44.93, knockbackGrowth: 0.85, duration: 180, cooldown: 380,
    }),
    specialDefense: m('Weeping Stone', {
      kind: 'block', onlyReduce: [K, H], blockReduction: 0.82, noKnockback: true,
      duration: 800, cooldown: 960, vfx: 'shield', vfxColor: 0xc8d0e0,
    }),
    specialDirectional: m('Magnet Quench', {
      kind: 'projectile', type: E, damage: 3.51, type2: H, damage2: 2.96, explodeOnly: true, explodeRadius: 62,
      vfx: 'spark', vfxColor: 0xffd0a0,
      projectileSpeed: 440, projectileRadius: 10, projectileLife: 480,
      baseKnockback: 54.91, knockbackGrowth: 0.95, duration: 200, cooldown: 700,
    }),
  },

  gertrude: {
    basicCharge: m("Mendeleev's Prediction", {
      kind: 'burst', type: K, damage: 4.8, type2: E, damage2: 4.1, chargeDamageMult: 1.4, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: 46, predict: { lead: 0.34 }, vfx: 'spark', vfxColor: 0xd0e0ff,
      baseKnockback: 68, knockbackGrowth: 1.22, duration: 260, cooldown: 860,
    }),
    basicDirectional: melee('Point Contact', {
      type: K, damage: 3.4, type2: E, damage2: 3.4, echoWithin: 720, echoMult: 1.7, rangeW: 62,
      vfx: 'spark', vfxColor: 0xc8dcff,
      baseKnockback: 54.4, knockbackGrowth: 1.02, duration: 160, cooldown: 320,
    }),
    specialDefense: m('Thermal Lens', {
      immune: [H], duration: 700, cooldown: 860, vfx: 'shield', vfxColor: 0xffe0c0,
    }),
    specialDirectional: m('Crystal Radio Wave', {
      kind: 'projectile', type: E, damage: 5.4, angleable: true, arc: 160, vfx: 'spark', vfxColor: 0xb0d4ff,
      projectileSpeed: 360, projectileRadius: 9, projectileLife: 700,
      baseKnockback: 54.4, knockbackGrowth: 0.95, duration: 200, cooldown: 620,
    }),
  },

  nadia: {
    basicCharge: m('Magnet Pull', {
      kind: 'burst', type: K, damage: 6.4, chargeDamageMult: 1.4, chargeRadiusMult: 1.15,
      maxChargeMs: 800, radius: 70, pull: { radius: 240, speed: 160, metals: true }, vfx: 'gust', vfxColor: 0xd8c8ff,
      baseKnockback: 86.8, knockbackGrowth: 1.49, duration: 240, cooldown: 900,
    }),
    basicDirectional: melee('Bass Drop Punch', {
      type: K, damage: 5.6, rangeW: 72, vfx: 'strike', vfxColor: 0xc8b8f0,
      baseKnockback: 130.2, knockbackGrowth: 2.73, duration: 220, cooldown: 480,
    }),
    specialDefense: m('Polarity Flip', {
      repelMetals: true, reflectMetals: true, repelPower: 1.15,
      counterKnockback: 105.4, counterKnockbackGrowth: 1.98,
      duration: 640, cooldown: 860, vfx: 'shield', vfxColor: 0xd0c0ff,
    }),
    specialDirectional: m('Rotor Throw', {
      kind: 'projectile', type: K, damage: 4.8, type2: E, damage2: 4, dragMetals: true, dragRadius: 96,
      vfx: 'spark', vfxColor: 0xc8b8ff,
      projectileSpeed: 400, projectileRadius: 12, projectileLife: 560,
      baseKnockback: 55.8, knockbackGrowth: 0.99, duration: 200, cooldown: 680,
    }),
  },

  prometheus: {
    basicCharge: melee('Stolen Fire', {
      type: H, damage: 8, stealHeat: { cap: 14, keep: 0.85 }, chargeDamageMult: 1.35,
      maxChargeMs: 800, rangeW: 72, vfx: 'fire', vfxColor: 0xff7040,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 200, cooldown: 760,
    }),
    basicDirectional: melee('Torchbearer Swing', {
      type: K, damage: 6, type2: H, damage2: 6, rangeW: 80, vfx: 'fire', vfxColor: 0xff8844,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 210, cooldown: 420,
    }),
    specialDefense: m('Chained to the Rock', {
      noKnockback: true, regen: 3, regenEvery: 420,
      duration: 900, cooldown: 1000, vfx: 'shield', vfxColor: 0xc8b090,
    }),
    specialDirectional: m('Beta Battery', {
      kind: 'projectile', type: R, damage: 4, vfx: 'spark', vfxColor: 0xd0ffb0,
      zone: { type: R, damage: 1.8, ms: 2200, radius: 40, tick: 360, color: 0xd0ffb0 },
      projectileSpeed: 380, projectileRadius: 8, projectileLife: 520,
      baseKnockback: 50, knockbackGrowth: 0.8, duration: 200, cooldown: 780,
    }),
  },

  ford: {
    basicCharge: melee('Dense Nucleus', {
      type: K, damage: 12.7, type2: R, damage2: 10.6, chargeDamageMult: 1.35,
      maxChargeMs: 750, rangeW: 78, rangeH: 52, vfx: 'spark', vfxColor: 0xfff0c0,
      baseKnockback: 208.8, knockbackGrowth: 4.41, duration: 220, cooldown: 820,
    }),
    basicDirectional: melee('Backscatter', {
      type: K, damage: 11.7, type2: R, damage2: 9.5, onHit: { reverse: true }, rangeW: 76,
      vfx: 'strike', vfxColor: 0xffe8a0,
      baseKnockback: 232, knockbackGrowth: 4.64, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Gold Foil', {
      phase: true, foilEvery: 8, duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xffe8a0,
    }),
    specialDirectional: m('Transmute Ray', {
      kind: 'beam', type: R, damage: 15.9, onHit: { scramble: 2200 }, beamLen: 240, beamThick: 16,
      vfx: 'laser', vfxColor: 0xfff6c0,
      baseKnockback: 185.6, knockbackGrowth: 3.94, duration: 180, cooldown: 900,
    }),
  },

  boar: {
    basicCharge: m('Quantum Leap', {
      kind: 'burst', type: R, damage: 11.3, chargeDamageMult: 1.3, chargeRadiusMult: 1.2,
      maxChargeMs: 650, radius: 58, leap: { dist: 120 }, vfx: 'spark', vfxColor: 0xd0f0ff,
      baseKnockback: 150.4, knockbackGrowth: 3.2, duration: 200, cooldown: 780,
    }),
    basicDirectional: melee('Shell Gore', {
      kind: 'dash', type: K, damage: 10.3, type2: E, damage2: 7.5, dashSpeed: 640, rangeW: 96, rangeH: 64,
      vfx: 'dash', vfxColor: 0xc8e4ff,
      baseKnockback: 169.2, knockbackGrowth: 3.57, duration: 240, cooldown: 460,
    }),
    specialDefense: m('Complementarity', {
      immune: [K], duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xd8ecff,
    }),
    specialDirectional: m('Spectral Line', {
      kind: 'beam', type: R, damage: 14.1, beamLen: 300, beamThick: 8, vfx: 'laser', vfxColor: 0x9ad0ff,
      baseKnockback: 131.6, knockbackGrowth: 2.82, duration: 160, cooldown: 820,
    }),
  },

  roger: {
    basicCharge: m('X-Ray Vision', {
      kind: 'buff', revealAll: true, doubleNext: true, duration: 180, cooldown: 900,
      vfx: 'spark', vfxColor: 0xe8f4ff,
    }),
    basicDirectional: melee('Skeleton Flash', {
      type: K, damage: 12, type2: R, damage2: 10, onHit: { reveal: true }, rangeW: 74,
      vfx: 'spark', vfxColor: 0xf4fbff,
      baseKnockback: 180, knockbackGrowth: 3.8, duration: 160, cooldown: 420,
    }),
    specialDefense: m('Crookes Tube', {
      retort: { type: R, damage: 9, knockback: 140, growth: 2.6 },
      duration: 520, cooldown: 900, vfx: 'shield', vfxColor: 0xe8f0ff,
    }),
    specialDirectional: m('Penetrating Ray', {
      kind: 'beam', type: R, damage: 16, breaksBlock: true, popShield: true, breakPhase: true,
      beamLen: 340, beamThick: 14, vfx: 'laser', vfxColor: 0xf4fbff,
      baseKnockback: 170, knockbackGrowth: 3.6, duration: 160, cooldown: 980,
    }),
  },

  ogden: {
    basicCharge: m('End of the Table', {
      kind: 'burst', type: K, damage: 3.4,
      hits: [
        { type: H, damage: 3.4 },
        { type: E, damage: 3.4 },
        { type: C, damage: 3.4 },
        { type: R, damage: 3.4 },
      ],
      chargeDamageMult: 1.4, chargeRadiusMult: 1.25,
      maxChargeMs: 800, radius: 72, vfx: 'supernova', vfxColor: 0xe8e0ff,
      baseKnockback: 146.2, knockbackGrowth: 3.1, duration: 240, cooldown: 980,
    }),
    basicDirectional: melee('Light-Speed Jab', {
      type: K, damage: 9.5, type2: R, damage2: 6.9, rangeW: 68,
      vfx: 'strike', vfxColor: 0xf4f0ff,
      baseKnockback: 137.6, knockbackGrowth: 2.75, duration: 90, cooldown: 340,
    }),
    specialDefense: m('Broken Noble', {
      reflectTypes: [C, E], reflectPower: 1.4,
      counterKnockback: 154.8, counterKnockbackGrowth: 2.92,
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xe0d8ff,
    }),
    specialDirectional: m('Millisecond Beam', {
      kind: 'beam', type: R, damage: 15.5, beamLen: 560, beamThick: 10, vfx: 'laser', vfxColor: 0xf4f0ff,
      baseKnockback: 172, knockbackGrowth: 3.61, duration: 70, cooldown: 1400,
    }),
  },

  sarge: {
    basicCharge: m('Sound Off', {
      kind: 'buff', chargeStack: { every: 1000, damage: 5.6, cap: 17 }, unblockAtFull: true,
      maxChargeMs: 3000, duration: 160, cooldown: 800, vfx: 'spark', vfxColor: 0xffe08a,
    }),
    basicDirectional: melee('Six-Count Flurry', {
      type: K, damage: 8.4, type2: R, damage2: 7, multiHit: 6, rangeW: 78, rangeH: 52,
      vfx: 'strike', vfxColor: 0xfff2c0,
      baseKnockback: 97.6, knockbackGrowth: 1.95, duration: 420, cooldown: 640,
    }),
    specialDefense: m('Periodic Shield', {
      blocks: [K, H, E, C, R], crackAfterHits: 5,
      duration: 900, cooldown: 1100, vfx: 'shield', vfxColor: 0xf0e8c8,
    }),
    specialDirectional: m('Decay Mortar', {
      kind: 'projectile', type: R, damage: 19.6, type2: H, damage2: 14, lob: 480, explodeOnly: true,
      explodeRadius: 78, vfx: 'spark', vfxColor: 0xffd070,
      projectileSpeed: 340, projectileRadius: 11, projectileLife: 900,
      baseKnockback: 231.8, knockbackGrowth: 4.88, duration: 220, cooldown: 860,
    }),
  },

  mae: {
    basicCharge: m('Liquid Drop Split', {
      kind: 'projectile', type: R, damage: 7.64, type2: H, damage2: 6.55, alsoBehind: true,
      chargeDamageMult: 1.45, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xfff0a0,
      projectileSpeed: 460, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 98.28, knockbackGrowth: 2.07, duration: 220, cooldown: 820,
    }),
    basicDirectional: melee('Overlooked', {
      type: K, damage: 7.64, type2: R, damage2: 6.01, rangeW: 70, vfx: 'strike', vfxColor: 0xf4fbff,
      baseKnockback: 92.82, knockbackGrowth: 1.97, duration: 90, cooldown: 420,
    }),
    specialDefense: m('Border Slip', {
      kind: 'counter', counterType: R, counterDamage: 7.64, swap: true,
      counterKnockback: 98.28, counterKnockbackGrowth: 2.07,
      duration: 520, cooldown: 900, vfx: 'shield', vfxColor: 0xe8f4ff,
    }),
    specialDirectional: m('Neutron Splitter', {
      kind: 'projectile', type: R, damage: 6.55, splitOnHit: true, splitDamage: 5.46, splitSpread: 160,
      vfx: 'spark', vfxColor: 0xe8ffc0,
      projectileSpeed: 520, projectileRadius: 7, projectileLife: 480,
      baseKnockback: 87.36, knockbackGrowth: 1.86, duration: 180, cooldown: 780,
    }),
  },

  mac: {
    basicCharge: m('Decay Cascade', {
      kind: 'burst', type: R, damage: 16, commit: true,
      pulses: [
        { damage: 16, delay: 0 },
        { damage: 13, delay: 120 },
        { damage: 10, delay: 240 },
        { damage: 8, delay: 360 },
        { damage: 6, delay: 480 },
      ],
      chargeDamageMult: 1.3, maxChargeMs: 800, radius: 72, vfx: 'spark', vfxColor: 0xffb0b0,
      baseKnockback: 150, knockbackGrowth: 3.2, duration: 720, cooldown: 980,
    }),
    basicDirectional: melee('Red Hammer', {
      type: K, damage: 14, type2: R, damage2: 11, rangeW: 88, vfx: 'strike', vfxColor: 0xff6040,
      baseKnockback: 190, knockbackGrowth: 4.2, duration: 240, cooldown: 480,
    }),
    specialDefense: m('Nesting Doll', {
      blocks: [K, H, E, C, R], crackAfterHits: 3, shellShrink: 0.82,
      duration: 1100, cooldown: 1200, vfx: 'shield', vfxColor: 0xffd0c0,
    }),
    specialDirectional: m('Short Fuse', {
      kind: 'projectile', type: R, damage: 16, type2: H, damage2: 12, lob: 360, explodeOnly: true,
      explodeRadius: 86, vfx: 'spark', vfxColor: 0xff7040,
      projectileSpeed: 280, projectileRadius: 12, projectileLife: 680,
      baseKnockback: 200, knockbackGrowth: 4.4, duration: 200, cooldown: 860,
    }),
  },

  liv: {
    basicCharge: m('192 Beams', {
      kind: 'burst', type: H, damage: 15.12, type2: R, damage2: 13.44, fizzleBelow: 0.95,
      chargeDamageMult: 1.15, chargeRadiusMult: 1.2, maxChargeMs: 1100, radius: 92,
      vfx: 'supernova', vfxColor: 0xffe8a0,
      baseKnockback: 176.4, knockbackGrowth: 3.86, duration: 280, cooldown: 1100,
    }),
    basicDirectional: melee('Chalcogen Hook', {
      type: K, damage: 11.76, type2: C, damage2: 9.24, rangeW: 78, vfx: 'strike', vfxColor: 0xffd24a,
      baseKnockback: 159.6, knockbackGrowth: 3.36, duration: 220, cooldown: 460,
    }),
    specialDefense: m('Hohlraum', {
      reflectTypes: [H, R], reflectAs: R, reflectPower: 1.3,
      counterKnockback: 142.8, counterKnockbackGrowth: 3.02,
      duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xffe08a,
    }),
    specialDirectional: m('Last Instant', {
      kind: 'projectile', type: R, damage: 18.48, vfx: 'spark', vfxColor: 0xfff6c0,
      projectileSpeed: 640, projectileRadius: 6, projectileLife: 110,
      baseKnockback: 134.4, knockbackGrowth: 2.69, duration: 120, cooldown: 720,
    }),
  },

  tess: {
    basicCharge: m('Electron Hunger', {
      kind: 'burst', type: C, damage: 5.95, chargeDamageMult: 1.35, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: 64, pull: { radius: 220, speed: 200 }, vfx: 'gust', vfxColor: 0x9ad0ff,
      baseKnockback: 50.34, knockbackGrowth: 1.08, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Last Halogen', {
      type: C, damage: 6.45, type2: R, damage2: 5.46, rangeW: 72, vfx: 'strike', vfxColor: 0xc8b4ff,
      baseKnockback: 64.73, knockbackGrowth: 1.44, duration: 200, cooldown: 440,
    }),
    specialDefense: m('Smoky Haze', {
      phase: true,
      zone: { type: C, damage: 2.48, ms: 700, radius: 78, tick: 180, color: 0x8eb4ff },
      duration: 700, cooldown: 980, vfx: 'shield', vfxColor: 0x9ec0ff,
    }),
    specialDirectional: m('Six-Atom Spread', {
      kind: 'projectile', type: R, damage: 3.97, fan: 6, fanSpread: 210, vfx: 'spark', vfxColor: 0xd0e4ff,
      projectileSpeed: 520, projectileRadius: 5, projectileLife: 420,
      baseKnockback: 43.15, knockbackGrowth: 0.86, duration: 180, cooldown: 760,
    }),
  },
};
