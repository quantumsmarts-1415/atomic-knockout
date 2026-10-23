import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { menuPortraitKey } from '../ui/portraits.js';
import { portraitCrop } from '../data/portraitCrops.js';
import {
  FONT_DISPLAY, FONT_MONO, MOTION, PLAYER_COLORS, PLAYER_COLORS_CSS, THEME,
  drawCard, drawMenuBackground, drawPortraitDisc, makeButton, textStyle,
} from '../ui/theme.js';

const FEET_Y = 336;
const FACT = { y: 352, w: 720, h: 58 };
const CARDS = { y: 428, h: 136 };
const BUTTONS = { y: 596, w: 236, h: 44, gap: 14 };

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
    const seat = winner ? this.results.indexOf(winner) : -1;
    const seatColor = seat >= 0 ? PLAYER_COLORS[seat % PLAYER_COLORS.length] : THEME.gold;

    this.add.text(W / 2, 22, 'MATCH COMPLETE', textStyle('kicker')).setOrigin(0.5, 0).setDepth(6);
    const headline = this.add.text(W / 2, 42, winner ? `${winner.name.toUpperCase()} WINS` : 'DRAW', {
      fontFamily: FONT_DISPLAY, fontSize: '40px', color: THEME.goldCss, letterSpacing: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#F0C14A', blur: 20, fill: true },
    }).setOrigin(0.5, 0).setDepth(6);
    headline.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: headline, scale: 1, alpha: 1, duration: MOTION.slow, ease: MOTION.pop });
    const rule = this.add.graphics().setDepth(6);
    const ry = 96;
    rule.lineStyle(1, THEME.mist, 0.2);
    rule.lineBetween(W / 2 - 200, ry, W / 2 - 10, ry);
    rule.lineBetween(W / 2 + 10, ry, W / 2 + 200, ry);
    rule.fillStyle(THEME.gold, 1);
    rule.fillCircle(W / 2, ry, 2.5);

    // winner on the podium with the element fact underneath
    if (winner) {
      const def = CHARACTERS[winner.charId];
      const podium = this.add.graphics().setDepth(1);
      podium.fillStyle(seatColor, 0.12);
      podium.fillEllipse(W / 2, FEET_Y - 2, 300, 40);
      podium.lineStyle(1.5, THEME.gold, 0.6);
      podium.strokeEllipse(W / 2, FEET_Y - 2, 240, 30);
      podium.lineStyle(1, THEME.gold, 0.2);
      podium.strokeEllipse(W / 2, FEET_Y - 2, 300, 40);
      this.winnerRig = new Rig(this, def, winner.palette);
      this.winnerRig.setPosition(W / 2, FEET_Y);
      const visual = def.art?.height ?? 160;
      this.winnerRig.baseScale = Math.min(1.2, (FEET_Y - 112) / visual);
      this.winnerRig.setDepth(2);
      this.add.existing(this.winnerRig);
      this.winScale = this.winnerRig.baseScale;
      this.winnerRig.baseScale = this.winScale * 0.86;
      this.winnerRig.y = FEET_Y + 18;
      this.tweens.add({
        targets: this.winnerRig,
        baseScale: this.winScale,
        y: FEET_Y,
        duration: MOTION.slow,
        ease: MOTION.pop,
      });
      this.spawnVictory();
      this.victoryHold = true;
      this.time.delayedCall(MOTION.slow, () => { this.victoryHold = false; });

      const fg = this.add.graphics().setDepth(3);
      const fx = (W - FACT.w) / 2;
      fg.fillStyle(THEME.ink, 0.86);
      fg.fillRoundedRect(fx, FACT.y, FACT.w, FACT.h, 12);
      fg.lineStyle(1, THEME.mist, 0.14);
      fg.strokeRoundedRect(fx, FACT.y, FACT.w, FACT.h, 12);
      fg.fillStyle(THEME.gold, 0.9);
      fg.fillRoundedRect(fx, FACT.y + 10, 3, FACT.h - 20, 1.5);
      this.add.text(fx + 20, FACT.y + 16, `${def.element.toUpperCase()}  ·  ${def.symbol} ${def.atomicNumber ?? ''}`, textStyle('label', { color: THEME.goldCss })).setDepth(4);
      this.add.text(fx + 20, FACT.y + 32, def.teach, textStyle('caption', { fontSize: '14px', color: THEME.mistCss, wordWrap: { width: FACT.w - 40 } })).setDepth(4);
    }

    this.drawCards(winner);

    const actions = [
      { label: 'Rematch', keyHint: 'ENTER', onPress: () => this.go('Battle', this.setup) },
      { label: 'Fighters', keyHint: 'C', onPress: () => this.go('CharacterSelect', { playerSeeds: (this.setup?.players ?? []).map((p) => ({ slot: p.slot ?? 0 })) }) },
      { label: 'Title', keyHint: 'T', onPress: () => this.go('Title') },
    ];
    const total = actions.length * BUTTONS.w + (actions.length - 1) * BUTTONS.gap;
    this.buttons = actions.map((a, i) => {
      const b = makeButton(this, {
        x: (W - total) / 2 + i * (BUTTONS.w + BUTTONS.gap), y: BUTTONS.y, w: BUTTONS.w, h: BUTTONS.h,
        label: a.label, keyHint: a.keyHint, onPress: () => { sfx('menuConfirm'); a.onPress(); },
      });
      b.onHover = () => this.select(i, false);
      return b;
    });
    this.selected = 0;
    this.buttons[0].setSelected(true);

    const kb = this.input.keyboard;
    const guard = (fn) => () => { if (!isLeaving(this)) fn(); };
    for (const k of ['LEFT', 'A']) kb.on(`keydown-${k}`, guard(() => this.move(-1)));
    for (const k of ['RIGHT', 'D']) kb.on(`keydown-${k}`, guard(() => this.move(1)));
    for (const k of ['ENTER', 'SPACE', 'F', 'K']) kb.on(`keydown-${k}`, guard(() => this.buttons[this.selected].press()));
    kb.on('keydown-C', guard(() => this.buttons[1].press()));
    kb.on('keydown-T', guard(() => this.buttons[2].press()));
    kb.on('keydown-ESC', guard(() => this.buttons[2].press()));
    enterScene(this);
  }

  drawCards(winner) {
    // one stat card per fighter, in seat order; shrinks to fit up to six
    const n = this.results.length;
    const gap = 14;
    const areaW = W - 72;
    const cardW = Math.min(300, Math.floor((areaW - gap * (n - 1)) / n));
    const total = n * cardW + gap * (n - 1);
    const x0 = (W - total) / 2;
    const compact = cardW < 220;
    this.results.forEach((r, i) => {
      const def = CHARACTERS[r.charId];
      const x = x0 + i * (cardW + gap);
      const y = CARDS.y;
      const pip = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const g = this.add.graphics().setDepth(3);
      drawCard(g, x, y, cardW, CARDS.h, { accent: pip, state: r.won ? 'locked' : 'idle', radius: 14 });
      const d = compact ? 40 : 48;
      drawPortraitDisc(this, x + 16 + d / 2, y + 18 + d / 2, d, {
        textureKey: menuPortraitKey(def), n: def?.atomicNumber, sym: def?.symbol, ring: pip, depth: 4,
        crop: portraitCrop(def?.id),
      });
      const tx = x + 26 + d;
      this.add.text(tx, y + 20, `P${i + 1}`, { fontFamily: FONT_MONO, fontSize: '10px', color: PLAYER_COLORS_CSS[i % PLAYER_COLORS_CSS.length], letterSpacing: 2 }).setDepth(4);
      this.add.text(tx, y + 34, r.name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: compact ? '13px' : '15px', color: THEME.mistCss, letterSpacing: 1 }).setDepth(4);
      const pal = def?.palettes?.[r.palette];
      if (pal && (def.palettes?.length ?? 0) > 1 && !compact) {
        this.add.text(tx, y + 54, pal.name.toUpperCase(), textStyle('label')).setDepth(4);
      }
      if (r.won) {
        const tag = this.add.text(x + cardW - 14, y + 20, 'WINNER', { fontFamily: FONT_MONO, fontSize: '10px', color: THEME.voidCss, letterSpacing: 2 }).setOrigin(1, 0).setDepth(5);
        g.fillStyle(THEME.gold, 1);
        g.fillRoundedRect(tag.x - tag.width - 8, y + 16, tag.width + 16, 18, 9);
      }
      const stats = [
        ['KOS', String(r.kos)],
        ['DEALT', `${r.damageDealt}%`],
        ['STOCKS', String(Math.max(0, r.stocks))],
      ];
      const colW = (cardW - 32) / stats.length;
      stats.forEach(([k, v], j) => {
        const cx = x + 16 + colW * j;
        this.add.text(cx, y + CARDS.h - 50, k, textStyle('label')).setDepth(4);
        this.add.text(cx, y + CARDS.h - 36, v, { fontFamily: FONT_DISPLAY, fontSize: compact ? '16px' : '20px', color: r.won && k === 'KOS' ? THEME.goldCss : THEME.mistCss }).setDepth(4);
      });
    });
  }

  spawnVictory() {
    sfx('gameEnd');
    const originY = FEET_Y - 120;
    for (let i = 0; i < 16; i++) {
      const g = this.add.circle(W / 2, originY, i % 3 === 0 ? 4 : 2.5, i % 2 ? THEME.gold : THEME.teal, 1).setDepth(5);
      const ang = (Math.PI * 2 * i) / 16 - Math.PI / 2;
      const reach = 70 + (i % 4) * 26;
      this.tweens.add({
        targets: g,
        x: W / 2 + Math.cos(ang) * reach,
        y: originY + Math.sin(ang) * (reach * 0.55) - 10,
        alpha: 0,
        duration: 640 + (i % 5) * 40,
        ease: MOTION.easeOut,
        onComplete: () => g.destroy(),
      });
    }
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

  go(key, data) {
    if (isLeaving(this)) return;
    showScene(this, key, data);
  }

  update(time, delta) {
    // victory bounce
    if (this.winnerRig) {
      this.winnerRig.animate(delta / 1000, 'idle', 0);
      if (this.victoryHold) return;
      const bob = Math.sin(time / 280);
      this.winnerRig.baseScale = (this.winScale || this.winnerRig.baseScale) * (1 + bob * 0.012);
      this.winnerRig.y = FEET_Y + bob * 7 - 4;
    }
  }
}
