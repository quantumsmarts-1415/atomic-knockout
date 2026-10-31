// Four-move kits from the character design doc.
// Charge = basicCharge (hold normal). Normal = basicDirectional.
// Defense = specialDefense (hold special). Special = specialDirectional.
// Review batch 1 (Lillie, Ben, Bord, Carter, Nitra, Oxana) lives here too.

import { ERIN, LIV, PAULA, RHODA, SANDY, TESS, YARA, YVETTE, ZORA, fxSheetsFor } from './batch3.js';

const K = 'kinetic';
const H = 'heat';
const E = 'electrical';
const C = 'chemical';
const R = 'radiation';

function fx(name) {
  const sheets = fxSheetsFor(name);
  return sheets ? { fxSheets: sheets } : {};
}

function m(name, fields) {
  let shot = fields;
  if (fields.kind === 'projectile' && !fields.shotEnd) {
    const shotEnd = fields.pierce ? 'pierce'
      : fields.stick ? 'stick'
        : (fields.hatch || fields.dropZone) ? 'linger'
          : 'despawn';
    shot = { ...fields, shotEnd };
  }
  return {
    duration: 250,
    cooldown: 380,
    baseKnockback: 180,
    knockbackGrowth: 5.4,
    ...shot,
    name,
  };
}

const melee = (name, fields) => m(name, { rangeW: 72, rangeH: 48, ...fields });

export const MOVESETS = {
  hydra: {
    basicCharge: m('Supernova', {
      kind: 'burst', type: H, damage: 7.9, type2: R, damage2: 4.7,
      // A tap is the small burst. Full charge is 2x the radius, and damage
      // and knockback scale with that same ratio. Self-damage only creeps up.
      // fxScale grows dropped-in art with that radius.
      chargeDamageMult: 2, chargeKnockbackMult: 2, chargeRadiusMult: 2,
      maxChargeMs: 900, radius: 64, baseKnockback: 200, knockbackGrowth: 6,
      // Startup stays 4 frames. Endlag 22 → 11. Cooldown 43 → 22 frames.
      duration: 280, cooldown: 1310, startupF: 4, endlagF: 11, vfx: 'supernova', fxScale: 'radius',
      selfDamage: { type: H, damage: 4, chargeMult: 1.5 }, releaseOnHit: true,
    }),
    basicDirectional: melee('Flame Dash', {
      kind: 'dash', type: K, damage: 3, type2: H, damage2: 3,
      dashSpeed: 720, rangeW: 96, rangeH: 100, baseKnockback: 180,
      // Startup stays 1 frame. Endlag 25 → 12. Cooldown 47 → 23 frames.
      knockbackGrowth: 3.4, duration: 300, cooldown: 1000, string: { hits: 3, gap: 200 }, endlagF: 12, vfx: 'fire',
    }),
    specialDefense: m('Fire Wall', {
      // The wall itself is the lock: 31 → 19 frames. Cooldown 41 → 20 frames.
      kind: 'wall', frontOnly: true, duration: 320, cooldown: 500,
      blocks: [K, H, C], vfx: 'wall', vfxColor: 0xff5a1f,
      wallDamage: 8, wallType: H, wallKnockback: 200, wallKnockbackGrowth: 5,
      wallRangeW: 28, wallRangeH: 110, wallYFrac: 0.7,
    }),
    specialDirectional: m('Hydrogen Bomb', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 10, type2: R, damage2: 6.7,
      explodeOnly: true, explodeRadius: 74, vfx: 'mushroom',
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 700,
      // Startup stays 4 frames. Endlag 21 → 11. Cooldown 59 → 29 frames.
      baseKnockback: 190, knockbackGrowth: 3.6, duration: 260, cooldown: 970, startupF: 4, endlagF: 11,
    }),
  },

  lillie: {
    basicCharge: m('Mega Discharge', {
      kind: 'burst', type: E, damage: 11.7,
      chargeDamageMult: 1.8, chargeRadiusMult: 1.6, maxChargeMs: 700,
      radius: 70, bankCap: 18, baseKnockback: 200, knockbackGrowth: 5.2,
      // Startup 5. Endlag 14. Same-button lock ~41 frames.
      duration: 260, cooldown: 1340, startupF: 5, endlagF: 14,
      vfx: 'spark', fxScale: 'radius',
    }),
    basicDirectional: melee('Spark Jab', {
      type: K, damage: 4, type2: E, damage2: 3,
      combo: { hits: 3, window: 1010, scales: [1, 1.2, 1.55], knockbacks: [40, 55, 230], launch: [0, 0, 1] },
      rangeW: 78, rangeH: 40, baseKnockback: 140, knockbackGrowth: 3.2,
      // Startup 3. Endlag 10. Same-button lock ~17 frames, inside the on-hit window.
      startupF: 3, endlagF: 10, duration: 150, cooldown: 610, vfx: 'spark',
    }),
    specialDefense: m('Absorb', {
      // Reach-forward soak: one hand orb pulls typed shots in and banks them.
      immune: [H, E, C, R], powersCharge: true,
      attractProjectiles: 28,
      duration: 800, cooldown: 500, vfx: 'bubble', vfxColor: 0xf4f7ff,
    }),
    specialDirectional: m('Crimson Tide', {
      kind: 'projectile', shotEnd: 'pierce', type: K, damage: 2.6, type2: C, damage2: 2.6, type3: H, damage3: 3.3,
      roll: true, slam: true, pierce: true, carry: true, multiHit: 2, hitGap: 140,
      baseKnockback: 40, knockbackGrowth: 0.4,
      projectileSpeed: 260, projectileRadius: 22, projectileLife: 1400,
      startupF: 5, endlagF: 14, duration: 260, cooldown: 990, vfx: 'tide',
    }),
  },

  helen: {
    basicCharge: m('Air Wave', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 25.5, vfx: 'gust',
      maxChargeMs: 700,
      baseKnockback: 340, knockbackGrowth: 7,
      projectileSpeed: 360, projectileRadius: 36, projectileLife: 1100,
      duration: 240, cooldown: 1320,
    }),
    basicDirectional: melee('Noble Gust', {
      type: K, damage: 5, baseKnockback: 300, knockbackGrowth: 7.2,
      rangeW: 82, rangeH: 50, vfx: 'gust', duration: 220, cooldown: 500,
    }),
    specialDefense: m('Bubble Shield', {
      kind: 'shield', duration: 1400, cooldown: 760, vfx: 'bubble', vfxColor: 0xbfefff,
    }),
    specialDirectional: m('Balloon Bop', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.9, angleable: true, lift: true, vfx: 'balloon',
      baseKnockback: 280, knockbackGrowth: 6.2,
      projectileSpeed: 240, projectileRadius: 28, projectileLife: 1800,
      duration: 260, cooldown: 980,
    }),
  },

  ben: {
    basicCharge: melee('Emerald Lance', {
      type: K, damage: 9.2, chargeDamageMult: 2.2, chargeKnockbackMult: 1.6,
      chargeRangeMult: 2.4, maxChargeMs: 800, rangeW: 70, rangeH: 28,
      baseKnockback: 200, vfx: 'lance',
      startupF: 6, endlagF: 12, duration: 240, cooldown: 1340,
    }),
    basicDirectional: melee('Precision Strike', {
      type: K, damage: 4, sweetSpot: 5, rangeW: 70, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 3.6,
      startupF: 4, endlagF: 11, duration: 240, cooldown: 500,
    }),
    specialDefense: m('Beryllium Mirror', {
      reflectTypes: [H, E, C, R], reflectPower: 1, counterKnockback: 160,
      duration: 420, cooldown: 500, vfx: 'shield', vfxColor: 0xb7f5cf,
    }),
    specialDirectional: m('Gyro Disc', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 13.7, visualShape: 'disc', vfx: 'spark',
      returns: true, angleable: true, pierce: false,
      projectileSpeed: 460, projectileRadius: 12, projectileLife: 1100,
      baseKnockback: 190, startupF: 4, endlagF: 10, duration: 240, cooldown: 1000,
    }),
  },

  bord: {
    basicCharge: melee('Heavy Ram', {
      kind: 'dash', type: K, damage: 9, chargeDamageMult: 2,
      chargeKnockbackMult: 1.8, chargeDashMult: 1.35, maxChargeMs: 800,
      breaksBlock: 'full', dashSpeed: 560, rangeW: 88, rangeH: 80,
      baseKnockback: 180, knockbackGrowth: 2.4, vfx: 'dash',
      endlagF: 12, cooldown: 1350,
    }),
    basicDirectional: melee('Crystal Smash', {
      type: K, damage: 8, baseKnockback: 160, knockbackGrowth: 3.0, rangeW: 70, vfx: 'strike',
      startupF: 4, endlagF: 12, duration: 240, cooldown: 770,
    }),
    specialDefense: m('Boron Carbide Wall', {
      kind: 'wall', frontOnly: true, blocks: [K, H, R], crackAfterHits: 3,
      duration: 400, cooldown: 500, vfx: 'wall', vfxColor: 0x9ad7ff,
      wallDamage: 6, wallType: K, wallKnockback: 180, wallKnockbackGrowth: 4,
      wallRangeW: 30, wallRangeH: 100, wallYFrac: 0.7,
    }),
    specialDirectional: m('Ground Shatter', {
      kind: 'burst', type: K, damage: 9, radius: 88, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 2.6,
      startupF: 5, endlagF: 14, duration: 300, cooldown: 830,
    }),
  },

  carter: {
    basicCharge: m('Diamond Storm', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 8.8, chargeDamageMult: 2,
      maxChargeMs: 800, visualShape: 'diamond', orbitRelease: true,
      orbitWhileCharging: {
        count: 8, radius: 76, damage: 2, type: K, touch: 22, gap: 300, period: 900, knockback: 36,
      },
      projectileSpeed: 480, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 200, vfx: 'spark',
      startupF: 2, endlagF: 12, duration: 220, cooldown: 1360,
    }),
    basicDirectional: melee('Diamond Cross', {
      type: K, damage: 6, baseKnockback: 200, rangeW: 70, vfx: 'strike',
      startupF: 4, endlagF: 12, duration: 220, cooldown: 660,
    }),
    specialDefense: m('Diamond Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.78,
      duration: 350, cooldown: 500, vfx: 'shield', vfxColor: 0xd6f4ff,
    }),
    specialDirectional: m('Graphene Wave', {
      kind: 'burst', type: E, damage: 17.4, radius: 82, vfx: 'spark',
      baseKnockback: 200, startupF: 4, endlagF: 12, duration: 280, cooldown: 1000,
    }),
  },

  nitra: {
    basicCharge: m('Mini Tornado', {
      kind: 'projectile', shotEnd: 'pierce', type: K, damage: 4, visualShape: 'tornado',
      chargeDamageMult: 1.8, chargeRadiusMult: 1.8, maxChargeMs: 800,
      pierce: true, carry: true, multiHit: 3, hitGap: 180, popKnockback: 280,
      projectileSpeed: 300, projectileRadius: 18, projectileLife: 980,
      baseKnockback: 50, knockbackGrowth: 0.6, vfx: 'ice',
      startupF: 5, endlagF: 14, duration: 260, cooldown: 1160,
    }),
    basicDirectional: melee('Gust', {
      type: K, damage: 8.2, launchMult: 2, rangeW: 96, rangeH: 48,
      baseKnockback: 180, knockbackGrowth: 4.2, vfx: 'gust',
      startupF: 3, endlagF: 12, duration: 200, cooldown: 1000, string: { hits: 3, gap: 260 },
    }),
    specialDefense: m('Nitride Shell', {
      chargeMs: 3000, onReady: { mult: 0.45, ms: 5000 },
      duration: 3100, cooldown: 500, vfx: 'shield', vfxColor: 0xd7ecff,
    }),
    specialDirectional: m('Cryo Splash', {
      kind: 'burst', type: H, damage: 13.7, radius: 78, offsetX: 70,
      onHit: { freeze: 3000 }, stunChance: 0.5, vfx: 'cryo',
      baseKnockback: 90, knockbackGrowth: 1.2,
      startupF: 5, endlagF: 14, duration: 260, cooldown: 850,
    }),
  },

  oxana: {
    basicCharge: m('Bellows Breath', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 15.2, gas: true, flareHeat: 9, visualShape: 'breath',
      chargeDamageMult: 1.6, maxChargeMs: 700, vfx: 'gust',
      baseKnockback: 260, knockbackGrowth: 6,
      projectileSpeed: 380, projectileRadius: 32, projectileLife: 1100,
      startupF: 4, endlagF: 12, duration: 240, cooldown: 1280,
    }),
    basicDirectional: melee('Vortex Kick', {
      type: K, damage: 8, rangeW: 88, vfx: 'spin',
      baseKnockback: 170, startupF: 4, endlagF: 12, duration: 230, cooldown: 1000, string: { hits: 3, gap: 260 },
    }),
    specialDefense: m('Ozone Layer', {
      blocks: [R], hold: false, lingerImmune: { types: [R], ms: 15000 },
      duration: 360, cooldown: 500, vfx: 'shield', vfxColor: 0x8eb6ff,
    }),
    specialDirectional: m('Oxidation Burst', {
      kind: 'burst', type: H, damage: 9, type2: C, damage2: 8,
      radius: 108, vfx: 'acid',
      baseKnockback: 190, startupF: 5, endlagF: 12, duration: 280, cooldown: 980,
    }),
  },

  flora: {
    basicCharge: m('Pale Yellow Jet', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 10.5, type2: H, damage2: 4.5,
      chemDealtMult: 1.15, chargeDamageMult: 1.7, maxChargeMs: 800,
      vfx: 'acid', vfxColor: 0xe6f27a,
      projectileSpeed: 520, projectileRadius: 14, projectileLife: 560,
      baseKnockback: 180, duration: 240, cooldown: 1320,
    }),
    basicDirectional: melee('Etching Jab', {
      type: C, damage: 5, onHit: { corrode: { mult: 0.7, ms: 2000 } },
      vfx: 'acid', duration: 190, cooldown: 1000, string: { hits: 3, gap: 270 },
    }),
    specialDefense: m('Teflon Coat', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4, debuffImmune: true,
      duration: 800, cooldown: 740, vfx: 'shield', vfxColor: 0xe8ffe8,
    }),
    specialDirectional: m('Radical Cascade', {
      kind: 'burst', type: C, damage: 7.7, radius: 72, vfx: 'acid',
      chain: { count: 2, scale: 0.62, delay: 180 },
      baseKnockback: 160, duration: 280, cooldown: 990,
    }),
  },

  neo: {
    basicCharge: m('High-Voltage Tube', {
      kind: 'beam', type: E, damage: 14.5, chargeDamageMult: 1.8,
      chargeLengthMult: 2.5, maxChargeMs: 850, beamLen: 150, beamThick: 22,
      tubeCharge: true, vfx: 'laser', vfxColor: 0xff5a2a, baseKnockback: 170,
      // Startup 4. Endlag 12. Same-button lock ~36 frames (was ~55).
      startupF: 4, endlagF: 12, duration: 240, cooldown: 1340,
    }),
    basicDirectional: melee('Staff Crack', {
      type: K, damage: 5, type2: E, damage2: 4, vfx: 'staff', vfxColor: 0xff5a2a,
      rangeW: 94, baseKnockback: 180,
      // Startup 3. Endlag 10. Same-button lock ~22 frames (was ~33).
      startupF: 3, endlagF: 10, duration: 200, cooldown: 1000, string: { hits: 3, gap: 250 },
    }),
    specialDefense: m('No Vacancy', {
      blocks: [K, H, E, C, R], frontOnly: true, backOpen: true,
      openAfter: true, vulnerableMs: 560, vacancySign: true, vacancyAt: 540,
      duration: 900, cooldown: 500, vfx: 'sign', vfxColor: 0xff5a2a,
    }),
    specialDirectional: m('Neon Flash', {
      kind: 'burst', type: E, damage: 16.7, radius: 102, vfx: 'flash', vfxColor: 0xff5a2a,
      onHit: { dazzle: 800 }, baseKnockback: 170,
      // Startup 5. Endlag 12. Same-button lock ~39 frames (was ~65).
      startupF: 5, endlagF: 12, duration: 250, cooldown: 970,
    }),
  },

  natalie: {
    basicCharge: m('Lake Drop', {
      kind: 'burst', type: K, damage: 6, type2: H, damage2: 5,
      chargeDamageMult: 2.3, chargeKnockbackMult: 2, chargeRadiusMult: 1.8,
      maxChargeMs: 1000, detonateAtFull: true, includeSelf: true,
      radius: 60, vfx: 'supernova', vfxColor: 0xffc14a,
      baseKnockback: 280, knockbackGrowth: 6.5, duration: 280, cooldown: 1330,
    }),
    basicDirectional: melee('Flame Fist', {
      type: K, damage: 4.6, type2: H, damage2: 4.6, vfx: 'fire', vfxColor: 0xffc14a,
      baseKnockback: 185, knockbackGrowth: 4.7,
      duration: 240, cooldown: 670,
    }),
    specialDefense: m('Oil Bath', {
      blocks: [C, H],
      buff: { slippery: 1.4, ms: 2200 },
      duration: 800, cooldown: 740, vfx: 'shield', vfxColor: 0xf2e2a8,
    }),
    specialDirectional: m('Brine Burst', {
      kind: 'burst', type: H, damage: 8, type2: K, damage2: 6,
      radius: 88, baseKnockback: 280, knockbackGrowth: 7.2,
      vfx: 'fire', vfxColor: 0xffc14a, duration: 280, cooldown: 870,
    }),
  },

  maggie: {
    basicCharge: m('Unquenchable', {
      kind: 'buff', maxChargeMs: 560,
      vfx: 'magnesium', vfxColor: 0xfff6e8,
      // Startup 3. Endlag 8. Same-button lock ~24 frames (was ~83).
      startupF: 3, endlagF: 8, duration: 220, cooldown: 500,
      buff: {
        ms: 7000, heatOnHit: 3, hits: 0, unquenchable: true,
        selfDot: { dps: 1, every: 1000, type: H },
      },
    }),
    basicDirectional: melee('Flare Jab', {
      type: K, damage: 4.5, type2: H, damage2: 4.5, vfx: 'flare', vfxColor: 0xfff6e8,
      // Startup 3. Endlag 8. Same-button lock ~23 frames (was ~46).
      startupF: 3, endlagF: 8, duration: 180, cooldown: 680,
    }),
    specialDefense: m('Ribbon Guard', {
      blocks: [C, K], igniteOn: H,
      // Guard stays long enough to catch a hit. Cooldown 41 → 17 frames.
      duration: 700, cooldown: 500, vfx: 'ribbon', vfxColor: 0xe7edf4,
    }),
    specialDirectional: m('Blinding Flare', {
      kind: 'burst', type: H, damage: 13.4, radius: 86, vfx: 'whiteout', vfxColor: 0xfff6e8,
      onHit: { dazzle: { ms: 2000, color: 0xf7fbff } }, baseKnockback: 124,
      // Startup 5. Endlag 12. Same-button lock ~39 frames (was ~78).
      startupF: 5, endlagF: 12, duration: 240, cooldown: 840,
    }),
  },

  allen: {
    basicCharge: m('Thermite Burn', {
      kind: 'beam', type: H, damage: 14.3, chargeDamageMult: 1.8, chargeLengthMult: 1.8,
      maxChargeMs: 560, beamLen: 130, beamThick: 26,
      onHit: { burn: { dps: 3, every: 1000, ms: 3500 } },
      vfx: 'thermite', vfxColor: 0xff6a1a, baseKnockback: 160,
      // Startup 4. Endlag 10. Same-button lock ~38 frames (was ~60).
      startupF: 4, endlagF: 10, duration: 220, cooldown: 1330,
    }),
    basicDirectional: melee('Power-Line Whips', {
      type: E, damage: 3.8, type2: K, damage2: 3.8, pull: 210, rangeW: 96, vfx: 'whip', vfxColor: 0xd6e8ff,
      baseKnockback: 150,
      // Startup 3. Endlag 8. Same-button lock ~23 frames (was ~37).
      startupF: 3, endlagF: 8, duration: 180, cooldown: 680,
    }),
    specialDefense: m('Oxide Skin', {
      kind: 'oxide', regrow: 'press',
      // The skin stays while held. After it breaks or he lets go, the next
      // defense press grows a new one. Cooldown is that gap, not a regrow timer.
      duration: 800, cooldown: 500, vfx: 'shield', vfxColor: 0xd8dde6,
    }),
    specialDirectional: m('Turbine Vortex', {
      kind: 'burst', type: K, damage: 15.3, radius: 100, pull: 320, vfx: 'vortex', vfxColor: 0xd5dde6,
      baseKnockback: 80,
      // Startup 4. Endlag 10. Same-button lock ~40 frames (was ~70).
      startupF: 4, endlagF: 10, duration: 240, cooldown: 1000,
    }),
  },

  silas: {
    basicCharge: m('Overclock', {
      kind: 'buff', maxChargeMs: 560,
      overclock: { speed: 1.4, attack: 1.4, ms: 2800, selfHeat: 7 },
      vfx: 'overclock', vfxColor: 0x4ad6ff,
      // Startup 3. Endlag 8. Same-button lock ~41 frames (was ~86).
      startupF: 3, endlagF: 8, duration: 200, cooldown: 500,
    }),
    basicDirectional: melee('Crystal Blade', {
      type: K, damage: 7.2, rangeW: 74,
      shatter: { type: K, damage: 2.24 },
      vfx: 'crystal', vfxColor: 0xd6f6ff,
      // Startup 3. Endlag 8. Same-button lock ~24 frames (was ~47).
      startupF: 3, endlagF: 8, duration: 180, cooldown: 680,
    }),
    specialDefense: m('Silica Pane', {
      blocks: [H, C],
      // Kinetic under 8 passes. A stronger kinetic hit breaks the glass.
      retort: {
        when: K, minDamage: 8, shatter: true,
        type: K, damage: 17.6, knockback: 224,
        selfDamage: 7.84, selfKnockback: 120,
      },
      // The pane stays long enough to catch a hit. Cooldown 46 → 17 frames.
      duration: 700, cooldown: 1000, vfx: 'pane', vfxColor: 0xd6f6ff,
    }),
    specialDirectional: m('Binary Surge', {
      kind: 'burst', type: E, damage: 17.6, radius: 80,
      missRetry: true, retryMs: 120, vfx: 'binary', vfxColor: 0x6ecbff,
      baseKnockback: 190.4,
      // Startup 4. Endlag 10. Same-button lock ~34 frames (was ~61).
      startupF: 4, endlagF: 10, duration: 200, cooldown: 1000,
    }),
  },

  phillip: {
    basicCharge: m('Phosphor Flare', {
      // The flare goes up. The shower is the hit: heat and chemical.
      // Charge widens the fan. It does not add damage.
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 3.4, type2: C, damage2: 2.6,
      rain: 5, rainSpread: 150, chargeSpreadMult: 2.4, rainDelay: 180,
      maxChargeMs: 700, visualShape: 'ember', vfx: 'phosphor', vfxColor: 0xe8ffc0,
      projectileSpeed: 80, projectileRadius: 12, projectileLife: 650,
      baseKnockback: 48, knockbackGrowth: 0.8,
      // Startup 4. Endlag 8. Same-button lock ~27 frames (was ~55).
      startupF: 4, endlagF: 8, duration: 240, cooldown: 1120,
    }),
    basicDirectional: m('Tracers', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 1.7, type2: K, damage2: 1.7,
      salvo: 5, salvoGap: 70, trailMs: 500, visualShape: 'tracer',
      vfx: 'tracer', vfxColor: 0xfff2c0,
      projectileSpeed: 980, projectileRadius: 6, projectileLife: 380,
      baseKnockback: 24, knockbackGrowth: 0.4,
      // The volley is the move. Cooldown 34 → 5 frames.
      // Same-button lock ~29 frames (was ~49).
      startupF: 2, endlagF: 8, duration: 400, cooldown: 760,
    }),
    specialDefense: m('Red Phosphorus Form', {
      blocks: [H, C], stripBlocked: true, rooted: true,
      // The coat stays while held. Cooldown 42 → 17 frames.
      duration: 720, cooldown: 500, vfx: 'shield', vfxColor: 0x7a2e2e,
    }),
    specialDirectional: m('Spontaneous Ignition', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.9, lob: { vy: 0, g: 600 },
      visualShape: 'wp', vfx: 'wp', vfxColor: 0xfff6e8,
      projectileSpeed: 520, projectileRadius: 14, projectileLife: 900,
      onHit: { burn: { dps: 1, every: 1000, untilKo: true } },
      baseKnockback: 160, knockbackGrowth: 2.6,
      // Startup 4. Endlag 10. Same-button lock ~33 frames (was ~69).
      startupF: 4, endlagF: 10, duration: 220, cooldown: 980,
    }),
  },

  sully: {
    basicCharge: m('Black Powder', {
      kind: 'burst', type: H, damage: 7.1, type2: K, damage2: 5.6,
      chargeDamageMult: 2, chargeRadiusMult: 1.6, maxChargeMs: 800,
      radius: 54, offsetX: 50, vfx: 'supernova', vfxColor: 0xffb020,
      baseKnockback: 230, duration: 260, cooldown: 1360,
    }),
    basicDirectional: melee('Brimstone Slam', {
      type: K, damage: 5.2, type2: H, damage2: 3.7, slam: true, vfx: 'fire', vfxColor: 0x6ecbff,
      baseKnockback: 210, duration: 240, cooldown: 680,
    }),
    specialDefense: m('Vulcanized Rubber', {
      blockCharges: { chemical: 3, kinetic: 2, heat: 1 },
      reflectProjectiles: true,
      duration: 700, cooldown: 720, vfx: 'shield', vfxColor: 0x3a322c,
    }),
    specialDirectional: m('Volcanic Eruption', {
      kind: 'burst', type: H, damage: 9, type2: C, damage2: 7, gas: true,
      radius: 96, vfx: 'cloud', vfxColor: 0xffb020,
      baseKnockback: 200, duration: 320, cooldown: 940,
    }),
  },

  chloe: {
    basicCharge: m('Bleach Out', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 14.6, gas: true, stripBuffs: true,
      chargeDamageMult: 1.7, maxChargeMs: 750, vfx: 'acid', vfxColor: 0xe6f27a,
      projectileSpeed: 480, projectileRadius: 16, projectileLife: 600,
      baseKnockback: 150, duration: 240, cooldown: 1290,
    }),
    basicDirectional: melee('Toxic Jab', {
      type: C, damage: 6, gas: true, vfx: 'cloud', vfxColor: 0xd4e857,
      baseKnockback: 140, knockbackGrowth: 2.8,
      duration: 240, cooldown: 1000, string: { hits: 2, gap: 280 },
    }),
    specialDefense: m('Salt Bond', {
      kind: 'counter', counterDamage: 0, counterType: C, counterKnockback: 0, counterKnockbackGrowth: 0,
      counterRootMs: 520, rootBonusVs: 'alkali',
      counterCoat: 'Salt Crust', counterCoatMs: 520,
      duration: 520, cooldown: 780, vfx: 'shield', vfxColor: 0xf4f4f4,
    }),
    specialDirectional: m('Gas Cloud', {
      kind: 'zone', type: C, damage: 15.9, gas: true, vfx: 'cloud', vfxColor: 0xd4e857,
      zone: { type: C, damage: 2.2, gas: true, ms: 2000, radius: 64, tick: 400, low: true, knockback: 0, growth: 0, color: 0xd4e857 },
      baseKnockback: 0, knockbackGrowth: 0, duration: 260, cooldown: 940,
    }),
  },

  aaron: {
    basicCharge: m('Lazy Haymaker', {
      kind: 'buff', maxChargeMs: 1100, chargeHeal: 12,
      buff: { ms: 10000, attackPower: 1.45, scaleWithCharge: true },
      vfx: 'spark', vfxColor: 0xc9b6ff,
      duration: 280, cooldown: 520,
    }),
    basicDirectional: melee('Inert Guard Strike', {
      type: K, damage: 8.8, guardStrike: 0.5, vfx: 'strike',
      duration: 240, cooldown: 1000, string: { hits: 3, gap: 270 },
    }),
    specialDefense: m('Shield Gas', {
      blocks: [H, E], duration: 800, cooldown: 700, vfx: 'shield', vfxColor: 0xc9b6ff,
    }),
    specialDirectional: m('Noble Discharge', {
      kind: 'burst', type: E, damage: 13.2, radius: 88, vfx: 'spark', vfxColor: 0xc9b6ff,
      baseKnockback: 205.2, duration: 280, cooldown: 830,
    }),
  },

  kyle: {
    basicCharge: m('Action Potential', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 19.1, slam: true, fizzleBelow: 1, roll: true,
      maxChargeMs: 1500, onHit: { stun: 450 }, stunChance: 0.5, vfx: 'spark', vfxColor: 0xd2b6ff,
      projectileSpeed: 620, projectileRadius: 36, projectileLife: 480,
      baseKnockback: 120, duration: 200, cooldown: 1260,
    }),
    basicDirectional: melee('Static Cross', {
      type: K, damage: 5.4, type2: E, damage2: 3.4, vfx: 'spark',
      baseKnockback: 160, knockbackGrowth: 3.2,
      duration: 200, cooldown: 690,
    }),
    specialDefense: m('Ion Channel', {
      kind: 'counter', counterOnTypes: [E, K], counterDamage: 17.3, counterType: E,
      counterKnockback: 170, duration: 520, cooldown: 990, vfx: 'spark',
    }),
    // Nerve Shock: a wide action-potential wave thrown from both hands at the
    // arms-spread frame. Fast and short so it reads as a shock, not a bullet.
    specialDirectional: m('Nerve Shock', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 11, vfx: 'spark', vfxColor: 0xb9a0ff,
      projectileSpeed: 760, projectileRadius: 34, projectileLife: 300, onHit: { stun: 500 },
      baseKnockback: 150, knockbackGrowth: 2.4, duration: 260, cooldown: 850,
    }),
  },

  cal: {
    basicCharge: m('Calcify', {
      kind: 'buff', duration: 260, cooldown: 1100, maxChargeMs: 700, vfx: 'shield',
      buff: { ms: 4000, kineticTaken: 0.62, scaleWithCharge: true, coat: 'Calcify', bonus: { type: K, damage: 6, hits: 1, name: 'Calcify' } },
    }),
    basicDirectional: melee('Bone Crush', {
      type: K, damage: 10, slam: true, bonusVsBlock: 0.5, baseKnockback: 220,
      vfx: 'strike', duration: 250, cooldown: 740,
    }),
    specialDefense: m('Quick-Set Cement', {
      kind: 'wall', frontOnly: true, blocks: [K, H], wallRootMs: 420, wallLingerMs: 7000,
      duration: 900, cooldown: 860, vfx: 'cement', vfxColor: 0xd9d3c7,
      wallDamage: 4, wallType: K, wallKnockback: 80, wallKnockbackGrowth: 2,
      wallRangeW: 34, wallRangeH: 96, wallYFrac: 0.65,
    }),
    specialDirectional: m('Slime Splash', {
      kind: 'burst', type: H, damage: 7, type2: C, damage2: 6,
      radius: 84, vfx: 'acid', vfxColor: 0xffb020,
      baseKnockback: 170, duration: 280, cooldown: 820,
    }),
  },

  scarlett: {
    basicCharge: melee('Afterburner', {
      kind: 'dash', type: K, damage: 8.4, type2: H, damage2: 5.6,
      chargeDamageMult: 1.9, chargeDashMult: 1.5, maxChargeMs: 700,
      dashSpeed: 640, rangeW: 100, rangeH: 70, vfx: 'fire',
      baseKnockback: 220, duration: 280, cooldown: 1360,
    }),
    basicDirectional: melee('Wing Slash', {
      type: K, damage: 7, rangeW: 100, rangeH: 72, vfx: 'strike',
      duration: 230, cooldown: 580,
    }),
    specialDefense: m('Folded Wings', {
      blocks: [K], reflectProjectiles: 'perfect', perfectMs: 200,
      duration: 600, cooldown: 700, vfx: 'shield',
    }),
    specialDirectional: m('Micro Rocket', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 17.2, homing: 1.2, vfx: 'dash',
      projectileSpeed: 760, projectileRadius: 8, projectileLife: 700,
      baseKnockback: 200, knockbackGrowth: 4, duration: 220, cooldown: 990,
    }),
  },

  titan: {
    basicCharge: melee('Titanium Ram', {
      kind: 'dash', type: K, damage: 8, type2: H, damage2: 2,
      chargeDamageMult: 2, chargeDashMult: 1.35, maxChargeMs: 750,
      dashSpeed: 580, rangeW: 96, rangeH: 80, vfx: 'spark',
      baseKnockback: 230, duration: 240, cooldown: 1290,
    }),
    basicDirectional: melee('Lance Jab', {
      type: K, damage: 8, rangeW: 84, rangeH: 36, vfx: 'strike',
      baseKnockback: 170, knockbackGrowth: 3.8, duration: 200, cooldown: 720,
    }),
    specialDefense: m('Aerospace Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.62, blocks: [C], noKnockback: true,
      // Brushed titanium wash (about 170, 185, 205). No bubble, so the face stays open.
      chalkTint: 0xaab9cd,
      duration: 4000, cooldown: 700, vfx: 'pane',
    }),
    specialDirectional: m('Aero Lance', {
      kind: 'projectile', shotEnd: 'pierce', type: K, damage: 13.3, pierce: true, angleable: true, visualShape: 'spearhead', vfx: 'strike',
      projectileSpeed: 480, projectileRadius: 10, projectileLife: 700,
      baseKnockback: 220, duration: 220, cooldown: 990,
    }),
  },

  van: {
    basicCharge: m('Redox Flow', {
      kind: 'buff', redox: true, duration: 220, cooldown: 500, maxChargeMs: 800,
      vfx: 'spark', vfxColor: 0x8af5c9,
    }),
    basicDirectional: melee('Alloy Fist', {
      type: K, damage: 7, breaksBlock: 'weak', vfx: 'strike',
      baseKnockback: 200, duration: 270, cooldown: 680,
    }),
    specialDefense: m('Four-State Guard', {
      cycle: [E, C, H, K], cycleMs: 360,
      duration: 1200, cooldown: 700, vfx: 'spark',
    }),
    specialDirectional: m('Prism Surge', {
      kind: 'burst', type: E, damage: 15.2, radius: 82, vfx: 'spark', vfxColor: 0x8af5c9,
      baseKnockback: 180, duration: 260, cooldown: 1010,
    }),
  },

  chroma: {
    basicCharge: m('Ruby Laser', {
      kind: 'beam', type: H, damage: 27.5, chargeLengthMult: 2.6,
      maxChargeMs: 900, beamLen: 160, beamThick: 16, vfx: 'laser', vfxColor: 0xff2a3a,
      baseKnockback: 150, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Chrome Edge', {
      type: K, damage: 8, rangeW: 74, vfx: 'strike', vfxColor: 0xe8eef2,
      baseKnockback: 190, duration: 280, cooldown: 760,
    }),
    specialDefense: m('Mirror Chrome', {
      reflectProjectiles: true, reduceTypes: { heat: 0.5, chemical: 0.5 },
      duration: 700, cooldown: 720, vfx: 'shield', vfxColor: 0xe8eef2,
    }),
    specialDirectional: m('Prismatic Shatter', {
      kind: 'burst', type: K, damage: 10, radius: 80, vfx: 'spark', vfxColor: 0xff2a3a,
      baseKnockback: 210, duration: 280, cooldown: 870,
    }),
  },

  // --- pilot roster (Ta, W, Re, Os, Pt). Numbers are the balance pass. ---
  // Knockback growth is set below the kit default (5.4) on the pokes that were
  // launching gases off Elemental Isle while those gases were ahead on percent.
  tara: {
    basicCharge: m('Capacitor Dump', {
      kind: 'beam', type: E, damage: 13.1, chargeDamageMult: 1.75, chargeLengthMult: 2.15,
      maxChargeMs: 760, beamLen: 148, beamThick: 24, beamArtPx: 640, vfx: 'laser', vfxColor: 0x7ec8ff,
      baseKnockback: 140, knockbackGrowth: 3.0, duration: 200, cooldown: 1410,
    }),
    basicDirectional: melee('Bone Plate Bash', {
      type: K, damage: 6, onHit: { heal: 2 }, hitRadius: 36,
      rangeW: 84, rangeH: 48, vfx: 'strike', vfxColor: 0xb7c4d4,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 240, cooldown: 620,
    }),
    specialDefense: m('Tantalus Guard', {
      immune: [C], blocks: [C], fizzChem: true,
      duration: 820, cooldown: 760, vfx: 'shield', vfxColor: 0xb7f27a,
    }),
    specialDirectional: m('Implant Pin', {
      kind: 'projectile', shotEnd: 'stick', type: K, damage: 13, stick: true, pinFoot: true, vfx: 'strike',
      onHit: { root: 3000, pinFoot: true }, noKnockback: true,
      projectileSpeed: 500, projectileRadius: 7, projectileLife: 520, stickMs: 3000,
      baseKnockback: 0, knockbackGrowth: 0, duration: 220, cooldown: 990,
    }),
  },

  wolf: {
    basicCharge: m('White-Hot Filament', {
      kind: 'burst', type: H, damage: 14.7, chargeDamageMult: 1.9, chargeRadiusMult: 1.85,
      maxChargeMs: 3400, radius: 56, vfx: 'fire', vfxColor: 0xfff1c2,
      baseKnockback: 160, duration: 280, cooldown: 1420,
    }),
    basicDirectional: melee('Carbide Drill', {
      type: K, damage: 1.5, multiHit: 5, hitRadius: 96,
      rangeW: 96, rangeH: 48, startupF: 4, activeF: 28,
      vfx: 'strike', vfxColor: 0xffe2a8,
      baseKnockback: 170, knockbackGrowth: 3.8,
      duration: 600, cooldown: 720,
    }),
    specialDefense: m('Unmeltable', {
      immune: [H], blocks: [H], kind: 'block', onlyReduce: [K], blockReduction: 0.22,
      duration: 780, cooldown: 760, vfx: 'shield', vfxColor: 0xffe2a8,
    }),
    specialDirectional: m('Armor Piercer', {
      kind: 'projectile', shotEnd: 'pierce', type: K, damage: 12.9, breaksBlock: true, pierce: true, vfx: 'strike',
      projectileSpeed: 580, projectileRadius: 7, projectileLife: 460,
      baseKnockback: 190, duration: 220, cooldown: 1010,
    }),
  },

  rex: {
    basicCharge: m('High Octane', {
      kind: 'buff', duration: 200, cooldown: 1200, maxChargeMs: 700, vfx: 'fire', vfxColor: 0xff9a2a,
      radius: 96, chargeRadiusMult: 1.25,
      selfDamage: { type: H, damage: 3, noFlinch: true },
      blast: { type: H, damage: 11, chargeDamageMult: 1.55, knockback: 180, growth: 2.6 },
      buff: { ms: 2200, speed: 1.18, heated: true, armDash: { heat: 5, dashSpeed: 520 } },
    }),
    basicDirectional: melee("King's Edge", {
      type: K, damage: 8, bonusWhileDps: 3, rangeW: 76, vfx: 'strike',
      baseKnockback: 150, knockbackGrowth: 2.8, duration: 250, cooldown: 730,
    }),
    specialDefense: m('Creep Resistance', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.32, noKnockback: true, noPush: true,
      debuffImmune: true, grabImmune: true,
      duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xd9dde6,
    }),
    specialDirectional: melee('Thermocouple Lash', {
      type: E, damage: 15.7, rangeW: 112, rangeH: 30, hitRadius: 22, vfx: 'spark', vfxColor: 0xffb45a,
      vsHot: { type: H, damage: 11 },
      baseKnockback: 140, knockbackGrowth: 2.2, duration: 240, cooldown: 1040,
    }),
  },

  oz: {
    basicCharge: m('Densest Slam', {
      kind: 'burst', type: K, damage: 11.6, chargeDamageMult: 1.75, chargeRadiusMult: 2.15,
      maxChargeMs: 900, radius: 54, groundImpact: true, vfx: 'strike',
      baseKnockback: 190, knockbackGrowth: 3.2, duration: 300, cooldown: 1390,
    }),
    basicDirectional: melee('Nib Stab', {
      type: K, damage: 7, sweetSpot: 2, rangeW: 46, rangeH: 28, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 2, duration: 200, cooldown: 680,
    }),
    specialDefense: m('Immovable Object', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.55, noKnockback: true, rooted: true,
      recoil: { type: K, damage: 18.1, knockback: 120 },
      duration: 780, cooldown: 1020, vfx: 'shield', vfxColor: 0x9aa4b8,
    }),
    specialDirectional: m('Tetroxide Puff', {
      kind: 'burst', type: C, damage: 17.5, radius: 68, offsetX: 78, vfx: 'cloud', vfxColor: 0xc6f07a,
      zone: { type: C, damage: 1.8, ms: 1800, radius: 60, tick: 420, color: 0xc6f07a, sheet: true },
      baseKnockback: 110, knockbackGrowth: 2.4, duration: 280, cooldown: 1000,
    }),
  },

  pit: {
    basicCharge: m('Catalyst Ignition', {
      kind: 'burst', type: H, damage: 18, chargeDamageMult: 1.55, chargeRadiusMult: 1.45,
      maxChargeMs: 800, radius: 88, igniteGases: true, gasCloud: 6,
      vfx: 'fire', vfxColor: 0xfff6d0, baseKnockback: 150, duration: 260, cooldown: 1420,
    }),
    basicDirectional: melee('Record Scratch', {
      type: K, damage: 6, rangeW: 78, angleDeg: 15, onHit: { interrupt: 220 }, vfx: 'strike',
      baseKnockback: 110, knockbackGrowth: 2, duration: 210, cooldown: 580,
    }),
    specialDefense: m('Cisplatin Clamp', {
      kind: 'counter', counterDamage: 18.1, counterType: C, rootMs: 700,
      counterKnockback: 0, counterKnockbackGrowth: 0, counterCoat: 'Cisplatin Clamp',
      duration: 560, cooldown: 1020, vfx: 'shield', vfxColor: 0xe7eef2,
    }),
    specialDirectional: m('Flame Test', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 9.3, type2: C, damage2: 9.3, enScale: true, flameTint: true,
      vfx: 'fire',
      projectileSpeed: 460, projectileRadius: 12, projectileLife: 680,
      baseKnockback: 150, duration: 230, cooldown: 1040,
    }),
  },

  // --- wave 2. Numbers are the balance pass. Knockback growth stays under
  // the 5.4 default so a heavy metal does not launch the light gases. ---
  caesar: {
    basicCharge: m('Defining Second', {
      kind: 'burst', type: K, damage: 0, radius: 72, chargeRadiusMult: 1.45,
      maxChargeMs: 1000,
      onHit: { freeze: 1000, coat: 'Defining Second', coatMs: 1000 }, stunChance: 1,
      chargeControlMult: 3,
      baseKnockback: 0, knockbackGrowth: 0, duration: 220, cooldown: 1180, vfx: 'spark',
    }),
    basicDirectional: melee('Rubicon Dash', {
      kind: 'dash', type: K, damage: 5.4, type2: H, damage2: 3.6, hyperArmor: true,
      dashSpeed: 310, rangeW: 96, rangeH: 74, vfx: 'fire',
      baseKnockback: 180, knockbackGrowth: 3.2, duration: 480, cooldown: 660,
    }),
    specialDefense: m('Electron Tribute', {
      kind: 'block', onlyReduce: [C, E], blockReduction: 0.5,
      recoil: { type: C, damage: 17.5, knockback: 70 },
      duration: 720, cooldown: 1000, vfx: 'shield', vfxColor: 0xf2d36b,
    }),
    specialDirectional: m('Fallout Coin', {
      kind: 'projectile', shotEnd: 'linger', type: R, damage: 17.5, vfx: 'spark', vfxColor: 0xc6f07a,
      dropZone: {
        type: R, damage: 1, ms: 10000, radius: 50, tick: 800, feet: true, sheet: true,
        knockback: 16, growth: 0.2, color: 0xc6f07a,
      },
      projectileSpeed: 360, projectileRadius: 8, projectileLife: 680,
      baseKnockback: 40, knockbackGrowth: 0.5, duration: 220, cooldown: 1000,
    }),
  },

  barry: {
    basicCharge: m('Heavyweight Drop', {
      kind: 'dive', type: K, damage: 15.2, chargeDamageMult: 1.65, chargeRadiusMult: 1.45,
      maxChargeMs: 900, radius: 54, slamAtFeet: true, diveVY: 520, dashSpeed: 200,
      onHit: { interrupt: 220 }, vfx: 'strike',
      baseKnockback: 140, knockbackGrowth: 3.2, duration: 780, cooldown: 1370,
    }),
    basicDirectional: melee('Mud Weight', {
      type: K, damage: 8.9, onHit: { slow: 800 }, rangeW: 74, vfx: 'strike',
      baseKnockback: 160, knockbackGrowth: 3.4, duration: 240, cooldown: 680,
    }),
    specialDefense: m('Barium Meal', {
      immune: [R], weightMult: 1.45, chalkTint: 0xe2e4d6,
      duration: 800, cooldown: 900, vfx: 'shield', vfxColor: 0xd8d2c4,
    }),
    specialDirectional: m('Poison Pellet', {
      kind: 'projectile', shotEnd: 'linger', type: C, damage: 17.7, floor: true, floorLift: 0.22, vfx: 'cloud',
      dropZone: { type: C, damage: 1.0, ms: 1400, radius: 42, tick: 420, feet: true, knockback: 12, growth: 0.2, color: 0x8fbf4a },
      projectileSpeed: 280, projectileRadius: 10, projectileLife: 900,
      baseKnockback: 50, knockbackGrowth: 0.7, duration: 220, cooldown: 1010,
    }),
  },

  ray: {
    basicCharge: m('Radium Tonic', {
      kind: 'buff', maxChargeMs: 3000, duration: 200, cooldown: 1200, vfx: 'spark', vfxColor: 0xd6ff8a,
      tonic: { every: 1000, power: 0.16, cost: 1.1, linger: 2200 },
    }),
    basicDirectional: melee('Alpha Uppercut', {
      type: K, damage: 5.6, type2: R, damage2: 4.6, lift: true, rangeW: 50, rangeH: 64, vfx: 'spark',
      baseKnockback: 110, knockbackGrowth: 1.8, duration: 240, cooldown: 710,
    }),
    specialDefense: m('Decay Halo', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4,
      recoil: { type: R, damage: 17.8, knockback: 80 },
      duration: 720, cooldown: 1010, vfx: 'shield', vfxColor: 0xd6ff8a,
    }),
    specialDirectional: m('Luminous Splash', {
      kind: 'projectile', shotEnd: 'linger', type: R, damage: 17.8, angleable: true, vfx: 'spark', vfxColor: 0xe8ffb0,
      dropZone: {
        name: 'Luminous Splash', type: R, damage: 1.1, ms: 1600, radius: 44, tick: 400,
        knockback: 0, growth: 0, color: 0xe8ffb0, feet: true, statusCling: 'Luminous Splash',
      },
      projectileSpeed: 400, projectileRadius: 10, projectileLife: 600,
      baseKnockback: 50, knockbackGrowth: 0.8, duration: 220, cooldown: 1010,
    }),
  },

  collin: {
    basicCharge: m('Gamma Knife', {
      kind: 'beam', type: R, damage: 16.7, chargeDamageMult: 1.65, chargeLengthMult: 2.1,
      maxChargeMs: 900, beamLen: 146, beamThick: 16, vfx: 'laser', vfxColor: 0xb7ff6a,
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Kobold Strike', {
      kind: 'dash', type: K, damage: 7, dashSpeed: 460,
      rangeW: 80, rangeH: 40, vfx: 'dash',
      baseKnockback: 240, knockbackGrowth: 4.2, duration: 260, cooldown: 650,
    }),
    specialDefense: m('Superalloy Shell', {
      immune: [H], kind: 'block', onlyReduce: [K], blockReduction: 0.35,
      duration: 15000, cooldown: 880, vfx: 'shield', vfxColor: 0x3e4c5c,
    }),
    specialDirectional: m('Blue Glaze', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 17.3, onHit: { slow: 1000, coat: 'Blue Glaze', coatMs: 1600 }, vfx: 'fire', vfxColor: 0x3a6adf,
      projectileSpeed: 440, projectileRadius: 10, projectileLife: 540,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 220, cooldown: 990,
    }),
  },

  cooper: {
    basicCharge: m('Tesla Coil', {
      kind: 'burst', type: E, damage: 11, chargeDamageMult: 1.8, chargeRadiusMult: 1.45,
      maxChargeMs: 800, radius: 78, vfx: 'spark', vfxColor: 0x7ec8ff,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 260, cooldown: 1400,
    }),
    basicDirectional: melee('Live Wire', {
      type: K, damage: 4.8, type2: E, damage2: 2.9, pull: 200, rangeW: 116, rangeH: 28, vfx: 'spark',
      baseKnockback: 124.8, knockbackGrowth: 2.88, duration: 220, cooldown: 680,
    }),
    specialDefense: m('Grounding Rod', {
      immune: [E],
      zone: { type: E, damage: 1.06, ms: 780, radius: 48, tick: 360, knockback: 19.2, growth: 0.19, color: 0x7ec8ff },
      duration: 780, cooldown: 900, vfx: 'shield', vfxColor: 0xc47a3a,
    }),
    specialDirectional: melee('Bronze Sword', {
      type: K, damage: 15.6, rangeW: 98, rangeH: 52, vfx: 'strike', vfxColor: 0xc48a4a,
      baseKnockback: 210, knockbackGrowth: 4.4, duration: 260, cooldown: 1020,
    }),
  },

  agatha: {
    basicCharge: m('Silver Bullet', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 15.2, bonusVsBuff: 1.75, chargeDamageMult: 1.55,
      maxChargeMs: 700, vfx: 'strike', vfxColor: 0xe8eef2,
      projectileSpeed: 560, projectileRadius: 6, projectileLife: 460,
      baseKnockback: 280, knockbackGrowth: 4.6, duration: 200, cooldown: 1360,
    }),
    basicDirectional: melee('Current Slash', {
      type: K, damage: 4, type2: E, damage2: 3, rangeW: 86, vfx: 'spark',
      baseKnockback: 160, knockbackGrowth: 3.8, duration: 220, cooldown: 650,
    }),
    specialDefense: m('Mirror Flash', {
      reflectTypes: [H, E, R], reflectPower: 1,
      counterKnockback: 120, counterKnockbackGrowth: 1.6,
      duration: 1000, cooldown: 900, vfx: 'shield', vfxColor: 0xe8eef4,
    }),
    specialDirectional: m('Tarnish Cloud', {
      kind: 'zone', type: C, damage: 16.9, vfx: 'cloud', vfxColor: 0x6a6a62,
      zone: {
        name: 'Tarnish Cloud', type: C, damage: 2, flat: true, percentOnly: true,
        ms: 7000, radius: 84, tick: 1000, offsetX: 70, sheet: true,
        knockback: 0, growth: 0,
        onHit: { corrode: { mult: 0.7, ms: 7000 } },
      },
      duration: 240, cooldown: 980,
    }),
  },

  cody: {
    basicCharge: m('Quantum Dot', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 9.5, chargeDamageMult: 2.3, chargeSpeedMult: 0.42,
      maxChargeMs: 1000, vfx: 'spark', vfxColor: 0xff4a3a,
      redFrames: [3, 4, 5, 6, 7, 8, 18, 19, 20], redFrameCount: 24, redFps: 9.6, redMult: 1.5,
      projectileSpeed: 640, projectileRadius: 8, projectileLife: 680,
      baseKnockback: 90, knockbackGrowth: 2.4, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Battery Prod', {
      type: K, damage: 5, type2: E, damage2: 3, rangeW: 64, vfx: 'spark',
      baseKnockback: 120, knockbackGrowth: 2.6, duration: 210, cooldown: 670,
    }),
    specialDefense: m('Control Rod', {
      immune: [R], blocks: [K], kind: 'block', onlyReduce: [H], blockReduction: 0.45,
      duration: 760, cooldown: 880, vfx: 'shield', vfxColor: 0xf0d24a,
    }),
    specialDirectional: m('Yellow Paint Bomb', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 16.2, vfx: 'cloud', vfxColor: 0xf0d24a,
      onHit: {
        slow: 7000,
        poison: { dps: 2, every: 1000, ms: 7000, flat: true },
        coat: 'Yellow Paint', coatMs: 7000,
      },
      projectileSpeed: 420, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 60, knockbackGrowth: 1, duration: 220, cooldown: 950,
    }),
  },

  aurelius: {
    basicCharge: m('Midas Touch', {
      type: K, damage: 15.6, pull: 140,
      onHit: { freeze: 640, gold: 640, coat: 'Midas Touch', coatMs: 640 }, stunChance: 0.5,
      rangeW: 56, rangeH: 48,
      maxChargeMs: 700, chargeDamageMult: 1.25, vfx: 'spark', vfxColor: 0xf0c84a,
      baseKnockback: 16.9, knockbackGrowth: 0.23, duration: 240, cooldown: 1180,
    }),
    basicDirectional: melee('Circuit Contact', {
      type: K, damage: 4.5, type2: E, damage2: 3, rangeW: 70, rangeH: 48, vfx: 'spark', vfxColor: 0xf0c84a,
      baseKnockback: 120, knockbackGrowth: 2.4, duration: 200, cooldown: 670,
    }),
    specialDefense: m('Golden Visor', {
      immune: [C], reflectTypes: [H, R], duration: 720, cooldown: 900, vfx: 'shield', vfxColor: 0xf0c84a,
    }),
    specialDirectional: m('Ingot Lob', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.1, lob: { vy: 0, g: 600 }, vfx: 'strike', vfxColor: 0xf0c84a,
      projectileSpeed: 520, projectileRadius: 14, projectileLife: 900,
      baseKnockback: 200, knockbackGrowth: 3.01, duration: 240, cooldown: 1020,
    }),
  },

  talia: {
    basicCharge: m('Poisoner\'s Poison', {
      kind: 'burst', type: C, damage: 22, radius: 62, chargeRadiusMult: 1.55, maxChargeMs: 900,
      zone: {
        name: "Poisoner's Poison", type: C, damage: 1.7, ramp: 0.5, ms: 2400, radius: 68,
        tick: 340, knockback: 8, growth: 0.1, color: 0x9d6bff,
        sheet: true, offsetX: 96, drift: 28, statusCling: "Poisoner's Poison",
      },
      baseKnockback: 0, knockbackGrowth: 0, duration: 240, cooldown: 1180, vfx: 'cloud',
    }),
    basicDirectional: melee('Green Line Stab', {
      type: K, damage: 4, type2: C, damage2: 3, rangeW: 58, vfx: 'strike', vfxColor: 0x7dff6a,
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 180, cooldown: 590,
    }),
    specialDefense: m('Prussian Blue', {
      immune: [C], cleanse: ['poison'], duration: 760, cooldown: 860, vfx: 'shield', vfxColor: 0x2a4ac8,
    }),
    specialDirectional: m('Pale Horse Dart', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 14.2, vfx: 'strike',
      onHit: { poison: { dps: 6, ms: 360, delay: 1100 } },
      projectileSpeed: 500, projectileRadius: 6, projectileLife: 460,
      baseKnockback: 40, knockbackGrowth: 0.5, duration: 200, cooldown: 900,
    }),
  },

  bianca: {
    basicCharge: m('Hopper Crystal', {
      kind: 'burst', type: K, damage: 18.4, chargeDamageMult: 1.35, chargeRadiusMult: 1.45,
      maxChargeMs: 800, radius: 24, landAt: true,
      spikes: { count: 5, gap: 32, start: 36, radius: 22 },
      vfx: 'spark', vfxColor: 0xc48bff,
      baseKnockback: 175, knockbackGrowth: 4.2, duration: 280, cooldown: 1400,
    }),
    basicDirectional: melee('Staircase Kick', {
      type: K, damage: 3.1, multiHit: 3, rangeW: 70, rangeH: 56, hitRadius: 56, vfx: 'strike',
      baseKnockback: 120, knockbackGrowth: 3.8, duration: 320, cooldown: 710,
    }),
    specialDefense: m('Diamagnetic Repel', {
      grabImmune: true, slowMetals: 0.28, float: true,
      duration: 700, cooldown: 880, vfx: 'shield', vfxColor: 0xd7c4ff,
    }),
    specialDirectional: m('Pink Bismuth', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 18.3, lob: 300, nearCleanse: 78,
      vfx: 'cloud', vfxColor: 0xff8ac4,
      projectileSpeed: 400, projectileRadius: 14, projectileLife: 900,
      baseKnockback: 100, knockbackGrowth: 2.4, duration: 220, cooldown: 1030,
    }),
  },

  polonius: {
    basicCharge: m('Blue Glow Burst', {
      kind: 'burst', type: H, damage: 9, type2: R, damage2: 8, chargeDamageMult: 1.55, chargeRadiusMult: 1.6,
      maxChargeMs: 900, radius: 64, selfGlowMs: 1400, vfx: 'fire', vfxColor: 0x6ad0ff,
      baseKnockback: 140, knockbackGrowth: 3.0, duration: 260, cooldown: 1350,
    }),
    basicDirectional: melee('Rapier Thrust', {
      type: K, damage: 5.3, type2: R, damage2: 4.6, rangeW: 92, rangeH: 24, vfx: 'strike',
      baseKnockback: 200, knockbackGrowth: 2.5, duration: 200, cooldown: 700,
    }),
    specialDefense: m('Behind the Arras', {
      kind: 'wall', frontOnly: true, backOpen: true, behindMult: 2, pierceMult: 2,
      blocks: [K, H, E, C, R],
      wallDamage: 0, wallType: K, wallKnockback: 0, wallKnockbackGrowth: 0,
      wallRangeW: 26, wallRangeH: 100, wallYFrac: 0.7,
      duration: 640, cooldown: 960, vfx: 'wall', vfxColor: 0x6a4a38,
    }),
    specialDirectional: melee('Static Eliminator', {
      type: R, damage: 17.7, stripBuffs: true, onHit: { strip: true }, rangeW: 100, rangeH: 36,
      vfx: 'spark', baseKnockback: 60, knockbackGrowth: 0.9, duration: 220, cooldown: 1010,
    }),
  },

  tate: {
    basicCharge: m('Self-Vaporize', {
      kind: 'burst', type: H, damage: 9.5, type2: R, damage2: 9.5, commit: true,
      chargeDamageMult: 1.45, chargeRadiusMult: 1.45, maxChargeMs: 1000, radius: 78,
      selfDamage: { type: R, damage: 2, withCharge: true, noFlinch: true }, blinkMs: 420,
      vfx: 'fire', vfxColor: 0xfff2a8,
      baseKnockback: 100, knockbackGrowth: 1.6, duration: 260, cooldown: 1400,
    }),
    basicDirectional: melee('Targeted Alpha', {
      type: R, damage: 8, breaksBlock: true, ignoreReductions: true, rangeW: 52, vfx: 'spark',
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 210, cooldown: 620,
    }),
    specialDefense: m('Never Seen', {
      phase: true, fadeAlpha: 0.15, drain: { damage: 1, type: R, every: 1000 },
      duration: 900, cooldown: 1040, vfx: 'shield', vfxColor: 0xc9d6e0,
    }),
    specialDirectional: m('Unstable Bolt', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 9.2, type2: R, damage2: 9.2, vfx: 'spark',
      projectileSpeed: 500, projectileRadius: 9, projectileLife: 500,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 210, cooldown: 1030,
    }),
  },

  brock: {
    basicCharge: m('Bromos Stench', {
      kind: 'burst', type: C, damage: 17.5, gas: true, radius: 72, bonusVsMark: 'stain', markMult: 1.35, onHit: { drift: 650 },
      chargeDamageMult: 1.45, chargeRadiusMult: 1.5, maxChargeMs: 900, vfx: 'cloud', vfxColor: 0x8a3a22,
      baseKnockback: 70, knockbackGrowth: 2.4, duration: 240, cooldown: 1320,
    }),
    basicDirectional: m('Caustic Splash', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 5, bonusVsMark: 'stain', markMult: 1.35, vfx: 'cloud',
      projectileSpeed: 460, projectileRadius: 11, projectileLife: 460,
      baseKnockback: 145, knockbackGrowth: 3.4, duration: 200, cooldown: 500,
    }),
    specialDefense: m('Red Fume Screen', {
      gas: true, softenProjectiles: 0.35,
      zone: { type: C, damage: 1.4, gas: true, ms: 800, radius: 68, tick: 1000, knockback: 0, growth: 0, onHit: { blind: 480 }, color: 0x8a3a22 },
      duration: 800, cooldown: 900, vfx: 'cloud', vfxColor: 0x8a3a22,
    }),
    specialDirectional: m('Tyrian Purple', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 16.8, bonusVsMark: 'stain', markMult: 1.35,
      onHit: { mark: 'stain', markMs: 3600, coat: 'Tyrian Stain', coatMs: 3600 }, vfx: 'cloud', vfxColor: 0x6a2a8a,
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 90, knockbackGrowth: 2.2, duration: 210, cooldown: 970,
    }),
  },

  ceres: {
    basicCharge: m('Ferro Rod Sparks', {
      kind: 'beam', type: H, damage: 17.7, chargeDamageMult: 1.55, chargeLengthMult: 2,
      maxChargeMs: 800, beamLen: 128, beamThick: 26, vfx: 'fire', vfxColor: 0xffb45a,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Ceria Polish', {
      // The sheet is catalytic-burn. The move name and the polish numbers stay.
      sourceSlug: 'catalytic-burn',
      type: K, damage: 2.3, multiHit: 4, bonusVsBlock: 0.8, popShield: true, rangeW: 64, vfx: 'strike',
      baseKnockback: 40, knockbackGrowth: 0.7, duration: 340, cooldown: 710,
    }),
    specialDefense: m('Self-Cleaning', {
      immune: [H], cleanse: ['poison', 'burn', 'slow', 'debuff'],
      duration: 740, cooldown: 880, vfx: 'fire', vfxColor: 0xffd0a0,
    }),
    specialDirectional: m('Dwarf Planet', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.3, ground: true, vfx: 'strike',
      projectileSpeed: 300, projectileRadius: 16, projectileLife: 780,
      baseKnockback: 140, knockbackGrowth: 2.4, duration: 240, cooldown: 1030,
    }),
  },

  europa: {
    basicCharge: m('Phosphor Bloom', {
      kind: 'burst', type: R, damage: 18.3, chargeDamageMult: 1.5, chargeRadiusMult: 1.4,
      maxChargeMs: 900, radius: 72, vfx: 'spark', vfxColor: 0xff4a6a,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Counterfeit Check', {
      type: E, damage: 7, stripBuffs: true, stripProtection: true, cancelInvis: true,
      onHit: { strip: true }, breakPhase: true, rangeW: 72, vfx: 'strike', vfxColor: 0xb070ff,
      baseKnockback: 80, knockbackGrowth: 1.3, duration: 220, cooldown: 600,
    }),
    specialDefense: m('Neutron Sponge', {
      blocks: [K, R], soakRadiation: true,
      releaseRods: {
        type: K, glowType: R, damage: 4,
        projectileSpeed: 440, projectileRadius: 11, projectileLife: 500,
        baseKnockback: 64, knockbackGrowth: 1.1,
        period: 1100, orbit: 1.05,
      },
      duration: 1000, cooldown: 1000, vfx: 'shield', vfxColor: 0xc8f0c0,
    }),
    specialDirectional: m('Icy Geyser', {
      kind: 'burst', type: K, damage: 15.3, radius: 72,
      geyser: { warnMs: 560 },
      onHit: { slow: 700 },
      vfx: 'gust', vfxColor: 0xbfe8ff,
      baseKnockback: 80, knockbackGrowth: 1.4, duration: 240, cooldown: 1000,
    }),
  },

  dizzy: {
    basicCharge: m('Turbine Gust', {
      kind: 'beam', type: K, damage: 15.1,
      chargeDamageMult: 1.6, chargeKnockbackMult: 1.7, chargeLengthMult: 1.35,
      maxChargeMs: 800, beamLen: 340, beamThick: 52,
      vfx: 'gust', vfxColor: 0x7ee0d0,
      baseKnockback: 160, knockbackGrowth: 2.6, duration: 240, cooldown: 1360,
    }),
    basicDirectional: melee('EV Motor Punch', {
      type: K, damage: 1.9, type2: E, damage2: 1.3, multiHit: 3, fullWhenHot: true,
      rangeW: 72, vfx: 'spark', vfxColor: 0x5ee0d0,
      baseKnockback: 55, knockbackGrowth: 1.3, duration: 420, cooldown: 710,
    }),
    specialDefense: m('Control Rod Wall', {
      blocks: [K, R], offsetX: 90,
      duration: 1100, cooldown: 980, vfx: 'shield', vfxColor: 0x8a9aa8,
    }),
    specialDirectional: m('Stage Light Flash', {
      kind: 'beam', type: H, damage: 16.4, aimStick: true,
      beamLen: 480, beamThick: 40, beamCap: 1100, beamArtPx: 1100,
      onHit: { stun: 1000 }, stunChance: 1,
      vfx: 'laser', vfxColor: 0xfff2c4,
      baseKnockback: 70, knockbackGrowth: 1.15, duration: 220, cooldown: 960,
    }),
  },

  erin: {
    basicCharge: m('Undersea Cable', {
      kind: 'beam', type: E, damage: ERIN.cableDamage * 2.14, ground: true, slam: true,
      chargeDamageMult: ERIN.cableDamageMult, chargeLengthMult: ERIN.cableLengthMult,
      maxChargeMs: ERIN.maxChargeMs, beamLen: ERIN.cableLen, beamThick: 14,
      vfx: 'spark', vfxColor: 0xff7ab0, ...fx('Undersea Cable'),
      baseKnockback: 70, knockbackGrowth: 1.1, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Pink Glass Swipe', {
      type: K, damage: 6, rangeW: 76, vfx: 'strike', vfxColor: 0xff8ac4, ...fx('Pink Glass Swipe'),
      baseKnockback: 90, knockbackGrowth: 1.4, duration: 210, cooldown: 560,
    }),
    specialDefense: m('Signal Repeater', {
      reflectTypes: [E, R], reflectPower: ERIN.reflectPower,
      duration: 600, cooldown: 900, vfx: 'shield', vfxColor: 0xff7ab0, ...fx('Signal Repeater'),
    }),
    specialDirectional: m('Resurface Laser', {
      kind: 'beam', type: H, damage: 18.3, stripProtection: true,
      beamLen: 136, beamThick: 12, vfx: 'laser', vfxColor: 0xff4a6a, ...fx('Resurface Laser'),
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 200, cooldown: 1030,
    }),
  },

  ace: {
    basicCharge: m('Actinic Ray', {
      kind: 'beam', type: R, damage: 18.4, chargeDamageMult: 1.5, chargeLengthMult: 1.85,
      maxChargeMs: 850, beamLen: 138, beamThick: 16, beamArtPx: 640, vfx: 'laser', vfxColor: 0x8ad0ff,
      baseKnockback: 160, knockbackGrowth: 4.2, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Ace of Rays', {
      type: K, damage: 5, type2: R, damage2: 5, rangeW: 70, vfx: 'spark',
      baseKnockback: 150, knockbackGrowth: 3.8, duration: 200, cooldown: 700,
    }),
    specialDefense: m('Smoke Detector', {
      immune: [R],
      revealNear: { radius: 220, every: 1000, ms: 1100 },
      duration: 800, cooldown: 960, vfx: 'shield', vfxColor: 0x8ad0ff,
    }),
    specialDirectional: m('Neutron Deck', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 18.3, explodeOnly: true, explodeRadius: 56, hitRadius: 56,
      vfx: 'spark', vfxColor: 0x9fd4ff,
      projectileSpeed: 420, projectileRadius: 14, projectileLife: 520,
      baseKnockback: 120, knockbackGrowth: 2.4, duration: 220, cooldown: 1030,
    }),
  },

  thor: {
    basicCharge: m('Thunder Hammer', {
      kind: 'burst', type: K, damage: 7, type2: E, damage2: 6, chargeDamageMult: 1.45, chargeRadiusMult: 1.35,
      maxChargeMs: 900, radius: 58, vfx: 'spark', vfxColor: 0xf0d24a,
      baseKnockback: 120, knockbackGrowth: 1.7, duration: 280, cooldown: 1180,
    }),
    basicDirectional: melee('Fuel Rod Hammer', {
      // The sheet file stays fuel-rod-jab. The swing raises the hammer, then
      // the short hit is the downward strike.
      sourceSlug: 'fuel-rod-jab',
      type: K, damage: 6, type2: R, damage2: 4, rangeW: 62, rangeH: 64,
      startupF: 7, activeF: 3, vfx: 'spark',
      baseKnockback: 100, knockbackGrowth: 1.5, duration: 200, cooldown: 740,
    }),
    specialDefense: m('Breeder Blanket', {
      immune: [R], surgeFrom: 'radiation', surgeCap: 4,
      duration: 800, cooldown: 940, vfx: 'shield', vfxColor: 0xc8b48a,
    }),
    specialDirectional: m('Reactor Surge', {
      kind: 'beam', type: E, damage: 15.4, surgePer: 2, surgeCap: 4, ground: true,
      beamLen: 360, beamThick: 18, beamArtPx: 620, vfx: 'laser', vfxColor: 0x7ec8ff,
      baseKnockback: 110, knockbackGrowth: 1.6, duration: 220, cooldown: 1040,
    }),
  },

  frank: {
    basicCharge: m('Beta Turn', {
      kind: 'buff', duration: 220, cooldown: 980, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xffe08a,
      buff: { ms: 2600, weight: 1.32, scaleWithCharge: true, bonus: { type: R, damage: 4, hits: 4, name: 'Beta Turn' } },
    }),
    basicDirectional: melee('Vanishing Jab', {
      type: K, damage: 6, type2: R, damage2: 4, rangeW: 40, rangeH: 14, flicker: true,
      startupF: 1, endlagF: 8, vfx: 'spark', vfxColor: 0xffe08a,
      baseKnockback: 120, knockbackGrowth: 2.4, duration: 140, cooldown: 700,
    }),
    specialDefense: m('Trace Amount', {
      phase: true, phaseRetort: { type: R, damage: 17.6, knockback: 90, growth: 1.6 },
      duration: 460, cooldown: 1000, vfx: 'shield', vfxColor: 0xfff2c4,
    }),
    specialDirectional: m('Alpha Flick', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 18, vfx: 'spark', vfxColor: 0xffd36a,
      projectileSpeed: 520, projectileRadius: 8, projectileLife: 220,
      baseKnockback: 150, knockbackGrowth: 2.8, duration: 180, cooldown: 1020,
    }),
  },

  manny: {
    basicCharge: m('Permanganate Splash', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 17.7, chargeDamageMult: 1.55, maxChargeMs: 850,
      vfx: 'acid', vfxColor: 0x7a2ea8,
      projectileSpeed: 420, projectileRadius: 12, projectileLife: 520,
      stainAtFull: { type: C, damage: 0.78, ms: 1500, radius: 46, tick: 360, knockback: 0, growth: 0, color: 0x7a2ea8, onHit: { burn: { dps: 1.1, ms: 1200 } } },
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Rock Crusher', {
      type: K, damage: 4, bonusVsBlock: 0.6, pull: 200, rangeW: 70, vfx: 'strike', vfxColor: 0x6b4a8a,
      baseKnockback: 130, knockbackGrowth: 2.6, duration: 230, cooldown: 510,
    }),
    specialDefense: m('Work Hardening', {
      kind: 'block', onlyReduce: [K, H], blockReduction: 0.28, harden: true, hardenStep: 0.11, hardenCap: 0.76,
      hardenLinger: 5000, hardenLingerStep: 0.07,
      duration: 780, cooldown: 860, vfx: 'shield', vfxColor: 0x8a9098,
    }),
    specialDirectional: m('Dry Cell Lob', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 17.5, explodeOnly: true, explodeRadius: 48, vfx: 'spark', vfxColor: 0xc45cff,
      projectileSpeed: 380, projectileRadius: 10, projectileLife: 620,
      baseKnockback: 100, knockbackGrowth: 2, duration: 220, cooldown: 1030,
    }),
  },

  fey: {
    basicCharge: m('Forge Hammer', {
      kind: 'burst', type: K, damage: 8.5, type2: H, damage2: 7.1, slam: true, chargeDamageMult: 1.6, chargeRadiusMult: 1.3,
      maxChargeMs: 900, radius: 54, vfx: 'fire', vfxColor: 0xff6a2a,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 280, cooldown: 1400,
    }),
    basicDirectional: melee('Cold Iron Cut', {
      type: K, damage: 7, stripBuffs: true, rangeW: 78, vfx: 'strike', vfxColor: 0xc8d0d8,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 640,
    }),
    specialDefense: m('Lodestone Guard', {
      catchMetals: true, duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xd85a4a,
    }),
    specialDirectional: m('Thermite', {
      kind: 'beam', type: H, damage: 17.2, beamLen: 130, beamThick: 26,
      onHit: { burn: { dps: 3, every: 1000, ms: 3500 } },
      vfx: 'thermite', vfxColor: 0xff6a1a, baseKnockback: 160,
      startupF: 4, endlagF: 10, duration: 220, cooldown: 990,
    }),
  },

  nick: {
    basicCharge: melee('Memory Snap', {
      kind: 'dash', type: K, damage: 15.3, chargeDamageMult: 1.5, chargeDashMult: 1.25,
      maxChargeMs: 800, dashSpeed: 520, rangeW: 84, rangeH: 64, vfx: 'dash', vfxColor: 0xcfd6dc,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Nickel and Dime', {
      type: K, damage: 5, bonusVsBlock: 0.5, rangeW: 68, vfx: 'strike', vfxColor: 0xd8dde4,
      also: {
        kind: 'projectile', shotEnd: 'despawn', type: K, damage: 4, delayMs: 120, vfx: 'strike', vfxColor: 0xd8dde4,
        projectileSpeed: 540, projectileRadius: 6, projectileLife: 420,
        baseKnockback: 90, knockbackGrowth: 2,
      },
      baseKnockback: 90, knockbackGrowth: 2, duration: 240, cooldown: 540,
    }),
    specialDefense: m('Electroplate', {
      immune: [C], kind: 'block', onlyReduce: [H], blockReduction: 0.5,
      duration: 680, cooldown: 800, vfx: 'shield', vfxColor: 0xb7e3c2,
    }),
    specialDirectional: m('Meteorite Drop', {
      // Painted meteor streaks down-forward; match that dive instead of a
      // near-vertical drop (projectileSpeed 40 / fallSpeed 560 read as "rock falls").
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 9, type2: H, damage2: 7, slam: true, fromAbove: true,
      delayMs: 280, fallSpeed: 740, fallAccel: 980,
      skyHeight: 380, skyLead: 200,
      vfx: 'strike', vfxColor: 0x8a93a0,
      projectileSpeed: 650, projectileRadius: 16, projectileLife: 1400,
      baseKnockback: 220, knockbackGrowth: 4.2, duration: 220, cooldown: 1010,
    }),
  },

  molly: {
    basicCharge: m('Red-Hot Rod', {
      kind: 'beam', type: K, damage: 6, type2: H, damage2: 7, chargeDamageMult: 1.4, chargeLengthMult: 1.9,
      maxChargeMs: 900, beamLen: 140, beamThick: 18, vfx: 'fire', vfxColor: 0xff4a3a,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 220, cooldown: 1120,
    }),
    basicDirectional: m('Grease Slide', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 7, ground: true, trip: true, tripMs: 680,
      vfx: 'strike', vfxColor: 0x6a7078,
      projectileSpeed: 340, projectileRadius: 16, projectileLife: 760,
      baseKnockback: 36, knockbackGrowth: 0.45, duration: 200, cooldown: 660,
    }),
    specialDefense: m('Dry Lube', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.4, noKnockback: true,
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0x9aa3ad,
    }),
    specialDirectional: m('Nitrogenase', {
      kind: 'zone', type: C, damage: 17.3, vfx: 'cloud', vfxColor: 0x7dcea0,
      zone: {
        name: 'Nitrogenase', type: C, damage: 0.7, ms: 1100, radius: 56, tick: 460,
        offsetX: 48, sheet: true, color: 0x7dcea0, bonusVsId: { nitra: 2 },
      },
      baseKnockback: 40, knockbackGrowth: 0.6, duration: 240, cooldown: 990,
    }),
  },

  paula: {
    basicCharge: m('Cold Fusion', {
      kind: 'burst', type: H, damage: PAULA.blastDamage * 1.54, chargeDamageMult: 1,
      gamble: {
        fullOdds: PAULA.fullOdds,
        partialOdds: PAULA.partialOdds,
        partialAfterMs: PAULA.partialAfterMs,
        partialScale: PAULA.partialScale,
      },
      maxChargeMs: PAULA.fullChargeMs, radius: PAULA.blastRadius,
      vfx: 'fire', vfxColor: 0xfff6d8, fizzleTint: 0xf4f7ff, ...fx('Cold Fusion'),
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 260, cooldown: 1410,
    }),
    basicDirectional: melee('White Gold Jab', {
      type: K, damage: 7, rangeW: 66, vfx: 'strike', vfxColor: 0xf4f0e6, ...fx('White Gold Jab'),
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 190, cooldown: 650,
    }),
    specialDefense: m('Hydrogen Sponge', {
      absorbGas: true, absorbHeal: PAULA.spongeHeal, cloudHeal: PAULA.cloudHealPerSec,
      duration: 700, cooldown: 860, vfx: 'shield', vfxColor: 0xd7ecff, ...fx('Hydrogen Sponge'),
    }),
    specialDirectional: m('Fuel Cell Bolt', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: PAULA.boltDamage * 2.49, gasBolt: PAULA.boltDouble,
      boltScale: PAULA.boltScale, boltColor: 0xf7fbff,
      vfx: 'spark', vfxColor: 0x8fd0ff, ...fx('Fuel Cell Bolt'),
      projectileSpeed: 500, projectileRadius: 10, projectileLife: 480,
      baseKnockback: 100, knockbackGrowth: 2, duration: 200, cooldown: 1040,
    }),
  },

  haley: {
    basicCharge: melee('Plasma Cutter', {
      type: H, damage: 10.3, type2: E, damage2: 7.7, chargeDamageMult: 1.45,
      maxChargeMs: 850, rangeW: 92, vfx: 'slash', vfxColor: 0x7ef0ff,
      baseKnockback: 70, knockbackGrowth: 1.2, duration: 200, cooldown: 1410,
    }),
    basicDirectional: melee('Carbide Kick', {
      type: K, damage: 4, type2: H, damage2: 3, rangeW: 74, vfx: 'strike', vfxColor: 0xffb45a,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 210, cooldown: 620,
    }),
    specialDefense: m('High-K Gate', {
      kind: 'block', immune: [K, E], blocks: [K, E], breakOn: H,
      duration: 640, cooldown: 800, vfx: 'shield', vfxColor: 0x9ad7ff,
    }),
    specialDirectional: m('Neutron Sink', {
      kind: 'projectile', shotEnd: 'stick', type: K, damage: 13.8, stick: true, vfx: 'spark', vfxColor: 0xb8c4d4,
      onHit: { mute: 'radiation', muteMs: 2600, muteCling: true },
      projectileSpeed: 440, projectileRadius: 16, projectileLife: 800,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 200, cooldown: 1000,
    }),
  },

  ira: {
    basicCharge: m('Extinction Layer', {
      kind: 'burst', type: K, damage: 7.7, type2: H, damage2: 7.7, chargeDamageMult: 1.55, chargeRadiusMult: 1.25,
      maxChargeMs: 1200, radius: 52, predict: { lead: 0.45 }, floor: true, meteor: true, impactAt: 0.9,
      vfx: 'strike', vfxColor: 0xd8d2c8,
      baseKnockback: 100, knockbackGrowth: 1.6, duration: 640, cooldown: 1420,
    }),
    basicDirectional: melee('Spark Plug', {
      type: K, damage: 4, type2: E, damage2: 3, rangeW: 64, vfx: 'spark', vfxColor: 0xffe08a,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 670,
    }),
    specialDefense: m('Prototype Kilogram', {
      flatHit: 8, duration: 640, cooldown: 980, vfx: 'shield', vfxColor: 0xe6e2da,
    }),
    specialDirectional: m('Iris Scatter', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 14, fanTypes: [K, H, E, C], fanDeg: 30, ghostCopies: 3, vfx: 'spark',
      projectileSpeed: 440, projectileRadius: 7, projectileLife: 420,
      baseKnockback: 70, knockbackGrowth: 1.6, duration: 220, cooldown: 1040,
    }),
  },

  hog: {
    basicCharge: m('Thermometer Burst', {
      kind: 'burst', type: K, damage: 10.2, type2: C, damage2: 7.7,
      chargeDamageMult: 1.55, chargeRadiusMult: 1.35, heatTakenBonus: 1.4,
      maxChargeMs: 800, radius: 64, vfx: 'strike', vfxColor: 0xc0c6cc,
      baseKnockback: 143, knockbackGrowth: 2.42, duration: 260, cooldown: 1410,
    }),
    basicDirectional: melee('Quicksilver Lash', {
      type: K, damage: 5.5, type2: C, damage2: 5.5, rangeW: 124, rangeH: 28, vfx: 'strike', vfxColor: 0xd5dbe2,
      baseKnockback: 88, knockbackGrowth: 1.76, duration: 210, cooldown: 740,
    }),
    specialDefense: m('Amalgamate', {
      amalgam: true, amalgamMult: 0.66, amalgamVs: { aurelius: 0.38 }, amalgamMs: 2400,
      duration: 700, cooldown: 880, vfx: 'shield', vfxColor: 0xb9c2cc,
    }),
    specialDirectional: m("Hatter's Fume", {
      kind: 'zone', type: C, damage: 17.4, vfx: 'cloud', vfxColor: 0x8a9aa8,
      zone: {
        name: "Hatter's Fume", type: C, damage: 1.65, ms: 1500, radius: 70, tick: 380,
        sheet: true, offsetX: 36, drift: 48, color: 0x8a9aa8,
      },
      baseKnockback: 33, knockbackGrowth: 0.44, duration: 240, cooldown: 1000,
    }),
  },

  gail: {
    basicCharge: m('Superconductor Arc', {
      kind: 'burst', type: E, damage: 15.5, chargeDamageMult: 1.4, chargeRadiusMult: 1.35,
      maxChargeMs: 850, radius: 72, vfx: 'spark', vfxColor: 0x9ae7ff,
      zone: { type: E, damage: 1.7, ms: 1500, radius: 78, tick: 320, knockback: 0, growth: 0, color: 0x9ae7ff },
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 240, cooldown: 1340,
    }),
    basicDirectional: melee('Embrittle', {
      type: K, damage: 5, bonusVsId: { allen: 2 },
      onHit: { root: 420, vulnerable: 1.35, vulnerableMs: 2600, coat: 'Embrittle', coatMs: 2600 },
      rangeW: 62, vfx: 'strike', vfxColor: 0xc8d4de,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 210, cooldown: 520,
    }),
    specialDefense: m('Melt Down', {
      intangible: true, puddle: true,
      duration: 1800, cooldown: 840, vfx: 'shield', vfxColor: 0xd7dee6,
    }),
    specialDirectional: m('Blue LED', {
      kind: 'beam', type: E, damage: 8.3, type2: H, damage2: 8.3, beamLen: 148, beamThick: 12,
      vfx: 'laser', vfxColor: 0x4aa8ff,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 180, cooldown: 1030,
    }),
  },

  indy: {
    basicCharge: m('Invisible Film', {
      kind: 'zone', type: E, damage: 20.9, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xb9d4e8,
      zone: {
        name: 'Invisible Film', type: E, damage: 3.2, ms: 10000, radius: 88, tick: 700,
        offsetX: 64, low: true, feet: true, sheet: true, knockback: 22, growth: 0.3, color: 0x9ec4d8,
      },
      baseKnockback: 22, knockbackGrowth: 0.3, duration: 220, cooldown: 1340,
    }),
    basicDirectional: melee('Sticky Seal', {
      type: K, damage: 7, onHit: { root: 3000 }, rangeW: 66, vfx: 'strike', vfxColor: 0xd8dee6,
      baseKnockback: 0, knockbackGrowth: 0, duration: 200, cooldown: 600,
    }),
    specialDefense: m('Putty Guard', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.5, noKnockback: true,
      duration: 700, cooldown: 820, vfx: 'shield', vfxColor: 0xc5ced6,
    }),
    specialDirectional: m('Solder Whip', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 18.3,
      onHit: { elecTaken: { mult: 1.4, ms: 5000 } },
      vfx: 'spark', vfxColor: 0xe8eef4,
      projectileSpeed: 500, projectileRadius: 9, projectileLife: 480,
      baseKnockback: 70, knockbackGrowth: 1.3, duration: 200, cooldown: 1030,
    }),
  },

  pablo: {
    basicCharge: m('Machine Gun', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 3.4, salvo: 12, salvoGap: 70, hitRadius: 34,
      maxChargeMs: 200, vfx: 'strike', vfxColor: 0xc8cdd4,
      projectileSpeed: 820, projectileRadius: 7, projectileLife: 320,
      baseKnockback: 140, knockbackGrowth: 2.4, duration: 180, cooldown: 1410,
    }),
    basicDirectional: melee('Lead Pipe', {
      type: K, damage: 11, onHit: { interrupt: 200 }, rangeW: 76, vfx: 'strike', vfxColor: 0x6e7580,
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 220, cooldown: 770,
    }),
    specialDefense: m('Lead Apron', {
      immune: [R], kind: 'block', onlyReduce: [H], blockReduction: 0.5,
      duration: 720, cooldown: 840, vfx: 'shield', vfxColor: 0x9aa3ae,
    }),
    specialDirectional: m('Shotgun', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 5.7, fan: 6, fanDeg: 22, barrelFlash: true,
      recoilSelf: 200, recoilMs: 120,
      vfx: 'strike', vfxColor: 0xb7bdc4,
      projectileSpeed: 640, projectileRadius: 7, projectileLife: 280,
      baseKnockback: 50, knockbackGrowth: 0.9, duration: 200, cooldown: 1040,
    }),
  },

  arsenio: {
    basicCharge: m('Inheritance Powder', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 18.1, gas: true, chargeDamageMult: 1.4, maxChargeMs: 800,
      onHit: { poison: { dps: 1.6, ms: 1400, inherit: true } },
      vfx: 'cloud', vfxColor: 0x7fbf4a,
      projectileSpeed: 400, projectileRadius: 12, projectileLife: 520,
      baseKnockback: 50, knockbackGrowth: 1, duration: 220, cooldown: 1320,
    }),
    basicDirectional: melee('Paris Green Slash', {
      type: K, damage: 5, type2: C, damage2: 4,
      onHit: { poison: { dps: 2, every: 1000, ms: 4100 } },
      rangeW: 80, vfx: 'strike', vfxColor: 0x6aaa3a,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 700,
    }),
    specialDefense: m('Sublimate', {
      phase: true,
      letgoBurst: { type: C, damage: 5, radius: 56, baseKnockback: 75, knockbackGrowth: 1.3 },
      duration: 480, cooldown: 900, vfx: 'shield', vfxColor: 0xb6e38a,
    }),
    specialDirectional: m('Gray Arsenic Shards', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 4, type2: C, damage2: 3,
      fan: 3, fanSpread: 110, explodeOnly: true, explodeRadius: 34,
      vfx: 'strike', vfxColor: 0x9aa3ad,
      projectileSpeed: 480, projectileRadius: 7, projectileLife: 560,
      baseKnockback: 130, knockbackGrowth: 2.4, duration: 240, cooldown: 850,
    }),
  },

  iona: {
    basicCharge: m('Violet Vapor', {
      kind: 'projectile', shotEnd: 'pierce', type: C, damage: 19.2, pierce: true, chargeDamageMult: 1.35,
      maxChargeMs: 800, onHit: { blind: 520 }, vfx: 'cloud', vfxColor: 0x8a5cff,
      projectileSpeed: 240, projectileRadius: 22, projectileLife: 1400,
      baseKnockback: 50, knockbackGrowth: 1, duration: 220, cooldown: 1340,
    }),
    basicDirectional: melee('Iodine Spray', {
      type: C, damage: 7, onHit: { heal: 2 }, rangeW: 64, vfx: 'cloud', vfxColor: 0xc7a6ff,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 190, cooldown: 580,
    }),
    specialDefense: m('Iodide Shield', {
      immune: [R], clearType: 'radiation', clearStep: 2, regenEvery: 450,
      duration: 2000, cooldown: 900, vfx: 'shield', vfxColor: 0xd4c4ff,
    }),
    specialDirectional: m('Touch Powder', {
      kind: 'zone', type: K, damage: 7.8, type2: H, damage2: 9.3, vfx: 'fire', vfxColor: 0xfff2a0,
      zone: {
        name: 'Touch Powder', type: K, damage: 5, type2: H, damage2: 6,
        trap: true, feet: true, solo: true,
        ms: 6000, radius: 34, delay: 180, offsetX: 72, angleDeg: 0,
        knockback: 120, growth: 2.2,
      },
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 200, cooldown: 980,
    }),
  },

  krypto: {
    basicCharge: m('Excimer Laser', {
      kind: 'beam', type: R, damage: 10.4, type2: H, damage2: 8.3, chargeDamageMult: 1.4, chargeLengthMult: 1.55,
      maxChargeMs: 800, beamLen: 108, beamThick: 12, vfx: 'laser', vfxColor: 0xd7c4ff,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 180, cooldown: 1350,
    }),
    basicDirectional: melee('Super Pounce', {
      kind: 'dash', type: K, damage: 7, dashSpeed: 660, rangeW: 90, rangeH: 56, vfx: 'dash', vfxColor: 0xe6d8ff,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 220, cooldown: 1000, string: { hits: 2, gap: 280 },
    }),
    specialDefense: m('Flash Tube Counter', {
      kind: 'counter', counterType: E, counterDamage: 15.1, counterKnockback: 70, counterKnockbackGrowth: 1.4,
      counterStun: 280, counterBlind: 220, stunChance: 0.5,
      duration: 460, cooldown: 900, vfx: 'spark', vfxColor: 0xf4e8ff,
    }),
    specialDirectional: m('Meter Line', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 17.4, tipBonus: 4, tipAt: 240, vfx: 'spark', vfxColor: 0xc9b6ff,
      projectileSpeed: 520, projectileRadius: 8, projectileLife: 520,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 180, cooldown: 1000,
    }),
  },

  lana: {
    basicCharge: m('Regenerative Charge', {
      kind: 'burst', type: E, damage: 20.1, perTravel: 140, perTravelCap: 5, chargeDamageMult: 1.25,
      maxChargeMs: 800, radius: 64, vfx: 'spark', vfxColor: 0x8fd0c8,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Hidden Strike', {
      kind: 'dash', type: K, damage: 9, stillBonus: 1.45, dashSpeed: 440, rangeW: 80, rangeH: 50,
      vfx: 'dash', vfxColor: 0xb7ddd4,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 220, cooldown: 710,
    }),
    specialDefense: m('Hydrogen Sponge', {
      sponge: { keep: 0.4, cap: 16, push: 84, radius: 76 },
      duration: 720, cooldown: 900, vfx: 'shield', vfxColor: 0xd8fff4,
    }),
    specialDirectional: m('Cracking Catalyst', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 15.5,
      onHit: { corrode: { mult: 0.68, ms: 2600 }, chemVulnerable: 1.4, chemVulnerableMs: 2600 },
      vfx: 'strike', vfxColor: 0x9ec8be,
      projectileSpeed: 420, projectileRadius: 8, projectileLife: 640,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 1000,
    }),
  },

  goldie: {
    basicCharge: m('MRI Contrast', {
      kind: 'burst', damage: 0, chargeRadiusMult: 1.3, maxChargeMs: 800, radius: 78,
      noKnockback: true,
      onHit: { doublePercent: true, stun: 1000 }, stunChance: 1,
      vfx: 'spark', vfxColor: 0xb8f0ff,
      baseKnockback: 0, knockbackGrowth: 0, duration: 240, cooldown: 880,
    }),
    basicDirectional: melee('Magnetocaloric Palm', {
      type: K, damage: 4.9, type2: H, damage2: 4.2, rangeW: 66, vfx: 'strike', vfxColor: 0xffd0a0,
      baseKnockback: 110, knockbackGrowth: 2.2, duration: 200, cooldown: 710,
    }),
    specialDefense: m('Magnetic Chill', {
      immune: [H], cleanse: ['burn'], duration: 640, cooldown: 820, vfx: 'shield', vfxColor: 0xd8f4ff,
    }),
    specialDirectional: m('Curie Point Burst', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 0, _ghost: true,
      igniteAt: 0.62, igniteType: H, igniteDamage: 8, igniteRadius: 150,
      metalsOnly: true,
      vfx: 'fire', vfxColor: 0xffb060,
      projectileSpeed: 460, projectileRadius: 12, projectileLife: 820,
      baseKnockback: 150, knockbackGrowth: 2.2, duration: 230, cooldown: 680,
    }),
  },

  holly: {
    basicCharge: m('Stone Breaker', {
      kind: 'beam', type: H, damage: 19.7, chargeDamageMult: 1.4, chargeLengthMult: 1.7,
      bonusVsId: { carter: 2, bord: 2, silas: 2 },
      maxChargeMs: 900, beamLen: 136, beamThick: 16, beamArtPx: 1100, beamCap: 1100,
      vfx: 'laser', vfxColor: 0xffb0c8,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Calibration Strike', {
      type: K, damage: 7, fixed: true, breaksBlock: true, rangeW: 68, vfx: 'strike', vfxColor: 0xf2c4d4,
      baseKnockback: 80, knockbackGrowth: 1.3, duration: 190, cooldown: 600,
    }),
    specialDefense: m("Bend Don't Break", {
      kind: 'block', onlyReduce: [K], blockReduction: 0.45, noKnockback: true, noKnockdown: true,
      duration: 720, cooldown: 840, vfx: 'shield', vfxColor: 0xf0b8cc,
    }),
    specialDirectional: m('Pole Piece', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.9,
      projectileSpeed: 480, projectileRadius: 22, projectileLife: 720,
      pullProjectiles: 110, pullStrength: 18,
      vfx: 'spark', vfxColor: 0xe8a0b8,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 220, cooldown: 1030,
    }),
  },

  lucy: {
    basicCharge: m('City of Light', {
      kind: 'burst', type: H, damage: 19.7, chargeDamageMult: 1.4, chargeRadiusMult: 1.3,
      maxChargeMs: 850, radius: 64, vfx: 'fire', vfxColor: 0xfff4c8,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Final Lanthanide', {
      type: K, damage: 9, bonusAbovePercent: { at: 150, mult: 3 }, rangeW: 74, vfx: 'strike', vfxColor: 0xf0e2b0,
      baseKnockback: 140, knockbackGrowth: 2.6, duration: 200, cooldown: 710,
    }),
    specialDefense: m('Scintillator', {
      immune: [R], stunChance: 0.5, retort: { when: R, type: R, damage: 16, knockback: 40, growth: 0.4, stun: 440 },
      duration: 620, cooldown: 940, vfx: 'shield', vfxColor: 0xfff8d8,
    }),
    specialDirectional: m('Annihilation Pair', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 18.3, alsoBehind: true, vfx: 'spark', vfxColor: 0xfff2a8,
      projectileSpeed: 480, projectileRadius: 8, projectileLife: 420,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 1030,
    }),
  },

  percy: {
    basicCharge: m('Frozen Light', {
      kind: 'beam', type: H, damage: 20.4, delayMs: 200, chargeDamageMult: 1.35, chargeLengthMult: 1.2,
      maxChargeMs: 800, beamLen: 220, beamThick: 18, vfx: 'laser', vfxColor: 0xd6ff4a,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Green Twin Strike', {
      type: K, damage: 4.8, multiHit: 2, rangeW: 76, vfx: 'strike', vfxColor: 0x8fdb4a,
      echoTint: 0x6eff82, echoAlpha: 0.45,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 240, cooldown: 710,
    }),
    specialDefense: m("Welder's Goggles", {
      frontOnly: true, blocks: [H], debuffImmune: true, blindImmune: true, cleanse: ['blind'],
      duration: 640, cooldown: 840, vfx: 'shield', vfxColor: 0xc6e85a,
    }),
    specialDirectional: m('Green Glass Shard', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 17.1, explodeOnly: true, explodeRadius: 50,
      vfx: 'spark', vfxColor: 0xc6f070,
      projectileSpeed: 460, projectileRadius: 8, projectileLife: 420,
      baseKnockback: 80, knockbackGrowth: 1.6, duration: 200, cooldown: 1030,
    }),
  },

  rhoda: {
    basicCharge: m('Catalytic Converter', {
      kind: 'buff', damage: 0, consumeCatalyst: false,
      maxChargeMs: 850,
      eatZones: {
        radius: RHODA.vacuumRadius, gas: true,
        stackPercent: RHODA.stackBonus, stackMax: RHODA.stackMax,
      },
      vfx: 'cloud', vfxColor: 0xf0b4c8, ...fx('Catalytic Converter'),
      baseKnockback: 0, knockbackGrowth: 0, duration: 240, cooldown: 860,
    }),
    basicDirectional: melee('Rose Thorn', {
      type: K, damage: 9, rangeW: 68, vfx: 'strike', vfxColor: 0xe07090, ...fx('Rose Thorn'),
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 160, cooldown: 770,
    }),
    specialDefense: m('Tarnish Guard', {
      immune: [C],
      reduceTypes: { heat: RHODA.heatTaken, kinetic: RHODA.kineticTaken },
      cleanse: ['debuff', 'poison', 'burn', 'slow', 'blind', 'mark'],
      duration: 640, cooldown: 860, vfx: 'shield', vfxColor: 0xf7f4f8,
    }),
    specialDirectional: m('High Beam', {
      kind: 'burst', type: H, damage: RHODA.beamDamage * 1.98, radius: RHODA.coneRadius,
      coneDeg: RHODA.coneDeg, offsetX: 70,
      onHit: { dazzle: { ms: RHODA.dazzleMs, color: 0xfff6e8 } },
      vfx: 'laser', vfxColor: 0xfff2c4, ...fx('High Beam'),
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 1010,
    }),
  },

  ronan: {
    basicCharge: m('Ground Seep', {
      kind: 'burst', type: R, damage: 22, chargeDamageMult: 1.2, riseUnder: true,
      maxChargeMs: 800, radius: 46, vfx: 'cloud', vfxColor: 0xd4f5a8,
      baseKnockback: 98, knockbackGrowth: 1.95, duration: 240, cooldown: 1360,
    }),
    basicDirectional: melee('Half-Life Hook', {
      type: K, damage: 5.2, type2: R, damage2: 3.12,
      halfLife: { pause: 900, floor: 0.0625 },
      rangeW: 74, rangeH: 52, vfx: 'strike', vfxColor: 0xc6e88a,
      baseKnockback: 164, knockbackGrowth: 3.05, duration: 200, cooldown: 630,
    }),
    specialDefense: m('Radon Spa', {
      regen: 1.5, regenEvery: 450,
      zone: { type: R, damage: 0.59, ms: 800, radius: 46, tick: 480, color: 0xe4ffb0, knockback: 7.13, growth: 0.12 },
      duration: 700, cooldown: 1000, vfx: 'shield', vfxColor: 0xd8f0a0,
    }),
    specialDirectional: m('Radon Creep', {
      kind: 'zone', type: R, damage: 0, vfx: 'cloud', vfxColor: 0xc6e070,
      zone: {
        type: R, damage: 0.66, ms: 1500, radius: 52, tick: 460, color: 0xc6e070,
        knockback: 0, growth: 0, sheet: true, feet: true, drift: 110, offsetX: 36,
      },
      duration: 220, cooldown: 640,
    }),
  },

  ruben: {
    basicCharge: m('Condensate Collapse', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 17.5, slam: true, chargeDamageMult: 1.25, roll: true,
      maxChargeMs: 800, onHit: { freeze: 240 }, stunChance: 0.5, vfx: 'tide', vfxColor: 0x9ad7ff,
      projectileSpeed: 360, projectileRadius: 28, projectileLife: 700,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 260, cooldown: 1180,
    }),
    basicDirectional: m('Molten Palm', {
      kind: 'projectile', shotEnd: 'linger', type: K, damage: 5.4, type2: H, damage2: 4, fromAbove: true, fallSpeed: 640,
      vfx: 'fire', vfxColor: 0xc8d0d8,
      dropZone: { type: H, damage: 1.2, ms: 1200, radius: 36, tick: 400, knockback: 0, growth: 0, color: 0xff6a4a },
      projectileSpeed: 260, projectileRadius: 12, projectileLife: 700,
      baseKnockback: 90, knockbackGrowth: 1.8, duration: 200, cooldown: 680,
    }),
    specialDefense: m('Laser Cooling', {
      immune: [H], onStruck: { slow: 600 },
      duration: 620, cooldown: 860, vfx: 'shield', vfxColor: 0xb7e4ff,
    }),
    specialDirectional: m('Violet Ember', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.8, igniteAt: 0.35, igniteType: H, igniteDamage: 8, igniteRadius: 56,
      vfx: 'fire', vfxColor: 0xc44ad4,
      projectileSpeed: 400, projectileRadius: 8, projectileLife: 620,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 980,
    }),
  },

  ruth: {
    basicCharge: m('Sunlight Dye', {
      kind: 'beam', type: E, damage: 15.7, chargeDamageMult: 1.4, chargeLengthMult: 1.3,
      maxChargeMs: 850, beamLen: 180, beamThick: 16, vfx: 'laser', vfxColor: 0xffe08a,
      baseKnockback: 70, knockbackGrowth: 1.3, duration: 200, cooldown: 1410,
    }),
    basicDirectional: melee('Hardener Hook', {
      type: K, damage: 5, breaksBlock: true, ignoreReductions: true, rangeW: 70, vfx: 'strike', vfxColor: 0xc8d0d8,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 570,
    }),
    specialDefense: m('Metathesis Swap', {
      swapLine: true,
      duration: 280, cooldown: 980, vfx: 'shield', vfxColor: 0xd8e4f0,
    }),
    specialDirectional: m('Ammonia Crack', {
      kind: 'burst', type: C, damage: 17.4, radius: 168, coneDeg: 58, offsetX: 72,
      zone: { type: C, damage: 1.2, ms: 1600, radius: 64, tick: 500, knockback: 12, growth: 0.12, color: 0x9dffb0 },
      vfx: 'cloud', vfxColor: 0xc8f5c0,
      baseKnockback: 70, knockbackGrowth: 1.3, duration: 220, cooldown: 1000,
    }),
  },

  saab: {
    basicCharge: m('Sniper Round', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 10.9, chargeDamageMult: 2.2, chargePierce: 1,
      chargeBright: true, maxChargeMs: 950, vfx: 'strike', vfxColor: 0xfff2c8,
      projectileSpeed: 880, projectileRadius: 5, projectileLife: 380,
      baseKnockback: 80, knockbackGrowth: 1.4, duration: 180, cooldown: 1400,
    }),
    basicDirectional: m('Toxic Dust Cloud', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 9.2, vfx: 'cloud', vfxColor: 0xc8c09a,
      onHit: {
        slow: 2200,
        attackSlow: { mult: 0.72, ms: 2200 },
        coat: 'Toxic Cough', coatMs: 2200,
      },
      projectileSpeed: 360, projectileRadius: 18, projectileLife: 480,
      baseKnockback: 28, knockbackGrowth: 0.35, duration: 200, cooldown: 670,
    }),
    specialDefense: m('Flame Retardant', {
      immune: [H], cleanse: ['burn'],
      duration: 640, cooldown: 840, vfx: 'shield', vfxColor: 0xd0d4d8,
    }),
    specialDirectional: m('Stibnite Needles', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 7.2, fan: 4, fanSpread: 200, oneArt: true,
      vfx: 'spark', vfxColor: 0xb8bcc2,
      projectileSpeed: 500, projectileRadius: 5, projectileLife: 360,
      baseKnockback: 50, knockbackGrowth: 1.2, duration: 200, cooldown: 1030,
    }),
  },

  sam: {
    basicCharge: m('Heatproof Magnet', {
      kind: 'dash', type: K, damage: 11.3, type2: H, damage2: 9, chargeDamageMult: 1.3, chargeDashMult: 1.15,
      maxChargeMs: 800, dashSpeed: 500, rangeW: 88, rangeH: 70, vfx: 'dash', vfxColor: 0xffb070,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 260, cooldown: 1400,
    }),
    basicDirectional: melee('Samarskite Smash', {
      type: K, damage: 7, rangeW: 74, vfx: 'strike', vfxColor: 0xc4a070,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 210, cooldown: 600,
    }),
    specialDefense: m('Mine Shaft Duck', {
      phase: 'overhead', phaseRetort: { type: K, damage: 17.9, knockback: 80, growth: 1.4 },
      shrink: 0.5,
      duration: 420, cooldown: 1020, vfx: 'shield', vfxColor: 0x8a7048,
    }),
    specialDirectional: m('Pickaxe Toss', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 17.1, returns: true, vfx: 'strike', vfxColor: 0xb89870,
      projectileSpeed: 440, projectileRadius: 10, projectileLife: 780,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 200, cooldown: 1030,
    }),
  },

  sandy: {
    basicCharge: m('Tin Cry', {
      kind: 'burst', type: K, damage: SANDY.cryDamage * 2.37, chargeDamageMult: 1.35, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: SANDY.cryRadius, coneDeg: SANDY.cryConeDeg, offsetX: 48,
      onHit: { kineticTaken: { mult: SANDY.kinTaken, ms: SANDY.kinTakenMs, coat: 'Tin Cry' } },
      vfx: 'gust', vfxColor: 0xe8eef2, ...fx('Tin Cry'),
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Sledge Slam', {
      type: K, damage: 8, rangeW: 86, vfx: 'strike', vfxColor: 0xd8dee6, ...fx('Sledge Slam'),
      baseKnockback: SANDY.sledgeKnockback, knockbackGrowth: SANDY.sledgeGrowth,
      duration: 220, cooldown: 640,
    }),
    specialDefense: m('Tin Pest', {
      immune: [K], passThrough: true, rooted: true,
      takenWhile: { heat: SANDY.pestHeat, chemical: SANDY.pestChem },
      duration: 560, cooldown: 900, vfx: 'shield', vfxColor: 0xc8ced4, ...fx('Tin Pest'),
    }),
    specialDirectional: m('Tin Can Kick', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 17, ground: true,
      can: { floor: SANDY.canFloorBounces, walls: SANDY.canWallRicochets, bounce: SANDY.canBounce },
      vfx: 'strike', vfxColor: 0xd0d6dc, ...fx('Tin Can Kick'),
      projectileSpeed: 420, projectileRadius: 10, projectileLife: 1600,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 200, cooldown: 1030,
    }),
  },

  selena: {
    basicCharge: m('Photoconductor', {
      kind: 'beam', type: E, damage: 19.6, chargeDamageMult: 1.4, chargeLengthMult: 1.25,
      maxChargeMs: 800, beamLen: 210, beamThick: 16, vfx: 'laser', vfxColor: 0xfff0a0,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Crescent Kick', {
      type: K, damage: 8, rangeW: 74, vfx: 'strike', vfxColor: 0xf0e6c0,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 200, cooldown: 650,
    }),
    specialDefense: m('Photocopy', {
      immune: [K, H, E, C, R], copyMove: true,
      duration: 460, cooldown: 1000, vfx: 'shield', vfxColor: 0xfff6d8,
    }),
    specialDirectional: m('Moonbeam', {
      kind: 'beam', type: E, damage: 18.2, beamLen: 160, beamThick: 18, vfx: 'laser', vfxColor: 0xf4f0ff,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 180, cooldown: 1030,
    }),
  },

  sterling: {
    basicCharge: m('Bone Seeker', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 20.5, homing: 6,
      chargeDamageMult: 1.3, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xff4a3a,
      projectileSpeed: 340, projectileRadius: 10, projectileLife: 900,
      baseKnockback: 74.2, knockbackGrowth: 1.38, duration: 200, cooldown: 1360,
    }),
    basicDirectional: melee('Night-Glow Hook', {
      type: K, damage: 6.4,
      onHit: { mark: 'glow', markMs: 4000, glow: { dps: 1, every: 1000, ms: 4000 } },
      rangeW: 74, vfx: 'strike', vfxColor: 0x7dffe8,
      baseKnockback: 106, knockbackGrowth: 2.12, duration: 200, cooldown: 580,
    }),
    specialDefense: m('Road Flare', {
      kind: 'block', blockReduction: 0.35, noKnockback: true, onStruck: { blind: 500, miss: true },
      zone: { type: H, damage: 1.06, ms: 700, radius: 42, tick: 420, follow: true, color: 0xff4a2a, knockback: 17, growth: 0.21 },
      duration: 600, cooldown: 860, vfx: 'fire', vfxColor: 0xff4a2a,
    }),
    specialDirectional: m('Crimson Rocket', {
      kind: 'projectile', shotEnd: 'despawn', type: H, damage: 9.7, type2: K, damage2: 7.7, vfx: 'fire', vfxColor: 0xff3040,
      projectileSpeed: 480, projectileRadius: 9, projectileLife: 420,
      baseKnockback: 116.6, knockbackGrowth: 2.12, duration: 200, cooldown: 1020,
    }),
  },

  terra: {
    basicCharge: m('Sonar Pulse', {
      kind: 'beam', type: K, damage: 19, breakPhase: true, onHit: { reveal: true },
      stageWide: true,
      chargeDamageMult: 1.3, chargeLengthMult: 1.15, maxChargeMs: 800,
      beamLen: 520, beamThick: 16, vfx: 'gust', vfxColor: 0xb8f0c8,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Flex Punch', {
      type: K, damage: 8, sweetSpot: 3, rangeW: 76, vfx: 'strike', vfxColor: 0x7dcea0,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 210, cooldown: 660,
    }),
    specialDefense: m('Floor Speaker', {
      retort: { type: K, damage: 17.9, knockback: 170, growth: 1.8 },
      retortBurst: true,
      duration: 480, cooldown: 1020, vfx: 'shield', vfxColor: 0x9ad7b0,
    }),
    specialDirectional: m('Green Phosphor Bolt', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 18.3, vfx: 'spark', vfxColor: 0x8ef07a,
      projectileSpeed: 480, projectileRadius: 8, projectileLife: 440,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 200, cooldown: 1030,
    }),
  },

  tessa: {
    basicCharge: m('Peltier Punch', {
      type: H, damage: 22, chargeDamageMult: 1.25, maxChargeMs: 800,
      buff: { heatTaken: 0.6, ms: 2000 }, rangeW: 70, rangeH: 48, vfx: 'fire', vfxColor: 0xff8844,
      baseKnockback: 90, knockbackGrowth: 1.7, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Garlic Breath', {
      type: C, damage: 6, onHit: { interrupt: 220 }, rangeW: 72, rangeH: 46, vfx: 'cloud', vfxColor: 0xe8e0c0,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 180, cooldown: 540,
    }),
    specialDefense: m('Phase Rewrite', {
      kind: 'shield', healOnBlock: 7,
      duration: 640, cooldown: 980, vfx: 'shield', vfxColor: 0xd8d0ea,
    }),
    specialDirectional: m('Tellus Tremor', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 16.4, floor: true, vfx: 'strike', vfxColor: 0xc4b49a,
      projectileSpeed: 340, projectileRadius: 16, projectileLife: 900,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 220, cooldown: 1030,
    }),
  },

  tex: {
    basicCharge: m('Metastable Flash', {
      kind: 'burst', type: R, damage: 21.3, chargeDamageMult: 1.3, chargeRadiusMult: 1.15,
      maxChargeMs: 900, radius: 64, vfx: 'spark', vfxColor: 0xe8ffb0,
      baseKnockback: 70, knockbackGrowth: 1.3, duration: 240, cooldown: 1410,
    }),
    basicDirectional: melee('Tracer Lasso', {
      type: K, damage: 4.8, type2: R, damage2: 4.8, breakPhase: true,
      onHit: { mark: 'tracer', markMs: 10000, reveal: true }, rangeW: 104, vfx: 'spark', vfxColor: 0xd4ff9a,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 210, cooldown: 680,
    }),
    specialDefense: m('Quick Draw', {
      kind: 'counter', counterType: R, counterDamage: 18,
      counterKnockback: 80, counterKnockbackGrowth: 1.4,
      duration: 480, cooldown: 1020, vfx: 'shield', vfxColor: 0xe4f0c8,
    }),
    specialDirectional: m('Gamma Camera', {
      kind: 'beam', type: R, damage: 18.4, hitMarked: 'tracer', beamLen: 210, beamThick: 28,
      vfx: 'laser', vfxColor: 0xeeffb0,
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 180, cooldown: 1040,
    }),
  },

  thule: {
    basicCharge: m('Ultima Thule', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 20.3,
      growWithDistance: { reach: 1000, mult: 1.85, stretch: 1.45 },
      chargeDamageMult: 1.25,
      maxChargeMs: 800, vfx: 'spark', vfxColor: 0xc8e6ff,
      projectileSpeed: 760, projectileRadius: 18, projectileLife: 2400,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Blue Glow Jab', {
      type: K, damage: 7, hitsRevealed: true,
      onHit: { revealMs: 500, revealColor: 0x8ec8ff },
      rangeW: 70, vfx: 'strike', vfxColor: 0x8ec8ff,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 180, cooldown: 600,
    }),
    specialDefense: m('Aurora Veil', {
      kind: 'block', blockReduction: 0.52, noKnockback: true,
      onStruck: { miss: true, dazzleCling: true },
      duration: 600, cooldown: 840, vfx: 'shield', vfxColor: 0xb8f0c8,
    }),
    specialDirectional: m('Handheld X-Ray', {
      kind: 'beam', type: R, damage: 18.3,
      // Painted tip sits 480 px past the nozzle (cell x 520, origin x 40). Draw that tip out to 520.
      beamLen: 520, beamThick: 260, beamArtPx: 480, beamCap: 520,
      vfx: 'laser', vfxColor: 0xd0e8ff,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 240, cooldown: 1030,
    }),
  },

  xander: {
    basicCharge: m('Ion Thruster', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 11.6, type2: H, damage2: 8.7, chargeDamageMult: 1.3,
      maxChargeMs: 800, recoilSelf: 240, vfx: 'spark', vfxColor: 0x7ec8ff,
      projectileSpeed: 520, projectileRadius: 16, projectileLife: 900,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 220, cooldown: 1350,
    }),
    basicDirectional: melee('Arc Lamp Jab', {
      type: K, damage: 4.2, type2: E, damage2: 5.3, onHit: { blind: 280 }, rangeW: 70, vfx: 'spark', vfxColor: 0xc8e4ff,
      baseKnockback: 63.6, knockbackGrowth: 1.27, duration: 180, cooldown: 1000, string: { hits: 2, gap: 290 },
    }),
    specialDefense: m('Anesthesia', {
      // Anesthesia puts the attacker to sleep (stat rework): no damage.
      stunChance: 0.5, retort: { type: C, damage: 0, knockback: 21.2, growth: 0.32, sleep: true },
      duration: 620, cooldown: 900, vfx: 'shield', vfxColor: 0xd8e8ff,
    }),
    specialDirectional: m('Xenon Strobe', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 16.8, onHit: { slow: 500 },
      vfx: 'spark', vfxColor: 0x9ad0ff,
      projectileSpeed: 540, projectileRadius: 14, projectileLife: 700,
      baseKnockback: 42.4, knockbackGrowth: 0.85, duration: 180, cooldown: 970,
    }),
  },

  yara: {
    basicCharge: m('Maglev Launch', {
      kind: 'dash', type: K, damage: YARA.glideDamage * 2.71,
      chargeDamageMult: YARA.glideDamageMult, chargeDashMult: YARA.glideDistanceMult,
      maxChargeMs: YARA.maxChargeMs, dashSpeed: YARA.glideSpeed,
      floatRise: YARA.risePx, aimOnRelease: true, passThrough: true, hyperArmor: true,
      rangeW: 96, rangeH: 70, vfx: 'dash', vfxColor: 0xe8eef8, ...fx('Maglev Launch'),
      baseKnockback: 112, knockbackGrowth: 2.1, duration: YARA.glideDuration, cooldown: 1380,
    }),
    basicDirectional: melee('Garnet Cut', {
      type: K, damage: 6, rangeW: 74, vfx: 'strike', vfxColor: 0xe07070, ...fx('Garnet Cut'),
      baseKnockback: 124, knockbackGrowth: 2.35, duration: 200, cooldown: 540,
    }),
    specialDefense: m('Flux Pin', {
      pinProjectiles: { front: YARA.pinFront, tall: YARA.pinTall }, pinFreeze: true,
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xd8e4ff, ...fx('Flux Pin'),
    }),
    specialDirectional: m('Ytterby Mine', {
      kind: 'mine', type: K, damage: YARA.mineShardDamage * 3.07,
      mineArmMs: YARA.mineArmMs, mineMax: YARA.mineMax, mineRange: YARA.mineRange,
      shardSpeed: YARA.mineShardSpeed, projectileLife: YARA.mineShardLife, projectileRadius: 6,
      vfx: 'strike', vfxColor: 0xf0e6c8, ...fx('Ytterby Mine'),
      baseKnockback: 100, knockbackGrowth: 2.0, duration: 200, cooldown: 1040,
    }),
  },

  yvette: {
    basicCharge: m('Lattice Clock', {
      kind: 'burst', type: K, damage: 27.5, chargeDamageMult: 1,
      clockWindow: { period: YVETTE.clockPeriod, slack: YVETTE.clockSlack, mult: YVETTE.clockMult, fromStart: true },
      maxChargeMs: YVETTE.clockMaxChargeMs, radius: 50, vfx: 'spark', vfxColor: 0xe8e0ff, ...fx('Lattice Clock'),
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Stress Gauge', {
      type: K, damage: 9, percentScale: { cap: YVETTE.stressCap }, rangeW: 74,
      vfx: 'strike', vfxColor: 0xd0c4e8, ...fx('Stress Gauge'),
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 200, cooldown: 660,
    }),
    specialDefense: m('Seismic Read', {
      blockGround: true, seismicOnly: true, counterRange: YVETTE.counterRange,
      counterType: K, counterDamage: YVETTE.counterDamage,
      counterKnockback: 110, counterKnockbackGrowth: 1.5,
      duration: 460, cooldown: 1010, vfx: 'shield', vfxColor: 0xc8c0d8, ...fx('Seismic Read'),
    }),
    specialDirectional: m('Fiber Laser', {
      kind: 'beam', type: H, damage: 18.3, bonusVsMetal: YVETTE.metalBonus, beamLen: 210, beamThick: 14,
      vfx: 'laser', vfxColor: 0xffd0a0, ...fx('Fiber Laser'),
      baseKnockback: 60, knockbackGrowth: 1.2, duration: 180, cooldown: 1030,
    }),
  },

  zane: {
    basicCharge: m('Hot-Dip Galvanize', {
      kind: 'burst', type: H, damage: 21.2, chargeDamageMult: 1.3, chargeRadiusMult: 1.15,
      maxChargeMs: 850, radius: 56, buff: { chemTaken: 0.62, kineticTaken: 0.7, ms: 2400, coat: 'Hot-Dip Galvanize' },
      vfx: 'fire', vfxColor: 0xd8dce2,
      baseKnockback: 70, knockbackGrowth: 1.4, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Brass Knuckles', {
      type: K, damage: 8, rangeW: 68, vfx: 'strike', vfxColor: 0xe0c070,
      baseKnockback: 120, knockbackGrowth: 2.2, duration: 200, cooldown: 660,
    }),
    specialDefense: m('Sacrificial Anode', {
      absorbTypes: [C, E], regrow: 2400, lockAttackMs: 10000,
      drain: { damage: 1, every: 1000, type: C },
      duration: 700, cooldown: 500, vfx: 'shield', vfxColor: 0xd5d3ce,
    }),
    specialDirectional: m('Fume Fever', {
      kind: 'burst', type: C, damage: 17.2, gas: true, radius: 64, onHit: { slow: 480 }, vfx: 'cloud', vfxColor: 0xd8dde4,
      baseKnockback: 50, knockbackGrowth: 1.0, duration: 200, cooldown: 990,
    }),
  },

  pat: {
    basicCharge: m('Proto Daughter', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 19.4, homing: 7, chargeDamageMult: 1.4,
      maxChargeMs: 800, vfx: 'spark', vfxColor: 0x9dff7a,
      projectileSpeed: 300, projectileRadius: 10, projectileLife: 900,
      baseKnockback: 90, knockbackGrowth: 1.6, duration: 220, cooldown: 1390,
    }),
    basicDirectional: melee('Sediment Layer', {
      type: K, damage: 7, onHit: { slow: 640, slowStack: true, slowCap: 4 }, rangeW: 74, vfx: 'strike', vfxColor: 0xd8c48a,
      baseKnockback: 80, knockbackGrowth: 1.5, duration: 200, cooldown: 580,
    }),
    specialDefense: m('Deep Time Rewind', {
      rewind: true, duration: 800, cooldown: 1100, vfx: 'shield', vfxColor: 0xc8e0ff,
    }),
    specialDirectional: m('Twin Hazard Bolt', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 9.3, type2: R, damage2: 9.3, vfx: 'cloud', vfxColor: 0xc57bff,
      projectileSpeed: 460, projectileRadius: 9, projectileLife: 520,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 200, cooldown: 1040,
    }),
  },

  uri: {
    basicCharge: m('Chain Reaction', {
      kind: 'burst', type: R, damage: 5.2, type2: H, damage2: 3.9, chargeDamageMult: 1.45, chargeRadiusMult: 1.25,
      maxChargeMs: 900, radius: 72, vfx: 'fire', vfxColor: 0xffe08a,
      chain: { count: 2, fromHits: true, jump: true, reach: 280, scale: 0.55, delay: 140, radiusScale: 0.62 },
      baseKnockback: 94.6, knockbackGrowth: 1.55, duration: 260, cooldown: 1420,
    }),
    basicDirectional: m('Penetrator Dart', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 7, breaksBlock: true, vfx: 'strike', vfxColor: 0xe8a060,
      projectileSpeed: 680, projectileRadius: 8, projectileLife: 420,
      baseKnockback: 100, knockbackGrowth: 1.7, duration: 180, cooldown: 660,
    }),
    specialDefense: m('DU Plating', {
      kind: 'block', onlyReduce: [K], blockReduction: 0.82, noKnockback: true,
      duration: 700, cooldown: 860, vfx: 'shield', vfxColor: 0xc8c0a0,
    }),
    specialDirectional: m('Yellowcake Lob', {
      kind: 'projectile', shotEnd: 'linger', type: R, damage: 9.9, type2: C, damage2: 8.2, explodeOnly: true, explodeRadius: 56,
      landBurst: true, lob: 480, vfx: 'cloud', vfxColor: 0xffe14a,
      dropZone: {
        name: 'Yellowcake Lob', type: R, damage: 1.2, type2: C, damage2: 0.9,
        ms: 1600, radius: 52, tick: 400, knockback: 0, growth: 0, color: 0xffe14a,
        feet: true, sheet: true, useHold: true,
      },
      projectileSpeed: 340, projectileRadius: 12, projectileLife: 1100,
      baseKnockback: 77.4, knockbackGrowth: 1.38, duration: 220, cooldown: 1020,
    }),
  },

  neptune: {
    basicCharge: m('Mad Science Flask', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 10.5, type2: R, damage2: 8.7,
      explodeOnly: true, explodeRadius: 54, hitRadius: 54, landBurst: true, lob: 420,
      chargeDamageMult: 1.45, chargeRadiusMult: 1.35,
      maxChargeMs: 900, vfx: 'cloud', vfxColor: 0x3ec8c0,
      projectileSpeed: 440, projectileRadius: 12, projectileLife: 900,
      baseKnockback: 110, knockbackGrowth: 1.8, duration: 240, cooldown: 1420,
    }),
    basicDirectional: melee('Trident Thrust', {
      type: K, damage: 1.8, type2: R, damage2: 1.8, multiHit: 3, rangeW: 86, vfx: 'strike', vfxColor: 0x9ad0ff,
      baseKnockback: 85.4, knockbackGrowth: 1.46, duration: 240, cooldown: 720,
    }),
    specialDefense: m('Lab Coat Shield', {
      immune: [R, C],
      duration: 760, cooldown: 940, vfx: 'shield', vfxColor: 0xd8fff4,
    }),
    specialDirectional: m('Breeder Seed', {
      kind: 'projectile', shotEnd: 'linger', type: H, damage: 9, type2: R, damage2: 7.7, explodeRadius: 58,
      lob: 400, landBurst: true, hatch: { ms: 1000 }, vfx: 'fire', vfxColor: 0xffb45a,
      projectileSpeed: 300, projectileRadius: 10, projectileLife: 1600,
      baseKnockback: 122, knockbackGrowth: 2.07, duration: 220, cooldown: 970,
    }),
  },

  pluto: {
    basicCharge: m('Critical Mass', {
      kind: 'burst', type: H, damage: 6.8, type2: R, damage2: 6.8, chargeDamageMult: 2.05, chargeRadiusMult: 1.4,
      maxChargeMs: 900, radius: 64, critWindow: true, vfx: 'supernova', vfxColor: 0xffd24a,
      overhold: { grace: 240, damage: 18.8, damage2: 18.8, radius: 86, scale: 0.7 },
      baseKnockback: 173.6, knockbackGrowth: 2.98, duration: 260, cooldown: 1420,
    }),
    basicDirectional: melee('Decay-Heat Palm', {
      type: H, damage: 5.3, type2: R, damage2: 5.3, rangeW: 70, vfx: 'fire', vfxColor: 0xffb060,
      baseKnockback: 124, knockbackGrowth: 2.23, duration: 200, cooldown: 720,
    }),
    specialDefense: m('Demoted', {
      phase: 'overhead', shrink: 0.5, duration: 760, cooldown: 900, vfx: 'shield', vfxColor: 0xd0c8b0,
    }),
    specialDirectional: m('Plutonium Pit', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 9, type2: R, damage2: 7, explodeOnly: true, explodeRadius: 50,
      lob: 540, landBurst: true, vfx: 'spark', vfxColor: 0xff7040,
      projectileSpeed: 280, projectileRadius: 16, projectileLife: 1200,
      baseKnockback: 160, knockbackGrowth: 2.6, duration: 240, cooldown: 940,
    }),
  },

  amy: {
    basicCharge: m('Alarm Blare', {
      kind: 'burst', type: K, damage: 18.5, onHit: { stun: 280 }, stunChance: 0.5, chargeDamageMult: 1.35, chargeRadiusMult: 1.3,
      maxChargeMs: 750, radius: 86, vfx: 'gust', vfxColor: 0xfff2a8,
      baseKnockback: 111.6, knockbackGrowth: 1.86, duration: 240, cooldown: 1300,
    }),
    basicDirectional: melee('Test Button', {
      type: K, damage: 5.2, type2: R, damage2: 5.2, rangeW: 64, vfx: 'spark', vfxColor: 0xd0ff9a,
      baseKnockback: 99.2, knockbackGrowth: 1.74, duration: 160, cooldown: 720,
    }),
    specialDefense: m('Ion Chamber', {
      immune: [C], absorbState: 'gas', fuelType: K, fuelDamage: 2.6,
      retort: { type: K, damage: 18, knockback: 272.8, growth: 2.98 },
      duration: 720, cooldown: 1020, vfx: 'shield', vfxColor: 0xe8ffb0,
    }),
    specialDirectional: m('Ionizing Beam', {
      kind: 'beam', type: R, damage: 18.4,
      // Painted beam spans x 40–480 of the 640 cell. Cap the hit at that span.
      beamLen: 440, beamThick: 28, beamArtPx: 440, beamCap: 440,
      vfx: 'laser', vfxColor: 0x9ad0ff,
      baseKnockback: 78, knockbackGrowth: 1.36, duration: 220, cooldown: 1040,
    }),
  },

  curie: {
    basicCharge: m('Double Nobel', {
      kind: 'burst', type: R, damage: 10.3, chargeDamageMult: 1.35, chargeRadiusMult: 1.15,
      maxChargeMs: 800, radius: 58, vfx: 'spark', vfxColor: 0xfff6c8,
      chain: {
        count: 1, delay: 160, type: C, damage: 11.8, radiusScale: 0.9, useImpact: true,
        knockback: 122.4, growth: 2.18,
      },
      baseKnockback: 122.4, knockbackGrowth: 2.18, duration: 240, cooldown: 1410,
    }),
    basicDirectional: melee('Pocket Vial', {
      type: K, damage: 5.7, type2: R, damage2: 4.7, rangeW: 68, vfx: 'spark', vfxColor: 0xe8ffb0,
      baseKnockback: 122.4, knockbackGrowth: 2.18, duration: 190, cooldown: 720,
    }),
    specialDefense: m('Spectrometer Scan', {
      kind: 'block', blockReduction: 0.7, scanWeak: true, scanDamage: 10.4,
      duration: 560, cooldown: 960, vfx: 'shield', vfxColor: 0xd8f0ff,
    }),
    specialDirectional: m('Pitchblende Toss', {
      kind: 'projectile', shotEnd: 'linger', type: R, damage: 18, explodeOnly: true, explodeRadius: 48,
      landBurst: true, lob: 460, vfx: 'cloud', vfxColor: 0xc8e070,
      dropZone: {
        name: 'Pitchblende Toss', type: R, damage: 2.37,
        ms: 1400, radius: 46, tick: 360, knockback: 0, growth: 0, color: 0xc8e070,
        feet: true, sheet: true, useHold: true,
      },
      projectileSpeed: 380, projectileRadius: 11, projectileLife: 1000,
      baseKnockback: 108.8, knockbackGrowth: 1.9, duration: 210, cooldown: 1020,
    }),
  },

  burke: {
    basicCharge: m('Bombarded Target', {
      kind: 'burst', type: R, damage: 21.4, chargeDamageMult: 1.3, storeHits: { per: 4, cap: 20 },
      maxChargeMs: 1000, radius: 70, vfx: 'spark', vfxColor: 0xffd24a,
      baseKnockback: 108, knockbackGrowth: 1.84, duration: 240, cooldown: 1410,
    }),
    basicDirectional: melee('Golden Bear Swipe', {
      type: K, damage: 8.6, rangeW: 82, vfx: 'strike', vfxColor: 0xf0c84a,
      baseKnockback: 129.6, knockbackGrowth: 2.16, duration: 210, cooldown: 640,
    }),
    specialDefense: m('Hot Cell', {
      blocks: [K, H, E, C, R], crackAfterHits: 4,
      duration: 900, cooldown: 1000, vfx: 'shield', vfxColor: 0xd8d4c8,
    }),
    specialDirectional: m('Express Shipment', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 17.3, fadeIfMiss: true, vfx: 'spark', vfxColor: 0xfff0a0,
      projectileSpeed: 680, projectileRadius: 8, projectileLife: 260,
      baseKnockback: 151.2, knockbackGrowth: 2.59, duration: 180, cooldown: 990,
    }),
  },

  cali: {
    basicCharge: m('Neutron Kickstart', {
      kind: 'burst', type: R, damage: 20.6, chargeDamageMult: 1.35, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: 68, vfx: 'spark', vfxColor: 0xc8ff9a,
      buff: { ms: 2800, bonus: { type: R, damage: 3.6, hits: 3, name: 'Neutron Kickstart' } },
      baseKnockback: 72, knockbackGrowth: 1.26, duration: 240, cooldown: 1410,
    }),
    basicDirectional: melee('Surf\'s Up', {
      kind: 'dash', type: K, damage: 7.2, dashSpeed: 540, rangeW: 96, rangeH: 64, vfx: 'gust', vfxColor: 0x8ecfff,
      baseKnockback: 108, knockbackGrowth: 1.8, duration: 260, cooldown: 650,
    }),
    specialDefense: m('Stunt Double', {
      absorbTypes: [K, H, E, C, R], stuntDouble: true,
      duration: 640, cooldown: 1100, vfx: 'shield', vfxColor: 0xfff0c8,
    }),
    specialDirectional: m('Prospecting Probe', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 18.5, bonusVsMetal: 1.45, bonusVsId: { aurelius: 1.8 },
      vfx: 'spark', vfxColor: 0xe8ff9a,
      projectileSpeed: 620, projectileRadius: 9, projectileLife: 480,
      baseKnockback: 63, knockbackGrowth: 1.17, duration: 180, cooldown: 1040,
    }),
  },

  einstein: {
    basicCharge: m('Mass-Energy', {
      kind: 'burst', type: H, damage: 9.2, type2: R, damage2: 9.2, chargeDamageMult: 1.5, chargeRadiusMult: 1.3,
      maxChargeMs: 850, radius: 74, hitRadius: 74, vfx: 'supernova', vfxColor: 0xfff6d0,
      selfDamage: { type: R, damage: 2, withCharge: true, noFlinch: true },
      baseKnockback: 193.49, knockbackGrowth: 3.27, duration: 260, cooldown: 1400,
    }),
    basicDirectional: melee('Time Dilation', {
      type: K, damage: 9.39, onHit: { slow: 520, slowCling: true }, rangeW: 72, vfx: 'strike', vfxColor: 0xd8e8ff,
      baseKnockback: 104.19, knockbackGrowth: 1.78, duration: 190, cooldown: 680,
    }),
    specialDefense: m('Thought Experiment', {
      replay: true, counterKnockback: 223.26, counterKnockbackGrowth: 2.93,
      duration: 480, cooldown: 1000, vfx: 'shield', vfxColor: 0xe8e0ff,
    }),
    specialDirectional: m('Fallout Rain', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 5.4, rain: 5, vfx: 'cloud', vfxColor: 0xd8ffb0,
      projectileSpeed: 80, projectileRadius: 8, projectileLife: 900,
      baseKnockback: 59.54, knockbackGrowth: 1.04, duration: 220, cooldown: 1030,
    }),
  },

  fermi: {
    basicCharge: m('Chicago Pile', {
      kind: 'burst', type: R, damage: 7.2, type2: H, damage2: 6.3, chargeDamageMult: 1.5, chargeRadiusMult: 1.35,
      maxChargeMs: 1000, radius: 80, vfx: 'fire', vfxColor: 0xffd0a0,
      baseKnockback: 90, knockbackGrowth: 1.53, duration: 260, cooldown: 1110,
    }),
    basicDirectional: m('Slow Neutron Punch', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 6.3, type2: R, damage2: 4.5, slowHit: true, vfx: 'spark', vfxColor: 0xfff2c8,
      projectileSpeed: 150, projectileRadius: 12, projectileLife: 700,
      baseKnockback: 81, knockbackGrowth: 1.44, duration: 220, cooldown: 730,
    }),
    specialDefense: m('Exclusion Zone', {
      phase: true, outline: true,
      phaseRetort: { type: K, damage: 17.9, knockback: 234, growth: 2.16 },
      duration: 640, cooldown: 1020, vfx: 'shield', vfxColor: 0xe8e8ff,
    }),
    specialDirectional: m('Fermi Paradox', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 18.3, unseen: true, stageBounce: true, vfx: 'spark', vfxColor: 0xd0e0ff,
      projectileSpeed: 520, projectileRadius: 16, projectileLife: 1700,
      baseKnockback: 72, knockbackGrowth: 1.26, duration: 220, cooldown: 1030,
    }),
  },

  mendel: {
    basicCharge: m('Dream of the Table', {
      kind: 'buff', doze: true, maxChargeMs: 900, vfx: 'spark', vfxColor: 0xfff6d8,
      buff: { ms: 4000, kineticTaken: 0.7, showBoost: true, bonus: { type: K, damage: 4.6, hits: 4, name: 'Dream of the Table' } },
      duration: 200, cooldown: 1100,
    }),
    basicDirectional: melee('One Atom at a Time', {
      type: K, damage: 2.3, multiHit: 5, rangeW: 64, vfx: 'strike', vfxColor: 0xe8e0c8,
      baseKnockback: 46, knockbackGrowth: 0.8, duration: 260, cooldown: 760,
    }),
    specialDefense: m('Empty Square', {
      phase: true, swallow: true, duration: 560, cooldown: 900, vfx: 'shield', vfxColor: 0xf4f0e0,
    }),
    specialDirectional: m('Group Drop', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 9.2, type2: R, damage2: 6.9, fromAbove: true, dropOn: true,
      skyHeight: 280, fallSpeed: 460, vfx: 'strike', vfxColor: 0xe0d8c0,
      projectileSpeed: 40, projectileRadius: 16, projectileLife: 700,
      baseKnockback: 161, knockbackGrowth: 2.53, duration: 220, cooldown: 940,
    }),
  },

  noble: {
    basicCharge: m('Nitroglycerin Vial', {
      kind: 'burst', type: K, damage: 16.2, chargeDamageMult: 1.7, chargeRadiusMult: 1.25,
      maxChargeMs: 800, radius: 60, vfx: 'spark', vfxColor: 0xffe08a,
      baseKnockback: 153.4, knockbackGrowth: 2.6, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Medal Swing', {
      type: K, damage: 9.9, rangeW: 92, vfx: 'strike', vfxColor: 0xf0d24a,
      baseKnockback: 188.8, knockbackGrowth: 3.54, duration: 210, cooldown: 700,
    }),
    specialDefense: m('Peace Prize', {
      kind: 'counter', counterDamage: 0, counterType: K, counterKnockback: 0, counterKnockbackGrowth: 0,
      truce: { ms: 480, push: 220 },
      duration: 420, cooldown: 1100, vfx: 'shield', vfxColor: 0xfff6d0,
    }),
    specialDirectional: m('Carbon Bombardment', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 4.6, salvo: 6, salvoGap: 75,
      vfx: 'spark', vfxColor: 0xd8d8e0,
      projectileSpeed: 680, projectileRadius: 9, projectileLife: 360,
      baseKnockback: 141.6, knockbackGrowth: 2.36, duration: 180, cooldown: 1030,
    }),
  },

  lars: {
    basicCharge: m('Cyclotron Beam', {
      kind: 'beam', type: R, damage: 19.2, chargeDamageMult: 1.45, chargeLengthMult: 1.4,
      maxChargeMs: 850, beamLen: 220, beamThick: 16, beamArtPx: 552, beamCap: 460, vfx: 'laser', vfxColor: 0xc8f0ff,
      baseKnockback: 68.64, knockbackGrowth: 1.2, duration: 200, cooldown: 1410,
    }),
    basicDirectional: melee('Spiral Fist', {
      type: K, damage: 6.82, rangeW: 74, vfx: 'strike', vfxColor: 0xd0e8ff,
      baseKnockback: 94.38, knockbackGrowth: 1.63, duration: 200, cooldown: 570,
    }),
    specialDefense: m('Dee Plates', {
      reflectProjectiles: true, spiralReflect: true, duration: 640, cooldown: 860, vfx: 'shield', vfxColor: 0xd8e8ff,
    }),
    specialDirectional: m('Atom Smasher', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 9.8, type2: K, damage2: 8.6, vfx: 'spark', vfxColor: 0xe8f4ff,
      projectileSpeed: 560, projectileRadius: 9, projectileLife: 480,
      baseKnockback: 120.12, knockbackGrowth: 2.06, duration: 190, cooldown: 1040,
    }),
  },

  duke: {
    basicCharge: m('Long Reign', {
      kind: 'burst', type: K, damage: 9.4, type2: R, damage2: 7.52, perSecond: 0.66, perSecondCap: 9.4,
      chargeDamageMult: 1.25, maxChargeMs: 700, radius: 62, vfx: 'spark', vfxColor: 0xfff2c0,
      baseKnockback: 159.8, knockbackGrowth: 3.38, duration: 240, cooldown: 1150,
    }),
    basicDirectional: melee('Ducal Cleave', {
      type: K, damage: 5.6, type2: R, damage2: 4.2, rangeW: 96, rangeH: 56, vfx: 'strike', vfxColor: 0xffe8a0,
      baseKnockback: 178.6, knockbackGrowth: 3.95, duration: 320, cooldown: 690,
    }),
    specialDefense: m('Fission Split', {
      phase: true, fissionSplit: true,
      zone: { type: R, damage: 3.76, ms: 500, radius: 70, tick: 200, color: 0xc8ff9a },
      duration: 480, cooldown: 980, vfx: 'shield', vfxColor: 0xd8ffc0,
    }),
    specialDirectional: m('Heavy Ion Bolt', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 11.28, type2: R, damage2: 8.46, vfx: 'spark', vfxColor: 0xfff6c0,
      projectileSpeed: 540, projectileRadius: 11, projectileLife: 520,
      baseKnockback: 188, knockbackGrowth: 4.14, duration: 200, cooldown: 1090,
    }),
  },

  hoss: {
    basicCharge: m('Stampede', {
      kind: 'dash', type: K, damage: 11, type2: R, damage2: 8, chargeDamageMult: 1.25, chargeDashMult: 1.2,
      maxChargeMs: 700, dashSpeed: 780, hyperArmor: true, rangeW: 110, rangeH: 80, vfx: 'dash', vfxColor: 0xffe0a0,
      baseKnockback: 180, knockbackGrowth: 3.8, duration: 320, cooldown: 1250,
    }),
    basicDirectional: melee('Dense Shoulder', {
      type: K, damage: 12, hyperArmor: true, rangeW: 84, rangeH: 56, vfx: 'strike', vfxColor: 0xe8d8c0,
      baseKnockback: 180, knockbackGrowth: 4.2, duration: 240, cooldown: 780,
    }),
    specialDefense: m('Doubly Magic', {
      kind: 'block', blockReduction: 0.78, noKnockback: true,
      duration: 700, cooldown: 1000, vfx: 'shield', vfxColor: 0xf0e8d0,
    }),
    specialDirectional: m('Lucky Horseshoe', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 17.4, luckyEvery: 4,
      lob: 280, landBurst: true, explodeOnly: true, explodeRadius: 64,
      vfx: 'strike', vfxColor: 0xffd24a,
      projectileSpeed: 380, projectileRadius: 12, projectileLife: 900,
      baseKnockback: 190, knockbackGrowth: 4.0, duration: 200, cooldown: 1000,
    }),
  },

  dash: {
    basicCharge: m('Half-Life Sprint', {
      kind: 'dash', type: K, damage: 9.9, type2: R, damage2: 7.2, hyperArmor: true,
      chargeDamageMult: 1.2, chargeDashMult: 1.35, maxChargeMs: 500, dashSpeed: 880, rangeW: 90, rangeH: 70, vfx: 'dash', vfxColor: 0xd0f0ff,
      baseKnockback: 158.4, knockbackGrowth: 3.52, duration: 420, cooldown: 1120,
    }),
    basicDirectional: melee('Blink Kick', {
      kind: 'dash', type: K, damage: 5.9, type2: R, damage2: 3.9, dashSpeed: 700, rangeW: 84, rangeH: 64,
      reappear: 0.65, vfx: 'dash', vfxColor: 0xe8f4ff,
      baseKnockback: 176, knockbackGrowth: 3.87, duration: 200, cooldown: 690,
    }),
    specialDefense: m('Afterimage Decay', {
      phase: true, afterimageCopy: true, hitRadius: 48,
      phaseRetort: { type: R, damage: 17.4, knockback: 123.2, growth: 2.11 },
      duration: 420, cooldown: 1000, vfx: 'shield', vfxColor: 0xe8f8ff,
    }),
    specialDirectional: m('Darmstadt Dart', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 17.8, vfx: 'spark', vfxColor: 0xf4fbff,
      projectileSpeed: 780, projectileRadius: 4, projectileLife: 280,
      baseKnockback: 176, knockbackGrowth: 3.7, duration: 140, cooldown: 1010,
    }),
  },

  copernicus: {
    basicCharge: m('Volatile Boil', {
      kind: 'burst', type: H, damage: 16, chargeDamageMult: 1.25, chargeRadiusMult: 1.35,
      maxChargeMs: 800, radius: 120, vfx: 'cloud', vfxColor: 0xffe8c8,
      baseKnockback: 200, knockbackGrowth: 4.0, duration: 240, cooldown: 1100,
    }),
    basicDirectional: m('Revolution', {
      kind: 'burst', type: K, damage: 5.8, type2: R, damage2: 3.6, radius: 78, vfx: 'spark', vfxColor: 0xfff6d0,
      baseKnockback: 200, knockbackGrowth: 4.4, duration: 260, cooldown: 680,
    }),
    specialDefense: m('Evaporate', {
      immune: [K], fadeAlpha: 0.22,
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xe8f0ff,
    }),
    specialDirectional: m('Liquid Metal Splash', {
      kind: 'projectile', shotEnd: 'despawn', type: C, damage: 10.2, type2: R, damage2: 7.3, liquidWobble: true,
      vfx: 'spark', vfxColor: 0xd8e4ee,
      projectileSpeed: 460, projectileRadius: 10, projectileLife: 720,
      baseKnockback: 240, knockbackGrowth: 5.2, duration: 200, cooldown: 1000,
    }),
  },

  niko: {
    basicCharge: m('Rising Sun', {
      kind: 'burst', type: H, damage: 10.1, type2: R, damage2: 10.1, chargeDamageMult: 1.3, chargeRadiusMult: 1.25,
      maxChargeMs: 800, radius: 80, vfx: 'fire', vfxColor: 0xffb060,
      baseKnockback: 212.4, knockbackGrowth: 4.72, duration: 240, cooldown: 1350,
    }),
    basicDirectional: melee('Three-Atom Combo', {
      type: R, damage: 3.3, multiHit: 3, hitGap: 90, rangeW: 74, vfx: 'spark', vfxColor: 0xffd0a0,
      baseKnockback: 94.4, knockbackGrowth: 1.89, duration: 280, cooldown: 690,
    }),
    specialDefense: m('Nine-Year Wait', {
      kind: 'counter', counterType: R, counterDamage: 19.8,
      counterKnockback: 236, counterKnockbackGrowth: 4.72,
      duration: 700, cooldown: 1090, vfx: 'shield', vfxColor: 0xffe0c0,
    }),
    specialDirectional: m('Zinc Ion Beam', {
      kind: 'beam', type: R, damage: 10.2, type2: K, damage2: 7.2,
      beamLen: 250, beamThick: 18, beamArtPx: 500, beamCap: 460,
      vfx: 'laser', vfxColor: 0xffe8c0,
      baseKnockback: 188.8, knockbackGrowth: 4.01, duration: 180, cooldown: 1000,
    }),
  },

  flo: {
    basicCharge: m('Island of Stability', {
      kind: 'burst', type: R, damage: 21.5, chargeDamageMult: 1.25, chargeRadiusMult: 1.3,
      maxChargeMs: 900, radius: 84, pauseDrain: 5000, pauseAt: 0.95, vfx: 'spark', vfxColor: 0xd8ffc8,
      baseKnockback: 124.8, knockbackGrowth: 2.65, duration: 240, cooldown: 1380,
    }),
    basicDirectional: melee('Riptide', {
      kind: 'dash', type: K, damage: 5.7, type2: R, damage2: 4.1, angleDeg: 0, dashSpeed: 700,
      drag: 640, rangeW: 100, rangeH: 64, vfx: 'gust', vfxColor: 0xc8e8ff,
      baseKnockback: 132.6, knockbackGrowth: 2.81, duration: 280, cooldown: 690,
    }),
    specialDefense: m('Identity Crisis', {
      cycle: [K, C], cycleMs: 250,
      duration: 800, cooldown: 960, vfx: 'shield', vfxColor: 0xe8e0ff,
    }),
    specialDirectional: m('Magic Number', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 17.8, fizzleOnMiss: true, vfx: 'spark', vfxColor: 0xf4fff0,
      projectileSpeed: 500, projectileRadius: 8, projectileLife: 480,
      baseKnockback: 148.2, knockbackGrowth: 3.12, duration: 180, cooldown: 1010,
    }),
  },

  zora: {
    basicCharge: melee('Ceramic Blade', {
      type: K, damage: ZORA.bladeDamage * 2.44, ignoreReductions: true,
      chargeDamageMult: ZORA.bladeDamageMult, chargeRangeMult: ZORA.bladeReach,
      maxChargeMs: ZORA.maxChargeMs, rangeW: 64, rangeH: 46,
      vfx: 'strike', vfxColor: 0xe8eef4, ...fx('Ceramic Blade'),
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 240, cooldown: 1400,
    }),
    basicDirectional: melee('Cubic Cut', {
      type: K, damage: 8, rangeW: 70, vfx: 'spark', vfxColor: 0xf4fbff, ...fx('Cubic Cut'),
      baseKnockback: 120, knockbackGrowth: 2.1, duration: 190, cooldown: 700,
    }),
    specialDefense: m('Zircaloy Cladding', {
      immune: [R, H],
      duration: 720, cooldown: 880, vfx: 'shield', vfxColor: 0x8a9098,
    }),
    specialDirectional: m('Counterfeit Gem', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 14.6, explodeOnly: true, explodeRadius: 54,
      fxReuse: { projectile: 'carter/diamond-shard', burst: 'carter/diamond-burst' },
      vfx: 'spark', vfxColor: 0xfff4ea, ...fx('Counterfeit Gem'),
      projectileSpeed: 420, projectileRadius: 8, projectileLife: 520,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 200, cooldown: 1030,
    }),
  },

  niobe: {
    basicCharge: m('Particle Ring', {
      kind: 'beam', type: E, damage: 9.3, type2: R, damage2: 7.9, chargeDamageMult: 1.45, chargeLengthMult: 1.35,
      maxChargeMs: 850, beamLen: 200, beamThick: 18, vfx: 'laser', vfxColor: 0xb8d0ff,
      baseKnockback: 44.93, knockbackGrowth: 0.8, duration: 220, cooldown: 1400,
    }),
    basicDirectional: melee('Anodized Edge', {
      type: K, damage: 7.9, sharpen: { step: 1, cap: 5 }, rangeW: 76, vfx: 'strike', vfxColor: 0x9ad0ff,
      baseKnockback: 44.93, knockbackGrowth: 0.85, duration: 180, cooldown: 710,
    }),
    specialDefense: m('Weeping Stone', {
      kind: 'block', onlyReduce: [K, H], blockReduction: 0.82, noKnockback: true, rooted: true,
      duration: 800, cooldown: 960, vfx: 'shield', vfxColor: 0xc8d0e0,
    }),
    specialDirectional: m('MRI Pulse', {
      kind: 'beam', type: E, damage: 15.3, beamLen: 200, beamThick: 48,
      onHit: { muteSpecialMs: 15000 },
      vfx: 'laser', vfxColor: 0xc8d8ff,
      baseKnockback: 36, knockbackGrowth: 0.55, duration: 200, cooldown: 1030,
    }),
  },

  gertrude: {
    basicCharge: m("Mendeleev's Prediction", {
      kind: 'burst', type: K, damage: 9.1, type2: E, damage2: 7.8, chargeDamageMult: 1.4, chargeRadiusMult: 1.2,
      maxChargeMs: 800, radius: 46, predict: { lead: 1 }, vfx: 'spark', vfxColor: 0xd0e0ff,
      baseKnockback: 68, knockbackGrowth: 1.22, duration: 260, cooldown: 1400,
    }),
    basicDirectional: melee('Point Contact', {
      type: K, damage: 3.4, type2: E, damage2: 3.4, echoWithin: 720, echoMult: 2, rangeW: 62,
      vfx: 'spark', vfxColor: 0xc8dcff,
      baseKnockback: 54.4, knockbackGrowth: 1.02, duration: 160, cooldown: 610,
    }),
    specialDefense: m('Transistor Gate', {
      storeType: E, storeCap: 24,
      duration: 1000, cooldown: 860, vfx: 'spark', vfxColor: 0xb0d4ff,
    }),
    specialDirectional: m('Crystal Radio Wave', {
      kind: 'projectile', shotEnd: 'despawn', type: E, damage: 10.5, type2: R, damage2: 7.7, angleable: true, arc: 160, vfx: 'spark', vfxColor: 0xb0d4ff,
      projectileSpeed: 360, projectileRadius: 9, projectileLife: 700,
      baseKnockback: 54.4, knockbackGrowth: 0.95, duration: 200, cooldown: 1030,
    }),
  },

  nadia: {
    basicCharge: m('Magnet Pull', {
      kind: 'burst', type: K, damage: 17.9, chargeDamageMult: 1.4, chargeRadiusMult: 1.15,
      maxChargeMs: 800, radius: 70, pull: { radius: 240, speed: 160, metals: true }, vfx: 'gust', vfxColor: 0xd8c8ff,
      baseKnockback: 86.8, knockbackGrowth: 1.49, duration: 240, cooldown: 1360,
    }),
    basicDirectional: melee('Bass Drop Punch', {
      type: K, damage: 5.6, rangeW: 72, vfx: 'strike', vfxColor: 0xc8b8f0,
      baseKnockback: 130.2, knockbackGrowth: 2.73, duration: 220, cooldown: 540,
    }),
    specialDefense: m('Polarity Flip', {
      repelMetals: true, reflectMetals: true, repelPower: 1.15,
      counterKnockback: 105.4, counterKnockbackGrowth: 1.98,
      duration: 640, cooldown: 860, vfx: 'shield', vfxColor: 0xd0c0ff,
    }),
    specialDirectional: m('Rotor Throw', {
      kind: 'projectile', shotEnd: 'despawn', type: K, damage: 9.3, type2: E, damage2: 7.7, dragMetals: true, dragRadius: 96,
      vfx: 'spark', vfxColor: 0xc8b8ff,
      projectileSpeed: 400, projectileRadius: 12, projectileLife: 560,
      baseKnockback: 55.8, knockbackGrowth: 0.99, duration: 200, cooldown: 1030,
    }),
  },

  prometheus: {
    basicCharge: melee('Stolen Fire', {
      type: H, damage: 20.4, stealHeat: { cap: 14, keep: 0.85 }, chargeDamageMult: 1.35,
      maxChargeMs: 800, rangeW: 72, vfx: 'fire', vfxColor: 0xff7040,
      baseKnockback: 110, knockbackGrowth: 2.0, duration: 200, cooldown: 1400,
    }),
    basicDirectional: melee('Torchbearer Swing', {
      type: K, damage: 6, type2: H, damage2: 6, rangeW: 80, vfx: 'fire', vfxColor: 0xff8844,
      baseKnockback: 100, knockbackGrowth: 1.8, duration: 210, cooldown: 780,
    }),
    specialDefense: m('Chained to the Rock', {
      noKnockback: true, rooted: true, regen: 3, regenEvery: 420,
      duration: 900, cooldown: 1000, vfx: 'shield', vfxColor: 0xc8b090,
    }),
    specialDirectional: m('Beta Battery', {
      // Sticks to the fighter or wall it hits and stays there for 10s.
      // The status sheet is a 2s pulse (24 frames at 12 fps) and plays 5 times.
      kind: 'projectile', shotEnd: 'stick', stick: true, stickMs: 10000,
      type: R, damage: 0, noFlinch: true, vfx: 'spark', vfxColor: 0xd0ffb0,
      zone: {
        name: 'Beta Battery', type: R, damage: 1, ms: 10000, radius: 40, tick: 1000,
        knockback: 0, growth: 0, fixed: true, onStick: true, color: 0xd0ffb0,
      },
      projectileSpeed: 380, projectileRadius: 8, projectileLife: 520,
      baseKnockback: 0, knockbackGrowth: 0, duration: 200, cooldown: 780,
    }),
  },

  ford: {
    basicCharge: melee('Dense Nucleus', {
      type: K, damage: 10.6, type2: R, damage2: 8.9, chargeDamageMult: 1.35,
      maxChargeMs: 750, rangeW: 78, rangeH: 52, hitRadius: 46, vfx: 'spark', vfxColor: 0xfff0c0,
      baseKnockback: 208.8, knockbackGrowth: 4.41, duration: 220, cooldown: 1350,
    }),
    basicDirectional: melee('Backscatter', {
      type: K, damage: 4.7, type2: R, damage2: 3.9, onHit: { reverse: true }, rangeW: 76,
      vfx: 'strike', vfxColor: 0xffe8a0,
      baseKnockback: 232, knockbackGrowth: 4.64, duration: 200, cooldown: 640,
    }),
    specialDefense: m('Gold Foil', {
      phase: true, foilEvery: 8, duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xffe8a0,
    }),
    specialDirectional: m('Transmute Ray', {
      kind: 'beam', type: R, damage: 15.9, onHit: { scramble: 2200 }, beamLen: 240, beamThick: 16,
      beamArtPx: 554, beamCap: 460,
      vfx: 'laser', vfxColor: 0xfff6c0,
      baseKnockback: 185.6, knockbackGrowth: 3.94, duration: 180, cooldown: 940,
    }),
  },

  boar: {
    basicCharge: m('Quantum Leap', {
      kind: 'burst', type: R, damage: 20.7, chargeDamageMult: 1.3, chargeRadiusMult: 1.2,
      maxChargeMs: 650, radius: 58, leap: { dist: 120 }, vfx: 'spark', vfxColor: 0xd0f0ff,
      baseKnockback: 150.4, knockbackGrowth: 3.2, duration: 200, cooldown: 1380,
    }),
    basicDirectional: melee('Shell Gore', {
      kind: 'dash', type: K, damage: 5.7, type2: E, damage2: 4.1, dashSpeed: 640, rangeW: 96, rangeH: 64,
      vfx: 'dash', vfxColor: 0xc8e4ff,
      baseKnockback: 169.2, knockbackGrowth: 3.57, duration: 240, cooldown: 690,
    }),
    specialDefense: m('Complementarity', {
      immune: [K], duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xd8ecff,
    }),
    specialDirectional: m('Spectral Line', {
      kind: 'beam', type: R, damage: 14.1, beamLen: 300, beamThick: 8, beamArtPx: 600, beamCap: 560,
      vfx: 'laser', vfxColor: 0x9ad0ff,
      baseKnockback: 131.6, knockbackGrowth: 2.82, duration: 160, cooldown: 860,
    }),
  },

  roger: {
    basicCharge: m('X-Ray Vision', {
      kind: 'buff', revealAll: true, doubleNext: true, duration: 180, cooldown: 900,
      vfx: 'spark', vfxColor: 0xe8f4ff,
    }),
    basicDirectional: melee('Skeleton Flash', {
      type: K, damage: 5.1, type2: R, damage2: 4.3, hitRadius: 48,
      onHit: { reveal: true, xray: 180 }, rangeW: 74,
      vfx: 'spark', vfxColor: 0xf4fbff,
      baseKnockback: 180, knockbackGrowth: 3.8, duration: 160, cooldown: 680,
    }),
    specialDefense: m('Crookes Tube', {
      retort: { type: R, damage: 17.4, knockback: 140, growth: 2.6 },
      duration: 520, cooldown: 1000, vfx: 'shield', vfxColor: 0xe8f0ff,
    }),
    specialDirectional: m('Penetrating Ray', {
      kind: 'beam', type: R, damage: 16, breaksBlock: true, popShield: true, breakPhase: true,
      // Approved concept: the X-ray passes through walls, blocks, and shields.
      pierce: true, passBands: true, beamLen: 340, beamThick: 14, beamArtPx: 640, beamCap: 600,
      vfx: 'laser', vfxColor: 0xf4fbff,
      baseKnockback: 170, knockbackGrowth: 3.6, duration: 160, cooldown: 940,
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
      baseKnockback: 146.2, knockbackGrowth: 3.1, duration: 240, cooldown: 1250,
    }),
    basicDirectional: melee('Light-Speed Jab', {
      type: K, damage: 5.7, type2: R, damage2: 4.1, rangeW: 68,
      vfx: 'strike', vfxColor: 0xf4f0ff,
      baseKnockback: 137.6, knockbackGrowth: 2.75, duration: 90, cooldown: 690,
    }),
    specialDefense: m('Broken Noble', {
      reflectTypes: [C, E], reflectPower: 1.4,
      counterKnockback: 154.8, counterKnockbackGrowth: 2.92,
      duration: 640, cooldown: 900, vfx: 'shield', vfxColor: 0xe0d8ff,
    }),
    specialDirectional: m('Millisecond Beam', {
      kind: 'beam', type: R, damage: 15.5, spanStage: true,
      beamLen: 1024, beamThick: 10, beamArtPx: 1024, vfx: 'laser', vfxColor: 0xf4f0ff,
      baseKnockback: 172, knockbackGrowth: 3.61, duration: 70, cooldown: 920,
    }),
  },

  sarge: {
    basicCharge: m('Sound Off', {
      kind: 'buff', chargeStack: { every: 1000, damage: 5.6, cap: 17 }, unblockAtFull: true,
      maxChargeMs: 3000, duration: 160, cooldown: 800, vfx: 'spark', vfxColor: 0xffe08a,
    }),
    basicDirectional: melee('Six-Count Flurry', {
      type: K, damage: 0.9, type2: R, damage2: 0.7, multiHit: 6, rangeW: 78, rangeH: 52,
      vfx: 'strike', vfxColor: 0xfff2c0,
      baseKnockback: 97.6, knockbackGrowth: 1.95, duration: 420, cooldown: 690,
    }),
    specialDefense: m('Periodic Shield', {
      blocks: [K, H, E, C, R], crackAfterHits: 5,
      duration: 900, cooldown: 1100, vfx: 'shield', vfxColor: 0xf0e8c8,
    }),
    specialDirectional: m('Decay Mortar', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 10.2, type2: H, damage2: 7.2, lob: 480, explodeOnly: true, landBurst: true,
      explodeRadius: 78, vfx: 'spark', vfxColor: 0xffd070,
      projectileSpeed: 340, projectileRadius: 11, projectileLife: 900,
      baseKnockback: 231.8, knockbackGrowth: 4.88, duration: 220, cooldown: 1000,
    }),
  },

  mae: {
    basicCharge: m('Liquid Drop Split', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 7.64, type2: H, damage2: 6.55, alsoBehind: true,
      hideProjectile: true,
      chargeDamageMult: 1.45, maxChargeMs: 800, vfx: 'spark', vfxColor: 0xfff0a0,
      projectileSpeed: 460, projectileRadius: 10, projectileLife: 520,
      baseKnockback: 98.28, knockbackGrowth: 2.07, duration: 220, cooldown: 1120,
    }),
    basicDirectional: melee('Overlooked', {
      type: K, damage: 5.5, type2: R, damage2: 4.3, rangeW: 70, vfx: 'strike', vfxColor: 0xf4fbff,
      baseKnockback: 92.82, knockbackGrowth: 1.97, duration: 90, cooldown: 690,
    }),
    specialDefense: m('Border Slip', {
      kind: 'counter', counterType: R, counterDamage: 17.4, swap: true,
      counterKnockback: 98.28, counterKnockbackGrowth: 2.07,
      duration: 520, cooldown: 1000, vfx: 'shield', vfxColor: 0xe8f4ff,
    }),
    specialDirectional: m('Neutron Splitter', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 17.8, splitOnHit: true, splitDamage: 5.46, splitDeg: 22,
      hideProjectile: true,
      vfx: 'spark', vfxColor: 0xe8ffc0,
      projectileSpeed: 520, projectileRadius: 7, projectileLife: 480,
      baseKnockback: 87.36, knockbackGrowth: 1.86, duration: 180, cooldown: 1010,
    }),
  },

  mac: {
    basicCharge: m('Decay Cascade', {
      kind: 'burst', type: R, damage: 6.2, commit: true,
      pulses: [
        { damage: 6.2, delay: 0 },
        { damage: 5.1, delay: 120 },
        { damage: 3.9, delay: 240 },
        { damage: 3.1, delay: 360 },
        { damage: 2.3, delay: 480 },
      ],
      chargeDamageMult: 1.3, maxChargeMs: 800, radius: 72, vfx: 'spark', vfxColor: 0xffb0b0,
      baseKnockback: 150, knockbackGrowth: 3.2, duration: 720, cooldown: 1380,
    }),
    basicDirectional: melee('Red Hammer', {
      type: K, damage: 5.3, type2: R, damage2: 4.1, rangeW: 88, vfx: 'strike', vfxColor: 0xff6040,
      baseKnockback: 190, knockbackGrowth: 4.2, duration: 240, cooldown: 680,
    }),
    specialDefense: m('Nesting Doll', {
      blocks: [K, H, E, C, R], crackAfterHits: 3, shellShrink: 0.82,
      duration: 1100, cooldown: 1200, vfx: 'shield', vfxColor: 0xffd0c0,
    }),
    specialDirectional: m('Short Fuse', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 9.9, type2: H, damage2: 7.5, lob: 360, explodeOnly: true,
      explodeRadius: 86, vfx: 'spark', vfxColor: 0xff7040,
      projectileSpeed: 280, projectileRadius: 12, projectileLife: 680,
      baseKnockback: 200, knockbackGrowth: 4.4, duration: 200, cooldown: 1000,
    }),
  },

  liv: {
    basicCharge: m('192 Beams', {
      kind: 'burst', type: H, damage: LIV.blastHeat * 0.67, type2: R, damage2: LIV.blastRad * 0.67,
      chargeDamageMult: 1, chargeRadiusMult: 1, maxChargeMs: LIV.fullChargeMs,
      radius: LIV.blastRadius, offsetX: LIV.aimDistance,
      earlyBlast: { below: 1, type: H, damage: LIV.earlyHeat, radius: LIV.earlyRadius },
      vfx: 'supernova', vfxColor: 0xffe8a0, ...fx('192 Beams'),
      baseKnockback: 176.4, knockbackGrowth: 3.86, duration: 280, cooldown: 1380,
    }),
    basicDirectional: melee('Chalcogen Hook', {
      type: K, damage: 5.5, type2: C, damage2: 4.3, rangeW: 78,
      vfx: 'strike', vfxColor: 0xffd24a, ...fx('Chalcogen Hook'),
      baseKnockback: 159.6, knockbackGrowth: 3.36, duration: 220, cooldown: 690,
    }),
    specialDefense: m('Hohlraum', {
      detonateOn: [H, K],
      detonate: {
        type: H, damage: LIV.detonateHeat, type2: R, damage2: LIV.detonateRad,
        radius: LIV.detonateRadius, baseKnockback: 150, knockbackGrowth: 3,
      },
      duration: 700, cooldown: 960, vfx: 'shield', vfxColor: 0xffe08a, ...fx('Hohlraum'),
    }),
    specialDirectional: m('Last Instant', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: LIV.sparkDamage, vfx: 'spark', vfxColor: 0xfff6c0,
      ...fx('Last Instant'),
      projectileSpeed: LIV.sparkSpeed, projectileRadius: 6, projectileLife: LIV.sparkLife,
      baseKnockback: 134.4, knockbackGrowth: 2.69, duration: 120, cooldown: 1040,
    }),
  },

  tess: {
    basicCharge: m('Electron Hunger', {
      kind: 'buff', type: C, damage: TESS.hungerDamage * 2.41, chargeDamageMult: TESS.hungerDamageMult,
      yank: true, yankMin: TESS.pullMin, yankMax: TESS.pullMax,
      maxChargeMs: TESS.maxChargeMs, vfx: 'gust', vfxColor: 0x9ad0ff, ...fx('Electron Hunger'),
      baseKnockback: 50.34, knockbackGrowth: 1.08, duration: 240, cooldown: 1340,
    }),
    basicDirectional: melee('Last Halogen', {
      type: C, damage: 6.45, type2: R, damage2: 5.46, rangeW: 72,
      vfx: 'strike', vfxColor: 0xc8b4ff, ...fx('Last Halogen'),
      baseKnockback: 64.73, knockbackGrowth: 1.44, duration: 200, cooldown: 780,
    }),
    specialDefense: m('Smoky Haze', {
      phase: true, untargetable: true, fadeAlpha: 0.15, gas: true,
      zone: {
        name: 'Smoky Haze', type: C, damage: TESS.hazeDps, percentOnly: true, gas: true,
        endsDefense: true, follow: true, ms: 8000, radius: TESS.hazeRadius, tick: 1000,
        knockback: 0, growth: 0, color: 0x8eb4ff,
      },
      duration: 800, cooldown: 980, vfx: 'cloud', vfxColor: 0x9ec0ff, ...fx('Smoky Haze'),
    }),
    specialDirectional: m('Six-Atom Spread', {
      kind: 'projectile', shotEnd: 'despawn', type: R, damage: 5.9, fan: TESS.fanCount, fanDeg: TESS.fanDeg,
      vfx: 'spark', vfxColor: 0xd0e4ff, ...fx('Six-Atom Spread'),
      projectileSpeed: TESS.fanSpeed, projectileRadius: 5, projectileLife: 420,
      baseKnockback: 43.15, knockbackGrowth: 0.86, duration: 180, cooldown: 1010,
    }),
  },
};
