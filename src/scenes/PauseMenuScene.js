import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';

export default class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super('PauseMenu');
  }

  init(data) {
    this.resumeKey = data.resumeKey ?? 'Battle';
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x060a14, 0.65);
    const panel = this.add.graphics();
    panel.fillStyle(0x101b33, 0.95);
    panel.fillRoundedRect(W / 2 - 220, H / 2 - 130, 440, 260, 22);
    panel.lineStyle(4, 0x7fd4ff, 1);
    panel.strokeRoundedRect(W / 2 - 220, H / 2 - 130, 440, 260, 22);

    this.add.text(W / 2, H / 2 - 84, 'PAUSED', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '44px', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 4, 'Esc / Enter — Resume', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 56, 'Q — Quit to Title', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5);

    const resume = () => {
      this.scene.stop();
      this.scene.resume(this.resumeKey);
    };
    const kb = this.input.keyboard;
    kb.on('keydown-ESC', resume);
    kb.on('keydown-ENTER', resume);
    kb.on('keydown-P', resume);
    kb.on('keydown-Q', () => {
      this.scene.stop(this.resumeKey);
      this.scene.stop();
      this.scene.start('Title');
    });
  }
}
