// ---------------------------------------------------------------------------
// Reactor Orbit — the one visual identity shared by every menu, the HUD, and
// the match cards. Void ground, ion pink + electron teal orbits, a gold
// nucleus for anything confirmed or won, mist type. Character art, attack
// VFX, and stage terrain are never recolored by this.
//
//   palette    THEME
//   type       TYPE (roles) + FONT_*
//   motion     MOTION (durations + eases every tween pulls from)
//   components drawMenuBackground, drawHeader, drawFooterHints, makeButton,
//              drawPanel, drawCard, keyChip, symbolTile, drawPortraitDisc
// ---------------------------------------------------------------------------

export const THEME = {
  void: 0x07060e,
  ink: 0x120e22,
  inkHi: 0x1b1533,
  pink: 0xff4fa3,
  teal: 0x3ef0e0,
  gold: 0xf0c14a,
  mist: 0xe8f6ff,
  dim: 0x9a91b0,
  faint: 0x5e5678,
  // Shell fills sit a step above the void so panels read as glass, not as
  // bright purple slabs. Text on them stays mist for contrast.
  shell: 0x251d40,
  shellHover: 0x332a56,
  shellOn: 0x463878,
  shellEmpty: 0x17122a,
  shellIdleFill: 0x1b1631,
  voidCss: '#07060E',
  inkCss: '#120E22',
  pinkCss: '#FF4FA3',
  tealCss: '#3EF0E0',
  goldCss: '#F0C14A',
  mistCss: '#E8F6FF',
  dimCss: '#9A91B0',
  faintCss: '#5E5678',
  disabledCss: '#6F6888',
};

// Six player identity colors. Chrome uses the reactor palette; these stay
// on the seat dot, the character-select cursor, and the HUD accent.
export const PLAYER_COLORS = [0xff5f4a, 0x4a9fff, 0x53e0a8, 0xffd166, 0xc98bff, 0xff8fc9];
export const PLAYER_COLORS_CSS = ['#FF5F4A', '#4A9FFF', '#53E0A8', '#FFD166', '#C98BFF', '#FF8FC9'];

export const FONT_DISPLAY = 'Orbitron, sans-serif';
export const FONT_BODY = 'Sora, sans-serif';
export const FONT_MONO = '"Share Tech Mono", monospace';

/** Type roles. Every text object on a menu picks one of these. */
export const TYPE = {
  kicker: { fontFamily: FONT_MONO, fontSize: '12px', color: THEME.tealCss, letterSpacing: 4 },
  h1: { fontFamily: FONT_DISPLAY, fontSize: '34px', color: THEME.mistCss, letterSpacing: 2 },
  h2: { fontFamily: FONT_DISPLAY, fontSize: '22px', color: THEME.mistCss, letterSpacing: 1 },
  h3: { fontFamily: FONT_DISPLAY, fontSize: '16px', color: THEME.mistCss, letterSpacing: 0.5 },
  body: { fontFamily: FONT_BODY, fontSize: '15px', color: THEME.mistCss },
  bodyStrong: { fontFamily: FONT_BODY, fontSize: '15px', color: THEME.mistCss, fontStyle: '600' },
  caption: { fontFamily: FONT_BODY, fontSize: '13px', color: THEME.dimCss },
  label: { fontFamily: FONT_MONO, fontSize: '11px', color: THEME.dimCss, letterSpacing: 2 },
  mono: { fontFamily: FONT_MONO, fontSize: '13px', color: THEME.tealCss, letterSpacing: 1 },
  numeral: { fontFamily: FONT_DISPLAY, fontSize: '28px', color: THEME.mistCss },
};

export function textStyle(role, overrides = {}) {
  return { ...(TYPE[role] ?? TYPE.body), ...overrides };
}

/** Motion vocabulary: one set of durations and eases for every menu. */
export const MOTION = {
  quick: 110,
  base: 190,
  slow: 320,
  sceneFade: 240,
  easeOut: 'Cubic.easeOut',
  easeIn: 'Cubic.easeIn',
  easeInOut: 'Sine.easeInOut',
  pop: 'Back.easeOut',
};

// One inset shared by every menu so headers, columns, and footers line up.
export const GRID = {
  margin: 36,
  headerY: 22,
  footerY: 32,
  gutter: 12,
};

const SKY_KEY = 'stage-neon-nexus-layer0';

/**
 * Void field, Neon Nexus sky if it is already loaded, orbital ellipses with
 * three slow electrons riding them. The camera clear and the base plate are
 * opaque, so a previous menu cannot show through.
 */
export function drawMenuBackground(scene, W, H, { electrons = true } = {}) {
  scene.cameras.main.setBackgroundColor(THEME.voidCss);
  const plate = scene.add.graphics().setDepth(-30);
  plate.fillStyle(THEME.void, 1);
  plate.fillRect(0, 0, W, H);
  if (scene.textures.exists(SKY_KEY)) {
    const img = scene.add.image(W / 2, H / 2, SKY_KEY).setDepth(-20);
    const src = img.texture.getSourceImage();
    const scale = Math.max(W / src.width, H / src.height);
    img.setScale(scale).setAlpha(0.5);
  }
  const g = scene.add.graphics().setDepth(-10);
  g.fillStyle(THEME.void, scene.textures.exists(SKY_KEY) ? 0.7 : 1);
  g.fillRect(0, 0, W, H);
  // vignette: a few concentric translucent rings darken the edges
  for (let i = 0; i < 4; i++) {
    g.fillStyle(THEME.void, 0.12);
    g.fillRect(0, 0, W, 30 + i * 22);
    g.fillRect(0, H - 30 - i * 22, W, 30 + i * 22);
  }
  const cx = W / 2;
  const cy = H * 0.5;
  g.fillStyle(THEME.gold, 0.045);
  g.fillCircle(cx, cy, 190);
  g.fillStyle(THEME.pink, 0.035);
  g.fillCircle(cx - W * 0.28, cy + 40, 150);
  g.fillStyle(THEME.teal, 0.035);
  g.fillCircle(cx + W * 0.28, cy + 30, 140);
  const orbits = [
    { rx: 210, ry: 75, color: THEME.teal, a: 0.32, tilt: -0.18 },
    { rx: 310, ry: 105, color: THEME.pink, a: 0.26, tilt: 0.22 },
    { rx: 420, ry: 140, color: THEME.gold, a: 0.16, tilt: 0.04 },
  ];
  for (const o of orbits) {
    g.lineStyle(1.25, o.color, o.a);
    strokeTiltedEllipse(g, cx, cy + 8, o.rx, o.ry, o.tilt);
  }
  if (electrons && scene.tweens) {
    const dots = orbits.map((o, i) => {
      const d = scene.add.graphics().setDepth(-9);
      d.fillStyle(o.color, 0.9);
      d.fillCircle(0, 0, 2.5);
      d.fillStyle(o.color, 0.25);
      d.fillCircle(0, 0, 6);
      scene.tweens.addCounter({
        from: 0, to: 1, duration: 9000 + i * 3200, repeat: -1,
        onUpdate: (tw) => {
          const t = tw.getValue() * Math.PI * 2 + i * 2.1;
          const ex = Math.cos(t) * o.rx;
          const ey = Math.sin(t) * o.ry;
          d.x = cx + ex * Math.cos(o.tilt) - ey * Math.sin(o.tilt);
          d.y = cy + 8 + ex * Math.sin(o.tilt) + ey * Math.cos(o.tilt);
        },
      });
      return d;
    });
    g.electrons = dots;
  }
  return g;
}

function strokeTiltedEllipse(g, cx, cy, rx, ry, tilt, steps = 96) {
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ex = Math.cos(t) * rx;
    const ey = Math.sin(t) * ry;
    const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
    const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.strokePath();
}

/**
 * Pill / shell chrome.
 * state: 'idle' | 'hover' | 'selected' | 'pressed' | 'disabled' | 'empty' | 'locked'
 * Selected is a filled shell plus a pink glow and a teal stroke. Locked is
 * the gold version of selected. Hover fills the shell without the glow.
 * Disabled is an outline only.
 */
export function paintPill(g, x, y, w, h, state = 'idle', radius = h / 2) {
  const spec = {
    idle: { fill: THEME.shell, fillA: 0.92, line: THEME.mist, lineA: 0.22, lw: 1.25 },
    hover: { fill: THEME.shellHover, fillA: 1, line: THEME.mist, lineA: 0.55, lw: 1.5 },
    selected: { fill: THEME.shellOn, fillA: 1, line: THEME.teal, lineA: 1, lw: 2, glow: THEME.pink },
    pressed: { fill: THEME.shellHover, fillA: 1, line: THEME.teal, lineA: 0.9, lw: 2 },
    locked: { fill: THEME.shellOn, fillA: 1, line: THEME.gold, lineA: 1, lw: 2, glow: THEME.gold },
    disabled: { fill: THEME.ink, fillA: 0.5, line: THEME.dim, lineA: 0.3, lw: 1.25 },
    empty: { fill: THEME.shellEmpty, fillA: 0.9, line: THEME.mist, lineA: 0.16, lw: 1.25, dashed: true },
  }[state] ?? { fill: THEME.shell, fillA: 1, line: THEME.mist, lineA: 0.3, lw: 1.25 };

  if (spec.glow) {
    g.lineStyle(8, spec.glow, 0.18);
    g.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, radius + 3);
    g.lineStyle(3, spec.glow, 0.28);
    g.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, radius + 1);
  }
  g.fillStyle(spec.fill, spec.fillA);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(spec.lw, spec.line, spec.lineA);
  g.strokeRoundedRect(x, y, w, h, radius);
  // top highlight hairline so the shell reads as glass
  if (state !== 'disabled' && state !== 'empty') {
    g.lineStyle(1, 0xffffff, 0.06);
    g.beginPath();
    g.moveTo(x + radius, y + 1);
    g.lineTo(x + w - radius, y + 1);
    g.strokePath();
  }
}

/** Rounded content panel (stage preview, pause, results). */
export function drawPanel(scene, x, y, w, h, radius = 18, borderColor = THEME.teal, borderAlpha = 0.6) {
  const g = scene.add.graphics();
  g.fillStyle(THEME.ink, 0.86);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(1.5, borderColor, borderAlpha);
  g.strokeRoundedRect(x, y, w, h, radius);
  g.lineStyle(1, THEME.mist, 0.08);
  g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(6, radius - 6));
  return g;
}

/**
 * Card: ink glass with an accent edge on the left. Used for seats, result
 * stat cards, and the HUD. `accent` is a player color or THEME.gold.
 */
export function drawCard(g, x, y, w, h, { accent = THEME.teal, state = 'idle', radius = 14, edge = 4 } = {}) {
  const on = state === 'selected' || state === 'locked';
  if (on) {
    g.lineStyle(8, state === 'locked' ? THEME.gold : accent, 0.14);
    g.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, radius + 3);
  }
  g.fillStyle(state === 'hover' ? THEME.inkHi : THEME.ink, state === 'empty' ? 0.6 : 0.9);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(on ? 1.75 : 1.25, on ? (state === 'locked' ? THEME.gold : accent) : THEME.mist, on ? 0.95 : (state === 'hover' ? 0.45 : 0.16));
  g.strokeRoundedRect(x, y, w, h, radius);
  if (state !== 'empty') {
    g.fillStyle(accent, on ? 1 : 0.8);
    g.fillRoundedRect(x, y + radius * 0.6, edge, h - radius * 1.2, edge / 2);
  }
}

/**
 * Screen header: kicker over title. align 'center' puts both on W/2;
 * 'left' hangs them off GRID.margin. Draws a hairline rule under the title
 * with a small gold nucleus dot in the middle.
 */
export function drawHeader(scene, { kicker, title, align = 'center', y = GRID.headerY, width = scene.scale.width, depth = 6 }) {
  const cx = align === 'center' ? width / 2 : GRID.margin;
  const origin = align === 'center' ? 0.5 : 0;
  const parts = {};
  if (kicker) {
    parts.kicker = scene.add.text(cx, y, kicker.toUpperCase(), textStyle('kicker')).setOrigin(origin, 0).setDepth(depth);
  }
  parts.title = scene.add.text(cx, y + (kicker ? 18 : 0), title.toUpperCase(), textStyle('h1')).setOrigin(origin, 0).setDepth(depth);
  const ruleY = parts.title.y + parts.title.height + 8;
  const g = scene.add.graphics().setDepth(depth);
  if (align === 'center') {
    const half = Math.max(120, parts.title.width / 2 + 40);
    g.lineStyle(1, THEME.mist, 0.18);
    g.lineBetween(cx - half, ruleY, cx - 10, ruleY);
    g.lineBetween(cx + 10, ruleY, cx + half, ruleY);
    g.fillStyle(THEME.gold, 1);
    g.fillCircle(cx, ruleY, 2.5);
  } else {
    g.lineStyle(1, THEME.mist, 0.18);
    g.lineBetween(cx, ruleY, cx + Math.max(160, parts.title.width), ruleY);
    g.fillStyle(THEME.gold, 1);
    g.fillCircle(cx, ruleY, 2.5);
  }
  parts.rule = g;
  parts.bottom = ruleY;
  return parts;
}

/**
 * Key chip: a small rounded key cap with mono text, used in footers and
 * on buttons. Returns a container positioned at (x, y) (left, center).
 */
export function keyChip(scene, x, y, key, { color = THEME.mistCss, depth = 6 } = {}) {
  const label = scene.add.text(0, 0, key, { fontFamily: FONT_MONO, fontSize: '11px', color, letterSpacing: 1 }).setOrigin(0.5);
  const w = Math.max(22, label.width + 12);
  const h = 20;
  const g = scene.add.graphics();
  g.fillStyle(THEME.ink, 0.9);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.lineStyle(1, THEME.mist, 0.28);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.lineStyle(1, THEME.mist, 0.1);
  g.lineBetween(-w / 2 + 4, h / 2 - 2, w / 2 - 4, h / 2 - 2);
  const c = scene.add.container(x + w / 2, y, [g, label]).setDepth(depth);
  c.chipWidth = w;
  return c;
}

/**
 * Footer hint bar: [key] label  ·  [key] label … centered at the bottom.
 * hints: [{ key: 'ENTER', label: 'Confirm' }, { keys: ['W','S'], label: 'Seat' }]
 */
export function drawFooterHints(scene, hints, { y = scene.scale.height - GRID.footerY, width = scene.scale.width, depth = 6 } = {}) {
  const items = [];
  let total = 0;
  const GAP = 26;
  for (const hint of hints) {
    const keys = hint.keys ?? [hint.key];
    const chips = keys.map((k) => keyChip(scene, 0, 0, k, { depth }));
    const label = scene.add.text(0, 0, hint.label, textStyle('caption')).setOrigin(0, 0.5).setDepth(depth);
    const w = chips.reduce((s, c) => s + c.chipWidth + 4, 0) + 6 + label.width;
    items.push({ chips, label, w });
    total += w + GAP;
  }
  total -= GAP;
  let x = width / 2 - total / 2;
  const sep = scene.add.graphics().setDepth(depth);
  items.forEach((it, i) => {
    let cx = x;
    for (const c of it.chips) {
      c.x = cx + c.chipWidth / 2;
      c.y = y;
      cx += c.chipWidth + 4;
    }
    it.label.setPosition(cx + 6, y);
    x += it.w + GAP;
    if (i < items.length - 1) {
      sep.fillStyle(THEME.faint, 0.9);
      sep.fillCircle(x - GAP / 2, y, 1.5);
    }
  });
  return { items, sep, setVisible(v) { items.forEach((it) => { it.chips.forEach((c) => c.setVisible(v)); it.label.setVisible(v); }); sep.setVisible(v); } };
}

/**
 * Button: pill chrome + label + optional key chip and note, with hover,
 * press, selected, and disabled states and the shared motion. The scene
 * drives keyboard selection through setSelected(); the pointer handles the
 * rest. Returns a controller.
 */
export function makeButton(scene, {
  x, y, w = 280, h = 48, label, onPress, disabled = false, note = null, keyHint = null, depth = 6, icon = null,
}) {
  const c = scene.add.container(x + w / 2, y + h / 2).setDepth(depth);
  const g = scene.add.graphics();
  const text = scene.add.text(0, 0, label.toUpperCase(), {
    fontFamily: FONT_DISPLAY, fontSize: '15px', color: disabled ? THEME.disabledCss : THEME.mistCss, letterSpacing: 2,
  }).setOrigin(0.5);
  c.add([g, text]);
  let noteText = null;
  if (note) {
    noteText = scene.add.text(w / 2 - 16, 0, note.toUpperCase(), {
      fontFamily: FONT_MONO, fontSize: '9px', color: THEME.dimCss, letterSpacing: 1,
    }).setOrigin(1, 0.5);
    c.add(noteText);
    text.x = -Math.round(noteText.width / 2) - 4;
  }
  let chip = null;
  if (keyHint) {
    chip = keyChip(scene, 0, 0, keyHint, { depth });
    chip.setPosition(-w / 2 + 16 + chip.chipWidth / 2, 0);
    scene.children.remove(chip);
    c.add(chip);
  }
  if (icon) {
    const ic = scene.add.graphics();
    icon(ic);
    ic.setPosition(-w / 2 + 24, 0);
    c.add(ic);
  }
  const ctl = {
    container: c,
    selected: false,
    hovered: false,
    disabled,
    state: 'idle',
    paint() {
      const state = this.disabled ? 'disabled' : this.pressed ? 'pressed' : this.selected ? 'selected' : this.hovered ? 'hover' : 'idle';
      this.state = state;
      g.clear();
      paintPill(g, -w / 2, -h / 2, w, h, state);
      text.setColor(this.disabled ? THEME.disabledCss : THEME.mistCss);
      if (chip) chip.setAlpha(this.disabled ? 0.4 : (this.selected ? 1 : 0.7));
    },
    setSelected(v) {
      if (this.selected === v) return;
      this.selected = v;
      this.paint();
      if (v && !this.disabled) scene.tweens.add({ targets: c, scale: { from: 0.985, to: 1 }, duration: MOTION.base, ease: MOTION.pop });
    },
    setDisabled(v) { this.disabled = v; this.paint(); },
    setLabel(s) { text.setText(String(s).toUpperCase()); },
    setNote(s) { noteText?.setText(String(s ?? '').toUpperCase()); },
    press() {
      if (this.disabled) return;
      this.pressed = true;
      this.paint();
      scene.tweens.add({
        targets: c, scale: 0.965, duration: MOTION.quick, yoyo: true, ease: MOTION.easeOut,
        onComplete: () => { this.pressed = false; this.paint(); },
      });
      onPress?.();
    },
  };
  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setDepth(depth + 1);
  if (!disabled) zone.setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => { ctl.hovered = true; ctl.paint(); ctl.onHover?.(); });
  zone.on('pointerout', () => { ctl.hovered = false; ctl.paint(); });
  zone.on('pointerdown', () => ctl.press());
  ctl.zone = zone;
  ctl.paint();
  return ctl;
}

/**
 * Periodic tile badge: number top-left, symbol centered. Used wherever a
 * fighter needs a mark but no portrait is safe to show.
 */
export function symbolTile(scene, x, y, size, { n, sym, color = THEME.shellOn, depth = 6 } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRoundedRect(-size / 2, -size / 2, size, size, Math.max(4, size * 0.16));
  g.fillStyle(0x000000, 0.22);
  g.fillRoundedRect(-size / 2, 0, size, size / 2, { tl: 0, tr: 0, bl: Math.max(4, size * 0.16), br: Math.max(4, size * 0.16) });
  g.lineStyle(1.25, THEME.mist, 0.35);
  g.strokeRoundedRect(-size / 2, -size / 2, size, size, Math.max(4, size * 0.16));
  const num = scene.add.text(-size / 2 + size * 0.1, -size / 2 + size * 0.06, String(n ?? ''), {
    fontFamily: FONT_MONO, fontSize: `${Math.max(8, Math.round(size * 0.17))}px`, color: THEME.goldCss,
  });
  const symbol = scene.add.text(0, size * 0.08, sym ?? '', {
    fontFamily: FONT_DISPLAY, fontSize: `${Math.round(size * 0.38)}px`, color: THEME.mistCss,
  }).setOrigin(0.5);
  return scene.add.container(x, y, [g, num, symbol]).setDepth(depth);
}

/**
 * Round portrait. A face square (`portrait-<id>`) fills the disc. A full
 * cut still uses its head crop. Missing art falls back to the symbol tile.
 * `ring` is the accent color.
 */
export function drawPortraitDisc(scene, x, y, d, { textureKey, n, sym, ring = THEME.teal, fill = THEME.shellOn, depth = 6, headBias = 0.03, crop = null } = {}) {
  const c = scene.add.container(x, y).setDepth(depth);
  const back = scene.add.graphics();
  back.fillStyle(fill, 1);
  back.fillCircle(0, 0, d / 2);
  back.fillStyle(0x000000, 0.25);
  back.fillCircle(0, d * 0.1, d / 2);
  c.add(back);
  if (textureKey && scene.textures.exists(textureKey)) {
    const img = scene.add.image(0, 0, textureKey);
    const src = img.texture.getSourceImage();
    // The face PNG is already centered. Filling the disc with the old
    // cut crop would punch past the face.
    if (textureKey.startsWith('portrait-')) {
      img.setOrigin(0.5, 0.5);
      img.setDisplaySize(d, d);
    } else if (crop?.zoom) {
      const zoom = crop.zoom > 0 ? crop.zoom : 5.2;
      const scale = (d * zoom) / Math.max(1, src.height);
      const cx = crop.cx ?? 0.5;
      const cy = crop.cy ?? 0.14;
      img.setOrigin(0.5, 0.5).setScale(scale);
      img.x = -(cx - 0.5) * src.width * scale;
      img.y = -(cy - 0.5) * src.height * scale;
    } else {
      const scale = (d * 5.2) / src.height;
      img.setOrigin(0.5, 0).setScale(scale);
      img.y = -d / 2 - src.height * scale * headBias;
    }
    const mask = scene.make.graphics({ x: 0, y: 0, add: false });
    mask.fillStyle(0xffffff, 1);
    mask.fillCircle(x, y, d / 2 - 1);
    img.setMask(mask.createGeometryMask());
    c.add(img);
    c.portrait = img;
    c.portraitMask = mask;
  } else {
    const tile = symbolTile(scene, 0, 0, d * 0.62, { n, sym, color: fill, depth });
    scene.children.remove(tile);
    c.add(tile);
  }
  const rim = scene.add.graphics();
  rim.lineStyle(2, ring, 1);
  rim.strokeCircle(0, 0, d / 2);
  rim.lineStyle(1, 0xffffff, 0.12);
  rim.strokeCircle(0, 0, d / 2 - 3);
  c.add(rim);
  c.setRing = (color) => { rim.clear(); rim.lineStyle(2, color, 1); rim.strokeCircle(0, 0, d / 2); rim.lineStyle(1, 0xffffff, 0.12); rim.strokeCircle(0, 0, d / 2 - 3); };
  return c;
}

/** Small lock glyph for features that are not in this build. */
export function drawLock(g, x, y, color = THEME.dim) {
  g.lineStyle(1.75, color, 0.9);
  g.strokeRoundedRect(x - 5, y - 1, 10, 8, 2);
  g.beginPath();
  g.arc(x, y - 2, 3.5, Math.PI, 0, false);
  g.strokePath();
}
