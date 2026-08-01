import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { drawMenuBackground } from '../ui/theme.js';

const STAGES = [
  {
    id: 'elemental-isle',
    name: 'Elemental Isle',
    desc: 'A floating island over the reactor sea. One platform, no hazards.',
  },
  // future stages from Phase 7 slot in here
];

export default class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }

  init(data) {
    this.setup = data;
  }

  create() {
    drawMenuBackground(this, W, H);

    this.add.text(W / 2, 70, 'CHOOSE A STAGE', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '40px', color: '#eaf9ff',
      stroke: '#060a10', strokeThickness: 8, letterSpacing: 1,
    }).setOrigin(0.5);

    // stage card chrome (the mini preview inside is the stage's own art --
    // left untouched, same as the real battle stage)
    const cardW = 460;
    const cardH = 320;
    const cx = W / 2;
    const cy = H / 2 + 10;
    const card = this.add.graphics();
    card.fillStyle(0xffffff, 0.03);
    card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    card.lineStyle(1.5, 0x4ad6ff, 0.6);
    card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);

    const mini = this.add.graphics();
    // mini sky
    mini.fillStyle(0x1c3050, 1);
    mini.fillRoundedRect(cx - cardW / 2 + 20, cy - cardH / 2 + 20, cardW - 40, 170, 12);
    // mini island
    mini.fillStyle(0x3d2f4e, 1);
    mini.fillRoundedRect(cx - 140, cy - 20, 280, 30, { tl: 4, tr: 4, bl: 18, br: 18 });
    mini.fillStyle(0x53e0a8, 1);
    mini.fillRect(cx - 140, cy - 20, 280, 8);
    mini.fillStyle(0x8f78cc, 1);
    mini.fillRoundedRect(cx - 45, cy - 68, 90, 7, 3);

    this.add.text(cx, cy + 82, STAGES[0].name, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '30px', color: '#eaf9ff',
    }).setOrigin(0.5);
    this.add.text(cx, cy + 120, STAGES[0].desc, {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#5c7a94',
      wordWrap: { width: cardW - 60 }, align: 'center',
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 40, 'Press Enter / F / K to fight!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#4ad6ff',
    }).setOrigin(0.5);

    const start = () => this.scene.start('Battle', { ...this.setup, stageId: STAGES[0].id });
    this.input.keyboard.on('keydown-ENTER', start);
    this.input.keyboard.on('keydown-F', start);
    this.input.keyboard.on('keydown-K', start);
  }
}
