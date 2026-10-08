import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, THEME, drawMenuBackground, paintPill } from '../ui/theme.js';

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
    this.add.text(W / 2, 28, 'MATCH COMPLETE', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.tealCss, letterSpacing: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, 64, winner ? `${winner.name.toUpperCase()} WINS` : 'DRAW', {
      fontFamily: FONT_DISPLAY, fontSize: '42px', color: THEME.goldCss, letterSpacing: 1,
    }).setOrigin(0.5);

    // winner's rig doing a victory pose
    if (winner) {
      const def = CHARACTERS[winner.charId];
      this.winnerRig = new Rig(this, def, winner.palette);
      this.winnerRig.setPosition(W / 2, 355);
      this.winnerRig.baseScale = winner ? (CHARACTERS[winner.charId].art ? 1.15 : 1.8) : 1.8;
      this.add.existing(this.winnerRig);
      // teaching moment — surface the element fact on the results screen
      this.add.text(W / 2, 400, `${def.element} — ${def.teach}`, {
        fontFamily: FONT_BODY, fontSize: '16px', color: THEME.mistCss,
        wordWrap: { width: 720 }, align: 'center',
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
      paintPill(panel, x - panelW / 2, 500, panelW, 120, r.won ? 'selected' : 'idle');
      this.add.text(x, 516, `${r.name}${r.won ? '  ★' : ''}`, {
        fontFamily: FONT_DISPLAY, fontSize: `${Math.round(18 * nameScale)}px`, color: THEME.mistCss,
      }).setOrigin(0.5, 0);
      this.add.text(x, 548, `KOs ${r.kos}   ·   ${r.damageDealt}% dealt\nStocks ${Math.max(0, r.stocks)}`, {
        fontFamily: FONT_BODY, fontSize: `${Math.round(15 * nameScale)}px`, color: '#E4EEF8', align: 'center',
        wordWrap: { width: panelW - 20 },
      }).setOrigin(0.5, 0);
    });

    this.add.text(W / 2, H - 36, 'ENTER  REMATCH     C  CHARACTER SELECT     T  TITLE', {
      fontFamily: FONT_MONO, fontSize: '14px', color: THEME.tealCss,
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
