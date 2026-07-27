import * as Phaser from 'phaser';
import { ROSTER } from '../data/characters.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // character renders (Benjamin-supplied art) — characters without an art
    // entry fall back to the code-drawn vector rig automatically
    for (const c of ROSTER) {
      if (c.art) this.load.image(c.art.key, c.art.file);
    }
  }

  create() {
    this.scene.start('Title');
  }
}
