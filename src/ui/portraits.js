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
