import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { showScene } from '../ui/flow.js';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, THEME, paintPill } from '../ui/theme.js';

export default class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super('PauseMenu');
  }

  init(data) {
    this.resumeKey = data.resumeKey ?? 'Battle';
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, THEME.void, 0.72);
    const panel = this.add.graphics();
    paintPill(panel, W / 2 - 240, H / 2 - 180, 480, 360, 'idle');

    this.add.text(W / 2, H / 2 - 138, 'PAUSED', {
      fontFamily: FONT_DISPLAY, fontSize: '36px', color: THEME.mistCss, letterSpacing: 3,
    }).setOrigin(0.5);

    const resumeG = this.add.graphics();
    paintPill(resumeG, W / 2 - 160, H / 2 - 78, 320, 52, 'selected');
    this.add.text(W / 2, H / 2 - 52, 'RESUME', {
      fontFamily: FONT_BODY, fontSize: '18px', color: THEME.mistCss,
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 - 4, 'ESC  /  ENTER', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.goldCss,
    }).setOrigin(0.5);

    const shakeLabel = () => {
      let mode = 'full';
      try { mode = localStorage.getItem('ak-shake') || 'full'; } catch { /* ignore */ }
      const name = mode === 'off' ? 'Off' : mode === 'reduced' ? 'Reduced' : 'Full';
      return `R  —  SHAKE  ${name.toUpperCase()}`;
    };
    const shake = this.add.text(W / 2, H / 2 + 36, shakeLabel(), {
      fontFamily: FONT_BODY, fontSize: '16px', color: THEME.mistCss,
    }).setOrigin(0.5);

    const quitG = this.add.graphics();
    paintPill(quitG, W / 2 - 160, H / 2 + 68, 320, 48, 'idle');
    this.add.text(W / 2, H / 2 + 92, 'Q  —  QUIT TO TITLE', {
      fontFamily: FONT_BODY, fontSize: '16px', color: THEME.mistCss,
    }).setOrigin(0.5);

    const resume = () => {
      this.scene.stop();
      this.scene.resume(this.resumeKey);
    };
    const kb = this.input.keyboard;
    kb.on('keydown-ESC', resume);
    kb.on('keydown-ENTER', resume);
    kb.on('keydown-P', resume);
    kb.on('keydown-R', () => {
      let mode = 'full';
      try { mode = localStorage.getItem('ak-shake') || 'full'; } catch { /* ignore */ }
      const next = mode === 'full' ? 'reduced' : mode === 'reduced' ? 'off' : 'full';
      try { localStorage.setItem('ak-shake', next); } catch { /* ignore */ }
      shake.setText(shakeLabel());
    });
    kb.on('keydown-Q', () => showScene(this, 'Title'));
  }
}
