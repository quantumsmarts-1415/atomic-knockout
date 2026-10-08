import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import {
  FONT_BODY, FONT_DISPLAY, FONT_MONO, THEME, drawMenuBackground, paintPill,
} from '../ui/theme.js';
import { showScene } from '../ui/flow.js';
import { attachPhoneJoin } from '../ui/phoneJoin.js';
import { TITLE_PARTNER_ID } from '../ui/portraits.js';
import { CHARACTERS } from '../data/characters.js';

// Bottom console is a fixed band. Portraits stop above it so they never
// cover the QR, the URL, or the control line. Same 1280x720 layout at
// every window size — Scale.FIT only letterboxes.
const CONSOLE = { x: 250, y: 608, w: 780, h: 96 };
const PORTRAIT_FEET = CONSOLE.y - 8;

const PILL_W = 168;
const PILL_H = 40;
const PILL_GAP = 12;

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    drawMenuBackground(this, W, H);
    this.drawPortraits();
    this.drawNucleus();

    this.add.text(W / 2, 28, 'REACTOR ONLINE', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.tealCss, letterSpacing: 4,
    }).setOrigin(0.5).setDepth(6);
    this.add.text(W / 2, 58, 'ATOMIC KNOCKOUT', {
      fontFamily: FONT_DISPLAY, fontSize: '36px', color: THEME.mistCss, letterSpacing: 2,
    }).setOrigin(0.5).setDepth(6);
    this.add.text(W / 2, 96, 'AN ELEMENTAL BRAWL', {
      fontFamily: FONT_BODY, fontSize: '13px', color: THEME.dimCss, letterSpacing: 3,
    }).setOrigin(0.5).setDepth(6);

    this.buttons = [
      { label: 'Play', action: () => showScene(this, 'PlayerJoin') },
      { label: 'Campaign', action: null },
      { label: 'Settings', action: null },
      { label: 'Credits', action: () => this.showCredits() },
    ];
    this.selected = 0;
    this.hover = -1;
    const rowW = this.buttons.length * PILL_W + (this.buttons.length - 1) * PILL_GAP;
    const rowX = (W - rowW) / 2;
    this.pills = this.buttons.map((b, i) => {
      const x = rowX + i * (PILL_W + PILL_GAP);
      const y = 118;
      const g = this.add.graphics().setDepth(6);
      const label = this.add.text(x + PILL_W / 2, y + PILL_H / 2, b.label.toUpperCase(), {
        fontFamily: FONT_BODY, fontSize: '15px', color: THEME.mistCss,
      }).setOrigin(0.5).setDepth(7);
      const soon = this.add.text(x + PILL_W - 14, y + 8, b.action ? '' : 'SOON', {
        fontFamily: FONT_MONO, fontSize: '10px', color: THEME.disabledCss,
      }).setOrigin(1, 0).setDepth(7);
      if (b.action) {
        const zone = this.add.zone(x, y, PILL_W, PILL_H).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(8);
        zone.on('pointerover', () => { this.hover = i; this.selected = i; this.refresh(); });
        zone.on('pointerout', () => { if (this.hover === i) this.hover = -1; this.refresh(); });
        zone.on('pointerdown', () => { sfx('menuConfirm'); b.action(); });
      }
      return { g, label, soon, x, y };
    });
    this.refresh();

    this.drawConsole();

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-W', () => this.move(-1));
    kb.on('keydown-S', () => this.move(1));
    kb.on('keydown-LEFT', () => this.move(-1));
    kb.on('keydown-RIGHT', () => this.move(1));
    kb.on('keydown-A', () => this.move(-1));
    kb.on('keydown-D', () => this.move(1));
    const go = () => {
      if (this.buttons[this.selected].action) {
        sfx('menuConfirm');
        this.buttons[this.selected].action();
      }
    };
    kb.on('keydown-ENTER', go);
    kb.on('keydown-F', go);
    kb.on('keydown-SPACE', go);
  }

  drawPortraits() {
    // Hydra faces right; Natalie (sodium) faces left. They frame the nucleus.
    this.placePortrait('char-hydra', 160, 400);
    const partner = CHARACTERS[TITLE_PARTNER_ID];
    if (partner?.art?.key) this.placePortrait(partner.art.key, W - 210, 410);
  }

  placePortrait(key, x, height) {
    if (!this.textures.exists(key)) return;
    const img = this.add.image(x, PORTRAIT_FEET, key).setOrigin(0.5, 1).setDepth(2);
    img.setScale(height / img.height);
  }

  drawNucleus() {
    const g = this.add.graphics().setDepth(4);
    const cx = W / 2;
    const cy = 360;
    g.fillStyle(0x140e22, 1);
    g.fillCircle(cx, cy, 74);
    g.lineStyle(2, THEME.gold, 0.95);
    g.strokeCircle(cx, cy, 74);
    g.lineStyle(8, THEME.pink, 0.18);
    g.strokeCircle(cx, cy, 86);
    this.add.text(cx, cy - 22, '119', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.tealCss, letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);
    this.add.text(cx, cy + 10, 'Pt', {
      fontFamily: FONT_DISPLAY, fontSize: '48px', color: THEME.mistCss,
    }).setOrigin(0.5).setDepth(5);
  }

  drawConsole() {
    const { x, y, w, h } = CONSOLE;
    const g = this.add.graphics().setDepth(6);
    paintPill(g, x, y, w, h, 'idle');
    this.add.text(x + 118, y + 16, 'SCAN TO LINK A CONTROLLER', {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.goldCss, letterSpacing: 1,
    }).setDepth(7);
    this.qrUrl = this.add.text(x + 118, y + 38, '', {
      fontFamily: FONT_MONO, fontSize: '16px', color: THEME.tealCss,
    }).setDepth(7);
    this.qrHint = this.add.text(x + 118, y + 62, 'Same WiFi  ·  P1 WASD+F/G  ·  P2 Arrows+K/L', {
      fontFamily: FONT_BODY, fontSize: '13px', color: THEME.dimCss,
    }).setDepth(7);
    this.add.text(x + w - 18, y + h / 2, 'ENTER TO PLAY', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.goldCss,
    }).setOrigin(1, 0.5).setDepth(7);

    // QR sits in the left of the console, clear of both portraits (their
    // feet stop at PORTRAIT_FEET, above this band).
    attachPhoneJoin(this, {
      x: x + 58,
      y: y + h / 2,
      size: 72,
      hideWhenOffline: true,
      caption: false,
      depth: 8,
      onLink: ({ url }) => {
        this.qrUrl?.setText(url.replace(/^https?:\/\//, ''));
      },
    });
  }

  move(dir) {
    sfx('menuMove');
    do {
      this.selected = (this.selected + dir + this.buttons.length) % this.buttons.length;
    } while (!this.buttons[this.selected].action);
    this.refresh();
  }

  refresh() {
    this.pills.forEach((p, i) => {
      const live = !!this.buttons[i].action;
      const state = !live ? 'disabled' : i === this.selected ? 'selected' : i === this.hover ? 'hover' : 'idle';
      p.g.clear();
      paintPill(p.g, p.x, p.y, PILL_W, PILL_H, state);
      p.label.setColor(!live ? THEME.disabledCss : THEME.mistCss);
      p.soon.setVisible(!live);
    });
  }

  showCredits() {
    if (this.creditsText) return;
    this.creditsText = this.add.text(W / 2, CONSOLE.y - 22,
      'Created by Benjamin — Phaser 3', {
        fontFamily: FONT_BODY, fontSize: '15px', color: THEME.tealCss,
      }).setOrigin(0.5).setDepth(7);
    this.time.delayedCall(4000, () => { this.creditsText?.destroy(); this.creditsText = null; });
  }
}
