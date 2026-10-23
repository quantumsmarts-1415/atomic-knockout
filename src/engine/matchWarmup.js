// The opening of a round used to decode every painted effect, read the pixels
// back for hit masks, and upload those textures while the fighters were
// already moving. That work now starts on the stage select screen and finishes
// behind the match card, before GO.
import { CHARACTERS } from '../data/characters.js';
import { collectFxArt, fxLoadState, fxTextureKeys } from './fxArt.js';
import { applyColorway, ensureColorwayPipeline } from './colorwayPipeline.js';
import { preload as preloadSfx } from './sfx.js';
import { loadRosterArt, registerSheetAnims, sheetKey } from '../scenes/BootScene.js';
import { artGaveUp, runSafeLoad } from './safeLoad.js';

export { fxLoadState };

export const warmupState = { phase: 'idle', done: 0, total: 0 };

function sheetKeys(scene, roster) {
  const keys = [];
  for (const c of roster) {
    const clips = c?.art?.sheets?.clips;
    if (!clips) continue;
    for (const clip of Object.keys(clips)) {
      const key = sheetKey(c.art, clip);
      if (scene.textures?.exists?.(key)) keys.push(key);
    }
  }
  return keys;
}

function needsUpload(scene, key) {
  const renderer = scene.game?.renderer;
  if (!renderer?.gl || !scene.textures?.exists?.(key)) return false;
  const source = scene.textures.get(key)?.source?.[0];
  return !!(source && !source.glTexture);
}

function uploadOne(scene, key) {
  const renderer = scene.game?.renderer;
  const source = scene.textures.get(key)?.source?.[0];
  if (!source || source.glTexture || !renderer?.createTextureFromSource) return;
  try {
    source.glTexture = renderer.createTextureFromSource(
      source.image, source.width, source.height, source.scaleMode,
    );
  } catch {
    // The first real draw uploads anything this miss left behind.
  }
}

function colorwayFor(players) {
  for (const p of players || []) {
    if (!((p.palette ?? 0) > 0)) continue;
    const cw = CHARACTERS[p.charId]?.palettes?.[p.palette]?.colorway;
    if (cw) return cw;
  }
  return null;
}

/** Compile the colorway shader on a 4px target so the first painted fighter
 *  does not pay for it. */
function warmColorway(scene, roster, players) {
  const cw = colorwayFor(players);
  if (!cw || !ensureColorwayPipeline(scene.game)) return;
  const key = sheetKeys(scene, roster)[0]
    || scene.textures.getTextureKeys?.().find((k) => k !== '__DEFAULT' && k !== '__MISSING');
  if (!key || !scene.make?.image || !scene.make?.renderTexture) return;
  const img = scene.make.image({ x: 0, y: 0, key, add: false });
  applyColorway(img, cw);
  const rt = scene.make.renderTexture({ width: 4, height: 4, add: false });
  try {
    rt.draw(img, 2, 2);
  } catch {
    // Canvas builds have no shader to warm.
  }
  img.destroy();
  rt.destroy();
}

/**
 * Start sheet loads, sound decode, and FX decode while the player is still
 * picking a stage. Textures land on the game, so they survive the scene change.
 */
export function primeMatchArt(scene, players = []) {
  const seen = new Set();
  const roster = [];
  for (const p of players) {
    const c = CHARACTERS[p.charId];
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);
    roster.push(c);
  }
  if (!roster.length) return Promise.resolve();
  const audio = preloadSfx();
  const missing = roster.filter((c) => {
    const clips = c.art?.sheets?.clips;
    if (!clips || !scene.textures?.exists) return false;
    return Object.keys(clips).some((clip) => !scene.textures.exists(sheetKey(c.art, clip)));
  });
  let sheets = Promise.resolve();
  const have = (key) => scene.textures.exists(key) || artGaveUp(key);
  if (missing.length && scene.load?.spritesheet) {
    sheets = runSafeLoad(scene, (loader) => loadRosterArt(loader, missing, have))
      .then(() => registerSheetAnims(scene, missing));
  }
  return Promise.all([audio, collectFxArt(scene, roster), sheets]);
}

/** Finish decode, upload anything still on the CPU, and compile the colorway
 *  shader. The match card waits on this before it hands over to the round. */
export function beginMatchWarmup(scene) {
  if (scene.matchWarmup) return scene.matchWarmup;
  const job = runWarmup(scene).catch(() => {
    warmupState.phase = 'ready';
  });
  scene.matchWarmup = job;
  return job;
}

async function runWarmup(scene) {
  warmupState.phase = 'art';
  warmupState.done = fxLoadState.done;
  warmupState.total = fxLoadState.total;
  const roster = (scene.setup?.players || [])
    .map((p) => CHARACTERS[p.charId])
    .filter((c) => c?.id);
  const audio = preloadSfx();
  await collectFxArt(scene, roster);
  await audio;
  if (scene.sys && scene.sys.isActive && !scene.sys.isActive()) return;
  registerSheetAnims(scene, roster);
  const pending = [...sheetKeys(scene, roster), ...fxTextureKeys()].filter((key) => needsUpload(scene, key));
  warmupState.phase = pending.length ? 'gpu' : 'ready';
  warmupState.done = 0;
  warmupState.total = pending.length;
  for (const key of pending) {
    if (scene.sys && scene.sys.isActive && !scene.sys.isActive()) return;
    uploadOne(scene, key);
    warmupState.done++;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  try {
    warmColorway(scene, roster, scene.setup?.players || []);
  } catch {
    // The round still plays in the painted colors if the shader cannot boot.
  }
  warmupState.phase = 'ready';
  if (!warmupState.total) warmupState.total = 1;
  warmupState.done = warmupState.total;
}
