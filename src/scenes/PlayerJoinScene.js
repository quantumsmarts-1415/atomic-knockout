import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import {
  FONT_DISPLAY, FONT_MONO, GRID, MOTION, PLAYER_COLORS, PLAYER_COLORS_CSS, THEME,
  drawCard, drawFooterHints, drawHeader, drawMenuBackground, makeButton, textStyle,
} from '../ui/theme.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { attachPhoneJoin } from '../ui/phoneJoin.js';
import { drawPadIcon, pollGamepads, syncPadSeats } from '../engine/gamepad.js';
import { missingSelectPortraits, queueSelectPortraits } from '../engine/selectArt.js';
import { artGaveUp, runSafeLoad } from '../engine/safeLoad.js';
import { attachBootLoadUi, registerSheetAnims, repackOversizedSheets } from './BootScene.js';
import { ROSTER } from '../data/characters.js';

// Layout is fixed in 1280x720 game pixels. Scale.FIT letterboxes other
// aspect ratios, so these rectangles never slide over each other.
// Left column: reactor QR + URL. Right column: six seat cards + start.
const QR_X = 198;
const QR_Y = 296;
const QR_SIZE = 212;
const LINK_TOP = 480;
const SEAT_LEFT = 420;
// Resolved when a seat is built. Reading W here would hit the main.js
// import cycle (GAME_WIDTH isn't initialized yet).
const seatWidth = () => W - SEAT_LEFT - GRID.margin;
const SEAT_TOP = 104;
const SEAT_H = 60;
const SEAT_GAP = 8;
const START_Y = SEAT_TOP + 6 * (SEAT_H + SEAT_GAP) + 10;

const BOT_SLOT_BASE = 100;

const TYPES_WITH_KEYBOARD = ['keyboard', 'controller', 'bot', 'empty'];
const TYPES_NO_KEYBOARD = ['controller', 'bot', 'empty'];

// ---------------------------------------------------------------------------
// PlayerJoinScene — player/controller/bot setup. Six seats, each cycled
// through its available options by whoever's at the keyboard (host):
// seats 1-2 can be Keyboard, Controller (phone), Bot, or Empty; seats 3-6
// skip Keyboard. Defaults to Keyboard in the first two seats, Empty in the
// rest. A "Controller" seat waits for the next phone that joins over WiFi;
// a "Bot" seat is a CPU stand-in. A Bluetooth or USB gamepad that connects
// here shows up in the dock; pressing one of its buttons claims the next
// empty seat.
// ---------------------------------------------------------------------------
export default class PlayerJoinScene extends Phaser.Scene {
  constructor() {
    super('PlayerJoin');
  }

  create() {
    drawMenuBackground(this, W, H);
    drawHeader(this, { kicker: 'Shell assignment', title: 'Player setup', align: 'left' });

    this.add.text(QR_X, LINK_TOP, 'CONTROLLER LINK', {
      fontFamily: FONT_MONO, fontSize: '11px', color: THEME.goldCss, letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(4);
    this.address = this.add.text(QR_X, LINK_TOP + 20, 'Looking for the local network…', {
      fontFamily: FONT_MONO, fontSize: '14px', color: THEME.tealCss,
      align: 'center', wordWrap: { width: 330 },
    }).setOrigin(0.5, 0).setDepth(4);
    this.add.text(QR_X, LINK_TOP + 66, 'Phones on the same Wi-Fi become controllers', textStyle('caption', { align: 'center', wordWrap: { width: 300 } })).setOrigin(0.5, 0).setDepth(4);
    attachPhoneJoin(this, {
      x: QR_X,
      y: QR_Y,
      size: QR_SIZE,
      bezel: true,
      caption: false,
      depth: 5,
      // The label is the offline explanation; a live link shows its bare URL.
      onLabel: (text) => this.address.setText(text),
      onLink: ({ url }) => this.address.setText(url.replace(/^https?:\/\//, '')),
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

    this.rows = [];
    for (let i = 0; i < 6; i++) {
      const y = SEAT_TOP + i * (SEAT_H + SEAT_GAP);
      const midY = y + SEAT_H / 2;
      const g = this.add.graphics().setDepth(3);
      const who = this.add.text(SEAT_LEFT + 46, midY, `P${i + 1}`, {
        fontFamily: FONT_DISPLAY, fontSize: '18px', color: PLAYER_COLORS_CSS[i],
      }).setOrigin(0, 0.5).setDepth(4);
      const kind = this.add.text(SEAT_LEFT + 112, midY - 9, '', {
        fontFamily: FONT_DISPLAY, fontSize: '13px', color: THEME.mistCss, letterSpacing: 1,
      }).setOrigin(0, 0.5).setDepth(4);
      const detail = this.add.text(SEAT_LEFT + 112, midY + 11, '', textStyle('caption')).setOrigin(0, 0.5).setDepth(4);
      const flag = this.add.text(SEAT_LEFT + seatWidth() - 22, midY, '', {
        fontFamily: FONT_MONO, fontSize: '10px', color: THEME.tealCss, letterSpacing: 1.5,
      }).setOrigin(1, 0.5).setDepth(5);
      const zone = this.add.zone(SEAT_LEFT, y, seatWidth(), SEAT_H).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
      zone.on('pointerover', () => { this.hover = i; this.refresh(); });
      zone.on('pointerout', () => { if (this.hover === i) this.hover = -1; this.refresh(); });
      zone.on('pointerdown', (pointer) => {
        // click a seat to focus it; click the focused seat to cycle its type
        if (this.cursor === i) this.cycleType(pointer.rightButtonDown() ? -1 : 1);
        else { this.cursor = i; sfx('menuMove'); this.refresh(); }
      });
      const row = { g, who, kind, detail, flag, y };
      this.rows.push(row);
      const parts = [g, who, kind, detail, flag];
      parts.forEach((o) => { o.alpha = 0; });
      this.tweens.add({ targets: parts, alpha: 1, duration: MOTION.base, delay: 40 + i * 35, ease: MOTION.easeOut });
    }

    this.startBtn = makeButton(this, {
      x: SEAT_LEFT + seatWidth() - 260, y: START_Y, w: 260, h: 44, label: 'Start', keyHint: 'ENTER',
      onPress: () => this.tryStart(),
    });
    this.startBtn.onHover = () => {};
    this.readyNote = this.add.text(SEAT_LEFT, START_Y + 22, '', textStyle('caption')).setOrigin(0, 0.5).setDepth(4);

    this.prevPadDown = {};
    this.livePads = [];
    this.padDock = this.add.graphics().setDepth(4);
    this.padLine = this.add.text(SEAT_LEFT, START_Y + 66, '', textStyle('caption')).setOrigin(0, 0.5).setDepth(4);

    this.hints = drawFooterHints(this, [
      { keys: ['W', 'S'], label: 'Seat' },
      { keys: ['A', 'D'], label: 'Type' },
      { key: 'ENTER', label: 'Start' },
      { key: 'ESC', label: 'Back' },
    ]);

    this.refresh();
    this.unsub = phoneNet.onChange(() => { this.reconcileBindings(); this.refresh(); });
    this.events.once('shutdown', () => this.unsub?.());

    const kb = this.input.keyboard;
    const guard = (fn) => () => { if (!isLeaving(this)) fn(); };
    kb.on('keydown-W', guard(() => this.moveCursor(-1)));
    kb.on('keydown-UP', guard(() => this.moveCursor(-1)));
    kb.on('keydown-S', guard(() => this.moveCursor(1)));
    kb.on('keydown-DOWN', guard(() => this.moveCursor(1)));
    kb.on('keydown-A', guard(() => this.cycleType(-1)));
    kb.on('keydown-LEFT', guard(() => this.cycleType(-1)));
    kb.on('keydown-D', guard(() => this.cycleType(1)));
    kb.on('keydown-RIGHT', guard(() => this.cycleType(1)));

    const start = guard(() => { if (this.startBtn.disabled) this.tryStart(); else this.startBtn.press(); });
    kb.on('keydown-ENTER', start);
    kb.on('keydown-F', start);
    kb.on('keydown-ESC', guard(() => { sfx('menuMove'); showScene(this, 'Title'); }));
    kb.on('keydown-BACKSPACE', guard(() => { sfx('menuMove'); showScene(this, 'Title'); }));
    enterScene(this);
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
    const row = this.rows[this.cursor];
    this.tweens.add({ targets: [row.kind, row.detail], x: `+=${dir * 6}`, duration: MOTION.quick, yoyo: true, ease: MOTION.easeOut });
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
    if (seat.type === 'keyboard') {
      const keys = i === 0 ? 'WASD + F / G' : 'Arrows + K / L';
      return { kind: 'Keyboard', detail: keys, flag: 'READY', tone: 'live' };
    }
    if (seat.type === 'bot') {
      return { kind: 'CPU', detail: 'Computer-controlled fighter', flag: 'READY', tone: 'live' };
    }
    if (seat.type === 'controller') {
      return seat.boundSlot != null
        ? { kind: 'Phone', detail: phoneNet.nameOf(seat.boundSlot), flag: 'LINKED', tone: 'live' }
        : { kind: 'Phone', detail: 'Waiting for a phone to scan the code', flag: 'WAITING', tone: 'wait' };
    }
    if (seat.type === 'gamepad') {
      const pad = this.livePads.find((item) => item.index === seat.padIndex);
      const name = pad ? pad.label : 'Gamepad';
      return { kind: 'Gamepad', detail: `${name}  ·  A jump  X attack  B special`, flag: 'READY', tone: 'live' };
    }
    return { kind: 'Open seat', detail: 'Press A / D to add a player', flag: '', tone: 'empty' };
  }

  readiness() {
    const waiting = this.seats.filter((s) => s.type === 'controller' && s.boundSlot == null).length;
    const active = this.seats.filter((s) => s.type !== 'empty').length;
    if (active < 2) return { ok: false, note: `${active} of 2 seats filled — add a player or a CPU` };
    if (waiting) return { ok: false, note: waiting === 1 ? 'One phone seat is still waiting' : `${waiting} phone seats are still waiting` };
    return { ok: true, note: `${active} fighters ready` };
  }

  refresh() {
    this.seats.forEach((seat, i) => {
      const info = this.describeSeat(seat, i);
      const selected = i === this.cursor;
      const hovered = i === this.hover && !selected;
      const state = selected ? 'selected' : hovered ? 'hover' : info.tone === 'empty' ? 'empty' : 'idle';
      const row = this.rows[i];
      const { g, y } = row;
      const pip = PLAYER_COLORS[i];
      g.clear();
      drawCard(g, SEAT_LEFT, y, seatWidth(), SEAT_H, { accent: pip, state, radius: 12 });

      // Player-color electron. Hollow when the seat is empty.
      const dotX = SEAT_LEFT + 26;
      const dotY = y + SEAT_H / 2;
      if (info.tone === 'empty') {
        g.lineStyle(1.5, pip, 0.7);
        g.strokeCircle(dotX, dotY, 6);
      } else {
        g.fillStyle(pip, 1);
        g.fillCircle(dotX, dotY, 6);
        g.lineStyle(2, pip, selected ? 0.5 : 0.22);
        g.strokeCircle(dotX, dotY, 10);
      }
      if (seat.type === 'gamepad') drawPadIcon(g, SEAT_LEFT + 92, dotY, pip);

      // status chip
      if (info.flag) {
        const color = info.tone === 'wait' ? THEME.gold : pip;
        const cw = info.flag.length * 7.5 + 18;
        const cx = SEAT_LEFT + seatWidth() - 22 - cw;
        g.fillStyle(color, 0.16);
        g.fillRoundedRect(cx, dotY - 10, cw, 20, 10);
        g.lineStyle(1, color, 0.55);
        g.strokeRoundedRect(cx, dotY - 10, cw, 20, 10);
        row.flag.setColor(info.tone === 'wait' ? THEME.goldCss : PLAYER_COLORS_CSS[i]);
        row.flag.setX(cx + cw - 9);
      }
      row.flag.setText(info.flag);
      row.who.setAlpha(info.tone === 'empty' ? 0.55 : 1);
      row.kind.setText(info.kind.toUpperCase()).setColor(info.tone === 'empty' ? THEME.dimCss : THEME.mistCss);
      row.detail.setText(info.detail).setColor(selected ? THEME.mistCss : THEME.dimCss);
    });
    const ready = this.readiness();
    this.startBtn.setDisabled(!ready.ok);
    this.startBtn.setSelected(ready.ok);
    this.readyNote.setText(ready.note).setColor(ready.ok ? THEME.tealCss : THEME.dimCss);
    this.drawPadDock();
  }

  drawPadDock() {
    const g = this.padDock;
    g.clear();
    const claimed = new Set(this.seats.filter((s) => s.type === 'gamepad').map((s) => s.padIndex));
    const waiting = (this.livePads || []).filter((pad) => !claimed.has(pad.index));
    if (!waiting.length) {
      this.padLine.setText('Gamepads: plug one in and press any button to take a seat').setX(SEAT_LEFT);
      return;
    }
    waiting.forEach((pad, i) => {
      drawPadIcon(g, SEAT_LEFT + 14 + i * 34, START_Y + 66, THEME.teal);
    });
    const names = waiting.map((pad) => pad.label).join(', ');
    this.padLine.setText(`${names} connected — press a button to claim a seat`).setX(SEAT_LEFT + 14 + waiting.length * 34);
  }

  tryStart() {
    if (isLeaving(this) || this.loadingArt) return;
    const ready = this.readiness();
    if (!ready.ok) {
      sfx('menuMove');
      this.tweens.add({ targets: this.readyNote, x: { from: SEAT_LEFT + 6, to: SEAT_LEFT }, duration: MOTION.quick, yoyo: true, repeat: 1 });
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
    const exists = (key) => this.textures.exists(key) || artGaveUp(key);
    const go = () => {
      if (!this.sys?.isActive?.()) return;
      showScene(this, 'CharacterSelect', { playerSeeds });
    };
    if (!missingSelectPortraits(exists).length) {
      go();
      return;
    }
    // One load, on this scene, after the seats are chosen. Starting it
    // earlier and then stopping the scene left those requests in flight,
    // and the select screen's own load never finished.
    this.loadingArt = true;
    const ui = attachBootLoadUi(this, { status: 'Loading fighters…' });
    runSafeLoad(this, (loader) => queueSelectPortraits(loader, exists)).then(() => {
      repackOversizedSheets(this, ROSTER);
      registerSheetAnims(this, ROSTER);
      ui.destroy();
      go();
    });
  }
}
