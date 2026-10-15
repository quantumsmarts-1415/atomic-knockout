import * as Phaser from 'phaser';
import { showScene } from '../ui/flow.js';
import { setBootSplashDetail, setBootSplashStatus } from '../ui/bootSplash.js';
import { loadStageArt } from '../data/stages.js';
import { CHARACTERS, ROSTER } from '../data/characters.js';
import { MATCH_STOCKS } from '../engine/matchRules.js';
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
      stocks: Number(params.get('stocks')) || MATCH_STOCKS,
      ms: Number(params.get('ms')) || 600000,
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
    stocks: Number(params.get('stocks')) || MATCH_STOCKS,
    ms: Number(params.get('ms')) || 600000,
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
// A strip taller or wider than the GPU limit uploads as an incomplete texture
// and draws solid black. Pack the same cells into a grid that fits.
export function fitSheetGrid(frameW, frameH, count, maxSize) {
  if (!positiveFinite(frameW) || !positiveFinite(frameH) || !(count > 0) || !(maxSize > 0)) return null;
  if (frameW > maxSize || frameH > maxSize) return null;
  const cols = Math.max(1, Math.floor(maxSize / frameW));
  const rows = Math.ceil(count / cols);
  const width = cols * frameW;
  const height = rows * frameH;
  if (width > maxSize || height > maxSize) return null;
  return { cols, rows, width, height };
}

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

// Rebuild any loaded sheet whose source image exceeds the GPU limit.
// Frame order stays row-major, so clip indexes and anchors do not move.
export function repackOversizedSheets(scene, roster, maxSize = scene.game?.renderer?.getMaxTextureSize?.() || 8192) {
  if (!scene?.textures?.get || typeof document === 'undefined') return [];
  const packed = [];
  for (const c of roster) {
    if (!use3dSheets(c)) continue;
    const s = c.art.sheets;
    for (const [clip, def] of Object.entries(s.clips)) {
      const key = sheetKey(c.art, clip);
      if (!scene.textures.exists(key)) continue;
      const tex = scene.textures.get(key);
      const src = tex.getSourceImage?.() || tex.source?.[0]?.image;
      const sw = src?.naturalWidth || src?.width || 0;
      const sh = src?.naturalHeight || src?.height || 0;
      if (!(sw > maxSize || sh > maxSize)) continue;
      let frameW;
      let frameH;
      try {
        ({ frameW, frameH } = clipFrameSize(s, def));
      } catch (err) {
        console.error(`Skipping repack ${key}: ${err.message}`);
        continue;
      }
      const grid = fitSheetGrid(frameW, frameH, def.count, maxSize);
      if (!grid || !src) {
        console.error(`Sheet ${key} is ${sw}x${sh} and does not pack under ${maxSize}`);
        continue;
      }
      const canvas = document.createElement('canvas');
      canvas.width = grid.width;
      canvas.height = grid.height;
      const ctx = canvas.getContext('2d');
      const srcCols = Math.max(1, Math.round(sw / frameW));
      for (let i = 0; i < def.count; i++) {
        ctx.drawImage(
          src,
          (i % srcCols) * frameW, Math.floor(i / srcCols) * frameH, frameW, frameH,
          (i % grid.cols) * frameW, Math.floor(i / grid.cols) * frameH, frameW, frameH,
        );
      }
      scene.textures.remove(key);
      scene.textures.addSpriteSheet(key, canvas, { frameWidth: frameW, frameHeight: frameH });
      packed.push(key);
    }
  }
  return packed;
}

export function loadRosterArt(loader, roster, exists = () => false) {
  for (const c of roster) {
    if (c.art && !exists(c.art.key)) loader.image(c.art.key, c.art.file);
    if (!use3dSheets(c)) continue;
    const s = c.art.sheets;
    for (const [clip, def] of Object.entries(s.clips)) {
      const key = sheetKey(c.art, clip);
      if (exists(key)) continue;
      let frameW;
      let frameH;
      try {
        ({ frameW, frameH } = clipFrameSize(s, def));
      } catch (err) {
        console.error(`Skipping spritesheet ${c.id}_${clip}: ${err.message}`);
        continue;
      }
      const file = def.file || `${c.id}_${clip}.png`;
      loader.spritesheet(key, `${s.dir}${file}`, {
        frameWidth: frameW,
        frameHeight: frameH,
        // sheets are padded out to a full grid; stop at the real frame count
        endFrame: def.count - 1,
      });
    }
  }
}

/** Idle, walk, and attack clips for the fighters actually on screen. */
export function registerSheetAnims(scene, roster) {
  if (!scene?.anims || !scene?.textures) return;
  for (const c of roster) {
    if (!use3dSheets(c)) continue;
    const s = c.art.sheets;
    for (const [clip, def] of Object.entries(s.clips)) {
      const key = sheetKey(c.art, clip);
      if (scene.anims.exists(key) || !scene.textures.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: def.count - 1 }),
        frameRate: def.fps,
        repeat: def.loop ? -1 : 0,
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
  bg.fillStyle(0x07060e, 1);
  bg.fillRect(0, 0, width, height);

  const track = scene.add.graphics();
  track.fillStyle(0x2a2444, 0.95);
  // Prefer plain rects — rounded helpers have failed to draw on some GPUs,
  // leaving only the near-black clear color (looks like a "black screen").
  track.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
  track.lineStyle(2, 0x3ef0e0, 0.9);
  track.strokeRect(barX - 4, barY - 4, barW + 8, barH + 8);

  const bar = scene.add.graphics();
  const statusText = scene.add.text(cx, barY - 58, status, {
    fontFamily: 'Sora, sans-serif',
    fontSize: '18px',
    color: '#E8F6FF',
  }).setOrigin(0.5);
  const percentText = scene.add.text(cx, barY - 30, formatLoadPercent(0), {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '22px',
    color: '#F0C14A',
  }).setOrigin(0.5);

  function setProgress(value) {
    const t = Math.max(0, Math.min(1, Number(value) || 0));
    percentText.setText(formatLoadPercent(t));
    bar.clear();
    bar.fillStyle(0x3ef0e0, 1);
    const fillW = barW * t;
    if (fillW > 0) bar.fillRect(barX, barY, fillW, barH);
    // Keep the HTML splash in sync — if the canvas is black, users still see %.
    if (typeof window !== 'undefined') window.__akBootProgressed = true;
    setBootSplashStatus('Loading art…', t * 100);
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
  setBootSplashStatus('Loading art…', 0);
  scene.load.on('progress', setProgress);
  scene.load.on('complete', destroy);
  scene.load.on?.('loaderror', (file) => {
    const name = file?.src || file?.url || file?.key || 'asset';
    setBootSplashDetail(`Failed to load: ${name}`);
  });

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
      // Portraits and stage art only. Each fighter's sheets load when that
      // fighter is highlighted on the select screen, and again for the two
      // (or more) fighters who actually enter the match.
      for (const c of ROSTER) {
        if (c.art) this.load.image(c.art.key, c.art.file);
      }
      loadStageArt(this.load);
    }
  }

  create() {
    const spec = playtestSpec();
    const booted = spec?.ids?.length
      ? spec.ids.map((id) => CHARACTERS[id]).filter(Boolean)
      : [];
    repackOversizedSheets(this, booted.length ? booted : ROSTER);
    registerSheetAnims(this, booted.length ? booted : ROSTER);
    if (spec?.sim) {
      // One page loads every cutout, then the tournament driver restarts Battle
      // and pumps fixed steps on the sim clock (no real-time wait).
      const game = this.game;
      window.__akRun = (opts) => new Promise((resolve, reject) => {
        const speed = Math.max(1, opts.speed ?? spec.speed);
        let settled = false;
        const finish = (err, report) => {
          if (settled) return;
          settled = true;
          window.__akResolve = null;
          if (err) reject(err);
          else resolve(report);
        };
        window.__akResolve = (report) => finish(null, report);
        try {
          // The tournament pumps steps on this same call, so Battle has to
          // exist before the function returns. The menu helper queues its
          // start for the next frame, which is too late.
          // A full round ends when the stock rules leave one fighter. The
          // step ceiling is a hang guard, not a winner.
          if (game.scene.isActive('Boot')) game.scene.stop('Boot');
          game.scene.start('Battle', {
            stageId: opts.stageId || spec.stageId,
            stocks: opts.stocks ?? spec.stocks,
            playtestMs: opts.ms ?? spec.ms ?? 1,
            simSpeed: speed,
            seed: opts.seed == null ? spec.seed : opts.seed,
            players: opts.ids.map((charId, i) => ({ charId, palette: i % 4, slot: 100 + i })),
          });
          const battle = game.scene.getScene('Battle');
          const step = 1000 / 60;
          const ceiling = Math.ceil((opts.ceilingMs ?? 20 * 60 * 1000) / step);
          const chunk = Math.max(1, speed);
          let taken = 0;
          while (!battle.reportPublished && taken < ceiling) {
            const n = Math.min(chunk, ceiling - taken);
            battle.runSimSteps(n);
            taken += n;
          }
          if (!battle.reportPublished) {
            finish(new Error('full round had no knockout before the hang guard'));
          }
        } catch (err) {
          finish(err);
        }
      });
      window.__akReady = true;
      return;
    }
    const roster = spec?.ids?.length
      ? spec.ids.map((id) => CHARACTERS[id]).filter(Boolean)
      : [];
    const proceed = () => {
      if (spec?.select) {
        setBootSplashStatus('Opening character select…');
        showScene(this, 'CharacterSelect', { playerSeeds: [{ slot: 0 }, { slot: 1 }] });
        return;
      }
      if (spec) {
        setBootSplashStatus('Opening battle…');
        showScene(this, 'Battle', {
          stageId: spec.stageId,
          stocks: spec.stocks,
          playtestMs: spec.ms,
          simSpeed: spec.speed,
          seed: spec.seed,
          players: spec.ids.map((charId, i) => ({ charId, palette: i % 4, slot: 100 + i })),
        });
        return;
      }
      // Portraits are in the texture cache now (preload finished). Wait briefly
      // for bundled faces, but never hang forever on document.fonts.ready —
      // that promise can stick on some Electron/Windows GPU/font paths and
      // leave a black window after the load bar is torn down.
      // TitleScene hides the HTML splash after it has painted.
      const fonts = (typeof document !== 'undefined' && document.fonts)
        ? Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ])
        : Promise.resolve();
      Promise.resolve(fonts).then(() => {
        if (!this.scene.isActive()) return;
        setBootSplashStatus('Opening title…');
        showScene(this, 'Title');
      });
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
