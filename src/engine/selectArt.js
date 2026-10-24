// Select-screen art: each fighter's painted cutout plus its idle sheet, so
// the preview shows the real idle the moment a cursor lands on a fighter.
// Walk/attack sheets still load on demand.
import { ROSTER } from '../data/characters.js';
import { sheetKey, use3dSheets } from '../scenes/BootScene.js';

function selectFiles(c) {
  const out = [];
  if (c?.art?.key && c.art.file) out.push({ kind: 'image', key: c.art.key, file: c.art.file });
  const s = c?.art?.sheets;
  const idle = s?.clips?.idle;
  if (idle && use3dSheets(c)) {
    const frameW = idle.frameW ?? s.frameW;
    const frameH = idle.frameH ?? s.frameH;
    if (frameW && frameH) {
      out.push({
        kind: 'sheet', key: sheetKey(c.art, 'idle'), file: `${s.dir}${idle.file || `${c.id}_idle.png`}`,
        frameW, frameH, end: idle.count - 1,
      });
    }
  }
  return out;
}

export function missingSelectPortraits(exists, roster = ROSTER) {
  return roster.filter((c) => selectFiles(c).some((f) => !exists(f.key)));
}

/** Queue cutouts and idle sheets. Returns how many files were added. */
export function queueSelectPortraits(loader, exists = () => false, roster = ROSTER) {
  let n = 0;
  for (const c of roster) {
    for (const f of selectFiles(c)) {
      if (exists(f.key)) continue;
      if (f.kind === 'image') loader.image(f.key, f.file);
      else loader.spritesheet(f.key, f.file, { frameWidth: f.frameW, frameHeight: f.frameH, endFrame: f.end });
      n++;
    }
  }
  return n;
}
