import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import {
  FONT_DISPLAY, FONT_MONO, MOTION, THEME, drawFooterHints, drawMenuBackground, drawPanel, makeButton,
  paintPill, textStyle,
} from '../ui/theme.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { openSettings } from '../ui/settings.js';
import { attachPhoneJoin } from '../ui/phoneJoin.js';
import { TITLE_PARTNER_ID } from '../ui/portraits.js';
import { CHARACTERS } from '../data/characters.js';

// Fixed 1280x720 composition. Lockup and nucleus on the center axis, the
// menu stacked under them, a console band along the bottom for the phone
// link. Portraits stand either side with their feet above the console so
// they never cover the QR or the URL. Scale.FIT only letterboxes.
const CONSOLE = { x: 300, y: 586, w: 680, h: 76 };
const PORTRAIT_FEET = CONSOLE.y - 6;
// (main.js imports this scene, so W is not initialised at module scope.)
const NUCLEUS = { x: 640, y: 236, r: 58 };
const MENU = { x: 640 - 160, y: 330, w: 320, h: 44, gap: 10 };

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.overlay = null;
    drawMenuBackground(this, W, H);
    this.drawPortraits();
    this.drawLockup();
    this.drawNucleus();
    this.drawMenu();
    this.drawConsole();
    this.hints = drawFooterHints(this, [
      { keys: ['W', 'S'], label: 'Choose' },
      { key: 'ENTER', label: 'Select' },
    ]);
    this.bindKeys();
    enterScene(this);
  }

  // ------------------------------------------------------------ dressing
  drawPortraits() {
    // Hydra faces right; Natalie (sodium) faces left. They frame the nucleus.
    this.placePortrait('char-hydra', 166, 400, -1);
    const partner = CHARACTERS[TITLE_PARTNER_ID];
    if (partner?.art?.key) this.placePortrait(partner.art.key, W - 206, 410, 1);
  }

  placePortrait(key, x, height, side) {
    if (!this.textures.exists(key)) return;
    const img = this.add.image(x, PORTRAIT_FEET, key).setOrigin(0.5, 1).setDepth(2);
    img.setScale(height / img.height);
    // ground glow so the cut sits on the floor instead of floating
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(side < 0 ? THEME.teal : THEME.pink, 0.1);
    g.fillEllipse(x, PORTRAIT_FEET - 4, img.displayWidth * 0.9, 26);
    img.setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, x: { from: x + side * -18, to: x }, duration: MOTION.slow + 120, ease: MOTION.easeOut, delay: 60 });
  }

  drawLockup() {
    const kicker = this.add.text(W / 2, 40, 'REACTOR ONLINE', textStyle('kicker')).setOrigin(0.5, 0).setDepth(6);
    const title = this.add.text(W / 2, 62, 'ATOMIC KNOCKOUT', {
      fontFamily: FONT_DISPLAY, fontSize: '46px', color: THEME.mistCss, letterSpacing: 4,
      shadow: { offsetX: 0, offsetY: 0, color: '#FF4FA3', blur: 24, fill: true },
    }).setOrigin(0.5, 0).setDepth(6);
    const rule = this.add.graphics().setDepth(6);
    const ry = 126;
    rule.lineStyle(1, THEME.mist, 0.22);
    rule.lineBetween(W / 2 - 210, ry, W / 2 - 86, ry);
    rule.lineBetween(W / 2 + 86, ry, W / 2 + 210, ry);
    const tag = this.add.text(W / 2, ry, 'AN ELEMENTAL BRAWL', {
      fontFamily: FONT_MONO, fontSize: '11px', color: THEME.dimCss, letterSpacing: 3,
    }).setOrigin(0.5).setDepth(6);
    for (const [i, o] of [kicker, title, rule, tag].entries()) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, y: `-=${o === rule ? 0 : 8}`, duration: MOTION.slow, delay: 40 * i, ease: MOTION.easeOut });
    }
  }

  drawNucleus() {
    // The game's own tile: Ak, element 119 -- the one past the end of the
    // table. Gold ring for the nucleus, two faint orbits behind it.
    const { x, y, r } = NUCLEUS;
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(THEME.ink, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(THEME.gold, 0.08);
    g.fillCircle(x, y, r + 10);
    g.lineStyle(2, THEME.gold, 0.95);
    g.strokeCircle(x, y, r);
    g.lineStyle(1, THEME.mist, 0.12);
    g.strokeCircle(x, y, r - 5);
    this.add.text(x - r * 0.62, y - r * 0.66, '119', {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.tealCss, letterSpacing: 1,
    }).setDepth(5);
    this.add.text(x, y + 4, 'Ak', {
      fontFamily: FONT_DISPLAY, fontSize: '40px', color: THEME.mistCss,
    }).setOrigin(0.5).setDepth(5);
    const halo = this.add.graphics({ x, y }).setDepth(3);
    halo.lineStyle(6, THEME.pink, 0.18);
    halo.strokeCircle(0, 0, r + 12);
    this.tweens.add({ targets: halo, alpha: { from: 0.55, to: 1 }, scale: { from: 1, to: 1.04 }, duration: 1600, yoyo: true, repeat: -1, ease: MOTION.easeInOut });
  }

  // ---------------------------------------------------------------- menu
  drawMenu() {
    this.entries = [
      { label: 'Play', onPress: () => this.go('PlayerJoin') },
      { label: 'Campaign', note: 'Tactics', onPress: () => this.go('Campaign') },
      { label: 'Settings', onPress: () => this.openSettings() },
      { label: 'Credits', onPress: () => this.openCredits() },
    ];
    this.buttons = this.entries.map((e, i) => {
      const btn = makeButton(this, {
        x: MENU.x, y: MENU.y + i * (MENU.h + MENU.gap), w: MENU.w, h: MENU.h,
        label: e.label, note: e.note, disabled: !!e.disabled,
        onPress: () => { sfx('menuConfirm'); e.onPress?.(); },
      });
      btn.onHover = () => this.select(i, false);
      btn.container.setAlpha(0);
      this.tweens.add({ targets: btn.container, alpha: 1, y: `-=6`, duration: MOTION.base, delay: 140 + i * 50, ease: MOTION.easeOut });
      return btn;
    });
    this.selected = 0;
    this.buttons[0].setSelected(true);
  }

  select(i, sound = true) {
    if (this.buttons[i].disabled || i === this.selected) return;
    this.buttons[this.selected].setSelected(false);
    this.selected = i;
    this.buttons[i].setSelected(true);
    if (sound) sfx('menuMove');
  }

  move(dir) {
    let i = this.selected;
    do { i = (i + dir + this.buttons.length) % this.buttons.length; } while (this.buttons[i].disabled);
    this.select(i);
  }

  go(key) {
    if (isLeaving(this)) return;
    showScene(this, key);
  }

  bindKeys() {
    const kb = this.input.keyboard;
    const guard = (fn) => () => { if (!this.overlay && !isLeaving(this)) fn(); };
    for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, guard(() => this.move(-1)));
    for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, guard(() => this.move(1)));
    for (const k of ['ENTER', 'F', 'K', 'SPACE']) kb.on(`keydown-${k}`, guard(() => this.buttons[this.selected].press()));
    kb.on('keydown-P', guard(() => this.buttons[0].press()));
  }

  // ------------------------------------------------------------ overlays
  openSettings() {
    if (this.overlay) return;
    this.hints.setVisible(false);
    this.overlay = openSettings(this, { onClose: () => { this.overlay = null; this.hints.setVisible(true); } });
  }

  openCredits() {
    if (this.overlay) return;
    this.hints.setVisible(false);
    const PW = 520;
    const PH = 280;
    const px = (W - PW) / 2;
    const py = (H - PH) / 2 - 10;
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    add(this.add.rectangle(W / 2, H / 2, W, H, THEME.void, 0.72).setDepth(40).setInteractive());
    add(drawPanel(this, px, py, PW, PH, 18).setDepth(41));
    add(this.add.text(px + 32, py + 26, 'CREDITS', textStyle('kicker')).setDepth(42));
    add(this.add.text(px + 32, py + 44, 'ATOMIC KNOCKOUT', textStyle('h2')).setDepth(42));
    const rows = [
      ['Design & code', 'Benjamin'],
      ['Engine', 'Phaser 3'],
      ['Type', 'Orbitron · Sora · Share Tech Mono'],
      ['Roster', '118 elements, one table'],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 100 + i * 34;
      add(this.add.text(px + 32, y, k.toUpperCase(), textStyle('label')).setOrigin(0, 0.5).setDepth(42));
      add(this.add.text(px + 190, y, v, textStyle('body')).setOrigin(0, 0.5).setDepth(42));
    });
    const hints = drawFooterHints(this, [{ key: 'ESC', label: 'Close' }], { y: py + PH - 30, depth: 42 });
    objs.push(hints.sep, ...hints.items.flatMap((it) => [...it.chips, it.label]));
    objs.forEach((o) => { o.alpha = 0; });
    this.tweens.add({ targets: objs, alpha: 1, duration: MOTION.base, ease: MOTION.easeOut });
    const kb = this.input.keyboard;
    const close = () => {
      for (const ev of ['keydown-ESC', 'keydown-ENTER', 'keydown-BACKSPACE', 'keydown-G', 'keydown-L']) kb.off(ev, close);
      sfx('menuConfirm');
      this.tweens.add({
        targets: objs, alpha: 0, duration: MOTION.quick, ease: MOTION.easeIn,
        onComplete: () => { objs.forEach((o) => o.destroy()); this.overlay = null; this.hints.setVisible(true); },
      });
    };
    // Enter opened this; wait a beat so the same press does not close it.
    this.time.delayedCall(120, () => {
      if (!this.overlay) return;
      for (const ev of ['keydown-ESC', 'keydown-ENTER', 'keydown-BACKSPACE', 'keydown-G', 'keydown-L']) kb.on(ev, close);
    });
    objs[0].on('pointerdown', close);
    this.overlay = { close };
  }

  // ------------------------------------------------------------- console
  drawConsole() {
    const { x, y, w, h } = CONSOLE;
    const g = this.add.graphics().setDepth(6);
    paintPill(g, x, y, w, h, 'idle', 16);
    // Before the LAN link resolves (and forever on a static deploy) the band
    // is a controls card. When a phone link is live it becomes the QR card.
    const textX = x + 28;
    this.consoleKicker = this.add.text(textX, y + 16, 'CONTROLS', {
      fontFamily: FONT_MONO, fontSize: '11px', color: THEME.goldCss, letterSpacing: 2,
    }).setDepth(7);
    this.consoleMain = this.add.text(textX, y + 34, 'P1  WASD + F / G        P2  Arrows + K / L', {
      fontFamily: FONT_MONO, fontSize: '15px', color: THEME.tealCss,
    }).setDepth(7);
    this.consoleSub = this.add.text(textX, y + 56, 'Gamepads and phones can join on the next screen', textStyle('caption')).setDepth(7);

    attachPhoneJoin(this, {
      x: x + w - 50,
      y: y + h / 2,
      size: 60,
      hideWhenOffline: true,
      caption: false,
      depth: 8,
      onLink: ({ url }) => {
        this.consoleKicker.setText('SCAN TO LINK A PHONE AS A CONTROLLER');
        this.consoleMain.setText(url.replace(/^https?:\/\//, ''));
        this.consoleSub.setText('Same Wi-Fi  ·  P1 WASD + F/G  ·  P2 Arrows + K/L');
      },
    });
  }
}
