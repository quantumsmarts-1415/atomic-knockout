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
    // hydra-cut.png). facing: the direction the native image faces (1 =
    // right); the Rig flips it to match the game's face-right convention.
    // height = display px; bodyW/bodyH = physics hurtbox (tighter than the
    // flame aura).
    art: {
      key: 'char-hydra',
      file: 'art-src/hydra-cut.png',
      facing: 1,
      height: 153,
      bodyW: 52,
      bodyH: 135,
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
        clips: {
          // Only idle exists from this test generation; Rig.js falls back
          // to 'idle' for any clip not listed here, so the rest of his
          // moves will just show him idling until walk/attack/etc. are
          // generated the same way.
          idle: { count: 14, fps: 3.6, loop: true },
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
        cooldown: 100,   // shortened ~3x for fast-paced testing (was 300)
      },
      special: {
        name: 'H-Burst',
        kind: 'burst', // radial explosion centered on self
        type: 'heat',
        damage: 13,
        baseKnockback: 256, // -20% for flight-distance tuning (was 320)
        knockbackGrowth: 7.2, // -20% (was 9)
        radius: 95,
        duration: 320,
        cooldown: 430,   // shortened ~3x for fast-paced testing (was 1300)
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
    art: {
      key: 'char-helen',
      file: 'art-src/helen-cut.png',
      facing: 1,
      height: 172,
      bodyW: 50,
      bodyH: 155,
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
          // Only idle exists from this test generation; Rig.js falls back
          // to 'idle' for any clip not listed here (walk/attack/etc.),
          // so the rest of the roster's moves will just show her idling.
          idle: { count: 14, fps: 3.6, loop: true },
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
        baseKnockback: 160,   // -20% for flight-distance tuning (was 200)
        knockbackGrowth: 4.8, // -20% (was 6)
        rangeW: 54,
        rangeH: 50,
        duration: 240,
        cooldown: 105,   // shortened ~3x for fast-paced testing (was 320)
      },
      special: {
        name: 'Noble Gust',
        kind: 'projectile', // slow drifting orb that pushes hard
        type: 'kinetic',
        damage: 8,
        baseKnockback: 304, // -20% for flight-distance tuning (was 380)
        knockbackGrowth: 6.4, // -20% (was 8)
        projectileSpeed: 380,
        projectileRadius: 16,
        projectileLife: 900, // ms
        duration: 260,
        cooldown: 500,   // shortened ~3x for fast-paced testing (was 1500)
        teach: 'Helium is a noble gas — inert, safe, and used to lift airships.',
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
      height: 160,
      bodyW: 60,
      bodyH: 150,
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
    defense: { heat: 5, current: 1, kinetic: 6 },
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
      basic: {
        name: 'Lance Jab',
        type: 'kinetic',
        damage: 9,
        baseKnockback: 184, // -20% for flight-distance tuning (was 230)
        knockbackGrowth: 5.6, // -20% (was 7)
        rangeW: 74,   // spear = long reach
        rangeH: 44,
        duration: 300, // slower swing than the light characters
        cooldown: 150,   // shortened ~3x for fast-paced testing (was 450)
      },
      special: {
        name: 'Aero Lance',
        kind: 'projectile',
        type: 'kinetic',
        damage: 12,
        baseKnockback: 256, // -20% for flight-distance tuning (was 320)
        knockbackGrowth: 5.6, // -20% (was 7)
        projectileSpeed: 540,
        projectileRadius: 13,
        projectileLife: 750,
        duration: 320,
        cooldown: 565,   // shortened ~3x for fast-paced testing (was 1700)
        teach: 'Titanium’s strength-to-weight ratio makes it the metal of jets and spacecraft.',
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
      height: 148,
      bodyW: 46,
      bodyH: 125,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 631,
        frameH: 720,
        footY: 0.9725,
        visibleH: 672,
        clips: {
          // idle only -- walk/attack/etc. not generated yet, falls back to idle
          idle: { count: 14, fps: 3.6, loop: true },
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
    defense: { heat: 2, current: 3, kinetic: 1 },
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
      basic: {
        name: 'Spark Jab',
        type: 'kinetic',
        damage: 6,
        baseKnockback: 140,
        knockbackGrowth: 5,
        rangeW: 60,
        rangeH: 44,
        duration: 180,   // quick -- she's the fastest attacker on the roster
        cooldown: 90,
      },
      special: {
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
      height: 156,
      bodyW: 52,
      bodyH: 132,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 720,
        frameH: 1280,
        footY: 0.9336,
        visibleH: 1180,
        clips: {
          idle: { count: 13, fps: 3.6, loop: true },
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
    defense: { heat: 4, current: 4, kinetic: 5 },
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
      basic: {
        name: 'Precision Strike',
        type: 'kinetic',
        damage: 7,
        baseKnockback: 150,
        knockbackGrowth: 5,
        rangeW: 62,
        rangeH: 44,
        duration: 200,
        cooldown: 110,
      },
      special: {
        name: 'Gyro Disc',
        kind: 'projectile',
        type: 'kinetic',
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
      height: 150,
      bodyW: 62,
      bodyH: 128,
      use3d: true,
      sheets: {
        dir: 'art-src/gemini-test/sheets/',
        frameW: 639,
        frameH: 720,
        footY: 0.9807,
        visibleH: 672,
        clips: {
          idle: { count: 14, fps: 3.6, loop: true },
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
    defense: { heat: 7, current: 6, kinetic: 8 },
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
      basic: {
        name: 'Crystal Smash',
        type: 'kinetic',
        damage: 10,
        baseKnockback: 165,
        knockbackGrowth: 5,
        rangeW: 66,
        rangeH: 48,
        duration: 340,   // slowest swing on the roster -- heavy wind-up
        cooldown: 160,
      },
      special: {
        name: 'Ground Shatter',
        kind: 'burst', // radial shockwave from slamming his maul down
        type: 'kinetic',
        damage: 14,
        baseKnockback: 260,
        knockbackGrowth: 7,
        radius: 90,
        duration: 340,
        cooldown: 420,
        teach: 'Boron is used in nuclear reactor control rods because it absorbs neutrons so effectively -- it soaks up and stops dangerous energy.',
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
    // and front knee both lead left) -- recorded facing -1, verify on
    // screen and flip if he reads backwards.
    art: {
      key: 'char-carter',
      file: 'art-src/carter-cut.png',
      facing: -1,
      height: 150,
      bodyW: 54,
      bodyH: 130,
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
    defense: { heat: 8, current: 6, kinetic: 9 },
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
      basic: {
        name: 'Diamond Cross',
        type: 'kinetic',
        damage: 9,
        baseKnockback: 160,
        knockbackGrowth: 5.4,
        rangeW: 62,
        rangeH: 46,
        duration: 260,
        cooldown: 140,
      },
      special: {
        name: 'Graphene Wave',
        kind: 'burst', // radial shockwave, current-typed (graphite conducts)
        type: 'current',
        damage: 13,
        baseKnockback: 245,
        knockbackGrowth: 6.6,
        radius: 88,
        duration: 320,
        cooldown: 400,
        teach: 'Graphite -- just carbon atoms arranged in flat sheets -- conducts electricity well enough to be used in batteries and electrodes, unusual for a nonmetal.',
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
      height: 150,
      bodyW: 48,
      bodyH: 128,
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
    defense: { heat: 5, current: 3, kinetic: 5 },
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
      basic: {
        name: 'Frost Fang',
        type: 'kinetic',
        damage: 8,
        baseKnockback: 155,
        knockbackGrowth: 5.2,
        rangeW: 60,
        rangeH: 44,
        duration: 240,
        cooldown: 140,
      },
      special: {
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
    },
  },
};

export const ROSTER = Object.values(CHARACTERS);

// Damage after per-type defense: 5% reduction per defense point.
export function applyDefense(rawDamage, damageType, defense) {
  const points = defense?.[damageType] ?? 0;
  return rawDamage * (1 - Math.min(points, 10) * 0.05);
}
