// Drop-in attack art. A PNG in assets/fx/<fighter>/<move-slug>/ replaces the
// code-drawn effect. Nothing in that folder means the old drawing and the
// old hit shape stay exactly as they are. The hit mask is the alpha of the
// loaded image, packed on the same 5 px grid as body masks.

import { effectBox, fxFolder, moveSlug, objectTypeOf } from '../data/attackFx.js';
import { fxPlacementHits } from './boxes.js';

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
  await Promise.all(jobs);
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
    const displayW = px > 0 ? Math.max(CELL, w * px) : fit(box, w, h).w;
    const displayH = px > 0 ? Math.max(CELL, h * px) : fit(box, w, h).h;
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

async function loadMoveArt(scene, char, slot, move, index) {
  const id = char.id;
  const folder = fxFolder(id, move.name).replace(/^assets\/fx\//, '');
  const objectType = objectTypeOf(move, slot);
  const sized = effectBox(char, move, objectType);
  const pivot = objectType === 'slash arc' || objectType === 'extend' || objectType === 'beam'
    ? { x: 0, y: 0.5 }
    : { x: 0.5, y: 0.5 };
  const meta = await loadFxMeta(folder, index);
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
    return artRecord(objectType, sized, shotPivot, shot.frames, {
      ...look,
      blend: shotSpec.blend,
      spin: shotSpec.spin,
      pulse: shotSpec.pulse,
      reach: shot.reach,
      detonate,
      beam: null,
    });
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
      return artRecord(objectType, sized, usedPivot, loaded.frames, {
        ...look, reach: loaded.reach, peak, peakFrame: meta.peakFrame ?? -1, beam: null,
      });
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
  return {
    gfx: img,
    fxMask: art.frames[art.hitIndex ?? 0]?.mask || frame.mask,
    fxFrames: art.frames.map((f) => f.key),
    fxMasks: art.frames.map((f) => f.mask),
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
  img.setDisplaySize(frame.displayW * scale, frame.displayH * scale);
  const blend = frame.blend || art?.blend;
  img.setBlendMode?.(blend === 'add' ? 'ADD' : 'NORMAL');
}

export function fxFrameIndex(art, elapsed) {
  const n = art?.frames?.length || 1;
  if (n <= 1) return 0;
  const fps = art.fps > 0 ? art.fps : 8;
  const i = Math.floor(Math.max(0, elapsed) / (1000 / fps));
  return art.loop ? ((i % n) + n) % n : Math.min(n - 1, i);
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
  return null;
}

const oneShots = [];

function trackOneShot(scene, img, art, scale, peak) {
  const fps = art.fps > 0 ? art.fps : 8;
  const frames = art.frames?.length || 1;
  const life = frames > 1 ? (frames / fps) * 1000 + 70 : (art.objectType === 'shield' ? 500 : art.objectType === 'beam' ? 220 : 320);
  oneShots.push({
    img, art, scale, peak, born: scene.simNow ?? 0, life,
  });
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

export function drawFxOneShot(scene, fighter, move, x, y, scale = 1) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !scene?.add?.image) return null;
  if (art.anchor === 'trail' || art.anchor === 'ground-front') return null;
  if (art.objectType === 'projectile' || art.objectType === 'thrown') return null;
  if (art.objectType === 'slash arc' || art.objectType === 'extend') return null;
  const face = fighter?.facing || 1;
  const rot = art.objectType === 'beam' && face === -1 ? Math.PI : 0;
  const img = placeStill(scene, art, x, y, rot);
  applyFrameLook(img, art.frames[0], art, scale);
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
  trackOneShot(scene, img, art, scale, peak);
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

const liveSlash = new WeakMap();
const liveAttached = new WeakMap();

function attachedWant(scene, fighter) {
  const now = scene.simNow ?? 0;
  if (fighter.state === 'defending' && fighter.defenseMove?.kind === 'wall') {
    const art = artFor(fighter.charDef?.id, fighter.defenseMove.name);
    if (art?.anchor === 'ground-front' && art.frames?.length) {
      return { art, kind: 'wall', elapsed: now - (fighter.defenseStart ?? now) };
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
    if (live?.kind === 'trail') fighter.rig?.setDepth?.(0);
    if (live?.img) live.img.destroy?.();
    if (live) liveAttached.delete(fighter);
    return;
  }
  if (!live?.img?.scene || live.kind !== want.kind) {
    if (live?.kind === 'trail') fighter.rig?.setDepth?.(0);
    live?.img?.destroy?.();
    live = { img: placeStill(scene, want.art, fighter.x, fighter.y, 0), kind: want.kind };
    // Above the stage (depth 0) and behind Hydra, so the streak is not hidden by the sky.
    if (want.kind === 'trail') {
      fighter.rig?.setDepth?.(5);
      live.img.setDepth(4);
    } else {
      live.img.setDepth(10);
    }
    liveAttached.set(fighter, live);
  }
  const art = want.art;
  const frame = art.frames[fxFrameIndex(art, want.elapsed)] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  const face = fighter.facing || 1;
  if (want.kind === 'wall') {
    const anchor = fxAnchor(fighter, fighter.defenseMove);
    live.img.setPosition(anchor?.x ?? fighter.x, anchor?.y ?? fighter.y);
    return;
  }
  const bodyW = fighter.bodyW ?? 40;
  live.img.setPosition(fighter.x - face * bodyW * 0.35, fighter.y - frame.displayH * 0.5);
  const sx = Math.abs(live.img.scaleX || 1);
  const sy = Math.abs(live.img.scaleY || 1);
  live.img.setScale(face * sx, sy);
  if (art.flicker) {
    live.img.setAlpha(0.9 + 0.1 * Math.sin((scene.simNow || 0) * 0.05));
  }
}

export function syncFxActors(scene) {
  if (!scene?.fighters) return;
  stepOneShots(scene);
  for (const fighter of scene.fighters) {
    syncAttached(scene, fighter);
    const move = fighter.currentMove;
    const art = artFor(fighter?.charDef?.id, move?.name);
    const swinging = art && (art.objectType === 'slash arc' || art.objectType === 'extend')
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
    const y = fighter.y - (fighter.bodyH ?? 80) * 0.55;
    img.setPosition(fighter.x, y);
    img.rotation = face === -1 ? Math.PI : 0;
    const frames = art.frames;
    if (frames.length > 1) {
      const t = art.timed && art.fps > 0 && scene.simNow != null
        ? Math.floor(scene.simNow / (1000 / art.fps))
        : (fighter.attackFrame || 0);
      const frame = frames[t % frames.length];
      img.setTexture(frame.key);
      img.setDisplaySize(frame.displayW, frame.displayH);
    }
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
}
