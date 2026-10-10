// Browser Gamepad API. Xbox, PlayStation, Switch Pro, and generic pads all
// use the W3C standard mapping (gamepad.mapping === 'standard' in Chromium
// and Firefox). Bluetooth and USB show up the same way: the browser lists
// them from navigator.getGamepads(), including a pad plugged in mid-session.
//
// Slots 0/1 are keyboards, 2–5 are phones, 100+ are bots. A pad takes
// 20 + its Gamepad.index so those ranges never collide.

export const DEADZONE = 0.18;
export const GAMEPAD_SLOT_BASE = 20;

// Standard Gamepad buttons. Switch Pro pads report this same order, so the
// bottom face button is jump even though that cap is labeled B.
export const BUTTON = {
  jump: 0, // A / Cross / Switch bottom
  special: 1, // B / Circle / Switch right
  attack: 2, // X / Square / Switch left
  shoulderL: 4, // LB / L1
  shoulderR: 5, // RB / R1
  start: 9, // Start / Options / Plus
  up: 12,
  down: 13,
  left: 14,
  right: 15,
};

export const STANDARD_MAP = {
  move: 'Left stick and d-pad',
  jump: 'A / Cross (button 0). Stick up and d-pad up jump too, matching the keyboard up key.',
  attack: 'X / Square (button 2). Tap with a direction for normal, hold for charge.',
  special: 'B / Circle (button 1). Direction fires the special; holding it with no direction is defense.',
  shield: 'LB / L1 and RB / R1 (buttons 4 and 5). There is no separate shield or dodge, so these are read and do not fire a move.',
  pause: 'Start / Options (button 9)',
};

const CLAIM_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15];

let snapshot = [];

export function isGamepadSlot(slot) {
  return typeof slot === 'number' && slot >= GAMEPAD_SLOT_BASE && slot < 100;
}

export function slotForPad(index) {
  return GAMEPAD_SLOT_BASE + index;
}

export function applyDeadzone(value, deadzone = DEADZONE) {
  const v = Number(value) || 0;
  if (Math.abs(v) < deadzone) return 0;
  const sign = Math.sign(v);
  return sign * (Math.abs(v) - deadzone) / (1 - deadzone);
}

export function identifyPad(id = '') {
  const s = String(id).toLowerCase();
  if (/xbox|x-box|xinput|045e/.test(s)) return { family: 'xbox', label: 'Xbox' };
  if (/playstation|dualshock|dualsense|054c|sony/.test(s)) return { family: 'playstation', label: 'PlayStation' };
  if (/wireless controller/.test(s)) return { family: 'playstation', label: 'PlayStation' };
  if (/switch|pro controller|nintendo|057e/.test(s)) return { family: 'switch', label: 'Switch Pro' };
  return { family: 'generic', label: 'Controller' };
}

export function buttonDown(pad, index) {
  const button = pad?.buttons?.[index];
  if (!button) return false;
  return !!(button.pressed || button.value > 0.5);
}

export function padPressedButton(pad) {
  return CLAIM_BUTTONS.some((index) => buttonDown(pad, index));
}

/** Digital actions for one standard pad. Stick axes inside the deadzone stay off. */
export function mapPad(pad, deadzone = DEADZONE) {
  const lx = applyDeadzone(pad?.axes?.[0] ?? 0, deadzone);
  const ly = applyDeadzone(pad?.axes?.[1] ?? 0, deadzone);
  const left = lx < 0 || buttonDown(pad, BUTTON.left);
  const right = lx > 0 || buttonDown(pad, BUTTON.right);
  const up = ly < 0 || buttonDown(pad, BUTTON.up);
  const down = ly > 0 || buttonDown(pad, BUTTON.down);
  const attack = buttonDown(pad, BUTTON.attack);
  const special = buttonDown(pad, BUTTON.special);
  return {
    left,
    right,
    up,
    down,
    jump: buttonDown(pad, BUTTON.jump) || up,
    attack,
    special,
    shield: buttonDown(pad, BUTTON.shoulderL) || buttonDown(pad, BUTTON.shoulderR),
    pause: buttonDown(pad, BUTTON.start),
    confirm: attack,
    back: special,
  };
}

export function toFighterInput(mapped) {
  return {
    left: !!mapped.left,
    right: !!mapped.right,
    down: !!mapped.down,
    jump: !!mapped.jump,
    attack: !!mapped.attack,
    special: !!mapped.special,
  };
}

export function menuButtons(mapped) {
  return {
    left: !!mapped.left && !mapped.right,
    right: !!mapped.right && !mapped.left,
    up: !!mapped.jump,
    down: !!mapped.down && !mapped.up,
    confirm: !!mapped.attack,
    back: !!mapped.special,
  };
}

function defaultGetGamepads() {
  const hook = globalThis.__akGetGamepads;
  if (typeof hook === 'function') return hook() || [];
  const nav = globalThis.navigator;
  if (!nav || typeof nav.getGamepads !== 'function') return [];
  try {
    return nav.getGamepads() || [];
  } catch {
    return [];
  }
}

export function readGamepads(getGamepads = defaultGetGamepads) {
  let raw = [];
  try {
    raw = getGamepads() || [];
  } catch {
    raw = [];
  }
  const out = [];
  for (const pad of raw) {
    if (!pad || pad.connected === false) continue;
    const family = identifyPad(pad.id);
    out.push({
      index: pad.index ?? out.length,
      id: pad.id || '',
      family: family.family,
      label: family.label,
      mapping: pad.mapping || '',
      slot: slotForPad(pad.index ?? out.length),
      input: mapPad(pad),
      pressed: padPressedButton(pad),
      device: pad,
    });
  }
  return out;
}

/** Snapshot used by scenes. Call once per frame, then read padBySlot. */
export function pollGamepads(getGamepads) {
  snapshot = readGamepads(getGamepads);
  return snapshot;
}

export function currentPads() {
  return snapshot;
}

export function padBySlot(slot) {
  return snapshot.find((pad) => pad.slot === slot) || null;
}

export function fighterInputForSlot(slot) {
  const pad = padBySlot(slot);
  return pad ? toFighterInput(pad.input) : toFighterInput({});
}

export function menuInputForSlot(slot) {
  const pad = padBySlot(slot);
  return pad ? menuButtons(pad.input) : menuButtons({});
}

/**
 * Hot-plug. A pad that is only connected stays unclaimed. A rising button
 * press takes the first empty seat. Unplugging clears that seat.
 */
export function syncPadSeats(seats, pads, prevDown = {}) {
  const next = seats.map((seat) => ({ ...seat }));
  const present = new Set(pads.map((pad) => pad.index));
  for (const seat of next) {
    if (seat.type === 'gamepad' && !present.has(seat.padIndex)) {
      seat.type = 'empty';
      seat.boundSlot = null;
      seat.padIndex = null;
    }
  }
  const down = {};
  for (const pad of pads) {
    down[pad.index] = pad.pressed;
    const rising = pad.pressed && !prevDown[pad.index];
    const already = next.some((seat) => seat.type === 'gamepad' && seat.padIndex === pad.index);
    if (!rising || already) continue;
    const seat = next.find((item) => item.type === 'empty');
    if (!seat) continue;
    seat.type = 'gamepad';
    seat.padIndex = pad.index;
    seat.boundSlot = slotForPad(pad.index);
  }
  return { seats: next, prevDown: down };
}

export function rumble(pad, opts = {}) {
  if (!pad) return false;
  const duration = opts.duration ?? 150;
  const strong = opts.strong ?? 0.75;
  const weak = opts.weak ?? 0.4;
  const dual = pad.vibrationActuator;
  if (dual && typeof dual.playEffect === 'function') {
    try {
      const pending = dual.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: weak,
        strongMagnitude: strong,
      });
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  const haptic = pad.hapticActuators?.[0];
  if (haptic && typeof haptic.pulse === 'function') {
    try {
      const pending = haptic.pulse(Math.max(strong, weak), duration);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function rumbleSlot(slot, opts) {
  if (!isGamepadSlot(slot)) return false;
  const pad = padBySlot(slot);
  return pad ? rumble(pad.device, opts) : false;
}

/** Small pad glyph, centered at x, y. Color is the player color once claimed. */
export function drawPadIcon(g, x, y, color, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillRoundedRect(x - 15, y - 9, 30, 18, 6);
  g.fillStyle(0x07060e, 0.92);
  g.fillRoundedRect(x - 12, y - 6, 24, 12, 4);
  g.fillStyle(color, alpha);
  g.fillCircle(x - 6, y + 1, 2.3);
  g.fillCircle(x + 4, y - 2, 1.7);
  g.fillCircle(x + 8, y + 1.4, 1.7);
}
