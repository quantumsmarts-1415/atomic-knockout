// Select-screen art is the painted cutout plus the small face square.
// Move sheets stay unloaded until two fighters are locked, so the boot
// never pulls the whole roster.
import { ROSTER } from '../data/characters.js';
import { hasFacePortrait, portraitFile, portraitTextureKey } from '../data/portraitCrops.js';

export function selectPortraitList(roster = ROSTER) {
  return roster.filter((c) => c?.art?.key && c.art.file);
}

export function missingSelectPortraits(exists, roster = ROSTER) {
  return selectPortraitList(roster).filter((c) => !exists(c.art.key));
}

export function facePortraitList(roster = ROSTER) {
  return roster.filter((c) => hasFacePortrait(c.id));
}

export function missingFacePortraits(exists, roster = ROSTER) {
  return facePortraitList(roster).filter((c) => !exists(portraitTextureKey(c.id)));
}

/** Queue face squares. Returns how many files were added. */
export function queueFacePortraits(loader, exists = () => false, roster = ROSTER) {
  const missing = missingFacePortraits(exists, roster);
  for (const c of missing) loader.image(portraitTextureKey(c.id), portraitFile(c.id));
  return missing.length;
}

/** Queue cutouts and face squares. Returns how many files were added. */
export function queueSelectPortraits(loader, exists = () => false, roster = ROSTER) {
  const missing = missingSelectPortraits(exists, roster);
  for (const c of missing) loader.image(c.art.key, c.art.file);
  return missing.length + queueFacePortraits(loader, exists, roster);
}
