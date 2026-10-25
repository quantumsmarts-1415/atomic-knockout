// ---------------------------------------------------------------------------
// PhoneNet — the game side of the Phase 3 phone-controller link. Connects to
// server.js's WebSocket relay as the "host", tracks which phone slots (2-5)
// are currently connected, their display names, and their latest input
// state. A single instance is created below and shared by every scene that
// needs it (module caching makes this a plain singleton with no build step).
//
// Slots 0 and 1 are always the two local keyboard players and never appear
// here — this class only ever knows about slots 2 through 5 (phones).
// ---------------------------------------------------------------------------
const EMPTY_INPUT = { left: false, right: false, up: false, down: false, confirm: false, back: false, ax: 0, ay: 0 };

class PhoneNet {
  constructor() {
    this.slots = new Set();
    this.names = new Map();
    this.inputBySlot = new Map();
    this.listeners = new Set();
    this._connect();
  }

  _connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws?role=host`);
    this.ws.addEventListener('message', (ev) => this._handle(JSON.parse(ev.data)));
    this.ws.addEventListener('close', () => {
      this.slots = new Set();
      this.inputBySlot.clear();
      this._emit();
      setTimeout(() => this._connect(), 1500);
    });
  }

  _handle(msg) {
    if (msg.type === 'roster') {
      this.slots = new Set(msg.controllers.map((c) => c.slot));
      this.names = new Map(msg.controllers.map((c) => [c.slot, c.name]));
      for (const slot of [...this.inputBySlot.keys()]) {
        if (!this.slots.has(slot)) this.inputBySlot.delete(slot);
      }
    } else if (msg.type === 'input') {
      this.inputBySlot.set(msg.slot, {
        left: !!msg.left, right: !!msg.right, up: !!msg.up, down: !!msg.down,
        confirm: !!msg.confirm, back: !!msg.back,
        ax: Number.isFinite(msg.ax) ? msg.ax : 0, ay: Number.isFinite(msg.ay) ? msg.ay : 0,
      });
    }
    this._emit();
  }

  _emit() {
    for (const cb of this.listeners) cb();
  }

  /** cb() fires on any join/leave/input change. Returns an unsubscribe fn. */
  onChange(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  hasSlot(slot) {
    return this.slots.has(slot);
  }

  nameOf(slot) {
    return this.names.get(slot) ?? `P${slot + 1}`;
  }

  /** Latest {left,right,up,down,confirm,back} for a phone slot, or an all-false state if it's not connected. */
  getInput(slot) {
    return this.inputBySlot.get(slot) ?? EMPTY_INPUT;
  }

  /** Connected phone slots (2-5), sorted ascending. */
  get connectedSlots() {
    return [...this.slots].sort((a, b) => a - b);
  }
}

export const phoneNet = new PhoneNet();
