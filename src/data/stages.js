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
    // gap to platform: 187px. Every jump-capable character (20/24) clears
    // it with real margin (211-492px double-jump reach vs. 187 needed).
    platforms: [
      { x: 640, y: 373, w: 286 },
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
    // same 187px gap as Elemental Isle's platform, same reach profile --
    // it's the one thing connecting the two halves for anyone who can jump.
    platforms: [
      { x: 640, y: 373, w: 220 },
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
    // at a 160px gap -- easier than Elemental Isle's platform, still out of
    // reach for the 4 zero-air-jump tanks same as everywhere else.
    solids: [
      { x: 640, w: 990 },
      { x: 640, y: 490, w: 80, h: 70 }, // the pillar: top at 490, sits on the ground at 560
    ],
    platforms: [
      { x: 350, y: 400, w: 220 },
      { x: 930, y: 400, w: 220 },
    ],
  },
  {
    id: 'crystal-spire',
    name: 'Crystal Spire',
    desc: 'A narrower floor with a hard-to-reach summit platform up top.',
    theme: { skyTop: 0x1c1420, skyBottom: 0x4a2a5e, hills: [0x2a1c3a, 0x201530] },
    groundY: 560,
    // Narrower ground (840 vs. Elemental Isle's 990) trades roaming room
    // for verticality. Two low side platforms (130px gap -- reachable by
    // anyone with real air-jump height, same "tanks miss out" story as
    // every other platform in the game) plus one high center platform
    // (240px gap) that's a genuine reach check: roughly 14 of the 20
    // jump-capable characters clear it on a well-timed double jump,
    // titan/carter/aaron/neo fall just short (211-237px reach vs 240
    // needed) -- a summit that's meant to actually be hard to reach, not
    // just automatically free real estate, same spirit as its name.
    solids: [
      { x: 640, w: 840 }, // x 220-1060
    ],
    platforms: [
      { x: 380, y: 430, w: 200 },
      { x: 640, y: 320, w: 200 },
      { x: 900, y: 430, w: 200 },
    ],
  },
];
