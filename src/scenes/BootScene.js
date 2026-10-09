import * as Phaser from 'phaser';
import { loadStageArt } from '../data/stages.js';
import { CHARACTERS, ROSTER } from '../data/characters.js';
import { collectMoveStrips } from '../engine/moveClip.js';

/** `?playtest=hydra,helen,kyle` boots straight into a CPU match and only
 *  loads those fighters' cutouts, so a headless run doesn't pull every sheet. */
export function playtestSpec() {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const params = new URLSearchParams(window.location.search);
  const speed = Math.min(30, Math.max(1, Number(params.get('speed')) || 1));
  const seedRaw = params.get('seed');
  const seed = seedRaw == null || seedRaw === '' || !Number.isFinite(Number(seedRaw)) ? null : Number(seedRaw);
  if (params.get('sim') === '1') {
    return {
      sim: true,
      ids: [],
      stageId: params.get('stage') || 'elemental-isle',
      stocks: Number(params.get('stocks')) || 3,
      ms: Number(params.get('ms')) || 14000,
      speed,
      seed,
    };
  }
  if (params.get('select') === '1') {
    return { select: true, ids: [], speed: 1, seed };
  }
  const raw = params.get('playtest');
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim()).filter((id) => CHARACTERS[id]);
  if (!ids.length) return null;
  return {
    ids,
    stageId: params.get('stage') || 'elemental-isle',
    stocks: Number(params.get('stocks')) || 2,
    ms: Number(params.get('ms')) || 20000,
    speed: 1,
    sim: false,
    seed,
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

// Origin/scale for a clip. Each of frameW/frameH/footY/visibleH/bodyH is
// independent: a clip may override any subset; omitted fields fall back to sheets.*.
// visibleH and bodyH are the head-to-feet body inside the cell, not the raw
// alpha box. displayScale, when stored, is the sprite scale that fits that
// body to art.height.
export function clipDisplayLayout(sheets, clipDef = {}) {
  const footY = clipDef.footY ?? sheets.footY;
  const visibleH = clipDef.bodyH ?? clipDef.visibleH ?? sheets.bodyH ?? sheets.visibleH;
  const displayScale = clipDef.displayScale
    ?? ((clipDef.bodyH == null && clipDef.visibleH == null) ? sheets.displayScale : null);
  if (!finiteNumber(footY)) {
    throw new RangeError(`Clip footY must be a finite number, got ${footY}`);
  }
  if (!positiveFinite(visibleH)) {
    throw new RangeError(`Clip visibleH must be finite and > 0, got ${visibleH}`);
  }
  if (displayScale != null && !positiveFinite(displayScale)) {
    throw new RangeError(`Clip displayScale must be finite and > 0, got ${displayScale}`);
  }
  return { footY, visibleH, bodyH: visibleH, displayScale: displayScale ?? null };
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
    scene.load.off?.('progress', setProgress);
    scene.load.off?.('complete', destroy);
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
    if (spec?.sim) {
      for (const c of ROSTER) {
        if (c.art) this.load.image(c.art.key, c.art.file);
      }
    } else if (spec?.select) {
      // Portraits only. The table is the thing under test; full sheets are
      // hundreds of megabytes and the preview falls back to the cutout.
      for (const c of ROSTER) {
        if (c.art) this.load.image(c.art.key, c.art.file);
      }
    } else if (spec) {
      // Just the fighters in this match, sheets included, so idle/walk/attack
      // can be checked without pulling the rest of the roster.
      loadRosterArt(this.load, spec.ids.map((id) => CHARACTERS[id]).filter(Boolean));
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
    if (spec?.sim) {
      // One page loads every cutout, then the tournament driver restarts Battle
      // and pumps fixed steps on the sim clock (no real-time wait).
      const game = this.game;
      window.__akRun = (opts) => new Promise((resolve, reject) => {
        const ms = opts.ms ?? spec.ms;
        const speed = Math.max(1, opts.speed ?? spec.speed);
        const timer = setTimeout(() => reject(new Error('match timeout')), 60000);
        let settled = false;
        const finish = (err, report) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          window.__akResolve = null;
          if (err) reject(err);
          else resolve(report);
        };
        window.__akResolve = (report) => finish(null, report);
        try {
          if (game.scene.isActive('Boot')) game.scene.stop('Boot');
          game.scene.start('Battle', {
            stageId: opts.stageId || spec.stageId,
            stocks: opts.stocks ?? spec.stocks,
            playtestMs: ms,
            simSpeed: speed,
            seed: opts.seed == null ? spec.seed : opts.seed,
            players: opts.ids.map((charId, i) => ({ charId, palette: i % 4, slot: 100 + i })),
          });
          const battle = game.scene.getScene('Battle');
          const steps = Math.ceil(ms / (1000 / 60)) + 3;
          const chunk = Math.max(1, speed);
          for (let i = 0; i < steps && !battle.reportPublished; i += chunk) {
            battle.runSimSteps(Math.min(chunk, steps - i));
          }
          if (!battle.reportPublished) {
            battle.matchOver = true;
            battle.publishPlaytestReport();
          }
        } catch (err) {
          finish(err);
        }
      });
      window.__akReady = true;
      return;
    }
    const roster = spec
      ? spec.ids.map((id) => CHARACTERS[id]).filter(Boolean)
      : ROSTER;
    const proceed = () => {
      if (spec?.select) {
        this.scene.start('CharacterSelect', { playerSeeds: [{ slot: 0 }, { slot: 1 }] });
        return;
      }
      if (spec) {
        this.scene.start('Battle', {
          stageId: spec.stageId,
          stocks: spec.stocks,
          playtestMs: spec.ms,
          simSpeed: spec.speed,
          seed: spec.seed,
          players: spec.ids.map((charId, i) => ({ charId, palette: i % 4, slot: 100 + i })),
        });
        return;
      }
      this.scene.start('Title');
    };
    // Optional strips. A missing manifest is the idle telegraph, not an error.
    collectMoveStrips(roster).then((jobs) => {
      const pending = jobs.filter((j) => !this.textures.exists(j.textureKey));
      if (!pending.length) {
        proceed();
        return;
      }
      for (const j of pending) {
        this.load.spritesheet(j.textureKey, j.url, {
          frameWidth: j.cellW,
          frameHeight: j.cellH,
          endFrame: j.frames - 1,
        });
      }
      this.load.once('complete', proceed);
      this.load.start();
    }).catch(() => proceed());
  }
}
