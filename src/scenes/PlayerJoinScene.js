import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import {
  FONT_BODY, FONT_DISPLAY, FONT_MONO, GRID, PLAYER_COLORS, THEME, drawMenuBackground, paintPill,
} from '../ui/theme.js';
import { showScene } from '../ui/flow.js';
import { attachPhoneJoin } from '../ui/phoneJoin.js';
import { drawPadIcon, pollGamepads, syncPadSeats } from '../engine/gamepad.js';

// Layout is fixed in 1280x720 game pixels. Scale.FIT letterboxes other
// aspect ratios, so these rectangles never slide over each other.
// Left column: reactor QR + URL. Right column: seats. No portrait.
const QR_X = 198;
const QR_Y = 300;
const QR_SIZE = 220;
const LINK_TOP = 492;
const SEAT_LEFT = 420;
// Resolved when a seat is built. Reading W here would hit the main.js
// import cycle (GAME_WIDTH isn't initialized yet).
const seatWidth = () => W - SEAT_LEFT - GRID.margin;
const SEAT_TOP = 108;
const SEAT_H = 70;
const SEAT_GAP = 10;

const BOT_SLOT_BASE = 100;

const TYPES_WITH_KEYBOARD = ['keyboard', 'controller', 'bot', 'empty'];
const TYPES_NO_KEYBOARD = ['controller', 'bot', 'empty'];

// ---------------------------------------------------------------------------
// PlayerJoinScene — player/controller/bot setup. Six seats, each cycled
// through its available options by whoever's at the keyboard (host):
// seats 1-2 can be Keyboard, Controller (phone), Bot, or Empty; seats 3-6
// skip Keyboard. Defaults to Keyboard in the first two seats, Empty in the
// rest. A "Controller" seat waits for the next phone that joins over WiFi;
// a "Bot" seat is a CPU stand-in (Phase 8's basic AI, pulled forward).
// A Bluetooth or USB gamepad that connects here shows up in the dock.
// Pressing one of its buttons claims the next empty seat.
// ---------------------------------------------------------------------------
export default class PlayerJoinScene extends Phaser.Scene {
  constructor() {
    super('PlayerJoin');
  }

  create() {
    drawMenuBackground(this, W, H);

    this.add.text(GRID.margin, 26, 'SHELL ASSIGNMENT', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.tealCss, letterSpacing: 3,
    }).setDepth(4);
    this.add.text(GRID.margin, 46, 'PLAYER SETUP', {
      fontFamily: FONT_DISPLAY, fontSize: '32px', color: THEME.mistCss, letterSpacing: 1,
    }).setDepth(4);
    this.add.text(W - GRID.margin, 36, 'W/S select seat    A/D change type', {
      fontFamily: FONT_BODY, fontSize: '14px', color: THEME.mistCss,
    }).setOrigin(1, 0).setDepth(4);
    this.add.text(W - GRID.margin, 58, 'Enter to start    Esc back    button on a pad joins', {
      fontFamily: FONT_BODY, fontSize: '14px', color: THEME.dimCss,
    }).setOrigin(1, 0).setDepth(4);

    this.add.text(QR_X, LINK_TOP, 'CONTROLLER LINK', {
      fontFamily: FONT_MONO, fontSize: '13px', color: THEME.goldCss, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(4);
    this.address = this.add.text(QR_X, LINK_TOP + 22, 'Fetching network address…', {
      fontFamily: FONT_MONO, fontSize: '15px', color: THEME.tealCss,
      align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5, 0).setDepth(4);
    attachPhoneJoin(this, {
      x: QR_X,
      y: QR_Y,
      size: QR_SIZE,
      bezel: true,
      caption: false,
      depth: 5,
      onLabel: (text) => this.address.setText(text),
    });

    this.seats = [
      { type: 'keyboard', boundSlot: null },
      { type: 'keyboard', boundSlot: null },
      { type: 'empty', boundSlot: null },
      { type: 'empty', boundSlot: null },
      { type: 'empty', boundSlot: null },
      { type: 'empty', boundSlot: null },
    ];
    this.cursor = 0;
    this.hover = -1;

    this.rowBg = [];
    this.seatWho = [];
    this.seatKind = [];
    this.seatDetail = [];
    this.seatFlag = [];
    for (let i = 0; i < 6; i++) {
      const y = SEAT_TOP + i * (SEAT_H + SEAT_GAP);
      const g = this.add.graphics().setDepth(3);
      this.rowBg.push(g);
      const midY = y + SEAT_H / 2;
      this.seatWho.push(this.add.text(SEAT_LEFT + 48, midY, '', {
        fontFamily: FONT_DISPLAY, fontSize: '20px', color: THEME.mistCss,
      }).setOrigin(0, 0.5).setDepth(4));
      this.seatKind.push(this.add.text(SEAT_LEFT + 156, midY - 10, '', {
        fontFamily: FONT_BODY, fontSize: '16px', color: THEME.mistCss,
      }).setOrigin(0, 0.5).setDepth(4));
      this.seatDetail.push(this.add.text(SEAT_LEFT + 156, midY + 12, '', {
        fontFamily: FONT_BODY, fontSize: '14px', color: THEME.mistCss,
      }).setOrigin(0, 0.5).setDepth(4));
      this.seatFlag.push(this.add.text(SEAT_LEFT + seatWidth() - 22, midY, '', {
        fontFamily: FONT_MONO, fontSize: '13px', color: THEME.goldCss,
      }).setOrigin(1, 0.5).setDepth(4));

      const zone = this.add.zone(SEAT_LEFT, y, seatWidth(), SEAT_H).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
      zone.on('pointerover', () => { this.hover = i; this.refresh(); });
      zone.on('pointerout', () => { if (this.hover === i) this.hover = -1; this.refresh(); });
      zone.on('pointerdown', () => { this.cursor = i; sfx('menuMove'); this.refresh(); });
    }

    this.prevPadDown = {};
    this.livePads = [];
    this.padDock = this.add.graphics().setDepth(4);
    this.padLine = this.add.text(SEAT_LEFT, 646, '', {
      fontFamily: FONT_BODY, fontSize: '14px', color: THEME.tealCss,
    }).setOrigin(0, 0).setDepth(4);

    this.refresh();
    this.unsub = phoneNet.onChange(() => { this.reconcileBindings(); this.refresh(); });
    this.events.once('shutdown', () => this.unsub?.());

    const kb = this.input.keyboard;
    kb.on('keydown-W', () => this.moveCursor(-1));
    kb.on('keydown-UP', () => this.moveCursor(-1));
    kb.on('keydown-S', () => this.moveCursor(1));
    kb.on('keydown-DOWN', () => this.moveCursor(1));
    kb.on('keydown-A', () => this.cycleType(-1));
    kb.on('keydown-LEFT', () => this.cycleType(-1));
    kb.on('keydown-D', () => this.cycleType(1));
    kb.on('keydown-RIGHT', () => this.cycleType(1));

    const start = () => this.tryStart();
    kb.on('keydown-ENTER', start);
    kb.on('keydown-F', start);
    kb.on('keydown-ESC', () => showScene(this, 'Title'));
  }

  update() {
    const pads = pollGamepads();
    const { seats, prevDown } = syncPadSeats(this.seats, pads, this.prevPadDown);
    const sig = `${seats.map((s) => `${s.type}:${s.padIndex ?? ''}`).join(',')}#${pads.map((p) => `${p.index}:${p.family}`).join('|')}`;
    this.seats = seats;
    this.prevPadDown = prevDown;
    this.livePads = pads;
    if (sig !== this.padSig) {
      this.padSig = sig;
      this.refresh();
    }
  }

  moveCursor(dy) {
    sfx('menuMove');
    this.cursor = (this.cursor + dy + 6) % 6;
    this.refresh();
  }

  cycleType(dir) {
    const seat = this.seats[this.cursor];
    const options = this.cursor < 2 ? TYPES_WITH_KEYBOARD : TYPES_NO_KEYBOARD;
    const idx = options.indexOf(seat.type);
    seat.type = options[(idx + dir + options.length) % options.length];
    seat.boundSlot = null;
    sfx('menuMove');
    this.reconcileBindings();
    this.refresh();
  }

  reconcileBindings() {
    const connected = new Set(phoneNet.connectedSlots);
    for (const seat of this.seats) {
      if (seat.type === 'controller' && seat.boundSlot != null && !connected.has(seat.boundSlot)) {
        seat.boundSlot = null;
      }
    }
    const claimed = new Set(this.seats.filter((s) => s.boundSlot != null).map((s) => s.boundSlot));
    const freePhones = phoneNet.connectedSlots.filter((s) => !claimed.has(s));
    for (const seat of this.seats) {
      if (seat.type === 'controller' && seat.boundSlot == null && freePhones.length) {
        seat.boundSlot = freePhones.shift();
      }
    }
  }

  describeSeat(seat, i) {
    const n = i + 1;
    if (seat.type === 'keyboard') {
      const keys = i === 0 ? 'WASD + F/G' : 'Arrows + K/L';
      return { who: `P${n}`, kind: 'Keyboard', detail: keys, flag: 'LIVE', tone: 'live' };
    }
    if (seat.type === 'bot') {
      return { who: `P${n}`, kind: 'CPU Bot', detail: 'Stands in for a player', flag: 'CPU', tone: 'live' };
    }
    if (seat.type === 'controller') {
      return seat.boundSlot != null
        ? { who: `P${n}`, kind: 'Controller', detail: phoneNet.nameOf(seat.boundSlot), flag: 'LINKED', tone: 'live' }
        : { who: `P${n}`, kind: 'Controller', detail: 'Waiting for a phone', flag: 'WAIT', tone: 'wait' };
    }
    if (seat.type === 'gamepad') {
      const pad = this.livePads.find((item) => item.index === seat.padIndex);
      const name = pad ? pad.label : 'Controller';
      return { who: `P${n}`, kind: 'Gamepad', detail: `${name}  ·  A jump   X attack   B special`, flag: 'LIVE', tone: 'live' };
    }
    return { who: `P${n}`, kind: 'Empty', detail: 'Open seat', flag: '—', tone: 'empty' };
  }

  refresh() {
    this.seats.forEach((seat, i) => {
      const info = this.describeSeat(seat, i);
      const selected = i === this.cursor;
      const hovered = i === this.hover && !selected;
      const state = selected ? 'selected' : hovered ? 'hover' : info.tone === 'empty' ? 'empty' : 'idle';
      const y = SEAT_TOP + i * (SEAT_H + SEAT_GAP);
      const g = this.rowBg[i];
      g.clear();
      paintPill(g, SEAT_LEFT, y, seatWidth(), SEAT_H, state);

      // Player-color electron. Hollow when the seat is empty.
      const dotX = SEAT_LEFT + 26;
      const dotY = y + SEAT_H / 2;
      const pip = PLAYER_COLORS[i];
      if (info.tone === 'empty') {
        g.lineStyle(2, pip, 0.95);
        g.strokeCircle(dotX, dotY, 7);
      } else {
        g.fillStyle(pip, 1);
        g.fillCircle(dotX, dotY, 7);
        if (selected) {
          g.lineStyle(3, pip, 0.45);
          g.strokeCircle(dotX, dotY, 12);
        }
      }
      if (seat.type === 'gamepad') drawPadIcon(g, SEAT_LEFT + 108, dotY, pip);

      const kindColor = info.tone === 'empty' ? '#F2F7FF' : THEME.mistCss;
      const detailColor = selected ? '#F7FBFF' : '#E4EEF8';
      this.seatWho[i].setText(info.who).setColor(THEME.mistCss);
      this.seatKind[i].setText(info.kind.toUpperCase()).setColor(kindColor);
      this.seatDetail[i].setText(info.detail).setColor(detailColor);
      this.seatFlag[i].setText(info.flag).setColor(selected ? THEME.goldCss : THEME.tealCss);
    });
    this.drawPadDock();
  }

  drawPadDock() {
    const g = this.padDock;
    g.clear();
    const claimed = new Set(this.seats.filter((s) => s.type === 'gamepad').map((s) => s.padIndex));
    const waiting = (this.livePads || []).filter((pad) => !claimed.has(pad.index));
    if (!waiting.length) {
      this.padLine.setText('Plug in a controller, then press a button to join');
      return;
    }
    waiting.forEach((pad, i) => {
      drawPadIcon(g, SEAT_LEFT + 16 + i * 36, 628, THEME.teal);
    });
    const names = waiting.map((pad) => pad.label).join(', ');
    this.padLine.setText(`${names} connected — press a button to claim a seat`);
  }

  tryStart() {
    const anyWaiting = this.seats.some((s) => s.type === 'controller' && s.boundSlot == null);
    const activeCount = this.seats.filter((s) => s.type !== 'empty').length;
    if (anyWaiting || activeCount < 2) {
      sfx('menuMove');
      return;
    }
    sfx('menuConfirm');
    const playerSeeds = this.seats
      .map((seat, index) => ({ seat, index }))
      .filter(({ seat }) => seat.type !== 'empty')
      .map(({ seat, index }) => {
        if (seat.type === 'keyboard') return { slot: index };
        if (seat.type === 'bot') return { slot: BOT_SLOT_BASE + index };
        return { slot: seat.boundSlot };
      });
    showScene(this, 'CharacterSelect', { playerSeeds });
  }
}
