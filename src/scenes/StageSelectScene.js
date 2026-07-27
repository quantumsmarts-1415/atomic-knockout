import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';

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
    const g = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x101b33);
    const bottom = Phaser.Display.Color.ValueToColor(0x233a5c);
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 24, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 24) * i, W, H / 24 + 1);
    }

    this.add.text(W / 2, 70, 'CHOOSE A STAGE', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '40px', color: '#ffffff',
      stroke: '#1c2b4a', strokeThickness: 8,
    }).setOrigin(0.5);

    // stage card with a mini preview of the island
    const cardW = 460;
    const cardH = 320;
    const cx = W / 2;
    const cy = H / 2 + 10;
    const card = this.add.graphics();
    card.fillStyle(0x0a0f1c, 0.6);
    card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    card.lineStyle(4, 0xffd166, 1);
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
      fontFamily: 'Arial Black, sans-serif', fontSize: '30px', color: '#ffffff',
    }).setOrigin(0.5);
    this.add.text(cx, cy + 120, STAGES[0].desc, {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#9fc4e8',
      wordWrap: { width: cardW - 60 }, align: 'center',
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 40, 'Press Enter / F / K to fight!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#ffd166',
    }).setOrigin(0.5);

    const start = () => this.scene.start('Battle', { ...this.setup, stageId: STAGES[0].id });
    this.input.keyboard.on('keydown-ENTER', start);
    this.input.keyboard.on('keydown-F', start);
    this.input.keyboard.on('keydown-K', start);
  }
}
