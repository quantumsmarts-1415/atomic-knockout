// Stage layouts. Each stage is pure geometry + a bit of theme color -- kept
// data-driven the same way characters.js is, so BattleScene.buildStage()
// just loops over `solids` (collide from every side) and `platforms`
// (one-way, drop-through-from-above) rather than hardcoding one layout.
//
// Jump reach note: every platform height here was checked against the
// worst-case character who can still reach it (see the per-stage comments),
// using the same physics BattleScene actually runs (GRAVITY=1500,
// effective gravity = GRAVITY * gravityScale, single-jump max height =
// jumpVelocity^2 / (2 * effectiveGravity)). The 4 characters with zero air
// jumps -- Bord, Sully, Cal, Van -- cap out at a 91-109px standing jump; per
// Benjamin, it's fine if they can't reach a stage's bonus platforms (they
// already can't reach Elemental Isle's platform either), but a full ground-
// level BLOCKING obstacle (The Core's pillar) is held to a stricter bar:
// short enough that literally every character can hop it, since being
// walled off from half the stage is a much bigger problem than missing a
// bonus platform.
//
// Optional per-stage fields (added with the painted stages, 2026-10-07; the
// original four stages leave them out and get the old defaults):
//   art:      { dir, layers: [{ file, par }], terrain, ambient } -- painted
//             parallax backgrounds (tools/stages/paint_stages.py). `par` is
//             how many px the layer shifts per px the fighters' midpoint
//             moves off-center (0 = locked to the stage, bigger = nearer).
//             `terrain` is a full-canvas painted image of the solids and
//             platforms, drawn to match the geometry below exactly.
//   blast:    { left, right, top, bottom } world-space KO lines (default:
//             140px past the screen sides/bottom, 308px above the top).
//   spawns:   [{ x, y }] -- one per player seat (y = drop-in height).
//   music:    placeholder track key for when stage music exists.
//   layout:   short layout label shown on the stage select screen.
//   platforms[].move: { axis: 'x' | 'y', range, period } -- the platform
//             swings +-range/2 around its x/y on a sine wave, carrying anyone
//             standing on it (BattleScene.updateMovingPlatforms).
//   intro:    optional match intro { type, art: { name: file }, timing? } --
//             played before GO with fighters frozen; types live in
//             engine/stageIntros.js (STAGE_INTROS). Art loads from art.dir.
//   platforms[].move: { axis: 'y', stops: [y...], speed, dwell } -- an
//             elevator instead of a sine swing: rides stop to stop (ping-pong,
//             eased, `speed` px/s average) and waits `dwell` ms at each stop.
//             `y` is where it starts. See moverPosition().
//
// Camera stages (added with Carbon Skyhook, 2026-10-07) are bigger than the
// screen and opt in to a follow camera; every other stage keeps the fixed
// 1280x720 view exactly as before:
//   world:    { width, height } -- stage size in px (default 1280x720).
//   camera:   { minZoom?, maxZoom?, padX?, padTop?, padBottom?, lerpMs?, zoomInMs?,
//             zoomOutMs? } -- BattleScene frames every live fighter plus a
//             short margin (Smash-style; hits do not zoom), eases pan/zoom,
//             and clamps to the world (zoom never below the level that shows
//             the whole world). Parallax layers are world-sized and `par`
//             becomes the Phaser scrollFactor (0 = fixed sky, 1 = terrain).
//   botNav:   true -> CPUs path-find over the surface graph (engine/BotNav.js:
//             jumps, air jumps, drop-throughs, elevator rides) instead of the
//             flat-stage chase logic.
export const DEFAULT_BLAST = { left: -140, right: 1420, top: -308, bottom: 860 };

export const STAGES = [
  {
    id: 'elemental-isle',
    name: 'Elemental Isle',
    desc: 'A floating island over the reactor sea. One platform, no hazards.',
    theme: { skyTop: 0x101b33, skyBottom: 0x2a4a6e, hills: [0x18294a, 0x14223d] },
    groundY: 560,
    solids: [
      { x: 640, w: 990 }, // mainX/mainW from the original single-stage build
    ],
    // gap to platform: 190px (raised for more vertical space; launch
    // air-jumpers still clear ~211px+).
    platforms: [
      { x: 640, y: 370, w: 286 },
    ],
  },
  {
    id: 'twin-peaks',
    name: 'Twin Peaks',
    desc: 'Two separate islands over an open pit, joined by one high platform.',
    theme: { skyTop: 0x1a1030, skyBottom: 0x3a2a5e, hills: [0x241a3f, 0x1c1433] },
    groundY: 560,
    // Two 460-wide islands with a 160px gap between them (x:560-720) --
    // fall in and it's a normal blast-zone death, same physics as flying
    // off the side, no special handling needed. Default spawn offsets
    // (+-260/+-100/+-380 from center) all land on one island or the other,
    // never in the gap.
    solids: [
      { x: 330, w: 460 },  // left island: x 100-560
      { x: 950, w: 460 },  // right island: x 720-1180
    ],
    // same raised gap as Elemental Isle's platform.
    platforms: [
      { x: 640, y: 370, w: 220 },
    ],
  },
  {
    id: 'the-core',
    name: 'The Core',
    desc: 'A reactor pillar splits the floor -- hop it, or fight around it.',
    theme: { skyTop: 0x0f2418, skyBottom: 0x1f4a34, hills: [0x163828, 0x122c20] },
    groundY: 560,
    // Same 990-wide ground as Elemental Isle, plus a solid pillar rising
    // from the middle of it. Pillar is only 70px tall (top at y=490) --
    // deliberately shorter than every character's worst-case standing-jump
    // height (Bord/Sully's 91px is the lowest in the roster) so NOBODY is
    // ever walled off from crossing the stage; it's a speed bump, not a
    // divider. Side platforms moved off-center (the pillar owns the middle)
    // at a 128px gap (was 160, lowered 20%) -- easier than Elemental Isle's
    // platform, still out of reach for the 4 zero-air-jump tanks same as
    // everywhere else. Pillar height is untouched by the 20% platform-lower
    // pass -- it's an obstacle you jump OVER, not a platform you jump TO,
    // and its 70px height was already calibrated against absolute jump
    // physics (character size doesn't change how high a jump goes).
    solids: [
      { x: 640, w: 990 },
      { x: 640, y: 490, w: 80, h: 70 }, // the pillar: top at 490, sits on the ground at 560
    ],
    platforms: [
      { x: 300, y: 392, w: 220 },
      { x: 980, y: 392, w: 220 },
    ],
  },
  {
    id: 'crystal-spire',
    name: 'Crystal Spire',
    desc: 'A narrower floor with a hard-to-reach summit platform up top.',
    theme: { skyTop: 0x1c1420, skyBottom: 0x4a2a5e, hills: [0x2a1c3a, 0x201530] },
    groundY: 560,
    // Narrower ground (840 vs. Elemental Isle's 990) trades roaming room
    // for verticality. Platform gaps lowered 20% along with the character-
    // size shrink (side: 130->104px, center: 240->192px). Side effect worth
    // knowing: this flattened the summit's original "genuine reach check"
    // design -- at 240px only ~14/20 jump-capable characters could reach
    // it (titan/carter/aaron/neo fell short); at 192px EVERY jump-capable
    // character clears it (titan/carter's 211px reach, the roster's
    // lowest, now beats the 192 requirement), so the summit is no longer a
    // meaningful difficulty differentiator, just extra vertical space. Flag
    // to Benjamin if that was supposed to stay a hard-to-reach spot. Side
    // platforms (104px gap) also picked up a side effect, verified with an
    // actual physics-step simulation (not just the formula): Cal's real
    // jump peaks at a feet-height of 455.875 against a platform top at
    // 456 -- a 0.125px margin, i.e. a coin-flip in real play (frame timing,
    // input buffering, anything) rather than a reliable clear. Don't
    // advertise this as "Cal can reach platforms now" -- it's a razor's-
    // edge case, not a real capability change.
    solids: [
      { x: 640, w: 840 }, // x 220-1060
    ],
    platforms: [
      { x: 320, y: 416, w: 200 },
      { x: 640, y: 328, w: 200 },
      { x: 960, y: 416, w: 200 },
    ],
  },
  // ---------------------------------------------------------------------
  // Painted story stages (2026-10-07). Jump-reach rules from the header
  // still apply: soft platforms sit 120-140px above what's under them (the
  // roster's weakest air-jumper reaches 211px), and the only solid step
  // (Holdout Keep's raised keep) is 60px tall, under the zero-air-jump
  // tanks' 91px standing jump, so nobody gets walled off.
  // ---------------------------------------------------------------------
  {
    id: 'hydrogen-breakout',
    name: 'Hydrogen Breakout',
    desc: "Silicon's containment lab, the night Hydra broke out. Classic three-platform layout.",
    layout: 'Tri-platform',
    music: 'bgm-hydrogen-breakout',
    theme: { skyTop: 0x0a1626, skyBottom: 0x1b3a55, hills: [0x10243a, 0x0c1c2e] },
    // optional match intro (engine/stageIntros.js): blast doors built from
    // Gemini's bulkhead-door art (tools/stages/build_door_intro.py)
    intro: { type: 'doors', art: { doorLeft: 'intro_door_left.jpg', doorRight: 'intro_door_right.jpg' } },
    art: {
      dir: 'art-src/stages/hydrogen-breakout/',
      layers: [
        { file: 'sky.jpg', par: 0.015 },
        { file: 'far.png', par: 0.04 },
        { file: 'mid.png', par: 0.08 },
        { file: 'near.png', par: 0.13 },
      ],
      terrain: 'terrain.png',
      ambient: { kind: 'bubbles', color: 0x9fe8ff, count: 26 },
    },
    groundY: 560,
    solids: [
      { x: 640, w: 900 }, // x 190-1090
    ],
    // sides ~140px above the floor (launch air-jumper reach ~185, test
    // spare 40), top another ~128px above the sides; wings pulled outward
    platforms: [
      { x: 360, y: 420, w: 200 },
      { x: 920, y: 420, w: 200 },
      { x: 640, y: 292, w: 200 },
    ],
    blast: { left: -160, right: 1440, top: -300, bottom: 860 },
    spawns: [
      { x: 400, y: 470 }, { x: 880, y: 470 }, { x: 540, y: 470 },
      { x: 740, y: 470 }, { x: 280, y: 470 }, { x: 1000, y: 470 },
    ],
  },
  {
    id: 'silicon-foundry',
    name: 'Silicon Foundry',
    desc: "The AI's wafer foundry, where it was built. A cargo lift sweeps back and forth overhead.",
    layout: 'Moving platform',
    music: 'bgm-silicon-foundry',
    theme: { skyTop: 0x1a0f1c, skyBottom: 0x4a2030, hills: [0x2a1424, 0x22101c] },
    art: {
      dir: 'art-src/stages/silicon-foundry/',
      layers: [
        { file: 'sky.jpg', par: 0.015 },
        { file: 'far.png', par: 0.04 },
        { file: 'mid.png', par: 0.08 },
        { file: 'near.png', par: 0.13 },
      ],
      terrain: 'terrain.png',
      movingPlatform: 'lift.png',
      ambient: { kind: 'sparks', color: 0xffb35c, count: 22 },
    },
    groundY: 560,
    solids: [
      { x: 640, w: 880 }, // x 200-1080
    ],
    // ~140px above the floor; wider sweep x 460-820 every 7s
    platforms: [
      { x: 640, y: 420, w: 220, move: { axis: 'x', range: 360, period: 7000 } },
    ],
    blast: { left: -160, right: 1440, top: -300, bottom: 860 },
    spawns: [
      { x: 380, y: 470 }, { x: 900, y: 470 }, { x: 520, y: 470 },
      { x: 760, y: 470 }, { x: 270, y: 470 }, { x: 1010, y: 470 },
    ],
  },
  {
    id: 'brimstone-caldera',
    name: 'Brimstone Caldera',
    desc: 'A basalt slab over a sulfur volcano. One wide, flat floor and nowhere to hide.',
    layout: 'Flat',
    music: 'bgm-brimstone-caldera',
    theme: { skyTop: 0x1c0c08, skyBottom: 0x5a2410, hills: [0x2a120a, 0x200e08] },
    art: {
      dir: 'art-src/stages/brimstone-caldera/',
      layers: [
        { file: 'sky.jpg', par: 0.015 },
        { file: 'far.png', par: 0.04 },
        { file: 'mid.png', par: 0.08 },
        { file: 'near.png', par: 0.13 },
      ],
      terrain: 'terrain.png',
      ambient: { kind: 'embers', color: 0xffa040, count: 34 },
    },
    // Painted slab top is ~y 539 (terrain.png alpha). The old groundY 560
    // left fighters standing inside the basalt art, which read as standing
    // on empty mid-layer volcano pixels.
    groundY: 539,
    solids: [
      { x: 640, w: 990 }, // x 145-1135, matches terrain opaque span
    ],
    platforms: [],
    blast: { left: -150, right: 1430, top: -300, bottom: 860 },
    spawns: [
      { x: 380, y: 450 }, { x: 900, y: 450 }, { x: 520, y: 450 },
      { x: 760, y: 450 }, { x: 240, y: 450 }, { x: 1040, y: 450 },
    ],
  },
  {
    id: 'neon-nexus',
    name: 'Neon Nexus',
    desc: 'A noble-gas city rooftop. The roof runs off both screen edges -- walk off and you are gone.',
    layout: 'Walk-off',
    music: 'bgm-neon-nexus',
    theme: { skyTop: 0x0c0820, skyBottom: 0x2a1450, hills: [0x160f30, 0x120c26] },
    art: {
      dir: 'art-src/stages/neon-nexus/',
      layers: [
        { file: 'sky.jpg', par: 0.015 },
        { file: 'far.png', par: 0.04 },
        { file: 'mid.png', par: 0.08 },
        { file: 'near.png', par: 0.13 },
      ],
      terrain: 'terrain.png',
      ambient: { kind: 'rain', color: 0xb8a8ff, count: 70 },
    },
    groundY: 560,
    // Full-width roof, x 0-1280: the side blast lines are pushed further
    // out (-220 / 1500) so a walk-off KO takes a deliberate run, not a
    // stumble past the screen edge.
    solids: [
      { x: 640, w: 1280 },
    ],
    // neon sign tops, ~140px above the roof, pulled toward the wings
    platforms: [
      { x: 280, y: 420, w: 210 },
      { x: 1000, y: 420, w: 210 },
    ],
    blast: { left: -220, right: 1500, top: -300, bottom: 860 },
    spawns: [
      { x: 400, y: 470 }, { x: 880, y: 470 }, { x: 540, y: 470 },
      { x: 740, y: 470 }, { x: 250, y: 470 }, { x: 1030, y: 470 },
    ],
  },
  {
    id: 'holdout-keep',
    name: 'Holdout Keep',
    desc: 'Castle ramparts of the last free kingdom. A raised keep in the middle, balconies on the wings.',
    layout: 'Stepped',
    music: 'bgm-holdout-keep',
    theme: { skyTop: 0x2a3050, skyBottom: 0xd88a5a, hills: [0x3a3550, 0x2e2a42] },
    art: {
      dir: 'art-src/stages/holdout-keep/',
      layers: [
        { file: 'sky.jpg', par: 0.015 },
        { file: 'far.png', par: 0.04 },
        { file: 'mid.png', par: 0.08 },
        { file: 'near.png', par: 0.13 },
      ],
      terrain: 'terrain.png',
      ambient: { kind: 'petals', color: 0xffd2a0, count: 20 },
    },
    groundY: 560,
    solids: [
      { x: 640, w: 960 },                // ramparts, x 160-1120
      { x: 640, y: 500, w: 320, h: 60 }, // raised keep: 60px step (< 91px tank jump)
    ],
    // balconies ~140px above the rampart floor, wider wing spacing
    platforms: [
      { x: 250, y: 420, w: 180 },
      { x: 1030, y: 420, w: 180 },
    ],
    blast: { left: -150, right: 1430, top: -300, bottom: 860 },
    spawns: [
      { x: 360, y: 470 }, { x: 920, y: 470 }, { x: 560, y: 420 },
      { x: 720, y: 420 }, { x: 250, y: 470 }, { x: 1030, y: 470 },
    ],
  },
  {
    id: 'carbon-skyhook',
    name: 'Carbon Skyhook',
    desc: "The AI's orbital-elevator anchor, strung from a carbon-nanotube tether. Three tiers, stairs up the wings, a cargo lift up the middle -- and a lot of sky.",
    layout: 'Mega (camera)',
    music: 'bgm-carbon-skyhook',
    theme: { skyTop: 0x070b1c, skyBottom: 0xd77a4a, hills: [0x1a2236, 0x141a2a] },
    world: { width: 2560, height: 1440 },
    camera: { maxZoom: 1 },
    botNav: true,
    art: {
      dir: 'art-src/stages/carbon-skyhook/',
      // world-sized layers; par = scrollFactor on camera stages
      layers: [
        { file: 'sky.jpg', par: 0.1 },
        { file: 'far.png', par: 0.3 },
        { file: 'mid.png', par: 0.6 },
        { file: 'near.png', par: 0.85 },
      ],
      terrain: 'terrain.png',
      movingPlatform: 'lift.png',
      ambient: { kind: 'petals', color: 0xdfe9ff, count: 70 },
    },
    // Lower deck x 280-2280 (2000px, ~2x a normal stage). Every tier is
    // reachable by every character: the zero-air-jump tanks (91-109px jump)
    // use the 60px dock ledges, the 64px wing stairs and the cargo lift;
    // everyone else can also hop the 110-130px perches.
    groundY: 1180,
    solids: [
      { x: 1280, w: 2000 },                // lower deck
      { x: 480, y: 1120, w: 400, h: 60 },  // west dock (60px ledge)
      { x: 2080, y: 1120, w: 400, h: 60 }, // east dock
      { x: 915, y: 780, w: 470, h: 40 },   // west upper deck (x 680-1150)
      { x: 1645, y: 780, w: 470, h: 40 },  // east upper deck (x 1410-1880)
    ],
    platforms: [
      // wing stairs: ~80px steps, wider zigzag (was 64px / 120px horizontal)
      // so platforms are not stacked on top of each other. Docks still give
      // zero-air-jump tanks a 60px route; air-jumpers clear a step alone.
      { x: 640, y: 1060, w: 180 }, { x: 420, y: 980, w: 180 }, { x: 640, y: 900, w: 180 },
      { x: 420, y: 820, w: 180 }, { x: 640, y: 740, w: 180 },
      { x: 1920, y: 1060, w: 180 }, { x: 2140, y: 980, w: 180 }, { x: 1920, y: 900, w: 180 },
      { x: 2140, y: 820, w: 180 }, { x: 1920, y: 740, w: 180 },
      // lower-deck perches, pulled apart under the upper decks (~140px up)
      { x: 920, y: 1040, w: 200 }, { x: 1640, y: 1040, w: 200 },
      // gantries (~130px over decks) and summit halves (~120px higher).
      // Summit halves must kiss the cargo lift (x 1160-1400) so tanks can
      // step off at the top stop.
      { x: 780, y: 650, w: 180 }, { x: 1780, y: 650, w: 180 },
      { x: 1070, y: 530, w: 200 }, { x: 1490, y: 530, w: 200 },
      // cargo lift in the tether shaft: lower deck -> upper decks -> summit
      { x: 1280, y: 1180, w: 240, move: { axis: 'y', stops: [1180, 780, 530], speed: 220, dwell: 1000 } },
    ],
    blast: { left: -260, right: 2820, top: -300, bottom: 1680 },
    spawns: [
      { x: 790, y: 1100 }, { x: 1770, y: 1100 }, { x: 900, y: 720 },
      { x: 1660, y: 720 }, { x: 420, y: 1060 }, { x: 2140, y: 1060 },
    ],
  },
];

// ------------------------------------------------------------- helpers
// Texture key for a stage image (layers, terrain, thumb/preview).
export function stageKey(stage, name) {
  return `stage-${stage.id}-${name}`;
}

// Every stage has a thumbnail + preview for the select screen, painted or
// not (the original four get theirs drawn from their theme + geometry).
export function stageThumbFile(stage) {
  return `art-src/stages/${stage.id}/thumb.jpg`;
}
export function stagePreviewFile(stage) {
  return `art-src/stages/${stage.id}/preview.jpg`;
}

// Stage size in px: the screen for normal stages, bigger for camera stages.
export const SCREEN = { width: 1280, height: 720 };
export function getStageWorld(stage) {
  return stage.world ?? SCREEN;
}

// Where a moving platform's top-center is after `clock` ms of (unpaused)
// match time. Sine movers swing around their x/y; elevator movers
// (move.stops) ping-pong stop to stop, eased, dwelling at each stop.
export function moverPosition(p, clock) {
  const move = p.move;
  if (!move) return { x: p.x, y: p.y };
  if (!move.stops) {
    const off = Math.sin((clock / move.period) * Math.PI * 2) * (move.range / 2);
    return move.axis === 'x' ? { x: p.x + off, y: p.y } : { x: p.x, y: p.y + off };
  }
  const seq = elevatorCycle(move);
  // start the cycle at the stop nearest the platform's own y
  let start = seq.findIndex((s) => s.at === nearestStopIndex(move, p.y));
  if (start < 0) start = 0;
  let t = (clock + seq[start].t0) % seq.period;
  for (const s of seq) {
    if (t < s.dwell) return axisPos(p, move, s.from);
    t -= s.dwell;
    if (t < s.travel) {
      const k = t / s.travel;
      const e = k * k * (3 - 2 * k); // smoothstep: eased start/stop
      return axisPos(p, move, s.from + (s.to - s.from) * e);
    }
    t -= s.travel;
  }
  return axisPos(p, move, seq[0].from);
}

function axisPos(p, move, v) {
  return move.axis === 'x' ? { x: v, y: p.y } : { x: p.x, y: v };
}

function nearestStopIndex(move, v) {
  let best = 0;
  move.stops.forEach((s, i) => { if (Math.abs(s - v) < Math.abs(move.stops[best] - v)) best = i; });
  return best;
}

// [stop0 -> stop1 -> ... -> stopN -> ... -> stop1] segments, each a dwell at
// `from` then an eased travel to `to`; .period is the full loop in ms.
export function elevatorCycle(move) {
  const n = move.stops.length;
  const order = [...Array(n).keys(), ...Array.from({ length: Math.max(0, n - 2) }, (_, i) => n - 2 - i)];
  const dwell = move.dwell ?? 1000;
  const seq = [];
  let t0 = 0;
  order.forEach((at, i) => {
    const from = move.stops[at];
    const to = move.stops[order[(i + 1) % order.length]];
    const travel = (Math.abs(to - from) / (move.speed ?? 200)) * 1000;
    seq.push({ at, from, to, dwell, travel, t0 });
    t0 += dwell + travel;
  });
  seq.period = t0;
  return seq;
}

export function getStageBlast(stage) {
  return { ...DEFAULT_BLAST, ...(stage.blast || {}) };
}

// Old default spawn row (x offsets from center, all dropped from y=480),
// used by stages that don't list their own.
const DEFAULT_SPAWN_XS = [-260, 260, -100, 100, -380, 380];
export function getStageSpawns(stage) {
  if (stage.spawns?.length) return stage.spawns;
  return DEFAULT_SPAWN_XS.map((dx) => ({ x: 640 + dx, y: 480 }));
}

// Left/right edge of the walkable ground (solids without an explicit
// height), for keeping CPU players away from the ledges.
export function getStageBounds(stage) {
  const ground = stage.solids.filter((s) => s.h === undefined);
  const src = ground.length ? ground : stage.solids;
  return {
    minX: Math.min(...src.map((s) => s.x - s.w / 2)),
    maxX: Math.max(...src.map((s) => s.x + s.w / 2)),
  };
}

function queueStageImage(loader, exists, key, file) {
  if (exists(key)) return;
  loader.image(key, file);
}

// Select-grid thumbnails only. Full layers stay off the boot download.
export function loadStageThumbs(loader, stages = STAGES, exists = () => false) {
  for (const st of stages) queueStageImage(loader, exists, stageKey(st, 'thumb'), stageThumbFile(st));
}

// Queue stage images on a Phaser loader. Pass one stage from Battle so a
// match fetches that arena only. `exists` skips textures already on screen.
export function loadStageArt(loader, stages = STAGES, exists = () => false) {
  for (const st of stages) {
    queueStageImage(loader, exists, stageKey(st, 'thumb'), stageThumbFile(st));
    queueStageImage(loader, exists, stageKey(st, 'preview'), stagePreviewFile(st));
    const art = st.art;
    if (!art) continue;
    art.layers.forEach((l, i) => queueStageImage(loader, exists, stageKey(st, `layer${i}`), art.dir + l.file));
    if (art.terrain) queueStageImage(loader, exists, stageKey(st, 'terrain'), art.dir + art.terrain);
    if (art.movingPlatform) queueStageImage(loader, exists, stageKey(st, 'moving'), art.dir + art.movingPlatform);
    for (const [name, file] of Object.entries(st.intro?.art ?? {})) {
      queueStageImage(loader, exists, stageKey(st, `intro-${name}`), art.dir + file);
    }
  }
}
