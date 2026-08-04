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
    // gap to platform: 150px (was 187 -- lowered 20% along with the 20%
    // character-size shrink, per Benjamin). Every jump-capable character
    // (20/24) clears it with even more margin now (211-492px reach vs 150).
    platforms: [
      { x: 640, y: 410, w: 286 },
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
    // same 150px gap as Elemental Isle's platform, same reach profile --
    // it's the one thing connecting the two halves for anyone who can jump.
    platforms: [
      { x: 640, y: 410, w: 220 },
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
      { x: 350, y: 432, w: 220 },
      { x: 930, y: 432, w: 220 },
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
      { x: 380, y: 456, w: 200 },
      { x: 640, y: 368, w: 200 },
      { x: 900, y: 456, w: 200 },
    ],
  },
];
