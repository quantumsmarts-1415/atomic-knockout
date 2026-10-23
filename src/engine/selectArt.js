// Select-screen art is the painted cutout only. Move sheets stay unloaded
// until two fighters are locked, so the boot never pulls the whole roster.
import { ROSTER } from '../data/characters.js';

export function selectPortraitList(roster = ROSTER) {
  return roster.filter((c) => c?.art?.key && c.art.file);
}

export function missingSelectPortraits(exists, roster = ROSTER) {
  return selectPortraitList(roster).filter((c) => !exists(c.art.key));
}

/** Queue cutout images. Returns how many files were added. */
export function queueSelectPortraits(loader, exists = () => false, roster = ROSTER) {
  const missing = missingSelectPortraits(exists, roster);
  for (const c of missing) loader.image(c.art.key, c.art.file);
  return missing.length;
}
