import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { buildSelectSlots, familyColor, stepSlot, TABLE_COLS, TABLE_ROWS } from '../data/periodic.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import { isGamepadSlot, menuInputForSlot, padBySlot, pollGamepads } from '../engine/gamepad.js';
import { loadRosterArt, registerSheetAnims } from './BootScene.js';
import {
  drawMenuBackground, FONT_BODY, FONT_DISPLAY, FONT_MONO, PLAYER_COLORS, THEME,
} from '../ui/theme.js';
import { showScene } from '../ui/flow.js';

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
const VIEW_Y = 76;
const VIEW_H = 332;

const PREVIEW_ANCHOR_Y = 592;
const PREVIEW_TOP_MARGIN = 16;

export default class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  init(data) {
    this.playerSeeds = data?.playerSeeds?.length ? data.playerSeeds : [{ slot: 0 }, { slot: 1 }];
  }

  create() {
    this.starting = false;
    this.slots = buildSelectSlots(CHARACTERS);
    this.playable = this.slots.map((s, i) => (s.charId ? i : null)).filter((i) => i !== null);
    this.scrollY = 0;
    drawMenuBackground(this, W, H);
    this.add.text(W / 2, 22, 'REACTOR  ·  ROSTER', {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.tealCss, letterSpacing: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, 46, 'CHOOSE YOUR ELEMENT', {
      fontFamily: FONT_DISPLAY, fontSize: '26px', color: THEME.mistCss, letterSpacing: 1,
    }).setOrigin(0.5);

    const gridW = TABLE_COLS * STRIDE_X - GAP;
    this.gridX = Math.round((W - gridW) / 2);
    this.contentH = (TABLE_ROWS - 1) * STRIDE_Y + TILE_H;
    this.maxScroll = Math.max(0, this.contentH - VIEW_H);

    this.grid = this.add.container(this.gridX, VIEW_Y);
    const maskG = this.make.graphics({ x: 0, y: 0, add: false });
    maskG.fillStyle(0xffffff);
    maskG.fillRect(this.gridX - 32, VIEW_Y, gridW + 48, VIEW_H);
    this.grid.setMask(maskG.createGeometryMask());

    this.tiles = this.slots.map((slot, i) => this.drawTile(slot, i));
    this.drawRowLabels();

    this.scrollTrack = this.add.graphics();
    this.scrollThumb = this.add.graphics();

    this.playerSlots = this.playerSeeds.map((seed) => seed.slot);
    this.players = this.playerSlots.map((slot, i) => this.makePlayer(slot, i));
    for (const p of this.players) {
      this.buildPreview(p);
    }
    this.scrollTo(this.players.find((p) => !p.isBot)?.cursor ?? 0);

    this.hint = this.add.text(W / 2, H - 18, '', {
      fontFamily: FONT_BODY, fontSize: '14px', color: THEME.dimCss,
    }).setOrigin(0.5);
    this.refreshAll();
    this.checkAllLocked();
  }

  tileXY(slot) {
    return { x: slot.col * STRIDE_X, y: slot.row * STRIDE_Y };
  }

  drawRowLabels() {
    const labels = [
      [0, '1'], [1, '2'], [2, '3'], [3, '4'], [4, '5'], [5, '6'], [6, '7'],
      [8, 'La'], [9, 'Ac'],
    ];
    // Period 7 leaves column 2 empty, right before Rf. That gap labels the ghost row.
    this.grid.add(this.add.text(2 * STRIDE_X + TILE_W / 2, 6 * STRIDE_Y + TILE_H / 2, 'GHOST\nRf–Og', {
      fontFamily: FONT_MONO, fontSize: '10px', color: THEME.tealCss, align: 'center',
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

    const charDef = unlocked ? CHARACTERS[slot.charId] : null;
    const hasPhoto = unlocked && charDef.art && this.textures.exists(charDef.art.key);
    if (hasPhoto) {
      const photo = this.add.image(x + TILE_W / 2 + 2, y + TILE_H / 2, charDef.art.key);
      const pad = 8;
      const scale = Math.min((TILE_W - pad) / photo.width, (TILE_H - pad) / photo.height);
      photo.setScale(scale);
      this.grid.add(photo);
    }

    const numColor = unlocked ? THEME.goldCss : (slot.soon ? THEME.mistCss : THEME.disabledCss);
    const symColor = unlocked ? THEME.mistCss : (slot.soon ? THEME.mistCss : THEME.dimCss);
    this.grid.add(this.add.text(x + 8, y + 2, String(slot.n), {
      fontFamily: FONT_MONO, fontSize: '10px', color: numColor,
    }));
    this.grid.add(this.add.text(x + TILE_W / 2 + 1, y + (hasPhoto ? TILE_H - 11 : TILE_H / 2 + (slot.soon ? 1 : 4)), slot.sym, {
      fontFamily: FONT_DISPLAY, fontSize: hasPhoto ? '11px' : (slot.soon ? '12px' : '14px'),
      color: symColor,
    }).setOrigin(0.5));
    if (slot.soon) {
      this.grid.add(this.add.text(x + TILE_W / 2, y + TILE_H - 8, 'soon', {
        fontFamily: FONT_MONO, fontSize: '8px', color: THEME.tealCss,
      }).setOrigin(0.5));
    }

    const zone = this.add.zone(x, y, TILE_W, TILE_H).setOrigin(0, 0).setInteractive();
    zone.on('pointerover', () => {
      const human = this.players?.find((p) => p.isKeyboard && p.phase === 'picking');
      if (!human) return;
      human.cursor = i;
      this.scrollTo(i);
      this.buildPreview(human);
      this.refreshAll();
    });
    zone.on('pointerdown', () => this.pickWithPointer(i));
    this.grid.add(zone);
    return { slot, x, y, unlocked };
  }

  pickWithPointer(index) {
    const human = this.players?.find((p) => p.isKeyboard && p.phase !== 'locked');
    if (!human) return;
    human.cursor = index;
    this.scrollTo(index);
    if (human.phase === 'picking') this.handleConfirm(human);
    else if (human.phase === 'palette' && this.slots[index].charId) this.handleConfirm(human);
    else this.refreshAll();
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

    const previewX = this.previewXFor(index, this.playerSlots?.length ?? 2);
    const randomSlotIdx = this.playable[Math.floor(Math.random() * this.playable.length)];
    const randomPalette = Math.floor(Math.random() * CHARACTERS[this.slots[randomSlotIdx].charId].palettes.length);
    const start = isBot ? randomSlotIdx : Math.min(index, this.slots.length - 1);
    return {
      slot, index, isKeyboard, isBot, isGamepad, keys,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      label: `P${index + 1}${isBot ? ' (CPU)' : ''}`,
      cursor: start,
      phase: isBot ? 'locked' : 'picking',
      palette: isBot ? randomPalette : index,
      prevBtn: { left: false, right: false, up: false, down: false, confirm: false, back: false },
      box: this.add.graphics(),
      previewX,
      previewRig: null,
      panel: this.add.container(previewX, 500),
    };
  }

  previewXFor(index, n) {
    if (n <= 1) return W / 2;
    const margin = 150;
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
    this.grid.y = VIEW_Y - this.scrollY;
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

  handleDir(p, dx, dy) {
    if (p.phase !== 'locked') sfx('menuMove');
    if (p.phase === 'picking') {
      p.cursor = stepSlot(this.slots, p.cursor, dx, dy);
      this.scrollTo(p.cursor);
      this.buildPreview(p);
    } else if (p.phase === 'palette' && dx !== 0) {
      const def = CHARACTERS[this.slots[p.cursor].charId];
      p.palette = (p.palette + dx + def.palettes.length) % def.palettes.length;
      this.buildPreview(p);
    }
    this.refreshAll();
  }

  handleConfirm(p) {
    const slot = this.slots[p.cursor];
    if (p.phase !== 'locked' && slot.charId) sfx('menuConfirm');
    if (p.phase === 'picking' && slot.charId) {
      p.phase = 'palette';
      const def = CHARACTERS[slot.charId];
      p.palette = p.index % def.palettes.length;
      this.buildPreview(p);
    } else if (p.phase === 'palette') {
      p.phase = 'locked';
      this.checkAllLocked();
    }
    this.refreshAll();
  }

  handleBack(p) {
    if (p.phase === 'palette') p.phase = 'picking';
    else if (p.phase === 'locked') p.phase = 'palette';
    this.refreshAll();
  }

  buildPreview(p) {
    p.previewRig?.destroy();
    p.previewRig = null;
    p.previewName?.destroy();
    const slot = this.slots[p.cursor];
    if (!slot?.charId) {
      const waiting = slot.soon ? 'Coming soon' : 'Not forged yet';
      p.previewName = this.add.text(p.previewX, PREVIEW_ANCHOR_Y - 36, `${slot.sym}  ${slot.n}\n${slot.element}\n${waiting}`, {
        fontFamily: FONT_BODY, fontSize: '16px', color: THEME.dimCss, align: 'center',
      }).setOrigin(0.5);
      return;
    }
    const def = CHARACTERS[slot.charId];
    this.queuePreviewSheets(def);
    p.previewRig = new Rig(this, def, p.palette % def.palettes.length);
    p.previewRig.setPosition(p.previewX, PREVIEW_ANCHOR_Y);
    const desiredScale = this.players.length > 3 ? 0.85 : 1.05;
    const visualHeight = def.art?.height
      ?? (def.body.legLength + def.body.torsoHeight + def.body.headRadius * 2);
    const maxScale = (PREVIEW_ANCHOR_Y - (VIEW_Y + VIEW_H) - PREVIEW_TOP_MARGIN) / visualHeight;
    p.previewRig.baseScale = Math.min(desiredScale, Math.max(0.4, maxScale));
    this.add.existing(p.previewRig);
    const palette = def.palettes[p.palette % def.palettes.length];
    p.previewName = this.add.text(p.previewX, PREVIEW_ANCHOR_Y + 18, `${p.label}  ${def.name}\n${def.element} · ${palette.name}`, {
      fontFamily: FONT_BODY, fontSize: this.players.length > 3 ? '14px' : '16px',
      color: THEME.mistCss, align: 'center',
    }).setOrigin(0.5, 0);
  }

  queuePreviewSheets(def) {
    if (!def?.id || !def.art?.sheets) return;
    this.sheetTried ??= new Set();
    if (this.sheetTried.has(def.id)) return;
    this.sheetWant ??= new Set();
    this.sheetWant.add(def.id);
    this.pumpPreviewSheets();
  }

  pumpPreviewSheets() {
    if (this.sheetBusy || !this.sheetWant?.size) return;
    const roster = [...this.sheetWant].map((id) => CHARACTERS[id]).filter(Boolean);
    this.sheetWant.clear();
    const missing = roster.filter((c) => {
      const idle = `${c.art.key}-idle`;
      return !this.textures.exists(idle);
    });
    if (!missing.length) return;
    for (const c of missing) this.sheetTried.add(c.id);
    this.sheetBusy = true;
    loadRosterArt(this.load, missing, (key) => this.textures.exists(key));
    this.load.once('complete', () => {
      this.sheetBusy = false;
      registerSheetAnims(this, missing);
      for (const p of this.players) {
        const id = this.slots[p.cursor]?.charId;
        if (missing.some((c) => c.id === id)) this.buildPreview(p);
      }
      this.pumpPreviewSheets();
    });
    this.load.start();
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
      } else if (p.phase === 'palette') {
        p.box.lineStyle(3, THEME.gold, 1);
        p.box.strokeRoundedRect(x - 5, y - 5, TILE_W + 10, TILE_H + 10, 9);
        p.box.lineStyle(3, p.color, 1);
        p.box.strokeRoundedRect(x - 2 + inset, y - 2 + inset, TILE_W + 4 - inset * 2, TILE_H + 4 - inset * 2, 8);
      } else {
        p.box.lineStyle(3, p.color, 1);
        p.box.strokeRoundedRect(x - 2 + inset, y - 2 + inset, TILE_W + 4 - inset * 2, TILE_H + 4 - inset * 2, 8);
      }
    }
    const phases = this.players.map((p) => p.phase);
    if (phases.every((ph) => ph === 'locked')) this.hint.setText('Everyone locked in — starting…');
    else this.hint.setText('Move: stick/D-pad/WASD/phone · Confirm: attack/X · Color: ←→ · Back: special/B');
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
