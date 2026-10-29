// Campaign move effects: plays the fighting game's own FX art (assets/fx/<fighter>/<move-slug>/) in the battle
// close-ups and on the map. A deliberately small player: it reads each move's fx.json (blend, frames, cols/rows, fps,
// projectile / detonate) and draws it as a one-shot. A move with no FX art simply plays nothing.
import { moveSlug } from '../data/attackFx.js';

const specs = new Map();     // key -> Promise<spec|null>
const textureKeys = new Set();

function textureKey(id, move, part) { return `cmpfx-${id}-${moveSlug(move.name)}-${part}`; }

function loadImage(scene, key, url) {
  if (scene.textures.exists(key)) return Promise.resolve(true);
  textureKeys.add(key);
  return new Promise((resolve) => {
    const done = (ok) => { scene.load.off('loaderror', onErr); resolve(ok); };
    const onErr = (f) => { if (f.key === key) done(false); };
    scene.load.once(`filecomplete-image-${key}`, () => done(true));
    scene.load.on('loaderror', onErr);
    scene.load.image(key, url);
    if (!scene.load.isLoading()) scene.load.start();
  });
}

function addFrames(scene, key, frames, cols, rows) {
  const tex = scene.textures.get(key);
  const src = tex.getSourceImage();
  const fw = Math.floor(src.width / cols);
  const fh = Math.floor(src.height / rows);
  if (!tex.has('0')) for (let i = 0; i < frames; i++) tex.add(String(i), 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh);
  return { fw, fh };
}

// Phaser.BlendModes: NORMAL 0, ADD 1, SCREEN 3 (plain numbers so this file also loads under node for tests)
function blendOf(meta) {
  return meta.blend === 'add' ? 1 : meta.blend === 'screen' ? 3 : 0;
}

/** Fetch and prepare a move's FX (cached). Resolves null when the move has no FX art. */
export function loadMoveFx(scene, id, move) {
  const k = `${id}/${moveSlug(move.name)}`;
  if (specs.has(k)) {
    return specs.get(k).then((s) => (s && scene.textures.exists(s.key) ? s : (specs.delete(k), loadMoveFx(scene, id, move))));
  }
  const dir = `assets/fx/${id}/${moveSlug(move.name)}/`;
  const p = fetch(`${dir}fx.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then(async (meta) => {
    if (!meta) return null;
    const spec = { meta, dir, blend: blendOf(meta) };
    if (meta.projectile) {
      const key = textureKey(id, move, 'obj');
      if (!(await loadImage(scene, key, `${dir}${meta.projectile.file || 'object.png'}`))) return null;
      spec.proj = { key, meta: meta.projectile };
      if (meta.detonate) {
        const dk = textureKey(id, move, 'det');
        if (await loadImage(scene, dk, `${dir}${meta.detonate.file || 'sheet.png'}`)) {
          const frames = meta.detonate.frames || 1;
          const cols = meta.detonate.cols || frames;
          const rows = meta.detonate.rows || Math.ceil(frames / cols);
          Object.assign(spec, { det: { key: dk, frames, cols, rows, fps: meta.detonate.fps || 12, ...addFrames(scene, dk, frames, cols, rows), meta: meta.detonate } });
        }
      }
      spec.key = key;
      return spec;
    }
    const key = textureKey(id, move, 'sheet');
    let ok = await loadImage(scene, key, `${dir}${meta.file || 'sheet.png'}`);
    if (!ok && !meta.file) ok = await loadImage(scene, key, `${dir}object.png`);
    if (!ok) return null;
    const frames = meta.frames || 1;
    const cols = meta.cols || frames;
    const rows = meta.rows || Math.ceil(frames / cols);
    Object.assign(spec, { key, frames, cols, rows, fps: meta.fps || 12, ...addFrames(scene, key, frames, cols, rows) });
    return spec;
  });
  specs.set(k, p);
  return p;
}

/** Free the FX textures and forget the cache (called when the battle scene closes). */
export function releaseMoveFx(scene) {
  for (const k of textureKeys) if (scene.textures.exists(k)) scene.textures.remove(k);
  textureKeys.clear();
  specs.clear();
}

const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

function fitSize(spec, frameH, ref, meta) {
  // height as a fraction of the reference body height (the fighting game's heightFrac), capped so nothing floods the screen
  const frac = Math.min(2.2, meta.heightFrac || 1);
  return (frac * ref) / frameH;
}

/**
 * Play one move's FX once. `from`/`to` are screen points (attacker, target); `ref` is a body height in px so the art
 * scales with the scene (270 in a close-up, ~100 on the map); `self` puts it on the attacker (guards, buffs).
 * Resolves when the effect has finished; never throws.
 */
export async function playMoveFx(scene, spec, { from, to, face = 1, ref = 200, depth = 100, speed = 1, self = false } = {}) {
  if (!spec) return;
  try {
    const at = self ? from : to;
    if (spec.proj) {
      const o = scene.add.image(from.x, from.y, spec.proj.key).setDepth(depth).setBlendMode(spec.blend);
      const s = Math.min(2, Math.max(0.15, (spec.proj.meta.heightFrac || 0.3) * 2 * ref / Math.max(o.height, 1) * 0.5));
      o.setScale(s * face, s);
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      await new Promise((resolve) => scene.tweens.add({ targets: o, x: to.x, y: to.y, duration: Math.max(180, dist * 0.9) / speed, ease: 'Quad.easeIn', onUpdate: () => { o.rotation += (spec.proj.meta.spin || 0) * 0.02; }, onComplete: resolve }));
      o.destroy();
      if (spec.det) await playSheet(scene, spec.det, { x: to.x, y: to.y }, { face, ref, depth, speed, blend: spec.blend, meta: spec.det.meta, cap: 900 });
      return;
    }
    await playSheet(scene, spec, at, { face, ref, depth, speed, blend: spec.blend, meta: spec.meta, cap: 1000, from, to, stretch: spec.meta.stretch || spec.meta.aim ? true : false });
  } catch { /* art problems must never stop a fight */ }
}

async function playSheet(scene, spec, at, { face, ref, depth, speed, blend, meta, cap, from = null, to = null, stretch = false }) {
  const frames = spec.frames || 1;
  const img = scene.add.image(at.x, at.y, spec.key, '0').setDepth(depth).setBlendMode(blend);
  const sc = fitSize(spec, spec.fh, ref, meta);
  const pivotBottom = meta.pivot === 'bottom';
  img.setOrigin(0.5, pivotBottom ? 1 : 0.5);
  img.setScale(sc * face, sc);
  if (stretch && from && to && Math.abs(to.x - from.x) > 20) {
    // beams and lunges stretch from the attacker to the target
    img.setOrigin(0, 0.5).setPosition(from.x, from.y).setScale((Math.abs(to.x - from.x) / spec.fw) * face, sc);
  }
  if (pivotBottom) img.y = at.y + ref * 0.45;
  const dur = Math.min(cap, Math.max(300, (frames / (spec.fps || 12)) * 1000)) / speed;
  await new Promise((resolve) => {
    scene.tweens.addCounter({
      from: 0, to: frames - 1, duration: dur,
      onUpdate: (t) => { const f = Math.min(frames - 1, Math.floor(t.getValue())); img.setFrame(String(f)); },
      onComplete: resolve,
    });
  });
  await new Promise((resolve) => scene.tweens.add({ targets: img, alpha: 0, duration: 140 / speed, onComplete: resolve }));
  img.destroy();
}

export { wait as _wait };
