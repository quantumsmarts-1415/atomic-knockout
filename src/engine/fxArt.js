// Drop-in attack art. A PNG in assets/fx/<fighter>/<move-slug>/ replaces the
// code-drawn effect. Nothing in that folder means the old drawing and the
// old hit shape stay exactly as they are. The hit mask is the alpha of the
// loaded image, packed on the same 5 px grid as body masks.

import { effectBox, fxFolder, moveSlug, objectTypeOf } from '../data/attackFx.js';
import { fxPlacementHits } from './boxes.js';
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

export function fxKey(fighterId, moveName) {
  return `${fighterId}/${moveSlug(moveName)}`;
}

export function artFor(fighterId, moveName) {
  return byKey.get(fxKey(fighterId, moveName)) || null;
}

export function fxReplacesSlash(fighter, move) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length) return false;
  return art.objectType === 'slash arc' || art.objectType === 'extend';
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

function rememberTexture(scene, key, img) {
  if (scene.textures?.exists(key)) scene.textures.remove(key);
  scene.textures.addImage(key, img);
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
    blend: extra.blend === 'add' ? 'add' : 'normal',
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
  };
}

function fxUrl(rel) {
  return `/assets/fx/${String(rel || '').replace(/^\/+/, '')}`;
}

export async function collectFxArt(scene) {
  if (!scene || typeof fetch !== 'function' || typeof document === 'undefined') return;
  const index = await readIndex();
  const jobs = [];
  for (const fighter of scene.fighters || []) {
    const id = fighter?.charDef?.id;
    const moves = fighter?.charDef?.moves || {};
    for (const [slot, move] of Object.entries(moves)) {
      if (!id || !move?.name) continue;
      const key = fxKey(id, move.name);
      const cached = byKey.get(key);
      const tex = cached?.frames?.[0]?.key;
      if (byKey.has(key) && (!tex || scene.textures?.exists?.(tex))) continue;
      byKey.set(key, null);
      jobs.push(
        loadMoveArt(scene, fighter.charDef, slot, move, index)
          .then((art) => byKey.set(key, art))
          .catch(() => byKey.set(key, null)),
      );
    }
  }
  const seen = new Set();
  for (const fighter of scene.fighters || []) {
    const id = fighter?.charDef?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const key = `${id}/_hit`;
    if (!byKey.has(key)) {
      byKey.set(key, null);
      jobs.push(
        loadHitSpark(scene, fighter.charDef, index)
          .then((art) => byKey.set(key, art))
          .catch(() => byKey.set(key, null)),
      );
    }
    const freezeKey = `${id}/_freeze`;
    const freezeRel = `${id}/freeze-block/sheet.png`;
    const wantFreeze = index ? listed(index, freezeRel) : id === 'nitra';
    if (!byKey.has(freezeKey) && wantFreeze) {
      byKey.set(freezeKey, null);
      jobs.push(
        loadNamedSheet(scene, fighter.charDef, 'freeze-block', index)
          .then((art) => byKey.set(freezeKey, art))
          .catch(() => byKey.set(freezeKey, null)),
      );
    }
  }
  await Promise.all(jobs);
}

export function fxNamed(key) {
  return byKey.get(key) || null;
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

function finishFrame(scene, key, data, width, height, displayW, displayH, pivotX, pivotY, blend) {
  const mask = rasterAlpha({
    data, width, height, displayW, displayH, pivotX, pivotY,
  });
  return {
    key: rememberTexture(scene, key, canvasFromPixels(data, width, height)),
    mask,
    displayW,
    displayH,
    blend: blend === 'add' ? 'add' : 'normal',
  };
}

function pivotFrom(spec, fallback) {
  if (spec?.pivot === 'bottom') return { x: 0.5, y: 1 };
  if (spec?.pivot === 'bottom-left') return { x: 0, y: 1 };
  if (spec?.pivot === 'right') return { x: 1, y: 0.5 };
  if (spec?.pivot === 'left') return { x: 0, y: 0.5 };
  if (spec?.pivot === 'center') return { x: 0.5, y: 0.5 };
  return fallback;
}

function padBounds(bounds, width, height, pad = 2) {
  const x = Math.max(0, bounds.x - pad);
  const y = Math.max(0, bounds.y - pad);
  const right = Math.min(width, bounds.x + bounds.w + pad);
  const bottom = Math.min(height, bounds.y + bounds.h + pad);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function refSpan(bounds, spec) {
  const fit = spec?.fit || 'width';
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
  const n = count > 1 ? count : 1;
  const slices = [];
  for (let i = 0; i < n; i++) {
    let slice;
    if (n === 1) slice = { data: pix.data, width: pix.width, height: pix.height };
    else if (cols > 1 || rows > 1) slice = sliceGrid(pix.data, pix.width, pix.height, cols || n, rows || 1, i);
    else slice = sliceHorizontal(pix.data, pix.width, pix.height, n, i);
    const smoke = spec?.smokeFrom != null && i >= (spec.smokeFrom | 0);
    const thresh = blackThreshold({ blend: spec?.blend, black: spec?.black });
    const keyed = smoke
      ? lumaToAlpha(slice.data, slice.width, slice.height, thresh || BLACK_LUMA)
      : (thresh > 0 ? keyNearBlack(slice.data, slice.width, slice.height, thresh) : slice.data);
    slices.push({
      keyed,
      width: slice.width,
      height: slice.height,
      blend: smoke ? 'normal' : (spec?.blend === 'add' ? 'add' : 'normal'),
    });
  }
  const bounds = slices.map((slice) => contentBounds(slice.keyed, slice.width, slice.height));
  const fitMode = spec?.fit || null;
  const px = fitMode ? pixelsPerSource(charH, spec?.heightFrac, refSpan(bounds, spec)) : 0;
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
    flicker: !!meta.flicker,
    stretch: meta.stretch === 'length' ? 'length' : null,
    sign: !!meta.sign,
    guardAt: meta.guardAt | 0,
    spriteAura: !!meta.spriteAura,
    squash: meta.squash,
    spin: meta.spin,
    pulse: meta.pulse,
    frontGap: meta.frontGap,
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
    const detonate = det?.frames?.length
      ? artRecord(objectType, sized, pivotFrom(detSpec, { x: 0.5, y: 1 }), det.frames, {
        ...look, blend: detSpec.blend, fps: detSpec.fps, anchor: detSpec.anchor || 'ground', beam: null,
      })
      : null;
    const record = artRecord(objectType, sized, shotPivot, shot.frames, {
      ...look,
      blend: shotSpec.blend,
      spin: shotSpec.spin,
      pulse: shotSpec.pulse,
      reach: shot.reach,
      fps: shotSpec.fps || look.fps,
      loop: shotSpec.loop != null ? !!shotSpec.loop : look.loop,
      scaleWith: shotSpec.scaleWith || look.scaleWith,
      hit: shotSpec.hit === false ? false : look.hit,
      detonate,
      beam: null,
    });
    await attachSides(scene, id, slug, folder, meta, index, charH, sized, record);
    return record;
  }

  const useSheet = (meta.frames | 0) > 1 && listed(index, `${folder}/sheet.png`);
  const useObject = !useSheet && (meta.anchor || meta.heightFrac || meta.fit) && listed(index, `${folder}/object.png`);
  if (useSheet || useObject) {
    const spec = { ...inherit, ...meta, file: useSheet ? 'sheet.png' : 'object.png' };
    const usedPivot = pivotFrom(spec, pivot);
    const loaded = await loadSpecFrames(scene, id, slug, folder, spec, index, usedPivot, charH, sized, '');
    if (loaded?.frames?.length) {
      let peak = null;
      if (meta.peak && listed(index, `${folder}/${meta.peak}`)) {
        const peakSpec = {
          ...inherit, file: meta.peak, blend: 'add', fit: spec.fit || 'width', heightFrac: spec.heightFrac, black: spec.black,
        };
        const peakLoaded = await loadSpecFrames(
          scene, id, slug, folder, peakSpec, index, { x: 0.5, y: 0.5 }, charH, sized, 'peak-',
        );
        peak = peakLoaded?.frames?.[0] || null;
      }
      const record = artRecord(objectType, sized, usedPivot, loaded.frames, {
        ...look, reach: loaded.reach, peak, peakFrame: meta.peakFrame ?? -1, beam: null,
        holdLast: !!meta.holdLast, flip: !!meta.flip, bothSides: !!meta.bothSides, releaseFlash: !!meta.releaseFlash, comboFrames: !!meta.comboFrames, crackFrames: !!meta.crackFrames,
        order: meta.order, fadeAfter: !!meta.fadeAfter, fadeMs: meta.fadeMs, paceCharge: !!meta.paceCharge,
        holdAt: meta.holdAt, breakFrom: meta.breakFrom, overCoat: meta.overCoat, heatAt: meta.heatAt,
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
      if (scene.textures?.exists(key)) scene.textures.remove(key);
      scene.textures.addImage(key, composed.canvas);
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
  if (!frames.length) return null;
  return artRecord(objectType, sized, pivot, frames, { ...look, beam: null });
}

export function fxProjectileView(scene, owner, move, x, y) {
  const art = artFor(owner?.charDef?.id, move?.name);
  const frame = art?.frames?.[0];
  if (!frame || !scene?.add?.image) return null;
  const img = scene.add.image(x, y, frame.key);
  img.setOrigin(art.pivotX, art.pivotY);
  const scale = fxGameplayScale(move, art);
  img.setDisplaySize(frame.displayW * scale, frame.displayH * scale);
  img.setDepth(16);
  if ((frame.blend || art.blend) === 'add') img.setBlendMode?.('ADD');
  if (!art.spin) {
    const face = owner?.facing || 1;
    img.rotation = face === -1 ? Math.PI : 0;
  }
  const useMask = art.hit !== false;
  return {
    gfx: img,
    fxMask: useMask ? (art.frames[art.hitIndex ?? 0]?.mask || frame.mask) : null,
    fxFrames: art.frames.map((f) => f.key),
    fxMasks: useMask ? art.frames.map((f) => f.mask) : null,
    fxScale: scale,
    fxFps: art.fps || 8,
    fxDisplayW: frame.displayW * scale,
    fxDisplayH: frame.displayH * scale,
    fxSpin: art.spin || 0,
    fxPulse: art.pulse || 0,
  };
}

export function stepFxProjectile(p, time) {
  if (!p?.fxFrames || !p.gfx?.setTexture) return;
  const fps = p.fxFps > 0 ? p.fxFps : 8;
  const i = Math.floor(Math.max(0, time - (p.born || 0)) / (1000 / fps)) % p.fxFrames.length;
  if (i !== p._fxFrame) {
    p._fxFrame = i;
    p.gfx.setTexture(p.fxFrames[i]);
    p.fxMask = p.fxMasks?.[i] || p.fxMask;
    if (p.fxDisplayW) p.gfx.setDisplaySize(p.fxDisplayW, p.fxDisplayH);
  }
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
  p.gfx.rotation = Math.atan2(p.vy || 0, p.vx || 1);
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

function applyFrameLook(img, frame, art, scale) {
  if (!img || !frame) return;
  img.setTexture?.(frame.key);
  const along = scale > 0 ? scale : 1;
  const across = art?.stretch === 'length' ? 1 : along;
  img.setDisplaySize(frame.displayW * along, frame.displayH * across);
  const blend = frame.blend || art?.blend;
  img.setBlendMode?.(blend === 'add' ? 'ADD' : 'NORMAL');
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
    return {
      x: fighter.x + face * bodyW * 0.2,
      y: fighter.y - bodyH * 0.62,
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

function trackOneShot(scene, img, art, scale, peak, face = 1) {
  const fps = art.fps > 0 ? art.fps : 8;
  const frames = art.frames?.length || 1;
  const life = frames > 1 ? (frames / fps) * 1000 + 70 : (art.objectType === 'shield' ? 500 : art.objectType === 'beam' ? 220 : 320);
  oneShots.push({
    img, art, scale, peak, face, born: scene.simNow ?? 0, life,
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
    applyFrameLook(shot.img, frame, shot.art, shot.scale);
    applyFacing(shot.img, shot.face);
    shot.img.setAlpha?.(fxFadeAlpha(shot.art, elapsed));
    if (shot.peak?.scene) {
      const on = shot.art.peakFrame === fxFrameIndex(shot.art, elapsed);
      shot.peak.setVisible(on);
      shot.peak.setPosition(shot.img.x, shot.img.y);
      shot.peak.setDisplaySize(shot.peak._fxW * shot.scale, shot.peak._fxH * shot.scale);
      shot.peak.setAlpha(on ? 0.72 : 0);
    }
    if (elapsed >= shot.life) {
      shot.img.destroy?.();
      shot.peak?.destroy?.();
      oneShots.splice(i, 1);
    }
  }
}

/** One additive sprite from an already-loaded side, such as the ribbon ignite. */
export function spawnFxSprite(scene, art, x, y, scale = 1) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const img = placeStill(scene, art, x, y, 0);
  applyFrameLook(img, art.frames[0], art, scale);
  trackOneShot(scene, img, art, scale, null, 1);
  return img;
}

export function drawFxOneShot(scene, fighter, move, x, y, scale = 1) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !scene?.add?.image) return null;
  if (art.anchor === 'trail' || art.anchor === 'ground-front' || art.anchor === 'body' || art.anchor === 'front' || art.anchor === 'lance' || art.anchor === 'feet' || art.anchor === 'aura') return null;
  if (art.objectType === 'projectile' || art.objectType === 'thrown') return null;
  if (art.objectType === 'slash arc' || art.objectType === 'extend') return null;
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
  return { mask: frame.mask, x, y: groundTop(scene, x, y), rot: 0, scale: 1 };
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
  if (art?.detonate && (move?.kind === 'burst' || move?.explodeOnly)) {
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
    const coated = coatSpec(fighter.defenseMove);
    const art = artFor(fighter.charDef?.id, fighter.defenseMove.name);
    const shell = art && (!coated || art.overCoat);
    if (shell && art.anchor === 'ground-front' && art.frames?.length) {
      return { art, kind: 'wall', elapsed: now - (fighter.defenseStart ?? now) };
    }
    if (shell && (art.anchor === 'body' || art.anchor === 'front') && art.frames?.length) {
      return { art, kind: art.anchor, elapsed: now - (fighter.defenseStart ?? now) };
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
      live.img.setDepth(want.kind === 'front' ? 12 : 10);
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
        live.img.setPosition(fighter.x + face * bodyW * 0.72, fighter.y - bodyH * 0.55);
      }
      live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
    } else if (want.kind === 'body') {
      live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
    } else {
      const anchor = fxAnchor(fighter, fighter.defenseMove);
      live.img.setPosition(anchor?.x ?? fighter.x, anchor?.y ?? fighter.y);
      live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
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

const liveCling = new WeakMap();

function dropCling(fighter) {
  const live = liveCling.get(fighter);
  live?.img?.destroy?.();
  if (live) liveCling.delete(fighter);
}

/** Thermite cling follows the target for as long as that burn is lit. */
function syncCling(scene, fighter) {
  const now = scene.simNow ?? 0;
  const burning = !fighter.burnSticky && fighter.burnUntil > now && fighter.burnMove;
  const art = burning ? artFor(fighter.burnOwnerId, fighter.burnMove)?.cling : null;
  if (!art?.frames?.length) {
    dropCling(fighter);
    return;
  }
  let live = liveCling.get(fighter);
  if (!live?.img?.scene) {
    dropCling(fighter);
    live = { img: placeStill(scene, art, fighter.x, fighter.y, 0), born: now };
    live.img.setDepth(15);
    liveCling.set(fighter, live);
  }
  const frame = art.frames[fxFrameIndex(art, now - live.born)] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  live.img.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.42);
}

export function syncFxActors(scene) {
  if (!scene?.fighters) return;
  stepOneShots(scene);
  for (const fighter of scene.fighters) {
    syncCling(scene, fighter);
    syncAttached(scene, fighter);
    syncHeld(scene, fighter);
    syncFreeze(scene, fighter);
    const move = fighter.currentMove;
    const art = artFor(fighter?.charDef?.id, move?.name);
    const swinging = art && art.anchor !== 'lance'
      && (art.objectType === 'slash arc' || art.objectType === 'extend')
      && fighter.state === 'attack' && frameInActive(fighter);
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
      } else if (art.anchor === 'contact') {
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

function syncHeld(scene, fighter) {
  const now = scene.simNow ?? 0;
  const charge = fighter.charDef?.moves?.basicCharge;
  const art = charge && artFor(fighter.charDef?.id, charge.name);
  let want = null;
  if (art?.orbit?.frames?.length && orbitVisible(fighter)) want = { art: art.orbit, kind: 'orbit' };
  else if (art?.anchor === 'lance' && art.frames?.length) {
    const phase = lancePhase(fighter, now);
    if (phase) want = { art, kind: 'lance', phase };
  } else if (art?.anchor === 'feet' && art.frames?.length && fighter.state === 'charging') {
    want = { art, kind: 'feet' };
  } else if (art?.charge?.frames?.length && fighter.state === 'charging') {
    want = { art: art.charge, kind: art.charge.anchor === 'feet' ? 'feet' : 'grow' };
  } else if (art?.anchor === 'aura' && art.frames?.length && charge?.overclock) {
    const charging = fighter.state === 'charging';
    const buffed = (fighter.attackHasteUntil ?? 0) > now;
    if (charging || buffed) want = { art, kind: 'aura', charging };
  }
  let live = liveHeld.get(fighter);
  if (!want) {
    dropHeld(fighter);
    return;
  }
  if (!live?.img?.scene || live.kind !== want.kind) {
    dropHeld(fighter);
    live = { img: placeStill(scene, want.art, fighter.x, fighter.y, 0), kind: want.kind };
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
    const index = auraFrame(frames.length, want.art.heatAt, hot, frac, now, want.art.fps);
    const frame = frames[index] || frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(0.5, 0.5);
    live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
    return;
  }
  if (want.kind === 'grow') {
    const frames = want.art.frames;
    const max = charge.maxChargeMs || 1;
    const frac = Math.min(1, Math.max(0, (now - (fighter.chargeStart ?? now)) / max));
    const frame = frames[Math.min(frames.length - 1, Math.round(frac * (frames.length - 1)))];
    applyFrameLook(live.img, frame, want.art, 1);
    if (want.art.anchor === 'body') {
      live.img.setOrigin(0.5, 0.5);
      live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
      return;
    }
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 1);
    const shot = 1 + ((charge.chargeRadiusMult ?? 1) - 1) * frac;
    live.img.setPosition(fighter.x + face * bodyW * 0.65, fighter.y);
    live.img.setScale(face * Math.abs(live.img.scaleX || 1) * shot, Math.abs(live.img.scaleY || 1) * shot);
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
  applyFrameLook(img, art.frames[0], art, 1);
  applyFacing(img, face);
  trackOneShot(scene, img, art, 1, null, face);
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

/** Hit spark and move impact, at the contact point. */
export function spawnContactFx(scene, attacker, victim, move) {
  if (!scene || scene.simFast || !attacker) return;
  const at = move?._hitAt || contactAt(attacker, victim, move);
  playPacked(scene, byKey.get(`${attacker.charDef?.id}/_hit`), at.x, at.y, 1);
  playPacked(scene, artFor(attacker.charDef?.id, move?.name)?.impact, at.x, at.y, 1);
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
}
