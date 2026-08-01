import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { phoneNet } from '../net/PhoneNet.js';
import { botSlots } from '../net/BotSlots.js';

// ---------------------------------------------------------------------------
// PlayerJoinScene — the Phase 3 lobby. P1/P2 are always available on the
// keyboard; up to 4 phones can join over local WiFi as P3-P6 before the host
// (whoever's at the keyboard) presses Enter to move on to Character Select.
// Empty seats can also be filled with a basic CPU bot (Phase 8's "stand-in
// for a human player" pulled forward) so a match can be tested without
// needing that many real phones.
// ---------------------------------------------------------------------------
export default class PlayerJoinScene extends Phaser.Scene {
  constructor() {
    super('PlayerJoin');
  }

  create() {
    // Bot slots don't survive a full game restart cleanly (no fighters exist
    // yet to attach `_ai` state to), and stale bots from a previous match
    // would just confuse a fresh lobby -- start clean every time this scene
    // is entered from Title.
    botSlots.clear();

    this.drawBackground();

    this.add.text(W / 2, 56, 'PLAYER LOBBY', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '46px', color: '#ffffff',
      stroke: '#1c2b4a', strokeThickness: 10,
    }).setOrigin(0.5);

    this.address = this.add.text(W / 2, 116, 'Fetching network address…', {
      fontFamily: 'Arial, sans-serif', fontSize: '19px', color: '#9fc4e8',
    }).setOrigin(0.5);
    fetch('/lan-ip').then((r) => r.json()).then(({ ip, port }) => {
      this.address.setText(`Phones: open  http://${ip}:${port}/controller  on the same WiFi`);
    }).catch(() => {
      this.address.setText('Phones: open http://<this computer\'s IP>:5173/controller on the same WiFi');
    });

    const rowY = (i) => 190 + i * 62;
    this.add.text(W / 2, rowY(0), 'P1 — Keyboard (WASD + F/G) — READY', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#53e0a8',
    }).setOrigin(0.5);
    this.add.text(W / 2, rowY(1), 'P2 — Keyboard (Arrows + K/L) — READY', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#53e0a8',
    }).setOrigin(0.5);

    this.slotTexts = {};
    for (let slot = 2; slot <= 5; slot++) {
      this.slotTexts[slot] = this.add.text(W / 2, rowY(slot), '', {
        fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#5a6a85',
      }).setOrigin(0.5);
    }
    this.refreshSlots();
    this.unsub = phoneNet.onChange(() => { sfx('menuMove'); this.reconcileAndRefresh(); });
    this.events.once('shutdown', () => this.unsub?.());

    this.hint = this.add.text(W / 2, H - 66, 'B — add CPU bot   ·   X — remove last bot', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '19px', color: '#9fc4e8',
    }).setOrigin(0.5);
    this.hint2 = this.add.text(W / 2, H - 34, 'Press ENTER when everyone has joined  ·  Esc to back out', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '22px', color: '#ffd166',
    }).setOrigin(0.5);

    const start = () => { sfx('menuConfirm'); this.scene.start('CharacterSelect'); };
    this.input.keyboard.on('keydown-ENTER', start);
    this.input.keyboard.on('keydown-F', start);
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Title'));

    this.input.keyboard.on('keydown-B', () => {
      const taken = new Set(phoneNet.connectedSlots);
      const slot = botSlots.add(taken);
      sfx(slot != null ? 'menuConfirm' : 'menuMove');
      this.refreshSlots();
    });
    this.input.keyboard.on('keydown-X', () => {
      const removed = botSlots.removeLast();
      if (removed != null) sfx('menuMove');
      this.refreshSlots();
    });
  }

  // A phone can connect to a slot number a bot already occupies (the server
  // assigning phone slots has no idea bots exist client-side) -- the phone
  // always wins that collision, and the bot is dropped rather than left to
  // silently fight over the same fighter.
  reconcileAndRefresh() {
    for (const slot of phoneNet.connectedSlots) {
      if (botSlots.hasSlot(slot)) botSlots.remove(slot);
    }
    this.refreshSlots();
  }

  refreshSlots() {
    for (let slot = 2; slot <= 5; slot++) {
      const t = this.slotTexts[slot];
      if (phoneNet.hasSlot(slot)) {
        t.setText(`P${slot + 1} — ${phoneNet.nameOf(slot)} (phone) — READY`).setColor('#53e0a8');
      } else if (botSlots.hasSlot(slot)) {
        t.setText(`P${slot + 1} — CPU bot — READY`).setColor('#4a9fff');
      } else {
        t.setText(`P${slot + 1} — waiting for a phone to join…`).setColor('#5a6a85');
      }
    }
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
}
