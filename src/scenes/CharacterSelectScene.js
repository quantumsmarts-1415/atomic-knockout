import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import { botSlots } from '../net/BotSlots.js';

// The 24 launch slots (first 24 elements). Only entries with a charId are
// playable today; the rest render as locked periodic-table tiles.
const SLOTS = [
  { n: 1, sym: 'H', name: 'Hydra', charId: 'hydra' },
  { n: 2, sym: 'He', name: 'Helen', charId: 'helen' },
  { n: 3, sym: 'Li', name: 'Lillie', charId: 'lillie' }, { n: 4, sym: 'Be', name: 'Ben', charId: 'ben' },
  { n: 5, sym: 'B', name: 'Bord', charId: 'bord' }, { n: 6, sym: 'C', name: 'Carter', charId: 'carter' },
  { n: 7, sym: 'N', name: 'Nitra', charId: 'nitra' }, { n: 8, sym: 'O', name: 'Oxana' },
  { n: 9, sym: 'F', name: 'Flora' }, { n: 10, sym: 'Ne', name: 'Neo' },
  { n: 11, sym: 'Na', name: 'Natalie' }, { n: 12, sym: 'Mg', name: 'Maggie' },
  { n: 13, sym: 'Al', name: 'Allen' }, { n: 14, sym: 'Si', name: 'Silas' },
  { n: 15, sym: 'P', name: 'Phillip' }, { n: 16, sym: 'S', name: 'Sully' },
  { n: 17, sym: 'Cl', name: 'Chloe' }, { n: 18, sym: 'Ar', name: 'Aaron' },
  { n: 19, sym: 'K', name: 'Kyle' }, { n: 20, sym: 'Ca', name: 'Cal' },
  { n: 21, sym: 'Sc', name: 'Scarlett' }, { n: 22, sym: 'Ti', name: 'Titan', charId: 'titan' },
  { n: 23, sym: 'V', name: 'Van' }, { n: 24, sym: 'Cr', name: 'Chroma' },
];

const COLS = 8;
const TILE = 92;
const GAP = 12;

// P1/P2 are always the two local keyboard players (slots 0/1). Slots 2-5 are
// phones, filled in from phoneNet — however many happen to be connected when
// this scene starts (joining happens in the PlayerJoin lobby before this).
const PLAYER_COLORS = [0xff5f4a, 0x4a9fff, 0x53e0a8, 0xffd166, 0xc98bff, 0xff8fc9];

const PLAYABLE_SLOT_INDICES = SLOTS.map((s, i) => (s.charId ? i : null)).filter((i) => i !== null);

// ---------------------------------------------------------------------------
// CharacterSelectScene — every player (keyboard or phone) picks a character,
// then a color. Flow per player: move cursor → confirm character → left/right
// cycles palette → confirm again to lock in. Back backs out one step.
//
// Input is unified across sources: every player is polled once per frame for
// {left,right,up,down,confirm,back} booleans (keyboard reads Phaser Key
// state, phones read PhoneNet), and edge-detection (just-pressed) happens
// here rather than via Phaser's keyboard events, so both sources behave
// identically.
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

    // Player "slot" numbers: 0/1 are always the keyboard, 2-5 are whichever
    // phones/bots were connected when the lobby moved on. Array position
    // doubles as each player's UI ordering (P1 leftmost preview, etc.).
    const seatSlots = new Set([...phoneNet.connectedSlots, ...botSlots.connectedSlots]);
    this.playerSlots = [0, 1, ...[...seatSlots].sort((a, b) => a - b)].slice(0, 6);
    this.players = this.playerSlots.map((slot, i) => this.makePlayer(slot, i));

    // Bots skip the whole picking flow -- they were already given a random
    // character/palette and locked in makePlayer(); this just builds their
    // preview now that the full player list (and layout it depends on) exists.
    for (const p of this.players) {
      if (p.isBot) this.buildPreview(p);
    }

    this.hint = this.add.text(W / 2, H - 24, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#9fc4e8',
    }).setOrigin(0.5);
    this.refreshAll();
    this.checkAllLocked();
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

  // index: this player's position among the players in THIS match (0-based,
  // used for layout/color/starting pick). slot: their persistent control
  // slot (0/1 keyboard, 2-5 phone) — this is what follows them all the way
  // into BattleScene so input keeps routing to the right fighter.
  makePlayer(slot, index) {
    const isKeyboard = slot === 0 || slot === 1;
    const isBot = !isKeyboard && botSlots.hasSlot(slot);
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
    const randomSlotIdx = PLAYABLE_SLOT_INDICES[Math.floor(Math.random() * PLAYABLE_SLOT_INDICES.length)];
    const randomPalette = Math.floor(Math.random() * CHARACTERS[SLOTS[randomSlotIdx].charId].palettes.length);
    const p = {
      slot, index, isKeyboard, isBot, keys,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      label: `P${slot + 1}${isBot ? ' (CPU)' : ''}`,
      // Bots skip the picking UI entirely -- a random playable character and
      // palette, locked immediately, is enough to "stand in for a human"
      // (Phase 8's phrasing) for testing a match, not a real ability choice.
      cursor: isBot ? randomSlotIdx : Math.min(index, SLOTS.length - 1),
      phase: isBot ? 'locked' : 'picking', // picking | palette | locked
      palette: isBot ? randomPalette : index,
      prevBtn: { left: false, right: false, up: false, down: false, confirm: false, back: false },
      box: this.add.graphics(),
      previewX,
      previewRig: null,
      panel: this.add.container(previewX, 500),
    };
    return p;
  }

  previewXFor(index, n) {
    if (n <= 1) return W / 2;
    const margin = 150;
    return margin + (index * (W - margin * 2)) / (n - 1);
  }

  // Current {left,right,up,down,confirm,back} booleans for a player, from
  // whichever input source they use.
  readInput(p) {
    if (p.isKeyboard) {
      return {
        left: p.keys.left.isDown, right: p.keys.right.isDown,
        up: p.keys.up.isDown, down: p.keys.down.isDown,
        confirm: p.keys.confirm.isDown, back: p.keys.back.isDown,
      };
    }
    return phoneNet.getInput(p.slot);
  }

  handleDir(p, dx, dy) {
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
  }

  handleConfirm(p) {
    if (p.phase !== 'locked' && SLOTS[p.cursor].charId) sfx('menuConfirm');
    if (p.phase === 'picking' && SLOTS[p.cursor].charId) {
      p.phase = 'palette';
      p.palette = p.index % 8; // default different colors so mirror picks differ
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
    const def = CHARACTERS[SLOTS[p.cursor].charId];
    p.previewRig = new Rig(this, def, p.palette);
    p.previewRig.setPosition(p.previewX, 560);
    p.previewRig.baseScale = this.players.length > 3 ? 0.95 : 1.35;
    this.add.existing(p.previewRig);
    p.previewName?.destroy();
    p.previewName = this.add.text(p.previewX, 600, `${def.name}\n${def.palettes[p.palette].name}`, {
      fontFamily: 'Arial Black, sans-serif', fontSize: this.players.length > 3 ? '16px' : '20px',
      color: '#ffffff', align: 'center',
    }).setOrigin(0.5, 0);
  }

  refreshAll() {
    for (const p of this.players) {
      p.box.clear();
      const { x, y } = this.tileXY(p.cursor);
      const inset = (p.index % 5) * 4; // offset stacked cursors so overlapping picks are still visible
      p.box.lineStyle(4, p.color, 1);
      p.box.strokeRoundedRect(x - 3 + inset, y - 3 + inset, TILE + 6 - inset * 2, TILE + 6 - inset * 2, 12);
      if (p.phase !== 'picking') {
        p.box.lineStyle(2, 0xffffff, 0.8);
        p.box.strokeRoundedRect(x - 7, y - 7, TILE + 14, TILE + 14, 14);
      }
    }
    const phases = this.players.map((p) => p.phase);
    if (phases.every((ph) => ph === 'locked')) this.hint.setText('Everyone locked in — starting…');
    else this.hint.setText('Move: D-pad/WASD/Arrows/phone · Confirm: attack button · Color: ←→ · Back: special button');
  }

  checkAllLocked() {
    if (this.starting || !this.players.every((p) => p.phase === 'locked')) return;
    this.starting = true;
    this.time.delayedCall(700, () => {
      this.scene.start('StageSelect', {
        players: this.players.map((p) => ({ charId: SLOTS[p.cursor].charId, palette: p.palette, slot: p.slot, isBot: p.isBot })),
        stocks: 3,
      });
    });
  }

  update(time, delta) {
    for (const p of this.players) {
      // Graceful disconnect: if a phone player drops before locking in, stop
      // waiting on them — auto-lock whatever they had selected (falling back
      // to the first playable character if they hadn't picked one yet) so a
      // dropped phone can't strand the rest of the group in the lobby.
      if (!p.isKeyboard && !p.isBot && !phoneNet.hasSlot(p.slot) && p.phase !== 'locked') {
        if (!SLOTS[p.cursor].charId) p.cursor = 0;
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
