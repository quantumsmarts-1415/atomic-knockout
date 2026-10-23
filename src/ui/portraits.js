// Which painted cuts are safe to show in menus.
//
// Helen, Scarlett, Titan, Chloe, and Van have a transparency-grid checker
// baked into the full cut (visible when that PNG is composited on a flat
// color). Damage discs use the face squares in assets/portraits instead,
// which are cropped clear of that grid. The symbol card is only the
// fallback when a face file is missing.
// Hydra's bright edge is the flame, not a checker. Natalie (sodium) is a
// clean cut with a dark outline — she stands in for Helen on the title.

import { hasFacePortrait, portraitTextureKey } from '../data/portraitCrops.js';

export const FRINGE_PORTRAIT_IDS = new Set(['helen', 'scarlett', 'titan', 'chloe', 'van']);

/** Texture key for a menu portrait, or null when nothing safe is on disk. */
export function menuPortraitKey(charDef) {
  if (hasFacePortrait(charDef?.id)) return portraitTextureKey(charDef.id);
  if (!charDef?.art?.key || FRINGE_PORTRAIT_IDS.has(charDef.id)) return null;
  return charDef.art.key;
}

export const TITLE_PARTNER_ID = 'natalie';
