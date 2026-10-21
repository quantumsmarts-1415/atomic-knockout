// Per-move body clips. A fighter ships one sheet per move under
// art-src/imported/body/<id>/<slug>.json plus <id>_<slug>.png in the sheets
// folder. The slug is the move name. A move with no sheet keeps playing
// the generic attack.png.
//
// The sole is foot_row, and visibleH is scaled to art.height, so idle, walk,
// and the move share one body height and one foot line. Strike FX attach to
// strike_hand_xy on the strike frames.

import { moveSlug } from './attackFx.js';
import { BODY_SOURCES } from './bodyClipSources.js';

export const BODY_SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];

const metaByClip = new Map();
const clipByMove = new Map();

export function bodyClipKey(moveKey) {
  return `body-${moveKey}`;
}

/** Sole fraction whose engine foot row is footRow. */
export function footYForRow(footRow, frameH) {
  if (!(frameH > 0) || !Number.isFinite(footRow)) return null;
  const footY = Number(((footRow + 1) / frameH).toFixed(4));
  return footY > 0 && footY <= 1 ? footY : null;
}

export function hasBodyClips(id) {
  return !!BODY_SOURCES[id];
}

export function bodyClipName(id, moveKey) {
  return clipByMove.get(`${id}|${moveKey}`) || null;
}

export function bodySheetMeta(id, clip) {
  return metaByClip.get(`${id}|${clip}`) || null;
}

/**
 * Playback ranges for an 8-frame (or shorter) body sheet.
 * Strike frames are the active window. Frames before them are the windup,
 * frames after them are the recovery.
 */
export function bodyPlayback(count, strikes) {
  const frames = [...strikes].filter((n) => n >= 0 && n < count).sort((a, b) => a - b);
  if (!frames.length || !(count > 0)) return null;
  const first = frames[0];
  const last = frames[frames.length - 1];
  return {
    strikes: frames,
    release: first,
    windup: first > 0 ? [0, first - 1] : [0, 0],
    active: [first, last],
    recovery: last < count - 1 ? [last + 1, count - 1] : null,
  };
}

export function compileBodyClip(src, artHeight) {
  const frameW = src?.frameW;
  const frameH = src?.frameH;
  const count = src?.count | 0;
  const visibleH = src?.visibleH;
  const footY = footYForRow(src?.footRow, frameH);
  if (!(frameW > 0) || !(frameH > 0) || !(count > 0) || !(visibleH > 0) || footY == null) return null;
  if (!(artHeight > 0)) return null;
  const play = bodyPlayback(count, src.strikes || []);
  if (!play) return null;
  const hands = src.hands || [];
  if (hands.length < count) return null;
  const fist = hands.slice(0, count).map((xy) => [xy[0], xy[1]]);
  return {
    clip: {
      count,
      fps: src.fps > 0 ? src.fps : 12,
      loop: false,
      frameW,
      frameH,
      footY,
      visibleH,
      bodyH: visibleH,
      displayScale: artHeight / visibleH,
    },
    meta: {
      count,
      fps: src.fps > 0 ? src.fps : 12,
      release: play.release,
      windup: play.windup,
      active: play.active,
      recovery: play.recovery,
      anchors: { fist, tip: fist },
      strikeFrames: play.strikes,
    },
  };
}

/** Add each shipped move sheet onto the fighter. Missing moves stay on attack.png. */
export function installBodyClips(characters) {
  metaByClip.clear();
  clipByMove.clear();
  if (!characters) return;
  for (const [id, bySlug] of Object.entries(BODY_SOURCES)) {
    const def = characters[id];
    const clips = def?.art?.sheets?.clips;
    const moves = def?.moves;
    if (!clips || !moves) continue;
    const artHeight = def.art.height ?? def.height ?? 132;
    for (const moveKey of BODY_SLOTS) {
      const move = moves[moveKey];
      if (!move?.name) continue;
      const src = bySlug[moveSlug(move.name)];
      if (!src) continue;
      const built = compileBodyClip(src, artHeight);
      if (!built) continue;
      const clipKey = bodyClipKey(moveKey);
      built.clip.file = `${id}_${moveSlug(move.name)}.png`;
      if (moveKey === 'basicCharge') built.meta.loop = built.meta.windup;
      if (moveKey === 'specialDefense') {
        built.meta.gather = true;
        built.meta.loop = built.meta.active;
      }
      clips[clipKey] = built.clip;
      metaByClip.set(`${id}|${clipKey}`, built.meta);
      clipByMove.set(`${id}|${moveKey}`, clipKey);
    }
  }
}
