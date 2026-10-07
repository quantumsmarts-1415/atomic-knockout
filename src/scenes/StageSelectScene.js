import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { drawMenuBackground, drawPanel, THEME, FONT_DISPLAY, FONT_BODY } from '../ui/theme.js';
import { STAGES, stageKey } from '../data/stages.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';

const BOT_SLOT_BASE = 100;

// Grid of stage thumbnails on the right, big preview of the highlighted
// stage on the left. The last tile is RANDOM.
const COLS = 3;
const TILE_W = 160;
const TILE_H = 90;
const GAP_X = 12;
const ROW_H = TILE_H + 36; // thumbnail + name label (clear of the cursor box)
const GRID_X = 736;
const GRID_Y = 100;
const PREVIEW = { x: 40, y: 100, w: 640, h: 360 };
const RANDOM = 'random';

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
    this.entries = [...STAGES.map((s) => s.id), RANDOM];
    const last = this.registry.get('lastStageId');
    this.cursor = Math.max(0, this.entries.indexOf(last));

    drawMenuBackground(this, W, H);
    this.add.text(W / 2, 44, 'CHOOSE A STAGE', {
      fontFamily: FONT_DISPLAY, fontSize: '40px', color: '#eaf9ff',
      stroke: '#060a10', strokeThickness: 8, letterSpacing: 1,
    }).setOrigin(0.5);

    this.buildPreview();
    this.tiles = this.entries.map((id, i) => this.buildTile(id, i));
    this.cursorBox = this.add.graphics();

    this.hint = this.add.text(W / 2, H - 24,
      'Move: D-pad/WASD/Arrows/phone · Confirm: attack button · Back: special button', {
        fontFamily: FONT_BODY, fontSize: '17px', color: '#5c7a94',
      }).setOrigin(0.5);

    this.buildInputs();
    this.refresh();
  }

  // ------------------------------------------------------------- layout
  tileXY(i) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { x: GRID_X + col * (TILE_W + GAP_X), y: GRID_Y + row * ROW_H };
  }

  buildTile(id, i) {
    const { x, y } = this.tileXY(i);
    const c = this.add.container(x + TILE_W / 2, y + TILE_H / 2);
    const frame = this.add.graphics();
    frame.fillStyle(THEME.panelFill, 1);
    frame.fillRoundedRect(-TILE_W / 2 - 3, -TILE_H / 2 - 3, TILE_W + 6, TILE_H + 6, 10);
    c.add(frame);
    if (id === RANDOM) {
      const g = this.add.graphics();
      g.fillGradientStyle(0x1a2c48, 0x1a2c48, 0x0a1220, 0x0a1220, 1);
      g.fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 8);
      g.lineStyle(1.5, THEME.accent, 0.5);
      g.strokeRoundedRect(-TILE_W / 2 + 6, -TILE_H / 2 + 6, TILE_W - 12, TILE_H - 12, 6);
      c.add(g);
      c.add(this.add.text(0, 0, '?', {
        fontFamily: FONT_DISPLAY, fontSize: '50px', color: '#4ad6ff', stroke: '#060a10', strokeThickness: 6,
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
      id === RANDOM ? 'Random' : STAGES.find((s) => s.id === id).name, {
        fontFamily: FONT_BODY, fontSize: '14px', color: '#d8ecff',
      }).setOrigin(0.5);
    const zone = this.add.zone(x, y, TILE_W, TILE_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { if (this.cursor !== i) { this.cursor = i; sfx('menuMove'); this.refresh(); } });
    zone.on('pointerdown', () => { this.cursor = i; this.confirm(); });
    return { id, container: c, label };
  }

  buildPreview() {
    const { x, y, w, h } = PREVIEW;
    drawPanel(this, x - 8, y - 8, w + 16, h + 160, 18);
    this.previewImg = this.add.image(x + w / 2, y + h / 2, '__DEFAULT').setDisplaySize(w, h);
    const m = this.make.graphics({ add: false });
    m.fillStyle(0xffffff, 1);
    m.fillRoundedRect(x, y, w, h, 12);
    this.previewImg.setMask(m.createGeometryMask());
    this.randomCard = this.add.container(x + w / 2, y + h / 2);
    const rg = this.add.graphics();
    rg.fillGradientStyle(0x1a2c48, 0x1a2c48, 0x060a10, 0x060a10, 1);
    rg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.randomCard.add(rg);
    this.randomCard.add(this.add.text(0, -10, '?', {
      fontFamily: FONT_DISPLAY, fontSize: '150px', color: '#4ad6ff', stroke: '#060a10', strokeThickness: 10,
    }).setOrigin(0.5));
    this.previewName = this.add.text(x + 4, y + h + 18, '', {
      fontFamily: FONT_DISPLAY, fontSize: '32px', color: '#eaf9ff',
    });
    this.previewTag = this.add.text(x + w - 4, y + h + 28, '', {
      fontFamily: FONT_BODY, fontSize: '16px', color: '#4ad6ff',
      backgroundColor: 'rgba(74,214,255,0.12)', padding: { x: 10, y: 4 },
    }).setOrigin(1, 0);
    this.previewDesc = this.add.text(x + 4, y + h + 66, '', {
      fontFamily: FONT_BODY, fontSize: '17px', color: '#8fb0c8', wordWrap: { width: w - 8 },
    });
  }

  refresh() {
    const id = this.entries[this.cursor];
    this.tiles.forEach((t, i) => {
      const on = i === this.cursor;
      t.container.setScale(on ? 1.06 : 1);
      t.label.setColor(on ? '#4ad6ff' : '#d8ecff');
    });
    const { x, y } = this.tileXY(this.cursor);
    this.cursorBox.clear();
    this.cursorBox.lineStyle(4, THEME.accent, 1);
    this.cursorBox.strokeRoundedRect(x - 8, y - 8, TILE_W + 16, TILE_H + 16, 12);

    if (id === RANDOM) {
      this.previewImg.setVisible(false);
      this.randomCard.setVisible(true);
      this.previewName.setText('Random');
      this.previewTag.setText('Any stage');
      this.previewDesc.setText(`Let fate decide -- one of all ${STAGES.length} stages.`);
    } else {
      const st = STAGES.find((s) => s.id === id);
      this.randomCard.setVisible(false);
      const key = stageKey(st, 'preview');
      if (this.textures.exists(key)) this.previewImg.setTexture(key).setDisplaySize(PREVIEW.w, PREVIEW.h).setVisible(true);
      else this.previewImg.setVisible(false);
      this.previewName.setText(st.name);
      this.previewTag.setText(st.layout ?? 'Classic');
      this.previewDesc.setText(st.desc);
    }
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
    this.sources.push(keySrc({
      left: ['A', KC.LEFT], right: ['D', KC.RIGHT], up: ['W', KC.UP], down: ['S', KC.DOWN],
      confirm: ['F', 'K', KC.ENTER, KC.SPACE], back: ['G', 'L', KC.ESC, KC.BACKSPACE],
    }));
    for (const p of this.setup.players) {
      const slot = p.slot ?? -1;
      if (slot >= 2 && slot < BOT_SLOT_BASE) this.sources.push({ kind: 'phone', slot, prev: {} });
    }
    // A button still held from CharacterSelect must not count as a fresh
    // press on the first frame here.
    for (const src of this.sources) src.prev = this.readSource(src);
  }

  readSource(src) {
    if (src.kind === 'keys') {
      const out = {};
      for (const [k, list] of Object.entries(src.keys)) out[k] = list.some((key) => key.isDown);
      return out;
    }
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
    this.hint.setText(`${st.name} -- get ready!`).setColor('#4ad6ff');
    this.cameras.main.flash(160, 74, 214, 255);
    this.time.delayedCall(550, () => this.scene.start('Battle', { ...this.setup, stageId: id }));
  }

  back() {
    if (this.leaving) return;
    this.leaving = true;
    sfx('menuMove');
    this.scene.start('CharacterSelect', { playerSeeds: this.setup.players.map((p) => ({ slot: p.slot ?? 0 })) });
  }

  update() {
    if (this.leaving) return;
    for (const src of this.sources) {
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
