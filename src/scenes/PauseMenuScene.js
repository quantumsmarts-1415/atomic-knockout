import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { showScene } from '../ui/flow.js';
import { play as sfx } from '../engine/sfx.js';
import { MOTION, THEME, drawFooterHints, drawPanel, makeButton, textStyle } from '../ui/theme.js';
import { openSettings } from '../ui/settings.js';
import { pollGamepads } from '../engine/gamepad.js';

const PANEL = { w: 440, h: 340 };

export default class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super('PauseMenu');
  }

  init(data) {
    this.resumeKey = data.resumeKey ?? 'Battle';
  }

  create() {
    this.overlay = null;
    this.closing = false;
    const px = (W - PANEL.w) / 2;
    const py = (H - PANEL.h) / 2;
    const veil = this.add.rectangle(W / 2, H / 2, W, H, THEME.void, 0).setDepth(0);
    this.tweens.add({ targets: veil, fillAlpha: 0.72, duration: MOTION.base });
    const panel = drawPanel(this, px, py, PANEL.w, PANEL.h, 18).setDepth(1);
    const kicker = this.add.text(W / 2, py + 30, 'MATCH PAUSED', textStyle('kicker')).setOrigin(0.5).setDepth(2);
    const title = this.add.text(W / 2, py + 54, 'PAUSED', textStyle('h1')).setOrigin(0.5, 0).setDepth(2);

    const bw = 300;
    const bx = (W - bw) / 2;
    const by = py + 118;
    const entries = [
      { label: 'Resume', keyHint: 'ESC', onPress: () => this.resumeMatch() },
      { label: 'Settings', onPress: () => this.openSettings() },
      { label: 'Quit to title', onPress: () => this.quit() },
    ];
    this.buttons = entries.map((e, i) => {
      const b = makeButton(this, { x: bx, y: by + i * 54, w: bw, h: 44, label: e.label, keyHint: e.keyHint, depth: 2, onPress: () => { sfx('menuConfirm'); e.onPress(); } });
      b.onHover = () => this.select(i, false);
      return b;
    });
    this.selected = 0;
    this.buttons[0].setSelected(true);

    this.hints = drawFooterHints(this, [
      { keys: ['W', 'S'], label: 'Choose' },
      { key: 'ENTER', label: 'Select' },
    ], { y: py + PANEL.h - 30, depth: 2 });

    const group = [panel, kicker, title, ...this.buttons.map((b) => b.container)];
    group.forEach((o) => { o.setAlpha(0); });
    this.tweens.add({ targets: group, alpha: 1, duration: MOTION.base, ease: MOTION.easeOut });

    // Start is still held from the press that opened this menu.
    this.prevStart = true;
    const kb = this.input.keyboard;
    const guard = (fn) => () => { if (!this.overlay && !this.closing) fn(); };
    kb.on('keydown-ESC', guard(() => this.resumeMatch()));
    kb.on('keydown-P', guard(() => this.resumeMatch()));
    for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, guard(() => this.move(-1)));
    for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, guard(() => this.move(1)));
    for (const k of ['ENTER', 'SPACE', 'F', 'K']) kb.on(`keydown-${k}`, guard(() => this.buttons[this.selected].press()));
    kb.on('keydown-Q', guard(() => this.quit()));
  }

  select(i, sound = true) {
    if (i === this.selected) return;
    this.buttons[this.selected].setSelected(false);
    this.selected = i;
    this.buttons[i].setSelected(true);
    if (sound) sfx('menuMove');
  }

  move(d) {
    this.select((this.selected + d + this.buttons.length) % this.buttons.length);
  }

  openSettings() {
    if (this.overlay) return;
    this.hints.setVisible(false);
    this.overlay = openSettings(this, { onClose: () => { this.overlay = null; this.hints.setVisible(true); } });
  }

  resumeMatch() {
    if (this.closing) return;
    this.closing = true;
    this.scene.stop();
    this.scene.resume(this.resumeKey);
  }

  quit() {
    if (this.closing) return;
    this.closing = true;
    showScene(this, 'Title');
  }

  update() {
    const start = pollGamepads().some((pad) => pad.input.pause);
    if (start && !this.prevStart && !this.overlay) this.resumeMatch();
    this.prevStart = start;
  }
}
