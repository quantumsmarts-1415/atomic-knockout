import { play as sfx, setVolume } from '../engine/sfx.js';
import {
  FONT_DISPLAY, FONT_MONO, MOTION, THEME, drawFooterHints, drawPanel, paintPill, textStyle,
} from './theme.js';

// ---------------------------------------------------------------------------
// Settings overlay, shared by the title screen and the pause menu. Two rows
// today — screen shake and sound — each a segmented control. Values persist
// in localStorage under the keys the engine already reads (ak-shake,
// ak-master).
// ---------------------------------------------------------------------------

const SHAKE = [
  { id: 'full', label: 'Full' },
  { id: 'reduced', label: 'Reduced' },
  { id: 'off', label: 'Off' },
];
const SOUND = [
  { id: '0', label: 'Off' },
  { id: '0.35', label: 'Low' },
  { id: '0.65', label: 'Medium' },
  { id: '0.9', label: 'Full' },
];

function read(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function shakeMode() {
  return read('ak-shake', 'full');
}

export function cycleShake() {
  const cur = shakeMode();
  const i = SHAKE.findIndex((s) => s.id === cur);
  const next = SHAKE[(i + 1) % SHAKE.length].id;
  write('ak-shake', next);
  return next;
}

export function shakeLabel(mode = shakeMode()) {
  return SHAKE.find((s) => s.id === mode)?.label ?? 'Full';
}

/**
 * Open the overlay on `scene`. Keyboard: W/S or arrows pick a row, A/D or
 * arrows change the value, Esc / Enter / Backspace close. Returns a handle
 * with close(). Calls onClose when dismissed.
 */
export function openSettings(scene, { onClose, depth = 40 } = {}) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const PW = 560;
  const PH = 300;
  const px = (W - PW) / 2;
  const py = (H - PH) / 2 - 10;
  const objs = [];
  const add = (o) => { objs.push(o); return o; };

  add(scene.add.rectangle(W / 2, H / 2, W, H, THEME.void, 0.72).setDepth(depth).setInteractive());
  add(drawPanel(scene, px, py, PW, PH, 18).setDepth(depth + 1));
  add(scene.add.text(px + 32, py + 26, 'SETTINGS', textStyle('kicker')).setDepth(depth + 2));
  add(scene.add.text(px + 32, py + 44, 'OPTIONS', textStyle('h2')).setDepth(depth + 2));

  const rows = [
    {
      label: 'Screen shake', options: SHAKE, key: 'ak-shake',
      get: () => shakeMode(),
      set: (id) => write('ak-shake', id),
    },
    {
      label: 'Sound', options: SOUND, key: 'ak-master',
      get: () => {
        const v = Number(read('ak-master', '0.9'));
        return SOUND.reduce((best, o) => (Math.abs(Number(o.id) - v) < Math.abs(Number(best.id) - v) ? o : best), SOUND[0]).id;
      },
      set: (id) => setVolume('master', Number(id)),
    },
  ];
  let cursor = 0;
  const ROW_Y = py + 104;
  const ROW_H = 64;
  const SEG_X = px + 236;
  const SEG_W = PW - 236 - 32;
  const rowGfx = rows.map(() => add(scene.add.graphics().setDepth(depth + 2)));
  const labels = rows.map((r, i) => add(scene.add.text(px + 32, ROW_Y + i * ROW_H + 22, r.label, textStyle('body')).setOrigin(0, 0.5).setDepth(depth + 3)));
  const segTexts = rows.map((r, i) => r.options.map((o, j) => {
    const segW = SEG_W / r.options.length;
    return add(scene.add.text(SEG_X + segW * (j + 0.5), ROW_Y + i * ROW_H + 22, o.label.toUpperCase(), {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.dimCss, letterSpacing: 1,
    }).setOrigin(0.5).setDepth(depth + 3));
  }));
  const zones = [];
  rows.forEach((r, i) => r.options.forEach((o, j) => {
    const segW = SEG_W / r.options.length;
    const z = add(scene.add.zone(SEG_X + segW * j, ROW_Y + i * ROW_H, segW, 44).setOrigin(0, 0).setDepth(depth + 4).setInteractive({ useHandCursor: true }));
    z.on('pointerover', () => { cursor = i; paint(); });
    z.on('pointerdown', () => { cursor = i; r.set(o.id); sfx('menuMove'); paint(); });
    zones.push(z);
  }));

  function paint() {
    rows.forEach((r, i) => {
      const g = rowGfx[i];
      g.clear();
      const y = ROW_Y + i * ROW_H;
      const active = i === cursor;
      g.fillStyle(active ? THEME.inkHi : THEME.ink, active ? 0.9 : 0.5);
      g.fillRoundedRect(px + 20, y, PW - 40, 44, 10);
      if (active) {
        g.lineStyle(1.25, THEME.teal, 0.8);
        g.strokeRoundedRect(px + 20, y, PW - 40, 44, 10);
      }
      const cur = r.get();
      const segW = SEG_W / r.options.length;
      r.options.forEach((o, j) => {
        const on = o.id === cur;
        if (on) paintPill(g, SEG_X + segW * j + 3, y + 7, segW - 6, 30, active ? 'selected' : 'idle', 8);
        segTexts[i][j].setColor(on ? THEME.mistCss : THEME.dimCss);
      });
      labels[i].setColor(active ? THEME.mistCss : THEME.dimCss);
    });
  }

  const hints = drawFooterHints(scene, [
    { keys: ['W', 'S'], label: 'Row' },
    { keys: ['A', 'D'], label: 'Change' },
    { key: 'ESC', label: 'Done' },
  ], { y: py + PH - 30, depth: depth + 3 });
  objs.push(hints.sep, ...hints.items.flatMap((it) => [...it.chips, it.label]));

  const move = (d) => { cursor = (cursor + d + rows.length) % rows.length; sfx('menuMove'); paint(); };
  const change = (d) => {
    const r = rows[cursor];
    const i = r.options.findIndex((o) => o.id === r.get());
    r.set(r.options[(i + d + r.options.length) % r.options.length].id);
    sfx('menuMove');
    paint();
  };
  const kb = scene.input.keyboard;
  const handlers = {
    'keydown-UP': () => move(-1), 'keydown-W': () => move(-1),
    'keydown-DOWN': () => move(1), 'keydown-S': () => move(1),
    'keydown-LEFT': () => change(-1), 'keydown-A': () => change(-1),
    'keydown-RIGHT': () => change(1), 'keydown-D': () => change(1),
    'keydown-ESC': () => close(), 'keydown-ENTER': () => close(), 'keydown-BACKSPACE': () => close(),
    'keydown-G': () => close(), 'keydown-L': () => close(),
  };
  for (const [ev, fn] of Object.entries(handlers)) kb.on(ev, fn);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    for (const [ev, fn] of Object.entries(handlers)) kb.off(ev, fn);
    sfx('menuConfirm');
    scene.tweens.add({
      targets: objs, alpha: 0, duration: MOTION.quick, ease: MOTION.easeIn,
      onComplete: () => { objs.forEach((o) => o.destroy()); onClose?.(); },
    });
  }

  paint();
  objs.forEach((o) => { o.alpha = 0; });
  scene.tweens.add({ targets: objs, alpha: 1, duration: MOTION.base, ease: MOTION.easeOut });
  return { close };
}
