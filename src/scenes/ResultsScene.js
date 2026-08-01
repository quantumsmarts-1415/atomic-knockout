import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { drawMenuBackground } from '../ui/theme.js';

export default class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  init(data) {
    this.results = data.results ?? [];
    this.setup = data.setup;
  }

  create() {
    drawMenuBackground(this, W, H);

    const winner = this.results.find((r) => r.won);
    this.add.text(W / 2, 90, winner ? `${winner.name.toUpperCase()} WINS!` : 'DRAW!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '64px', color: '#4ad6ff',
      stroke: '#060a10', strokeThickness: 12, letterSpacing: 1,
    }).setOrigin(0.5);

    // winner's rig doing a victory pose
    if (winner) {
      const def = CHARACTERS[winner.charId];
      this.winnerRig = new Rig(this, def, winner.palette);
      this.winnerRig.setPosition(W / 2, 355);
      this.winnerRig.baseScale = winner ? (CHARACTERS[winner.charId].art ? 1.15 : 1.8) : 1.8;
      this.add.existing(this.winnerRig);
      // teaching moment — surface the element fact on the results screen
      this.add.text(W / 2, 392, `${def.element} fact: ${def.teach}`, {
        fontFamily: 'Georgia, serif', fontSize: '19px', fontStyle: 'italic', color: '#d8ecff',
        wordWrap: { width: 700 }, align: 'center',
      }).setOrigin(0.5, 0);
    }

    // stat panels — evenly spread across the usable width; shrinks to fit
    // however many players were actually in the match (up to 6).
    const n = this.results.length;
    const areaW = W - 80;
    const panelW = Math.min(300, areaW / n - 16);
    const spacing = areaW / n;
    const nameScale = Math.min(1, panelW / 300);
    this.results.forEach((r, i) => {
      const x = 40 + spacing * (i + 0.5);
      const panel = this.add.graphics();
      panel.fillStyle(0xffffff, 0.03);
      panel.fillRoundedRect(x - panelW / 2, 470, panelW, 130, 16);
      panel.lineStyle(1.5, r.won ? 0x4ad6ff : 0x3a4a5c, r.won ? 0.9 : 0.6);
      panel.strokeRoundedRect(x - panelW / 2, 470, panelW, 130, 16);
      this.add.text(x, 488, `${r.name}${r.won ? '  ★' : ''}`, {
        fontFamily: 'Arial Black, sans-serif', fontSize: `${Math.round(24 * nameScale)}px`, color: '#eaf9ff',
      }).setOrigin(0.5, 0);
      this.add.text(x, 526, `KOs: ${r.kos}    Damage dealt: ${r.damageDealt}%\nStocks left: ${Math.max(0, r.stocks)}`, {
        fontFamily: 'Arial, sans-serif', fontSize: `${Math.round(18 * nameScale)}px`, color: '#5c7a94', align: 'center',
        wordWrap: { width: panelW - 16 },
      }).setOrigin(0.5, 0);
    });

    this.add.text(W / 2, H - 50, 'Enter — Rematch      C — Character Select      T — Title', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#d8ecff',
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
      this.winnerRig.y = 355 + Math.sin(time / 260) * 8;
    }
  }
}
