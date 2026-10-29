// Campaign art loading. Uses the game's own loaders, but only pulls what the
// map needs: the idle sheet (stands on the map) and the one attack clip used for
// the battle animation. Walk sheets are skipped (they are the largest files);
// units slide between tiles with a bob instead.
import { CHARACTERS } from '../data/characters.js';
import { loadRosterArt, registerSheetAnims, repackOversizedSheets, use3dSheets, sheetKey, attachBootLoadUi } from '../scenes/BootScene.js';
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
export function loadCampaignArt(scene, ids, phase, done, { hud = false } = {}) {
  const chars = [...new Set(ids)].map((id) => CHARACTERS[id]).filter((c) => c && c.art);
  const names = (c) => (phase === 'attack' ? [attackClipName(c)].filter(Boolean) : ['idle']);
  const slimmed = chars.map((c) => (use3dSheets(c) ? slim(c, names(c)) : c));
  const exists = (k) => scene.textures.exists(k);
  const before = new Set(scene.textures.getTextureKeys());
  const finish = () => {
    for (const k of scene.textures.getTextureKeys()) if (!before.has(k)) added.add(k);
    repackOversizedSheets(scene, chars);
    registerSheetAnims(scene, chars);
    done?.();
  };
  run(scene, () => {
    if (phase === 'idle') queueTiles(scene.load, scene.textures);
    loadRosterArt(scene.load, slimmed, exists);
  }, finish, hud);
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
