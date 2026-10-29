// Campaign art loading. Uses the game's own loaders, but only pulls what the
// map needs: the idle sheet (stands on the map) and the one attack clip used for
// the battle animation. Walk sheets are skipped (they are the largest files);
// units slide between tiles with a bob instead.
import { CHARACTERS } from '../data/characters.js';
import { loadRosterArt, registerSheetAnims, repackOversizedSheets, use3dSheets, sheetKey, attachBootLoadUi, clipFrameSize, fitSheetGrid } from '../scenes/BootScene.js';
import { BIG_SHEETS } from './sheetDims.js';
import { clipNameForMove } from '../engine/moveSheet.js';
import { TERRAIN_IDS } from './terrain.js';

export const tileKey = (id) => `cmp-tile-${id}`;

/** The clip the Rig will play for a basic attack, if this fighter has one. */
export function attackClipName(charDef) {
  const clips = charDef?.art?.sheets?.clips;
  if (!clips) return null;
  const name = clipNameForMove(charDef.id, 'basicDirectional');
  if (name && clips[name]) return name;
  return clips.attack ? 'attack' : null;
}

function slim(c, names) {
  const clips = {};
  for (const n of names) if (c.art.sheets.clips[n]) clips[n] = c.art.sheets.clips[n];
  return { ...c, art: { ...c.art, sheets: { ...c.art.sheets, clips } } };
}

/** Texture keys this campaign session added, so leaving can free them. */
const added = new Set();

export function queueTiles(loader, textures) {
  for (const id of TERRAIN_IDS) {
    const k = tileKey(id);
    if (!textures.exists(k)) { loader.image(k, `assets/campaign/tiles/${id}.jpg`); added.add(k); }
  }
}

function run(scene, queue, done, hud) {
  queue();
  if (!scene.load.list.size && !scene.load.inflight.size) { done(); return; }
  if (hud) attachBootLoadUi(scene, { status: 'Loading fighters…' });
  scene.load.once('complete', () => done());
  scene.load.start();
}

/**
 * Load tiles + portraits + idle sheets for these fighters. `phase` is
 * 'idle' (what the map and story need) or 'attack' (battle clips, background).
 */
/**
 * Sheets wider than the GPU's texture limit never go through the Phaser loader: the browser decodes
 * the PNG, it is cut into a grid that fits, and only that canvas is uploaded. (Loading them directly
 * logs "WebGL: texImage2D: width or height out of range" and uploads an incomplete texture first.)
 */
function loadBigSheet(scene, c, clip, maxSize, done) {
  const s = c.art.sheets;
  const def = s.clips[clip];
  const key = sheetKey(c.art, clip);
  let fr;
  try { fr = clipFrameSize(s, def); } catch { done(); return; }
  const grid = fitSheetGrid(fr.frameW, fr.frameH, def.count, maxSize);
  if (!grid) { done(); return; }
  const img = new Image();
  img.onload = () => {
    try {
      if (!scene.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = grid.width;
        canvas.height = grid.height;
        const ctx = canvas.getContext('2d');
        const srcCols = Math.max(1, Math.round(img.naturalWidth / fr.frameW));
        for (let i = 0; i < def.count; i++) {
          ctx.drawImage(img, (i % srcCols) * fr.frameW, Math.floor(i / srcCols) * fr.frameH, fr.frameW, fr.frameH,
            (i % grid.cols) * fr.frameW, Math.floor(i / grid.cols) * fr.frameH, fr.frameW, fr.frameH);
        }
        scene.textures.addSpriteSheet(key, canvas, { frameWidth: fr.frameW, frameHeight: fr.frameH });
        added.add(key);
      }
    } catch (err) { console.error(`campaign: could not repack ${key}: ${err.message}`); }
    done();
  };
  img.onerror = () => done();
  img.src = `${s.dir}${def.file || `${c.id}_${clip}.png`}`;
}

export function loadCampaignArt(scene, ids, phase, done, { hud = false } = {}) {
  const chars = [...new Set(ids)].map((id) => CHARACTERS[id]).filter((c) => c && c.art);
  const names = (c) => (phase === 'attack' ? [attackClipName(c)].filter(Boolean) : ['idle']);
  const slimmed = chars.map((c) => (use3dSheets(c) ? slim(c, names(c)) : c));
  const maxSize = scene.game?.renderer?.getMaxTextureSize?.() || 8192;
  const big = [];
  for (const c of slimmed) {
    if (!use3dSheets(c)) continue;
    for (const clip of Object.keys(c.art.sheets.clips)) {
      const k = sheetKey(c.art, clip);
      const dims = BIG_SHEETS[k];
      if (dims && (dims[0] > maxSize || dims[1] > maxSize) && !scene.textures.exists(k)) big.push({ c, clip, k });
    }
  }
  const bigKeys = new Set(big.map((b) => b.k));
  const exists = (k) => scene.textures.exists(k) || bigKeys.has(k);
  const before = new Set(scene.textures.getTextureKeys());
  let pending = 1 + big.length; // the loader pass plus each big sheet
  const finish = () => {
    for (const k of scene.textures.getTextureKeys()) if (!before.has(k)) added.add(k);
    repackOversizedSheets(scene, chars);
    registerSheetAnims(scene, chars);
    done?.();
  };
  const tick = () => { pending -= 1; if (pending === 0) finish(); };
  for (const b of big) loadBigSheet(scene, b.c, b.clip, maxSize, tick);
  run(scene, () => {
    if (phase === 'idle') queueTiles(scene.load, scene.textures);
    loadRosterArt(scene.load, slimmed, exists);
  }, tick, hud);
}

/** Drop everything the campaign loaded (called on the way back to the title). */
export function releaseCampaignArt(scene) {
  for (const k of added) {
    if (scene.anims.exists(k)) scene.anims.remove(k);
    if (scene.textures.exists(k)) scene.textures.remove(k);
  }
  added.clear();
}

export { sheetKey };
