import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { artIsUpdated, fighterIdsFromFxIndex } from '../data/updatedArt.js';
import { buildSelectSlots, familyColor, stepSlot, TABLE_COLS, TABLE_ROWS } from '../data/periodic.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import { isGamepadSlot, menuInputForSlot, padBySlot, pollGamepads } from '../engine/gamepad.js';
import { loadRosterArt, registerSheetAnims, attachBootLoadUi } from './BootScene.js';
import { missingSelectPortraits, queueSelectPortraits } from '../engine/selectArt.js';
import { artGaveUp, runSafeLoad } from '../engine/safeLoad.js';
import {
  FONT_DISPLAY, FONT_MONO, GRID, MOTION, PLAYER_COLORS, PLAYER_COLORS_CSS, THEME,
  drawFooterHints, drawHeader, drawMenuBackground, textStyle,
} from '../ui/theme.js';
import { enterScene, showScene } from '../ui/flow.js';

// Slot numbering, decided in PlayerJoinScene: 0/1 = keyboard, 2-5 = a phone
// (PhoneNet's own connection slot), 100+seatIndex = a bot. Bots live far
// outside the phone range so the two can never collide.
const BOT_SLOT_BASE = 100;

// 18 columns, seven periods, then the lanthanide and actinide rows. The
// viewport scrolls so a D-pad can reach all 118 without shrinking the tiles
// down to specks. Phone input uses the same left/right/up/down booleans.
const TILE_W = 58;
const TILE_H = 44;
const GAP = 4;
const STRIDE_X = TILE_W + GAP;
const STRIDE_Y = TILE_H + GAP;
const VIEW_Y = 82;
const VIEW_H = 326;

// Preview band under the table. With one or two players the name plate
// stands beside the fighter; with more it tucks underneath a smaller rig.
const PREVIEW_TOP = VIEW_Y + VIEW_H + 12;
const FEET_SIDE = 606;
const FEET_UNDER = 556;
const PLATE_H = 96;
const SWATCH_D = 16;
const SWATCH_GAP = 8;

export default class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  init(data) {
    this.playerSeeds = data?.playerSeeds?.length ? data.playerSeeds : [{ slot: 0 }, { slot: 1 }];
    this.goldOnly = !!data?.goldOnly;
  }

  create() {
    const exists = (key) => this.textures.exists(key) || artGaveUp(key);
    const missing = missingSelectPortraits(exists);
    if (!this.goldOnly && missing.length) {
      drawMenuBackground(this, W, H);
      const ui = attachBootLoadUi(this, { status: 'Loading fighters…' });
      runSafeLoad(this, (loader) => queueSelectPortraits(loader, exists)).then(() => {
        if (!this.sys?.isActive?.()) return;
        ui.destroy();
        this.children.removeAll(true);
        this.buildSelect();
      });
      return;
    }
    this.buildSelect();
  }

  buildSelect() {
    this.starting = false;
    this.slots = buildSelectSlots(CHARACTERS);
    this.playable = this.slots.map((s, i) => (s.charId ? i : null)).filter((i) => i !== null);
    this.scrollY = 0;
    drawMenuBackground(this, W, H);
    drawHeader(this, { kicker: 'Reactor · Roster', title: 'Choose your element', y: 18 });
    this.drawLegend();

    const gridW = TABLE_COLS * STRIDE_X - GAP;
    this.gridX = Math.round((W - gridW) / 2);
    this.contentH = (TABLE_ROWS - 1) * STRIDE_Y + TILE_H;
    this.maxScroll = Math.max(0, this.contentH - VIEW_H);

    this.grid = this.add.container(this.gridX, VIEW_Y);
    const maskG = this.make.graphics({ x: 0, y: 0, add: false });
    maskG.fillStyle(0xffffff);
    maskG.fillRect(this.gridX - 32, VIEW_Y, gridW + 48, VIEW_H);
    this.grid.setMask(maskG.createGeometryMask());

    this.fxIds = new Set();
    this.tiles = this.slots.map((slot, i) => this.drawTile(slot, i));
    for (const tile of this.tiles) {
      if (tile.slot.charId) this.attachTilePhoto(CHARACTERS[tile.slot.charId]);
    }
    this.gold = this.add.graphics();
    this.grid.add(this.gold);
    this.goldPhase = 0;
    this.paintGold(0);
    window.__akSelect = this;
    window.__akGold = this.tiles.filter((t) => this.tileUpdated(t.slot)).length;
    if (this.goldOnly) {
      void this.loadFxIds();
      return;
    }
    this.drawRowLabels();
    void this.loadFxIds();

    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();

    this.playerSlots = this.playerSeeds.map((seed) => seed.slot);
    this.players = this.playerSlots.map((slot, i) => this.makePlayer(slot, i));
    for (const p of this.players) {
      if (p.isBot) p.palette = this.defaultPalette(p, CHARACTERS[this.slots[p.cursor].charId], true);
      this.buildPlate(p);
      this.buildPreview(p);
    }
    this.scrollTo(this.players.find((p) => !p.isBot)?.cursor ?? 0);

    this.status = this.add.text(W / 2, H - GRID.footerY, '', textStyle('mono', { color: THEME.goldCss })).setOrigin(0.5).setDepth(6);
    this.hints = drawFooterHints(this, [
      { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
      { key: 'F', label: 'Confirm' },
      { keys: ['A', 'D'], label: 'Color' },
      { key: 'G', label: 'Back' },
    ]);
    this.add.text(W - GRID.margin, H - GRID.footerY, 'P2  Arrows + K / L', textStyle('label')).setOrigin(1, 0.5).setDepth(6);
    this.refreshAll();
    this.checkAllLocked();
    enterScene(this);
  }

  drawLegend() {
    // top-right: what the gold edge means
    const x = W - GRID.margin;
    const y = 40;
    const g = this.add.graphics().setDepth(6);
    g.lineStyle(2, THEME.gold, 1);
    g.strokeRoundedRect(x - 150, y - 7, 18, 14, 3);
    g.fillStyle(THEME.shell, 1);
    g.fillRoundedRect(x - 148, y - 5, 14, 10, 2);
    this.add.text(x - 124, y, 'REVIEWED ART', textStyle('label', { color: THEME.goldCss })).setOrigin(0, 0.5).setDepth(6);
  }

  tileXY(slot) {
    return { x: slot.col * STRIDE_X, y: slot.row * STRIDE_Y };
  }

  drawRowLabels() {
    const labels = [
      [0, '1'], [1, '2'], [2, '3'], [3, '4'], [4, '5'], [5, '6'], [6, '7'],
      [8, 'La'], [9, 'Ac'],
    ];
    // Period 7 leaves column 2 empty, right before Rf. That gap labels the
    // unfinished tail of the table.
    this.grid.add(this.add.text(2 * STRIDE_X + TILE_W / 2, 6 * STRIDE_Y + TILE_H / 2 - 6, 'Rf – Og', {
      fontFamily: FONT_MONO, fontSize: '10px', color: THEME.dimCss, align: 'center',
    }).setOrigin(0.5));
    this.grid.add(this.add.text(2 * STRIDE_X + TILE_W / 2, 6 * STRIDE_Y + TILE_H / 2 + 7, 'SOON', {
      fontFamily: FONT_MONO, fontSize: '8px', color: THEME.tealCss, letterSpacing: 1.5,
    }).setOrigin(0.5));
    for (const [row, text] of labels) {
      this.grid.add(this.add.text(-6, row * STRIDE_Y + TILE_H / 2, text, {
        fontFamily: FONT_MONO, fontSize: '11px', color: THEME.dimCss,
      }).setOrigin(1, 0.5));
    }
  }

  drawTile(slot, i) {
    const { x, y } = this.tileXY(slot);
    const unlocked = !!slot.charId;
    const g = this.make.graphics({ add: false });
    const base = unlocked ? (CHARACTERS[slot.charId].palettes[0].body) : THEME.shellEmpty;
    g.fillStyle(base, unlocked ? 1 : 0.92);
    g.fillRoundedRect(x, y, TILE_W, TILE_H, 7);
    g.fillStyle(familyColor(slot.n), unlocked ? 0.95 : 0.55);
    g.fillRect(x, y + 6, 3, TILE_H - 12);
    this.grid.add(g);

    const numColor = unlocked ? THEME.goldCss : (slot.soon ? THEME.mistCss : THEME.disabledCss);
    const symColor = unlocked ? THEME.mistCss : (slot.soon ? THEME.mistCss : THEME.dimCss);
    const num = this.add.text(x + 8, y + 2, String(slot.n), {
      fontFamily: FONT_MONO, fontSize: '10px', color: numColor,
    });
    const sym = this.add.text(x + TILE_W / 2 + 1, y + TILE_H / 2 + (slot.soon ? 1 : 4), slot.sym, {
      fontFamily: FONT_DISPLAY, fontSize: slot.soon ? '12px' : '14px',
      color: symColor,
    }).setOrigin(0.5);
    this.grid.add(num);
    this.grid.add(sym);
    if (slot.soon) {
      this.grid.add(this.add.text(x + TILE_W / 2, y + TILE_H - 8, 'soon', {
        fontFamily: FONT_MONO, fontSize: '8px', color: THEME.tealCss,
      }).setOrigin(0.5));
    }

    const zone = this.add.zone(x, y, TILE_W, TILE_H).setOrigin(0, 0).setInteractive();
    zone.on('pointerover', () => {
      const human = this.players?.find((p) => p.isKeyboard && p.phase === 'picking');
      if (!human || human.cursor === i) return;
      sfx('menuMove');
      human.cursor = i;
      this.scrollTo(i);
      this.buildPreview(human);
      this.refreshAll();
    });
    zone.on('pointerdown', () => this.pickWithPointer(i));
    this.grid.add(zone);
    return { slot, x, y, unlocked, sym, num, photo: null };
  }

  // The boot download only has the title cuts. A tile grows its portrait
  // once that fighter's file has actually arrived.
  attachTilePhoto(def) {
    if (!def?.art?.key || !this.textures.exists(def.art.key)) return;
    for (const tile of this.tiles || []) {
      if (tile.photo || tile.slot.charId !== def.id) continue;
      const { x, y } = tile;
      const photo = this.add.image(x + TILE_W / 2 + 2, y + TILE_H / 2, def.art.key);
      const pad = 8;
      const scale = Math.min((TILE_W - pad) / photo.width, (TILE_H - pad) / photo.height);
      photo.setScale(scale);
      const at = tile.sym ? this.grid.getIndex(tile.sym) : -1;
      if (at >= 0) this.grid.addAt(photo, at);
      else this.grid.add(photo);
      tile.photo = photo;
      tile.sym?.setPosition(x + TILE_W / 2 + 1, y + TILE_H - 11);
      tile.sym?.setFontSize?.('11px');
    }
  }

  pickWithPointer(index) {
    const human = this.players?.find((p) => p.isKeyboard && p.phase !== 'locked');
    if (!human) return;
    if (human.phase === 'picking') {
      human.cursor = index;
      this.scrollTo(index);
      this.handleConfirm(human);
    } else if (human.phase === 'palette' && index === human.cursor) {
      this.handleConfirm(human);
    }
  }

  makePlayer(slot, index) {
    const isKeyboard = slot === 0 || slot === 1;
    const isBot = slot >= BOT_SLOT_BASE;
    const isGamepad = isGamepadSlot(slot);
    const kb = this.input.keyboard;
    let keys = null;
    if (isKeyboard) {
      const map = slot === 0
        ? { left: 'A', right: 'D', up: 'W', down: 'S', confirm: 'F', back: 'G' }
        : {
            left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            confirm: 'K', back: 'L',
          };
      keys = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, kb.addKey(v)]));
    }

    const n = this.playerSlots?.length ?? 2;
    const previewX = this.previewXFor(index, n);
    const randomSlotIdx = this.playable[Math.floor(Math.random() * this.playable.length)];
    const start = isBot ? randomSlotIdx : Math.min(index, this.slots.length - 1);
    return {
      slot, index, isKeyboard, isBot, isGamepad, keys,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      colorCss: PLAYER_COLORS_CSS[index % PLAYER_COLORS_CSS.length],
      label: `P${index + 1}`,
      cursor: start,
      phase: isBot ? 'locked' : 'picking',
      palette: 0,
      prevBtn: { left: false, right: false, up: false, down: false, confirm: false, back: false },
      box: this.add.graphics(),
      previewX,
      previewRig: null,
      sideways: n <= 2,
    };
  }

  previewXFor(index, n) {
    if (n <= 1) return W / 2;
    if (n === 2) return index === 0 ? 150 : W - 150;
    const margin = 120;
    return margin + (index * (W - margin * 2)) / (n - 1);
  }

  readInput(p) {
    if (p.isKeyboard) {
      return {
        left: p.keys.left.isDown, right: p.keys.right.isDown,
        up: p.keys.up.isDown, down: p.keys.down.isDown,
        confirm: p.keys.confirm.isDown, back: p.keys.back.isDown,
      };
    }
    if (p.isGamepad) return menuInputForSlot(p.slot);
    return phoneNet.getInput(p.slot);
  }

  scrollTo(index) {
    const slot = this.slots[index];
    if (!slot) return;
    const y = slot.row * STRIDE_Y;
    if (y < this.scrollY) this.scrollY = y;
    else if (y + TILE_H > this.scrollY + VIEW_H) this.scrollY = y + TILE_H - VIEW_H;
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScroll);
    this.scrollTween?.stop();
    this.scrollTween = this.tweens.add({
      targets: this.grid, y: VIEW_Y - this.scrollY, duration: MOTION.base + 40, ease: MOTION.easeInOut,
    });
    this.drawScrollbar();
  }

  drawScrollbar() {
    const x = this.gridX + TABLE_COLS * STRIDE_X - GAP + 10;
    this.scrollTrack.clear();
    this.scrollThumb.clear();
    if (this.maxScroll <= 0) return;
    this.scrollTrack.fillStyle(THEME.shellIdleFill, 0.9);
    this.scrollTrack.fillRoundedRect(x, VIEW_Y, 6, VIEW_H, 3);
    const thumbH = Math.max(28, VIEW_H * (VIEW_H / this.contentH));
    const travel = VIEW_H - thumbH;
    const ty = VIEW_Y + (this.maxScroll ? (this.scrollY / this.maxScroll) * travel : 0);
    this.scrollThumb.fillStyle(THEME.teal, 0.9);
    this.scrollThumb.fillRoundedRect(x, ty, 6, thumbH, 3);
  }

  // ------------------------------------------------------------ colorways
  /** Palettes already claimed by other players on the same fighter. */
  takenPalettes(p, charId) {
    return new Set(this.players
      .filter((o) => o !== p && o.phase !== 'picking' && this.slots[o.cursor]?.charId === charId)
      .map((o) => o.palette));
  }

  /** First free colorway: the seat's own index, else the first unclaimed. */
  defaultPalette(p, def, random = false) {
    const n = def?.palettes?.length || 1;
    if (n <= 1) return 0;
    const taken = this.takenPalettes(p, def.id);
    const order = random
      ? Phaser.Utils.Array.Shuffle([...Array(n).keys()])
      : [p.index % n, ...Array.from({ length: n }, (_, i) => i)];
    return order.find((i) => !taken.has(i)) ?? order[0];
  }

  // ------------------------------------------------------------------ input
  handleDir(p, dx, dy) {
    if (p.phase === 'picking') {
      sfx('menuMove');
      p.cursor = stepSlot(this.slots, p.cursor, dx, dy);
      this.scrollTo(p.cursor);
      this.buildPreview(p);
    } else if (p.phase === 'palette' && dx !== 0) {
      this.stepPalette(p, dx);
    }
    this.refreshAll();
  }

  stepPalette(p, dx) {
    if (p.phase !== 'palette' || !dx) return;
    const def = CHARACTERS[this.slots[p.cursor].charId];
    const n = def?.palettes?.length || 1;
    if (n <= 1) return;
    this.setPalette(p, (p.palette + dx + n) % n);
  }

  setPalette(p, i) {
    if (p.phase !== 'palette') return;
    const def = CHARACTERS[this.slots[p.cursor].charId];
    if (i < 0 || i >= def.palettes.length || i === p.palette) return;
    sfx('menuMove');
    p.palette = i;
    this.buildPreview(p);
    this.refreshAll();
  }

  handleConfirm(p) {
    const slot = this.slots[p.cursor];
    if (p.phase === 'picking' && slot.charId) {
      sfx('menuConfirm');
      this.cameras.main.flash(120, 240, 193, 74, false);
      const def = CHARACTERS[slot.charId];
      p.palette = this.defaultPalette(p, def);
      // fighters with a single look skip straight to locked
      p.phase = def.palettes.length > 1 ? 'palette' : 'locked';
      this.buildPreview(p);
      this.popPreview(p);
      if (p.phase === 'locked') this.checkAllLocked();
    } else if (p.phase === 'palette') {
      sfx('menuConfirm');
      this.cameras.main.flash(120, 240, 193, 74, false);
      p.phase = 'locked';
      this.popPreview(p);
      this.pulsePlate(p);
      this.checkAllLocked();
    }
    this.refreshAll();
  }

  handleBack(p) {
    if (p.phase === 'locked') {
      const def = CHARACTERS[this.slots[p.cursor].charId];
      p.phase = def?.palettes?.length > 1 ? 'palette' : 'picking';
    } else if (p.phase === 'palette') {
      p.phase = 'picking';
    } else {
      return;
    }
    sfx('menuMove');
    this.refreshAll();
  }

  // ---------------------------------------------------------------- preview
  plateRect(p) {
    const w = p.sideways ? 250 : Math.min(236, Math.max(150, this.plateSpacing() - 16));
    if (p.sideways) {
      const left = p.previewX < W / 2;
      return { x: left ? p.previewX + 100 : p.previewX - 100 - w, y: FEET_SIDE - PLATE_H - 4, w, h: PLATE_H };
    }
    return { x: p.previewX - w / 2, y: FEET_UNDER + 8, w, h: PLATE_H };
  }

  plateSpacing() {
    const n = this.players.length;
    return n > 1 ? (W - 240) / (n - 1) : W;
  }

  buildPlate(p) {
    const r = this.plateRect(p);
    p.plate = this.add.container(r.x, r.y).setDepth(5);
    p.plateG = this.add.graphics();
    p.plateSeat = this.add.text(14, 20, p.label + (p.isBot ? ' · CPU' : ''), {
      fontFamily: FONT_MONO, fontSize: '10px', color: THEME.voidCss, letterSpacing: 1.5,
    }).setOrigin(0, 0.5);
    p.plateName = this.add.text(14, 46, '', { fontFamily: FONT_DISPLAY, fontSize: '17px', color: THEME.mistCss, letterSpacing: 0.5 }).setOrigin(0, 0.5);
    p.plateMeta = this.add.text(14, 66, '', textStyle('caption')).setOrigin(0, 0.5);
    p.plateColor = this.add.text(r.w - 14, 66, '', textStyle('label')).setOrigin(1, 0.5);
    p.plateState = this.add.text(r.w - 14, 20, '', { fontFamily: FONT_MONO, fontSize: '10px', color: THEME.goldCss, letterSpacing: 1.5 }).setOrigin(1, 0.5);
    p.swatchG = this.add.graphics();
    p.swatchZones = [];
    p.plate.add([p.plateG, p.plateSeat, p.plateName, p.plateMeta, p.plateColor, p.plateState, p.swatchG]);
  }

  pulsePlate(p) {
    this.tweens.add({ targets: p.plate, scale: { from: 1.03, to: 1 }, duration: MOTION.base, ease: MOTION.pop });
  }

  updatePlate(p) {
    const r = this.plateRect(p);
    const slot = this.slots[p.cursor];
    const def = slot?.charId ? CHARACTERS[slot.charId] : null;
    const g = p.plateG;
    g.clear();
    const locked = p.phase === 'locked';
    const inColor = p.phase === 'palette';
    if (locked) {
      g.lineStyle(8, THEME.gold, 0.14);
      g.strokeRoundedRect(-3, -3, r.w + 6, r.h + 6, 15);
    }
    g.fillStyle(THEME.ink, 0.9);
    g.fillRoundedRect(0, 0, r.w, r.h, 12);
    g.lineStyle(locked ? 1.75 : 1.25, locked ? THEME.gold : p.color, locked ? 0.95 : 0.6);
    g.strokeRoundedRect(0, 0, r.w, r.h, 12);
    // seat tag
    const tagW = p.plateSeat.width + 16;
    g.fillStyle(p.color, 1);
    g.fillRoundedRect(8, 11, tagW, 18, 9);
    p.plateSeat.setX(16);
    p.plateState.setText(locked ? 'LOCKED' : inColor ? 'PICK A COLOR' : '').setColor(locked ? THEME.goldCss : THEME.tealCss);

    for (const z of p.swatchZones) z.destroy();
    p.swatchZones = [];
    p.swatchG.clear();
    if (!def) {
      const waiting = slot?.soon ? 'Coming soon' : 'Not forged yet';
      p.plateName.setText(`${slot.element}`).setColor(THEME.dimCss);
      p.plateMeta.setText(`${slot.sym} · ${slot.n} · ${waiting}`);
      p.plateColor.setText('');
      return;
    }
    p.plateName.setText(def.name).setColor(THEME.mistCss);
    p.plateMeta.setText(`${def.element}  ·  ${def.symbol} ${def.atomicNumber ?? slot.n}`);
    const pals = def.palettes ?? [];
    if (pals.length <= 1) {
      p.plateColor.setText('');
      return;
    }
    // swatch row: filled chips, the current one ringed in the player color
    const rowY = r.h - 14;
    const rowW = pals.length * (SWATCH_D + SWATCH_GAP) - SWATCH_GAP;
    // Leave room for an arrow on each side of the chips.
    const arrow = 16;
    const rowX = r.w - 20 - arrow - rowW;
    const rowTop = locked || inColor;
    p.plateColor.setText(rowTop ? pals[p.palette]?.name?.toUpperCase() ?? '' : 'COLORS')
      .setColor(inColor ? THEME.mistCss : THEME.dimCss)
      .setPosition(r.w - 14, 46);
    pals.forEach((pal, i) => {
      const cx = rowX + i * (SWATCH_D + SWATCH_GAP) + SWATCH_D / 2;
      const on = i === p.palette && rowTop;
      p.swatchG.fillStyle(pal.body ?? THEME.shellOn, locked || inColor ? 1 : 0.55);
      p.swatchG.fillCircle(cx, rowY, SWATCH_D / 2 - (on ? 0 : 1));
      p.swatchG.lineStyle(1, 0xffffff, 0.18);
      p.swatchG.strokeCircle(cx, rowY, SWATCH_D / 2 - (on ? 0 : 1));
      if (on) {
        p.swatchG.lineStyle(2, locked ? THEME.gold : p.color, 1);
        p.swatchG.strokeCircle(cx, rowY, SWATCH_D / 2 + 3);
      }
      if (!p.isBot) {
        const z = this.add.zone(r.x + cx, r.y + rowY, SWATCH_D + 6, SWATCH_D + 6).setInteractive({ useHandCursor: true }).setDepth(7);
        z.on('pointerdown', () => this.setPalette(p, i));
        p.swatchZones.push(z);
      }
    });
    if (inColor) {
      const leftX = rowX - arrow;
      const rightX = rowX + rowW + arrow;
      p.swatchG.fillStyle(THEME.mist, 0.85);
      p.swatchG.fillTriangle(leftX, rowY, leftX + 8, rowY - 6, leftX + 8, rowY + 6);
      p.swatchG.fillTriangle(rightX, rowY, rightX - 8, rowY - 6, rightX - 8, rowY + 6);
      if (!p.isBot) {
        const left = this.add.zone(r.x + leftX + 2, r.y + rowY, 28, 28).setInteractive({ useHandCursor: true }).setDepth(7);
        const right = this.add.zone(r.x + rightX - 2, r.y + rowY, 28, 28).setInteractive({ useHandCursor: true }).setDepth(7);
        left.on('pointerdown', () => this.stepPalette(p, -1));
        right.on('pointerdown', () => this.stepPalette(p, 1));
        p.swatchZones.push(left, right);
      }
    }
  }

  buildPreview(p) {
    p.previewRig?.destroy();
    p.previewRig = null;
    const slot = this.slots[p.cursor];
    this.updatePlate(p);
    if (!slot?.charId) return;
    const def = CHARACTERS[slot.charId];
    p.previewRig = new Rig(this, def, p.palette % def.palettes.length);
    const feet = p.sideways ? FEET_SIDE : FEET_UNDER;
    p.previewRig.setPosition(p.previewX, feet);
    const desiredScale = this.players.length > 3 ? 0.8 : 1.05;
    const visualHeight = def.art?.height
      ?? (def.body.legLength + def.body.torsoHeight + def.body.headRadius * 2);
    const maxScale = (feet - PREVIEW_TOP) / visualHeight;
    p.previewRig.baseScale = Math.min(desiredScale, Math.max(0.4, maxScale));
    this.add.existing(p.previewRig);
    const rise = 14;
    p.previewRig.y = feet + rise;
    p.previewRig.setAlpha(0);
    this.tweens.add({
      targets: p.previewRig, alpha: 1, y: feet, duration: MOTION.base, ease: MOTION.easeOut,
    });
  }

  popPreview(p) {
    const rig = p?.previewRig;
    if (!rig) return;
    const target = rig.baseScale || 1;
    rig.baseScale = target * 0.9;
    this.tweens.add({ targets: rig, baseScale: target, duration: MOTION.base, ease: MOTION.pop });
  }

  queuePreviewSheets(def) {
    if (!def?.id) return;
    this.sheetTried ??= new Set();
    if (this.sheetTried.has(def.id)) return;
    this.sheetWant ??= new Set();
    this.sheetWant.add(def.id);
    this.pumpPreviewSheets();
  }

  fighterArtMissing(c) {
    if (!c?.art) return false;
    if (c.art.key && !this.textures.exists(c.art.key)) return true;
    if (!c.art.sheets) return false;
    return !this.textures.exists(`${c.art.key}-idle`);
  }

  pumpPreviewSheets() {
    if (this.sheetBusy || !this.sheetWant?.size) return;
    const roster = [...this.sheetWant].map((id) => CHARACTERS[id]).filter(Boolean);
    this.sheetWant.clear();
    const missing = roster.filter((c) => this.fighterArtMissing(c));
    if (!missing.length) return;
    for (const c of missing) this.sheetTried.add(c.id);
    this.sheetBusy = true;
    loadRosterArt(this.load, missing, (key) => this.textures.exists(key));
    this.load.once('complete', () => {
      this.sheetBusy = false;
      registerSheetAnims(this, missing);
      for (const c of missing) this.attachTilePhoto(c);
      for (const p of this.players) {
        const id = this.slots[p.cursor]?.charId;
        if (missing.some((c) => c.id === id)) this.buildPreview(p);
      }
      this.pumpPreviewSheets();
    });
    this.load.start();
  }

  // ------------------------------------------------------------ gold edge
  tileUpdated(slot) {
    if (!slot?.charId) return false;
    return artIsUpdated(CHARACTERS[slot.charId], this.fxIds);
  }

  async loadFxIds() {
    try {
      const res = await fetch('/fx-index');
      if (!res.ok) return;
      const next = fighterIdsFromFxIndex(await res.json());
      let grew = false;
      for (const id of next) {
        if (this.fxIds.has(id)) continue;
        this.fxIds.add(id);
        grew = true;
      }
      if (grew) this.paintGold(this.goldPhase || 0);
    } catch {
      // The reviewed roster and move sheets still draw without the index.
    }
  }

  paintGold(phase) {
    const g = this.gold;
    if (!g) return;
    g.clear();
    const sheen = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(phase));
    for (const tile of this.tiles) {
      if (!this.tileUpdated(tile.slot)) continue;
      const { x, y } = tile;
      g.lineStyle(4, 0x2a1c08, 0.95);
      g.strokeRoundedRect(x + 1, y + 1, TILE_W - 2, TILE_H - 2, 6);
      g.lineStyle(2, THEME.gold, 1);
      g.strokeRoundedRect(x + 1.5, y + 1.5, TILE_W - 3, TILE_H - 3, 6);
      g.lineStyle(1, 0xfff6d2, sheen);
      g.strokeRoundedRect(x + 3.5, y + 3.5, TILE_W - 7, TILE_H - 7, 5);
    }
  }

  refreshAll() {
    for (const p of this.players) {
      if (p.box.parentContainer !== this.grid) this.grid.add(p.box);
      p.box.clear();
      const slot = this.slots[p.cursor];
      const { x, y } = this.tileXY(slot);
      const inset = (p.index % 5) * 3;
      if (p.phase === 'locked') {
        p.box.lineStyle(4, THEME.gold, 1);
        p.box.strokeRoundedRect(x - 4, y - 4, TILE_W + 8, TILE_H + 8, 9);
        p.box.lineStyle(2, p.color, 1);
        p.box.strokeRoundedRect(x - 1 + inset, y - 1 + inset, TILE_W + 2 - inset * 2, TILE_H + 2 - inset * 2, 7);
      } else if (p.phase === 'palette') {
        p.box.lineStyle(3, THEME.gold, 0.9);
        p.box.strokeRoundedRect(x - 5, y - 5, TILE_W + 10, TILE_H + 10, 9);
        p.box.lineStyle(3, p.color, 1);
        p.box.strokeRoundedRect(x - 2 + inset, y - 2 + inset, TILE_W + 4 - inset * 2, TILE_H + 4 - inset * 2, 8);
      } else {
        p.box.lineStyle(3, p.color, 1);
        p.box.strokeRoundedRect(x - 2 + inset, y - 2 + inset, TILE_W + 4 - inset * 2, TILE_H + 4 - inset * 2, 8);
      }
      this.updatePlate(p);
    }
    const phases = this.players.map((p) => p.phase);
    const allLocked = phases.every((ph) => ph === 'locked');
    this.status.setText(allLocked ? 'ALL FIGHTERS LOCKED  ·  ENTERING THE ARENA' : '');
    this.hints.setVisible(!allLocked);
    this.drawScrollbar();
  }

  checkAllLocked() {
    if (this.starting || !this.players.every((p) => p.phase === 'locked')) return;
    this.starting = true;
    this.time.delayedCall(700, () => {
      showScene(this, 'StageSelect', {
        players: this.players.map((p) => ({ charId: this.slots[p.cursor].charId, palette: p.palette, slot: p.slot })),
        stocks: 3,
      });
    });
  }

  update(time, delta) {
    // create() can be waiting on the select-art loader, before `players`
    // exists. Throwing here aborts the rest of the scene UPDATE listeners,
    // including Phaser's loader, so the first parallel batch never hands
    // off and the screen stays on the void.
    if (!this.players) return;
    this.goldPhase = (this.goldPhase || 0) + delta * 0.0035;
    this.paintGold(this.goldPhase);
    if (this.goldOnly) return;
    pollGamepads();
    for (const p of this.players) {
      const connected = p.isGamepad ? !!padBySlot(p.slot) : phoneNet.hasSlot(p.slot);
      if (!p.isKeyboard && !p.isBot && !connected && p.phase !== 'locked') {
        if (!this.slots[p.cursor].charId) p.cursor = this.playable[0] ?? 0;
        if (p.phase === 'picking') this.buildPreview(p);
        p.phase = 'locked';
        this.refreshAll();
        this.checkAllLocked();
      }

      const cur = this.readInput(p);
      const justDown = (k) => cur[k] && !p.prevBtn[k];

      if (p.phase !== 'locked') {
        if (justDown('left')) this.handleDir(p, -1, 0);
        else if (justDown('right')) this.handleDir(p, 1, 0);
        else if (justDown('up')) this.handleDir(p, 0, -1);
        else if (justDown('down')) this.handleDir(p, 0, 1);
      }
      if (justDown('confirm')) this.handleConfirm(p);
      if (justDown('back')) this.handleBack(p);

      p.prevBtn = cur;
      p.previewRig?.animate(delta / 1000, 'idle', 0);
    }
  }
}
