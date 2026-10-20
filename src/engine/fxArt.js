// Drop-in attack art. A PNG in assets/fx/<fighter>/<move-slug>/ replaces the
// code-drawn effect. Nothing in that folder means the old drawing and the
// old hit shape stay exactly as they are. The hit mask is the alpha of the
// loaded image, packed on the same 5 px grid as body masks.

import { effectBox, fxFolder, moveSlug, objectTypeOf } from '../data/attackFx.js';
import { sheetDrawsWeapon, sheetFxPoint, sheetReleasePoint } from './moveSheet.js';
import { clampToBody, fxPlacementHits } from './boxes.js';
import { coatSpec } from './coat.js';

const CELL = 5;
const ALPHA = 127;
const FILL = 0.22;
const BLACK_LUMA = 16;
const byKey = new Map();
let indexSet = undefined;

/** Luminance key for art painted on pure black. Pixels at or under the
 *  threshold lose their alpha, so the hit mask and the sprite agree. */
export function keyNearBlack(data, width, height, threshold) {
  const out = new Uint8ClampedArray(data);
  const limit = threshold ?? 0;
  if (!(limit > 0) || !(width > 0) || !(height > 0)) return out;
  const n = Math.min(out.length, width * height * 4);
  for (let i = 0; i < n; i += 4) {
    const lum = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
    if (out[i + 3] === 0 || lum <= limit) out[i + 3] = 0;
  }
  return out;
}

export function blackThreshold(meta) {
  if (!meta) return 0;
  if (typeof meta.black === 'number' && meta.black > 0) return meta.black;
  if (meta.black === false) return 0;
  if (meta.blend === 'add' || meta.black === true) return BLACK_LUMA;
  return 0;
}

/** One cell of a horizontal strip. Leftover columns on the right are unused. */
export function sliceHorizontal(data, width, height, frames, index) {
  const count = Math.max(1, frames | 0);
  const fw = Math.max(1, Math.floor((width || 1) / count));
  const h = height || 1;
  const i = Math.max(0, Math.min(count - 1, index | 0));
  const out = new Uint8ClampedArray(fw * h * 4);
  const src = data || new Uint8ClampedArray(0);
  for (let y = 0; y < h; y++) {
    const from = (y * (width || fw) + i * fw) * 4;
    out.set(src.subarray(from, from + fw * 4), y * fw * 4);
  }
  return { data: out, width: fw, height: h };
}

/** One cell of a grid, row-major. Leftover pixels on the right and bottom are unused. */
export function sliceGrid(data, width, height, cols, rows, index) {
  const c = Math.max(1, cols | 0);
  const r = Math.max(1, rows | 0);
  const count = c * r;
  const fw = Math.max(1, Math.floor((width || 1) / c));
  const fh = Math.max(1, Math.floor((height || 1) / r));
  const i = Math.max(0, Math.min(count - 1, index | 0));
  const col = i % c;
  const row = Math.floor(i / c);
  const out = new Uint8ClampedArray(fw * fh * 4);
  const src = data || new Uint8ClampedArray(0);
  const srcW = width || fw;
  for (let y = 0; y < fh; y++) {
    const from = ((row * fh + y) * srcW + col * fw) * 4;
    out.set(src.subarray(from, from + fw * 4), y * fw * 4);
  }
  return { data: out, width: fw, height: fh };
}

/** Dark smoke on black: near-black clears, and the remaining luminance becomes
 *  alpha so a normal blend still shows the gray. RGB stays the smoke color. */
export function lumaToAlpha(data, width, height, threshold) {
  const out = new Uint8ClampedArray(data);
  const limit = threshold ?? BLACK_LUMA;
  const n = Math.min(out.length, (width || 0) * (height || 0) * 4);
  const denom = 255 - limit || 1;
  for (let i = 0; i < n; i += 4) {
    const lum = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
    if (out[i + 3] === 0 || lum <= limit) {
      out[i + 3] = 0;
      continue;
    }
    const t = (lum - limit) / denom;
    out[i + 3] = Math.max(0, Math.min(255, Math.round(t ** 0.45 * 255)));
  }
  return out;
}

/** Shift a pixel toward a neon color without dulling a white-hot core. */
export function tintToward(r, g, b, color, amount) {
  const cr = (color >> 16) & 255;
  const cg = (color >> 8) & 255;
  const cb = color & 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max > 0 ? (max - min) / max : 0;
  const a = Math.max(0, Math.min(1, (amount || 0) * (0.35 + 0.65 * sat)));
  const neonLum = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb || 1;
  const k = lum / neonLum;
  const tr = Math.min(255, cr * k);
  const tg = Math.min(255, cg * k);
  const tb = Math.min(255, cb * k);
  return [
    Math.round(r * (1 - a) + tr * a),
    Math.round(g * (1 - a) + tg * a),
    Math.round(b * (1 - a) + tb * a),
  ];
}

function parseTint(value) {
  if (typeof value === 'number' && value > 0) return value;
  if (typeof value === 'string') {
    const n = Number.parseInt(value.replace('#', ''), 16);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function tintPixels(data, width, height, color, amount) {
  const n = Math.min(data.length, (width || 0) * (height || 0) * 4);
  for (let i = 0; i < n; i += 4) {
    if (data[i + 3] < 8) continue;
    const [r, g, b] = tintToward(data[i], data[i + 1], data[i + 2], color, amount);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

/** Blend the last frames toward frame 0 so a looping sheet does not hitch. */
export function fadeLoopFrames(slices, fadeCount) {
  const n = slices?.length || 0;
  const fade = Math.max(0, Math.min(fadeCount | 0, n - 1));
  if (fade < 1) return slices;
  const first = slices[0]?.keyed;
  if (!first) return slices;
  for (let i = 0; i < fade; i++) {
    const src = slices[n - fade + i];
    if (!src?.keyed || src.keyed.length !== first.length) continue;
    const t = (i + 1) / (fade + 1);
    const out = new Uint8ClampedArray(src.keyed);
    for (let p = 0; p < out.length; p += 4) {
      out[p] = Math.round(out[p] * (1 - t) + first[p] * t);
      out[p + 1] = Math.round(out[p + 1] * (1 - t) + first[p + 1] * t);
      out[p + 2] = Math.round(out[p + 2] * (1 - t) + first[p + 2] * t);
      out[p + 3] = Math.round(out[p + 3] * (1 - t) + first[p + 3] * t);
    }
    slices[n - fade + i] = { ...src, keyed: out };
  }
  return slices;
}

export function contentBounds(data, width, height) {
  const w = width || 0;
  const h = height || 0;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const src = data || new Uint8ClampedArray(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[(y * w + x) * 4 + 3] <= 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: Math.max(1, w), h: Math.max(1, h) };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function cropPixels(data, width, height, box) {
  const w = Math.max(1, box?.w | 0);
  const h = Math.max(1, box?.h | 0);
  const out = new Uint8ClampedArray(w * h * 4);
  const src = data || new Uint8ClampedArray(0);
  const srcW = width || w;
  for (let y = 0; y < h; y++) {
    const from = (((box?.y | 0) + y) * srcW + (box?.x | 0)) * 4;
    const row = src.subarray(from, from + w * 4);
    if (row.length === w * 4) out.set(row, y * w * 4);
  }
  return out;
}

/** Source pixels of the visible effect for a fit mode. */
export function contentSpan(bounds, fit) {
  const w = bounds?.w || 1;
  const h = bounds?.h || 1;
  if (fit === 'height') return h;
  if (fit === 'max') return Math.max(w, h);
  return w;
}

/** Display pixels per source pixel so the visible span is heightPx * frac. */
export function pixelsPerSource(heightPx, heightFrac, span) {
  if (!(heightPx > 0) || !(heightFrac > 0) || !(span > 0)) return 0;
  return (heightPx * heightFrac) / span;
}

export function fighterHeight(char) {
  const h = char?.art?.height;
  if (h > 0) return h;
  return char?.art?.bodyH > 0 ? char.art.bodyH : 100;
}

/** Sprite scale driven by the move. `radius` uses the charged radius over the tap radius. */
export function fxGameplayScale(move, art) {
  const extra = art?.scale > 0 ? art.scale : 1;
  const mode = art?.scaleWith || move?.fxScale;
  if (mode === 'radius') {
    const base = move?._baseRadius ?? move?.radius;
    const now = move?.radius;
    if (base > 0 && now > 0) return extra * (now / base);
  }
  if (mode === 'shot') {
    const base = move?._baseProjectileRadius ?? move?.projectileRadius;
    const now = move?.projectileRadius;
    if (base > 0 && now > 0) return extra * (now / base);
  }
  return extra;
}

/** Flame size and alpha from heat stored since the last Stolen Fire. Empty is still a flame. */
export function storedHeatVisual(heat, cap = 14) {
  const limit = cap > 0 ? cap : 14;
  const frac = Math.max(0, Math.min(1, (heat > 0 ? heat : 0) / limit));
  return { frac, scale: 0.7 + 0.9 * frac, alpha: 0.6 + 0.4 * frac };
}

export function fxKey(fighterId, moveName) {
  return `${fighterId}/${moveSlug(moveName)}`;
}

export function artFor(fighterId, moveName) {
  return byKey.get(fxKey(fighterId, moveName)) || null;
}

/** Painted slash art hides the code stroke unless the move asks to keep both. */
export function slashArtReplacesStroke(art) {
  if (!art?.frames?.length) return false;
  if (art.keepSlash) return false;
  return art.objectType === 'slash arc' || art.objectType === 'extend';
}

export function fxReplacesSlash(fighter, move) {
  return slashArtReplacesStroke(artFor(fighter?.charDef?.id, move?.name));
}

/** Full-cell beam sized so its width matches the stage. */
export function stageSpanSize(scene, frame) {
  const worldW = scene?.world?.width > 0 ? scene.world.width : 1280;
  const srcW = frame?.displayW > 0 ? frame.displayW : 1;
  const srcH = frame?.displayH > 0 ? frame.displayH : 1;
  return { w: worldW, h: worldW * (srcH / srcW) };
}

export function rasterAlpha({ data, width, height, displayW, displayH, pivotX, pivotY }) {
  const dw = Math.max(CELL, displayW || width || CELL);
  const dh = Math.max(CELL, displayH || height || CELL);
  const ox = -(pivotX ?? 0.5) * dw;
  const oy = -(pivotY ?? 0.5) * dh;
  const cols = Math.max(1, Math.ceil(dw / CELL));
  const rows = Math.max(1, Math.ceil(dh / CELL));
  const solid = new Float32Array(cols * rows);
  const total = new Float32Array(cols * rows);
  const srcW = width || 1;
  const srcH = height || 1;
  for (let y = 0; y < srcH; y++) {
    const row = Math.min(rows - 1, Math.floor((((y + 0.5) / srcH) * dh) / CELL));
    for (let x = 0; x < srcW; x++) {
      const col = Math.min(cols - 1, Math.floor((((x + 0.5) / srcW) * dw) / CELL));
      const i = row * cols + col;
      total[i] += 1;
      const a = data[(y * srcW + x) * 4 + 3];
      if (a > ALPHA) solid[i] += 1;
    }
  }
  const col = [];
  const row = [];
  let n = 0;
  const bits = new Uint8Array(Math.ceil((cols * rows) / 8));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!(total[i] > 0) || solid[i] / total[i] < FILL) continue;
      bits[i >> 3] |= 1 << (i & 7);
      col.push(c);
      row.push(r);
      n += 1;
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x0 = ox + col[i] * CELL;
    const y0 = oy + row[i] * CELL;
    if (x0 < minX) minX = x0;
    if (y0 < minY) minY = y0;
    if (x0 + CELL > maxX) maxX = x0 + CELL;
    if (y0 + CELL > maxY) maxY = y0 + CELL;
  }
  if (!n) {
    minX = ox;
    minY = oy;
    maxX = ox;
    maxY = oy;
  }
  return {
    cols, rows, ox, oy, bits, col: Uint16Array.from(col), row: Uint16Array.from(row), n,
    minX, minY, maxX, maxY,
  };
}

function fit(box, imgW, imgH) {
  const scale = Math.min(box.w / Math.max(1, imgW), box.h / Math.max(1, imgH));
  return { w: Math.max(CELL, imgW * scale), h: Math.max(CELL, imgH * scale) };
}

async function readIndex() {
  if (indexSet !== undefined) return indexSet;
  try {
    const res = await fetch('/fx-index');
    if (!res.ok) {
      indexSet = null;
      return null;
    }
    const rows = await res.json();
    indexSet = new Set(Array.isArray(rows) ? rows : []);
  } catch {
    indexSet = null;
  }
  return indexSet;
}

function listed(index, rel) {
  if (!index) return true;
  return index.has(rel);
}

async function loadBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size < 32) return null;
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(img.src);
    return null;
  }
  return img;
}

function pixelsOf(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return { data, width: canvas.width, height: canvas.height };
}

function textureStore(scene) {
  return scene?.game?.textures || scene?.textures || null;
}

function rememberTexture(scene, key, img) {
  const textures = textureStore(scene);
  if (!textures?.addImage) return null;
  if (textures.exists(key)) textures.remove(key);
  textures.addImage(key, img);
  return key;
}

function canvasFromPixels(data, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

function frameFromPixels(scene, key, data, width, height, box, pivotX, pivotY, threshold) {
  const keyed = threshold > 0 ? keyNearBlack(data, width, height, threshold) : data;
  const source = threshold > 0 ? canvasFromPixels(keyed, width, height) : null;
  const fitted = fit(box, width, height);
  const mask = rasterAlpha({
    data: keyed, width, height, displayW: fitted.w, displayH: fitted.h, pivotX, pivotY,
  });
  return {
    key: rememberTexture(scene, key, source || canvasFromPixels(keyed, width, height)),
    mask,
    displayW: fitted.w,
    displayH: fitted.h,
  };
}

async function loadFrame(scene, rel, key, box, pivotX, pivotY, meta) {
  const img = await loadBitmap(fxUrl(rel));
  if (!img) return null;
  const pix = pixelsOf(img);
  return frameFromPixels(
    scene, key, pix.data, pix.width, pix.height, box, pivotX, pivotY, blackThreshold(meta),
  );
}

async function loadFxMeta(folder, index) {
  const rel = `${folder}/fx.json`;
  if (!listed(index, rel)) return {};
  try {
    const res = await fetch(fxUrl(rel));
    if (!res.ok) return {};
    const json = await res.json();
    return json && typeof json === 'object' ? json : {};
  } catch {
    return {};
  }
}

function artRecord(objectType, sized, pivot, frames, extra) {
  let hitIndex = 0;
  for (let i = 1; i < frames.length; i++) {
    if ((frames[i].mask?.n || 0) > (frames[hitIndex].mask?.n || 0)) hitIndex = i;
  }
  return {
    objectType,
    box: sized,
    pivotX: pivot.x,
    pivotY: pivot.y,
    frames,
    hitIndex,
    beam: extra.beam || null,
    blend: storedBlend(extra.blend),
    fps: extra.fps > 0 ? extra.fps : 8,
    timed: extra.fps > 0,
    scale: extra.scale > 0 ? extra.scale : 1,
    scaleWith: extra.scaleWith || null,
    anchor: extra.anchor || null,
    loop: !!extra.loop,
    hit: extra.hit !== false,
    flicker: !!extra.flicker,
    spin: extra.spin > 0 ? extra.spin : 0,
    pulse: extra.pulse > 0 ? extra.pulse : 0,
    reach: extra.reach > 0 ? extra.reach : 0,
    peak: extra.peak || null,
    peakAnim: extra.peakAnim || null,
    peakFrame: extra.peakFrame ?? -1,
    detonate: extra.detonate || null,
    frontGap: extra.frontGap > 0 ? extra.frontGap : 16,
    holdLast: !!extra.holdLast,
    flip: !!extra.flip,
    bothSides: !!extra.bothSides,
    releaseFlash: !!extra.releaseFlash,
    comboFrames: !!extra.comboFrames,
    crackFrames: !!extra.crackFrames,
    order: Array.isArray(extra.order) ? extra.order.map((n) => n | 0) : null,
    fadeAfter: !!extra.fadeAfter,
    fadeMs: extra.fadeMs > 0 ? extra.fadeMs : 280,
    shrinkAfter: !!extra.shrinkAfter,
    paceCharge: !!extra.paceCharge,
    stretch: extra.stretch === 'length' ? 'length' : null,
    sign: !!extra.sign,
    guardAt: extra.guardAt > 0 ? extra.guardAt | 0 : 0,
    spriteAura: !!extra.spriteAura,
    squash: extra.squash > 0 ? extra.squash : 0,
    holdAt: typeof extra.holdAt === 'number' ? extra.holdAt | 0 : -1,
    breakFrom: typeof extra.breakFrom === 'number' ? extra.breakFrom | 0 : -1,
    overCoat: !!extra.overCoat,
    heatAt: typeof extra.heatAt === 'number' ? extra.heatAt | 0 : -1,
    lifeMs: extra.lifeMs > 0 ? extra.lifeMs | 0 : 0,
    puddle: !!extra.puddle,
    ghost: extra.ghost === true ? 0.18 : (extra.ghost > 0 ? Number(extra.ghost) : 0),
    releaseImpact: !!extra.releaseImpact,
    once: !!extra.once,
    aim: extra.aim !== false,
    keepSlash: !!extra.keepSlash,
    oneshot: !!extra.oneshot,
    stageFit: !!extra.stageFit,
    maxAlpha: extra.maxAlpha > 0 && extra.maxAlpha < 1 ? extra.maxAlpha : 0,
  };
}

function fxUrl(rel) {
  return `/assets/fx/${String(rel || '').replace(/^\/+/, '')}`;
}

/** How far the current FX decode has got. The match card reads this. */
export const fxLoadState = { done: 0, total: 0, busy: false };

let fxTail = Promise.resolve();

function rosterOf(scene, roster) {
  if (roster?.length) return roster.filter((c) => c?.id);
  const out = [];
  const seen = new Set();
  for (const fighter of scene?.fighters || []) {
    const char = fighter?.charDef;
    if (!char?.id || seen.has(char.id)) continue;
    seen.add(char.id);
    out.push(char);
  }
  return out;
}

function artCached(scene, key) {
  if (!byKey.has(key)) return false;
  const tex = byKey.get(key)?.frames?.[0]?.key;
  if (!tex) return true;
  const textures = textureStore(scene);
  return !textures?.exists || textures.exists(tex);
}

/** Decode painted FX for these fighters. Calls share one queue, so a stage
 *  select that starts the work and a battle that awaits it do not decode twice. */
export function collectFxArt(scene, roster) {
  if (!scene || typeof fetch !== 'function' || typeof document === 'undefined') return Promise.resolve();
  const job = fxTail.then(() => collectFxArtNow(scene, roster));
  fxTail = job.catch(() => {});
  return job;
}

async function collectFxArtNow(scene, roster) {
  const index = await readIndex();
  const chars = rosterOf(scene, roster);
  const jobs = [];
  const queue = (key, run) => {
    if (artCached(scene, key)) return;
    byKey.set(key, null);
    jobs.push(async () => {
      try {
        byKey.set(key, await run());
      } catch {
        byKey.set(key, null);
      }
    });
  };
  for (const char of chars) {
    for (const [slot, move] of Object.entries(char.moves || {})) {
      if (!move?.name) continue;
      queue(fxKey(char.id, move.name), () => loadMoveArt(scene, char, slot, move, index));
    }
  }
  const seen = new Set();
  for (const char of chars) {
    if (seen.has(char.id)) continue;
    seen.add(char.id);
    queue(`${char.id}/_hit`, () => loadHitSpark(scene, char, index));
    const freezeRel = `${char.id}/freeze-block/sheet.png`;
    const wantFreeze = index ? listed(index, freezeRel) : char.id === 'nitra';
    if (wantFreeze) queue(`${char.id}/_freeze`, () => loadNamedSheet(scene, char, 'freeze-block', index));
  }
  for (const name of ['on-fire', 'on-fire-small', 'smoke-wisp']) {
    queue(`status/${name}`, () => loadStatusSheet(scene, name, index));
  }
  queue('status/poison', () => loadSharedStatus(scene, index));
  if (!index || listed(index, 'ruth/metathesis-line/fx.json')) {
    queue('ruth/metathesis-line', () => loadFolderSheet(scene, 'ruth', 'metathesis-line', index));
  }
  if (!jobs.length) return;
  // Two at a time. Every sheet is read back in full for its hit mask, and
  // running the whole roster at once stalls the tab for seconds.
  fxLoadState.busy = true;
  fxLoadState.done = 0;
  fxLoadState.total = jobs.length;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(2, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await job();
      fxLoadState.done++;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  await Promise.all(workers);
  fxLoadState.busy = false;
}

/** Texture keys for every loaded FX frame, including side layers and peaks. */
export function fxTextureKeys() {
  const keys = [];
  const seenKey = new Set();
  const seenArt = new WeakSet();
  const add = (key) => {
    if (typeof key !== 'string' || !key || seenKey.has(key)) return;
    seenKey.add(key);
    keys.push(key);
  };
  const visit = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 5 || seenArt.has(node)) return;
    if (typeof node.key === 'string') add(node.key);
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    seenArt.add(node);
    if (Array.isArray(node.frames)) visit(node.frames, depth + 1);
    for (const name of ['peak', 'peakAnim', 'detonate']) visit(node[name], depth + 1);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object' && Array.isArray(value.frames)) visit(value, depth + 1);
    }
  };
  for (const art of byKey.values()) visit(art, 0);
  return keys;
}

export function fxNamed(key) {
  return byKey.get(key) || null;
}

async function loadStatusSheet(scene, name, index) {
  const folder = `status/${name}`;
  if (index && !listed(index, `${folder}/sheet.png`)) return null;
  const meta = await loadFxMeta(folder, index);
  const spec = { ...meta, file: 'sheet.png' };
  const pivot = pivotFrom(spec, { x: 0.5, y: 0.5 });
  const loaded = await loadSpecFrames(
    scene, 'status', name, folder, spec, index,
    pivot, 132, { w: 64, h: 64 }, '',
  );
  if (!loaded?.frames?.length) return null;
  return artRecord('area or burst', { w: 64, h: 64 }, pivot, loaded.frames, {
    blend: meta.blend,
    fps: meta.fps,
    loop: !!meta.loop,
    hit: false,
    anchor: 'body',
    scale: meta.scale,
  });
}

async function loadFolderSheet(scene, id, folderName, index) {
  const folder = `${id}/${folderName}`;
  const meta = await loadFxMeta(folder, index);
  const file = meta.file || 'sheet.png';
  if (index && !listed(index, `${folder}/${file}`)) return null;
  const spec = { ...meta, file };
  const pivot = pivotFrom(spec, { x: 0, y: 0.5 });
  const loaded = await loadSpecFrames(
    scene, id, folderName, folder, spec, index, pivot, 100, { w: 240, h: 16 }, '',
  );
  if (!loaded?.frames?.length) return null;
  return artRecord('beam', { w: 240, h: 16 }, pivot, loaded.frames, {
    blend: meta.blend, fps: meta.fps, loop: !!meta.loop, hit: false,
  });
}

async function loadNamedSheet(scene, char, folderName, index) {
  const folder = `${char.id}/${folderName}`;
  if (!listed(index, `${folder}/sheet.png`)) return null;
  const meta = await loadFxMeta(folder, index);
  const spec = { ...meta, file: 'sheet.png' };
  const pivot = pivotFrom(spec, { x: 0.5, y: 0.5 });
  const loaded = await loadSpecFrames(
    scene, char.id, folderName, folder, spec, index,
    pivot, fighterHeight(char), { w: 64, h: 64 }, '',
  );
  if (!loaded?.frames?.length) return null;
  return artRecord('area or burst', { w: 64, h: 64 }, pivot, loaded.frames, {
    blend: meta.blend, fps: meta.fps, loop: !!meta.loop, hit: false, anchor: meta.anchor || 'body',
  });
}

async function loadHitSpark(scene, char, index) {
  const folder = `${char.id}/hit-spark`;
  if (!listed(index, `${folder}/sheet.png`)) return null;
  const meta = await loadFxMeta(folder, index);
  const spec = { ...meta, file: 'sheet.png' };
  const loaded = await loadSpecFrames(
    scene, char.id, 'hit-spark', folder, spec, index,
    pivotFrom(spec, { x: 0.5, y: 0.5 }), fighterHeight(char), { w: 48, h: 48 }, '',
  );
  if (!loaded?.frames?.length) return null;
  return artRecord('slash arc', { w: 48, h: 48 }, { x: 0.5, y: 0.5 }, loaded.frames, {
    blend: meta.blend, fps: meta.fps, hit: false, anchor: 'contact',
  });
}

/** Shared status sheets (poison, and later on-fire) load for every match. */
async function loadSharedStatus(scene, index) {
  const folder = 'status/poison';
  const meta = await loadFxMeta(folder, index);
  const file = meta.file || 'poison-status-sheet.jpg';
  if (!listed(index, `${folder}/${file}`)) return null;
  const spec = { ...meta, file };
  const pivot = pivotFrom(spec, { x: 0.5, y: 1 });
  const loaded = await loadSpecFrames(
    scene, 'status', 'poison', folder, spec, index, pivot, 132, { w: 48, h: 64 }, '',
  );
  if (!loaded?.frames?.length) return null;
  return artRecord('area or burst', { w: 48, h: 64 }, pivot, loaded.frames, {
    blend: meta.blend,
    fps: meta.fps,
    loop: meta.loop !== false,
    hit: false,
    anchor: meta.anchor || 'feet',
  });
}

function imageSize(img) {
  return {
    w: img.naturalWidth || img.width || 1,
    h: img.naturalHeight || img.height || 1,
  };
}

function composeBeam(start, tile, end, length, thick, threshold = 0) {
  const canvas = document.createElement('canvas');
  const w = Math.max(1, Math.round(length));
  const h = Math.max(1, Math.round(thick));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const ss = imageSize(start);
  const ts = imageSize(tile);
  const es = imageSize(end);
  const sw = ss.w * (h / ss.h);
  const ew = es.w * (h / es.h);
  const tw = Math.max(1, ts.w * (h / ts.h));
  ctx.drawImage(start, 0, 0, sw, h);
  const endX = Math.max(sw, w - ew);
  for (let x = sw; x < endX - 0.5; x += tw) {
    const piece = Math.min(tw, endX - x);
    ctx.drawImage(tile, 0, 0, ts.w * (piece / tw), ts.h, x, 0, piece, h);
  }
  ctx.drawImage(end, endX, 0, ew, h);
  let data = ctx.getImageData(0, 0, w, h).data;
  if (threshold > 0) {
    data = keyNearBlack(data, w, h, threshold);
    ctx.putImageData(new ImageData(data, w, h), 0, 0);
  }
  const mask = rasterAlpha({ data, width: w, height: h, displayW: length, displayH: thick, pivotX: 0, pivotY: 0.5 });
  return { canvas, mask };
}

function storedBlend(blend) {
  if (blend === 'add' || blend === 'screen') return blend;
  return 'normal';
}

function phaserBlend(blend) {
  if (blend === 'add') return 'ADD';
  if (blend === 'screen') return 'SCREEN';
  return 'NORMAL';
}

function finishFrame(scene, key, data, width, height, displayW, displayH, pivotX, pivotY, blend) {
  const mask = rasterAlpha({
    data, width, height, displayW, displayH, pivotX, pivotY,
  });
  return {
    key: rememberTexture(scene, key, canvasFromPixels(data, width, height)),
    mask,
    displayW,
    displayH,
    blend: storedBlend(blend),
  };
}

function pivotFrom(spec, fallback) {
  let pivot = fallback;
  if (spec?.pivot === 'top') pivot = { x: 0.5, y: 0 };
  else if (spec?.pivot === 'bottom') pivot = { x: 0.5, y: 1 };
  else if (spec?.pivot === 'bottom-left') pivot = { x: 0, y: 1 };
  else if (spec?.pivot === 'right') pivot = { x: 1, y: 0.5 };
  else if (spec?.pivot === 'left') pivot = { x: 0, y: 0.5 };
  else if (spec?.pivot === 'center') pivot = { x: 0.5, y: 0.5 };
  if (typeof spec?.pivotX === 'number' || typeof spec?.pivotY === 'number') {
    return {
      x: typeof spec.pivotX === 'number' ? spec.pivotX : pivot.x,
      y: typeof spec.pivotY === 'number' ? spec.pivotY : pivot.y,
    };
  }
  return pivot;
}

function padBounds(bounds, width, height, pad = 2) {
  const x = Math.max(0, bounds.x - pad);
  const y = Math.max(0, bounds.y - pad);
  const right = Math.min(width, bounds.x + bounds.w + pad);
  const bottom = Math.min(height, bounds.y + bounds.h + pad);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function refSpan(bounds, spec, slices) {
  const fit = spec?.fit || 'width';
  if (spec?.span === 'cell' && slices?.length) {
    let best = 0;
    for (const slice of slices) best = Math.max(best, contentSpan({ w: slice.width, h: slice.height }, fit));
    return best || 1;
  }
  if (spec?.fitFrame != null && bounds[spec.fitFrame]) return contentSpan(bounds[spec.fitFrame], fit);
  let best = 0;
  for (const box of bounds) best = Math.max(best, contentSpan(box, fit));
  return best || 1;
}

async function loadSpecFrames(scene, id, slug, folder, spec, index, pivot, charH, box, prefix) {
  const count = spec?.frames | 0;
  const file = spec?.file || (count > 1 ? 'sheet.png' : 'object.png');
  const rel = `${folder}/${file}`;
  if (!listed(index, rel)) return null;
  const img = await loadBitmap(fxUrl(rel));
  if (!img) return null;
  const pix = pixelsOf(img);
  const cols = spec?.cols | 0;
  const rows = spec?.rows | 0;
  const spans = Array.isArray(spec?.spans) && spec.spans.length ? spec.spans : null;
  const n = spans ? spans.length : (count > 1 ? count : 1);
  const slices = [];
  for (let i = 0; i < n; i++) {
    let slice;
    if (spans) {
      const span = spans[i] || [0, pix.width];
      const x = Math.max(0, Math.min(pix.width - 1, span[0] | 0));
      const room = Math.max(1, pix.width - x);
      const w = Math.max(1, Math.min((span[1] | 0) || room, room));
      slice = {
        data: cropPixels(pix.data, pix.width, pix.height, { x, y: 0, w, h: pix.height }),
        width: w,
        height: pix.height,
      };
    } else if (n === 1) slice = { data: pix.data, width: pix.width, height: pix.height };
    else if (cols > 1 || rows > 1) slice = sliceGrid(pix.data, pix.width, pix.height, cols || n, rows || 1, i);
    else slice = sliceHorizontal(pix.data, pix.width, pix.height, n, i);
    const smoke = !!spec?.luma || (spec?.smokeFrom != null && i >= (spec.smokeFrom | 0));
    const thresh = blackThreshold({ blend: spec?.blend, black: spec?.black });
    const keyed = smoke
      ? lumaToAlpha(slice.data, slice.width, slice.height, thresh || BLACK_LUMA)
      : (thresh > 0 ? keyNearBlack(slice.data, slice.width, slice.height, thresh) : slice.data);
    const blend = smoke
      ? (spec?.blend === 'screen' ? 'screen' : 'normal')
      : storedBlend(spec?.blend);
    slices.push({
      keyed,
      width: slice.width,
      height: slice.height,
      blend,
    });
  }
  if (spec?.loopFade > 0) fadeLoopFrames(slices, spec.loopFade);
  const tint = parseTint(spec?.tint);
  if (tint > 0) {
    const amount = spec.tintAmount > 0 ? spec.tintAmount : 0.55;
    for (const slice of slices) tintPixels(slice.keyed, slice.width, slice.height, tint, amount);
  }
  const bounds = slices.map((slice) => contentBounds(slice.keyed, slice.width, slice.height));
  const fitMode = spec?.fit || null;
  const px = fitMode ? pixelsPerSource(charH, spec?.heightFrac, refSpan(bounds, spec, slices)) : 0;
  const crop = spec?.crop === 'frame';
  const frames = [];
  for (let i = 0; i < slices.length; i++) {
    let data = slices[i].keyed;
    let w = slices[i].width;
    let h = slices[i].height;
    if (crop) {
      const box = padBounds(bounds[i], w, h);
      data = cropPixels(data, w, h, box);
      w = box.w;
      h = box.h;
    }
    let displayW;
    let displayH;
    if (spec?.fit === 'length' && box?.w > 0) {
      // An edge-to-edge beam maps onto the uncharged length. Charge scale stretches width only.
      displayW = Math.max(CELL, box.w);
      displayH = Math.max(CELL, box.w * (h / Math.max(1, w)));
    } else if (spec?.fit === 'stage') {
      // The cell already spans the authored stage. Draw time stretches it to this world's width.
      displayW = Math.max(CELL, w);
      displayH = Math.max(CELL, h);
    } else if (px > 0) {
      displayW = Math.max(CELL, w * px);
      displayH = Math.max(CELL, h * px);
    } else {
      const fitted = fit(box, w, h);
      displayW = fitted.w;
      displayH = fitted.h;
    }
    frames.push(finishFrame(
      scene,
      `fx-${id}-${slug}-${prefix || ''}${i}`,
      data,
      w,
      h,
      displayW,
      displayH,
      pivot.x,
      pivot.y,
      slices[i].blend,
    ));
  }
  const reach = fitMode === 'width' && spec?.heightFrac > 0 ? (charH * spec.heightFrac) / 2 : 0;
  return { frames, reach };
}

const SIDE_SPECS = [
  ['orbit', 'orbit-'], ['burst', 'burst-'], ['splash', 'splash-'], ['impact', 'impact-'], ['charge', 'charge-'],
  ['ignite', 'ignite-'], ['stars', 'stars-'], ['texture', 'texture-'],
  ['cling', 'cling-'], ['shatter', 'shatter-'],
  ['launch', 'launch-'], ['shower', 'shower-'], ['muzzle', 'muzzle-'],
  ['ember', 'ember-'], ['spark', 'spark-'], ['cinder', 'cinder-'], ['mote', 'mote-'], ['puff', 'puff-'],
  ['gas', 'gas-'], ['fizzle', 'fizzle-'], ['linger', 'linger-'],
  ['trail', 'trail-'], ['stain', 'stain-'],
  ['flame', 'flame-'], ['stick', 'stick-'],
];

async function attachSides(scene, id, slug, folder, meta, index, charH, sized, record) {
  const inherit = { blend: meta.blend, black: meta.black };
  for (const [name, prefix] of SIDE_SPECS) {
    const spec = meta[name];
    if (!spec?.file) continue;
    const merged = { ...inherit, ...spec };
    const pivot = pivotFrom(merged, { x: 0.5, y: 0.5 });
    const loaded = await loadSpecFrames(scene, id, slug, folder, merged, index, pivot, charH, sized, prefix);
    if (!loaded?.frames?.length) continue;
    record[name] = artRecord(record.objectType, sized, pivot, loaded.frames, {
      blend: merged.blend,
      fps: merged.fps,
      anchor: merged.anchor || null,
      loop: !!merged.loop,
      hit: false,
      flip: !!merged.flip,
      fadeAfter: !!merged.fadeAfter,
      shrinkAfter: !!merged.shrinkAfter,
      fadeMs: merged.fadeMs,
      squash: merged.squash,
      scale: merged.scale,
      lifeMs: merged.lifeMs,
      order: merged.order,
      pulse: merged.pulse,
      maxAlpha: merged.maxAlpha,
      scaleWith: merged.scaleWith || null,
    });
  }
  return record;
}

async function loadMoveArt(scene, char, slot, move, index) {
  const id = char.id;
  const folder = fxFolder(id, move.name).replace(/^assets\/fx\//, '');
  const objectType = objectTypeOf(move, slot);
  const sized = effectBox(char, move, objectType);
  const pivot = objectType === 'slash arc' || objectType === 'extend' || objectType === 'beam'
    ? { x: 0, y: 0.5 }
    : { x: 0.5, y: 0.5 };
  const meta = await loadFxMeta(folder, index);
  const pinned = sheetPlayOrder(folder);
  if (pinned) meta.order = pinned;
  const charH = fighterHeight(char);
  const slug = moveSlug(move.name);
  const look = {
    blend: meta.blend,
    fps: meta.fps,
    scale: meta.scale,
    scaleWith: meta.scaleWith || null,
    anchor: meta.anchor || null,
    loop: !!meta.loop,
    hit: meta.hit !== false,
    aim: meta.aim !== false,
    flicker: !!meta.flicker,
    stretch: meta.stretch === 'length' ? 'length' : null,
    sign: !!meta.sign,
    guardAt: meta.guardAt | 0,
    spriteAura: !!meta.spriteAura,
    squash: meta.squash,
    spin: meta.spin,
    pulse: meta.pulse,
    frontGap: meta.frontGap,
    releaseImpact: !!meta.releaseImpact,
    once: !!meta.once,
    keepSlash: !!meta.keepSlash,
    oneshot: !!meta.oneshot,
    stageFit: meta.fit === 'stage',
    maxAlpha: meta.maxAlpha > 0 && meta.maxAlpha < 1 ? meta.maxAlpha : 0,
  };
  const inherit = { blend: meta.blend, black: meta.black };

  if (meta.projectile?.file || meta.detonate?.file) {
    const shotSpec = { ...inherit, ...(meta.projectile || { file: 'object.png' }) };
    const shotPivot = pivotFrom(shotSpec, { x: 0.5, y: 0.5 });
    const shot = await loadSpecFrames(scene, id, slug, folder, shotSpec, index, shotPivot, charH, sized, 'shot-');
    const detSpec = meta.detonate ? { ...inherit, ...meta.detonate } : null;
    const det = detSpec
      ? await loadSpecFrames(scene, id, slug, folder, detSpec, index, pivotFrom(detSpec, { x: 0.5, y: 1 }), charH, sized, 'det-')
      : null;
    if (!shot?.frames?.length) return null;
    // A melee that also throws (Nickel and Dime) keeps the painted shot on the
    // projectile. The punch stays the attack pose.
    const shotType = meta.projectile?.file && (objectType === 'slash arc' || objectType === 'extend')
      ? 'projectile'
      : objectType;
    const detonate = det?.frames?.length
      ? artRecord(objectType, sized, pivotFrom(detSpec, { x: 0.5, y: 1 }), det.frames, {
        ...look,
        blend: detSpec.blend,
        fps: detSpec.fps,
        loop: detSpec.loop != null ? !!detSpec.loop : look.loop,
        anchor: detSpec.anchor || 'ground',
        maxAlpha: detSpec.maxAlpha > 0 && detSpec.maxAlpha < 1 ? detSpec.maxAlpha : look.maxAlpha,
        beam: null,
      })
      : null;
    const record = artRecord(shotType, sized, shotPivot, shot.frames, {
      ...look,
      blend: shotSpec.blend,
      spin: shotSpec.spin,
      pulse: shotSpec.pulse,
      reach: shot.reach,
      fps: shotSpec.fps || look.fps,
      loop: shotSpec.loop != null ? !!shotSpec.loop : look.loop,
      once: shotSpec.once != null ? !!shotSpec.once : look.once,
      scaleWith: shotSpec.scaleWith || look.scaleWith,
      hit: shotSpec.hit === false ? false : look.hit,
      aim: shotSpec.aim !== false,
      detonate,
      beam: null,
    });
    await attachSides(scene, id, slug, folder, meta, index, charH, sized, record);
    return record;
  }

  const named = typeof meta.file === 'string' && listed(index, `${folder}/${meta.file}`) ? meta.file : null;
  const useSheet = named
    ? (meta.frames | 0) > 1
    : (meta.frames | 0) > 1 && listed(index, `${folder}/sheet.png`);
  const useObject = !useSheet && !named && (meta.anchor || meta.heightFrac || meta.fit) && listed(index, `${folder}/object.png`);
  if (useSheet || useObject || named) {
    const spec = { ...inherit, ...meta, file: named || (useSheet ? 'sheet.png' : 'object.png') };
    const usedPivot = pivotFrom(spec, pivot);
    const loaded = await loadSpecFrames(scene, id, slug, folder, spec, index, usedPivot, charH, sized, '');
    if (loaded?.frames?.length) {
      let peak = null;
      let peakAnim = null;
      const peakFile = typeof meta.peak === 'string' ? meta.peak : meta.peak?.file;
      if (peakFile && listed(index, `${folder}/${peakFile}`)) {
        const peakExtra = meta.peak && typeof meta.peak === 'object' ? meta.peak : {};
        const peakSpec = {
          ...inherit,
          blend: 'add',
          fit: spec.fit || 'width',
          heightFrac: spec.heightFrac,
          black: spec.black,
          crop: spec.crop,
          ...peakExtra,
          file: peakFile,
        };
        const peakPivot = pivotFrom(peakSpec, { x: 0.5, y: 0.5 });
        const peakLoaded = await loadSpecFrames(
          scene, id, slug, folder, peakSpec, index, peakPivot, charH, sized, 'peak-',
        );
        if ((peakSpec.frames | 0) > 1 && peakLoaded?.frames?.length > 1) {
          peakAnim = artRecord('area or burst', sized, peakPivot, peakLoaded.frames, {
            blend: peakSpec.blend,
            fps: peakSpec.fps,
            loop: !!peakSpec.loop,
            hit: false,
            anchor: peakSpec.anchor || null,
          });
        } else {
          peak = peakLoaded?.frames?.[0] || null;
        }
      }
      const record = artRecord(objectType, sized, usedPivot, loaded.frames, {
        ...look, reach: loaded.reach, peak, peakAnim, peakFrame: meta.peakFrame ?? -1, beam: null,
        holdLast: !!meta.holdLast, flip: !!meta.flip, bothSides: !!meta.bothSides, releaseFlash: !!meta.releaseFlash, comboFrames: !!meta.comboFrames, crackFrames: !!meta.crackFrames,
        order: meta.order, fadeAfter: !!meta.fadeAfter, fadeMs: meta.fadeMs, paceCharge: !!meta.paceCharge,
        holdAt: meta.holdAt, breakFrom: meta.breakFrom, overCoat: meta.overCoat, heatAt: meta.heatAt,
        lifeMs: meta.lifeMs, puddle: !!meta.puddle, ghost: meta.ghost,
      });
      await attachSides(scene, id, slug, folder, meta, index, charH, sized, record);
      return record;
    }
  }

  const wantBeam = objectType === 'beam' || objectType === 'extend';
  const capRel = `${folder}/cap-start.png`;
  const tileRel = `${folder}/tile.png`;
  const endRel = `${folder}/cap-end.png`;
  if (wantBeam && listed(index, capRel) && listed(index, tileRel) && listed(index, endRel)) {
    const [start, tile, end] = await Promise.all([
      loadBitmap(fxUrl(capRel)),
      loadBitmap(fxUrl(tileRel)),
      loadBitmap(fxUrl(endRel)),
    ]);
    if (start && tile && end) {
      const composed = composeBeam(start, tile, end, sized.w, sized.h, blackThreshold(meta));
      const key = `fx-${id}-${moveSlug(move.name)}-beam`;
      rememberTexture(scene, key, composed.canvas);
      const mask = composed.mask;
      return artRecord(objectType, sized, { x: 0, y: 0.5 }, [{ key, mask, displayW: sized.w, displayH: sized.h }], { ...look, beam: true });
    }
  }

  const frames = [];
  for (let i = 0; i < 8; i++) {
    const rel = `${folder}/frame-${i}.png`;
    if (index && !index.has(rel)) break;
    const frame = await loadFrame(scene, rel, `fx-${id}-${moveSlug(move.name)}-${i}`, sized, pivot.x, pivot.y, meta);
    if (!frame) break;
    frames.push(frame);
  }
  if (!frames.length && listed(index, `${folder}/object.png`)) {
    const one = await loadFrame(scene, `${folder}/object.png`, `fx-${id}-${moveSlug(move.name)}`, sized, pivot.x, pivot.y, meta);
    if (one) frames.push(one);
  }
  if (!frames.length) {
    const record = artRecord(objectType, sized, pivot, [], { ...look, beam: null });
    await attachSides(scene, id, slug, folder, meta, index, charH, sized, record);
    for (const [name] of SIDE_SPECS) {
      if (record[name]?.frames?.length) return record;
    }
    return null;
  }
  return artRecord(objectType, sized, pivot, frames, { ...look, beam: null });
}

export function fxProjectileView(scene, owner, move, x, y) {
  const art = artFor(owner?.charDef?.id, move?.name);
  const frame = art?.frames?.[0];
  if (!frame || !scene?.add?.image || art.stageFit) return null;
  const img = scene.add.image(x, y, frame.key);
  img.setOrigin(art.pivotX, art.pivotY);
  let scale = fxGameplayScale(move, art);
  if (move.chargeBright) {
    const frac = Math.max(0, Math.min(1, Number(move._chargeFrac) || 0));
    scale *= 0.78 + 0.22 * frac;
    img.setAlpha(0.32 + 0.68 * frac);
  }
  img.setDisplaySize(frame.displayW * scale, frame.displayH * scale);
  img.setDepth(16);
  img.setBlendMode?.(phaserBlend(frame.blend || art.blend));
  if (!art.spin && art.aim !== false) {
    const face = owner?.facing || 1;
    img.rotation = face === -1 ? Math.PI : 0;
  } else if (art.aim === false) {
    const face = owner?.facing || 1;
    img.rotation = 0;
    if (face < 0) img.setScale(-Math.abs(img.scaleX || 1), Math.abs(img.scaleY || 1));
  }
  const useMask = art.hit !== false;
  let trail = null;
  if (art.trail?.frames?.length && scene.add?.image) {
    const tFrame = art.trail.frames[0];
    trail = scene.add.image(x, y, tFrame.key);
    trail.setOrigin(art.trail.pivotX ?? 1, art.trail.pivotY ?? 0.5);
    trail.setDisplaySize(tFrame.displayW, tFrame.displayH);
    trail.setDepth(15);
    trail.setBlendMode?.(phaserBlend(tFrame.blend || art.trail.blend));
    const destroy = img.destroy?.bind(img);
    img.destroy = (...args) => {
      if (trail?.scene) trail.destroy();
      return destroy?.(...args);
    };
  }
  return {
    gfx: img,
    fxMask: useMask ? (art.frames[art.hitIndex ?? 0]?.mask || frame.mask) : null,
    fxFrames: art.frames.map((f) => f.key),
    fxMasks: useMask ? art.frames.map((f) => f.mask) : null,
    fxScale: scale,
    fxFps: art.fps || 8,
    fxOnce: !!art.once,
    fxDisplayWs: art.frames.map((f) => f.displayW * scale),
    fxDisplayHs: art.frames.map((f) => f.displayH * scale),
    fxDisplayW: frame.displayW * scale,
    fxDisplayH: frame.displayH * scale,
    fxSpin: art.spin || 0,
    fxPulse: art.pulse || 0,
    fxAim: art.aim !== false,
    fxTrail: trail,
    fxTrailArt: art.trail || null,
  };
}

function stepProjectileTrail(p) {
  const trail = p.fxTrail;
  const art = p.fxTrailArt;
  if (!trail?.setPosition || !art?.frames?.length || !p.gfx) return;
  const frame = art.frames[Math.min(art.frames.length - 1, p._fxFrame || 0)] || art.frames[0];
  if (trail.texture?.key !== frame.key) {
    trail.setTexture?.(frame.key);
    trail.setDisplaySize?.(frame.displayW, frame.displayH);
  }
  trail.setOrigin?.(art.pivotX ?? 1, art.pivotY ?? 0.5);
  trail.setPosition(p.gfx.x, p.gfx.y);
  trail.rotation = Math.atan2(p.vy || 0, p.vx || 1);
}

export function stepFxProjectile(p, time) {
  if (!p?.fxFrames || !p.gfx?.setTexture) return;
  const fps = p.fxFps > 0 ? p.fxFps : 8;
  const raw = Math.floor(Math.max(0, time - (p.born || 0)) / (1000 / fps));
  const i = p.fxOnce
    ? Math.min(p.fxFrames.length - 1, raw)
    : ((raw % p.fxFrames.length) + p.fxFrames.length) % p.fxFrames.length;
  if (i !== p._fxFrame) {
    p._fxFrame = i;
    p.gfx.setTexture(p.fxFrames[i]);
    p.fxMask = p.fxMasks?.[i] || p.fxMask;
    const w = p.fxDisplayWs?.[i] ?? p.fxDisplayW;
    const h = p.fxDisplayHs?.[i] ?? p.fxDisplayH;
    if (w) {
      p.gfx.setDisplaySize(w, h);
      p.fxDisplayW = w;
      p.fxDisplayH = h;
    }
  }
  stepProjectileTrail(p);
  if (p.move?.roll) {
    const face = (p.vx || 1) < 0 ? -1 : 1;
    p.gfx.rotation = 0;
    const sx = Math.abs(p.gfx.scaleX || 1);
    const sy = Math.abs(p.gfx.scaleY || 1);
    p.gfx.setScale(face * sx, sy);
    return;
  }
  if (p.fxSpin) {
    p.gfx.rotation = ((time - (p.born || 0)) / 1000) * p.fxSpin;
    if (p.fxPulse && p.fxDisplayW) {
      const s = 1 + Math.sin((time - (p.born || 0)) / 150) * p.fxPulse;
      p.gfx.setDisplaySize(p.fxDisplayW * s, p.fxDisplayH * s);
    }
    return;
  }
  if (p.fxAim === false) {
    const face = (p.vx || 1) < 0 ? -1 : 1;
    p.gfx.rotation = 0;
    const sx = Math.abs(p.gfx.scaleX || 1);
    const sy = Math.abs(p.gfx.scaleY || 1);
    p.gfx.setScale(face * sx, sy);
    return;
  }
  p.gfx.rotation = Math.atan2(p.vy || 0, p.vx || 1);
}

/** A sprite that stays until the caller destroys it. Zones and lingering walls use this. */
export function placeFxImage(scene, art, x, y, face = 1) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const img = placeStill(scene, art, x, y, 0);
  applyFrameLook(img, art.frames[0], art, 1);
  img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
  applyFacing(img, face);
  return img;
}

/** Advance a placed sheet. holdAt keeps the last forming frame. order ping-pongs. */
export function stepPlacedFx(img, art, elapsed, face = 1) {
  if (!img?.setTexture || !art?.frames?.length) return;
  const index = art.holdAt >= 0 ? shellFrame(art, elapsed) : fxFrameIndex(art, elapsed);
  const frame = art.frames[index] || art.frames[0];
  applyFrameLook(img, frame, art, 1);
  img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
  applyFacing(img, face);
}

/** One full-width flash for a pair of rays. The shots themselves stay invisible. */
export function spawnStageSpan(scene, fighter, art) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const frame = art.frames[0];
  const box = stageSpanSize(scene, frame);
  const face = fighter?.facing || 1;
  const fromLeft = (art.pivotX ?? 0.5) < 0.05;
  const x = fromLeft ? (face < 0 ? box.w : 0) : box.w / 2;
  const y = (fighter?.y ?? 0) - (fighter?.bodyH ?? 80) * 0.5;
  const rot = fromLeft && face < 0 ? Math.PI : 0;
  const img = placeStill(scene, art, x, y, rot);
  applyFrameLook(img, frame, art, 1, box);
  img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
  trackOneShot(scene, img, art, 1, null, 1, box);
  return img;
}

function placeStill(scene, art, x, y, rot) {
  const frame = art.frames[0];
  const img = scene.add.image(x, y, frame.key);
  img.setOrigin(art.pivotX, art.pivotY);
  img.setDisplaySize(frame.displayW, frame.displayH);
  img.setDepth(16);
  applyFrameLook(img, frame, art, 1);
  img.rotation = rot || 0;
  return img;
}

function applyFrameLook(img, frame, art, scale, box) {
  if (!img || !frame) return;
  img.setTexture?.(frame.key);
  if (box?.w > 0 && box?.h > 0) {
    img.setDisplaySize(box.w, box.h);
  } else {
    const along = scale > 0 ? scale : 1;
    const extra = art?.scale > 0 ? art.scale : 1;
    if (art?.stretch === 'length') {
      img.setDisplaySize(frame.displayW * along * extra, frame.displayH * extra);
    } else {
      img.setDisplaySize(frame.displayW * along, frame.displayH * along);
    }
  }
  img.setBlendMode?.(phaserBlend(frame.blend || art?.blend));
}

/** Width and height of the phosphor shower so it covers the charged rain fan. */
export function flareCover(move, bodyH = 118) {
  const spread = move?.rainSpread > 0 ? move.rainSpread : 150;
  const life = (move?.projectileLife > 0 ? move.projectileLife : 650) / 1000;
  const width = Math.max(160, (70 + spread * 0.5) * life * 2.35);
  const height = Math.max(200, (bodyH > 0 ? bodyH : 118) * 2.05);
  return { width: Math.round(width), height: Math.round(height) };
}

function showerRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Falling curtain for Phosphor Flare. Width follows the charged spread.
 *  Count grows with charge. Radius tiles that width with the rain droplets. */
export function flareShower(move, bodyH = 118) {
  const spread = move?.rainSpread > 0 ? move.rainSpread : 150;
  const life = move?.projectileLife > 0 ? move.projectileLife : 650;
  const frac = Math.max(0, Math.min(1, Number(move?._chargeFrac) || 0));
  const rain = Math.max(1, move?.rain | 0 || 5);
  const reach = (70 + spread * 0.5) * (life / 1000);
  const width = Math.max(96, Math.round(reach * 2));
  const height = Math.max(160, Math.round((bodyH > 0 ? bodyH : 118) * 1.85));
  const count = Math.round(10 + frac * 14);
  const lane = width / rain;
  const radius = (lane / 2 + 12) / 1.45;
  return { width, height, count, spread, life, frac, radius, rain };
}

/** One seeded layout of the shower. Pieces stay inside the hit width. */
export function flareEmbers(move, bodyH = 118, seed = 1) {
  const shower = flareShower(move, bodyH);
  const rng = showerRng(seed);
  const span = shower.width * 0.86;
  const pieces = [];
  for (let i = 0; i < shower.count; i++) {
    const t = (i + 0.5) / shower.count - 0.5;
    const jitter = (rng() - 0.5) * (span / shower.count) * 0.5;
    pieces.push({
      x: t * span + jitter,
      y: rng() * 28,
      scale: 0.72 + rng() * 0.58,
      rot: (rng() - 0.5) * 1.4,
      spin: (rng() - 0.5) * 1.6,
      vy: 240 + rng() * 150,
      vx: (rng() - 0.5) * 28,
      frame0: Math.floor(rng() * 24),
      kind: i % 4,
      smoke: i % 2 === 0,
    });
  }
  return { ...shower, pieces };
}

/** A move's cling sheet, or the shared on-fire status once that art exists. */
export function burnVisual(cling, status) {
  if (cling?.frames?.length) return cling;
  if (status?.frames?.length) return status;
  return null;
}

/** Source-frame order for a sheet whose cells are not played left to right. */
export function sheetPlayOrder() {
  return null;
}

/** Frame while a shell is held. holdAt keeps the form from playing into the break. */
export function shellFrame(art, elapsed) {
  const n = art?.frames?.length || 1;
  const cap = typeof art?.holdAt === 'number' && art.holdAt >= 0 ? art.holdAt : n - 1;
  const fps = art?.fps > 0 ? art.fps : 8;
  const i = Math.floor(Math.max(0, elapsed || 0) / (1000 / fps));
  return Math.max(0, Math.min(cap, i, n - 1));
}

/** Cyan frames while Overclock is building, red-orange frames once he overheats. */
export function auraFrame(frameCount, heatAt, hot, frac, now, fps = 12) {
  const n = Math.max(1, frameCount | 0);
  const hotAt = heatAt >= 0 ? Math.min(n - 1, heatAt | 0) : Math.max(0, n - 2);
  if (hot) {
    const hotN = Math.max(1, n - hotAt);
    return hotAt + (Math.floor(Math.max(0, now || 0) / 90) % hotN);
  }
  if (typeof frac === 'number') {
    return Math.max(0, Math.min(Math.max(0, hotAt - 1), Math.floor(Math.max(0, frac) * Math.max(1, hotAt))));
  }
  const cool = Math.max(1, hotAt);
  const rate = fps > 0 ? fps : 8;
  return Math.floor(Math.max(0, now || 0) / (1000 / rate)) % cool;
}

/** Shatter burst, or the tail of a sheet kept for the break. */
export function breakFrames(art) {
  if (!art) return null;
  if (art.shatter?.frames?.length) return art.shatter;
  const from = art.breakFrom;
  if (typeof from === 'number' && from >= 0 && art.frames?.length > from) {
    return {
      frames: art.frames.slice(from),
      fps: Math.min(art.fps > 0 ? art.fps : 8, 10),
      blend: art.blend,
      pivotX: 0.5,
      pivotY: 0.5,
      loop: false,
      objectType: 'area or burst',
    };
  }
  return null;
}

/** Steady frames 1–2, then flickering frames 3–4 once the sign has been held. */
export function vacancySignFrame(frameCount, held, now, vacancyAt = 540) {
  const n = frameCount | 0;
  if (n < 4) return 0;
  if ((held || 0) >= vacancyAt) return 2 + (Math.floor(Math.max(0, now || 0) / 70) % 2);
  return Math.floor(Math.max(0, held || 0) / 180) % 2;
}

/** World point at the middle of the sign, where the in-game words sit. */
export function vacancySignPoint(fighter, art) {
  const face = fighter?.facing || 1;
  const bodyW = fighter?.bodyW ?? 40;
  const frame = art?.frames?.[0];
  const x = (fighter?.x ?? 0) + face * bodyW * 0.9;
  const py = art?.pivotY ?? 1;
  const y = (fighter?.y ?? 0) + (0.5 - py) * (frame?.displayH || 0);
  return { x, y };
}

export function fxFrameIndex(art, elapsed) {
  const seq = art?.order?.length ? art.order : null;
  const n = seq ? seq.length : (art?.frames?.length || 1);
  if (n <= 1) return seq ? seq[0] : 0;
  const fps = art.fps > 0 ? art.fps : 8;
  const i = Math.floor(Math.max(0, elapsed) / (1000 / fps));
  const guardAt = !seq ? (art.guardAt | 0) : 0;
  if (guardAt > 0 && guardAt < n) {
    if (i < guardAt) return i;
    const rest = n - guardAt;
    return guardAt + (((i - guardAt) % rest) + rest) % rest;
  }
  const step = art.loop ? ((i % n) + n) % n : Math.min(n - 1, i);
  return seq ? seq[step] : step;
}

function sheetDoneAt(art) {
  const n = art?.order?.length || art?.frames?.length || 1;
  const fps = art?.fps > 0 ? art.fps : 8;
  return n * (1000 / fps);
}

/** 1 until an ordered sheet finishes, then a linear fade to 0. */
export function fxFadeAlpha(art, elapsed) {
  if (!art?.fadeAfter || art.loop) return 1;
  const done = sheetDoneAt(art);
  if (!(elapsed > done)) return 1;
  const fade = art.fadeMs > 0 ? art.fadeMs : 280;
  return Math.max(0, 1 - (elapsed - done) / fade);
}

/** 1 until the sheet finishes, then a linear shrink to 0 over the fade. */
export function fxShrink(art, elapsed) {
  if (!art?.shrinkAfter || art.loop) return 1;
  const done = sheetDoneAt(art);
  if (!(elapsed > done)) return 1;
  const fade = art.fadeMs > 0 ? art.fadeMs : 280;
  return Math.max(0, 1 - (elapsed - done) / fade);
}

/** Nearest floor at or below a blast, so a cloud can sit on the ground. */
export function groundTop(scene, x, fromY) {
  const stage = scene?.stage;
  if (!stage) return fromY ?? 0;
  let best = null;
  const take = (top, left, right) => {
    if (top == null || left == null || right == null) return;
    if (x < left - 12 || x > right + 12) return;
    if (fromY != null && top < fromY - 24) return;
    if (best == null || top < best) best = top;
  };
  for (const solid of stage.solids || []) {
    take(solid.y ?? stage.groundY, solid.x - solid.w / 2, solid.x + solid.w / 2);
  }
  for (const plat of stage.platforms || []) {
    take(plat.y, plat.x - plat.w / 2, plat.x + plat.w / 2);
  }
  return best ?? stage.groundY ?? fromY ?? 0;
}

export function fxAnchor(fighter, move) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length) return null;
  const face = fighter.facing || 1;
  const bodyH = fighter.bodyH ?? 80;
  const bodyW = fighter.bodyW ?? 40;
  if (art.objectType === 'beam') {
    const posed = sheetReleasePoint(fighter, 'shot') || sheetFxPoint(fighter, 'shot');
    return {
      x: posed?.x ?? fighter.x + face * bodyW * 0.2,
      y: posed?.y ?? fighter.y - bodyH * 0.62,
      scale: move._beamScale > 0 ? move._beamScale : 1,
    };
  }
  if (art.anchor === 'ground-front' || (art.objectType === 'shield' && move.kind === 'wall' && art.anchor)) {
    return {
      x: fighter.x + face * (bodyW / 2 + (art.frontGap ?? 16)),
      y: fighter.y,
      scale: 1,
    };
  }
  if (art.objectType === 'shield' && move.kind === 'wall') {
    return {
      x: fighter.x + face * (bodyW / 2 + 16),
      y: fighter.y - (move.wallRangeH ?? 120) / 2,
      scale: 1,
    };
  }
  if (art.objectType === 'shield') {
    return { x: fighter.x, y: fighter.y - bodyH * 0.5, scale: 1 };
  }
  if (art.anchor === 'ground') {
    return {
      x: fighter.x + face * (move?.offsetX ?? 0),
      y: fighter.y,
      scale: 1,
    };
  }
  return null;
}

const oneShots = [];
const embers = [];

function trackOneShot(scene, img, art, scale, peak, face = 1, box = null) {
  const fps = art.fps > 0 ? art.fps : 8;
  const frames = art.frames?.length || 1;
  const life = art.lifeMs > 0
    ? art.lifeMs
    : frames > 1 ? (frames / fps) * 1000 + 40 : (art.objectType === 'shield' ? 500 : art.objectType === 'beam' ? 110 : 180);
  oneShots.push({
    img, art, scale, peak, face, box, born: scene.simNow ?? 0, life,
  });
}

function applyFacing(img, face) {
  if (!img || !(face < 0)) return;
  img.setScale(-Math.abs(img.scaleX || 1), Math.abs(img.scaleY || 1));
}

function stepOneShots(scene) {
  const now = scene.simNow ?? 0;
  for (let i = oneShots.length - 1; i >= 0; i--) {
    const shot = oneShots[i];
    if (!shot.img?.scene) {
      shot.peak?.destroy?.();
      oneShots.splice(i, 1);
      continue;
    }
    const elapsed = now - shot.born;
    const frame = shot.art.frames[fxFrameIndex(shot.art, elapsed)] || shot.art.frames[0];
    applyFrameLook(shot.img, frame, shot.art, shot.scale, shot.box);
    applyFacing(shot.img, shot.face);
    const cap = shot.art.maxAlpha > 0 ? shot.art.maxAlpha : 1;
    shot.img.setAlpha?.(fxFadeAlpha(shot.art, elapsed) * cap);
    if (shot.peak?.scene) {
      const on = shot.art.peakFrame === fxFrameIndex(shot.art, elapsed);
      shot.peak.setVisible(on);
      shot.peak.setPosition(shot.img.x, shot.img.y);
      shot.peak.setDisplaySize(shot.peak._fxW * shot.scale, shot.peak._fxH * shot.scale);
      shot.peak.setAlpha(on ? 0.72 : 0);
    }
    if (shot.art?.peakAnim?.frames?.length && !shot.peakSpawned) {
      const idx = fxFrameIndex(shot.art, elapsed);
      const at = shot.art.peakFrame ?? 0;
      if (at < 0 || idx >= at) {
        playPacked(scene, shot.art.peakAnim, shot.img.x, shot.img.y, 1);
        oneShots[oneShots.length - 1]?.img?.setDepth?.(17);
        shot.peakSpawned = true;
      }
    }
    if (elapsed >= shot.life) {
      shot.img.destroy?.();
      shot.peak?.destroy?.();
      oneShots.splice(i, 1);
    }
  }
}

/** One additive sprite from an already-loaded side, such as the ribbon ignite. */
export function spawnFxSprite(scene, art, x, y, scale = 1, face = 1, box = null) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const img = placeStill(scene, art, x, y, 0);
  applyFrameLook(img, art.frames[0], art, scale, box);
  applyFacing(img, face);
  trackOneShot(scene, img, art, scale, null, face, box);
  return img;
}

export function drawFxOneShot(scene, fighter, move, x, y, scale = 1) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !scene?.add?.image) return null;
  if (art.anchor === 'trail' || art.anchor === 'ground-front' || art.anchor === 'body' || art.anchor === 'front' || art.anchor === 'lance' || art.anchor === 'feet' || art.anchor === 'aura' || art.anchor === 'pin') return null;
  if (art.objectType === 'projectile' || art.objectType === 'thrown') return null;
  if ((art.objectType === 'slash arc' || art.objectType === 'extend') && !art.oneshot) return null;
  const face = art.bothSides ? 1 : (art.flip ? (fighter?.facing || 1) : 1);
  const rot = art.objectType === 'beam' && (fighter?.facing || 1) === -1 ? Math.PI : 0;
  const img = placeStill(scene, art, x, y, rot);
  applyFrameLook(img, art.frames[0], art, scale);
  applyFacing(img, face);
  if (art.bothSides) {
    const mirror = placeStill(scene, art, x, y, 0);
    applyFrameLook(mirror, art.frames[0], art, scale);
    applyFacing(mirror, -1);
    trackOneShot(scene, mirror, art, scale, null, -1);
  }
  let peak = null;
  if (art.peak?.key) {
    peak = scene.add.image(x, y, art.peak.key);
    peak.setOrigin(0.5, 0.5);
    peak.setDepth(17);
    peak.setBlendMode?.('ADD');
    peak.setVisible(false);
    peak._fxW = art.peak.displayW;
    peak._fxH = art.peak.displayH;
  }
  trackOneShot(scene, img, art, scale, peak, face);
  return {
    image: img,
    placement: { mask: (art.frames[art.hitIndex ?? 0] || art.frames[0]).mask, x, y, rot, scale },
  };
}

export function fxDetonatePlacement(scene, fighter, move, x, y) {
  const det = artFor(fighter?.charDef?.id, move?.name)?.detonate;
  if (!det?.frames?.length) return null;
  const frame = det.frames[det.hitIndex ?? 0] || det.frames[0];
  if (!frame?.mask) return null;
  const grounded = det.anchor === 'ground' ? groundTop(scene, x, y) : y;
  return { mask: frame.mask, x, y: grounded, rot: 0, scale: 1 };
}

export function spawnFxDetonate(scene, fighter, move, x, y) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  const det = art?.detonate;
  const placed = fxDetonatePlacement(scene, fighter, move, x, y);
  if (!placed || !det?.frames?.length || !scene?.add?.image || scene.simFast) return placed;
  const img = placeStill(scene, det, placed.x, placed.y, 0);
  img.setDepth(15);
  trackOneShot(scene, img, det, 1, null);
  return placed;
}

export function fxHits(fighter, move, x, y, target, scale = 1, frameIndex = null) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art || art.hit === false) return null;
  const frame = frameIndex != null
    ? art.frames?.[frameIndex] || art.frames?.[0]
    : art.frames?.[art.hitIndex ?? 0] || art.frames?.[0];
  if (!frame?.mask || !target) return null;
  const face = fighter?.facing || 1;
  const rot = (art.objectType === 'beam' || art.objectType === 'slash arc' || art.objectType === 'extend') && face === -1
    ? Math.PI
    : 0;
  return fxPlacementHits({ mask: frame.mask, x, y, rot, scale }, target);
}

export function fxBurstHits(scene, fighter, move, x, y, target) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (art?.detonate && art.detonate.hit !== false && (move?.kind === 'burst' || move?.explodeOnly)) {
    const placed = fxDetonatePlacement(scene, fighter, move, x, y);
    if (!placed) return null;
    return fxPlacementHits(placed, target);
  }
  return fxHits(fighter, move, x, y, target, fxGameplayScale(move, art));
}

export function fxWallTest(fighter, move, target, now) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || art.anchor !== 'ground-front' || art.hit === false) return null;
  const anchor = fxAnchor(fighter, move);
  if (!anchor) return null;
  const elapsed = (now ?? 0) - (fighter.defenseStart ?? now ?? 0);
  return fxHits(fighter, move, anchor.x, anchor.y, target, anchor.scale || 1, fxFrameIndex(art, elapsed));
}

const CONTACT_KITS = new Set(['lillie', 'ben', 'bord', 'carter', 'nitra', 'oxana']);

/** Fist-height point on the leading edge of a melee hitbox. */
export function meleeContactPoint(fighter, move) {
  const posed = sheetFxPoint(fighter, 'melee');
  if (posed) return posed;
  const face = fighter?.facing || 1;
  const bodyH = fighter?.bodyH ?? fighter?.charDef?.art?.bodyH ?? 80;
  const bodyW = fighter?.bodyW ?? fighter?.charDef?.art?.bodyW ?? 40;
  const chest = (fighter?.y ?? 0) - bodyH * 0.55;
  const hb = fighter?.getHitboxRect?.();
  if (hb && hb.width > 0) {
    const y = Math.max(hb.top, Math.min(hb.bottom, chest));
    return { x: face >= 0 ? hb.right : hb.left, y };
  }
  const reach = move?.rangeW ?? Math.round(bodyW * 1.7);
  return { x: (fighter?.x ?? 0) + face * (bodyW * 0.12 + reach), y: chest };
}

/** Per-hit spark or strike on the six new kits, drawn at the fist instead of the torso. */
export function wantsContactSpark(fighter, move) {
  if (!CONTACT_KITS.has(fighter?.charDef?.id)) return false;
  if (move?.kind && move.kind !== 'melee') return false;
  const style = move?.vfx || 'strike';
  return style === 'spark' || style === 'strike';
}

const liveSlash = new WeakMap();
const liveAttached = new WeakMap();

function dropAttached(fighter, live) {
  if (live?.kind === 'trail') fighter.rig?.setDepth?.(0);
  if (live?.hideRig && !((fighter._puddleRiseUntil ?? 0) > (fighter.scene?.simNow ?? 0))) {
    fighter.rig?.setVisible?.(true);
    fighter._puddleHid = false;
  }
  if (live?.fadeRig) fighter.rig?.setAlpha?.(1);
  live?.img?.destroy?.();
  live?.front?.destroy?.();
  live?.lead?.destroy?.();
  if (live) liveAttached.delete(fighter);
}

function ensureTrailLayer(scene, live, slot, frame) {
  let img = live[slot];
  if (!img?.scene) {
    img?.destroy?.();
    img = scene.add.image(0, 0, frame.key);
    img.setDepth(slot === 'lead' ? 9 : 7);
    img.setBlendMode?.('ADD');
    live[slot] = img;
  }
  return img;
}

/** Right-edge crop of a trail texture. Origin stays on the full frame, so the
 *  visible flame still ends at the pivot. */
function cropTrailHead(img, frac) {
  const tw = img.width || 1;
  const th = img.height || 1;
  const w = Math.max(1, Math.round(tw * frac));
  img.setCrop(tw - w, 0, w, th);
}

function attachedWant(scene, fighter) {
  const now = scene.simNow ?? 0;
  if (fighter.state === 'defending' && fighter.defenseMove) {
    const art = artFor(fighter.charDef?.id, fighter.defenseMove.name);
    if (art?.puddle && art.frames?.length) {
      return { art, kind: 'ground', elapsed: now - (fighter.defenseStart ?? now) };
    }
    const coated = coatSpec(fighter.defenseMove);
    const shell = art && !coated;
    if (shell && art.anchor === 'ground-front' && art.frames?.length && !art.linger?.frames?.length) {
      return { art, kind: 'wall', elapsed: now - (fighter.defenseStart ?? now) };
    }
    if (shell && (art.anchor === 'body' || art.anchor === 'front') && art.frames?.length) {
      return { art, kind: art.anchor, elapsed: now - (fighter.defenseStart ?? now) };
    }
    if (shell && art.anchor === 'ground' && art.loop && art.frames?.length) {
      return { art, kind: 'ground', elapsed: now - (fighter.defenseStart ?? now) };
    }
  }
  if (fighter.mitigateUntil > now) {
    const shell = fighter.charDef?.moves?.specialDefense;
    const art = shell && !coatSpec(shell) && artFor(fighter.charDef.id, shell.name);
    if (art?.paceCharge && art.frames?.length) {
      return { art, kind: 'body', elapsed: 0, holdLast: true };
    }
  }
  if (fighter.lingerImmuneUntil > now && fighter.lingerImmune?.includes('radiation')) {
    const ward = fighter.charDef?.moves?.specialDefense;
    const art = ward && !coatSpec(ward) && artFor(fighter.charDef.id, ward.name);
    if (art?.anchor === 'body' && art.frames?.length) {
      return { art, kind: 'body', elapsed: now };
    }
  }
  if (fighter.state === 'attack' && fighter.dashUntil && now < fighter.dashUntil) {
    const art = artFor(fighter.charDef?.id, fighter.currentMove?.name);
    if (art?.anchor === 'trail' && art.frames?.length) {
      return { art, kind: 'trail', elapsed: now - (fighter.dashUntil - (fighter.frameData?.visible || 1) * (scene.stepMs || 16.667)) };
    }
  }
  return null;
}

function syncAttached(scene, fighter) {
  const want = attachedWant(scene, fighter);
  let live = liveAttached.get(fighter);
  if (!want) {
    dropAttached(fighter, live);
    return;
  }
  if (!live?.img?.scene || live.kind !== want.kind) {
    dropAttached(fighter, live);
    live = { img: placeStill(scene, want.art, fighter.x, fighter.y, 0), kind: want.kind };
    // Above the stage (depth 0) and behind Hydra, so the streak is not hidden by the sky.
    if (want.kind === 'trail') {
      fighter.rig?.setDepth?.(5);
      live.img.setDepth(4);
    } else {
      live.img.setDepth(want.kind === 'front' ? 12 : want.kind === 'ground' ? 4 : 10);
    }
    liveAttached.set(fighter, live);
  }
  const art = want.art;
  let index = art.holdAt >= 0 ? shellFrame(art, want.elapsed) : fxFrameIndex(art, want.elapsed);
  if (art.sign) {
    const warn = fighter.defenseMove?.vacancyAt ?? 540;
    index = vacancySignFrame(art.frames.length, want.elapsed, scene.simNow ?? 0, warn);
  } else if (want.holdLast) index = art.frames.length - 1;
  else if (art.paceCharge && fighter.defenseMove?.chargeMs) {
    const frac = Math.min(1, Math.max(0, ((scene.simNow ?? 0) - (fighter.defenseStart ?? 0)) / fighter.defenseMove.chargeMs));
    index = Math.min(art.frames.length - 1, Math.round(frac * (art.frames.length - 1)));
  } else if (want.kind === 'wall' && art.crackFrames) {
    index = Math.min(art.frames.length - 1, fighter.wallHits || 0);
  }
  const frame = art.frames[index] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  const face = fighter.facing || 1;
  if (art.flicker && want.kind !== 'trail') {
    live.img.setAlpha(0.82 + 0.18 * Math.sin((scene.simNow || 0) * 0.02));
  }
  if (want.kind === 'wall' || want.kind === 'body' || want.kind === 'front') {
    const bodyH = fighter.bodyH ?? 80;
    const bodyW = fighter.bodyW ?? 40;
    if (want.kind === 'front') {
      if (art.sign) {
        const at = vacancySignPoint(fighter, art);
        live.img.setOrigin(art.pivotX, art.pivotY);
        live.img.setPosition(at.x, fighter.y);
      } else {
        // frontGap < 3 reads as a body-width factor (Absorb's reach orb);
        // larger values stay pixel offsets used by vacancy signs / walls.
        const gap = art.frontGap ?? 0.72;
        const reach = gap < 3 ? bodyW * gap : bodyW * 0.5 + gap;
        live.img.setPosition(fighter.x + face * reach, fighter.y - bodyH * 0.55);
      }
      live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
    } else if (want.kind === 'body') {
      live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
      if (art.ghost > 0) {
        fighter.rig?.setAlpha?.(art.ghost);
        live.fadeRig = true;
      }
    } else {
      const anchor = fxAnchor(fighter, fighter.defenseMove);
      live.img.setPosition(anchor?.x ?? fighter.x, anchor?.y ?? fighter.y);
      live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
    }
    return;
  }
  if (want.kind === 'ground') {
    live.img.setPosition(fighter.x, fighter.y);
    if (art.puddle) {
      fighter.rig?.setVisible?.(false);
      fighter._puddleHid = true;
      live.hideRig = true;
    }
    return;
  }
  const bodyW = fighter.bodyW ?? 40;
  const bodyH = fighter.bodyH ?? 80;
  // The art's right edge is the bright head. Sit that head on his front so
  // the streak runs back through his body, then paint the head over him.
  const tipX = fighter.x + face * bodyW * 0.85;
  const y = fighter.y - bodyH * 0.52;
  live.img.setPosition(tipX, y);
  const sx = Math.abs(live.img.scaleX || 1);
  const sy = Math.abs(live.img.scaleY || 1);
  live.img.setScale(face * sx, sy);
  const alpha = art.flicker ? 0.88 + 0.12 * Math.sin((scene.simNow || 0) * 0.05) : 1;
  live.img.setAlpha(alpha);

  if (fighter.charDef?.id !== 'hydra') return;
  const front = ensureTrailLayer(scene, live, 'front', frame);
  front.setTexture(frame.key);
  front.setOrigin(art.pivotX, art.pivotY);
  front.setDisplaySize(frame.displayW, frame.displayH);
  cropTrailHead(front, 0.28);
  front.setPosition(tipX, y);
  front.setScale(face * Math.abs(front.scaleX || 1), Math.abs(front.scaleY || 1));
  front.setAlpha(Math.min(1, alpha + 0.06));

  const lead = ensureTrailLayer(scene, live, 'lead', frame);
  lead.setTexture(frame.key);
  lead.setOrigin(art.pivotX, art.pivotY);
  lead.setDisplaySize(frame.displayW * 1.08, frame.displayH * 0.72);
  cropTrailHead(lead, 0.12);
  lead.setPosition(tipX + face * bodyW * 0.42, y);
  lead.setScale(face * Math.abs(lead.scaleX || 1), Math.abs(lead.scaleY || 1));
  lead.setTint?.(0xfff4c8);
  lead.setAlpha(1);
}

const liveFreeze = new WeakMap();

function dropFreeze(fighter) {
  const live = liveFreeze.get(fighter);
  live?.img?.destroy?.();
  if (live) liveFreeze.delete(fighter);
}

/** Frost block follows whoever Cryo Splash froze. */
function syncFreeze(scene, fighter) {
  const now = scene.simNow ?? 0;
  if (!(fighter.frozenUntil > now)) {
    dropFreeze(fighter);
    return;
  }
  const art = fxNamed('nitra/_freeze');
  if (!art?.frames?.length) return;
  let live = liveFreeze.get(fighter);
  if (!live?.img?.scene || live.until !== fighter.frozenUntil) {
    dropFreeze(fighter);
    live = {
      img: placeStill(scene, art, fighter.x, fighter.y, 0),
      until: fighter.frozenUntil,
      born: now,
    };
    live.img.setDepth(14);
    liveFreeze.set(fighter, live);
  }
  const frame = art.frames[fxFrameIndex(art, now - live.born)] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  live.img.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.5);
}

const livePoison = new WeakMap();

function dropPoison(fighter) {
  const live = livePoison.get(fighter);
  live?.img?.destroy?.();
  if (live) livePoison.delete(fighter);
}

/** Toxic fumes follow anyone whose poison timer is still running. */
function syncPoison(scene, fighter) {
  const now = scene.simNow ?? 0;
  if (!(fighter.poisonUntil > now)) {
    dropPoison(fighter);
    return;
  }
  const art = fxNamed('status/poison');
  if (!art?.frames?.length) return;
  let live = livePoison.get(fighter);
  if (!live?.img?.scene) {
    dropPoison(fighter);
    live = { img: placeStill(scene, art, fighter.x, fighter.y, 0), born: now };
    live.img.setDepth(12);
    livePoison.set(fighter, live);
  }
  const frame = art.frames[fxFrameIndex(art, now - live.born)] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  live.img.setPosition(fighter.x, fighter.y);
}

const liveCling = new WeakMap();
const liveTongues = new WeakMap();
const liveSmoke = new WeakMap();

// Limb scatter for the small on-fire tongues: x in body widths, y up the body.
const TONGUE_AT = [
  [0.02, 0.86, -0.35, 0.75],
  [-0.48, 0.66, 0.45, 0.95],
  [0.52, 0.62, -0.2, 0.8],
  [-0.18, 0.34, 0.7, 0.68],
  [0.26, 0.3, -0.55, 0.88],
  [0.0, 0.52, 0.25, 1],
];

const WISP_AT = [
  [-0.22, 0.74, 0.15, 0.72],
  [0.2, 0.82, -0.2, 0.9],
  [0.02, 0.48, 0.05, 0.64],
];

function dropCling(fighter) {
  const live = liveCling.get(fighter);
  live?.img?.destroy?.();
  if (live) liveCling.delete(fighter);
}

function dropSprites(map, fighter) {
  const live = map.get(fighter);
  live?.imgs?.forEach((img) => img.destroy?.());
  if (live) map.delete(fighter);
}

/** Color of the move that lit this burn, shared by the on-fire sheet and the small tongues. */
function burnSourceColor(scene, fighter) {
  const moves = (scene.fighters || []).find((f) => f.charDef?.id === fighter.burnOwnerId)?.charDef?.moves;
  if (!moves || !fighter.burnMove) return 0xffffff;
  for (const move of Object.values(moves)) {
    if (move?.name === fighter.burnMove && move.vfxColor) return move.vfxColor;
  }
  return 0xffffff;
}

function syncScattered(scene, fighter, map, art, spots, tint, show) {
  if (!show || !art?.frames?.length) {
    dropSprites(map, fighter);
    return;
  }
  const now = scene.simNow ?? 0;
  let live = map.get(fighter);
  if (!live?.imgs?.length || live.imgs.some((img) => !img?.scene)) {
    dropSprites(map, fighter);
    const imgs = spots.map(() => {
      const img = placeStill(scene, art, fighter.x, fighter.y, 0);
      img.setDepth(15);
      return img;
    });
    live = { imgs, born: now };
    map.set(fighter, live);
  }
  const bodyH = fighter.bodyH ?? 80;
  const bodyW = fighter.bodyW ?? 40;
  const bob = Math.sin(now / 180) * bodyH * 0.03;
  live.imgs.forEach((img, i) => {
    const spot = spots[i % spots.length];
    const frame = art.frames[(fxFrameIndex(art, now - live.born) + i) % art.frames.length];
    applyFrameLook(img, frame, art, spot[spot.length - 1] || 1);
    if (tint) img.setTint?.(tint);
    else img.clearTint?.();
    img.setPosition(fighter.x + spot[0] * bodyW, fighter.y - spot[1] * bodyH + bob);
    img.rotation = spot[2] || 0;
  });
}

/** Cling follows the target for as long as that burn is lit.
 *  White phosphorus is sticky, so it uses the same slot. A move cling wins;
 *  the shared on-fire status is the fallback when a burn has no sheet of its own.
 *  Small tongues scatter on that shared fire and take the same source tint.
 *  Smoke wisps cover white-phosphorus burns and a smolder that has no own sheet. */
function syncCling(scene, fighter) {
  const now = scene.simNow ?? 0;
  const burning = fighter.burnUntil > now && fighter.burnMove;
  const cling = burning ? artFor(fighter.burnOwnerId, fighter.burnMove)?.cling : null;
  const status = fxNamed('status/on-fire');
  let art = burning ? burnVisual(cling, status) : null;
  const sharedFire = burning && !cling?.frames?.length;
  if (!art?.frames?.length && fighter.clingFrom && fighter.clingFrom.until > now) {
    art = artFor(fighter.clingFrom.id, fighter.clingFrom.move)?.cling || null;
  }
  if (!art?.frames?.length && fighter.buffCling && fighter.heatResistUntil > now && fighter.buffCling.until > now) {
    art = artFor(fighter.buffCling.id, fighter.buffCling.move)?.cling || null;
  }
  if (!art?.frames?.length) {
    dropCling(fighter);
  } else {
    let live = liveCling.get(fighter);
    if (!live?.img?.scene) {
      dropCling(fighter);
      live = { img: placeStill(scene, art, fighter.x, fighter.y, 0), born: now };
      live.img.setDepth(15);
      liveCling.set(fighter, live);
    }
    const frame = art.frames[fxFrameIndex(art, now - live.born)] || art.frames[0];
    applyFrameLook(live.img, frame, art, 1);
    if (art === status) live.img.setTint?.(burnSourceColor(scene, fighter));
    else live.img.clearTint?.();
    const drop = art.anchor === 'body' ? 0.5 : 0.42;
    live.img.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) * drop);
  }
  const tint = burning ? burnSourceColor(scene, fighter) : 0;
  syncScattered(scene, fighter, liveTongues, fxNamed('status/on-fire-small'), TONGUE_AT, tint, sharedFire);
  const smolder = burning && (fighter.burnSticky || sharedFire);
  syncScattered(scene, fighter, liveSmoke, fxNamed('status/smoke-wisp'), WISP_AT, 0, smolder);
}

const EMBER_KINDS = ['ember', 'spark', 'cinder', 'mote'];

/** 60° above horizontal, forward. The launch art points up, so it tilts 30°. */
export function overhandToss(x, y, face, length) {
  const f = (face || 1) < 0 ? -1 : 1;
  const len = length > 0 ? length : 0;
  const tilt = Math.PI / 6;
  return {
    x: x + f * len * Math.sin(tilt),
    y: y - len * Math.cos(tilt),
    rotation: f * tilt,
  };
}

/** Burning shower built from ember pieces. The layout's width is the hit width. */
export function spawnFlareShower(scene, owner, move, layout, origin = null) {
  if (!scene?.add?.image || scene.simFast || !owner) return 0;
  const art = artFor(owner.charDef?.id, move?.name);
  const kinds = EMBER_KINDS.map((name) => art?.[name]).filter((piece) => piece?.frames?.length);
  if (!kinds.length) return 0;
  const spec = layout || flareEmbers(move, owner.bodyH || 118, 1);
  const face = owner.facing || 1;
  const originX = origin?.x ?? (owner.x + face * (owner.bodyW ?? 40) * 0.2);
  const top = origin?.y ?? (owner.y - spec.height);
  const puff = art?.puff?.frames?.length ? art.puff : null;
  const born = scene.simNow ?? 0;
  for (const piece of spec.pieces) {
    const kind = kinds[piece.kind % kinds.length];
    const drawn = (kind.scale > 0 ? kind.scale : 1) * piece.scale;
    const img = placeStill(scene, kind, originX + piece.x, top + piece.y, piece.rot);
    applyFrameLook(img, kind.frames[piece.frame0 % kind.frames.length] || kind.frames[0], kind, drawn);
    img.setDepth(16);
    img.rotation = piece.rot;
    embers.push({
      img, art: kind, scale: drawn,
      rot: piece.rot, spin: piece.spin,
      x: originX + piece.x, y: top + piece.y,
      vx: piece.vx, vy: piece.vy,
      born, life: spec.life,
      frame0: piece.frame0 | 0,
      puff, puffScale: piece.scale * 0.85,
      nextPuff: born + 80, puffLeft: piece.smoke && puff ? 2 : 0,
    });
  }
  return spec.pieces.length;
}

function stepEmbers(scene) {
  const now = scene.simNow ?? 0;
  const dt = Math.min(0.1, Math.max(0, now - (stepEmbers.at ?? now)) / 1000);
  stepEmbers.at = now;
  for (let i = embers.length - 1; i >= 0; i--) {
    const ember = embers[i];
    if (!ember.img?.scene) {
      embers.splice(i, 1);
      continue;
    }
    const elapsed = now - ember.born;
    if (elapsed >= ember.life) {
      ember.img.destroy?.();
      embers.splice(i, 1);
      continue;
    }
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    const frame = ember.art.frames[(ember.frame0 + fxFrameIndex(ember.art, elapsed)) % ember.art.frames.length];
    applyFrameLook(ember.img, frame, ember.art, ember.scale);
    ember.img.setPosition(ember.x, ember.y);
    ember.img.rotation = ember.rot + ember.spin * (elapsed / 1000);
    const fadeAt = ember.life * 0.72;
    ember.img.setAlpha(elapsed > fadeAt ? Math.max(0, 1 - (elapsed - fadeAt) / (ember.life - fadeAt)) : 1);
    if (ember.puffLeft > 0 && now >= ember.nextPuff) {
      ember.puffLeft -= 1;
      ember.nextPuff = now + 160;
      const smoke = placeStill(scene, ember.puff, ember.x, ember.y - 8, 0);
      const scale = (ember.puff.scale > 0 ? ember.puff.scale : 1) * ember.puffScale;
      applyFrameLook(smoke, ember.puff.frames[0], ember.puff, scale);
      smoke.setDepth(14);
      trackOneShot(scene, smoke, ember.puff, scale, null, 1);
    }
  }
}

const liveStick = new WeakMap();

function dropStick(fighter) {
  const live = liveStick.get(fighter);
  live?.img?.destroy?.();
  if (live) liveStick.delete(fighter);
}

/** Battery (or other stuck prop) follows the contact point, then fades out. */
function syncStick(scene, fighter) {
  const now = scene.simNow ?? 0;
  const stuck = fighter.stuckFrom;
  const art = stuck && stuck.until > now ? artFor(stuck.id, stuck.move)?.stick : null;
  if (!art?.frames?.length) {
    dropStick(fighter);
    return;
  }
  let live = liveStick.get(fighter);
  if (!live?.img?.scene) {
    dropStick(fighter);
    live = { img: placeStill(scene, art, fighter.x, fighter.y, 0), born: stuck.born ?? now };
    live.img.setDepth(16);
    liveStick.set(fighter, live);
  }
  const frame = art.frames[fxFrameIndex(art, now - live.born)] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  live.img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
  live.img.setPosition(fighter.x + (stuck.ox || 0), fighter.y + (stuck.oy || 0));
  const left = stuck.until - now;
  live.img.setAlpha(left < 400 ? Math.max(0, left / 400) : 1);
}

export function syncFxActors(scene) {
  if (!scene?.fighters) return;
  stepOneShots(scene);
  stepEmbers(scene);
  for (const fighter of scene.fighters) {
    syncCling(scene, fighter);
    syncPoison(scene, fighter);
    syncAttached(scene, fighter);
    if ((fighter._puddleRiseUntil ?? 0) > (scene.simNow ?? 0)) {
      fighter.rig?.setVisible?.(false);
      fighter._puddleHid = true;
    } else if (fighter._puddleHid && fighter.state !== 'defending') {
      fighter.rig?.setVisible?.(true);
      fighter._puddleHid = false;
    }
    syncHeld(scene, fighter);
    syncStick(scene, fighter);
    syncFreeze(scene, fighter);
    const move = fighter.currentMove;
    const art = artFor(fighter?.charDef?.id, move?.name);
    const swinging = art && art.anchor !== 'lance' && !art.oneshot
      && (art.objectType === 'slash arc' || art.objectType === 'extend')
      && fighter.state === 'attack' && frameInActive(fighter)
      && !sheetDrawsWeapon(fighter);
    let img = liveSlash.get(fighter);
    if (!swinging) {
      if (img) {
        img.destroy?.();
        liveSlash.delete(fighter);
      }
      continue;
    }
    if (!img || !img.scene) {
      img = placeStill(scene, art, fighter.x, fighter.y, 0);
      liveSlash.set(fighter, img);
    }
    const face = fighter.facing || 1;
    let x = fighter.x;
    let y = fighter.y - (fighter.bodyH ?? 80) * 0.55;
    if (art.anchor === 'contact' || art.anchor === 'fist') {
      const tip = meleeContactPoint(fighter, move);
      x = tip.x;
      y = tip.y;
      img.setOrigin(art.anchor === 'fist' ? art.pivotX : 0.5, art.anchor === 'fist' ? art.pivotY : 0.5);
      img.rotation = 0;
    } else {
      img.rotation = face === -1 ? Math.PI : 0;
    }
    img.setPosition(x, y);
    const frames = art.frames;
    if (frames.length > 1) {
      let frame;
      if (art.comboFrames && fighter._comboStep) {
        frame = frames[Math.min(frames.length - 1, Math.max(0, (fighter._comboStep | 0) - 1))];
      } else if (art.anchor === 'contact' || (art.anchor === 'fist' && !art.timed)) {
        const start = fighter.frameData?.startup ?? 0;
        const active = Math.max(1, fighter.frameData?.active ?? 1);
        const along = Math.max(0, (fighter.attackFrame ?? 0) - start) / active;
        frame = frames[Math.min(frames.length - 1, Math.floor(along * frames.length))];
      } else {
        const t = art.timed && art.fps > 0 && scene.simNow != null
          ? Math.floor(scene.simNow / (1000 / art.fps))
          : (fighter.attackFrame || 0);
        frame = frames[((t % frames.length) + frames.length) % frames.length];
      }
      img.setTexture(frame.key);
      img.setDisplaySize(frame.displayW, frame.displayH);
    }
    if (art.anchor === 'contact' || art.anchor === 'fist') {
      img.setScale(face * Math.abs(img.scaleX || 1), Math.abs(img.scaleY || 1));
    }
  }
}

const liveHeld = new WeakMap();

function dropHeld(fighter) {
  const live = liveHeld.get(fighter);
  live?.img?.destroy?.();
  if (live) liveHeld.delete(fighter);
}

function orbitVisible(fighter) {
  const move = fighter.charDef?.moves?.basicCharge;
  if (!move?.orbitWhileCharging) return false;
  if (fighter.state === 'charging') return true;
  return fighter.state === 'attack'
    && fighter.currentMove?.name === move.name
    && (fighter.attackFrame ?? 0) < (fighter.frameData?.startup ?? 1);
}

function lancePhase(fighter, now) {
  const move = fighter.charDef?.moves?.basicCharge;
  if (!move || move.vfx !== 'lance') return null;
  if (fighter.state === 'charging') return 'grow';
  if (fighter.state === 'attack' && fighter.currentMove?.vfx === 'lance') {
    const frame = fighter.attackFrame ?? 0;
    const end = (fighter.frameData?.startup ?? 0) + Math.max(1, fighter.frameData?.active ?? 1);
    if (frame < end) return 'thrust';
  }
  return null;
}

function predictSpot(scene, fighter, lead) {
  let best = null;
  let bestD = Infinity;
  for (const other of scene?.fighters || []) {
    if (other === fighter || !other.alive || other.state === 'ko' || other.state === 'dead') continue;
    const d = Math.hypot((other.x ?? 0) - (fighter.x ?? 0), (other.y ?? 0) - (fighter.y ?? 0));
    if (d < bestD) { bestD = d; best = other; }
  }
  const t = lead > 0 ? lead : 1;
  if (!best) {
    const face = fighter.facing || 1;
    return {
      x: (fighter.x ?? 0) + face * 120,
      y: (fighter.y ?? 0) - (fighter.bodyH ?? 80) * 0.45,
    };
  }
  const vx = best.body?.velocity?.x ?? 0;
  const vy = best.body?.velocity?.y ?? 0;
  return {
    x: best.x + vx * t,
    y: best.y - (best.bodyH ?? 80) * 0.45 + vy * t,
  };
}

function swingFlame(fighter) {
  if (fighter?.state !== 'attack') return null;
  const flame = artFor(fighter.charDef?.id, fighter.currentMove?.name)?.flame;
  if (!flame?.frames?.length || flame.scaleWith !== 'storedHeat') return null;
  return flame;
}

function heatPunch(fighter, charge, art) {
  return fighter?.state === 'attack'
    && fighter.currentMove?.name === charge?.name
    && art?.charge?.scaleWith === 'storedHeat';
}

function syncHeld(scene, fighter) {
  const now = scene.simNow ?? 0;
  const charge = fighter.charDef?.moves?.basicCharge;
  const art = charge && artFor(fighter.charDef?.id, charge.name);
  const torch = swingFlame(fighter);
  let want = null;
  if (art?.orbit?.frames?.length && orbitVisible(fighter)) want = { art: art.orbit, kind: 'orbit' };
  else if (art?.anchor === 'lance' && art.frames?.length) {
    const phase = lancePhase(fighter, now);
    if (phase) want = { art, kind: 'lance', phase };
  } else if (art?.anchor === 'feet' && art.frames?.length && fighter.state === 'charging') {
    want = { art, kind: 'feet' };
  } else if (torch) {
    want = { art: torch, kind: 'grow' };
  } else if (art?.charge?.frames?.length && (fighter.state === 'charging' || heatPunch(fighter, charge, art))) {
    const anchor = art.charge.anchor;
    const kind = anchor === 'feet' ? 'feet' : anchor === 'predict' ? 'predict' : 'grow';
    want = { art: art.charge, kind };
  } else if (art?.anchor === 'aura' && art.frames?.length && charge?.overclock) {
    const charging = fighter.state === 'charging';
    const buffed = (fighter.attackHasteUntil ?? 0) > now;
    if (charging || buffed) want = { art, kind: 'aura', charging };
  } else if (art?.anchor === 'aura' && art.frames?.length && !art.spriteAura) {
    const charging = fighter.state === 'charging';
    const buffed = !!charge?.buff?.attackPower && (fighter.attackPowerUntil ?? 0) > now;
    if (charging || buffed) want = { art, kind: 'aura', charging, sheet: true };
  }
  let live = liveHeld.get(fighter);
  if (!want) {
    dropHeld(fighter);
    return;
  }
  if (!live?.img?.scene || live.kind !== want.kind) {
    dropHeld(fighter);
    live = { img: placeStill(scene, want.art, fighter.x, fighter.y, 0), kind: want.kind, born: now };
    live.img.setDepth(want.kind === 'feet' ? 3 : want.kind === 'grow' ? 11 : want.kind === 'orbit' ? 8 : want.kind === 'aura' ? 9 : 12);
    liveHeld.set(fighter, live);
  }
  const face = fighter.facing || 1;
  const bodyW = fighter.bodyW ?? 40;
  const bodyH = fighter.bodyH ?? 80;
  if (want.kind === 'orbit') {
    const frame = want.art.frames[fxFrameIndex(want.art, now)] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(0.5, 0.5);
    live.img.setPosition(fighter.x, fighter.y - bodyH * 0.45);
    return;
  }
  if (want.kind === 'aura') {
    const frames = want.art.frames;
    const max = charge.maxChargeMs || 1;
    const frac = want.charging
      ? Math.min(1, Math.max(0, (now - (fighter.chargeStart ?? now)) / max))
      : null;
    const hot = (fighter._overheatUntil ?? 0) > now || (want.charging && (frac ?? 0) >= 0.82);
    const elapsed = want.charging ? now - (fighter.chargeStart ?? now) : now;
    const index = want.sheet
      ? fxFrameIndex(want.art, elapsed)
      : auraFrame(frames.length, want.art.heatAt, hot, frac, now, want.art.fps);
    const frame = frames[index] || frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(0.5, 0.5);
    live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
    return;
  }
  if (want.kind === 'grow') {
    const frames = want.art.frames;
    const max = charge?.maxChargeMs || 1;
    const frac = Math.min(1, Math.max(0, (now - (fighter.chargeStart ?? now)) / max));
    const elapsed = want.art.scaleWith === 'storedHeat'
      ? now - (live.born ?? now)
      : now - (fighter.chargeStart ?? now);
    const frame = want.art.loop
      ? (frames[fxFrameIndex(want.art, elapsed)] || frames[0])
      : frames[Math.min(frames.length - 1, Math.round(frac * (frames.length - 1)))];
    applyFrameLook(live.img, frame, want.art, 1);
    if (want.art.scaleWith === 'storedHeat') {
      const held = fighter.state === 'charging' ? (fighter._storedHeat ?? 0) : (fighter._spentHeat ?? 0);
      const look = storedHeatVisual(held, charge?.stealHeat?.cap ?? 14);
      const tip = meleeContactPoint(fighter, fighter.currentMove || charge);
      live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 0.833);
      live.img.setPosition(tip.x, tip.y);
      live.img.rotation = 0;
      const sx = Math.abs(live.img.scaleX || 1) * look.scale;
      const sy = Math.abs(live.img.scaleY || 1) * look.scale;
      live.img.setScale(face * sx, sy);
      live.img.setAlpha(look.alpha);
      return;
    }
    if (want.art.pulse) {
      const pulse = 0.8 + 0.2 * Math.sin((scene.simNow || 0) * 0.012);
      live.img.setAlpha(pulse * (0.42 + 0.58 * frac));
    }
    if (want.art.anchor === 'body' || want.art.anchor === 'hands') {
      const hands = want.art.anchor === 'hands';
      live.img.setOrigin(0.5, 0.5);
      live.img.setPosition(
        hands ? fighter.x + face * bodyW * 0.28 : fighter.x,
        fighter.y - bodyH * (hands ? 0.46 : 0.5),
      );
      if (charge?.perTravel && !hands) {
        const need = charge.perTravel * (charge.perTravelCap ?? 5);
        live.img.setAlpha(Math.min(1, Math.max(0, (fighter.travel ?? 0) / Math.max(1, need))));
      }
      const grow = want.art.scaleWith === 'charge'
        ? 1 + ((charge?.chargeRadiusMult ?? 1) - 1) * frac
        : 1;
      const sx = Math.abs(live.img.scaleX || 1) * grow;
      const sy = Math.abs(live.img.scaleY || 1) * grow;
      if (want.art.flip) {
        const dir = -(fighter.facing || 1);
        live.img.setScale(dir * sx, sy);
      } else if (grow !== 1) {
        live.img.setScale(sx, sy);
      }
      return;
    }
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 1);
    const shot = 1 + ((charge?.chargeRadiusMult ?? 1) - 1) * frac;
    const hand = sheetFxPoint(fighter, 'shot');
    live.img.setPosition(hand?.x ?? (fighter.x + face * bodyW * 0.65), hand?.y ?? fighter.y);
    const mirror = want.art.flip ? -face : face;
    live.img.setScale(mirror * Math.abs(live.img.scaleX || 1) * shot, Math.abs(live.img.scaleY || 1) * shot);
    return;
  }
  if (want.kind === 'predict') {
    const elapsed = now - (fighter.chargeStart ?? now);
    const frame = want.art.frames[fxFrameIndex(want.art, elapsed)] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 0.5);
    const lead = charge?.predict?.lead ?? 1;
    const at = predictSpot(scene, fighter, lead);
    live.img.setPosition(at.x, at.y);
    return;
  }
  if (want.kind === 'feet') {
    const elapsed = now - (fighter.chargeStart ?? now);
    const frame = want.art.frames[fxFrameIndex(want.art, elapsed)] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, fxShrink(want.art, elapsed));
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 1);
    live.img.setPosition(fighter.x, fighter.y);
    live.img.setAlpha(fxFadeAlpha(want.art, elapsed));
    return;
  }
  const frames = want.art.frames;
  let index = frames.length - 1;
  if (want.phase === 'grow') {
    const max = charge.maxChargeMs || 1;
    const frac = Math.min(1, Math.max(0, (now - (fighter.chargeStart ?? now)) / max));
    index = Math.min(frames.length - 1, Math.round(frac * (frames.length - 1)));
  }
  const frame = frames[index];
  live.img.setOrigin(0, 0.5);
  applyFrameLook(live.img, frame, want.art, 1);
  live.img.setPosition(fighter.x + face * bodyW * 0.28, fighter.y - bodyH * 0.55);
  live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
  live.img.rotation = 0;
}

function playPacked(scene, art, x, y, face = 1) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return;
  const img = placeStill(scene, art, x, y, 0);
  const drawn = art.scale > 0 ? art.scale : 1;
  applyFrameLook(img, art.frames[0], art, drawn);
  applyFacing(img, face);
  trackOneShot(scene, img, art, drawn, null, face);
}

export function spawnMoveExtra(scene, fighter, move, which, x, y, face = 1) {
  playPacked(scene, artFor(fighter?.charDef?.id, move?.name)?.[which], x, y, face);
}

function contactAt(attacker, victim, move) {
  const kind = move?.kind;
  if (!kind || kind === 'melee' || kind === 'dash') return meleeContactPoint(attacker, move);
  if (victim) return { x: victim.x, y: victim.y - (victim.bodyH ?? 80) * 0.45 };
  return { x: attacker.x, y: attacker.y - (attacker.bodyH ?? 80) * 0.5 };
}

/**
 * Where the hit actually meets the body. A fist or projectile that sits
 * above the head, or a chest guess that clears a short sprite, is pulled
 * onto the hurtbox so the spark does not hang in empty air.
 */
export function hitAnchor(attacker, victim, move) {
  const raw = move?._hitAt || contactAt(attacker, victim, move);
  if (!raw) return null;
  if (!victim) return raw;
  return clampToBody(victim, raw) || raw;
}

/** Hit spark and move impact, at the contact point. */
export function spawnContactFx(scene, attacker, victim, move) {
  if (!scene || scene.simFast || !attacker) return;
  const at = hitAnchor(attacker, victim, move);
  if (!at) return;
  playPacked(scene, byKey.get(`${attacker.charDef?.id}/_hit`), at.x, at.y, 1);
  const painted = artFor(attacker.charDef?.id, move?.name);
  if (!painted?.releaseImpact) playPacked(scene, painted?.impact, at.x, at.y, 1);
  if (painted?.cling?.frames?.length && victim && move?.onHit?.coat) {
    victim.clingFrom = {
      id: attacker.charDef?.id,
      move: move.name,
      until: (scene.simNow ?? 0) + (move.onHit.coatMs ?? 2000),
    };
  }
}

function frameInActive(fighter) {
  const fd = fighter.frameData;
  if (!fd) return false;
  const frame = fighter.attackFrame ?? 0;
  const start = fd.startup ?? 0;
  const active = Math.max(1, fd.active ?? 1);
  return frame >= start && frame < start + active;
}

export function clearFxIndexCache() {
  indexSet = undefined;
  byKey.clear();
  oneShots.length = 0;
  embers.length = 0;
  stepEmbers.at = undefined;
}
