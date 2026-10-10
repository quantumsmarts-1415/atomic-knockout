import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUTTON, DEADZONE, STANDARD_MAP, applyDeadzone, drawPadIcon, identifyPad, mapPad,
  menuButtons, pollGamepads, readGamepads, rumble, syncPadSeats, toFighterInput,
} from '../src/engine/gamepad.js';

function buttons(down) {
  return Array.from({ length: 16 }, (_, i) => ({ pressed: !!down[i], value: down[i] ? 1 : 0 }));
}

function fakePad({ index = 0, id, down = {}, axes = [0, 0, 0, 0], mapping = 'standard', extra = {} }) {
  return { index, id, connected: true, mapping, axes, buttons: buttons(down), ...extra };
}

const XBOX = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const PLAYSTATION = 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)';
const DUALSENSE = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
const SWITCH = 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)';
const GENERIC = 'USB Gamepad (Vendor: 0810 Product: e501)';

test('deadzone drops a small tilt and keeps a real push', () => {
  assert.equal(applyDeadzone(0.1), 0);
  assert.equal(applyDeadzone(-DEADZONE + 0.01), 0);
  assert.ok(applyDeadzone(0.5) > 0);
  assert.ok(applyDeadzone(-0.6) < 0);
});

test('ids sort into Xbox, PlayStation, Switch Pro, and generic', () => {
  assert.equal(identifyPad(XBOX).family, 'xbox');
  assert.equal(identifyPad('Controller (Xbox One For Windows)').label, 'Xbox');
  assert.equal(identifyPad(PLAYSTATION).family, 'playstation');
  assert.equal(identifyPad(DUALSENSE).family, 'playstation');
  assert.equal(identifyPad(SWITCH).family, 'switch');
  assert.equal(identifyPad('Nintendo Switch Pro Controller').label, 'Switch Pro');
  assert.equal(identifyPad(GENERIC).family, 'generic');
  assert.equal(identifyPad('HORIPAD').label, 'Controller');
});

test('standard map is the same on Xbox, PlayStation, Switch Pro, and generic', () => {
  const families = [
    ['xbox', XBOX],
    ['playstation', PLAYSTATION],
    ['playstation', DUALSENSE],
    ['switch', SWITCH],
    ['generic', GENERIC],
  ];
  for (const [family, id] of families) {
    const pad = fakePad({
      id,
      down: {
        [BUTTON.jump]: true,
        [BUTTON.attack]: true,
        [BUTTON.special]: true,
        [BUTTON.shoulderL]: true,
        [BUTTON.start]: true,
        [BUTTON.left]: true,
      },
      axes: [0.04, -0.9, 0, 0],
    });
    const mapped = mapPad(pad);
    assert.equal(identifyPad(id).family, family);
    assert.equal(mapped.jump, true);
    assert.equal(mapped.attack, true);
    assert.equal(mapped.confirm, true);
    assert.equal(mapped.special, true);
    assert.equal(mapped.back, true);
    assert.equal(mapped.shield, true);
    assert.equal(mapped.pause, true);
    assert.equal(mapped.left, true);
    assert.equal(mapped.up, true);
    const fight = toFighterInput(mapped);
    assert.equal(fight.attack, true);
    assert.equal(fight.special, true);
    assert.equal(fight.shield, undefined);
    assert.equal(STANDARD_MAP.pause.includes('Start'), true);
  }
});

test('stick inside the deadzone does not move, and shoulder is not an attack', () => {
  const mapped = mapPad(fakePad({
    id: GENERIC,
    down: { [BUTTON.shoulderR]: true },
    axes: [0.12, 0.1, 0.8, -0.8],
  }));
  assert.equal(mapped.left, false);
  assert.equal(mapped.right, false);
  assert.equal(mapped.up, false);
  assert.equal(mapped.down, false);
  assert.equal(mapped.jump, false);
  assert.equal(mapped.attack, false);
  assert.equal(mapped.special, false);
  assert.equal(mapped.shield, true);
  const menu = menuButtons(mapped);
  assert.equal(menu.confirm, false);
  assert.equal(menu.up, false);
});

test('mocked navigator.getGamepads lists a pad that connects mid-session', () => {
  const pads = [];
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    enumerable: true,
    value: { getGamepads: () => pads },
  });
  try {
    assert.deepEqual(readGamepads().map((pad) => pad.id), []);
    pads.push(fakePad({ index: 0, id: XBOX }));
    const found = readGamepads();
    assert.equal(found.length, 1);
    assert.equal(found[0].family, 'xbox');
    assert.equal(found[0].slot, 20);
    assert.equal(found[0].pressed, false);
    pads.push(fakePad({ index: 1, id: SWITCH, down: { [BUTTON.attack]: true } }));
    const both = pollGamepads();
    assert.deepEqual(both.map((pad) => pad.family), ['xbox', 'switch']);
    assert.equal(both[1].input.attack, true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', prev);
  }
});

test('a button press claims the next empty seat and unplugging releases it', () => {
  const seats = [
    { type: 'keyboard', boundSlot: null, padIndex: null },
    { type: 'keyboard', boundSlot: null, padIndex: null },
    { type: 'empty', boundSlot: null, padIndex: null },
    { type: 'empty', boundSlot: null, padIndex: null },
  ];
  const idle = readGamepads(() => [fakePad({ index: 0, id: PLAYSTATION })]);
  const waiting = syncPadSeats(seats, idle, {});
  assert.equal(waiting.seats[2].type, 'empty');

  const pressed = readGamepads(() => [fakePad({ index: 0, id: PLAYSTATION, down: { [BUTTON.jump]: true } })]);
  const claimed = syncPadSeats(waiting.seats, pressed, waiting.prevDown);
  assert.equal(claimed.seats[2].type, 'gamepad');
  assert.equal(claimed.seats[2].padIndex, 0);
  assert.equal(claimed.seats[2].boundSlot, 20);
  assert.equal(claimed.seats[0].type, 'keyboard');

  const held = syncPadSeats(claimed.seats, pressed, claimed.prevDown);
  assert.equal(held.seats[3].type, 'empty');

  const gone = syncPadSeats(held.seats, [], held.prevDown);
  assert.equal(gone.seats[2].type, 'empty');
  assert.equal(gone.seats[2].boundSlot, null);
});

test('rumble uses dual-rumble when the pad supports it and skips pads that do not', () => {
  const calls = [];
  const dual = fakePad({
    id: XBOX,
    extra: {
      vibrationActuator: {
        playEffect(type, params) {
          calls.push({ type, params });
          return Promise.resolve();
        },
      },
    },
  });
  assert.equal(rumble(dual, { duration: 120, strong: 0.8, weak: 0.3 }), true);
  assert.equal(calls[0].type, 'dual-rumble');
  assert.equal(calls[0].params.strongMagnitude, 0.8);
  assert.equal(calls[0].params.duration, 120);

  const pulsed = [];
  const firefox = fakePad({
    id: SWITCH,
    extra: { hapticActuators: [{ pulse(value, duration) { pulsed.push({ value, duration }); } }] },
  });
  assert.equal(rumble(firefox, { duration: 80, strong: 0.5, weak: 0.2 }), true);
  assert.equal(pulsed[0].duration, 80);
  assert.equal(rumble(fakePad({ id: GENERIC })), false);
  assert.equal(rumble(null), false);
});

test('the setup icon draws into the seat graphic', () => {
  const ops = [];
  const g = {
    fillStyle(color) { ops.push(['fill', color]); },
    fillRoundedRect() { ops.push('rect'); },
    fillCircle() { ops.push('circle'); },
  };
  drawPadIcon(g, 10, 20, 0xff5f4a);
  assert.equal(ops[0][1], 0xff5f4a);
  assert.ok(ops.includes('rect'));
});
