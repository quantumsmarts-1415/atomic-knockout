// Campaign robots: the enemy machines of the "Silas and the AI robots" story (src/campaign/story/silas-robots.js).
//
// Every robot shares ONE body (one set of sprite sheets) and is tinted per enslaved element. The tint is the
// element's own fighter colour (palettes[0].body), so the player can read which element powers a robot at a glance.
// A robot FIGHTS with its element: unit.id stays the element fighter's id, so stats, the four real Smash Ring moves,
// move FX, element matchups and resistances all come from that fighter. Only what is drawn changes (see bodyIdOf).
//
// ART STATUS: ROBOT_ART_READY is false, so robots currently wear a clearly marked PLACEHOLDER body (Silas's existing
// idle/walk/attack sheets, flat-tinted). When the real robot art exists (brief: docs/campaign-robot-art-brief.md,
// files under assets/campaign/robot/), set ROBOT_ART_READY to true. Nothing else changes.
import { CHARACTERS } from '../data/characters.js';

export const ROBOT_ART_READY = false;
export const ROBOT_BODY_KEY = 'robot';   // the body id in ROBOT_BODY when the real art ships
export const ROBOT_DIR = 'assets/campaign/robot/';

// The real body, described exactly like a fighter's art (see the brief for frame sizes). Frame sizes below are the
// ones the brief asks for; adjust footY/visibleH/displayScale to the delivered sheets.
const REAL_BODY = {
  id: ROBOT_BODY_KEY,
  name: 'Robot',
  symbol: 'AI',
  atomicNumber: 0,
  palettes: [{ name: 'Neutral', body: 0xb8c0cc, accent: 0x3a4250, skin: 0xb8c0cc, eye: 0x1a1f28, colorway: null }],
  art: {
    key: 'char-robot',
    file: `${ROBOT_DIR}robot-cut.png`,
    facing: 1,
    height: 136,
    bodyW: 40,
    bodyH: 120,
    use3d: true,
    sheets: {
      dir: ROBOT_DIR,
      frameW: 768, frameH: 768, footY: 0.98, visibleH: 700, bodyH: 700, displayScale: 0.1943,
      clips: {
        idle: { count: 8, fps: 8, loop: true, file: 'robot_idle.png' },
        walk: { count: 12, fps: 10, loop: true, file: 'robot_walk.png' },
        attack: { count: 8, fps: 14, loop: false, file: 'robot_attack.png' },
        hit: { count: 4, fps: 12, loop: false, file: 'robot_hit.png' },
      },
    },
  },
};

// PLACEHOLDER body: Silas's existing (post-modesty, untouched) sheets, drawn flat-tinted. Not the final robot.
const PLACEHOLDER_BODY_ID = 'silas';

/** The body id robots are drawn with (a CHARACTERS id while the placeholder is in use). */
export const ROBOT_BODY_ID = ROBOT_ART_READY ? ROBOT_BODY_KEY : PLACEHOLDER_BODY_ID;

/** Body definition (the `art` block a Rig needs) for a body id: the robot body, or a fighter's own. */
export function bodyDefOf(id) {
  if (id === ROBOT_BODY_KEY) return REAL_BODY;
  return CHARACTERS[id] || null;
}

/** The robot shows its element's colour: the fighter's first palette body colour. */
export function robotTint(elementId) {
  return CHARACTERS[elementId]?.palettes?.[0]?.body ?? 0x9aa7b8;
}

/** "Hydrogen-Bot". */
export function robotName(elementId) {
  const c = CHARACTERS[elementId];
  return `${c?.element || c?.name || elementId}-Bot`;
}

/** Extra unit fields for a robot enemy spec ({ id: elementFighterId, robot: true, name?, tint?, scale? }). */
export function robotExtras(spec) {
  return {
    robot: true,
    bodyId: ROBOT_BODY_ID,
    tint: spec.tint ?? robotTint(spec.id),
    name: spec.name || robotName(spec.id),
    scale: spec.scale || 1,
  };
}

/** The art id a unit is drawn with: robots share one body, everyone else uses their own fighter art. */
export function bodyIdOf(unit) {
  return unit.bodyId || unit.id;
}

/** Fighter ids whose idle/walk/attack sheets a list of units or enemy specs needs on screen. */
export function artIdsFor(list) {
  return [...new Set(list.map((e) => (e.robot ? ROBOT_BODY_ID : e.bodyId || e.id)))];
}
