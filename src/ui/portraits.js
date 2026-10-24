import { FACE_BOX } from '../data/faceBox.js';
// Which painted cuts are safe to show in menus.
//
// Helen, Scarlett, Titan, Chloe, and Van have a transparency-grid checker
// baked into the cut (visible when the PNG is composited on a flat color).
// Those stay off every menu surface; the symbol card is used instead.
// Hydra's bright edge is the flame, not a checker. Natalie (sodium) is a
// clean cut with a dark outline — she stands in for Helen on the title.

export const FRINGE_PORTRAIT_IDS = new Set(['helen', 'scarlett', 'titan', 'chloe', 'van']);

/** Texture key for a menu portrait, or null when the cut should not be shown. */
export function menuPortraitKey(charDef) {
  if (!charDef?.art?.key || FRINGE_PORTRAIT_IDS.has(charDef.id)) return null;
  return charDef.art.key;
}

export const TITLE_PARTNER_ID = 'natalie';

/**
 * Head-and-shoulders frame cut from frame 0 of the fighter's in-game idle
 * sheet. Returns { key, frame, flip, size } or null when the idle is not
 * loaded (callers fall back to the painted cut).
 */
export function faceFrame(scene, charDef) {
  const art = charDef?.art;
  const box = FACE_BOX[charDef?.id];
  if (!art?.sheets || !box || !scene?.textures) return null;
  const key = `${art.key}-idle`;
  if (!scene.textures.exists(key)) return null;
  const tex = scene.textures.get(key);
  const name = 'face';
  if (!tex.has(name)) {
    const f0 = tex.get(0);
    tex.add(name, f0.sourceIndex, f0.cutX + box[0], f0.cutY + box[1], box[2], box[3]);
  }
  return { key, frame: name, flip: (art.facing ?? 1) === -1, size: box[2] };
}
