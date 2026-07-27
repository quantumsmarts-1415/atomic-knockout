import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';

// The 24 launch slots (first 24 elements). Only entries with a charId are
// playable today; the rest render as locked periodic-table tiles.
const SLOTS = [
  { n: 1, sym: 'H', name: 'Hydra', charId: 'hydra' },
  { n: 2, sym: 'He', name: 'Helen', charId: 'helen' },
  { n: 3, sym: 'Li', name: 'Lillie' }, { n: 4, sym: 'Be', name: 'Ben' },
  { n: 5, sym: 'B', name: 'Bord' }, { n: 6, sym: 'C', name: 'Carter' },
  { n: 7, sym: 'N', name: 'Nitra' }, { n: 8, sym: 'O', name: 'Oxana' },
  { n: 9, sym: 'F', name: 'Flora' }, { n: 10, sym: 'Ne', name: 'Neo' },
  { n: 11, sym: 'Na', name: 'Natalie' }, { n: 12, sym: 'Mg', name: 'Maggie' },
  { n: 13, sym: 'Al', name: 'Allen' }, { n: 14, sym: 'Si', name: 'Silas' },
  { n: 15, sym: 'P', name: 'Phillip' }, { n: 16, sym: 'S', name: 'Sully' },
  { n: 17, sym: 'Cl', name: 'Chloe' }, { n: 18, sym: 'Ar', name: 'Aaron' },
  { n: 19, sym: 'K', name: 'Kyle' }, { n: 20, sym: 'Ca', name: 'Cal' },
  { n: 21, sym: 'Sc', name: 'Scarlett' }, { n: 22, sym: 'Ti', name: 'Titan' },
  { n: 23, sym: 'V', name: 'Van' }, { n: 24, sym: 'Cr', name: 'Chroma' },
];

const COLS = 8;
const TILE = 92;
const GAP = 12;

// ---------------------------------------------------------------------------
// CharacterSelectScene — both players pick a character, then a color, from
// the same keyboard. Flow per player: move cursor → confirm character →
// left/right cycles palette → confirm again to lock in. Special key backs out.
// ---------------------------------------------------------------------------
export default class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create() {
    this.drawBackground();
    this.add.text(W / 2, 44, 'CHOOSE YOUR ELEMENT', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '40px', color: '#ffffff',
      stroke: '#1c2b4a', strokeThickness: 8,
    }).setOrigin(0.5);

    this.gridX = W / 2 - (COLS * (TILE + GAP) - GAP) / 2;
    this.gridY = 96;
    this.tiles = SLOTS.map((slot, i) => this.drawTile(slot, i));

    this.players = [
      this.makePlayer(0, 0xff5f4a, 'P1', { left: 'A', right: 'D', up: 'W', down: 'S', confirm: 'F', back: 'G' }),
      this.makePlayer(1, 0x4a9fff, 'P2', {
        left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        confirm: 'K', back: 'L',
      }),
    ];

    this.hint = this.add.text(W / 2, H - 24, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#9fc4e8',
    }).setOrigin(0.5);
    this.refreshAll();
  }

  drawBackground() {
    const g = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x101b33);
    const bottom = Phaser.Display.Color.ValueToColor(0x233a5c);
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 24, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 24) * i, W, H / 24 + 1);
    }
  }

  tileXY(i) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { x: this.gridX + col * (TILE + GAP), y: this.gridY + row * (TILE + GAP) };
  }

  drawTile(slot, i) {
    const { x, y } = this.tileXY(i);
    const unlocked = !!slot.charId;
    const g = this.add.graphics();
    const base = unlocked ? CHARACTERS[slot.charId].palettes[0].body : 0x2a3550;
    return this.finishTile(g, slot, x, y, unlocked, base);
  }

  finishTile(g, slot, x, y, unlocked, base) {
    g.fillStyle(unlocked ? base : 0x263450, 1);
    g.fillRoundedRect(x, y, TILE, TILE, 12);
    g.fillStyle(unlocked ? 0xffffff : 0x314260, unlocked ? 0.16 : 1);
    g.fillRoundedRect(x + 4, y + 4, TILE - 8, TILE - 8, 9);
    this.add.text(x + 10, y + 8, String(slot.n), {
      fontFamily: 'Arial, sans-serif', fontSize: '15px',
      color: unlocked ? '#ffffff' : '#54678c',
    });
    this.add.text(x + TILE / 2, y + TILE / 2 + 2, slot.sym, {
      fontFamily: 'Georgia, serif', fontSize: '34px', fontStyle: 'bold',
      color: unlocked ? '#ffffff' : '#54678c',
    }).setOrigin(0.5);
    this.add.text(x + TILE / 2, y + TILE - 13, unlocked ? slot.name : '???', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px',
      color: unlocked ? '#eaf4ff' : '#54678c',
    }).setOrigin(0.5);
    return { slot, x, y, unlocked };
  }

  makePlayer(index, color, label, keys) {
    const kb = this.input.keyboard;
    const p = {
      index, color, label,
      cursor: index === 0 ? 0 : 1, // start P1 on Hydra, P2 on Helen
      phase: 'picking', // picking | palette | locked
      palette: 0,
      keys: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, kb.addKey(v)])),
      box: this.add.graphics(),
      previewX: index === 0 ? 150 : W - 150,
      previewRig: null,
      panel: this.add.container(index === 0 ? 150 : W - 150, 500),
    };

    const onDir = (dx, dy) => {
      if (p.phase !== 'locked') sfx('menuMove');
      if (p.phase === 'picking') {
        const col = (p.cursor % COLS + dx + COLS) % COLS;
        const row = Phaser.Math.Clamp(Math.floor(p.cursor / COLS) + dy, 0, Math.ceil(SLOTS.length / COLS) - 1);
        p.cursor = Math.min(row * COLS + col, SLOTS.length - 1);
      } else if (p.phase === 'palette' && dx !== 0) {
        const def = CHARACTERS[SLOTS[p.cursor].charId];
        p.palette = (p.palette + dx + def.palettes.length) % def.palettes.length;
        this.buildPreview(p);
      }
      this.refreshAll();
    };
    p.keys.left.on('down', () => onDir(-1, 0));
    p.keys.right.on('down', () => onDir(1, 0));
    p.keys.up.on('down', () => onDir(0, -1));
    p.keys.down.on('down', () => onDir(0, 1));
    p.keys.confirm.on('down', () => {
      if (p.phase !== 'locked' && SLOTS[p.cursor].charId) sfx('menuConfirm');
      if (p.phase === 'picking' && SLOTS[p.cursor].charId) {
        p.phase = 'palette';
        p.palette = p.index; // default different colors so mirror picks differ
        this.buildPreview(p);
      } else if (p.phase === 'palette') {
        p.phase = 'locked';
        this.checkAllLocked();
      }
      this.refreshAll();
    });
    p.keys.back.on('down', () => {
      if (p.phase === 'palette') p.phase = 'picking';
      else if (p.phase === 'locked') p.phase = 'palette';
      this.refreshAll();
    });
    return p;
  }

  buildPreview(p) {
    p.previewRig?.destroy();
    const def = CHARACTERS[SLOTS[p.cursor].charId];
    p.previewRig = new Rig(this, def, p.palette);
    p.previewRig.setPosition(p.previewX, 560);
    p.previewRig.baseScale = 1.35;
    this.add.existing(p.previewRig);
    p.previewName?.destroy();
    p.previewName = this.add.text(p.previewX, 600, `${def.name}\n${def.palettes[p.palette].name}`, {
      fontFamily: 'Arial Black, sans-serif', fontSize: '20px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5, 0);
  }

  refreshAll() {
    for (const p of this.players) {
      p.box.clear();
      const { x, y } = this.tileXY(p.cursor);
      const inset = p.index * 5; // offset second cursor so both are visible on one tile
      p.box.lineStyle(4, p.color, 1);
      p.box.strokeRoundedRect(x - 3 + inset, y - 3 + inset, TILE + 6 - inset * 2, TILE + 6 - inset * 2, 12);
      if (p.phase !== 'picking') {
        p.box.lineStyle(2, 0xffffff, 0.8);
        p.box.strokeRoundedRect(x - 7, y - 7, TILE + 14, TILE + 14, 14);
      }
    }
    const phases = this.players.map((p) => p.phase);
    if (phases.every((ph) => ph === 'locked')) this.hint.setText('Both locked in — starting…');
    else this.hint.setText('Move: P1 WASD / P2 Arrows · Confirm: F / K · Color: ←→ after confirming · Back: G / L');
  }

  checkAllLocked() {
    if (!this.players.every((p) => p.phase === 'locked')) return;
    this.time.delayedCall(700, () => {
      this.scene.start('StageSelect', {
        players: this.players.map((p) => ({ charId: SLOTS[p.cursor].charId, palette: p.palette })),
        stocks: 3,
      });
    });
  }

  update(time, delta) {
    for (const p of this.players) {
      p.previewRig?.animate(delta / 1000, 'idle', 0);
    }
  }
}
