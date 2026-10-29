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
import { SIDE_IDLES } from './sideIdles.js';

export const BODY_SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];

const metaByClip = new Map();
const clipByMove = new Map();

export function bodyClipKey(moveKey) {
  return `body-${moveKey}`;
}

/** Sole fraction whose engine foot row is footRow. */
export function footYForRow(footRow, frameH) {
  if (!(frameH > 0) || !Number.isFinite(footRow)) return null;
  const lands = (y) => y > 0 && y <= 1 && Math.round(y * frameH) - 1 === footRow;
  const naive = Number(((footRow + 1) / frameH).toFixed(4));
  if (lands(naive)) return naive;
  // Four decimals can round the sole onto the next row. Magic Number is 593 of 658.
  const center = (footRow + 1) / frameH;
  let best = null;
  let bestDist = Infinity;
  for (let i = -30; i <= 30; i++) {
    const y = Number((center + i * 0.0001).toFixed(4));
    if (!lands(y)) continue;
    const dist = Math.abs(y * frameH - (footRow + 1));
    if (dist < bestDist) {
      bestDist = dist;
      best = y;
    }
  }
  return best;
}

export function hasBodyClips(id) {
  return !!BODY_SOURCES[id];
}

export function bodyClipName(id, moveKey) {
  return clipByMove.get(`${id}|${moveKey}`) || null;
}

/** Handoff slugs drop apostrophes. Surf's Up is surfs-up, not surf-s-up. */
export function bodySourceSlug(id, moveName) {
  const pack = BODY_SOURCES[id];
  if (!pack || !moveName) return null;
  const slug = moveSlug(moveName);
  if (pack[slug]) return slug;
  const folded = moveSlug(String(moveName).replace(/['’]/g, ''));
  return pack[folded] ? folded : null;
}

/** A renamed move can keep its sheet slug. Fuel Rod Hammer still reads fuel-rod-jab. */
/** Sheet slugs that do not match the move name. A redo swaps the slug here. */
const SHEET_SLUGS = {
  allen: {
    basicCharge: 'thermite-spray',
    basicDirectional: 'whip-yank',
    specialDefense: 'oxide-skin',
    specialDirectional: 'turbine-spin',
  },
  aaron: {
    basicCharge: 'lazy-lounge',
    basicDirectional: 'guard-strike',
  },
  // Cement Pour is the approved sheet for Calcify. Bone Crush stays on attack.png.
  cal: { basicCharge: 'cement-pour' },
  flora: {
    basicCharge: 'burning-jet',
    basicDirectional: 'acid-jab',
  },
  gail: {
    basicDirectional: 'embrittle-grab',
  },
  kyle: { specialDirectional: 'nerve-shock' },
  natalie: { specialDirectional: 'salt-spikes' },
  nitra: { basicCharge: 'tornado-shove' },
  phillip: { specialDefense: 'red-phosphorus' },
};

export function moveBodySlug(id, move) {
  const pack = BODY_SOURCES[id];
  const pinned = move?.sourceSlug;
  if (pack && pinned && pack[pinned]) return pinned;
  return bodySourceSlug(id, move?.name);
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
      const forced = SHEET_SLUGS[id]?.[moveKey];
      if (forced && bySlug[forced]) move.sourceSlug = forced;
      const slug = moveBodySlug(id, move);
      const src = slug ? bySlug[slug] : null;
      if (!src) continue;
      const built = compileBodyClip(src, artHeight);
      if (!built) continue;
      const clipKey = bodyClipKey(moveKey);
      built.clip.file = `${id}_${slug}.png`;
      if (src.sheetFacing === 1 || src.sheetFacing === -1) built.clip.sheetFacing = src.sheetFacing;
      // A pinned-foot dash (Surf's Up) has no travel in the cell. The move's
      // dash speed carries her forward for the whole clip.
      if (move.kind === 'dash' && move.dashSpeed > 0) built.meta.slide = src.noSlide ? 0 : move.dashSpeed;
      // One foot row for the cell. A frame whose sole sits above that row
      // (Diamagnetic Repel, Quantum Leap) keeps the rise.
      if (moveKey === 'basicCharge') built.meta.loop = src.gather || built.meta.windup;
      if (moveKey === 'specialDefense') {
        built.meta.gather = true;
        built.meta.loop = built.meta.active;
        // Play the hop once, hold the guard, then fade that pose into idle.
        if (src.blendIdle) {
          built.meta.intro = built.meta.windup;
          built.meta.blendIdle = true;
        }
      } else if (src.blendIdle) {
        // Atom Smasher stays in the follow-through. Endlag fades that pose
        // into idle instead of playing a recovery the sheet does not have.
        built.meta.blendIdle = true;
        built.meta.recovery = null;
      }
      clips[clipKey] = built.clip;
      metaByClip.set(`${id}|${clipKey}`, built.meta);
      clipByMove.set(`${id}|${moveKey}`, clipKey);
    }
    const idle = SIDE_IDLES[id];
    const idleClip = clips.idle;
    if (idle && idleClip && idle.frameW > 0 && idle.frameH > 0 && idle.count > 0 && idle.visibleH > 0) {
      idleClip.count = idle.count;
      idleClip.fps = idle.fps > 0 ? idle.fps : idleClip.fps;
      idleClip.loop = true;
      idleClip.frameW = idle.frameW;
      idleClip.frameH = idle.frameH;
      idleClip.footY = idle.footY;
      idleClip.visibleH = idle.visibleH;
      idleClip.bodyH = idle.visibleH;
      idleClip.displayScale = artHeight / idle.visibleH;
      idleClip.file = `${id}_idle.png`;
    }
  }
}
