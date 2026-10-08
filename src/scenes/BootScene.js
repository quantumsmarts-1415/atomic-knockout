import * as Phaser from 'phaser';
import { loadStageArt } from '../data/stages.js';
import { CHARACTERS, ROSTER } from '../data/characters.js';

/** `?playtest=hydra,helen,kyle` boots straight into a CPU match and only
 *  loads those fighters' cutouts, so a headless run doesn't pull every sheet. */
export function playtestSpec() {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('playtest');
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim()).filter((id) => CHARACTERS[id]);
  if (!ids.length) return null;
  return {
    ids,
    stageId: params.get('stage') || 'elemental-isle',
    stocks: Number(params.get('stocks')) || 2,
    ms: Number(params.get('ms')) || 20000,
  };
}

// A character can supply art in two forms:
//   - a single render (art.file) -> puppet-animated by the Rig
//   - 3D sprite sheets (art.sheets, gated on art.use3d) -> real frame animation
// Both are loaded when present, so flipping use3d off needs no reload changes.
export function sheetKey(art, clip) {
  return `${art.key}-${clip}`;
}

export function use3dSheets(charDef) {
  return Boolean(charDef.art?.use3d && charDef.art.sheets);
}

export function positiveFinite(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function finiteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

// Clip cell size: optional clips.<clip>.frameW / frameH, else sheets.frameW / frameH.
// Resolved values must be finite and > 0 — a 0/NaN/Infinity cell would mis-slice the sheet.
export function clipFrameSize(sheets, clipDef = {}) {
  const frameW = clipDef.frameW ?? sheets.frameW;
  const frameH = clipDef.frameH ?? sheets.frameH;
  if (!positiveFinite(frameW) || !positiveFinite(frameH)) {
    throw new RangeError(`Sprite-sheet frame size must be finite and > 0, got ${frameW}x${frameH}`);
  }
  return { frameW, frameH };
}

// Origin/scale for a clip. Each of frameW/frameH/footY/visibleH is independent:
// a clip may override any subset; omitted fields fall back to sheets.*.
export function clipDisplayLayout(sheets, clipDef = {}) {
  const footY = clipDef.footY ?? sheets.footY;
  const visibleH = clipDef.visibleH ?? sheets.visibleH;
  if (!finiteNumber(footY)) {
    throw new RangeError(`Clip footY must be a finite number, got ${footY}`);
  }
  if (!positiveFinite(visibleH)) {
    throw new RangeError(`Clip visibleH must be finite and > 0, got ${visibleH}`);
  }
  return { footY, visibleH };
}

export function loadRosterArt(loader, roster) {
  for (const c of roster) {
    if (c.art) loader.image(c.art.key, c.art.file);
    if (!use3dSheets(c)) continue;
    const s = c.art.sheets;
    for (const [clip, def] of Object.entries(s.clips)) {
      let frameW;
      let frameH;
      try {
        ({ frameW, frameH } = clipFrameSize(s, def));
      } catch (err) {
        console.error(`Skipping spritesheet ${c.id}_${clip}: ${err.message}`);
        continue;
      }
      loader.spritesheet(sheetKey(c.art, clip), `${s.dir}${c.id}_${clip}.png`, {
        frameWidth: frameW,
        frameHeight: frameH,
        // sheets are padded out to a full grid; stop at the real frame count
        endFrame: def.count - 1,
      });
    }
  }
}

// Phaser LoaderPlugin progress is 0..1. Clamp + round so the HUD never shows
// "NaN%" / "-1%" if a host fires a weird value.
export function formatLoadPercent(value) {
  const pct = Math.round((Number(value) || 0) * 100);
  return `${Math.max(0, Math.min(100, pct))}%`;
}

// First-paint loading HUD for BootScene. Bind this BEFORE queueing files so
// the bar is on screen at 0% while the ~hundreds-of-MB roster sheets load.
// Colors match the HUD visor theme (src/ui/theme.js) without importing it —
// BootScene tests mock Phaser and should not pull Display helpers.
export function attachBootLoadUi(scene, {
  width = scene.scale?.width || scene.cameras?.main?.width || 1280,
  height = scene.scale?.height || scene.cameras?.main?.height || 720,
  status = 'Loading art…',
} = {}) {
  const cx = width / 2;
  const barW = 420;
  const barH = 16;
  const barX = cx - barW / 2;
  const barY = height / 2 + 16;

  const bg = scene.add.graphics();
  bg.fillStyle(0x0d1220, 1);
  bg.fillRect(0, 0, width, height);

  const track = scene.add.graphics();
  track.fillStyle(0x0a0e14, 0.92);
  track.fillRoundedRect(barX - 4, barY - 4, barW + 8, barH + 8, 8);
  track.lineStyle(1.5, 0x4ad6ff, 0.55);
  track.strokeRoundedRect(barX - 4, barY - 4, barW + 8, barH + 8, 8);

  const bar = scene.add.graphics();
  const statusText = scene.add.text(cx, barY - 52, status, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '22px',
    color: '#d8ecff',
  }).setOrigin(0.5);
  const percentText = scene.add.text(cx, barY - 22, formatLoadPercent(0), {
    fontFamily: 'Arial Black, sans-serif',
    fontSize: '28px',
    color: '#eaf9ff',
  }).setOrigin(0.5);

  function setProgress(value) {
    const t = Math.max(0, Math.min(1, Number(value) || 0));
    percentText.setText(formatLoadPercent(t));
    bar.clear();
    bar.fillStyle(0x4ad6ff, 1);
    const fillW = barW * t;
    if (fillW > 0) bar.fillRect(barX, barY, fillW, barH);
  }

  function destroy() {
    bg.destroy();
    bar.destroy();
    track.destroy();
    statusText.destroy();
    percentText.destroy();
  }

  setProgress(0);
  scene.load.on('progress', setProgress);
  scene.load.on('complete', destroy);

  return { statusText, percentText, bar, track, bg, setProgress, destroy };
}

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Show progress immediately — roster sheets are huge, and without this
    // remote playable previews sit on a blank #0d1220 canvas for minutes.
    attachBootLoadUi(this);
    const spec = playtestSpec();
    if (spec) {
      // Cutouts only. Sheets are hundreds of megabytes and this path is for
      // timed CPU matches, not for admiring walk cycles.
      for (const id of spec.ids) {
        const art = CHARACTERS[id].art;
        if (art) this.load.image(art.key, art.file);
      }
    } else {
      // character renders (Benjamin-supplied art) — characters without an art
      // entry fall back to the code-drawn vector rig automatically
      loadRosterArt(this.load, ROSTER);
      // painted stage layers + every stage's select-screen thumbnail/preview
      loadStageArt(this.load);
    }
  }

  create() {
    for (const c of ROSTER) {
      if (!use3dSheets(c)) continue;
      const s = c.art.sheets;
      for (const [clip, def] of Object.entries(s.clips)) {
        const key = sheetKey(c.art, clip);
        if (this.anims.exists(key) || !this.textures.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: def.count - 1 }),
          frameRate: def.fps,
          repeat: def.loop ? -1 : 0,
        });
      }
    }
    const spec = playtestSpec();
    if (spec) {
      this.scene.start('Battle', {
        stageId: spec.stageId,
        stocks: spec.stocks,
        playtestMs: spec.ms,
        players: spec.ids.map((charId, i) => ({ charId, palette: i % 4, slot: 100 + i })),
      });
      return;
    }
    this.scene.start('Title');
  }
}
