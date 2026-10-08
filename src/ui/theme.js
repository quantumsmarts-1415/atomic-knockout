import * as Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Reactor Orbit — the menu/HUD system Benjamin picked (direction C).
// Void ground, ion pink + electron teal orbits, a gold nucleus, mist type.
// Does not recolor character rigs, attack VFX, or stage terrain.
// ---------------------------------------------------------------------------

export const THEME = {
  void: 0x07060e,
  pink: 0xff4fa3,
  teal: 0x3ef0e0,
  gold: 0xf0c14a,
  mist: 0xe8f6ff,
  dim: 0x9a91b0,
  // Seat/shell fills are intentionally lighter than the void so the pills
  // read as panels. Text on them stays mist-white (contrast stays high).
  shell: 0x53468a,
  shellHover: 0x6254a4,
  shellOn: 0x6b5cb0,
  shellEmpty: 0x463d78,
  shellIdleFill: 0x2a2444,
  voidCss: '#07060E',
  pinkCss: '#FF4FA3',
  tealCss: '#3EF0E0',
  goldCss: '#F0C14A',
  mistCss: '#E8F6FF',
  dimCss: '#9A91B0',
  disabledCss: '#8E88A0',
};

// Six player identity colors. Chrome uses the reactor palette; these stay
// on the seat dot, the character-select cursor, and the HUD border.
export const PLAYER_COLORS = [0xff5f4a, 0x4a9fff, 0x53e0a8, 0xffd166, 0xc98bff, 0xff8fc9];

export const FONT_DISPLAY = 'Orbitron, sans-serif';
export const FONT_BODY = 'Sora, sans-serif';
export const FONT_MONO = '"Share Tech Mono", monospace';

// One inset shared by every menu so headers, columns, and footers line up.
export const GRID = {
  margin: 36,
  headerY: 22,
  gutter: 12,
};

const SKY_KEY = 'stage-neon-nexus-layer0';

/**
 * Void field, Neon Nexus sky if it is already loaded, orbital ellipses.
 * The camera clear and the base plate are opaque, so a previous menu cannot
 * show through. The sky is painted on top of that plate, not instead of it.
 */
export function drawMenuBackground(scene, W, H) {
  scene.cameras.main.setBackgroundColor(THEME.voidCss);
  const plate = scene.add.graphics().setDepth(-30);
  plate.fillStyle(THEME.void, 1);
  plate.fillRect(0, 0, W, H);
  if (scene.textures.exists(SKY_KEY)) {
    const img = scene.add.image(W / 2, H / 2, SKY_KEY).setDepth(-20);
    const src = img.texture.getSourceImage();
    const scale = Math.max(W / src.width, H / src.height);
    img.setScale(scale).setAlpha(0.55);
  }
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(THEME.void, scene.textures.exists(SKY_KEY) ? 0.62 : 1);
  g.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H * 0.5;
  g.fillStyle(THEME.gold, 0.05);
  g.fillCircle(cx, cy, 180);
  g.fillStyle(THEME.pink, 0.04);
  g.fillCircle(cx - W * 0.28, cy + 40, 140);
  g.fillStyle(THEME.teal, 0.04);
  g.fillCircle(cx + W * 0.28, cy + 30, 130);
  g.lineStyle(1.5, THEME.teal, 0.35);
  g.strokeEllipse(cx, cy, 420, 150);
  g.lineStyle(1.25, THEME.pink, 0.28);
  g.strokeEllipse(cx, cy + 8, 620, 210);
  g.lineStyle(1, THEME.gold, 0.45);
  g.strokeCircle(cx, cy, 92);
  return g;
}

/**
 * Pill / circular-shell chrome.
 * state: 'idle' | 'hover' | 'selected' | 'disabled' | 'empty'
 * Selected is a filled shell plus a pink glow and a teal stroke.
 * Hover fills the shell without the glow. Disabled is an outline only.
 */
export function paintPill(g, x, y, w, h, state = 'idle') {
  const radius = h / 2;
  const spec = {
    idle: { fill: THEME.shell, fillA: 0.92, line: THEME.mist, lineA: 0.55, lw: 1.5 },
    hover: { fill: THEME.shellHover, fillA: 1, line: THEME.mist, lineA: 0.95, lw: 2 },
    selected: { fill: THEME.shellOn, fillA: 1, line: THEME.teal, lineA: 1, lw: 2.5, glow: true },
    disabled: { fill: THEME.void, fillA: 0.2, line: THEME.dim, lineA: 0.55, lw: 1.5 },
    empty: { fill: THEME.shellEmpty, fillA: 0.95, line: THEME.mist, lineA: 0.7, lw: 2 },
  }[state] ?? { fill: THEME.shell, fillA: 1, line: THEME.mist, lineA: 0.5, lw: 1.5 };

  if (spec.glow) {
    g.lineStyle(7, THEME.pink, 0.35);
    g.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, radius + 3);
  }
  if (state !== 'disabled') {
    g.fillStyle(spec.fill, spec.fillA);
    g.fillRoundedRect(x, y, w, h, radius);
  }
  g.lineStyle(spec.lw, spec.line, spec.lineA);
  g.strokeRoundedRect(x, y, w, h, radius);
}

/** Rounded content panel (stage preview, pause, results). */
export function drawPanel(scene, x, y, w, h, radius = 22, borderColor = THEME.teal, borderAlpha = 0.75) {
  const g = scene.add.graphics();
  g.fillStyle(THEME.shellIdleFill, 0.82);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2, borderColor, borderAlpha);
  g.strokeRoundedRect(x, y, w, h, radius);
  g.lineStyle(1, THEME.gold, 0.35);
  g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, Math.max(8, radius - 8));
  return g;
}

export function textStyle(role, overrides = {}) {
  const base = {
    display: { fontFamily: FONT_DISPLAY, color: THEME.mistCss, fontStyle: 'normal' },
    body: { fontFamily: FONT_BODY, color: THEME.mistCss },
    mono: { fontFamily: FONT_MONO, color: THEME.tealCss },
    dim: { fontFamily: FONT_BODY, color: THEME.dimCss },
  }[role] ?? { fontFamily: FONT_BODY, color: THEME.mistCss };
  return { ...base, ...overrides };
}
