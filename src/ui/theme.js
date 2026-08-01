import * as Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Shared HUD Visor UI theme -- the sci-fi minimal look Benjamin picked for
// the phone controller, applied to the game's own menu chrome (title,
// lobby, character select, stage select, results, pause, and the battle
// HUD panels). Deliberately does NOT touch character art/rigs, attack VFX,
// or the battle stage's own background/terrain art -- those stay as-is.
// ---------------------------------------------------------------------------
export const THEME = {
  bgTop: 0x142033,
  bgBottom: 0x060a10,
  accent: 0x4ad6ff,       // signature cyan glow
  accentDim: 0x2a5a78,
  text: 0xd8ecff,         // soft light blue-white
  textBright: 0xeaf9ff,
  textDim: 0x5c7a94,      // muted blue-gray, for secondary/disabled text
  panelFill: 0x0a0e14,
  glow: 'rgba(74, 214, 255, 0.35)',
};

export const FONT_DISPLAY = 'Arial Black, sans-serif'; // headings -- kept bold, just recolored
export const FONT_BODY = 'Arial, sans-serif';

/** Draws the shared dark navy->near-black menu background gradient. */
export function drawMenuBackground(scene, W, H) {
  const g = scene.add.graphics();
  const top = Phaser.Display.Color.ValueToColor(THEME.bgTop);
  const bottom = Phaser.Display.Color.ValueToColor(THEME.bgBottom);
  for (let i = 0; i < 28; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 28, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, (H / 28) * i, W, H / 28 + 1);
  }
  return g;
}

/** Thin-outline "glass" panel matching the controller's button style. */
export function drawPanel(scene, x, y, w, h, radius = 16, borderColor = THEME.accent, borderAlpha = 0.6) {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.03);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(1.5, borderColor, borderAlpha);
  g.strokeRoundedRect(x, y, w, h, radius);
  return g;
}
