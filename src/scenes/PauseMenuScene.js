import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { showScene } from '../ui/flow.js';
import { play as sfx } from '../engine/sfx.js';
import { FONT_DISPLAY, MOTION, PLAYER_COLORS, THEME, drawFooterHints, drawPanel, makeButton, textStyle } from '../ui/theme.js';
import { percentColor } from '../engine/feel.js';
import { openSettings } from '../ui/settings.js';
import { pollGamepads } from '../engine/gamepad.js';

export default class PauseMenuScene extends Phaser.Scene {
  constructor() {
    super('PauseMenu');
  }

  init(data) {
    this.resumeKey = data.resumeKey ?? 'Battle';
    this.stageName = data.stageName || '';
    this.fighters = Array.isArray(data.fighters) ? data.fighters.slice(0, 6) : [];
  }

  create() {
    this.overlay = null;
    this.closing = false;
    const rows = this.fighters.length;
    const listH = rows * 32;
    const panelW = 500;
    const buttonTop = 118 + listH + (rows ? 16 : 0);
    const hintAt = buttonTop + 3 * 54 + 10;
    const panelH = hintAt + 36;
    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;
    const veil = this.add.rectangle(W / 2, H / 2, W, H, THEME.void, 0).setDepth(0);
    this.tweens.add({ targets: veil, fillAlpha: 0.72, duration: MOTION.base });
    const panel = drawPanel(this, px, py, panelW, panelH, 18).setDepth(1);
    const kicker = this.add.text(W / 2, py + 26, 'MATCH PAUSED', textStyle('kicker')).setOrigin(0.5).setDepth(2);
    const title = this.add.text(W / 2, py + 46, 'PAUSED', textStyle('h1')).setOrigin(0.5, 0).setDepth(2);
    const stage = this.add.text(W / 2, py + 96, this.stageName ? this.stageName.toUpperCase() : '', textStyle('label', { color: THEME.tealCss })).setOrigin(0.5).setDepth(2);
    const rosterBits = this.drawRoster(px, py + 114, panelW);

    const bw = 300;
    const bx = (W - bw) / 2;
    const by = py + buttonTop;
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
    ], { y: py + hintAt, depth: 2 });

    const group = [panel, kicker, title, stage, ...rosterBits, ...this.buttons.map((b) => b.container)];
    this.group = group;
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

  drawRoster(px, top, panelW) {
    const bits = [];
    const left = px + 36;
    const right = px + panelW - 36;
    this.fighters.forEach((f, i) => {
      const y = top + i * 32;
      const pip = this.add.circle(left, y, 5, PLAYER_COLORS[i % PLAYER_COLORS.length]).setDepth(2);
      const name = this.add.text(left + 16, y, `${f.name || 'Fighter'}${f.symbol ? `  ${f.symbol}` : ''}`, {
        fontFamily: FONT_DISPLAY, fontSize: '15px', color: THEME.mistCss,
      }).setOrigin(0, 0.5).setDepth(2);
      const percent = this.add.text(right - 78, y, `${Math.round(f.percent || 0)}%`, {
        fontFamily: FONT_DISPLAY, fontSize: '16px', color: percentColor(f.percent || 0),
      }).setOrigin(1, 0.5).setDepth(2);
      const stocks = this.add.graphics().setDepth(2);
      const max = Math.max(1, f.stocksMax || 3);
      const have = Math.max(0, f.stocks || 0);
      for (let s = 0; s < max; s++) {
        const cx = right - (max - 1 - s) * 14;
        stocks.fillStyle(s < have ? PLAYER_COLORS[i % PLAYER_COLORS.length] : 0x2a2440, 1);
        stocks.fillCircle(cx, y, 4);
      }
      bits.push(pip, name, percent, stocks);
    });
    return bits;
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
    this.tweens.add({ targets: this.group, alpha: 0, duration: MOTION.quick });
    this.overlay = openSettings(this, {
      onClose: () => {
        this.overlay = null;
        this.hints.setVisible(true);
        this.tweens.add({ targets: this.group, alpha: 1, duration: MOTION.base, ease: MOTION.easeOut });
      },
    });
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
