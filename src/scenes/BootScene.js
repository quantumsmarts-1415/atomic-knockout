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

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // character renders (Benjamin-supplied art) — characters without an art
    // entry fall back to the code-drawn vector rig automatically
    for (const c of ROSTER) {
      if (c.art) this.load.image(c.art.key, c.art.file);
      if (!use3dSheets(c)) continue;
      const s = c.art.sheets;
      for (const [clip, def] of Object.entries(s.clips)) {
        this.load.spritesheet(sheetKey(c.art, clip), `${s.dir}${c.id}_${clip}.png`, {
          frameWidth: s.frameW,
          frameHeight: s.frameH,
          // sheets are padded out to a full grid; stop at the real frame count
          endFrame: def.count - 1,
        });
      }
    }
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
