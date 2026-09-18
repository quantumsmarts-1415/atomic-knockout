// ---------------------------------------------------------------------------
// CHARACTER DATA — the single source of truth for the roster.
// Adding a new element character = adding one entry here. No engine changes.
//
// Damage types (2026-08-05 migration, was heat/current/kinetic): every move
// is heat, physical, electrical, chemical, or radiation. Every character has
// per-type defense (0-10) for heat/physical/electrical/chemical -- chemical
// defense is per-element and gets set during that character's own moveset
// design session (starts at 0 as a placeholder, NOT a real balance number).
// Radiation is NOT a per-character stat -- it affects every character
// equally (see RADIATION_DEFENSE in applyDefense below). Defense reduces
// incoming damage of that type by 5% per point.
//
// Moves (2026-08-05: expanded from 2 slots to 4, keyed off whether a
// direction -- left/right/up/down, "up" = jump key held -- is held when the
// attack/special button is pressed):
//   basicDirectional   -- attack + a direction held (today's old `basic`)
//   specialDirectional -- special + a direction held (today's old `special`)
//   basicCharge        -- attack, no direction: hold to charge, release to
//                         fire. NOT YET DESIGNED for any character -- absent
//                         until that character's own session adds it; Fighter
//                         falls back to basicDirectional when it's missing.
//   specialDefense     -- special, no direction: a block or a counter
//                         (per-character choice, kind: 'block' | 'counter').
//                         Same "absent until designed" rule as basicCharge.
//
// Knockback model (Smash-style): launch speed =
//   (baseKnockback + victimPercent * knockbackGrowth) / victimWeight
// Lighter characters (weight < 1) fly farther.
// ---------------------------------------------------------------------------

export const DAMAGE_TYPES = ['heat', 'physical', 'electrical', 'chemical'];
// 'radiation' is intentionally NOT in this list -- it isn't a per-character
// stat. Every character takes radiation damage identically (see
// RADIATION_DEFENSE below / applyDefense's special case).

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
    // hydra-cut.png). facing: the direction the native image faces (1 =
    // right); the Rig flips it to match the game's face-right convention.
    // height = display px; bodyW/bodyH = physics hurtbox (tighter than the
    // flame aura).
    art: {
      key: 'char-hydra',
      file: 'art-src/hydra-cut.png',
      facing: 1,
      height: 122,
      bodyW: 42,
      bodyH: 108,
      // --- TEST: Gemini-generated idle sheet (2026-07-29) --------------
      // Swapped in to replace the Blender 3D render (Benjamin found the
      // clay-ball fists/blank face worse than this). To REVERT to Blender:
      // dir -> 'tools/blender/out/sheets/', frameW/H -> 256/256,
      // footY -> 0.8654, visibleH -> 213, and restore the full clips list
      // (walk/jump/fall/attack/special/hurt/ko all existed before).
      // TO TURN 3D/sheets OFF ENTIRELY: set use3d to false -- falls
      // straight back to the flat render on the `file` line.
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 609,
        frameH: 720,
        // Measured from the extracted+cropped Gemini frames' alpha bbox.
        footY: 0.9823,
        visibleH: 668,
        // Optional per-clip frameW/frameH/footY/visibleH override sheets.*.
        clips: {
          // idle + walk (Gemini). Other clips still fall back to idle.
          idle: { count: 14, fps: 3.6, loop: true },
          walk: { count: 33, fps: 10, loop: true, frameW: 808, frameH: 712, footY: 0.9944, visibleH: 673 },
        },
      },
    },
    stats: {
      speed: 340,          // horizontal run speed (px/s)
      jumpVelocity: 680,   // initial jump speed (px/s, applied upward)
      airJumps: 1,         // extra jumps allowed while airborne
      weight: 0.78,        // < 1 = light, flies farther when hit
      gravityScale: 1.0,   // multiplier on world gravity
    },
    defense: { heat: 1, physical: 1, electrical: 2, chemical: 0 }, // hydrogen is not tough
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
    // 2026-08-05: Hydra's full 4-move kit, first character through the new
    // moveset-design pass (see Atomic Knockout Character Development.md).
    moves: {
      basicDirectional: {
        name: 'Flame Punch',
        // Half heat, half physical -- same total damage/hitbox as the old
        // Proton Jab, just split across both types (Benjamin's call).
        type: 'physical',
        damage: 3.5,
        type2: 'heat',
        damage2: 3.5,
        baseKnockback: 152,   // -20% for flight-distance tuning (was 190)
        knockbackGrowth: 5.6, // -20% (was 7)
        // Matched to the animation: at full extension his fist centre sits
        // 57px from his own centre line (measured in Blender — see the
        // HYDRA_REACH line printed by build_hydra.py), so the visible fist
        // tip is ~62px. The box starts at bodyW * 0.2 = 10px, so 74 puts the
        // front edge at 84px — ~22px of generosity past the fist, normal for
        // the genre. Raise rangeW to reach further; past ~85 he starts
        // landing hits with visibly empty air in front of the glove.
        rangeW: 74,   // hitbox width in front of fighter
        rangeH: 46,
        duration: 220,   // ms the swing lasts
        cooldown: 300,
      },
      specialDirectional: {
        name: 'Ignition Dash',
        // Replaces H-Burst: instead of a self-centered explosion, Hydra
        // dashes forward and his whole body is the hitbox (kind: 'dash',
        // new engine mechanic -- see Fighter.js startMove/getHitboxRect).
        // Same total damage as old H-Burst (13), split heat/physical.
        kind: 'dash',
        dashSpeed: 700,        // well past his 340 run speed -- reads as a dash
        type: 'physical',
        damage: 6.5,
        type2: 'heat',
        damage2: 6.5,
        baseKnockback: 256, // -20% for flight-distance tuning (was 320)
        knockbackGrowth: 7.2, // -20% (was 9)
        rangeW: 90,   // his own body width + reach ahead of him
        rangeH: 100,  // tall enough to represent his whole body as the hitbox
        duration: 320,
        cooldown: 1300,
        teach: 'Hydrogen gas is highly flammable — it powered early rockets.',
      },
      basicCharge: {
        name: 'Fusion Core',
        // Hold to charge, release to fire -- self-centered explosion that
        // grows in damage AND radius the longer it's held. Dual-typed
        // (heat + radiation, per Benjamin) -- the radiation component
        // ignores every character's individual defense (RADIATION_DEFENSE
        // is a universal constant), so this hits equally hard regardless
        // of who it lands on.
        kind: 'burst',
        type: 'heat',
        damage: 8,
        type2: 'radiation',
        damage2: 6,
        chargeDamageMult: 3,     // both damage/damage2 scale by this at full charge
        baseKnockback: 160,
        chargeKnockbackMult: 2.2,
        knockbackGrowth: 6,
        radius: 60,
        chargeRadiusMult: 2.2,   // "large area explosion" at full charge -- radius up to 132
        duration: 260,
        cooldown: 500,
        maxChargeMs: 900,        // slow to fully charge -- risk/reward, leaves him exposed
        teach: 'Nuclear fusion -- the reaction that powers the sun -- fuses hydrogen atoms together and releases enormous energy, including radiation.',
      },
      specialDefense: {
        name: 'Dual Flame Wall',
        // No direction held: vertical flame walls rise on BOTH sides of
        // Hydra (kind: 'wall', new engine mechanic -- see Fighter.js
        // takeHit()/BattleScene.js's wall-hazard loop). Blocks horizontal
        // attacks from either side entirely; vertical/underside attacks
        // still land normally. The walls themselves damage anyone who
        // touches them, heat-typed only (Benjamin's call).
        kind: 'wall',
        duration: 500,
        cooldown: 700,
        wallDamage: 9,
        wallType: 'heat',
        wallKnockback: 200,
        wallKnockbackGrowth: 5,
        wallRangeW: 26,   // thin wall zone right at each side
        wallRangeH: 90,
        wallYFrac: 0.75,  // vertical placement, matches the other hit boxes
        teach: 'Burning hydrogen gas produces a pale blue flame that is almost invisible in bright light -- one reason it is handled with extreme care.',
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
    art: {
      key: 'char-helen',
      file: 'art-src/helen-cut.png',
      facing: 1,
      height: 138,
      bodyW: 40,
      bodyH: 124,
      // --- TEST: Gemini-generated idle sheet (2026-07-29) --------------
      // Swapped in temporarily to compare against the Blender render. To
      // REVERT: dir -> 'tools/blender/out/sheets/', frameW/H -> 256/256,
      // footY -> 0.8654, visibleH -> 224, and restore the full clips list
      // below (walk/jump/fall/attack/special/hurt/ko all existed before).
      // TO TURN 3D/sheets OFF ENTIRELY: set use3d to false -- falls
      // straight back to the flat render on the `file` line.
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 446,
        frameH: 720,
        // Measured from the extracted+cropped Gemini frames' alpha bbox
        // (average across the 14-frame idle loop -- some jitter is
        // inherent to video-generated animation, unlike the Blender rig).
        footY: 0.978,
        visibleH: 690,
        clips: {
          // idle + walk (Gemini). Other clips still fall back to idle.
          idle: { count: 14, fps: 3.6, loop: true },
          walk: { count: 33, fps: 10, loop: true, frameW: 910, frameH: 648, footY: 0.9938, visibleH: 620 },
        },
      },
    },
    stats: {
      speed: 265,
      jumpVelocity: 560,
      airJumps: 2,          // extra floaty double jump
      weight: 0.72,
      gravityScale: 0.62,   // noble-gas drift — falls slowly
    },
    defense: { heat: 3, physical: 2, electrical: 1, chemical: 0 }, // inert = shrugs off heat
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
      basicDirectional: {
        // Names swapped 2026-08-05 (Benjamin's call) -- Noble Gust is now
        // the melee basic's name, Balloon Bop the projectile special's.
        // Nothing else changed: same stats/mechanics as before the swap.
        name: 'Noble Gust',
        type: 'physical',
        damage: 6,
        baseKnockback: 160,   // -20% for flight-distance tuning (was 200)
        knockbackGrowth: 4.8, // -20% (was 6)
        rangeW: 54,
        rangeH: 50,
        duration: 240,
        cooldown: 320,
      },
      specialDirectional: {
        name: 'Balloon Bop',
        kind: 'projectile', // slow drifting orb that pushes hard
        type: 'physical',
        damage: 8,
        baseKnockback: 304, // -20% for flight-distance tuning (was 380)
        knockbackGrowth: 6.4, // -20% (was 8)
        projectileSpeed: 380,
        projectileRadius: 16,
        projectileLife: 900, // ms
        duration: 260,
        cooldown: 1500,
        teach: 'Helium is a noble gas — inert, safe, and used to lift airships.',
      },
      basicCharge: {
        // Hold to charge, release to fire a sweeping wind wave that crashes
        // into whoever it hits. Moderate damage, but knockback scales much
        // harder than damage -- "send them flying extra" (Benjamin's call).
        name: 'Air Wave',
        kind: 'projectile',
        type: 'physical',
        damage: 7,               // moderate at tap, ~12.6 at full charge
        chargeDamageMult: 1.8,
        baseKnockback: 220,      // already knockback-heavy relative to damage before charging at all
        chargeKnockbackMult: 2.5, // up to 550 at full charge -- well past a normal hit
        knockbackGrowth: 6.5,
        projectileSpeed: 420,
        projectileRadius: 30,    // wide sweeping wave, not a small orb
        projectileLife: 700,
        duration: 260,
        cooldown: 400,
        maxChargeMs: 700,
        teach: 'Helium is light enough that a sudden rush of it can visibly push and ripple the air around it, like a gust.',
      },
      specialDefense: {
        // No direction held: a bubble forms around her that absorbs exactly
        // one hit of any strength, then pops (kind: 'shield', new engine
        // mechanic -- see Fighter.js takeHit()). Omnidirectional, unlike
        // Hydra's side-only wall. Deals no damage either way.
        name: 'Bubble Shield',
        kind: 'shield',
        duration: 1500, // how long the bubble stands if nothing hits it
        cooldown: 700,
        teach: 'Soap-film and gas bubbles are strong enough to absorb a surprising impact before popping -- but only once.',
      },
    },
  },

  titan: {
    id: 'titan',
    name: 'Titan',
    element: 'Titanium',
    symbol: 'Ti',
    atomicNumber: 22,
    tagline: 'Aerospace-grade armor with a lance to match.',
    teach: 'Titanium is as strong as steel but about 45% lighter, and it resists corrosion.',
    // Native render faces LEFT (opposite of Hydra/Helen) -> facing: -1
    art: {
      key: 'char-titan',
      file: 'art-src/titan-cut.png',
      facing: -1,
      height: 128,
      bodyW: 48,
      bodyH: 120,
      // --- TEST: Gemini-generated idle sheet (2026-07-29) --------------
      // Same treatment as Hydra/Helen -- see their art blocks for the
      // revert notes. This is Titan's first 3D/sheets art of any kind
      // (he never had a Blender model), and required a Rig.js fix: sheet
      // mode had never respected art.facing before (Hydra/Helen's Blender
      // renders always came out facing right already), so a left-facing
      // source like this one rendered backwards until that was added.
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 698,
        frameH: 720,
        footY: 0.992,
        visibleH: 693,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: {
      speed: 230,          // heavy bruiser: slow...
      jumpVelocity: 600,
      airJumps: 1,
      weight: 1.18,        // ...but hard to launch
      gravityScale: 1.05,
    },
    // hard metal -> great kinetic defense; 1668°C melting point -> strong
    // heat defense; titanium is a POOR electrical conductor -> weak to current
    defense: { heat: 5, physical: 6, electrical: 1, chemical: 0 },
    palettes: [
      { name: 'Steel',    skin: 0xbfc9d9, body: 0x9aa7b8, accent: 0x3f74c9, eye: 0x16324f },
      { name: 'Gunmetal', skin: 0x9aa0ad, body: 0x5c6470, accent: 0x2b90a8, eye: 0x101820 },
      { name: 'Aurora',   skin: 0xd9e2f2, body: 0x7f8fd9, accent: 0x9b59d0, eye: 0x1d1440 },
      { name: 'Ember',    skin: 0xd9c9bf, body: 0xb87a5c, accent: 0xd94f2b, eye: 0x3a1710 },
    ],
    body: {
      // fallback proportions if the render is ever missing
      headRadius: 15, torsoWidth: 44, torsoHeight: 46,
      armLength: 34, armWidth: 12, legLength: 38, legWidth: 14, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Lance Jab',
        type: 'physical',
        damage: 9,
        baseKnockback: 184, // -20% for flight-distance tuning (was 230)
        knockbackGrowth: 5.6, // -20% (was 7)
        rangeW: 74,   // spear = long reach
        rangeH: 44,
        duration: 300, // slower swing than the light characters
        cooldown: 450,
      },
      specialDirectional: {
        name: 'Aero Lance',
        kind: 'projectile',
        visualShape: 'spearhead', // oriented lance shape instead of the generic orb
        type: 'physical',
        damage: 12,
        baseKnockback: 256, // -20% for flight-distance tuning (was 320)
        knockbackGrowth: 5.6, // -20% (was 7)
        projectileSpeed: 540,
        projectileRadius: 13,
        projectileLife: 750,
        duration: 320,
        cooldown: 1700,
        teach: 'Titanium’s strength-to-weight ratio makes it the metal of jets and spacecraft.',
      },
      basicCharge: {
        // Hold to charge, release to fire a slow, unstoppable forward
        // shoulder-charge -- reuses the 'dash' mechanic (his whole body is
        // the hitbox as he plows forward), scaled by hold time.
        name: 'Titanium Ram',
        kind: 'dash',
        dashSpeed: 550,           // forceful, not fast -- "unstoppable" is about weight, not speed
        type: 'physical',
        damage: 10,               // moderate at tap, 20 at full charge
        chargeDamageMult: 2,
        baseKnockback: 220,       // knockback-focused -- huge at full charge
        chargeKnockbackMult: 2.8,
        knockbackGrowth: 6,
        rangeW: 100,              // wide ram, his body + reach
        rangeH: 120,
        duration: 340,            // slow swing, matches his tank pacing
        cooldown: 550,
        maxChargeMs: 1000,        // slow to charge -- reward for patience
        teach: 'A titanium hull can absorb a huge amount of kinetic impact without deforming, which is exactly why it is used in aerospace collision structures.',
      },
      specialDefense: {
        // No direction held: braces his aerospace-grade plating -- reduced
        // damage/knockback for the window, no retaliation (block, not
        // counter, per Benjamin's call).
        name: 'Aerospace Plating',
        kind: 'block',
        duration: 450,
        cooldown: 500,
        damageReduction: 0.6,
        teach: 'Titanium resists corrosion so well that it is used for aircraft parts, medical implants, and deep-sea equipment -- environments that destroy most other metals.',
      },
    },
  },

  lillie: {
    id: 'lillie',
    name: 'Lillie',
    element: 'Lithium',
    symbol: 'Li',
    atomicNumber: 3,
    tagline: 'Small, light, and reacts to everything.',
    teach: 'Lithium is the lightest metal, so soft it can be cut with a knife, and so reactive it has to be stored in oil.',
    // Gemini-generated (2026-07-30): concept art generated fresh from a
    // text/style brief (hydra-cut.png as style reference only, not her
    // design), then animated the same way as Hydra/Helen/Titan's idle
    // sheets -- see the gemini-sprite-pipeline memory for the recipe.
    // facing: pose came out fairly frontal/symmetric rather than a clean
    // profile like the others -- set to 1 (right) as a best guess, verify
    // on-screen and flip if she reads backwards (same fix Hydra needed
    // once, see Session 2 log).
    art: {
      key: 'char-lillie',
      file: 'art-src/lillie-cut.png',
      facing: 1,
      height: 118,
      bodyW: 37,
      bodyH: 100,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 631,
        frameH: 720,
        footY: 0.9725,
        visibleH: 672,
        clips: {
          // idle + walk (Gemini). Other clips still fall back to idle.
          idle: { count: 14, fps: 3.6, loop: true },
          walk: { count: 33, fps: 10, loop: true, frameW: 1294, frameH: 736, footY: 0.9946, visibleH: 700 },
        },
      },
    },
    stats: {
      speed: 360,          // lightest metal -> fastest runner on the roster
      jumpVelocity: 700,
      airJumps: 1,
      weight: 0.65,         // very light -> flies far when hit
      gravityScale: 0.95,
    },
    // soft metal (softest of all metals, cuttable with a knife) -> weak
    // kinetic defense; low melting point (180.5°C) -> weak heat defense;
    // alkali metals are decent conductors (why lithium anchors batteries)
    // -> moderate current defense
    defense: { heat: 2, physical: 1, electrical: 3, chemical: 0 },
    palettes: [
      { name: 'Crimson', skin: 0xeaeef5, body: 0xa8b0c2, accent: 0xd6303a, eye: 0xd6203a },
      { name: 'Violet',  skin: 0xf0e8f5, body: 0xa89bc2, accent: 0x8a3ad6, eye: 0x6a20a8 },
      { name: 'Azure',   skin: 0xe8f0f5, body: 0x9bb0c2, accent: 0x2f7dd6, eye: 0x1c5fa8 },
      { name: 'Verdant', skin: 0xe8f5ec, body: 0x9bc2a8, accent: 0x2fa855, eye: 0x1c7a3a },
    ],
    body: {
      // fallback proportions if the render is ever missing -- petite build
      headRadius: 20, torsoWidth: 34, torsoHeight: 40,
      armLength: 26, armWidth: 9, legLength: 30, legWidth: 10, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Spark Jab',
        type: 'physical',
        damage: 6,
        baseKnockback: 140,
        knockbackGrowth: 5,
        rangeW: 60,
        rangeH: 44,
        duration: 180,
        cooldown: 280,
      },
      specialDirectional: {
        name: 'Water Reaction',
        kind: 'burst', // radial explosion centered on self, like H-Burst
        type: 'heat',
        damage: 11,
        baseKnockback: 230,
        knockbackGrowth: 6,
        radius: 85,
        duration: 300,
        cooldown: 400,
        teach: 'Lithium reacts violently with water, releasing hydrogen gas and heat -- pure lithium metal is stored in oil to keep it away from moisture in the air.',
      },
      basicCharge: {
        name: 'Volt Dash',
        kind: 'dash',
        type: 'electrical',
        damage: 5,
        chargeDamageMult: 2.2,
        baseKnockback: 120,
        chargeKnockbackMult: 2.5,
        knockbackGrowth: 5.5,
        dashSpeed: 650, // softened from 700 to 650 -- she is fast, but 700 is a bit far for a tiny metal
        rangeW: 65,
        rangeH: 45,
        duration: 200,
        cooldown: 250,
        maxChargeMs: 600,
        teach: 'Lithium ions are incredibly light and mobile, making them ideal for moving quickly between electrodes in modern batteries.'
      },
      specialDefense: {
        name: 'Reactive Armor',
        kind: 'counter',
        counterDamage: 8,
        counterType: 'heat',
        counterKnockback: 190,
        counterKnockbackGrowth: 5,
        duration: 400,
        cooldown: 550,
        teach: 'Lithium metal tarnishes instantly when exposed to air, reacting with nitrogen and moisture in seconds.'
      },
    },
  },

  ben: {
    id: 'ben',
    name: 'Ben',
    element: 'Beryllium',
    symbol: 'Be',
    atomicNumber: 4,
    tagline: 'Perfectly balanced. Barely bends, never breaks.',
    teach: 'Beryllium is exceptionally stiff and lightweight for a metal -- so rigid it barely flexes or vibrates, which is why it’s used in aerospace mirrors and precision gyroscopes.',
    // Gemini-generated (2026-07-30), helen-cut.png used as style reference
    // only (per Benjamin: rotate the reference, don't default to Hydra/
    // flame motifs -- this element's real hook is beryl gemstones/rigidity,
    // not fire). First image came back as a close-up bust; had to explicitly
    // ask for a full-body regeneration to get feet in frame for the sheet
    // pipeline. His hexagonal energy-glow effect genuinely reaches the
    // frame edges in some poses, so the idle sheet is UNCROPPED (full
    // 720x1280 video frame) rather than tightly cropped like the others --
    // cropping would have clipped the glow. footY/visibleH below are a
    // visual estimate from one frame rather than the usual bbox
    // measurement, worth double-checking on screen.
    art: {
      key: 'char-ben',
      file: 'art-src/ben-cut.png',
      facing: 1,
      height: 125,
      bodyW: 42,
      bodyH: 106,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 720,
        frameH: 1280,
        footY: 0.9336,
        visibleH: 1180,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
          walk: { count: 33, fps: 10, loop: true, frameW: 416, frameH: 700, footY: 0.9943, visibleH: 669 },
        },
      },
    },
    stats: {
      speed: 300,
      jumpVelocity: 650,
      airJumps: 2,          // perfectly balanced -- gyroscope-steady in the air
      weight: 0.85,
      gravityScale: 1.0,
    },
    // extremely rigid + high melting point (1287°C) -> strong kinetic and
    // heat defense; beryllium is actually a decent thermal/electrical
    // conductor -> respectable current defense too -- a well-rounded tank
    defense: { heat: 4, physical: 5, electrical: 4, chemical: 0 },
    palettes: [
      { name: 'Emerald',  skin: 0xf0e4d8, body: 0xc4cdd6, accent: 0x2fd6a0, eye: 0x1a3a2e },
      { name: 'Aquamarine', skin: 0xf0e4d8, body: 0xc4cdd6, accent: 0x2fa8d6, eye: 0x1a2e3a },
      { name: 'Slate',    skin: 0xe6e0d8, body: 0x8a8f96, accent: 0x5c6470, eye: 0x1a1a1e },
      { name: 'Rosegold', skin: 0xf0e4d8, body: 0xd6b8a8, accent: 0xd6702f, eye: 0x3a201a },
    ],
    body: {
      // fallback proportions if the render is ever missing -- lean, precise build
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 28, armWidth: 10, legLength: 32, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Precision Strike',
        type: 'physical',
        damage: 7,
        baseKnockback: 150,
        knockbackGrowth: 5,
        rangeW: 62,
        rangeH: 44,
        duration: 200,
        cooldown: 250,
      },
      specialDirectional: {
        name: 'Gyro Disc',
        kind: 'projectile',
        type: 'physical',
        damage: 10,
        baseKnockback: 220,
        knockbackGrowth: 6,
        projectileSpeed: 480,
        projectileRadius: 14,
        projectileLife: 700,
        duration: 260,
        cooldown: 380,
        teach: 'Beryl, the mineral form of beryllium, is the base of both emerald (green) and aquamarine (blue) gemstones.',
      },
      basicCharge: {
        name: 'Resonant Strike',
        kind: 'melee',
        type: 'physical',
        damage: 8,
        chargeDamageMult: 2.0,
        baseKnockback: 160,
        chargeKnockbackMult: 2.4,
        knockbackGrowth: 5.5,
        rangeW: 70,
        rangeH: 48,
        duration: 250,
        cooldown: 300,
        maxChargeMs: 750,
        teach: 'Beryllium copper alloys are tough and non-sparking, used for tools in explosive environments like oil rigs.'
      },
      specialDefense: {
        name: 'Rigid Stance',
        kind: 'block',
        damageReduction: 0.65, // slightly less than Carter/Titan (0.7 / 0.6) for balance + fantasy of rigid vs plate armor
        duration: 500,
        cooldown: 600,
        teach: 'Beryllium is exceptionally stiff and lightweight for a metal, making it the perfect material for precision gyroscopes.'
      },
    },
  },

  bord: {
    id: 'bord',
    name: 'Bord',
    element: 'Boron',
    symbol: 'B',
    atomicNumber: 5,
    tagline: 'Immovable. Nothing gets through.',
    teach: 'Boron carbide is one of the hardest known materials on Earth -- hard enough for tank armor and bulletproof vests.',
    // Gemini-generated (2026-07-30), titan-cut.png used as style reference
    // only. Gemini took real creative liberty on the color brief (asked
    // for dark charcoal-black + amber, got charcoal/brown rock armor with
    // glowing green energy lines -- it explained this as boron's real
    // flame-test color, which is accurate and reads great, so kept it
    // rather than fighting for the original ask). He also came out
    // gripping a crystal maul despite "no weapon" in the brief; kept that
    // too since it fits the tank/smasher concept naturally.
    art: {
      key: 'char-bord',
      file: 'art-src/bord-cut.png',
      facing: 1,
      height: 120,
      bodyW: 50,
      bodyH: 102,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 639,
        frameH: 720,
        footY: 0.9807,
        visibleH: 672,
        clips: {
          // idle + walk (Gemini). Other clips still fall back to idle.
          idle: { count: 14, fps: 3.6, loop: true },
          walk: { count: 33, fps: 10, loop: true, frameW: 1261, frameH: 748, footY: 0.9840, visibleH: 720 },
        },
      },
    },
    stats: {
      speed: 210,           // slowest on the roster -- immovable tank
      jumpVelocity: 560,
      airJumps: 0,           // too heavy/grounded for a double jump
      weight: 1.30,          // heaviest on the roster
      gravityScale: 1.15,
    },
    // one of the hardest known materials -> highest kinetic defense on the
    // roster; boron carbide's melting point is over 2700°C -> very strong
    // heat defense; boron absorbs neutrons in reactor control rods (soaks
    // up dangerous energy) -> strong current defense too -- a pure wall
    defense: { heat: 7, physical: 8, electrical: 6, chemical: 0 },
    palettes: [
      { name: 'Emerald',  skin: 0xc9a889, body: 0x3a3f42, accent: 0x3ad66a, eye: 0x1a3a22 },
      { name: 'Amber',    skin: 0xc9a889, body: 0x5c4530, accent: 0xd6822f, eye: 0x3a2410 },
      { name: 'Sapphire', skin: 0xc9a889, body: 0x3a3f42, accent: 0x2f8ad6, eye: 0x102a3a },
      { name: 'Crimson',  skin: 0xc9a889, body: 0x3a3f42, accent: 0xd6302f, eye: 0x3a1010 },
    ],
    body: {
      // fallback proportions if the render is ever missing -- squat and broad
      headRadius: 24, torsoWidth: 52, torsoHeight: 42,
      armLength: 26, armWidth: 14, legLength: 24, legWidth: 15, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Crystal Smash',
        type: 'physical',
        damage: 10,
        baseKnockback: 165,
        knockbackGrowth: 5,
        rangeW: 66,
        rangeH: 48,
        duration: 340,   // slowest swing on the roster -- heavy wind-up
        cooldown: 160,
      },
      specialDirectional: {
        name: 'Ground Shatter',
        kind: 'burst', // radial shockwave from slamming his maul down
        type: 'physical',
        damage: 14,
        baseKnockback: 260,
        knockbackGrowth: 7,
        radius: 90,
        duration: 340,
        cooldown: 420,
        teach: 'Boron is used in nuclear reactor control rods because it absorbs neutrons so effectively -- it soaks up and stops dangerous energy.',
      },
      basicCharge: {
        name: 'Heavy Ram',
        kind: 'dash',
        type: 'physical',
        damage: 12,
        chargeDamageMult: 1.8,
        baseKnockback: 200,
        chargeKnockbackMult: 2.6,
        knockbackGrowth: 6.5,
        dashSpeed: 450,
        rangeW: 90,
        rangeH: 100,
        duration: 400,
        cooldown: 600,
        maxChargeMs: 1200,
        teach: 'Boron carbide is one of the hardest known materials on Earth, widely used as armor plating in military vehicles.'
      },
      specialDefense: {
        name: 'Boron Carbide Wall',
        kind: 'wall',
        wallDamage: 5,
        wallType: 'physical',
        wallKnockback: 150,
        wallKnockbackGrowth: 5,
        wallRangeW: 30,
        wallRangeH: 100,
        wallYFrac: 0.75,
        duration: 550,
        cooldown: 800,
        teach: 'Boron forms incredibly strong covalent networks, making it the bedrock of super-hard ceramics.'
      },
    },
  },
  carter: {
    id: 'carter',
    name: 'Carter',
    element: 'Carbon',
    symbol: 'C',
    atomicNumber: 6,
    tagline: 'Same atoms, different arrangement -- infinitely tough.',
    teach: 'Carbon can form both the hardest natural material (diamond) and one of the softest (graphite), depending only on how its atoms are arranged.',
    // Gemini-generated (2026-07-30 concept art, 2026-07-31 idle video),
    // bord-cut.png used as style reference only. Carbon-fiber armor +
    // diamond-crystal fist + smoky dark aura, themed on diamond hardness.
    // Native render leans/lunges toward the viewer's LEFT (crystal fist
    // and front knee both lead left) -- initially recorded facing -1, but
    // Benjamin's playtest (2026-07-31, session 8) confirmed he reads
    // backwards in-game (attacks land correctly since those are driven by
    // Fighter.facing, independent of the sprite) -- flipped to 1.
    art: {
      key: 'char-carter',
      file: 'art-src/carter-cut.png',
      facing: 1,
      height: 120,
      bodyW: 43,
      bodyH: 104,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 928,
        frameH: 720,
        footY: 0.9818,
        visibleH: 679,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: {
      speed: 260,
      jumpVelocity: 600,
      airJumps: 1,
      weight: 1.05,
      gravityScale: 1.05,
    },
    // diamond is the hardest known natural material -> top kinetic defense
    // on the roster; carbon doesn't melt at normal pressure, it sublimes
    // above 3600C -> very strong heat defense; graphite (also pure carbon)
    // is an unusually good conductor for a nonmetal -> moderate current defense
    defense: { heat: 8, physical: 9, electrical: 6, chemical: 0 },
    palettes: [
      { name: 'Onyx',    skin: 0xceb192, body: 0x2b2e33, accent: 0xd6b23a, eye: 0x1a1a1c },
      { name: 'Sapphire', skin: 0xceb192, body: 0x2b2e33, accent: 0x2f8ad6, eye: 0x102a3a },
      { name: 'Crimson', skin: 0xceb192, body: 0x2b2e33, accent: 0xd6302f, eye: 0x3a1010 },
      { name: 'Emerald', skin: 0xceb192, body: 0x2b2e33, accent: 0x3ad66a, eye: 0x1a3a22 },
    ],
    body: {
      headRadius: 22, torsoWidth: 42, torsoHeight: 44,
      armLength: 28, armWidth: 12, legLength: 27, legWidth: 13, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Diamond Cross',
        type: 'physical',
        damage: 9,
        baseKnockback: 160,
        knockbackGrowth: 5.4,
        rangeW: 62,
        rangeH: 46,
        duration: 260,
        cooldown: 140,
      },
      specialDirectional: {
        name: 'Graphene Wave',
        kind: 'burst', // radial shockwave, current-typed (graphite conducts)
        type: 'electrical',
        damage: 13,
        baseKnockback: 245,
        knockbackGrowth: 6.6,
        radius: 88,
        duration: 320,
        cooldown: 400,
        teach: 'Graphite -- just carbon atoms arranged in flat sheets -- conducts electricity well enough to be used in batteries and electrodes, unusual for a nonmetal.',
      },
      basicCharge: {
        name: 'Diamond Shard',
        kind: 'projectile',
        type: 'physical',
        damage: 8,
        chargeDamageMult: 2.5,
        baseKnockback: 180,
        chargeKnockbackMult: 2.2,
        knockbackGrowth: 5.5,
        projectileSpeed: 550,
        projectileRadius: 10,
        projectileLife: 650,
        duration: 280,
        cooldown: 350,
        maxChargeMs: 800,
        teach: 'Diamond is formed from pure carbon subjected to intense heat and pressure deep within the Earth.'
      },
      specialDefense: {
        name: 'Diamond Plating',
        kind: 'block',
        damageReduction: 0.7,
        duration: 480,
        cooldown: 550,
        teach: 'Diamond is the hardest known natural material, capable of scratching almost any other surface.'
      },
    },
  },
  nitra: {
    id: 'nitra',
    name: 'Nitra',
    element: 'Nitrogen',
    symbol: 'N',
    atomicNumber: 7,
    tagline: 'Cold enough to freeze anything solid.',
    teach: 'Liquid nitrogen is so cold (-196C / -321F) that labs use it to instantly freeze and preserve samples.',
    // Gemini-generated (2026-07-30 concept art, 2026-07-31 idle video).
    // Cyan/teal ice-crystal fist + whirlwind/tornado aura, themed on
    // liquid nitrogen's extreme cold. Native render leans/lunges toward
    // the viewer's LEFT (crystal fist and lead leg both forward-left) --
    // recorded facing -1, verify on screen and flip if she reads backwards.
    art: {
      key: 'char-nitra',
      file: 'art-src/nitra-cut.png',
      facing: -1,
      height: 120,
      bodyW: 38,
      bodyH: 102,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 982,
        frameH: 702,
        footY: 0.9721,
        visibleH: 657,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: {
      speed: 330,
      jumpVelocity: 660,
      airJumps: 1,
      weight: 0.9,
      gravityScale: 1.0,
    },
    // nitrogen gas is famously stable/inert (its triple bond makes up 78%
    // of the air we breathe without reacting) -> solid all-round defense
    // without being a tank; poor electrical conductor -> weak current defense
    defense: { heat: 5, physical: 5, electrical: 3, chemical: 0 },
    palettes: [
      { name: 'Glacier', skin: 0xe3eef5, body: 0x39415c, accent: 0x4ad6d0, eye: 0x1c8a86 },
      { name: 'Violet',  skin: 0xe8e3f5, body: 0x3f395c, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Crimson', skin: 0xf5e3e6, body: 0x5c393f, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Amber',   skin: 0xf5eee3, body: 0x5c4f39, accent: 0xd6a02f, eye: 0x8a5f10 },
    ],
    body: {
      headRadius: 21, torsoWidth: 36, torsoHeight: 42,
      armLength: 28, armWidth: 10, legLength: 30, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Frost Fang',
        type: 'physical',
        damage: 8,
        baseKnockback: 155,
        knockbackGrowth: 5.2,
        rangeW: 60,
        rangeH: 44,
        duration: 240,
        cooldown: 140,
      },
      specialDirectional: {
        name: 'Cryo Vortex',
        kind: 'burst', // radial blast of liquid-nitrogen cold
        type: 'heat',  // the game's damage types are heat/current/kinetic -- extreme cold reads as a heat-axis attack
        damage: 12,
        baseKnockback: 235,
        knockbackGrowth: 6.2,
        radius: 86,
        duration: 300,
        cooldown: 380,
        teach: 'Nitrogen makes up about 78% of the air around you right now -- you just cannot normally see, smell, or feel it.',
      },
      basicCharge: {
        name: 'Nitrogen Rush',
        kind: 'dash',
        type: 'physical',
        damage: 7,
        chargeDamageMult: 2.1,
        baseKnockback: 150,
        chargeKnockbackMult: 2.4,
        knockbackGrowth: 5.8,
        dashSpeed: 600,
        rangeW: 80,
        rangeH: 60,
        duration: 250,
        cooldown: 300,
        maxChargeMs: 700,
        teach: 'Liquid nitrogen expands to nearly 700 times its volume when it boils into a gas, creating an explosive rush of pressure.'
      },
      specialDefense: {
        name: 'Inert Shield',
        kind: 'shield',
        duration: 1200,
        cooldown: 600,
        teach: 'Nitrogen gas is extremely stable and unreactive because its atoms are held together by a powerful triple bond.'
      },
    },
  },

  oxana: {
    id: 'oxana',
    name: 'Oxana',
    element: 'Oxygen',
    symbol: 'O',
    atomicNumber: 8,
    tagline: 'Fast, sharp, and everywhere at once.',
    teach: 'Oxygen makes up about 21% of the air we breathe and is the gas that makes fire possible -- nothing burns without it.',
    // Session 11 (2026-08-01): Benjamin generated the idle video himself via
    // Gemini's Videos tool after the automated Chrome pipeline kept losing
    // track of the conversation. Same idle-only sheet treatment as the rest
    // of the roster. Her pose is fairly frontal/dynamic (a mid-kick splash
    // art) rather than a clean side profile -- facing is a best guess (1,
    // right), same situation Lillie's render was in; verify on screen and
    // flip if she reads backwards.
    art: {
      key: 'char-oxana',
      file: 'art-src/oxana-cut.png',
      facing: 1,
      height: 124,
      bodyW: 37,
      bodyH: 104,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 686,
        frameH: 717,
        footY: 0.9744,
        visibleH: 666,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: {
      speed: 350,           // O2 gas -- fast, agile striker
      jumpVelocity: 670,
      airJumps: 2,          // wind/vortex theme -- agile in the air like Helen
      weight: 0.75,
      // real chemistry note: O2 (molar mass 32) is actually much heavier
      // than the H2/He already in the roster (2 and 4), despite all three
      // being gases -- so she's fast and light, but not floaty like Helen.
      gravityScale: 0.95,
    },
    // oxygen is literally what makes fire burn -- weak heat defense fits
    // both the theme and real chemistry; a gas has no inherent hardness ->
    // weak-moderate kinetic; molecular oxygen doesn't conduct -> middling
    // current defense. Overall a fast glass-cannon striker, not a tank.
    defense: { heat: 2, physical: 3, electrical: 4, chemical: 0 },
    palettes: [
      { name: 'Arctic',   skin: 0xe3eef5, body: 0xc7d3db, accent: 0x4ad6d0, eye: 0x1c8a86 },
      { name: 'Violet',   skin: 0xe8e3f5, body: 0xb8b0c7, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Crimson',  skin: 0xf5e3e6, body: 0xdbc7ca, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Amber',    skin: 0xf5eee3, body: 0xdbd0c1, accent: 0xd6a02f, eye: 0x8a5f10 },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Vortex Kick',
        type: 'physical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.2,
        rangeW: 64,
        rangeH: 46,
        duration: 200,   // fast, kick-based striker
        cooldown: 100,
      },
      specialDirectional: {
        name: 'Oxidation Burst',
        kind: 'burst', // radial blast, self-centered like H-Burst/Cryo Vortex
        type: 'heat',
        damage: 12,
        baseKnockback: 235,
        knockbackGrowth: 6.2,
        radius: 88,
        duration: 300,
        cooldown: 380,
        teach: 'Pure oxygen makes fires burn dramatically hotter and faster -- firefighters and hospitals handle oxygen tanks with extreme care for exactly this reason.',
      },
    },
  },

  flora: {
    id: 'flora',
    name: 'Flora',
    element: 'Fluorine',
    symbol: 'F',
    atomicNumber: 9,
    tagline: 'Nothing stays inert around her.',
    teach: 'Fluorine is the most chemically reactive element on the periodic table -- it will corrode through glass and steel, so it has to be stored in specialized equipment.',
    // Session 12 (2026-08-01): idle video generated via the automated Chrome
    // pipeline in one clean pass, no drift across the 40 sampled frames.
    // Her reference pose is a dynamic leaping/running shot rather than a
    // clean side profile -- facing is a best guess (1, right) like Lillie's
    // and Oxana's renders were; verify on screen and flip if she reads
    // backwards.
    art: {
      key: 'char-flora',
      file: 'art-src/flora-cut.png',
      facing: 1,
      height: 124,
      bodyW: 37,
      bodyH: 104,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 852,
        frameH: 696,
        footY: 0.9713,
        visibleH: 642,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: {
      speed: 360,            // most reactive element -- twitchy, always-on aggression
      jumpVelocity: 650,
      airJumps: 1,            // ground-based striker, not an aerial/floaty character
      weight: 0.78,
      // real chemistry note: F2 gas (molar mass 38) is heavier than the O2
      // (32) already in the roster, so she's not feather-light like Oxana --
      // just fast and volatile.
      gravityScale: 1.0,
    },
    // fluorine reacts violently with almost everything and has no stable
    // compounds that resist it -- a glass-cannon defense profile, the
    // lowest total defense on the roster so far, to match "the most
    // reactive element" being the least able to just shrug off a hit.
    defense: { heat: 2, physical: 3, electrical: 2, chemical: 0 },
    palettes: [
      { name: 'Halogen',  skin: 0xf0dcc5, body: 0x2a331f, accent: 0xd4e857, eye: 0x3a7a8c },
      { name: 'Violet',   skin: 0xe8e3f5, body: 0x342b47, accent: 0xa06fe8, eye: 0x4c2f9e },
      { name: 'Crimson',  skin: 0xf5e3e6, body: 0x47222a, accent: 0xe0435a, eye: 0x8a1c22 },
      { name: 'Amber',    skin: 0xf5eee3, body: 0x40331a, accent: 0xe0a02f, eye: 0x8a5f10 },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Etching Jab',
        type: 'electrical',
        damage: 7,
        baseKnockback: 140,
        knockbackGrowth: 4.8,
        rangeW: 58,
        rangeH: 42,
        duration: 170,   // very fast, low-cooldown rapid striker
        cooldown: 90,
      },
      specialDirectional: {
        name: 'Radical Cascade',
        kind: 'burst', // sudden violent self-centered detonation
        type: 'physical',
        damage: 13,
        baseKnockback: 240,
        knockbackGrowth: 6.4,
        radius: 90,
        duration: 300,
        cooldown: 380,
        teach: 'Fluorine is so reactive it can even react with the "unreactive" noble gases under the right conditions -- something almost no other element can do.',
      },
    },
  },

  neo: {
    id: 'neo',
    name: 'Neo',
    element: 'Neon',
    symbol: 'Ne',
    atomicNumber: 10,
    tagline: 'Every stage needs a spotlight -- his is electric.',
    teach: 'Neon is a noble gas that barely reacts with anything -- but run an electric current through it and it glows a brilliant red-orange, which is exactly how neon signs work.',
    // Session 12 (2026-08-01): idle video generated cleanly (40/40 frames
    // on-brief). His metallic silver armor turned out to be close enough in
    // color to the video's gray-vignette backdrop that the normal
    // fixed-threshold keying either left background residue or bled into
    // the armor depending on threshold -- fixed by adding a gradient-
    // tolerant keying mode (keyBackgroundGradient in tools/sheet-lib.js)
    // that grows the erased region neighbor-to-neighbor instead of against
    // a fixed sampled color, so it follows the smooth backdrop gradient but
    // stops at the character's hard-edged outline. Worth trying that mode
    // first for any other metallic/gray-armored character (Silas, Allen).
    // Facing is a best guess (1, right) -- his render is a dynamic
    // leaping/running pose, not a clean profile, same situation as
    // Lillie/Oxana/Flora.
    // Session 14 (2026-08-03): first idle video had his lower legs/feet
    // cropped out of every frame (same bug Natalie hit) -- regenerated with
    // an explicit "zoom out, don't crop his feet" prompt via Gemini's
    // dedicated Videos tool. New sheet keyed clean with the same gradient
    // mode; old cropped-feet sheet kept at
    // art-src/gemini-test/sheets/_old/neo_idle_cropped-feet.png in case of
    // regressions. footY moved from 0.9986 (feet right at the frame edge,
    // the bug) to 0.9704 (real margin below his feet now).
    art: {
      key: 'char-neo',
      file: 'art-src/neo-cut.png',
      facing: 1,
      height: 132,
      bodyW: 38,
      bodyH: 116,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 508,
        frameH: 704,
        footY: 0.9704,
        visibleH: 655,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: {
      speed: 300,
      jumpVelocity: 620,
      airJumps: 1,
      weight: 0.95,
      gravityScale: 1.0,
    },
    // noble gas -> practically inert, resists reacting to anything -- a
    // sturdy defense profile especially against heat/kinetic (same logic
    // as Helen's "inert = shrugs off heat"), but current is his own
    // showman gimmick (he channels electricity rather than resisting it)
    // so that defense stays only average.
    defense: { heat: 4, physical: 3, electrical: 2, chemical: 0 },
    // palette names are a nod to real neon-sign chemistry: different noble
    // gases sealed in a tube glow different colors under current -- neon
    // itself is the classic red-orange, argon reads blue-violet, krypton a
    // pale yellow-green, xenon a deep blue-violet.
    palettes: [
      { name: 'Neon',    skin: 0xead9c2, body: 0x8f95a0, accent: 0xff6a2e, eye: 0x2e6fa8 },
      { name: 'Argon',   skin: 0xe8e3f5, body: 0x7a7f95, accent: 0x6a8cff, eye: 0x2f4f9e },
      { name: 'Krypton', skin: 0xf0ead0, body: 0x8a9585, accent: 0x9ee87a, eye: 0x3f7a3a },
      { name: 'Xenon',   skin: 0xe3e8f5, body: 0x8085a0, accent: 0x9a6aff, eye: 0x4f2f9e },
    ],
    body: {
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 29, armWidth: 11, legLength: 32, legWidth: 12, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Staff Crack',
        type: 'electrical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 66,   // longer reach -- he's fighting with a staff, not bare hands
        rangeH: 40,
        duration: 210,
        cooldown: 130,
      },
      specialDirectional: {
        name: 'Neon Flare',
        kind: 'burst',
        type: 'electrical',
        damage: 12,
        baseKnockback: 230,
        knockbackGrowth: 6.0,
        radius: 90,
        duration: 300,
        cooldown: 380,
        teach: 'Neon signs work by sealing neon gas in a glass tube and passing an electric current through it -- the gas itself is what glows, not a filament like an old lightbulb.',
      },
    },
  },

  // -------------------------------------------------------------------------
  // 2026-08-01 (session 13): the remaining 13 launch characters, added using
  // Benjamin's/Gemini's existing concept-art renders directly (art.file,
  // no sheets/use3d) rather than waiting on more idle videos -- per Benjamin,
  // "put in the photos and we will change it to sprites later". Each still
  // gets the Rig's puppet-animated sprite mode (bob/lean/lunge), just not
  // real per-frame limb animation yet. Facing is a best guess (native art is
  // a dynamic action pose, not a clean side profile, same situation as
  // Lillie/Oxana/Flora/Neo) -- verify on screen and flip if backwards.
  // -------------------------------------------------------------------------
  // Natalie upgraded to a real idle sheet in session 14 (see below) -- her
  // first video (session 12) had cropped boots in every frame, so she ran
  // on the static photo (art.file, spriteMode) until the redo. The other 12
  // in this batch are still static-photo only.

  natalie: {
    id: 'natalie',
    name: 'Natalie',
    element: 'Sodium',
    symbol: 'Na',
    atomicNumber: 11,
    tagline: 'Drop her in water and stand back.',
    teach: 'Sodium metal reacts so violently with water that it can burst into flame -- pure sodium has to be stored away from air and moisture, never left exposed.',
    // Session 14 (2026-08-03): idle video redone (first attempt had her
    // boots cropped out of every frame) -- confirmed clean full-body
    // framing across all 40 sampled frames before keying. Her armor is
    // metallic silver like Neo's, so keyed with the same gradient mode
    // rather than risking fixed-threshold bleed/residue.
    art: {
      key: 'char-natalie',
      file: 'art-src/natalie-cut.png',
      facing: -1,
      height: 128,
      bodyW: 37,
      bodyH: 112,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 496,
        frameH: 699,
        footY: 0.9697,
        visibleH: 650,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 355, jumpVelocity: 640, airJumps: 1, weight: 0.85, gravityScale: 1.0 },
    defense: { heat: 3, physical: 3, electrical: 2, chemical: 0 }, // soft alkali metal -- reactive, not tough
    palettes: [
      { name: 'Flame Test', skin: 0xffe3c9, body: 0xd8d8dc, accent: 0xf5a623, eye: 0x8a5f10 },
      { name: 'Violet',     skin: 0xe8e3f5, body: 0xb8b0c7, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Crimson',    skin: 0xf5e3e6, body: 0xdbc7ca, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Arctic',     skin: 0xe3eef5, body: 0xc7d3db, accent: 0x4ad6d0, eye: 0x1c8a86 },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Flame Fist',
        type: 'heat',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 60,
        rangeH: 42,
        duration: 200,
        cooldown: 110,
      },
      specialDirectional: {
        name: 'Water Reaction',
        kind: 'burst',
        type: 'heat',
        damage: 13,
        baseKnockback: 240,
        knockbackGrowth: 6.2,
        radius: 90,
        duration: 300,
        cooldown: 380,
        teach: 'A small piece of sodium dropped in water skitters across the surface, hisses, and can ignite the hydrogen gas it produces -- one of the classic "look but don\'t touch" chemistry demonstrations.',
      },
    },
  },

  maggie: {
    id: 'maggie',
    name: 'Maggie',
    element: 'Magnesium',
    symbol: 'Mg',
    atomicNumber: 12,
    tagline: 'When she lights up, look away.',
    teach: 'Burning magnesium produces one of the brightest white lights of any common metal -- bright enough that it powered early photography flashbulbs and is still used in flares and fireworks.',
    // Session 15 (2026-08-04): idle video clean on the first try, no drift
    // across all 40 sampled frames, feet fully in frame throughout. Tried
    // gradient mode first (her armor is metallic silver like Neo/Natalie/
    // Allen) but it badly backfired here -- her armor has smooth unoutlined
    // specular highlight streaks down the torso/hip, and gradient mode's
    // neighbor-chained flood fill walked straight through that smooth
    // brightness ramp and ate a large diagonal chunk of real armor detail
    // (caught via the erase-overlay diff technique, not just eyeballing the
    // magenta test -- Benjamin caught the bleed by eye first). Switched to
    // `fixed` mode, which compares each pixel to one reference color so it
    // can't tunnel through a smooth gradient. Her flickering white flare/
    // spark VFX (part of her actual design -- see maggie-cut.png) survived
    // keying intact as bright foreground detail.
    //
    // Session 16 (2026-08-05) fix: the shipped threshold-70 sheet had a real
    // bug invisible in the session-15 checks -- Benjamin reported her armor
    // looking near-black on the character-select screen. The armor's own
    // mid-tone gray shading sits close enough to the sampled flat-gray studio
    // backdrop that at threshold 70 the border-connected flood fill was
    // eating deep into real armor (not just the background), leaving most of
    // her body at the feathered half-alpha (140/255) rather than fully
    // opaque -- invisible on a magenta test/alpha-histogram check (still
    // "clean" 0/140/255 values, per session 15's own verification) but stark
    // on the game's actual near-black UI background, where 55%-opacity light
    // gray reads as near-black. Confirmed by flattening the shipped sheet
    // over the real theme background color (0x0a0e14), not magenta -- the
    // lesson from Neo about magenta being misleading on desaturated
    // characters applies in the opposite direction too, so the real check is
    // flattening on the actual destination background. Rebuilt from the
    // original raw frames at threshold 45 (sweet spot: 20-30 leaves a
    // visible ground-shadow shelf, 60-70 start eating the armor again) --
    // clean across every sampled frame checked both ways.
    art: {
      key: 'char-maggie',
      file: 'art-src/maggie-cut.png',
      facing: 1,
      height: 126,
      bodyW: 35,
      bodyH: 109,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 713,
        frameH: 720,
        footY: 0.9809,
        visibleH: 691,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 330, jumpVelocity: 700, airJumps: 2, weight: 0.72, gravityScale: 0.95 },
    // lightweight metal -- agile and floaty, but burns fast and bright
    // (weak vs heat) rather than shrugging off hits.
    defense: { heat: 2, physical: 4, electrical: 3, chemical: 0 },
    palettes: [
      { name: 'Flare',   skin: 0xead9c2, body: 0xe4e4e8, accent: 0xfff2c9, eye: 0xbfe8ff },
      { name: 'Violet',  skin: 0xe8e3f5, body: 0xb8b0c7, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Crimson', skin: 0xf5e3e6, body: 0xdbc7ca, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Amber',   skin: 0xf5eee3, body: 0xdbd0c1, accent: 0xd6a02f, eye: 0x8a5f10 },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Flare Jab',
        type: 'heat',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 60,
        rangeH: 42,
        duration: 190,
        cooldown: 100,
      },
      specialDirectional: {
        name: 'Blinding Flare',
        kind: 'burst',
        type: 'heat',
        damage: 12,
        baseKnockback: 230,
        knockbackGrowth: 6.0,
        radius: 85,
        duration: 280,
        cooldown: 360,
        teach: 'Magnesium alloys are prized in aerospace and car parts for being both lightweight and strong -- useful right up until the metal itself catches fire, which burns fiercely and is very hard to put out with water.',
      },
    },
  },

  allen: {
    id: 'allen',
    name: 'Allen',
    element: 'Aluminum',
    symbol: 'Al',
    atomicNumber: 13,
    tagline: 'Light, tough, and impossible to wear down.',
    teach: 'Aluminum reacts instantly with oxygen in the air to form a paper-thin, invisible layer of aluminum oxide on its surface -- that layer is what actually protects the metal underneath from corroding.',
    // Session 15 (2026-08-04): idle video came out clean on the first try --
    // no drift off-brief across all 40 sampled frames, feet fully in frame
    // throughout. Metallic silver armor like Neo/Natalie, so keyed with the
    // same gradient mode. The swirling blue energy aura survived keying
    // intact -- confirmed it's part of Allen's actual design (present in
    // his static allen-cut.png too), not a Gemini hallucination to strip.
    //
    // Session 16 (2026-08-05) fix: same near-black-armor bug as Maggie, found
    // during a full-roster sweep after fixing hers, but a genuinely harder
    // case -- his mid-tone metallic gray armor doesn't just sit CLOSE to the
    // sampled backdrop gray at the edges, it directly OVERLAPS it in absolute
    // value over a large area (confirmed by bucketing raw pixel gray-levels
    // in his torso/limb region: literally 100% of pixels in the 100-160 gray
    // band were being erased). No fixed threshold or gradient tolerance could
    // separate them by color alone -- swept both modes from very loose to
    // very tight and his armor stayed near-black throughout, since color
    // distance alone can't tell "this pixel is background" from "this pixel
    // is armor that happens to render the same gray" (verified by flattening
    // over the real theme background, not magenta -- see Maggie's fix above
    // for why that check matters). Added `keyBackgroundEdgeGated` to
    // sheet-lib.js (new `edge` mode in build-sheet.js): gates the flood-fill's
    // CONNECTIVITY on local gradient in addition to color distance, so it
    // can't tunnel across his ink outline strokes the way plain color
    // distance could. Also had to extend the SAME gate to the enclosed-
    // pocket cleanup pass (normally color-only) -- his swirling aura leaves a
    // large enclosed disk of genuine flat background between the aura ring
    // and his silhouette, comparable in pixel count to his own torso, so a
    // size-based cutoff couldn't separate them either; gating pocket cleanup
    // on gradient too correctly keeps the flat disk (erased) distinct from
    // his shaded armor (protected, since it has real linework/shading
    // breaks). First rebuild (colorThreshold 60, gradThreshold 18,
    // pocketThreshold 60) looked clean at character scale but Benjamin
    // zoomed in and caught a second bug the same session: the gradient-gated
    // pocket pass was ALSO erasing hundreds of tiny enclosed pixels one at a
    // time -- his own recessed shading grooves and the aura's own dark
    // sub-strokes are each individually small, locally flat, and near the
    // backdrop centroid, so each one qualified as its own tiny "pocket" and
    // got wiped out, leaving a peppered/moth-eaten look throughout the armor
    // and aura that a quick glance at full character scale didn't reveal.
    // Fixed by adding a minimum-size gate to the pocket pass (`minPocketSize`
    // param, swept 0/100/200/400/800/1500/3000 -- peppering visibly clears by
    // 800-1500) so only pockets in the thousands-of-pixels range (the real
    // aura-disk gap) get erased, not tens-to-hundreds-of-pixel shading
    // detail. Rebuilt again with minPocketSize 1500 -- checked this time with
    // actual zoomed crops on the armor and aura, not just a character-scale
    // glance.
    art: {
      key: 'char-allen',
      file: 'art-src/allen-cut.png',
      facing: -1,
      height: 134,
      bodyW: 38,
      bodyH: 118,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 922,
        frameH: 720,
        footY: 0.9896,
        visibleH: 696,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 345, jumpVelocity: 660, airJumps: 1, weight: 0.8, gravityScale: 1.0 },
    // protective oxide layer -> a solid, well-rounded all-purpose defense,
    // not a specialist tank or glass cannon.
    defense: { heat: 3, physical: 4, electrical: 4, chemical: 0 },
    palettes: [
      { name: 'Turbine', skin: 0xead9c2, body: 0x8f95a0, accent: 0x6ac8ff, eye: 0x2f6f9e },
      { name: 'Violet',  skin: 0xe8e3f5, body: 0x7a7f95, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Crimson', skin: 0xf5e3e6, body: 0x8a7075, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Jade',    skin: 0xe3f5ea, body: 0x7a958a, accent: 0x3fc98a, eye: 0x1c7a4e },
    ],
    body: {
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 29, armWidth: 11, legLength: 32, legWidth: 12, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Turbine Strike',
        type: 'physical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 62,
        rangeH: 42,
        duration: 200,
        cooldown: 110,
      },
      specialDirectional: {
        name: 'Turbine Vortex',
        kind: 'burst',
        type: 'electrical',
        damage: 12,
        baseKnockback: 225,
        knockbackGrowth: 6.0,
        radius: 85,
        duration: 290,
        cooldown: 370,
        teach: 'Aluminum is the most abundant metal in Earth\'s crust and one of the most recycled materials on the planet -- recycling it uses only about 5% of the energy needed to make new aluminum from raw ore.',
      },
    },
  },

  silas: {
    id: 'silas',
    name: 'Silas',
    element: 'Silicon',
    symbol: 'Si',
    atomicNumber: 14,
    tagline: 'Every circuit in the world speaks his language.',
    teach: 'Silicon is the material almost every computer chip on Earth is built from -- its semiconductor properties, conducting electricity only under the right conditions, make modern electronics possible.',
    // Session 15 (2026-08-04): idle video was portrait orientation (720x1280,
    // unlike every other character's 1280x720 landscape), and Benjamin
    // flagged his hair clips off the top edge in most frames -- confirmed
    // frame_01 has his forehead/hair visibly cropped (an intro transition
    // frame), but the real problem ran deeper: even frames that LOOK fine
    // have hair spikes touching y=0 exactly, which poisoned the background
    // color sampling (kmeans2 picked up hair color as a fake "background"
    // centroid) and caused his hair to be erased wholesale wherever it
    // appeared elsewhere in the frame. Fixed at the tool level, not just by
    // avoiding frames -- see tools/sheet-lib.js's sampleCleanBorder() and the
    // now-gated border seeding in keyBackgroundGradient(). Also hit 3 frames
    // (19, 20, 22, 23) with an unrelated one-off keying glitch that ate his
    // forward leg's shin/boot even though the raw source frame was clean;
    // found by scanning per-frame opaque-pixel fraction in that leg's bbox
    // across all 40 frames and excluding the outliers rather than guessing.
    // Keyed with gradient mode (crisp black panel outlines everywhere, same
    // category as Allen/Neo -- unlike Maggie's smooth-highlight problem).
    art: {
      key: 'char-silas',
      file: 'art-src/silas-cut.png',
      facing: 1,
      height: 136,
      bodyW: 38,
      bodyH: 120,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 720,
        frameH: 1280,
        footY: 0.9938,
        visibleH: 1270,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 320, jumpVelocity: 630, airJumps: 1, weight: 0.95, gravityScale: 1.0 },
    // crystalline and glassy -- fairly hard, but a poor conductor (chips
    // only conduct under precise conditions, not a blunt defense).
    defense: { heat: 3, physical: 4, electrical: 2, chemical: 0 },
    palettes: [
      { name: 'Si-Core',      skin: 0xead9c2, body: 0x24262e, accent: 0x4ad6ff, eye: 0x1c5f9e },
      { name: 'Amber Core',   skin: 0xead9c2, body: 0x2e2820, accent: 0xf5a623, eye: 0x8a5f10 },
      { name: 'Violet Core',  skin: 0xead9c2, body: 0x2a2430, accent: 0xa06fe8, eye: 0x4c2f9e },
      { name: 'Crimson Core', skin: 0xead9c2, body: 0x301f22, accent: 0xe0435a, eye: 0x8a1c22 },
    ],
    body: {
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 29, armWidth: 11, legLength: 32, legWidth: 12, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Crystal Blade',
        type: 'physical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 58,
        rangeH: 40,
        duration: 190,
        cooldown: 100,
      },
      specialDirectional: {
        name: 'Binary Surge',
        kind: 'burst',
        type: 'electrical',
        damage: 13,
        baseKnockback: 235,
        knockbackGrowth: 6.2,
        radius: 85,
        duration: 300,
        cooldown: 380,
        teach: 'Pure silicon has to be almost perfectly crystal-pure -- 99.9999999% pure -- before it\'s usable in a computer chip; even a handful of stray atoms can ruin a chip\'s performance.',
      },
    },
  },

  phillip: {
    id: 'phillip',
    name: 'Phillip',
    element: 'Phosphorus',
    symbol: 'P',
    atomicNumber: 15,
    tagline: 'Named for glowing in the dark -- and he never stopped.',
    teach: 'Phosphorus is where the word "phosphorescence" comes from -- white phosphorus glows faintly green in the dark and can even catch fire spontaneously in open air, which is why it\'s stored underwater.',
    art: {
      key: 'char-phillip',
      file: 'art-src/phillip-cut.png',
      facing: 1,
      height: 134,
      bodyW: 38,
      bodyH: 118,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 392,
        frameH: 716,
        footY: 0.9722,
        visibleH: 670,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 325, jumpVelocity: 640, airJumps: 1, weight: 0.85, gravityScale: 1.0 },
    defense: { heat: 2, physical: 3, electrical: 3, chemical: 0 }, // ignites spontaneously in air -- weak vs heat
    palettes: [
      { name: 'Phosphor', skin: 0xead9c2, body: 0x22262a, accent: 0x8af5a0, eye: 0x2f8a5f },
      { name: 'Violet',   skin: 0xe8e3f5, body: 0x2a2430, accent: 0xa06fe8, eye: 0x4c2f9e },
      { name: 'Crimson',  skin: 0xf5e3e6, body: 0x301f22, accent: 0xe0435a, eye: 0x8a1c22 },
      { name: 'Amber',    skin: 0xf5eee3, body: 0x2e2820, accent: 0xf5a623, eye: 0x8a5f10 },
    ],
    body: {
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 29, armWidth: 11, legLength: 32, legWidth: 12, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Glow Strike',
        type: 'physical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 60,
        rangeH: 42,
        duration: 200,
        cooldown: 110,
      },
      specialDirectional: {
        name: 'Spontaneous Ignition',
        kind: 'burst',
        type: 'heat',
        damage: 13,
        baseKnockback: 235,
        knockbackGrowth: 6.2,
        radius: 85,
        duration: 300,
        cooldown: 380,
        teach: 'Phosphorus is essential to life -- it\'s a key part of DNA, ATP (the molecule cells use for energy), and the calcium phosphate that makes bones and teeth hard.',
      },
    },
  },

  sully: {
    id: 'sully',
    name: 'Sully',
    element: 'Sulfur',
    symbol: 'S',
    atomicNumber: 16,
    tagline: 'Brimstone given a body -- slow, heavy, and always smoking.',
    teach: 'Sulfur is "brimstone" from old texts -- a bright yellow solid found near volcanoes, famous for the rotten-egg smell of some of its compounds.',
    art: {
      key: 'char-sully',
      file: 'art-src/sully-cut.png',
      facing: 1,
      height: 148,
      bodyW: 50,
      bodyH: 136,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 592,
        frameH: 681,
        footY: 0.9695,
        visibleH: 622,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 260, jumpVelocity: 560, airJumps: 0, weight: 1.35, gravityScale: 1.15 },
    // rocky lava-golem tank -- the toughest defense on the roster so far.
    defense: { heat: 6, physical: 7, electrical: 3, chemical: 0 },
    palettes: [
      { name: 'Brimstone', skin: 0xd6a02f, body: 0xc8941f, accent: 0xff6a2e, eye: 0x8a1c10 },
      { name: 'Ash',       skin: 0x9a9a9a, body: 0x6a6a6a, accent: 0xff6a2e, eye: 0x3a1710 },
      { name: 'Obsidian',  skin: 0x4a4a52, body: 0x2a2a30, accent: 0x4ad6ff, eye: 0x1c5f9e },
      { name: 'Ember',     skin: 0xd6a02f, body: 0x8a5a1f, accent: 0xd6303a, eye: 0x8a1c22 },
    ],
    body: {
      headRadius: 24, torsoWidth: 48, torsoHeight: 54,
      armLength: 32, armWidth: 15, legLength: 28, legWidth: 16, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Brimstone Slam',
        type: 'physical',
        damage: 10,
        baseKnockback: 170,
        knockbackGrowth: 5.6,
        rangeW: 70,
        rangeH: 50,
        duration: 260,
        cooldown: 160,
      },
      specialDirectional: {
        name: 'Volcanic Eruption',
        kind: 'burst',
        type: 'heat',
        damage: 15,
        baseKnockback: 250,
        knockbackGrowth: 6.8,
        radius: 100,
        duration: 340,
        cooldown: 420,
        teach: 'Sulfur has been used for thousands of years to make gunpowder and, more recently, to vulcanize rubber -- a process invented by Charles Goodyear that makes rubber far more durable.',
      },
    },
  },

  chloe: {
    id: 'chloe',
    name: 'Chloe',
    element: 'Chlorine',
    symbol: 'Cl',
    atomicNumber: 17,
    tagline: 'Clean, sharp, and not to be underestimated.',
    teach: 'Chlorine gas is what keeps swimming pools and drinking water safe -- added in small, carefully controlled amounts, it kills the bacteria and germs that would otherwise make the water unsafe.',
    art: {
      key: 'char-chloe',
      file: 'art-src/chloe-cut.png',
      facing: -1,
      height: 128,
      bodyW: 35,
      bodyH: 110,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 395,
        frameH: 700,
        footY: 0.9744,
        visibleH: 660,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 335, jumpVelocity: 650, airJumps: 1, weight: 0.82, gravityScale: 1.0 },
    defense: { heat: 3, physical: 2, electrical: 3, chemical: 0 }, // reactive halogen gas -- not tough
    palettes: [
      { name: 'Toxic',   skin: 0xead9c2, body: 0xe4e4e8, accent: 0xd4e857, eye: 0x3a7a8c },
      { name: 'Violet',  skin: 0xe8e3f5, body: 0xb8b0c7, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Crimson', skin: 0xf5e3e6, body: 0xdbc7ca, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Arctic',  skin: 0xe3eef5, body: 0xc7d3db, accent: 0x4ad6d0, eye: 0x1c8a86 },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Toxic Jab',
        type: 'electrical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 60,
        rangeH: 42,
        duration: 195,
        cooldown: 105,
      },
      specialDirectional: {
        name: 'Gas Cloud',
        kind: 'burst',
        type: 'electrical',
        damage: 12,
        baseKnockback: 230,
        knockbackGrowth: 6.0,
        radius: 90,
        duration: 290,
        cooldown: 370,
        teach: 'Chlorine is a halogen, the same reactive element family as fluorine -- on its own it\'s a toxic greenish-yellow gas, but combined with sodium it becomes ordinary, harmless table salt.',
      },
    },
  },

  aaron: {
    id: 'aaron',
    name: 'Aaron',
    element: 'Argon',
    symbol: 'Ar',
    atomicNumber: 18,
    tagline: 'Calm, cool, and completely unreactive.',
    teach: 'Argon makes up about 1% of the air you\'re breathing right now -- it\'s a noble gas so inert that light bulbs are filled with it to keep the hot filament from reacting with anything and burning out too fast.',
    art: {
      key: 'char-aaron',
      file: 'art-src/aaron-cut.png',
      facing: 1,
      height: 138,
      bodyW: 40,
      bodyH: 122,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 548,
        frameH: 706,
        footY: 0.9706,
        visibleH: 653,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    // another noble gas, same "inert = sturdy" logic as Helen and Neo.
    stats: { speed: 295, jumpVelocity: 610, airJumps: 1, weight: 1.0, gravityScale: 1.0 },
    defense: { heat: 5, physical: 4, electrical: 3, chemical: 0 },
    palettes: [
      { name: 'Inert',   skin: 0xead9c2, body: 0x7a7f95, accent: 0xa06fe8, eye: 0x4c2f9e },
      { name: 'Amber',   skin: 0xf5eee3, body: 0x8f8574, accent: 0xd6a02f, eye: 0x8a5f10 },
      { name: 'Jade',    skin: 0xe3f5ea, body: 0x7a958a, accent: 0x3fc98a, eye: 0x1c7a4e },
      { name: 'Crimson', skin: 0xf5e3e6, body: 0x8a7075, accent: 0xd6303a, eye: 0x8a1c22 },
    ],
    body: {
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 29, armWidth: 11, legLength: 32, legWidth: 12, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Inert Guard Strike',
        type: 'physical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 60,
        rangeH: 42,
        duration: 200,
        cooldown: 110,
      },
      specialDirectional: {
        name: 'Noble Discharge',
        kind: 'burst',
        type: 'electrical',
        damage: 12,
        baseKnockback: 230,
        knockbackGrowth: 6.0,
        radius: 85,
        duration: 290,
        cooldown: 370,
        teach: 'Argon is used as a protective shield gas in welding -- it surrounds the hot metal and keeps oxygen away, since oxygen would otherwise weaken the weld.',
      },
    },
  },

  kyle: {
    id: 'kyle',
    name: 'Kyle',
    element: 'Potassium',
    symbol: 'K',
    atomicNumber: 19,
    tagline: 'Every nerve in your body needs what he\'s made of.',
    teach: 'Potassium is essential for how your nerves and muscles work -- it\'s why bananas and other potassium-rich foods matter, and why pure potassium metal, like sodium, reacts violently with water.',
    art: {
      key: 'char-kyle',
      file: 'art-src/kyle-cut.png',
      facing: 1,
      height: 136,
      bodyW: 39,
      bodyH: 120,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 549,
        frameH: 709,
        footY: 0.9717,
        visibleH: 659,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 350, jumpVelocity: 645, airJumps: 1, weight: 0.83, gravityScale: 1.0 },
    // alkali metal like Natalie -- soft and reactive, but current defense
    // gets a boost since potassium ions are exactly what nerve signals run on.
    defense: { heat: 3, physical: 2, electrical: 4, chemical: 0 },
    palettes: [
      { name: 'Static',  skin: 0xead9c2, body: 0xc7b8e8, accent: 0xa06fe8, eye: 0x4c2f9e },
      { name: 'Amber',   skin: 0xf5eee3, body: 0xe8dcb8, accent: 0xd6a02f, eye: 0x8a5f10 },
      { name: 'Jade',    skin: 0xe3f5ea, body: 0xb8e8cf, accent: 0x3fc98a, eye: 0x1c7a4e },
      { name: 'Crimson', skin: 0xf5e3e6, body: 0xe8b8c0, accent: 0xd6303a, eye: 0x8a1c22 },
    ],
    body: {
      headRadius: 21, torsoWidth: 38, torsoHeight: 44,
      armLength: 29, armWidth: 11, legLength: 32, legWidth: 12, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Static Cross',
        type: 'electrical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 60,
        rangeH: 42,
        duration: 195,
        cooldown: 105,
      },
      specialDirectional: {
        name: 'Nerve Shock',
        kind: 'burst',
        type: 'electrical',
        damage: 13,
        baseKnockback: 235,
        knockbackGrowth: 6.2,
        radius: 88,
        duration: 300,
        cooldown: 380,
        teach: 'Every signal your nerves send -- every muscle twitch, every heartbeat -- relies on potassium and sodium ions moving in and out of cells. Without enough potassium, muscles (including the heart) stop working properly.',
      },
    },
  },

  cal: {
    id: 'cal',
    name: 'Cal',
    element: 'Calcium',
    symbol: 'Ca',
    atomicNumber: 20,
    tagline: 'Built from the same stuff as bone -- and just as hard to break.',
    teach: 'Calcium is the most abundant mineral in the human body -- almost all of it is in your bones and teeth, which is why calcium is so strongly linked to bone strength.',
    art: {
      key: 'char-cal',
      file: 'art-src/cal-cut.png',
      facing: -1,
      height: 144,
      bodyW: 46,
      bodyH: 130,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 416,
        frameH: 684,
        footY: 0.9688,
        visibleH: 632,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 290, jumpVelocity: 600, airJumps: 0, weight: 1.2, gravityScale: 1.1 },
    defense: { heat: 3, physical: 8, electrical: 3, chemical: 0 }, // bone -- hard, kinetic-resistant tank
    palettes: [
      { name: 'Bone',    skin: 0xead9c2, body: 0xe8e0d0, accent: 0xff6a2e, eye: 0x8a1c10 },
      { name: 'Ash',     skin: 0x9a9a9a, body: 0x8a8a80, accent: 0xff6a2e, eye: 0x3a1710 },
      { name: 'Arctic',  skin: 0xe3eef5, body: 0xc7d3db, accent: 0x4ad6d0, eye: 0x1c8a86 },
      { name: 'Violet',  skin: 0xe8e3f5, body: 0xc7bcd8, accent: 0x8a5fe0, eye: 0x4c2f9e },
    ],
    body: {
      headRadius: 23, torsoWidth: 45, torsoHeight: 50,
      armLength: 31, armWidth: 14, legLength: 29, legWidth: 15, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Bone Crush',
        type: 'physical',
        damage: 10,
        baseKnockback: 165,
        knockbackGrowth: 5.5,
        rangeW: 65,
        rangeH: 46,
        duration: 230,
        cooldown: 140,
      },
      specialDirectional: {
        name: 'Marrow Burst',
        kind: 'burst',
        type: 'heat',
        damage: 14,
        baseKnockback: 245,
        knockbackGrowth: 6.6,
        radius: 92,
        duration: 320,
        cooldown: 400,
        teach: 'Pure calcium metal is silvery and surprisingly reactive, bursting into a brick-red flame when it burns -- a stark contrast to the calcium compounds (like the calcium carbonate in bone and chalk) that are completely stable.',
      },
    },
  },

  scarlett: {
    id: 'scarlett',
    name: 'Scarlett',
    element: 'Scandium',
    symbol: 'Sc',
    atomicNumber: 21,
    tagline: 'Rare, light, and built to fly.',
    teach: 'Scandium is one of the rarest usable metals -- alloyed with aluminum it creates an incredibly light, strong metal used in aerospace parts and high-end bike frames and baseball bats.',
    art: {
      key: 'char-scarlett',
      file: 'art-src/scarlett-cut.png',
      facing: -1,
      height: 132,
      bodyW: 36,
      bodyH: 116,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 724,
        frameH: 720,
        footY: 1.0,
        visibleH: 684,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 340, jumpVelocity: 720, airJumps: 2, weight: 0.75, gravityScale: 0.9 }, // winged -- the most aerial kit on the roster
    defense: { heat: 3, physical: 4, electrical: 3, chemical: 0 },
    palettes: [
      { name: 'Aerospace', skin: 0xead9c2, body: 0xe4e4e8, accent: 0xd6303a, eye: 0x3a7a8c },
      { name: 'Violet',    skin: 0xe8e3f5, body: 0xb8b0c7, accent: 0x8a5fe0, eye: 0x4c2f9e },
      { name: 'Jade',      skin: 0xe3f5ea, body: 0xb8d8c7, accent: 0x3fc98a, eye: 0x1c7a4e },
      { name: 'Amber',     skin: 0xf5eee3, body: 0xdbd0c1, accent: 0xd6a02f, eye: 0x8a5f10 },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Wing Slash',
        type: 'physical',
        damage: 8,
        baseKnockback: 150,
        knockbackGrowth: 5.0,
        rangeW: 62,
        rangeH: 44,
        duration: 195,
        cooldown: 105,
      },
      specialDirectional: {
        name: 'Aerial Dive',
        kind: 'burst',
        type: 'physical',
        damage: 12,
        baseKnockback: 230,
        knockbackGrowth: 6.0,
        radius: 85,
        duration: 290,
        cooldown: 370,
        teach: 'Scandium is technically a rare earth element, even though it\'s chemically closer to aluminum -- it\'s so scarce and expensive that most people have never held anything made with it.',
      },
    },
  },

  van: {
    id: 'van',
    name: 'Van',
    element: 'Vanadium',
    symbol: 'V',
    atomicNumber: 23,
    tagline: 'One element, every color in the box.',
    teach: 'Vanadium compounds can be almost any color -- violet, green, blue, or yellow -- depending on the ion\'s oxidation state, a party trick almost no other element can match.',
    art: {
      key: 'char-van',
      file: 'art-src/van-cut.png',
      facing: -1,
      height: 146,
      bodyW: 48,
      bodyH: 132,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 1222,
        frameH: 720,
        footY: 0.9899,
        visibleH: 684,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 280, jumpVelocity: 580, airJumps: 0, weight: 1.25, gravityScale: 1.1 },
    defense: { heat: 4, physical: 7, electrical: 4, chemical: 0 }, // steel-strengthening alloy metal -- heavy industrial tank
    palettes: [
      { name: 'Prism',    skin: 0xead9c2, body: 0x2e3038, accent: 0x8af5c9, eye: 0x4c2f9e },
      { name: 'Amber',    skin: 0xf5eee3, body: 0x3a3428, accent: 0xd6a02f, eye: 0x8a5f10 },
      { name: 'Crimson',  skin: 0xf5e3e6, body: 0x3a2428, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Arctic',   skin: 0xe3eef5, body: 0x243038, accent: 0x4ad6d0, eye: 0x1c8a86 },
    ],
    body: {
      headRadius: 24, torsoWidth: 47, torsoHeight: 53,
      armLength: 32, armWidth: 15, legLength: 28, legWidth: 16, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Alloy Fist',
        type: 'physical',
        damage: 10,
        baseKnockback: 165,
        knockbackGrowth: 5.5,
        rangeW: 65,
        rangeH: 46,
        duration: 230,
        cooldown: 140,
      },
      specialDirectional: {
        name: 'Prism Surge',
        kind: 'burst',
        type: 'electrical',
        damage: 14,
        baseKnockback: 245,
        knockbackGrowth: 6.6,
        radius: 92,
        duration: 320,
        cooldown: 400,
        teach: 'Adding even a small amount of vanadium to steel makes it dramatically stronger and more shock-resistant -- vanadium steel was famously used in the Ford Model T\'s chassis.',
      },
    },
  },

  chroma: {
    id: 'chroma',
    name: 'Chroma',
    element: 'Chromium',
    symbol: 'Cr',
    atomicNumber: 24,
    tagline: 'Color itself, wearing armor.',
    teach: 'Chromium gets its name from the Greek word for "color" -- trace amounts of it are exactly what makes rubies red and emeralds green, even though the gems themselves are totally different minerals.',
    art: {
      key: 'char-chroma',
      file: 'art-src/chroma-cut.png',
      facing: -1,
      height: 130,
      bodyW: 36,
      bodyH: 114,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 883,
        frameH: 707,
        footY: 0.9830,
        visibleH: 671,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
        },
      },
    },
    stats: { speed: 330, jumpVelocity: 650, airJumps: 1, weight: 0.88, gravityScale: 1.0 },
    defense: { heat: 4, physical: 6, electrical: 3, chemical: 0 }, // chrome plating -- hard, corrosion-resistant coating
    palettes: [
      { name: 'Chrome',   skin: 0xead9c2, body: 0xd8dce0, accent: 0xd6303a, eye: 0x2f8a5f },
      { name: 'Emerald',  skin: 0xe3f5ea, body: 0xc7d8ce, accent: 0x3fc98a, eye: 0x1c7a4e },
      { name: 'Ruby',     skin: 0xf5e3e6, body: 0xe0c7ca, accent: 0xd6303a, eye: 0x8a1c22 },
      { name: 'Sapphire', skin: 0xe3eef5, body: 0xc7d3e0, accent: 0x4a9fff, eye: 0x1c5f9e },
    ],
    body: {
      headRadius: 20, torsoWidth: 36, torsoHeight: 42,
      armLength: 27, armWidth: 10, legLength: 31, legWidth: 11, antenna: false,
    },
    moves: {
      basicDirectional: {
        name: 'Chrome Edge',
        type: 'physical',
        damage: 9,
        baseKnockback: 155,
        knockbackGrowth: 5.2,
        rangeW: 62,
        rangeH: 44,
        duration: 210,
        cooldown: 120,
      },
      specialDirectional: {
        name: 'Prismatic Shatter',
        kind: 'burst',
        type: 'physical',
        damage: 13,
        baseKnockback: 238,
        knockbackGrowth: 6.3,
        radius: 88,
        duration: 300,
        cooldown: 380,
        teach: 'Chrome plating -- the shiny finish on car bumpers and bathroom fixtures -- is a thin layer of chromium that resists rust and scratches far better than the metal underneath it alone.',
      },
    },
  },
};

export const ROSTER = Object.values(CHARACTERS);

// Damage after per-type defense: 5% reduction per defense point.
//
// Radiation is deliberately universal -- every character takes radiation
// damage identically, so it's a single shared constant rather than a
// per-character stat (Benjamin: "Radiation will affect all elements
// equally"). Everything else reads the character's own `defense` object.
const RADIATION_DEFENSE = 0;
export function applyDefense(rawDamage, damageType, defense) {
  const points = damageType === 'radiation' ? RADIATION_DEFENSE : (defense?.[damageType] ?? 0);
  return rawDamage * (1 - Math.min(points, 10) * 0.05);
}
