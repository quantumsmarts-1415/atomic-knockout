import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import { drawMenuBackground } from '../ui/theme.js';

// Slot numbering convention, shared with CharacterSelectScene/BattleScene:
//   0/1    -> keyboard (P1/P2)
//   2-5    -> a phone, numbered by PhoneNet in join order
//   100+i  -> a bot "sitting in" seat i (i is the seat index, 0-5) --
//             deliberately far outside the phone range so a bot can never
//             collide with a real phone's slot number.
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
// ---------------------------------------------------------------------------
export default class PlayerJoinScene extends Phaser.Scene {
  constructor() {
    super('PlayerJoin');
  }

  create() {
    drawMenuBackground(this, W, H);

    this.add.text(W / 2, 50, 'PLAYER SETUP', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '42px', color: '#eaf9ff',
      stroke: '#060a10', strokeThickness: 8, letterSpacing: 1,
    }).setOrigin(0.5);

    this.address = this.add.text(W / 2, 100, 'Fetching network address…', {
      fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#5c7a94',
    }).setOrigin(0.5);
    fetch('/lan-ip').then((r) => r.json()).then(({ ip, port }) => {
      this.address.setText(`Phones: open  http://${ip}:${port}/controller  on the same WiFi`);
    }).catch(() => {
      this.address.setText('Phones: open http://<this computer\'s IP>:5173/controller on the same WiFi');
    });

    // Six seats. Default: keyboard in the first two, empty everywhere else.
    this.seats = [
      { type: 'keyboard', boundSlot: null },
      { type: 'keyboard', boundSlot: null },
      { type: 'empty', boundSlot: null },
      { type: 'empty', boundSlot: null },
      { type: 'empty', boundSlot: null },
      { type: 'empty', boundSlot: null },
    ];
    this.cursor = 0;

    const rowY = (i) => 168 + i * 66;
    this.rowBg = [];
    this.seatTexts = [];
    for (let i = 0; i < 6; i++) {
      const bg = this.add.graphics();
      this.rowBg.push({ g: bg, y: rowY(i) });
      const t = this.add.text(W / 2, rowY(i) + 22, '', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#5c7a94',
      }).setOrigin(0.5);
      this.seatTexts.push(t);
    }

    this.refresh();
    this.unsub = phoneNet.onChange(() => { this.reconcileBindings(); this.refresh(); });
    this.events.once('shutdown', () => this.unsub?.());

    this.hint = this.add.text(W / 2, H - 66, 'W/S — select seat   ·   A/D — change type', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '19px', color: '#5c7a94',
    }).setOrigin(0.5);
    this.hint2 = this.add.text(W / 2, H - 34, 'Press ENTER when everyone has joined  ·  Esc to back out', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#4ad6ff',
    }).setOrigin(0.5);

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
    kb.on('keydown-ESC', () => this.scene.start('Title'));
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
    seat.boundSlot = null; // any previous phone binding is released
    sfx('menuMove');
    this.reconcileBindings();
    this.refresh();
  }

  // Matches connected phones to "controller" seats, stably: a seat that's
  // already bound to a still-connected phone keeps that phone. Only newly
  // freed/newly connected phones get (re)assigned, to the lowest-index
  // unbound controller seat.
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
      return { text: `P${n}  —  Keyboard  (${keys})`, color: '#4ad6ff' };
    }
    if (seat.type === 'bot') {
      return { text: `P${n}  —  CPU Bot`, color: '#4a9fff' };
    }
    if (seat.type === 'controller') {
      return seat.boundSlot != null
        ? { text: `P${n}  —  ${phoneNet.nameOf(seat.boundSlot)}  (Controller)`, color: '#4ad6ff' }
        : { text: `P${n}  —  Controller  (waiting for a phone…)`, color: '#5c7a94' };
    }
    return { text: `P${n}  —  Empty`, color: '#3a4a5c' };
  }

  refresh() {
    this.seats.forEach((seat, i) => {
      const { text, color } = this.describeSeat(seat, i);
      const selected = i === this.cursor;
      this.seatTexts[i].setText((selected ? '▶  ' : '     ') + text).setColor(selected ? '#eaf9ff' : color);

      const { g, y } = this.rowBg[i];
      g.clear();
      const x0 = W / 2 - 340;
      const w0 = 680;
      g.fillStyle(0xffffff, selected ? 0.045 : 0.02);
      g.fillRoundedRect(x0, y, w0, 52, 10);
      g.lineStyle(1.5, selected ? 0x4ad6ff : 0x2a5a78, selected ? 0.8 : 0.3);
      g.strokeRoundedRect(x0, y, w0, 52, 10);
    });
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
    this.scene.start('CharacterSelect', { playerSeeds });
  }
}
