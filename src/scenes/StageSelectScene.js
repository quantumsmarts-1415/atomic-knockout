import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { drawMenuBackground } from '../ui/theme.js';
import { STAGES } from '../data/stages.js';

export default class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }

  init(data) {
    this.setup = data;
    // No stage-picking UI yet (that's a later phase) -- pick the stage now,
    // once, so this screen can show what's actually about to load rather
    // than a generic "random" placeholder. this.chosenStage is what
    // Battle actually gets started with below.
    this.chosenStage = Phaser.Utils.Array.GetRandom(STAGES);
  }

  create() {
    drawMenuBackground(this, W, H);

    this.add.text(W / 2, 60, 'RANDOM STAGE', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '40px', color: '#eaf9ff',
      stroke: '#060a10', strokeThickness: 8, letterSpacing: 1,
    }).setOrigin(0.5);
    this.add.text(W / 2, 100, 'Map select comes later -- for now every match rolls one of these', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#5c7a94',
    }).setOrigin(0.5);

    const cardW = 460;
    const cardH = 320;
    const cx = W / 2;
    const cy = H / 2 + 20;
    const card = this.add.graphics();
    card.fillStyle(0xffffff, 0.03);
    card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    card.lineStyle(1.5, 0x4ad6ff, 0.6);
    card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);

    this.drawMiniStage(this.chosenStage, cx - cardW / 2 + 20, cy - cardH / 2 + 20, cardW - 40, 170);

    this.add.text(cx, cy + 82, this.chosenStage.name, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '30px', color: '#eaf9ff',
    }).setOrigin(0.5);
    this.add.text(cx, cy + 120, this.chosenStage.desc, {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#5c7a94',
      wordWrap: { width: cardW - 60 }, align: 'center',
    }).setOrigin(0.5);

    // small footer listing the rest of the pool, so it's clear this is one
    // of several rather than the only stage in the game
    const others = STAGES.filter((s) => s.id !== this.chosenStage.id).map((s) => s.name).join('  ·  ');
    if (others) {
      this.add.text(W / 2, H - 76, `Also in rotation: ${others}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#3a4a5c',
      }).setOrigin(0.5);
    }

    this.add.text(W / 2, H - 40, 'Press Enter / F / K to fight!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '24px', color: '#4ad6ff',
    }).setOrigin(0.5);

    const start = () => this.scene.start('Battle', { ...this.setup, stageId: this.chosenStage.id });
    this.input.keyboard.on('keydown-ENTER', start);
    this.input.keyboard.on('keydown-F', start);
    this.input.keyboard.on('keydown-K', start);
  }

  // Simplified top-down-scale rendering of a stage's real solids/platforms
  // data into a small preview box, so the card actually reflects the
  // chosen stage's layout instead of a generic fixed mockup. Uses the same
  // coordinate space as the real battle canvas (uniform scale, no stretch).
  drawMiniStage(stage, x0, y0, w, h) {
    const scale = w / W;
    const yWindowTop = 260; // stage geometry lives roughly y:260-650 on the real canvas
    const mapX = (x) => x0 + w / 2 + (x - W / 2) * scale;
    const mapY = (y) => y0 + (y - yWindowTop) * scale;

    const g = this.add.graphics();
    g.fillStyle(0x1c3050, 1);
    g.fillRoundedRect(x0, y0, w, h, 12);

    for (const s of stage.solids) {
      const sw = s.w * scale;
      const sh = (s.h ?? 90) * scale;
      const sy = s.y ?? stage.groundY;
      g.fillStyle(0x3d2f4e, 1);
      g.fillRect(mapX(s.x) - sw / 2, mapY(sy), sw, sh);
      g.fillStyle(0x53e0a8, 1);
      g.fillRect(mapX(s.x) - sw / 2, mapY(sy), sw, Math.max(2, sh * 0.2));
    }
    for (const p of stage.platforms) {
      const pw = p.w * scale;
      g.fillStyle(0x8f78cc, 1);
      g.fillRect(mapX(p.x) - pw / 2, mapY(p.y), pw, 6);
    }
  }
}
