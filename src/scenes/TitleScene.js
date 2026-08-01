import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';

// ---------------------------------------------------------------------------
// TitleScene — home screen. Play is live; Campaign/Settings are stubs that
// later phases (9, 10) turn real.
// ---------------------------------------------------------------------------
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.drawBackground();

    // logo: element-tile styled title
    const tile = this.add.graphics();
    tile.fillStyle(0x53e0a8, 1);
    tile.fillRoundedRect(W / 2 - 70, 92, 140, 140, 18);
    tile.fillStyle(0x2a8f68, 1);
    tile.fillRoundedRect(W / 2 - 70, 92, 140, 140, 18);
    tile.fillStyle(0x53e0a8, 1);
    tile.fillRoundedRect(W / 2 - 64, 98, 128, 128, 14);
    this.add.text(W / 2 - 54, 104, '119', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#14352a' });
    this.add.text(W / 2, 168, 'Pt', { fontFamily: 'Georgia, serif', fontSize: '74px', fontStyle: 'bold', color: '#0d2a1f' }).setOrigin(0.5);

    this.add.text(W / 2, 286, 'ATOMIC KNOCKOUT', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '58px', color: '#ffffff',
      stroke: '#1c2b4a', strokeThickness: 10,
    }).setOrigin(0.5);
    this.add.text(W / 2, 338, 'an elemental brawl', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'italic', color: '#9fc4e8',
    }).setOrigin(0.5);

    this.buttons = [
      { label: 'Play', action: () => this.scene.start('PlayerJoin') },
      { label: 'Campaign  (coming soon)', action: null },
      { label: 'Settings  (coming soon)', action: null },
      { label: 'Credits', action: () => this.showCredits() },
    ];
    this.selected = 0;
    this.buttonTexts = this.buttons.map((b, i) => {
      const t = this.add.text(W / 2, 420 + i * 58, b.label, {
        fontFamily: 'Arial Black, sans-serif', fontSize: '30px',
        color: b.action ? '#ffffff' : '#5a6a85',
      }).setOrigin(0.5);
      if (b.action) {
        t.setInteractive({ useHandCursor: true })
          .on('pointerover', () => { this.selected = i; this.refresh(); })
          .on('pointerdown', b.action);
      }
      return t;
    });
    this.refresh();

    const kb = this.input.keyboard;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    kb.on('keydown-W', () => this.move(-1));
    kb.on('keydown-S', () => this.move(1));
    const go = () => { if (this.buttons[this.selected].action) { sfx('menuConfirm'); this.buttons[this.selected].action(); } };
    kb.on('keydown-ENTER', go);
    kb.on('keydown-F', go);
    kb.on('keydown-SPACE', go);

    this.add.text(W / 2, H - 28, 'P1: WASD + F/G     P2: Arrows + K/L     up to 4 more join by phone     Enter to select', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#7f95b5',
    }).setOrigin(0.5);
  }

  drawBackground() {
    const g = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x0d1220);
    const bottom = Phaser.Display.Color.ValueToColor(0x1c3050);
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 24, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 24) * i, W, H / 24 + 1);
    }
    // drifting element tiles in the background
    const rnd = new Phaser.Math.RandomDataGenerator(['title']);
    const symbols = ['H', 'He', 'Li', 'C', 'O', 'Fe', 'Au', 'Ne', 'Ti', 'Cu', 'U', 'Na'];
    for (const s of symbols) {
      const x = rnd.between(40, W - 40);
      const y = rnd.between(40, H - 40);
      const size = rnd.between(34, 60);
      const tile = this.add.graphics();
      tile.fillStyle(0x7fd4ff, 0.05);
      tile.fillRoundedRect(-size / 2, -size / 2, size, size, 8);
      tile.lineStyle(1.5, 0x7fd4ff, 0.12);
      tile.strokeRoundedRect(-size / 2, -size / 2, size, size, 8);
      tile.setPosition(x, y);
      const label = this.add.text(x, y, s, {
        fontFamily: 'Georgia, serif', fontSize: `${size * 0.45}px`, color: '#7fd4ff',
      }).setOrigin(0.5).setAlpha(0.14);
      this.tweens.add({
        targets: [tile, label],
        y: `-=${rnd.between(20, 60)}`,
        duration: rnd.between(6000, 12000),
        yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    }
  }

  move(dir) {
    sfx('menuMove');
    do {
      this.selected = (this.selected + dir + this.buttons.length) % this.buttons.length;
    } while (!this.buttons[this.selected].action);
    this.refresh();
  }

  refresh() {
    this.buttonTexts.forEach((t, i) => {
      const active = i === this.selected && this.buttons[i].action;
      t.setColor(active ? '#ffd166' : this.buttons[i].action ? '#ffffff' : '#5a6a85');
      t.setScale(active ? 1.08 : 1);
    });
  }

  showCredits() {
    if (this.creditsText) return;
    this.creditsText = this.add.text(W / 2, H - 70,
      'Created by Benjamin — built with Claude Code · Phaser 3 · all art drawn in code', {
        fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#ffd166',
      }).setOrigin(0.5);
    this.time.delayedCall(4000, () => { this.creditsText?.destroy(); this.creditsText = null; });
  }
}
