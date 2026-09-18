import * as Phaser from 'phaser';
import { ROSTER } from '../data/characters.js';

// A character can supply art in two forms:
//   - a single render (art.file) -> puppet-animated by the Rig
//   - 3D sprite sheets (art.sheets, gated on art.use3d) -> real frame animation
// Both are loaded when present, so flipping use3d off needs no reload changes.
export function sheetKey(art, clip) {
  return `${art.key}-${clip}`;
}

export function use3dSheets(charDef) {
  return Boolean(charDef.art?.use3d && charDef.art.sheets);
}

export function positiveFinite(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function finiteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

// Clip cell size: optional clips.<clip>.frameW / frameH, else sheets.frameW / frameH.
// Resolved values must be finite and > 0 — a 0/NaN/Infinity cell would mis-slice the sheet.
export function clipFrameSize(sheets, clipDef = {}) {
  const frameW = clipDef.frameW ?? sheets.frameW;
  const frameH = clipDef.frameH ?? sheets.frameH;
  if (!positiveFinite(frameW) || !positiveFinite(frameH)) {
    throw new RangeError(`Sprite-sheet frame size must be finite and > 0, got ${frameW}x${frameH}`);
  }
  return { frameW, frameH };
}

// Origin/scale for a clip. Each of frameW/frameH/footY/visibleH is independent:
// a clip may override any subset; omitted fields fall back to sheets.*.
export function clipDisplayLayout(sheets, clipDef = {}) {
  const footY = clipDef.footY ?? sheets.footY;
  const visibleH = clipDef.visibleH ?? sheets.visibleH;
  if (!finiteNumber(footY)) {
    throw new RangeError(`Clip footY must be a finite number, got ${footY}`);
  }
  if (!positiveFinite(visibleH)) {
    throw new RangeError(`Clip visibleH must be finite and > 0, got ${visibleH}`);
  }
  return { footY, visibleH };
}

export function loadRosterArt(loader, roster) {
  for (const c of roster) {
    if (c.art) loader.image(c.art.key, c.art.file);
    if (!use3dSheets(c)) continue;
    const s = c.art.sheets;
    for (const [clip, def] of Object.entries(s.clips)) {
      let frameW;
      let frameH;
      try {
        ({ frameW, frameH } = clipFrameSize(s, def));
      } catch (err) {
        console.error(`Skipping spritesheet ${c.id}_${clip}: ${err.message}`);
        continue;
      }
      loader.spritesheet(sheetKey(c.art, clip), `${s.dir}${c.id}_${clip}.png`, {
        frameWidth: frameW,
        frameHeight: frameH,
        // sheets are padded out to a full grid; stop at the real frame count
        endFrame: def.count - 1,
      });
    }
  }
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // character renders (Benjamin-supplied art) — characters without an art
    // entry fall back to the code-drawn vector rig automatically
    loadRosterArt(this.load, ROSTER);
  }

  create() {
    for (const c of ROSTER) {
      if (!use3dSheets(c)) continue;
      const s = c.art.sheets;
      for (const [clip, def] of Object.entries(s.clips)) {
        const key = sheetKey(c.art, clip);
        if (this.anims.exists(key) || !this.textures.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: def.count - 1 }),
          frameRate: def.fps,
          repeat: def.loop ? -1 : 0,
        });
      }
    }
    this.scene.start('Title');
  }
}
