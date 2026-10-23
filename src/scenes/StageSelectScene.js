import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import {
  FONT_DISPLAY, FONT_MONO, GRID, MOTION, PLAYER_COLORS, THEME,
  drawFooterHints, drawHeader, drawMenuBackground, drawPanel, drawPortraitDisc, textStyle,
} from '../ui/theme.js';
import { STAGES, stageKey, stagePreviewFile } from '../data/stages.js';
import { CHARACTERS } from '../data/characters.js';
import { menuPortraitKey } from '../ui/portraits.js';
import { play as sfx } from '../engine/sfx.js';
import { enterScene, showScene } from '../ui/flow.js';
import { phoneNet } from '../net/PhoneNet.js';
import { isGamepadSlot, menuInputForSlot, pollGamepads } from '../engine/gamepad.js';
import { primeMatchArt } from '../engine/matchWarmup.js';
import { attachBootLoadUi } from './BootScene.js';

const BOT_SLOT_BASE = 100;

// Grid of stage thumbnails on the right, big preview of the highlighted
// stage on the left with the matchup strip under it. The last tile is RANDOM.
const COLS = 3;
const TILE_W = 160;
const TILE_H = 90;
const GAP_X = 12;
const ROW_H = TILE_H + 38; // thumbnail + name label (clear of the cursor box)
const GRID_X = 736;
const GRID_Y = 104;
const PREVIEW = { x: 44, y: 104, w: 640, h: 360 };
const RANDOM = 'random';

// Stage copy uses "--" as a dash in the data file; render it as a real one.
const prose = (s) => String(s ?? '').replace(/\s*--\s*/g, ' — ');

// ---------------------------------------------------------------------------
// StageSelectScene -- between CharacterSelect and Battle. One shared cursor
// that ANY human player can drive, with the same unified input scheme as
// CharacterSelect: every player is polled per frame for {left, right, up,
// down, confirm, back} (keyboard keys or PhoneNet), with just-pressed edge
// detection done here. Keyboard P1 = WASD + F/G, P2 = arrows + K/L; Enter
// and Esc also work, and the mouse can hover/click tiles.
// Confirm (attack) picks the stage; Back (special) returns to CharacterSelect.
// ---------------------------------------------------------------------------
export default class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect');
  }

  init(data) {
    this.setup = data?.players?.length
      ? data
      : { players: [{ charId: 'hydra', palette: 0, slot: 0 }, { charId: 'helen', palette: 1, slot: 1 }], stocks: 3 };
  }

  create() {
    // Scene instances are reused between visits -- reset per-visit state.
    this.leaving = false;
    this.previewBusy = false;
    this.previewWant = null;
    this.previewGen = (this.previewGen || 0) + 1;
    this.entries = [...STAGES.map((s) => s.id), RANDOM];
    const last = this.registry.get('lastStageId');
    this.cursor = Math.max(0, this.entries.indexOf(last));

    drawMenuBackground(this, W, H);
    drawHeader(this, { kicker: 'Reactor · Arena', title: 'Choose a stage', y: 18 });

    this.buildPreview();
    this.buildMatchup();
    this.tiles = this.entries.map((id, i) => this.buildTile(id, i));
    this.cursorBox = this.add.graphics().setDepth(4);

    this.status = this.add.text(W / 2, H - GRID.footerY, '', textStyle('mono', { color: THEME.goldCss })).setOrigin(0.5).setDepth(6);
    this.hints = drawFooterHints(this, [
      { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
      { key: 'F', label: 'Fight here' },
      { key: 'G', label: 'Back' },
    ]);

    this.buildInputs();
    this.refresh(true);
    enterScene(this);
    // Sheets and painted FX for the two locked fighters only. The match
    // waits if the player confirms before that download finishes.
    this.matchArtDone = false;
    this.matchArt = primeMatchArt(this, this.setup.players)
      .then(() => { this.matchArtDone = true; })
      .catch(() => { this.matchArtDone = true; });
  }

  // ------------------------------------------------------------- layout
  tileXY(i) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { x: GRID_X + col * (TILE_W + GAP_X), y: GRID_Y + row * ROW_H };
  }

  buildTile(id, i) {
    const { x, y } = this.tileXY(i);
    const c = this.add.container(x + TILE_W / 2, y + TILE_H / 2).setDepth(3);
    const frame = this.add.graphics();
    frame.fillStyle(THEME.ink, 1);
    frame.fillRoundedRect(-TILE_W / 2 - 3, -TILE_H / 2 - 3, TILE_W + 6, TILE_H + 6, 10);
    frame.lineStyle(1, THEME.mist, 0.14);
    frame.strokeRoundedRect(-TILE_W / 2 - 3, -TILE_H / 2 - 3, TILE_W + 6, TILE_H + 6, 10);
    c.add(frame);
    const baseY = c.y;
    if (id === RANDOM) {
      const g = this.add.graphics();
      g.fillGradientStyle(0x463878, 0x463878, 0x1b1533, 0x1b1533, 1);
      g.fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 8);
      g.lineStyle(1.25, THEME.gold, 0.7);
      g.strokeRoundedRect(-TILE_W / 2 + 6, -TILE_H / 2 + 6, TILE_W - 12, TILE_H - 12, 6);
      c.add(g);
      c.add(this.add.text(0, 2, '?', {
        fontFamily: FONT_DISPLAY, fontSize: '44px', color: THEME.goldCss,
      }).setOrigin(0.5));
    } else {
      const st = STAGES.find((s) => s.id === id);
      const key = stageKey(st, 'thumb');
      if (this.textures.exists(key)) {
        const img = this.add.image(0, 0, key).setDisplaySize(TILE_W, TILE_H);
        const m = this.make.graphics({ add: false });
        m.fillStyle(0xffffff, 1);
        m.fillRoundedRect(x, y, TILE_W, TILE_H, 8);
        img.setMask(m.createGeometryMask());
        c.add(img);
      }
    }
    const label = this.add.text(x + TILE_W / 2, y + TILE_H + 18,
      id === RANDOM ? 'Random' : STAGES.find((s) => s.id === id).name, textStyle('caption')).setOrigin(0.5).setDepth(3);
    const zone = this.add.zone(x, y, TILE_W, TILE_H).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    zone.on('pointerover', () => { if (this.cursor !== i && !this.leaving) { this.cursor = i; sfx('menuMove'); this.refresh(); } });
    zone.on('pointerdown', () => { if (this.leaving) return; this.cursor = i; this.confirm(); });
    return { id, container: c, label, baseY };
  }

  buildPreview() {
    const { x, y, w, h } = PREVIEW;
    drawPanel(this, x - 12, y - 12, w + 24, h + 176, 18, THEME.mist, 0.18).setDepth(2);
    this.previewImg = this.add.image(x + w / 2, y + h / 2, '__DEFAULT').setDisplaySize(w, h).setDepth(3);
    const m = this.make.graphics({ add: false });
    m.fillStyle(0xffffff, 1);
    m.fillRoundedRect(x, y, w, h, 12);
    this.previewImg.setMask(m.createGeometryMask());
    this.randomCard = this.add.container(x + w / 2, y + h / 2).setDepth(3);
    const rg = this.add.graphics();
    rg.fillGradientStyle(0x463878, 0x332a56, 0x07060e, 0x07060e, 1);
    rg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    rg.lineStyle(1, THEME.gold, 0.35);
    rg.strokeCircle(0, -10, 110);
    rg.lineStyle(1, THEME.teal, 0.25);
    rg.strokeCircle(0, -10, 140);
    this.randomCard.add(rg);
    this.randomCard.add(this.add.text(0, -10, '?', {
      fontFamily: FONT_DISPLAY, fontSize: '110px', color: THEME.goldCss,
    }).setOrigin(0.5));
    this.previewName = this.add.text(x + 4, y + h + 16, '', textStyle('h2')).setDepth(4);
    this.previewTagG = this.add.graphics().setDepth(4);
    this.previewTag = this.add.text(x + w - 14, y + h + 28, '', {
      fontFamily: FONT_MONO, fontSize: '11px', color: THEME.goldCss, letterSpacing: 1.5,
    }).setOrigin(1, 0.5).setDepth(5);
    this.previewDesc = this.add.text(x + 4, y + h + 50, '', textStyle('caption', { fontSize: '14px', wordWrap: { width: w - 8 } })).setDepth(4);
  }

  buildMatchup() {
    // who is fighting, in seat order, with their chosen colorway
    const { x, y, h } = PREVIEW;
    const top = y + h + 112;
    const players = this.setup.players;
    const D = 40;
    const cellW = Math.min(200, (PREVIEW.w - 8) / players.length);
    this.add.text(x + 4, top - 14, 'MATCHUP', textStyle('label')).setOrigin(0, 0.5).setDepth(4);
    players.forEach((p, i) => {
      const def = CHARACTERS[p.charId];
      if (!def) return;
      const cx = x + 4 + i * cellW;
      const ring = PLAYER_COLORS[i % PLAYER_COLORS.length];
      drawPortraitDisc(this, cx + D / 2, top + 22, D, {
        textureKey: menuPortraitKey(def), n: def.atomicNumber, sym: def.symbol, ring, depth: 4,
      });
      const pal = def.palettes?.[p.palette ?? 0];
      this.add.text(cx + D + 10, top + 14, def.name, textStyle('bodyStrong', { fontSize: '14px' })).setOrigin(0, 0.5).setDepth(4);
      const sub = pal && (def.palettes?.length ?? 0) > 1 ? `P${i + 1}  ·  ${pal.name}` : `P${i + 1}`;
      this.add.text(cx + D + 10, top + 32, sub, textStyle('label')).setOrigin(0, 0.5).setDepth(4);
      if (i < players.length - 1 && players.length <= 4) {
        this.add.text(cx + cellW - 14, top + 22, 'VS', { fontFamily: FONT_MONO, fontSize: '10px', color: THEME.faintCss, letterSpacing: 1 }).setOrigin(0.5).setDepth(4);
      }
    });
  }

  refresh(instant = false) {
    const id = this.entries[this.cursor];
    this.tiles.forEach((t, i) => {
      const on = i === this.cursor;
      const scale = on ? 1.06 : 1;
      const y = t.baseY + (on ? -6 : 0);
      if (instant) t.container.setScale(scale).setY(y);
      else this.tweens.add({ targets: t.container, scale, y, duration: MOTION.quick, ease: MOTION.easeOut });
      t.label.setColor(on ? THEME.mistCss : THEME.dimCss);
    });
    const { x, y } = this.tileXY(this.cursor);
    this.cursorBox.clear();
    this.cursorBox.lineStyle(8, THEME.pink, 0.16);
    this.cursorBox.strokeRoundedRect(x - 10, y - 10, TILE_W + 20, TILE_H + 20, 14);
    this.cursorBox.lineStyle(2, THEME.teal, 1);
    this.cursorBox.strokeRoundedRect(x - 7, y - 7, TILE_W + 14, TILE_H + 14, 12);

    let name;
    let tag;
    let desc;
    if (id === RANDOM) {
      this.previewImg.setVisible(false);
      this.randomCard.setVisible(true);
      name = 'Random';
      tag = 'Any arena';
      desc = `Let the reactor decide — one of all ${STAGES.length} arenas.`;
    } else {
      const st = STAGES.find((s) => s.id === id);
      this.randomCard.setVisible(false);
      const key = stageKey(st, 'preview');
      if (this.textures.exists(key)) this.previewImg.setTexture(key).setDisplaySize(PREVIEW.w, PREVIEW.h).setVisible(true);
      else {
        this.previewImg.setVisible(false);
        this.queueStagePreview(st);
      }
      name = st.name;
      tag = st.layout ?? 'Classic';
      desc = prose(st.desc);
    }
    this.previewName.setText(name.toUpperCase());
    this.previewTag.setText(tag.toUpperCase());
    this.previewDesc.setText(desc);
    const g = this.previewTagG;
    g.clear();
    const tw = this.previewTag.width + 20;
    g.fillStyle(THEME.gold, 0.14);
    g.fillRoundedRect(this.previewTag.x - tw + 10, this.previewTag.y - 11, tw, 22, 11);
    g.lineStyle(1, THEME.gold, 0.5);
    g.strokeRoundedRect(this.previewTag.x - tw + 10, this.previewTag.y - 11, tw, 22, 11);
    if (!instant && this.previewImg.visible) {
      this.previewImg.setAlpha(0);
      this.tweens.add({ targets: this.previewImg, alpha: 1, duration: MOTION.base, ease: MOTION.easeOut });
    }
  }

  // The highlighted arena's preview, and only that one, while the cursor moves.
  queueStagePreview(st) {
    if (!st) return;
    const key = stageKey(st, 'preview');
    if (this.textures.exists(key)) return;
    this.previewWant = { key, file: stagePreviewFile(st), id: st.id };
    this.pumpStagePreview();
  }

  pumpStagePreview() {
    if (this.previewBusy || !this.previewWant) return;
    const job = this.previewWant;
    this.previewWant = null;
    if (this.textures.exists(job.key)) {
      this.pumpStagePreview();
      return;
    }
    this.previewBusy = true;
    const gen = this.previewGen;
    this.load.image(job.key, job.file);
    this.load.once('complete', () => {
      if (gen !== this.previewGen) return;
      this.previewBusy = false;
      if (this.entries[this.cursor] === job.id && this.textures.exists(job.key)) {
        this.previewImg.setTexture(job.key).setDisplaySize(PREVIEW.w, PREVIEW.h).setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.previewImg, alpha: 1, duration: MOTION.base, ease: MOTION.easeOut });
      }
      this.pumpStagePreview();
    });
    this.load.start();
  }

  // -------------------------------------------------------------- input
  buildInputs() {
    const kb = this.input.keyboard;
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.sources = [];
    const keySrc = (map) => {
      const keys = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.map((c) => kb.addKey(c))]));
      return { kind: 'keys', keys, prev: {} };
    };
    // Both keyboard layouts always work here (any human may pick), plus
    // Enter/Esc as a convenience for whoever is at the keyboard.
    const keyMap = {
      left: ['A', KC.LEFT], right: ['D', KC.RIGHT], up: ['W', KC.UP], down: ['S', KC.DOWN],
      confirm: ['F', 'K', KC.ENTER, KC.SPACE], back: ['G', 'L', KC.ESC, KC.BACKSPACE],
    };
    const keys = keySrc(keyMap);
    this.sources.push(keys);
    // Keyboard presses are taken from the keydown events themselves and
    // replayed in order on the next update, not by comparing key.isDown
    // between frames: a quick tap that goes down AND up between two frames
    // (slow device, busy machine) used to be lost -- e.g. Down, Right, Enter
    // landing on twin-peaks while you aimed for hydrogen-breakout because the
    // Down never registered. (Phaser's JustDown doesn't help: keyup clears
    // it.) Auto-repeat is ignored, so a key held over from CharacterSelect
    // still can't fire.
    const actionOf = new Map();
    for (const [action, list] of Object.entries(keys.keys)) for (const k of list) actionOf.set(k.keyCode, action);
    this.keyPresses = [];
    // Phaser re-dispatches every keyboard event still queued this frame each
    // time a new DOM key event arrives, so the same keydown can be seen more
    // than once -- count each native event once.
    const seen = new WeakSet();
    kb.on('keydown', (e) => {
      if (seen.has(e)) return;
      seen.add(e);
      const a = actionOf.get(e.keyCode);
      if (a && !e.repeat) this.keyPresses.push(a);
    });
    for (const p of this.setup.players) {
      const slot = p.slot ?? -1;
      if (isGamepadSlot(slot)) this.sources.push({ kind: 'pad', slot, prev: {} });
      else if (slot >= 2 && slot < BOT_SLOT_BASE) this.sources.push({ kind: 'phone', slot, prev: {} });
    }
    // A button still held from CharacterSelect must not count as a fresh
    // press on the first frame here.
    pollGamepads();
    for (const src of this.sources) src.prev = this.readSource(src);
  }

  readSource(src) {
    if (src.kind === 'keys') {
      const out = {};
      for (const [k, list] of Object.entries(src.keys)) out[k] = list.some((key) => key.isDown);
      return out;
    }
    if (src.kind === 'pad') return menuInputForSlot(src.slot);
    return phoneNet.getInput(src.slot);
  }

  move(dx, dy) {
    const n = this.entries.length;
    const rows = Math.ceil(n / COLS);
    let col = this.cursor % COLS;
    let row = Math.floor(this.cursor / COLS);
    if (dx) {
      // wrap within the row (last row may be short)
      const rowLen = Math.min(COLS, n - row * COLS);
      col = (col + dx + rowLen) % rowLen;
    }
    if (dy) row = Phaser.Math.Clamp(row + dy, 0, rows - 1);
    this.cursor = Math.min(row * COLS + col, n - 1);
    sfx('menuMove');
    this.refresh();
  }

  confirm() {
    if (this.leaving) return;
    this.leaving = true;
    sfx('menuConfirm');
    let id = this.entries[this.cursor];
    if (id === RANDOM) id = Phaser.Utils.Array.GetRandom(STAGES).id;
    else this.registry.set('lastStageId', id);
    const st = STAGES.find((s) => s.id === id);
    // brief "locked in" beat showing what was picked (matters for Random)
    if (this.entries[this.cursor] === RANDOM) {
      this.cursor = this.entries.indexOf(id);
      this.refresh();
    }
    this.hints.setVisible(false);
    this.status.setText(`STAGE LOCKED  ·  ${st.name.toUpperCase()}`);
    this.cursorBox.clear();
    this.cursorBox.lineStyle(8, THEME.gold, 0.2);
    const { x, y } = this.tileXY(this.cursor);
    this.cursorBox.strokeRoundedRect(x - 10, y - 10, TILE_W + 20, TILE_H + 20, 14);
    this.cursorBox.lineStyle(2, THEME.gold, 1);
    this.cursorBox.strokeRoundedRect(x - 7, y - 7, TILE_W + 14, TILE_H + 14, 12);
    this.cameras.main.flash(160, 240, 193, 74, false);
    this.time.delayedCall(600, () => this.enterBattle(id));
  }

  enterBattle(id) {
    const go = () => {
      if (!this.sys?.isActive?.()) return;
      showScene(this, 'Battle', { ...this.setup, stageId: id }, { fade: true });
    };
    if (this.matchArtDone) {
      go();
      return;
    }
    const ui = attachBootLoadUi(this, { status: 'Loading match…' });
    Promise.resolve(this.matchArt).then(() => {
      ui.destroy();
      go();
    });
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    sfx('menuMove');
    showScene(this, 'CharacterSelect', { playerSeeds: this.setup.players.map((p) => ({ slot: p.slot ?? 0 })) });
  }

  apply(action) {
    if (action === 'left') this.move(-1, 0);
    else if (action === 'right') this.move(1, 0);
    else if (action === 'up') this.move(0, -1);
    else if (action === 'down') this.move(0, 1);
    else if (action === 'confirm') this.confirm();
    else if (action === 'back') this.back();
  }

  update() {
    if (this.leaving) return;
    pollGamepads();
    // keyboard: every press since last frame, in order
    for (const a of this.keyPresses.splice(0)) {
      this.apply(a);
      if (this.leaving) return;
    }
    for (const src of this.sources) {
      if (src.kind === 'keys') continue;
      const cur = this.readSource(src);
      const jd = (k) => cur[k] && !src.prev[k];
      if (jd('left')) this.move(-1, 0);
      else if (jd('right')) this.move(1, 0);
      else if (jd('up')) this.move(0, -1);
      else if (jd('down')) this.move(0, 1);
      if (jd('confirm')) this.confirm();
      else if (jd('back')) this.back();
      src.prev = cur;
      if (this.leaving) return;
    }
  }
}
