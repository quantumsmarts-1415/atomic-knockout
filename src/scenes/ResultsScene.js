import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  init(data) {
    this.results = data.results ?? [];
    this.setup = data.setup;
  }

  create() {
    const g = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x101b33);
    const bottom = Phaser.Display.Color.ValueToColor(0x2a4a6e);
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 24, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 24) * i, W, H / 24 + 1);
    }

    const winner = this.results.find((r) => r.won);
    this.add.text(W / 2, 90, winner ? `${winner.name.toUpperCase()} WINS!` : 'DRAW!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#ffd166',
      stroke: '#1c2b4a', strokeThickness: 12,
    }).setOrigin(0.5);

    // winner's rig doing a victory pose
    if (winner) {
      const def = CHARACTERS[winner.charId];
      this.winnerRig = new Rig(this, def, winner.palette);
      this.winnerRig.setPosition(W / 2, 330);
      this.winnerRig.baseScale = 1.8;
      this.add.existing(this.winnerRig);
      // teaching moment — surface the element fact on the results screen
      this.add.text(W / 2, 392, `${def.element} fact: ${def.teach}`, {
        fontFamily: 'Georgia, serif', fontSize: '19px', fontStyle: 'italic', color: '#cfe4ff',
        wordWrap: { width: 700 }, align: 'center',
      }).setOrigin(0.5, 0);
    }

    // stat panels
    this.results.forEach((r, i) => {
      const x = i === 0 ? W / 2 - 300 : W / 2 + 300;
      const panel = this.add.graphics();
      panel.fillStyle(0x0a0f1c, 0.6);
      panel.fillRoundedRect(x - 150, 470, 300, 130, 16);
      panel.lineStyle(3, r.won ? 0xffd166 : 0x44587a, 1);
      panel.strokeRoundedRect(x - 150, 470, 300, 130, 16);
      this.add.text(x, 488, `${r.name}${r.won ? '  ★' : ''}`, {
        fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#ffffff',
      }).setOrigin(0.5, 0);
      this.add.text(x, 526, `KOs: ${r.kos}    Damage dealt: ${r.damageDealt}%\nStocks left: ${Math.max(0, r.stocks)}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#9fc4e8', align: 'center',
      }).setOrigin(0.5, 0);
    });

    this.add.text(W / 2, H - 50, 'Enter — Rematch      C — Character Select      T — Title', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);

    const kb = this.input.keyboard;
    kb.on('keydown-ENTER', () => this.scene.start('Battle', this.setup));
    kb.on('keydown-F', () => this.scene.start('Battle', this.setup));
    kb.on('keydown-K', () => this.scene.start('Battle', this.setup));
    kb.on('keydown-C', () => this.scene.start('CharacterSelect'));
    kb.on('keydown-T', () => this.scene.start('Title'));
  }

  update(time, delta) {
    // victory bounce
    if (this.winnerRig) {
      this.winnerRig.animate(delta / 1000, 'idle', 0);
      this.winnerRig.y = 330 + Math.sin(time / 260) * 8;
    }
  }
}
