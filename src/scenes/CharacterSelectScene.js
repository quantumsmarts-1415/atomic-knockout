import * as Phaser from 'phaser';
import { CHARACTERS } from '../data/characters.js';
import { Rig } from '../engine/Rig.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PLAYER_COLORS, THEME, drawMenuBackground } from '../ui/theme.js';
import { showScene } from '../ui/flow.js';
import { menuPortraitKey } from '../ui/portraits.js';

// Slot numbering, decided in PlayerJoinScene: 0/1 = keyboard, 2-5 = a phone
// (PhoneNet's own connection slot), 100+seatIndex = a bot. Bots live far
// outside the phone range so the two can never collide.
const BOT_SLOT_BASE = 100;

// The 24 launch slots (first 24 elements). Only entries with a charId are
// playable today; the rest render as locked periodic-table tiles.
const SLOTS = [
  { n: 1, sym: 'H', name: 'Hydra', charId: 'hydra' },
  { n: 2, sym: 'He', name: 'Helen', charId: 'helen' },
  { n: 3, sym: 'Li', name: 'Lillie', charId: 'lillie' }, { n: 4, sym: 'Be', name: 'Ben', charId: 'ben' },
  { n: 5, sym: 'B', name: 'Bord', charId: 'bord' }, { n: 6, sym: 'C', name: 'Carter', charId: 'carter' },
  { n: 7, sym: 'N', name: 'Nitra', charId: 'nitra' }, { n: 8, sym: 'O', name: 'Oxana', charId: 'oxana' },
  { n: 9, sym: 'F', name: 'Flora', charId: 'flora' }, { n: 10, sym: 'Ne', name: 'Neo', charId: 'neo' },
  { n: 11, sym: 'Na', name: 'Natalie', charId: 'natalie' }, { n: 12, sym: 'Mg', name: 'Maggie', charId: 'maggie' },
  { n: 13, sym: 'Al', name: 'Allen', charId: 'allen' }, { n: 14, sym: 'Si', name: 'Silas', charId: 'silas' },
  { n: 15, sym: 'P', name: 'Phillip', charId: 'phillip' }, { n: 16, sym: 'S', name: 'Sully', charId: 'sully' },
  { n: 17, sym: 'Cl', name: 'Chloe', charId: 'chloe' }, { n: 18, sym: 'Ar', name: 'Aaron', charId: 'aaron' },
  { n: 19, sym: 'K', name: 'Kyle', charId: 'kyle' }, { n: 20, sym: 'Ca', name: 'Cal', charId: 'cal' },
  { n: 21, sym: 'Sc', name: 'Scarlett', charId: 'scarlett' }, { n: 22, sym: 'Ti', name: 'Titan', charId: 'titan' },
  { n: 23, sym: 'V', name: 'Van', charId: 'van' }, { n: 24, sym: 'Cr', name: 'Chroma', charId: 'chroma' },
];

const COLS = 8;
const TILE = 92;
const GAP = 12;

// Preview rigs are anchored (feet) at this y and grow upward from there --
// tall characters at the small-lobby scale (1.35x) could grow tall enough to
// poke up into the tile grid above them, covering the bottom row of
// characters. PREVIEW_TOP_MARGIN is the minimum gap always kept clear
// between a preview's top and the grid's bottom edge.
const PREVIEW_ANCHOR_Y = 560;
const PREVIEW_TOP_MARGIN = 24;

// P1/P2 are always the two local keyboard players (slots 0/1). Slots 2-5 are
// phones, filled in from phoneNet — however many happen to be connected when
// this scene starts (joining happens in the PlayerJoin lobby before this).
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

  init(data) {
    // Falls back to 2 keyboard players if launched directly (e.g. testing)
    // without going through the PlayerJoin lobby.
    this.playerSeeds = data?.playerSeeds?.length ? data.playerSeeds : [{ slot: 0 }, { slot: 1 }];
  }

  create() {
    // Phaser reuses this same scene instance every time CharacterSelect is
    // entered (it doesn't get recreated), so instance flags set during a
    // previous visit must be reset here or they leak into the next one --
    // this one guards the StageSelect transition below and previously stuck
    // every subsequent visit at "Everyone locked in" forever once it had
    // been set true once.
    this.starting = false;
    this.drawBackground();
    this.add.text(W / 2, 18, 'REACTOR  ·  ROSTER', {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.tealCss, letterSpacing: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, 42, 'CHOOSE YOUR ELEMENT', {
      fontFamily: FONT_DISPLAY, fontSize: '28px', color: THEME.mistCss, letterSpacing: 1,
    }).setOrigin(0.5);

    this.gridX = W / 2 - (COLS * (TILE + GAP) - GAP) / 2;
    this.gridY = 96;
    this.hoverBox = this.add.graphics().setDepth(4);
    this.gridBottom = this.gridY + Math.ceil(SLOTS.length / COLS) * (TILE + GAP) - GAP;
    this.tiles = SLOTS.map((slot, i) => this.drawTile(slot, i));

    // Player "slot" numbers come straight from the lobby's decisions. Array
    // position doubles as each player's UI ordering (P1 leftmost preview).
    this.playerSlots = this.playerSeeds.map((seed) => seed.slot);
    this.players = this.playerSlots.map((slot, i) => this.makePlayer(slot, i));

    // Bots skip the whole picking flow -- they were already given a random
    // character/palette and locked in makePlayer(); this just builds their
    // preview now that the full player list (and layout it depends on) exists.
    for (const p of this.players) {
      if (p.isBot) this.buildPreview(p);
    }

    this.hint = this.add.text(W / 2, H - 18, '', {
      fontFamily: FONT_BODY, fontSize: '14px', color: THEME.dimCss,
    }).setOrigin(0.5);
    this.refreshAll();
    this.checkAllLocked();
  }

  drawBackground() {
    drawMenuBackground(this, W, H);
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
    // Unlocked tiles keep the character's own palette color (that's their
    // identity, not generic chrome); locked tiles get the HUD glass look.
    const base = unlocked ? CHARACTERS[slot.charId].palettes[0].body : THEME.shellEmpty;
    return this.finishTile(g, slot, x, y, unlocked, base);
  }

  // Unlocked tiles show the character's own concept-art photo by default.
  // Hovering the mouse over a tile swaps in a name/symbol card on top of it;
  // moving the pointer away (which also covers "picked a character and
  // moved on") swaps back to the photo. Locked (no charId yet) tiles keep
  // the old plain "???" placeholder look, unaffected by any of this.
  finishTile(g, slot, x, y, unlocked, base) {
    g.fillStyle(base, 1);
    g.fillRoundedRect(x, y, TILE, TILE, 12);

    const charDef = unlocked ? CHARACTERS[slot.charId] : null;
    const portrait = menuPortraitKey(charDef);
    const hasPhoto = !!(portrait && this.textures.exists(portrait));

    if (hasPhoto) {
      const photo = this.add.image(x + TILE / 2, y + TILE / 2, portrait);
      const pad = 8;
      const scale = Math.min((TILE - pad) / photo.width, (TILE - pad) / photo.height);
      photo.setScale(scale);
    } else if (unlocked) {
      g.fillStyle(0xffffff, 0.16);
      g.fillRoundedRect(x + 4, y + 4, TILE - 8, TILE - 8, 9);
    } else {
      g.lineStyle(1.5, THEME.teal, 0.35);
      g.strokeRoundedRect(x + 4, y + 4, TILE - 8, TILE - 8, 9);
    }

    // Name/symbol card -- always present for locked tiles (no photo to show
    // instead); only shown on hover for unlocked tiles with a real photo.
    const card = this.add.container(0, 0);
    const scrim = this.add.graphics();
    scrim.fillStyle(THEME.void, 0.82);
    scrim.fillRoundedRect(x + 4, y + 4, TILE - 8, TILE - 8, 9);
    const symText = this.add.text(x + TILE / 2, y + TILE / 2 + 2, slot.sym, {
      fontFamily: FONT_DISPLAY, fontSize: '28px',
      color: unlocked ? THEME.mistCss : THEME.disabledCss,
    }).setOrigin(0.5);
    const nameText = this.add.text(x + TILE / 2, y + TILE - 13, unlocked ? slot.name : '???', {
      fontFamily: FONT_BODY, fontSize: '12px',
      color: unlocked ? THEME.mistCss : THEME.disabledCss,
    }).setOrigin(0.5);
    card.add([scrim, symText, nameText]);
    card.setVisible(!hasPhoto);

    // Tile number stays visible in both states (periodic-table convention).
    this.add.text(x + 10, y + 8, String(slot.n), {
      fontFamily: FONT_MONO, fontSize: '12px',
      color: unlocked ? THEME.goldCss : THEME.disabledCss,
    });

    if (hasPhoto) {
      const zone = this.add.zone(x, y, TILE, TILE).setOrigin(0, 0).setInteractive();
      zone.on('pointerover', () => { card.setVisible(true); this.drawTileHover(x, y); });
      zone.on('pointerout', () => { card.setVisible(false); this.hoverBox?.clear(); });
    }

    return { slot, x, y, unlocked };
  }

  // index: this player's position among the players in THIS match (0-based,
  // used for layout/color/starting pick). slot: their persistent control
  // slot (0/1 keyboard, 2-5 phone, 100+ bot) — this is what follows them all
  // the way into BattleScene so input keeps routing to the right fighter.
  makePlayer(slot, index) {
    const isKeyboard = slot === 0 || slot === 1;
    const isBot = slot >= BOT_SLOT_BASE;
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
      // Label is by seat position (index), not the raw slot number -- slot
      // is just a routing key now (bots sit at 100+, and a phone's slot can
      // be a different number than its seat position once binding order
      // shuffles things), so P-number must always come from seat order.
      label: `P${index + 1}${isBot ? ' (CPU)' : ''}`,
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
      // default different colors so mirror picks differ -- modulo the
      // actual character's palette count (was a hardcoded %8, which broke
      // for player index >= a character's real palette count, e.g. P5+)
      const def = CHARACTERS[SLOTS[p.cursor].charId];
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
    const def = CHARACTERS[SLOTS[p.cursor].charId];
    p.previewRig = new Rig(this, def, p.palette);
    p.previewRig.setPosition(p.previewX, PREVIEW_ANCHOR_Y);
    const desiredScale = this.players.length > 3 ? 0.95 : 1.35;
    // Visual height before scaling: art-based rigs render at art.height;
    // procedural rigs are roughly legs + torso + head. Clamp the scale so
    // the tallest characters can't grow up into the tile grid above.
    const visualHeight = def.art?.height
      ?? (def.body.legLength + def.body.torsoHeight + def.body.headRadius * 2);
    const maxScale = (PREVIEW_ANCHOR_Y - this.gridBottom - PREVIEW_TOP_MARGIN) / visualHeight;
    p.previewRig.baseScale = Math.min(desiredScale, maxScale);
    this.add.existing(p.previewRig);
    p.previewName?.destroy();
    p.previewName = this.add.text(p.previewX, 600, `${def.name}\n${def.palettes[p.palette].name}`, {
      fontFamily: FONT_BODY, fontSize: this.players.length > 3 ? '14px' : '16px',
      color: THEME.mistCss, align: 'center',
    }).setOrigin(0.5, 0);
  }

  drawTileHover(x, y) {
    this.hoverBox.clear();
    this.hoverBox.lineStyle(2, THEME.teal, 0.95);
    this.hoverBox.strokeRoundedRect(x - 6, y - 6, TILE + 12, TILE + 12, 16);
  }

  refreshAll() {
    for (const p of this.players) {
      p.box.clear();
      const { x, y } = this.tileXY(p.cursor);
      const inset = (p.index % 5) * 4; // offset stacked cursors so overlapping picks are still visible
      if (p.phase === 'locked') {
        p.box.lineStyle(6, THEME.pink, 0.35);
        p.box.strokeRoundedRect(x - 8, y - 8, TILE + 16, TILE + 16, 16);
        p.box.lineStyle(3, THEME.gold, 1);
        p.box.strokeRoundedRect(x - 4, y - 4, TILE + 8, TILE + 8, 14);
      } else if (p.phase === 'palette') {
        p.box.lineStyle(3, THEME.gold, 1);
        p.box.strokeRoundedRect(x - 5, y - 5, TILE + 10, TILE + 10, 14);
        p.box.lineStyle(4, p.color, 1);
        p.box.strokeRoundedRect(x - 1 + inset, y - 1 + inset, TILE + 2 - inset * 2, TILE + 2 - inset * 2, 12);
      } else {
        p.box.fillStyle(p.color, 0.18);
        p.box.fillRoundedRect(x - 4, y - 4, TILE + 8, TILE + 8, 14);
        p.box.lineStyle(4, p.color, 1);
        p.box.strokeRoundedRect(x - 4 + inset, y - 4 + inset, TILE + 8 - inset * 2, TILE + 8 - inset * 2, 14);
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
      showScene(this, 'StageSelect', {
        players: this.players.map((p) => ({ charId: SLOTS[p.cursor].charId, palette: p.palette, slot: p.slot })),
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
