// Who gets the gold edge on the periodic-table select screen.
// The reviewed roster is atomic numbers 1–37 (Hydra through Ruben).
// Anyone past that lights up automatically once they have a per-move body
// sheet or a Gemini/Flow folder under assets/fx/<id>/. The status folder
// is a shared overlay, not a fighter.

import { MOVE_SHEETS } from './moveSheets.js';
import { hasBodyClips } from './bodyClips.js';

export const REVIEWED_THROUGH = 37;

export function fighterIdsFromFxIndex(rows) {
  const ids = new Set();
  if (!Array.isArray(rows)) return ids;
  for (const rel of rows) {
    const id = String(rel || '').split('/')[0];
    if (!id || id === 'status' || id.includes('.')) continue;
    ids.add(id);
  }
  return ids;
}

export function artIsUpdated(fighter, fxIds, moveSheets = MOVE_SHEETS) {
  if (!fighter?.id) return false;
  const z = fighter.atomicNumber | 0;
  if (z >= 1 && z <= REVIEWED_THROUGH) return true;
  if (moveSheets?.[fighter.id]) return true;
  if (hasBodyClips(fighter.id)) return true;
  if (fxIds?.has?.(fighter.id)) return true;
  return false;
}
