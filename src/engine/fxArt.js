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
  if (mode === 'charge') return extra * (0.78 + 0.5 * chargeFrac(move));
  if (mode === 'hold') return extra * (0.42 + 0.58 * chargeFrac(move));
  if (mode === 'stored') {
    const cap = Math.max(1, move?.storeHits?.cap ?? 20);
    const n = Math.max(0, Number(move?._stored) || 0);
    return extra * (0.55 + 0.85 * Math.min(1, n / cap));
  }
  if (mode === 'surge') return extra * surgeBeamScale(move?._surge, move?.surgeCap);
  return extra;
}

/** Orange toward white-hot. Phaser tint multiplies, so 0 is dim and white is the sheet. */
export function chargeTint(from, to, frac) {
  const t = Math.max(0, Math.min(1, Number(frac) || 0));
  const mix = (a, b) => Math.round(a + (b - a) * t);
  const r = mix((from >> 16) & 255, (to >> 16) & 255);
  const g = mix((from >> 8) & 255, (to >> 8) & 255);
  const b = mix(from & 255, to & 255);
  return (r << 16) | (g << 8) | b;
}

/** Classic flame-test colours. A pale default covers elements without one. */
export const FLAME_TEST = {
  Na: 0xffc83c,
  K: 0xc8a0ff,
  Li: 0xff3c50,
  Sr: 0xe6283c,
  Ba: 0x96ff78,
  Cu: 0x50ffa0,
  Ca: 0xff8232,
  B: 0x78ff64,
};

export const FLAME_PALE = 0xfff3d6;

export function flameTestColor(symbol) {
  return FLAME_TEST[symbol] ?? FLAME_PALE;
}

/** Ignition sprite scale so the sheet covers about 0.5–0.7 of a gas cloud. */
export function cloudIgnitionScale(radius, sheetW, fit = 0.6) {
  const band = Math.max(0.5, Math.min(0.7, Number(fit) || 0.6));
  const span = radius > 0 ? radius * 2 : 120;
  const w = sheetW > 0 ? sheetW : 1;
  return (span * band) / w;
}

/** Stretch a jump arc from one fighter to the next. The sheet's span is the painted length. */
export function spawnJumpArc(scene, art, x0, y0, x1, y1) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 8)) return null;
  const span = art.span > 0 ? art.span : 304;
  return spawnFxSprite(scene, { ...art, _rot: Math.atan2(dy, dx) }, x0, y0, dist / span, 1);
}

/** How far behind the tip the trail's pivot sits, in display pixels. */
export function trailBackOffset(displayW, lagFrac) {
  if (!(displayW > 0) || !(lagFrac > 0)) return 0;
  return displayW * lagFrac;
}

/** Graphite and uranium alternate. A tap is one block; a full charge is eight. */
export function pileCount(frac) {
  const t = Math.max(0, Math.min(1, Number(frac) || 0));
  return Math.min(8, 1 + Math.floor(t * 7));
}

/** A multi-hit string plays its big impact on the last connection only. */
export function playsFinalImpact(move) {
  const multi = move?.multiHit > 1 ? move.multiHit : 0;
  if (!(multi > 1)) return true;
  const index = move._hitIndex != null ? move._hitIndex : multi;
  return index >= multi;
}

/** 0–1 charge fraction stored on a released move. */
export function chargeFrac(move) {
  return Math.max(0, Math.min(1, Number(move?._chargeFrac) || 0));
}

/** Gust wave alpha: faint on a tap, solid at a full charge. */
export function chargeWaveAlpha(frac) {
  const t = Math.max(0, Math.min(1, Number(frac) || 0));
  return 0.4 + 0.6 * t;
}

/** Beam sprite scale so an authored pixel length matches the gameplay length.
 *  `_beamReach` is the clipped distance to the first body or wall. */
export function beamDrawScale(move) {
  const charge = move?._beamScale > 0 ? move._beamScale : 1;
  if (!(move?.beamArtPx > 0)) return charge;
  let len = Math.min(move.beamCap ?? move.beamArtPx, (move.beamLen ?? 160) * charge);
  if (move._beamReach > 0) len = Math.min(len, move._beamReach);
  return len / move.beamArtPx;
}

/** Twelve Long Reign pips fill in over as many seconds survived. */
export function survivedPipAlpha(seconds, pips = 12) {
  const sec = Math.max(0, Number(seconds) || 0);
  const n = pips > 0 ? pips : 12;
  return 0.2 + 0.8 * Math.min(1, sec / n);
}

/** Sound Off pips: cell k is k seconds, and the last cell is a full unblockable charge. */
export function stackPipIndex(frames, heldMs, every = 1000, maxMs = 3000, unblockAt = 0.95) {
  const count = frames > 0 ? frames : 1;
  const last = count - 1;
  const step = every > 0 ? every : 1000;
  const stacks = Math.floor(Math.max(0, Number(heldMs) || 0) / step);
  const cap = maxMs > 0 ? maxMs : step;
  const full = (Number(heldMs) || 0) >= (unblockAt ?? 0.95) * cap;
  return full ? last : Math.min(Math.max(0, last - 1), stacks);
}

/** Reactor Surge width: a tap is half the sheet, a full blanket is the whole bolt. */
export function surgeBeamScale(charges, cap = 4) {
  const slots = cap > 0 ? cap : 4;
  const t = Math.max(0, Math.min(1, (Number(charges) || 0) / slots));
  return 0.5 + 0.5 * t;
}

/** Reactor Surge alpha: dim with an empty blanket, solid at four charges. */
export function surgeAlpha(move) {
  const cap = Math.max(1, move?.surgeCap ?? 4);
  const n = Math.max(0, Math.min(cap, Number(move?._surge) || 0));
  return 0.35 + 0.65 * (n / cap);
}

/** Impact scale that fits a bright flash disc to the move's hit radius. */
export function impactRadiusScale(move, art) {
  if (art?.scaleTo !== 'radius') return null;
  const radius = move?.hitRadius ?? move?.projectileRadius ?? move?.radius ?? 0;
  const flash = art.flashRadius > 0 ? art.flashRadius : 1;
  if (!(radius > 0)) return 1;
  const hard = art.hard > 0 ? art.hard : 1;
  return (radius / flash) * hard;
}

/** Pull-field cell spans the pull diameter, so its edge is the pull radius. */
export function pullFieldSize(radius) {
  return (radius > 0 ? radius : 0) * 2;
}

/** Distance along a throw: damage, tail stretch, and brightness. */
export function throwGrowth(distance, spec = {}) {
  const reach = spec?.reach > 0 ? spec.reach : 1000;
  const t = Math.max(0, Math.min(1, (Number(distance) || 0) / reach));
  const mult = spec?.mult > 0 ? spec.mult : 1;
  const stretch = spec?.stretch > 0 ? spec.stretch : 1.4;
  return {
    t,
    damageMult: 1 + (mult - 1) * t,
    stretch: 1 + t * stretch,
    alpha: 0.58 + 0.42 * t,
  };
}

/** Handheld unit in front of her, and the world point of its nozzle. */
export function handheldUnit(fighter, unit) {
  const face = fighter?.facing || 1;
  const bodyH = fighter?.bodyH ?? 80;
  const bodyW = fighter?.bodyW ?? 40;
  const x = (fighter?.x ?? 0) + face * bodyW * 0.42;
  const y = (fighter?.y ?? 0) - bodyH * 0.56;
  const frame = unit?.frames?.[0];
  let nozzle = { x, y };
  if (frame) {
    const dx = ((unit.nozzleX ?? unit.pivotX ?? 0.5) - (unit.pivotX ?? 0.5)) * (frame.displayW || 0);
    const dy = ((unit.nozzleY ?? unit.pivotY ?? 0.5) - (unit.pivotY ?? 0.5)) * (frame.displayH || 0);
    nozzle = { x: x + face * dx, y: y + dy };
  }
  return { x, y, face, nozzle };
}

/** Rotor speed while Turbine Gust is charging, in turns per second. */
export function rotorTurns(frac) {
  const t = Math.max(0, Math.min(1, Number(frac) || 0));
  return 1 + 5 * t;
}

/** Stick direction for a spotlight. Neutral keeps the facing. */
export function stickAim(owner) {
  const inp = owner?.input || {};
  let x = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let y = (inp.down ? 1 : 0) - (inp.jump ? 1 : 0);
  if (x === 0 && y === 0) x = owner?.facing || 1;
  const mag = Math.hypot(x, y) || 1;
  return { x: x / mag, y: y / mag };
}

/** Frame order that plays a rise sheet backwards. */
export function reverseFrameOrder(count) {
  const order = [];
  for (let i = (count | 0) - 1; i >= 0; i--) order.push(i);
  return order;
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

/** A slash sheet stands in for the strike spark unless the body art has none.
 *  Lucy's copper wheel keeps the code hit flash on top of the blade stroke. */
export function slashNeedsCodeFlash(art) {
  if (!art?.frames?.length || !art.keepSlash) return false;
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
    fillHold: !!extra.fillHold,
    tremble: !!extra.tremble,
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
    fromBody: !!extra.fromBody,
    tile: !!extra.tile,
    reverseOnRelease: !!extra.reverseOnRelease,
    spinTurns: extra.spinTurns > 0 ? extra.spinTurns : 0,
    hitScales: Array.isArray(extra.hitScales) ? extra.hitScales : null,
    hitRots: Array.isArray(extra.hitRots) ? extra.hitRots : null,
    scaleTo: extra.scaleTo === 'radius' ? 'radius' : null,
    flashRadius: extra.flashRadius > 0 ? extra.flashRadius : 0,
    hard: extra.hard > 0 ? extra.hard : 0,
    fillFrames: extra.fillFrames > 1 ? extra.fillFrames | 0 : 0,
    tintFrom: typeof extra.tintFrom === 'number' ? extra.tintFrom : null,
    tintTo: typeof extra.tintTo === 'number' ? extra.tintTo : null,
    lagFrac: extra.lagFrac > 0 ? extra.lagFrac : 0,
    nozzleX: typeof extra.nozzleX === 'number' ? extra.nozzleX : null,
    nozzleY: typeof extra.nozzleY === 'number' ? extra.nozzleY : null,
    maxAlpha: extra.maxAlpha > 0 && extra.maxAlpha < 1 ? extra.maxAlpha : 0,
    scaleIn: extra.scaleIn > 0 ? extra.scaleIn : 0,
    floor: !!extra.floor,
    rumble: !!extra.rumble,
    flat: !!extra.flat,
    scaleMin: typeof extra.scaleMin === 'number' ? extra.scaleMin : null,
    scaleMax: typeof extra.scaleMax === 'number' ? extra.scaleMax : null,
    replacesSpark: !!extra.replacesSpark,
    stackSeconds: !!extra.stackSeconds,
    surgePips: !!extra.surgePips,
    rise: extra.rise > 0 ? extra.rise : 0,
    rampAlpha: !!extra.rampAlpha,
    randomRot: !!extra.randomRot,
    randomFlip: !!extra.randomFlip,
    tilt: extra.tilt > 0 ? extra.tilt : 0,
    span: extra.span > 0 ? extra.span : 0,
    ox: typeof extra.ox === 'number' ? extra.ox : 0,
    oy: typeof extra.oy === 'number' ? extra.oy : 0,
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
    } else if (spec?.fit === 'stage' || spec?.fit === 'pixel') {
      // Stage fit is stretched to the world at draw time. Pixel fit stays at the cell size.
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
  ['warn', 'warn-'], ['glow', 'glow-'], ['hot', 'hot-'],
  ['rotor', 'rotor-'], ['motor', 'motor-'], ['hold', 'hold-'], ['field', 'field-'],
  ['fist', 'fist-'], ['dazzle', 'dazzle-'], ['unit', 'unit-'],
  ['fizz', 'fizz-'], ['heal', 'heal-'], ['ring', 'ring-'], ['boost', 'boost-'],
  ['wave', 'wave-'], ['recoil', 'recoil-'], ['meteor', 'meteor-'], ['arc', 'arc-'],
  ['crown', 'crown-'], ['visor', 'visor-'], ['reflect', 'reflect-'],
  ['heated', 'heated-'], ['absorb', 'absorb-'], ['cleanse', 'cleanse-'], ['block', 'block-'],
  ['pierce', 'pierce-'], ['reticle', 'reticle-'], ['tip', 'tip-'],
  ['condense', 'condense-'],
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
      spin: merged.spin,
      spinTurns: merged.spinTurns,
      aim: merged.aim !== false,
      scaleWith: merged.scaleWith || null,
      hitScales: merged.hitScales,
      hitRots: merged.hitRots,
      scaleTo: merged.scaleTo,
      flashRadius: merged.flashRadius,
      hard: merged.hard,
      fillFrames: merged.fillFrames,
      tintFrom: merged.tintFrom,
      tintTo: merged.tintTo,
      lagFrac: merged.lagFrac,
      nozzleX: merged.nozzleX,
      nozzleY: merged.nozzleY,
      stretch: merged.stretch,
      scaleIn: merged.scaleIn,
      floor: merged.floor,
      rumble: merged.rumble,
      flat: merged.flat,
      guardAt: merged.guardAt,
      scaleMin: merged.scaleMin,
      scaleMax: merged.scaleMax,
      replacesSpark: merged.replacesSpark,
      stackSeconds: !!merged.stackSeconds,
      surgePips: !!merged.surgePips,
      rise: merged.rise,
      fillHold: !!merged.fillHold,
      tremble: !!merged.tremble,
      rampAlpha: merged.rampAlpha,
      randomRot: merged.randomRot,
      randomFlip: merged.randomFlip,
      tilt: merged.tilt,
      span: merged.span,
      ox: merged.ox,
      oy: merged.oy,
    });
  }
  if (Array.isArray(meta.steps)) {
    record.steps = [];
    for (let i = 0; i < meta.steps.length; i++) {
      const spec = meta.steps[i];
      if (!spec?.file) {
        record.steps.push(null);
        continue;
      }
      const merged = { ...inherit, ...spec };
      const stepPivot = pivotFrom(merged, { x: 0.5, y: 0.5 });
      const loaded = await loadSpecFrames(scene, id, slug, folder, merged, index, stepPivot, charH, sized, `step-${i}-`);
      record.steps.push(loaded?.frames?.length
        ? artRecord(record.objectType, sized, stepPivot, loaded.frames, {
          blend: merged.blend,
          fps: merged.fps,
          scale: merged.scale,
          scaleTo: merged.scaleTo,
          flashRadius: merged.flashRadius,
          loop: !!merged.loop,
          hit: false,
        })
        : null);
    }
  }
  await attachShards(scene, id, slug, folder, meta, index, charH, sized, record);
  return record;
}

async function attachShards(scene, id, slug, folder, meta, index, charH, sized, record) {
  const bag = meta?.shards;
  if (!bag || typeof bag !== 'object') return record;
  const pivot = pivotFrom(meta, { x: 0.5, y: 0.5 });
  record.shards = {};
  for (const [type, spec] of Object.entries(bag)) {
    if (!spec?.file) continue;
    const merged = {
      blend: meta.blend,
      black: meta.black,
      fit: meta.fit,
      heightFrac: meta.heightFrac,
      ...spec,
    };
    const used = pivotFrom(merged, pivot);
    const loaded = await loadSpecFrames(scene, id, slug, folder, merged, index, used, charH, sized, `shard-${type}-`);
    if (!loaded?.frames?.length) continue;
    record.shards[type] = artRecord(record.objectType, sized, used, loaded.frames, {
      blend: merged.blend,
      fps: merged.fps,
      aim: merged.aim !== false,
      hit: false,
      spin: merged.spin,
      scale: merged.scale,
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
    fromBody: !!meta.fromBody,
    tile: !!meta.tile,
    reverseOnRelease: !!meta.reverseOnRelease,
    maxAlpha: meta.maxAlpha > 0 && meta.maxAlpha < 1 ? meta.maxAlpha : 0,
    scaleTo: meta.scaleTo === 'radius' ? 'radius' : null,
    flashRadius: meta.flashRadius > 0 ? meta.flashRadius : 0,
    hard: meta.hard > 0 ? meta.hard : 0,
    fillHold: !!meta.fillHold,
    tremble: !!meta.tremble,
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
        scale: detSpec.scale > 0 ? detSpec.scale : look.scale,
        scaleTo: detSpec.scaleTo === 'radius' ? 'radius' : look.scaleTo,
        flashRadius: detSpec.flashRadius > 0 ? detSpec.flashRadius : look.flashRadius,
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
        lifeMs: meta.lifeMs, puddle: !!meta.puddle, ghost: meta.ghost, scaleIn: meta.scaleIn,
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
    if (record.shards && Object.keys(record.shards).length) return record;
    for (const [name] of SIDE_SPECS) {
      if (record[name]?.frames?.length) return record;
    }
    return null;
  }
  return artRecord(objectType, sized, pivot, frames, { ...look, beam: null });
}

export function fxProjectileView(scene, owner, move, x, y) {
  const base = artFor(owner?.charDef?.id, move?.name);
  const shard = move?._shard && base?.shards?.[move._shard];
  const art = shard?.frames?.length
    ? shard
    : (move?._rodGlow && base?.glow?.frames?.length ? base.glow : base);
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
  let hot = null;
  const ghosts = [];
  const copies = move?.ghostCopies | 0;
  if (copies > 0 && scene.add?.image) {
    const fade = [0.45, 0.28, 0.14];
    for (let i = 0; i < copies; i++) {
      const ghost = scene.add.image(x, y, frame.key);
      ghost.setOrigin(art.pivotX, art.pivotY);
      ghost.setDisplaySize(frame.displayW * scale, frame.displayH * scale);
      ghost.setDepth(15);
      ghost.setAlpha(fade[i] ?? 0.12);
      ghost.setBlendMode?.(phaserBlend(frame.blend || art.blend));
      ghosts.push(ghost);
    }
  }
  if (art.trail?.frames?.length && scene.add?.image) {
    const tFrame = art.trail.frames[0];
    trail = scene.add.image(x, y, tFrame.key);
    trail.setOrigin(art.trail.pivotX ?? 1, art.trail.pivotY ?? 0.5);
    trail.setDisplaySize(tFrame.displayW, tFrame.displayH);
    trail.setDepth(15);
    trail.setBlendMode?.(phaserBlend(tFrame.blend || art.trail.blend));
  }
  const hotArt = base?.hot;
  const hotFrame = hotArt?.frames?.[0];
  if (hotFrame && scene.add?.image) {
    hot = scene.add.image(x, y, hotFrame.key);
    hot.setOrigin(hotArt.pivotX ?? 0.5, hotArt.pivotY ?? 0.5);
    const hotScale = fxGameplayScale(move, hotArt);
    hot.setDisplaySize(hotFrame.displayW * hotScale, hotFrame.displayH * hotScale);
    hot.setDepth(16);
    hot.setAlpha(0);
    hot.setBlendMode?.(phaserBlend(hotFrame.blend || hotArt.blend));
  }
  const fieldArt = base?.field;
  const fieldFrame = fieldArt?.frames?.[0];
  let field = null;
  if (fieldFrame && scene.add?.image) {
    field = scene.add.image(x, y, fieldFrame.key);
    field.setOrigin(fieldArt.pivotX ?? 0.5, fieldArt.pivotY ?? 0.5);
    const span = pullFieldSize(move?.pullProjectiles);
    const size = span > 0 ? span : fieldFrame.displayW;
    field.setDisplaySize(size, size * (fieldFrame.displayH / Math.max(1, fieldFrame.displayW)));
    field.setDepth(17);
    field.setBlendMode?.(phaserBlend(fieldFrame.blend || fieldArt.blend));
  }
  const tipArt = base?.tip;
  const tipFrame = tipArt?.frames?.[0];
  let tip = null;
  if (tipFrame && scene.add?.image) {
    tip = scene.add.image(x, y, tipFrame.key);
    tip.setOrigin(tipArt.pivotX ?? 0.5, tipArt.pivotY ?? 0.5);
    const tipScale = fxGameplayScale(move, tipArt);
    tip.setDisplaySize(tipFrame.displayW * tipScale, tipFrame.displayH * tipScale);
    tip.setDepth(17);
    tip.setBlendMode?.(phaserBlend(tipFrame.blend || tipArt.blend));
  }
  if (trail || hot || field || tip || ghosts.length) {
    const destroy = img.destroy?.bind(img);
    img.destroy = (...args) => {
      if (trail?.scene) trail.destroy();
      if (hot?.scene) hot.destroy();
      if (field?.scene) field.destroy();
      if (tip?.scene) tip.destroy();
      for (const ghost of ghosts) if (ghost?.scene) ghost.destroy();
      return destroy?.(...args);
    };
  }
  const hotScale = hotFrame ? fxGameplayScale(move, hotArt) : 1;
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
    fxAlphaPulse: move?._rodGlow ? 0.22 : 0,
    fxAim: art.aim !== false,
    fxTrail: trail,
    fxTrailArt: art.trail || null,
    fxTip: tip,
    fxTipArt: tipArt || null,
    fxField: field,
    fxFieldArt: fieldArt || null,
    fxHot: hot,
    fxHotW: hotFrame ? hotFrame.displayW * hotScale : 0,
    fxHotH: hotFrame ? hotFrame.displayH * hotScale : 0,
    fxGhosts: ghosts,
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
  const rot = Math.atan2(p.vy || 0, p.vx || 1);
  const lag = trailBackOffset(p.fxDisplayW, art.lagFrac);
  trail.setPosition(p.gfx.x - Math.cos(rot) * lag, p.gfx.y - Math.sin(rot) * lag);
  trail.rotation = rot;
}

/** Cool orb stays solid, then fades to the hot orb across the approach to the Curie point. */
export function curieFade(along) {
  const t = Math.max(0, Math.min(1, along || 0));
  if (t <= 0.45) return 0;
  return Math.min(1, (t - 0.45) / 0.55);
}

/** A small scale pulse once the orb is heating. Steady before that. */
export function curiePulse(along, elapsedMs) {
  const t = Math.max(0, Math.min(1, along || 0));
  if (t <= 0.55) return 1;
  return 1 + 0.09 * Math.sin((elapsedMs || 0) * 0.05);
}

function stepCurieOrb(p, time) {
  const hot = p?.fxHot;
  if (!hot?.setPosition || !p.gfx?.setAlpha) return;
  const life = p.move?.projectileLife > 0 ? p.move.projectileLife : 1;
  const at = p.move?.igniteAt > 0 ? p.move.igniteAt : 1;
  const elapsed = Math.max(0, time - (p.born || 0));
  const along = Math.min(1, elapsed / (life * at));
  const fade = curieFade(along);
  const pulse = curiePulse(along, elapsed);
  p.gfx.setAlpha(1 - fade);
  hot.setAlpha(fade);
  hot.setPosition(p.gfx.x, p.gfx.y);
  const w = p.fxDisplayW || 0;
  const h = p.fxDisplayH || 0;
  if (w && h) p.gfx.setDisplaySize(w * pulse, h * pulse);
  const hw = p.fxHotW || w;
  const hh = p.fxHotH || h;
  if (hw && hh) hot.setDisplaySize(hw * pulse, hh * pulse);
}

function stepPullField(p, time) {
  const field = p?.fxField;
  const art = p?.fxFieldArt;
  if (!field?.setPosition || !art?.frames?.length || !p.gfx) return;
  const fps = art.fps > 0 ? art.fps : 12;
  const raw = Math.floor(Math.max(0, time - (p.born || 0)) / (1000 / fps));
  const i = ((raw % art.frames.length) + art.frames.length) % art.frames.length;
  const frame = art.frames[i];
  if (field.texture?.key !== frame.key) field.setTexture?.(frame.key);
  const size = pullFieldSize(p.move?.pullProjectiles) || frame.displayW;
  field.setDisplaySize?.(size, size * ((frame.displayH || size) / Math.max(1, frame.displayW || size)));
  field.setOrigin?.(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
  field.setPosition(p.gfx.x, p.gfx.y);
  field.rotation = 0;
}

export function stepFxProjectile(p, time) {
  if (!p?.fxFrames || !p.gfx?.setTexture) return;
  const fps = p.fxFps > 0 ? p.fxFps : 8;
  const freezeCold = p.move?.hatch && !p._showHot;
  const raw = freezeCold ? 0 : Math.floor(Math.max(0, time - (p.born || 0)) / (1000 / fps));
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
  stepPullField(p, time);
  if (p.fxTip?.scene && p.gfx && p.fxTipArt?.frames?.length) {
    const w = p.fxDisplayW || 40;
    const h = p.fxDisplayH || 40;
    p.fxTip.setPosition(p.gfx.x + (p.fxTipArt.ox || 0) * w, p.gfx.y + (p.fxTipArt.oy || 0) * h);
    const frames = p.fxTipArt.frames;
    const fps = p.fxTipArt.fps > 0 ? p.fxTipArt.fps : 24;
    const raw = Math.floor(Math.max(0, time - (p.born || 0)) / (1000 / fps));
    const i = p.fxTipArt.loop ? raw % frames.length : Math.min(frames.length - 1, raw);
    if (p._tipFrame !== i && frames[i]?.key) {
      p._tipFrame = i;
      p.fxTip.setTexture(frames[i].key);
    }
  }
  if (p.move?.roll) {
    const face = (p.vx || 1) < 0 ? -1 : 1;
    p.gfx.rotation = 0;
    const sx = Math.abs(p.gfx.scaleX || 1);
    const sy = Math.abs(p.gfx.scaleY || 1);
    p.gfx.setScale(face * sx, sy);
  } else if (p.fxSpin) {
    p.gfx.rotation = ((time - (p.born || 0)) / 1000) * p.fxSpin;
    if (p.fxPulse && p.fxDisplayW) {
      const s = 1 + Math.sin((time - (p.born || 0)) / 150) * p.fxPulse;
      p.gfx.setDisplaySize(p.fxDisplayW * s, p.fxDisplayH * s);
    }
    if (p.fxAlphaPulse) {
      const wave = 0.5 + 0.5 * Math.cos((time - (p.born || 0)) * Math.PI * 2 / 700);
      p.gfx.setAlpha(1 - p.fxAlphaPulse + p.fxAlphaPulse * wave);
    }
  } else if (p.fxAim === false) {
    const face = (p.vx || 1) < 0 ? -1 : 1;
    p.gfx.rotation = 0;
    const sx = Math.abs(p.gfx.scaleX || 1);
    const sy = Math.abs(p.gfx.scaleY || 1);
    p.gfx.setScale(face * sx, sy);
  } else {
    p.gfx.rotation = Math.atan2(p.vy || 0, p.vx || 1);
  }
  if (p.move?.fadeIfMiss && p.gfx?.setAlpha) {
    const life = p.move.projectileLife > 0 ? p.move.projectileLife : 1;
    const t = Math.max(0, Math.min(1, (time - (p.born || 0)) / life));
    p.gfx.setAlpha(1 - t * 0.85);
  }
  if (p.move?.liquidWobble && p.fxDisplayW) {
    const t = (time - (p.born || 0)) / 1000;
    const speed = Math.hypot(p.vx || 0, p.vy || 0);
    const stretch = 1 + Math.min(0.45, speed / 1600);
    const wob = 1 + Math.sin(t * 16) * 0.12;
    const across = (p.fxDisplayH || p.fxDisplayW) * (wob / Math.max(0.7, stretch));
    p.gfx.setDisplaySize(p.fxDisplayW * stretch, across);
  }
  if (p.move?.growWithDistance && p.fxDisplayW) {
    const dist = Math.abs((p.gfx.x ?? 0) - (p.bornX ?? p.gfx.x ?? 0));
    const grown = throwGrowth(dist, p.move.growWithDistance);
    p.gfx.setDisplaySize(p.fxDisplayW * grown.stretch, p.fxDisplayH || p.fxDisplayW);
    p.gfx.setAlpha?.(grown.alpha);
  }
  if (p.fxGhosts?.length && p.gfx) {
    const rot = Math.atan2(p.vy || 0, p.vx || 1);
    p.fxGhosts.forEach((ghost, i) => {
      if (!ghost?.setPosition) return;
      const back = (i + 1) * 16;
      ghost.setPosition(p.gfx.x - Math.cos(rot) * back, p.gfx.y - Math.sin(rot) * back);
      ghost.rotation = p.gfx.rotation || 0;
      if (ghost.setScale && p.gfx.scaleX != null) ghost.setScale(p.gfx.scaleX, p.gfx.scaleY || 1);
    });
  }
  stepCurieOrb(p, time);
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
  const face = fighter?.facing || 1;
  if (art.fromBody) {
    const worldW = scene?.world?.width > 0 ? scene.world.width : 1280;
    const box = { w: worldW, h: frame.displayH > 0 ? frame.displayH : frame.displayW };
    const bodyW = fighter?.bodyW ?? 40;
    const bodyH = fighter?.bodyH ?? 80;
    const x = (fighter?.x ?? 0) + face * bodyW * 0.35;
    const y = (fighter?.y ?? 0) - bodyH * 0.55;
    const img = placeStill(scene, art, x, y, 0);
    applyFrameLook(img, frame, art, 1, box);
    img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
    applyFacing(img, face);
    trackOneShot(scene, img, art, 1, null, face, box);
    return img;
  }
  const box = stageSpanSize(scene, frame);
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
    if (move?.ground) {
      return { x: fighter.x, y: fighter.y, scale: beamDrawScale(move) };
    }
    const posed = sheetReleasePoint(fighter, 'shot') || sheetFxPoint(fighter, 'shot');
    return {
      x: posed?.x ?? fighter.x + face * bodyW * 0.2,
      y: posed?.y ?? fighter.y - bodyH * 0.62,
      scale: beamDrawScale(move),
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
    if (shot.art._rot != null) shot.img.rotation = shot.art._rot;
    const cap = shot.art._chargeAlpha != null
      ? shot.art._chargeAlpha
      : (shot.art.maxAlpha > 0 ? shot.art.maxAlpha : 1);
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

/** A short sonar burst from a held floor speaker toward whoever struck her. */
export function playRetortPulse(scene, defender, attacker) {
  const art = artFor(defender?.charDef?.id, defender?.charDef?.moves?.basicCharge?.name);
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const face = Math.sign((attacker?.x ?? defender.x) - defender.x) || defender.facing || 1;
  const x = defender.x + face * (defender.bodyW ?? 40) * 0.2;
  const y = defender.y - (defender.bodyH ?? 80) * 0.55;
  return spawnFxSprite(scene, art, x, y, 0.3, face);
}

/** One additive sprite from an already-loaded side, such as the ribbon ignite. */
export function spawnFxSprite(scene, art, x, y, scale = 1, face = 1, box = null) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return null;
  const img = placeStill(scene, art, x, y, 0);
  applyFrameLook(img, art.frames[0], art, scale, box);
  applyFacing(img, face);
  if (art._rot != null) img.rotation = art._rot;
  trackOneShot(scene, img, art, scale, null, face, box);
  return img;
}

export function drawFxOneShot(scene, fighter, move, x, y, scale = 1) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !scene?.add?.image) return null;
  if (art.anchor === 'trail' || art.anchor === 'ground-front' || art.anchor === 'body' || art.anchor === 'front' || art.anchor === 'head' || art.anchor === 'lance' || art.anchor === 'feet' || art.anchor === 'aura' || art.anchor === 'pin' || art.anchor === 'afterimage') return null;
  if (art.objectType === 'projectile' || art.objectType === 'thrown') return null;
  if ((art.objectType === 'slash arc' || art.objectType === 'extend') && !art.oneshot) return null;
  const face = art.bothSides ? 1 : (art.flip ? (fighter?.facing || 1) : 1);
  const rot = art.objectType === 'beam' && !art.flip && (fighter?.facing || 1) === -1 ? Math.PI : 0;
  const img = placeStill(scene, art, x, y, rot);
  applyFrameLook(img, art.frames[0], art, scale);
  applyFacing(img, face);
  let painted = art;
  if (art.scaleWith === 'charge') {
    painted = { ...art, _chargeAlpha: chargeWaveAlpha(chargeFrac(move)) };
  }
  if (art.scaleWith === 'surge') {
    painted = { ...painted, _chargeAlpha: surgeAlpha(move) };
  }
  if (painted._chargeAlpha != null) img.setAlpha?.(painted._chargeAlpha);
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
  trackOneShot(scene, img, painted, scale, peak, face);
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
  const fitted = impactRadiusScale(move, det);
  const scale = fitted != null ? fitted : (det.scale > 0 ? det.scale : 1);
  const img = placeStill(scene, det, placed.x, placed.y, 0);
  applyFrameLook(img, det.frames[0], det, scale);
  img.setDepth(15);
  trackOneShot(scene, img, det, scale, null);
  if (art?.impact?.frames?.length) {
    const groundY = art.impact.anchor === 'ground' ? groundTop(scene, placed.x, placed.y) : placed.y;
    const dust = art.impact.scale > 0 ? art.impact.scale : 1;
    spawnFxSprite(scene, art.impact, placed.x, groundY, dust, 1);
  }
  if (move?._luckyThrow && art?.spark?.frames?.length) {
    const glint = art.spark.scale > 0 ? art.spark.scale : 1;
    spawnFxSprite(scene, art.spark, placed.x, placed.y, glint, 1);
  }
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
const liveDoubles = new WeakMap();
const liveAfter = new WeakMap();
const livePips = new WeakMap();
const liveHalves = new WeakMap();

function fighterBodySprite(fighter) {
  const rig = fighter?.rig;
  if (!rig) return null;
  if (rig.clipA?.visible && rig.sprite && rig.sprite.visible === false) return rig.clipA;
  return rig.sprite || rig.clipA || null;
}

/** Hollywood stand-in: a tinted copy of her sprite, held in front while the defense is up. */
function syncStuntDouble(scene, fighter) {
  const want = fighter?.state === 'defending' && fighter.defenseMove?.stuntDouble && !scene?.simFast;
  let img = liveDoubles.get(fighter);
  if (!want) {
    img?.destroy?.();
    if (img) liveDoubles.delete(fighter);
    return;
  }
  const spr = fighterBodySprite(fighter);
  if (!spr?.texture?.key || !scene.add?.image) return;
  if (!img?.scene) {
    img?.destroy?.();
    img = scene.add.image(fighter.x, fighter.y, spr.texture.key);
    img.setDepth(6);
    liveDoubles.set(fighter, img);
  }
  const frame = spr.frame?.name;
  if (frame != null && img.texture?.key === spr.texture.key && img.setFrame) img.setFrame(frame);
  else if (img.texture?.key !== spr.texture.key) img.setTexture(spr.texture.key);
  const face = fighter.facing || 1;
  const bodyW = fighter.bodyW ?? 40;
  img.setPosition(fighter.x + face * bodyW * 1.35, fighter.y);
  img.setOrigin(spr.originX ?? 0.5, spr.originY ?? 1);
  img.setScale(Math.abs(spr.scaleX || 1) * face, spr.scaleY || 1);
  img.setTint(fighter.charDef?.ghost ? 0xfff1c4 : 0xffd27a);
  img.setAlpha(0.82);
}

/** A tinted copy of his sprite stands ahead of him and takes the hit. */
function syncAfterimage(scene, fighter) {
  const want = fighter?.state === 'defending' && fighter.defenseMove?.afterimageCopy && !scene?.simFast;
  let live = liveAfter.get(fighter);
  if (!want) {
    live?.copy?.destroy?.();
    live?.tint?.destroy?.();
    if (live) liveAfter.delete(fighter);
    return;
  }
  const spr = fighterBodySprite(fighter);
  if (!spr?.texture?.key || !scene.add?.image) return;
  if (!live?.copy?.scene) {
    live?.copy?.destroy?.();
    live?.tint?.destroy?.();
    live = { copy: scene.add.image(fighter.x, fighter.y, spr.texture.key), tint: null };
    live.copy.setDepth(6);
    liveAfter.set(fighter, live);
  }
  const frame = spr.frame?.name;
  if (frame != null && live.copy.texture?.key === spr.texture.key && live.copy.setFrame) live.copy.setFrame(frame);
  else if (live.copy.texture?.key !== spr.texture.key) live.copy.setTexture(spr.texture.key);
  const face = fighter.facing || 1;
  const bodyW = fighter.bodyW ?? 40;
  const bodyH = fighter.bodyH ?? 80;
  const x = fighter.x + face * bodyW * 1.35;
  live.copy.setPosition(x, fighter.y);
  live.copy.setOrigin(spr.originX ?? 0.5, spr.originY ?? 1);
  live.copy.setScale(Math.abs(spr.scaleX || 1) * face, spr.scaleY || 1);
  live.copy.setTint(0xb8ff9a);
  live.copy.setAlpha(0.72);
  const glow = artFor(fighter.charDef?.id, fighter.defenseMove.name);
  if (glow?.anchor === 'afterimage' && glow.frames?.length) {
    if (!live.tint?.scene) {
      live.tint?.destroy?.();
      live.tint = placeStill(scene, glow, x, fighter.y, 0);
      live.tint.setDepth(7);
    }
    const elapsed = (scene.simNow ?? 0) - (fighter.defenseStart ?? 0);
    const cell = glow.frames[fxFrameIndex(glow, elapsed)] || glow.frames[0];
    applyFrameLook(live.tint, cell, glow, 1);
    live.tint.setOrigin(glow.pivotX ?? 0.5, glow.pivotY ?? 0.5);
    live.tint.setPosition(x, fighter.y - bodyH * 0.5);
  }
}

/** Blanket pips stay up for as long as Reactor Surge charges are stored. */
function syncSurgePips(scene, fighter) {
  const n = fighter?._surgeCharges ?? 0;
  let img = livePips.get(fighter);
  const glow = artFor(fighter?.charDef?.id, fighter?.charDef?.moves?.specialDefense?.name)?.glow;
  const show = n > 0 && glow?.surgePips && glow.frames?.length && !scene?.simFast && fighter?.state !== 'ko';
  if (!show) {
    img?.destroy?.();
    if (img) livePips.delete(fighter);
    return;
  }
  if (!img?.scene) {
    img?.destroy?.();
    img = placeStill(scene, glow, fighter.x, fighter.y, 0);
    img.setDepth(16);
    livePips.set(fighter, img);
  }
  const frame = glow.frames[Math.min(glow.frames.length - 1, n)] || glow.frames[0];
  applyFrameLook(img, frame, glow, 1);
  img.setOrigin(glow.pivotX ?? 0.5, glow.pivotY ?? 0.5);
  const bodyH = fighter.bodyH ?? 80;
  img.setPosition(fighter.x, fighter.y - bodyH * 1.05);
}

function paintHalf(img, spr, fighter, x, tint) {
  const frame = spr.frame?.name;
  if (frame != null && img.texture?.key === spr.texture.key && img.setFrame) img.setFrame(frame);
  else if (img.texture?.key !== spr.texture.key) img.setTexture(spr.texture.key);
  img.setOrigin(spr.originX ?? 0.5, spr.originY ?? 1);
  img.setScale(spr.scaleX || 1, spr.scaleY || 1);
  img.setPosition(x, fighter.y);
  img.setTint(tint);
  img.setAlpha(0.9);
}

/** Two tinted copies of his sprite slide apart, then the merge line closes across the gap. */
function syncFissionHalves(scene, fighter) {
  const want = fighter?.state === 'defending' && fighter.defenseMove?.fissionSplit && !scene?.simFast;
  let live = liveHalves.get(fighter);
  if (!want) {
    live?.left?.destroy?.();
    live?.right?.destroy?.();
    live?.zap?.destroy?.();
    if (live) liveHalves.delete(fighter);
    if (fighter?._fissionHid) {
      fighter.rig?.setVisible?.(true);
      fighter._fissionHid = false;
    }
    return;
  }
  const spr = fighterBodySprite(fighter);
  if (!spr?.texture?.key || !scene.add?.image) return;
  if (!live?.left?.scene || !live?.right?.scene) {
    live?.left?.destroy?.();
    live?.right?.destroy?.();
    live?.zap?.destroy?.();
    live = {
      left: scene.add.image(fighter.x, fighter.y, spr.texture.key),
      right: scene.add.image(fighter.x, fighter.y, spr.texture.key),
      zap: null,
      zapBorn: 0,
    };
    live.left.setDepth(6);
    live.right.setDepth(6);
    liveHalves.set(fighter, live);
    fighter.rig?.setVisible?.(false);
    fighter._fissionHid = true;
  }
  const now = scene.simNow ?? 0;
  const dur = fighter.defenseMove.duration > 0 ? fighter.defenseMove.duration : 480;
  const t = Math.max(0, Math.min(1, (now - (fighter.defenseStart ?? now)) / dur));
  const gap = Math.sin(t * Math.PI) * (fighter.bodyW ?? 40) * 1.35;
  paintHalf(live.left, spr, fighter, fighter.x - gap, 0xffe2a0);
  paintHalf(live.right, spr, fighter, fighter.x + gap, 0xd2b0ff);
  const zapArt = artFor(fighter.charDef?.id, fighter.defenseMove?.name)?.arc;
  if (zapArt?.frames?.length && gap > 10) {
    if (!live.zap?.scene) {
      live.zap?.destroy?.();
      live.zap = placeStill(scene, zapArt, fighter.x, fighter.y, 0);
      live.zap.setDepth(7);
      live.zapBorn = now;
    }
    const frame = zapArt.frames[fxFrameIndex(zapArt, now - (live.zapBorn ?? now))] || zapArt.frames[0];
    const width = Math.max(24, gap * 2);
    applyFrameLook(live.zap, frame, { ...zapArt, stretch: 'length' }, width / Math.max(1, frame.displayW || 1));
    live.zap.setOrigin(0.5, 0.5);
    live.zap.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.45);
  } else if (live.zap) {
    live.zap.destroy();
    live.zap = null;
  }
}

function dropAttached(fighter, live) {
  if (live?.kind === 'trail') fighter.rig?.setDepth?.(0);
  if (live?.hideRig && !((fighter._puddleRiseUntil ?? 0) > (fighter.scene?.simNow ?? 0))) {
    fighter.rig?.setVisible?.(true);
    fighter._puddleHid = false;
  }
  if (live?.fadeRig) fighter.rig?.setAlpha?.(1);
  live?.img?.destroy?.();
  live?.spark?.destroy?.();
  live?.extra?.forEach((img) => img.destroy?.());
  live?.front?.destroy?.();
  live?.lead?.destroy?.();
  live?.ring?.destroy?.();
  live?.crown?.destroy?.();
  live?.visor?.destroy?.();
  live?.field?.destroy?.();
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
    if (shell && art.anchor === 'ground' && (art.loop || art.hold?.frames?.length) && art.frames?.length) {
      return { art, kind: 'ground', elapsed: now - (fighter.defenseStart ?? now) };
    }
  }
  if (fighter.state === 'attack' && fighter.currentMove) {
    const swinging = artFor(fighter.charDef?.id, fighter.currentMove.name);
    if (swinging?.motor?.frames?.length) {
      return { art: swinging.motor, sparks: swinging.spark, kind: 'motor', elapsed: now };
    }
    if (swinging?.fist?.frames?.length) {
      return { art: swinging.fist, kind: 'fist', elapsed: now };
    }
    if (swinging?.unit?.frames?.length) {
      return { art: swinging.unit, kind: 'unit', elapsed: now };
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
    const elapsed = now - (fighter.dashUntil - (fighter.frameData?.visible || 1) * (scene.stepMs || 16.667));
    if (art?.anchor === 'head' && art.frames?.length) {
      return { art, kind: 'head', elapsed };
    }
    if (art?.anchor === 'trail' && art.frames?.length) {
      return { art, kind: 'trail', elapsed };
    }
    if (art?.anchor === 'ground' && art.loop && art.frames?.length) {
      return { art, kind: 'ground', elapsed };
    }
  }
  return null;
}

function floorDeck(scene, fighter) {
  const x = fighter?.x ?? 0;
  const y = fighter?.y ?? 0;
  const plats = scene?.stage?.platforms ?? [];
  const plat = plats.find((s) => s?.w > 0 && Math.abs((s.y ?? y) - y) < 36
    && x >= s.x - s.w / 2 && x <= s.x + s.w / 2);
  if (plat) return { cx: plat.x, w: plat.w };
  const solids = (scene?.stage?.solids ?? []).filter((s) => s && s.h == null && s.w > 0);
  const deck = solids.find((s) => x >= s.x - s.w / 2 - 12 && x <= s.x + s.w / 2 + 12);
  if (deck) return { cx: deck.x, w: deck.w };
  return { cx: x, w: 1 };
}

function syncFloorTiles(scene, live, art, fighter, frame) {
  const tileW = frame.displayW > 0 ? frame.displayW : 1024;
  const deck = floorDeck(scene, fighter);
  const n = Math.max(1, Math.ceil(deck.w / tileW));
  live.extra ??= [];
  while (live.extra.length < n - 1) {
    const img = placeStill(scene, art, fighter.x, fighter.y, 0);
    img.setDepth(6);
    live.extra.push(img);
  }
  while (live.extra.length > n - 1) live.extra.pop()?.destroy?.();
  const left = deck.cx - (n * tileW) / 2;
  [live.img, ...live.extra].forEach((img, i) => {
    applyFrameLook(img, frame, art, 1);
    img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 1);
    img.setPosition(left + (i + 0.5) * tileW, fighter.y);
    img.setScale(Math.abs(img.scaleX || 1), Math.abs(img.scaleY || 1));
  });
}

function syncCrown(scene, live, crown, fighter) {
  if (!crown?.frames?.length) {
    live.crown?.destroy?.();
    live.crown = null;
    return;
  }
  if (!live.crown?.scene) {
    live.crown?.destroy?.();
    live.crown = placeStill(scene, crown, fighter.x, fighter.y, 0);
    live.crown.setDepth(16);
  }
  const now = scene.simNow ?? 0;
  const frame = crown.frames[fxFrameIndex(crown, now)] || crown.frames[0];
  applyFrameLook(live.crown, frame, crown, 1);
  live.crown.setOrigin(crown.pivotX ?? 0.5, crown.pivotY ?? 1);
  const bodyH = fighter.bodyH ?? 80;
  const bob = Math.sin(now * 0.004) * 6;
  live.crown.setPosition(fighter.x, fighter.y - bodyH - 18 + bob);
}

function syncVisor(scene, live, visor, fighter) {
  if (!visor?.frames?.length) {
    live.visor?.destroy?.();
    live.visor = null;
    return;
  }
  if (!live.visor?.scene) {
    live.visor?.destroy?.();
    live.visor = placeStill(scene, visor, fighter.x, fighter.y, 0);
    live.visor.setDepth(13);
  }
  const now = scene.simNow ?? 0;
  const frame = visor.frames[fxFrameIndex(visor, now)] || visor.frames[0];
  applyFrameLook(live.visor, frame, visor, 1);
  live.visor.setOrigin(visor.pivotX ?? 0.5, visor.pivotY ?? 0.5);
  const face = fighter.facing || 1;
  const bodyH = fighter.bodyH ?? 80;
  const drop = visor.anchor === 'body' ? 0.5 : 0.42;
  live.visor.setPosition(fighter.x + face * (visor.anchor === 'body' ? 0 : 6), fighter.y - bodyH * drop);
  const sx = Math.abs(live.visor.scaleX || 1);
  const sy = Math.abs(live.visor.scaleY || 1);
  live.visor.setScale(visor.flip ? face * sx : sx, sy);
}

function syncField(scene, live, field, fighter) {
  if (!field?.frames?.length) {
    live.field?.destroy?.();
    live.field = null;
    return;
  }
  if (!live.field?.scene) {
    live.field?.destroy?.();
    live.field = placeStill(scene, field, fighter.x, fighter.y, 0);
    live.field.setDepth(4);
  }
  const now = scene.simNow ?? 0;
  const frame = field.frames[fxFrameIndex(field, now)] || field.frames[0];
  applyFrameLook(live.field, frame, field, 1);
  live.field.setOrigin(field.pivotX ?? 0.5, field.pivotY ?? 1);
  live.field.setPosition(fighter.x, fighter.y);
}

function syncRing(scene, live, ring, fighter) {
  if (!ring?.frames?.length) {
    live.ring?.destroy?.();
    live.ring = null;
    return;
  }
  if (!live.ring?.scene) {
    live.ring?.destroy?.();
    live.ring = placeStill(scene, ring, fighter.x, fighter.y, 0);
    live.ring.setDepth(4);
  }
  const now = scene.simNow ?? 0;
  const frame = ring.frames[fxFrameIndex(ring, now)] || ring.frames[0];
  applyFrameLook(live.ring, frame, ring, 1);
  const onBody = ring.anchor === 'body';
  live.ring.setOrigin(ring.pivotX ?? 0.5, onBody ? (ring.pivotY ?? 0.5) : (ring.pivotY ?? 1));
  live.ring.setPosition(fighter.x, onBody ? fighter.y - (fighter.bodyH ?? 80) * 0.5 : fighter.y);
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
  } else if (art.fillHold && fighter.defenseMove?.duration) {
    const frac = Math.min(1, Math.max(0, want.elapsed / fighter.defenseMove.duration));
    index = Math.min(art.frames.length - 1, Math.round(frac * (art.frames.length - 1)));
  } else if (art.crackFrames && (want.kind === 'wall' || want.kind === 'body' || want.kind === 'front')) {
    index = Math.min(art.frames.length - 1, fighter.wallHits || 0);
  }
  let paint = art;
  let paintIndex = index;
  if (art.hold?.frames?.length && want.kind === 'ground') {
    const riseMs = sheetDoneAt(art);
    if (want.elapsed >= riseMs) {
      paint = art.hold;
      paintIndex = fxFrameIndex(art.hold, want.elapsed - riseMs);
    } else {
      paintIndex = fxFrameIndex({ ...art, loop: false }, want.elapsed);
    }
  }
  const frame = paint.frames[paintIndex] || paint.frames[0];
  applyFrameLook(live.img, frame, paint, 1);
  if (want.kind === 'motor') {
    syncMotor(scene, live, want, fighter);
    return;
  }
  if (want.kind === 'fist' || want.kind === 'unit') {
    const face = fighter.facing || 1;
    if (want.kind === 'unit') {
      const held = handheldUnit(fighter, art);
      live.img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
      live.img.setPosition(held.x, held.y);
      live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
    } else if (art.anchor === 'hand') {
      const bodyW = fighter.bodyW ?? 40;
      const bodyH = fighter.bodyH ?? 80;
      const hand = sheetFxPoint(fighter, 'shot');
      live.img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
      live.img.setPosition(
        hand?.x ?? fighter.x + face * bodyW * 0.42,
        hand?.y ?? fighter.y - bodyH * 0.52,
      );
      const sx = Math.abs(live.img.scaleX || 1);
      const sy = Math.abs(live.img.scaleY || 1);
      live.img.setScale(art.flip ? face * sx : sx, sy);
    } else {
      const tip = meleeContactPoint(fighter, fighter.currentMove);
      live.img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
      live.img.setPosition(tip.x, tip.y);
      const face = fighter.facing || 1;
      const sx = Math.abs(live.img.scaleX || 1);
      const sy = Math.abs(live.img.scaleY || 1);
      live.img.setScale(art.flip ? face * sx : sx, sy);
      if (art.spin) {
        const half = (frame?.displayW || 0) / 2;
        live.img.setPosition(tip.x - face * half * 0.92, tip.y);
        live.img.rotation = ((scene.simNow ?? 0) / 1000) * art.spin * face;
      }
    }
    live.img.setDepth(14);
    return;
  }
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
      syncRing(scene, live, art.ring, fighter);
      syncCrown(scene, live, art.crown, fighter);
      syncVisor(scene, live, art.visor, fighter);
      syncField(scene, live, art.field, fighter);
      if (art.ghost > 0) {
        fighter.rig?.setAlpha?.(art.ghost);
        live.fadeRig = true;
      }
    } else {
      const anchor = fxAnchor(fighter, fighter.defenseMove);
      live.img.setPosition(anchor?.x ?? fighter.x, anchor?.y ?? fighter.y);
      live.img.setScale(face * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
      if (art.anchor === 'ground-front') live.img.setDepth(14);
    }
    return;
  }
  if (want.kind === 'ground') {
    if (art.tile) {
      syncFloorTiles(scene, live, art, fighter, frame);
      return;
    }
    if (art.hold?.frames?.length) {
      const anchor = fxAnchor(fighter, fighter.defenseMove);
      live.img.setOrigin(paint.pivotX ?? art.pivotX, paint.pivotY ?? art.pivotY);
      live.img.setPosition(anchor?.x ?? fighter.x, anchor?.y ?? fighter.y);
      live.img.setScale(Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
      return;
    }
    live.img.setPosition(fighter.x, fighter.y);
    if (art.flip) {
      const face = fighter.facing || 1;
      const sx = Math.abs(live.img.scaleX || 1);
      const sy = Math.abs(live.img.scaleY || 1);
      live.img.setScale(face * sx, sy);
    }
    if (art.puddle) {
      fighter.rig?.setVisible?.(false);
      fighter._puddleHid = true;
      live.hideRig = true;
    }
    return;
  }
  if (want.kind === 'head') {
    const bodyH = fighter.bodyH ?? 80;
    const bodyW = fighter.bodyW ?? 40;
    const face = fighter.facing || 1;
    live.img.setPosition(fighter.x + face * bodyW * 0.2, fighter.y - bodyH * 0.72);
    const sx = Math.abs(live.img.scaleX || 1);
    const sy = Math.abs(live.img.scaleY || 1);
    live.img.setScale(face * sx, sy);
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
  if (!art?.frames?.length && fighter.dazzledBy && fighter.missNext > 0 && fighter.dazzledBy.until > now) {
    art = artFor(fighter.dazzledBy.id, fighter.dazzledBy.move)?.dazzle || null;
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
    if (art.rampAlpha) {
      const level = fighter._poisonLevel ?? 1;
      live.img.setAlpha(Math.min(1, 0.28 + 0.09 * level));
    }
    if (fighter.clingFrom?.stacks > 0) {
      live.img.setAlpha(Math.min(1, 0.32 + 0.17 * fighter.clingFrom.stacks));
    }
    if (art.anchor === 'feet') {
      live.img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 1);
      live.img.setPosition(fighter.x, fighter.y);
    } else {
      const drop = art.anchor === 'body' ? 0.5 : 0.42;
      live.img.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) * drop);
    }
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

/** Where one of Europa's two control rods sits while the sponge is held. */
export function rodOrbitPoint(fighter, time, index, spec) {
  const period = spec?.period ?? 1100;
  const reach = (fighter?.bodyW ?? 40) * (spec?.orbit ?? 1.05);
  const ang = ((time || 0) / period) * Math.PI * 2 + index * Math.PI;
  return {
    x: (fighter?.x ?? 0) + Math.cos(ang) * reach,
    y: (fighter?.y ?? 0) - (fighter?.bodyH ?? 80) * 0.5 + Math.sin(ang) * reach * 0.38,
    front: Math.sin(ang) > 0,
  };
}

const liveRods = new WeakMap();

function dropRods(fighter) {
  const live = liveRods.get(fighter);
  live?.forEach((img) => img?.destroy?.());
  if (live) liveRods.delete(fighter);
}

/** Two rods orbit her and spin about their centres for as long as the sponge is held. */
function syncRods(scene, fighter) {
  const defending = fighter.state === 'defending' && fighter.defenseMove?.releaseRods;
  const art = defending ? artFor(fighter.charDef?.id, fighter.defenseMove.name) : null;
  if (!art?.frames?.length || scene.simFast) {
    dropRods(fighter);
    return;
  }
  let pair = liveRods.get(fighter);
  if (!pair || pair.some((img) => !img?.scene)) {
    dropRods(fighter);
    pair = [0, 1].map(() => placeStill(scene, art, fighter.x, fighter.y, 0));
    liveRods.set(fighter, pair);
  }
  const now = scene.simNow ?? 0;
  const spec = fighter.defenseMove.releaseRods;
  const frame = art.frames[0];
  pair.forEach((img, i) => {
    const at = rodOrbitPoint(fighter, now, i, spec);
    applyFrameLook(img, frame, art, 1);
    img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
    img.setPosition(at.x, at.y);
    img.rotation = (now / 1000) * (art.spin || 7);
    img.setDepth(at.front ? 14 : 7);
  });
}

const meteors = [];

/** Visual rock falling onto a charged landing point. The hit stays a burst. */
export function spawnMeteor(scene, owner, move, target, ms) {
  if (!scene?.add?.image || scene.simFast || !owner || !target) return null;
  const art = artFor(owner.charDef?.id, move?.name);
  const rock = art?.meteor;
  if (!rock?.frames?.length) return null;
  const face = Math.sign((target.x ?? 0) - (owner.x ?? 0)) || owner.facing || 1;
  const from = { x: target.x - face * 260, y: target.y - 380 };
  const img = placeStill(scene, rock, from.x, from.y, 0);
  img.setDepth(18);
  let trail = null;
  if (art.trail?.frames?.length) {
    trail = placeStill(scene, art.trail, from.x, from.y, 0);
    trail.setDepth(17);
    if (art.trail.flat && face < 0) trail.setScale(-Math.abs(trail.scaleX || 1), Math.abs(trail.scaleY || 1));
  }
  meteors.push({
    scene, img, trail, trailArt: art.trail || null, rock,
    from, to: { x: target.x, y: target.y },
    born: scene.simNow ?? 0,
    ms: ms > 0 ? ms : 560,
    face,
    spin: rock.spin || 2.2,
  });
  return img;
}

function tickMeteors(scene) {
  const now = scene?.simNow ?? 0;
  for (let i = meteors.length - 1; i >= 0; i--) {
    const meteor = meteors[i];
    if (meteor.scene !== scene || !meteor.img?.scene) {
      meteor.img?.destroy?.();
      meteor.trail?.destroy?.();
      meteors.splice(i, 1);
      continue;
    }
    const t = Math.min(1, (now - meteor.born) / meteor.ms);
    const x = meteor.from.x + (meteor.to.x - meteor.from.x) * t;
    const y = meteor.from.y + (meteor.to.y - meteor.from.y) * t;
    meteor.img.setPosition(x, y);
    meteor.img.rotation = ((now - meteor.born) / 1000) * meteor.spin;
    const trailArt = meteor.trailArt;
    if (meteor.trail?.setPosition && trailArt?.frames?.length) {
      const frame = trailArt.frames[fxFrameIndex(trailArt, now - meteor.born)] || trailArt.frames[0];
      if (meteor.trail.texture?.key !== frame.key) {
        meteor.trail.setTexture?.(frame.key);
        meteor.trail.setDisplaySize?.(frame.displayW, frame.displayH);
      }
      meteor.trail.setOrigin?.(trailArt.pivotX ?? 0.5, trailArt.pivotY ?? 0.5);
      meteor.trail.setPosition(x, y);
      meteor.trail.rotation = 0;
      const sx = Math.abs(meteor.trail.scaleX || 1);
      const sy = Math.abs(meteor.trail.scaleY || 1);
      meteor.trail.setScale(trailArt.flat && meteor.face < 0 ? -sx : sx, sy);
    }
    if (t >= 1) {
      meteor.img.destroy?.();
      meteor.trail?.destroy?.();
      meteors.splice(i, 1);
    }
  }
}

const seeps = [];

/** Sink at the departure floor, then a glow that slides to the rise. */
export function spawnSeepPath(scene, fighter, art) {
  const from = fighter?._seepFrom;
  if (!from || !art || !scene?.add || scene.simFast) return;
  const y0 = groundTop(scene, from.x, from.y);
  const y1 = groundTop(scene, fighter.x, fighter.y);
  if (art.launch?.frames?.length) spawnFxSprite(scene, art.launch, from.x, y0, 1, 1);
  if (!art.trail?.frames?.length) return;
  const img = placeStill(scene, art.trail, from.x, y0, 0);
  applyFrameLook(img, art.trail.frames[0], art.trail, 1);
  img.setOrigin(art.trail.pivotX ?? 0.5, art.trail.pivotY ?? 1);
  img.setDepth(5);
  seeps.push({
    img,
    art: art.trail,
    x0: from.x,
    y0,
    x1: fighter.x,
    y1,
    born: scene.simNow ?? 0,
    life: 380,
  });
}

function stepSeeps(scene) {
  const now = scene.simNow ?? 0;
  for (let i = seeps.length - 1; i >= 0; i--) {
    const seep = seeps[i];
    if (!seep.img?.scene) {
      seeps.splice(i, 1);
      continue;
    }
    const t = Math.min(1, (now - seep.born) / seep.life);
    seep.img.setPosition(seep.x0 + (seep.x1 - seep.x0) * t, seep.y0 + (seep.y1 - seep.y0) * t);
    const frame = seep.art.frames[fxFrameIndex(seep.art, now - seep.born)] || seep.art.frames[0];
    applyFrameLook(seep.img, frame, seep.art, 1);
    if (t >= 1) {
      seep.img.destroy?.();
      seeps.splice(i, 1);
    }
  }
}

const liveXray = new WeakMap();
const liveWeak = new WeakMap();

function dropXray(fighter) {
  const live = liveXray.get(fighter);
  if (!live) return;
  live.img?.destroy?.();
  if (live.key && fighter.scene?.textures?.remove && fighter.scene.textures.exists?.(live.key)) {
    fighter.scene.textures.remove(live.key);
  }
  if (fighter.rig?.sprite && live.savedAlpha != null) fighter.rig.sprite.setAlpha(live.savedAlpha);
  liveXray.delete(fighter);
}

/** Invert one body frame so Skeleton Flash can show the target as an x-ray negative. */
function xrayTexture(scene, spr, key) {
  const textures = scene?.textures;
  const frame = spr?.frame;
  const source = frame?.source?.image || spr?.texture?.getSourceImage?.();
  if (!textures?.createCanvas || !frame || !source) return null;
  const w = frame.cutWidth || frame.width;
  const h = frame.cutHeight || frame.height;
  if (!(w > 0) || !(h > 0)) return null;
  if (textures.exists?.(key)) textures.remove(key);
  const canvas = textures.createCanvas(key, w, h);
  const ctx = canvas?.getContext?.();
  if (!ctx) return null;
  const sx = frame.cutX || 0;
  const sy = frame.cutY || 0;
  ctx.drawImage(source, sx, sy, w, h, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(img, 0, 0);
  canvas.refresh?.();
  return key;
}

function syncXray(scene, fighter) {
  const now = scene.simNow ?? 0;
  const spr = fighter.rig?.sprite;
  const on = fighter._xrayUntil > now && spr?.scene && fighter.alive && fighter.state !== 'ko';
  if (!on) {
    dropXray(fighter);
    return;
  }
  const frameName = spr.frame?.name ?? '';
  let live = liveXray.get(fighter);
  if (!live?.img?.scene || live.frame !== frameName) {
    const saved = live?.savedAlpha != null && live.savedAlpha > 0.05 ? live.savedAlpha : (spr.alpha ?? 1);
    live?.img?.destroy?.();
    if (live?.key && scene.textures?.exists?.(live.key)) scene.textures.remove(live.key);
    const key = `xray-${fighter.charDef?.id || 'f'}-${now | 0}-${frameName}`;
    const tex = xrayTexture(scene, spr, key);
    if (!tex || !scene.add?.image) {
      liveXray.delete(fighter);
      return;
    }
    const img = scene.add.image(spr.x, spr.y, tex);
    img.setOrigin(spr.originX ?? 0.5, spr.originY ?? 1);
    img.setDepth((spr.depth ?? 10) + 1);
    live = { img, frame: frameName, key: tex, savedAlpha: saved };
    liveXray.set(fighter, live);
  }
  spr.setAlpha(0);
  live.img.setPosition(spr.x, spr.y);
  live.img.setScale(spr.scaleX || 1, spr.scaleY || 1);
  live.img.setRotation?.(spr.rotation || 0);
}

function dropWeak(fighter) {
  const live = liveWeak.get(fighter);
  live?.img?.destroy?.();
  if (live) liveWeak.delete(fighter);
}

function nearestFoe(scene, fighter) {
  let best = null;
  let bestD = Infinity;
  for (const other of scene.fighters || []) {
    if (other === fighter || !other.alive || other.state === 'ko' || other.state === 'dead') continue;
    const d = Math.hypot((other.x ?? 0) - fighter.x, (other.y ?? 0) - fighter.y);
    if (d < bestD) {
      best = other;
      bestD = d;
    }
  }
  return best;
}

/** Weak-spot reticle stays up until the doubled hit lands. */
function syncWeakSpot(scene, fighter) {
  if (!((fighter.doubleNext ?? 0) > 0)) {
    dropWeak(fighter);
    return;
  }
  const art = artFor(fighter.charDef?.id, 'X-Ray Vision')?.reticle;
  if (!art?.frames?.length) return;
  const now = scene.simNow ?? 0;
  let live = liveWeak.get(fighter);
  if (!live?.img?.scene) {
    dropWeak(fighter);
    live = { img: placeStill(scene, art, fighter.x, fighter.y, 0), born: now };
    live.img.setDepth(16);
    liveWeak.set(fighter, live);
  }
  const foe = nearestFoe(scene, fighter);
  const frame = art.frames[fxFrameIndex(art, now - live.born)] || art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  if (foe) {
    live.img.setPosition(foe.x, foe.y - (foe.bodyH ?? 80) * 0.45);
  } else {
    const face = fighter.facing || 1;
    live.img.setPosition(fighter.x + face * (fighter.bodyW ?? 40) * 1.4, fighter.y - (fighter.bodyH ?? 80) * 0.5);
  }
}

export function syncFxActors(scene) {
  if (!scene?.fighters) return;
  stepOneShots(scene);
  stepSeeps(scene);
  stepEmbers(scene);
  tickMeteors(scene);
  for (const fighter of scene.fighters) {
    syncRods(scene, fighter);
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
    syncStuntDouble(scene, fighter);
    syncAfterimage(scene, fighter);
    syncXray(scene, fighter);
    syncWeakSpot(scene, fighter);
    syncSurgePips(scene, fighter);
    syncFissionHalves(scene, fighter);
    syncFreeze(scene, fighter);
    const move = fighter.currentMove;
    const art = artFor(fighter?.charDef?.id, move?.name);
    // Impact-only moves still carry the slash type, with the hit art on a
    // side record and no frames of their own. Drawing that empty sheet
    // throws and stops the match.
    const swinging = art?.frames?.length && art.anchor !== 'lance' && !art.oneshot
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
      if (art.anchor === 'shoulder') {
        x = fighter.x + face * (fighter.bodyW ?? 40) * 0.25;
        y = fighter.y - (fighter.bodyH ?? 80) * 0.62;
      }
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
    if (move?.halfLife) img.setAlpha(move._halfLife ?? 1);
    if (art.burst?.frames?.length && move?.lift && !fighter._liftBurst) {
      const start = fighter.frameData?.startup ?? 0;
      const active = Math.max(1, fighter.frameData?.active ?? 1);
      const along = Math.max(0, (fighter.attackFrame ?? 0) - start) / active;
      if (along >= 0.7) {
        fighter._liftBurst = true;
        const pop = art.burst.scale > 0 ? art.burst.scale : 1;
        spawnFxSprite(
          scene,
          art.burst,
          fighter.x + face * (fighter.bodyW ?? 40) * 0.28,
          fighter.y - (fighter.bodyH ?? 80) * 0.92,
          pop,
          face,
        );
      }
    }
  }
}

const liveHeld = new WeakMap();

function dropHeld(fighter) {
  const live = liveHeld.get(fighter);
  live?.img?.destroy?.();
  live?.rotor?.destroy?.();
  live?.ghost?.destroy?.();
  live?.glow?.destroy?.();
  for (const block of live?.blocks || []) block?.destroy?.();
  for (const medal of live?.medals || []) medal?.destroy?.();
  if (live) liveHeld.delete(fighter);
}

const PACKET_TINT = {
  kinetic: 0xfff2a8,
  physical: 0xfff2a8,
  heat: 0xff7a22,
  electrical: 0x5ce1ff,
  chemical: 0xc57bff,
  radiation: 0x3dff62,
};

function packetTint(type) {
  return PACKET_TINT[type] || 0xffffff;
}

/** Two medal sprites ride the orbiting glows while Double Nobel is charging. */
function syncChargeMedals(scene, live, fighter, art) {
  const medal = art?.shards?.medal;
  if (!medal?.frames?.length) {
    for (const img of live.medals || []) img?.destroy?.();
    live.medals = null;
    return;
  }
  live.medals ??= [];
  while (live.medals.length < 2) {
    const img = placeStill(scene, medal, fighter.x, fighter.y, 0);
    img.setDepth(13);
    live.medals.push(img);
  }
  const now = scene.simNow ?? 0;
  const bodyH = fighter.bodyH ?? 80;
  const radius = bodyH * 0.46;
  for (let i = 0; i < live.medals.length; i++) {
    const img = live.medals[i];
    const ang = now * 0.0036 + i * Math.PI;
    applyFrameLook(img, medal.frames[0], medal, 1);
    img.setOrigin(medal.pivotX ?? 0.5, medal.pivotY ?? 0.67);
    img.setPosition(
      fighter.x + Math.cos(ang) * radius,
      fighter.y - bodyH * 0.55 + Math.sin(ang) * radius * 0.55,
    );
  }
}

/** Alternating blocks rise under the seam glow while the pile is charging. */
function syncChargePile(scene, live, fighter, art, frac) {
  const graphite = art?.shards?.graphite;
  const uranium = art?.shards?.uranium;
  if (!graphite?.frames?.length || !uranium?.frames?.length) return;
  const count = pileCount(frac);
  live.blocks ??= [];
  while (live.blocks.length < count) {
    const spec = live.blocks.length % 2 === 0 ? graphite : uranium;
    const img = placeStill(scene, spec, fighter.x, fighter.y, 0);
    img.setDepth(10);
    live.blocks.push(img);
  }
  while (live.blocks.length > count) live.blocks.pop()?.destroy?.();
  const step = 16;
  for (let i = 0; i < live.blocks.length; i++) {
    const img = live.blocks[i];
    const spec = i % 2 === 0 ? graphite : uranium;
    applyFrameLook(img, spec.frames[0], spec, 1);
    img.setOrigin(spec.pivotX ?? 0.5, spec.pivotY ?? 1);
    img.setPosition(fighter.x, fighter.y - 6 - i * step);
  }
}

/** The blocked hit plays again, faint, with the ghost tint over the attacker. */
export function spawnReplayGhost(scene, defender, attacker, move) {
  if (!scene?.add?.image || scene.simFast || !attacker) return;
  const tint = artFor(defender?.charDef?.id, defender?.defenseMove?.name)?.linger;
  const copied = artFor(attacker?.charDef?.id, move?.name);
  const sheet = copied?.impact?.frames?.length
    ? copied.impact
    : copied?.burst?.frames?.length
      ? copied.burst
      : (copied?.frames?.length ? copied : null);
  const x = attacker.x;
  const y = attacker.y - (attacker.bodyH ?? 80) * 0.5;
  if (sheet?.frames?.length) {
    const img = spawnFxSprite(scene, sheet, x, y, 0.45, attacker.facing || 1);
    img?.setAlpha?.(0.38);
  }
  if (tint?.frames?.length) {
    spawnFxSprite(scene, tint, attacker.x, attacker.y - (attacker.bodyH ?? 80) * 0.42, 1, 1);
  }
}

function stackPipFrame(glow, fighter, scene) {
  if (!glow?.stackSeconds || !fighter || fighter.state !== 'charging') return null;
  const move = fighter.charDef?.moves?.basicCharge;
  const index = stackPipIndex(
    glow.frames.length,
    (scene?.simNow ?? 0) - (fighter.chargeStart ?? 0),
    move?.chargeStack?.every ?? 1000,
    move?.maxChargeMs ?? 3000,
    move?.unblockAt ?? 0.95,
  );
  return glow.frames[index] || glow.frames[0];
}

function syncChargeGlow(scene, live, glow, x, y, frac, elapsed = 0, fighter = null) {
  if (!glow?.frames?.length) {
    live.glow?.destroy?.();
    live.glow = null;
    return;
  }
  if (!live.glow?.scene) {
    live.glow?.destroy?.();
    live.glow = placeStill(scene, glow, x, y, 0);
    live.glow.setDepth(12);
  }
  const stacked = stackPipFrame(glow, fighter, scene);
  const frame = stacked || glow.frames[fxFrameIndex(glow, elapsed)] || glow.frames[0];
  applyFrameLook(live.glow, frame, glow, 1);
  live.glow.setOrigin(glow.pivotX ?? 0.5, glow.pivotY ?? 0.5);
  if (glow.anchor === 'body' && fighter) {
    live.glow.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.5);
  } else {
    live.glow.setPosition(x, y);
  }
  if (glow.rise > 0) live.glow.y -= (fighter?.bodyH ?? 80) * glow.rise;
  if (glow.scaleWith === 'alpha') {
    const tonic = fighter?.charDef?.moves?.basicCharge?.tonic;
    const charging = fighter?.state === 'charging' && fighter.chargeStart != null;
    if (tonic && charging) {
      const every = tonic.every ?? 1000;
      const cap = Math.max(1, Math.floor((fighter.charDef.moves.basicCharge.maxChargeMs ?? every) / every));
      const steps = Math.floor(((scene.simNow ?? 0) - fighter.chargeStart) / every);
      live.glow.setAlpha(0.22 + 0.78 * Math.min(1, steps / cap));
    } else {
      live.glow.setAlpha(0.28 + 0.72 * frac);
    }
  }
}

function syncMotor(scene, live, want, fighter) {
  const art = want.art;
  const frame = art.frames[0];
  applyFrameLook(live.img, frame, art, 1);
  const now = scene.simNow ?? 0;
  const dt = Math.min(0.05, Math.max(0, (now - (live.spinAt ?? now)) / 1000));
  live.spinAt = now;
  const turns = art.spinTurns > 0 ? art.spinTurns : 10;
  live.angle = (live.angle || 0) + turns * Math.PI * 2 * dt;
  const tip = meleeContactPoint(fighter, fighter.currentMove);
  live.img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 0.5);
  live.img.setPosition(tip.x, tip.y);
  live.img.rotation = live.angle;
  live.img.setDepth(14);
  const sparks = want.sparks;
  if (!sparks?.frames?.length) return;
  if (!live.spark?.scene) {
    live.spark = placeStill(scene, sparks, tip.x, tip.y, 0);
    live.spark.setDepth(15);
    live.sparkBorn = now;
  }
  const sparkFrame = sparks.frames[fxFrameIndex(sparks, now - (live.sparkBorn ?? now))] || sparks.frames[0];
  applyFrameLook(live.spark, sparkFrame, sparks, 1);
  live.spark.setOrigin(sparks.pivotX ?? 0.5, sparks.pivotY ?? 0.5);
  live.spark.setPosition(tip.x, tip.y);
  live.spark.rotation = 0;
}

function syncRotor(scene, live, rotor, fighter, frac) {
  if (!rotor?.frames?.length) {
    live.rotor?.destroy?.();
    live.ghost?.destroy?.();
    live.rotor = null;
    live.ghost = null;
    return;
  }
  const now = scene.simNow ?? 0;
  const dt = Math.min(0.05, Math.max(0, (now - (live.rotorAt ?? now)) / 1000));
  live.rotorAt = now;
  const turns = rotorTurns(frac);
  live.rotorAngle = (live.rotorAngle || 0) + turns * Math.PI * 2 * dt;
  if (!live.rotor?.scene) {
    live.rotor = placeStill(scene, rotor, fighter.x, fighter.y, 0);
    live.rotor.setDepth(13);
  }
  const frame = rotor.frames[0];
  applyFrameLook(live.rotor, frame, rotor, 1);
  const face = fighter.facing || 1;
  const bodyW = fighter.bodyW ?? 40;
  const bodyH = fighter.bodyH ?? 80;
  live.rotor.setOrigin(rotor.pivotX ?? 0.5, rotor.pivotY ?? 0.5);
  live.rotor.setPosition(fighter.x + face * bodyW * 0.85, fighter.y - bodyH * 0.52);
  live.rotor.rotation = live.rotorAngle;
  live.rotor.setAlpha(frac > 0.72 ? 0.84 : 1);
  if (frac >= 0.55) {
    if (!live.ghost?.scene) {
      live.ghost = placeStill(scene, rotor, fighter.x, fighter.y, 0);
      live.ghost.setDepth(12);
    }
    applyFrameLook(live.ghost, frame, rotor, 1);
    live.ghost.setOrigin(rotor.pivotX ?? 0.5, rotor.pivotY ?? 0.5);
    live.ghost.setPosition(live.rotor.x, live.rotor.y);
    live.ghost.rotation = live.rotorAngle - 0.45;
    live.ghost.setAlpha(0.22 + 0.18 * frac);
  } else if (live.ghost) {
    live.ghost.destroy();
    live.ghost = null;
  }
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
  } else if ((art?.charge?.frames?.length || art?.heated?.frames?.length) && fighter.state === 'charging') {
    const prop = fighter.heatTaken && art.heated?.frames?.length ? art.heated : art.charge;
    if (prop?.frames?.length) {
      const anchor = prop.anchor;
      const kind = anchor === 'feet' ? 'feet' : anchor === 'predict' ? 'predict' : 'grow';
      want = { art: prop, kind, rotor: art.rotor || null, glow: art.glow || null };
    }
  } else if (art?.boost?.frames?.length && (
    (fighter.speedBuffUntil ?? 0) > now
    || (charge?.buff?.weight && (fighter.weightBuffUntil ?? 0) > now)
    || (charge?.tonic && (fighter.attackPowerUntil ?? 0) > now)
    || (charge?.buff?.showBoost && (fighter.kineticResistUntil ?? 0) > now)
    || ((fighter.bonusHits ?? 0) > 0 && charge?.buff?.bonus && fighter.bonusPacket?.hitsName === charge.buff.bonus.name)
  )) {
    want = { art: art.boost, kind: 'boost' };
  } else if ((fighter.bonusHits ?? 0) > 0 && fighter.bonusPacket?.hitsName) {
    const status = artFor(fighter.charDef?.id, fighter.bonusPacket.hitsName)?.boost;
    if (status?.frames?.length) {
      want = { art: status, kind: 'boost', tint: packetTint(fighter.bonusPacket.type) };
    }
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
  if (want.kind === 'grow' && want.art.anchor === 'head') {
    const elapsed = now - (fighter.chargeStart ?? now);
    const frame = want.art.frames[fxFrameIndex(want.art, elapsed)] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 0.5);
    live.img.setPosition(fighter.x + face * bodyW * 0.12, fighter.y - bodyH * 0.78);
    syncChargeGlow(scene, live, want.glow, fighter.x, fighter.y - bodyH * 0.55, 0, elapsed, fighter);
    return;
  }
  if (want.kind === 'grow') {
    const frames = want.art.frames;
    const max = charge.maxChargeMs || 1;
    const frac = Math.min(1, Math.max(0, (now - (fighter.chargeStart ?? now)) / max));
    const elapsed = now - (fighter.chargeStart ?? now);
    const fill = want.art.fillFrames > 1 ? want.art.fillFrames : 0;
    const frame = fill
      ? frames[Math.min(fill - 1, Math.round(frac * (fill - 1)))]
      : want.art.loop
        ? (frames[fxFrameIndex(want.art, elapsed)] || frames[0])
        : frames[Math.min(frames.length - 1, Math.round(frac * (frames.length - 1)))];
    applyFrameLook(live.img, frame, want.art, 1);
    if (want.art.pulse) {
      const pulse = 0.8 + 0.2 * Math.sin((scene.simNow || 0) * 0.012);
      live.img.setAlpha(pulse * (0.42 + 0.58 * frac));
    }
    if (want.art.anchor === 'body') {
      live.img.setOrigin(0.5, 0.5);
      live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
      if (want.art.scaleWith === 'alpha') live.img.setAlpha(0.28 + 0.72 * frac);
      if (want.art.scaleWith === 'hits') {
        const cap = Math.max(1, charge?.storeHits?.cap ?? 20);
        const n = fighter._storedCharge ?? 0;
        live.img.setAlpha(0.32 + 0.68 * Math.min(1, n / cap));
      }
      if (want.art.scaleWith === 'survived') {
        const sec = Math.max(0, ((scene.simNow ?? 0) - (fighter.bornAt ?? scene.simNow ?? 0)) / 1000);
        live.img.setAlpha(survivedPipAlpha(sec, 12));
      }
      if (want.art.scaleWith === 'charge') {
        const s = 0.55 + 0.7 * frac;
        live.img.setScale(Math.abs(live.img.scaleX || 1) * s, Math.abs(live.img.scaleY || 1) * s);
      }
      syncChargePile(scene, live, fighter, art, frac);
      syncChargeMedals(scene, live, fighter, art);
      if (want.art.tintFrom != null && want.art.tintTo != null) {
        live.img.setTint?.(chargeTint(want.art.tintFrom, want.art.tintTo, frac));
      }
      if (want.art.rumble && frac > 0.2) scene.juice?.addTrauma?.(0.004 * frac);
      if (charge?.perTravel) {
        const need = charge.perTravel * (charge.perTravelCap ?? 5);
        live.img.setAlpha(Math.min(1, Math.max(0, (fighter.travel ?? 0) / Math.max(1, need))));
      }
      if (want.art.flip) {
        const dir = -(fighter.facing || 1);
        live.img.setScale(dir * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
      }
      syncRotor(scene, live, want.rotor, fighter, frac);
      return;
    }
    const onHand = want.art.anchor === 'hand';
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? (onHand ? 0.5 : 1));
    const shot = want.art.scaleMin != null
      ? want.art.scaleMin + ((want.art.scaleMax ?? want.art.scaleMin) - want.art.scaleMin) * frac
      : want.art.scaleWith === 'alpha'
        ? 1
        : 1 + ((charge.chargeRadiusMult ?? 1) - 1) * frac;
    const hand = sheetFxPoint(fighter, 'shot');
    const fallbackX = fighter.x + face * bodyW * (onHand ? 0.9 : 0.65);
    const fallbackY = onHand ? fighter.y - bodyH * 0.52 : fighter.y;
    const heldX = hand?.x ?? fallbackX;
    const heldY = hand?.y ?? fallbackY;
    let jx = 0;
    let jy = 0;
    if (want.art.tremble) {
      const amp = 0.8 + 6.5 * frac;
      const t = now * 0.05;
      jx = Math.sin(t) * amp;
      jy = Math.cos(t * 1.31) * amp * 0.65;
    }
    live.img.setPosition(heldX + jx, heldY + jy);
    if (want.art.scaleWith === 'alpha') live.img.setAlpha(0.28 + 0.72 * frac);
    if (want.art.tintFrom != null && want.art.tintTo != null) {
      live.img.setTint?.(chargeTint(want.art.tintFrom, want.art.tintTo, frac));
    }
    const mirror = want.art.flip ? -face : face;
    live.img.setScale(mirror * Math.abs(live.img.scaleX || 1) * shot, Math.abs(live.img.scaleY || 1) * shot);
    if (want.art.tilt) live.img.rotation = -face * want.art.tilt * frac;
    syncRotor(scene, live, want.rotor, fighter, frac);
    syncChargeGlow(scene, live, want.glow, heldX + jx, heldY + jy, frac, now - (fighter.chargeStart ?? now), fighter);
    return;
  }
  if (want.kind === 'boost') {
    const speedOn = (fighter.speedBuffUntil ?? 0) > now;
    const weightOn = (fighter.weightBuffUntil ?? 0) > now;
    const until = speedOn ? fighter.speedBuffUntil : weightOn ? fighter.weightBuffUntil : fighter.attackPowerUntil;
    const linger = speedOn || weightOn ? (charge?.buff?.ms ?? 2200) : (charge?.tonic?.linger ?? 2200);
    const elapsed = now - Math.max(0, (until ?? now) - linger);
    const frame = want.art.frames[fxFrameIndex(want.art, elapsed)] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 0.5);
    live.img.setPosition(fighter.x, fighter.y - bodyH * 0.5);
    const dir = want.art.flip ? face : 1;
    live.img.setScale(dir * Math.abs(live.img.scaleX || 1), Math.abs(live.img.scaleY || 1));
    if (want.tint) live.img.setTint(want.tint);
    else live.img.clearTint?.();
    return;
  }
  if (want.kind === 'predict') {
    const elapsed = now - (fighter.chargeStart ?? now);
    const max = charge.maxChargeMs || 1;
    const frac = Math.min(1, Math.max(0, elapsed / max));
    const frame = want.art.frames[fxFrameIndex(want.art, elapsed * (1 + frac * 2))] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, 1);
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 0.5);
    const lead = charge?.predict?.lead ?? 1;
    const at = predictSpot(scene, fighter, lead);
    const y = want.art.floor ? groundTop(scene, at.x, fighter.y) : at.y;
    live.img.setPosition(at.x, y);
    if (want.art.floor) live.img.setAlpha(0.45 + 0.55 * frac);
    return;
  }
  if (want.kind === 'feet') {
    const elapsed = now - (fighter.chargeStart ?? now);
    const frame = want.art.frames[fxFrameIndex(want.art, elapsed)] || want.art.frames[0];
    applyFrameLook(live.img, frame, want.art, fxShrink(want.art, elapsed));
    live.img.setOrigin(want.art.pivotX ?? 0.5, want.art.pivotY ?? 1);
    live.img.setPosition(fighter.x, fighter.y);
    if (want.art.flip) {
      const sx = Math.abs(live.img.scaleX || 1);
      const sy = Math.abs(live.img.scaleY || 1);
      live.img.setScale(face * sx, sy);
    }
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

function playPacked(scene, art, x, y, face = 1, along = null, rot = null) {
  if (!art?.frames?.length || !scene?.add?.image || scene.simFast) return;
  const img = placeStill(scene, art, x, y, 0);
  const drawn = along != null ? along : (art.scale > 0 ? art.scale : 1);
  applyFrameLook(img, art.frames[0], { ...art, scale: 1 }, drawn);
  applyFacing(img, face);
  const painted = rot != null ? { ...art, _rot: rot } : art;
  if (rot != null) img.rotation = rot;
  trackOneShot(scene, img, painted, drawn, null, face);
  return img;
}

/** X-ray cone, origin on the handheld unit's nozzle. Left side rotates around that origin. */
export function spawnNozzleCone(scene, fighter, move) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !art.unit?.frames?.length || !scene?.add?.image || scene?.simFast) return null;
  const held = handheldUnit(fighter, art.unit);
  const rot = held.face < 0 ? Math.PI : 0;
  return spawnFxSprite(scene, { ...art, _rot: rot }, held.nozzle.x, held.nozzle.y, beamDrawScale(move), 1);
}

/** Spotlight oneshot, rotated around the lamp origin to the pressed direction. */
export function spawnAimedBeam(scene, fighter, move) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !scene?.add?.image || scene?.simFast) return null;
  const aim = stickAim(fighter);
  const len = Math.min(move?.beamCap ?? 1100, (move?.beamLen ?? 420) * (move?._beamScale || 1));
  const authored = move?.beamArtPx > 0 ? move.beamArtPx : 1100;
  const scale = len / authored;
  const bodyW = fighter.bodyW ?? 40;
  const bodyH = fighter.bodyH ?? 80;
  const x = fighter.x + aim.x * bodyW * 0.35;
  const y = fighter.y - bodyH * 0.58 + aim.y * bodyH * 0.12;
  return spawnFxSprite(scene, { ...art, _rot: Math.atan2(aim.y, aim.x) }, x, y, scale, 1);
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
  const face = painted?.impact?.flip ? (attacker.facing || 1) : 1;
  const now = scene.simNow ?? 0;
  const hot = victim && (victim.burnUntil > now || victim.heatedUntil > now || victim.heatOnHitUntil > now);
  let impact = painted?.impact;
  if (move?.vsHot && hot && painted?.hot?.frames?.length) impact = painted.hot;
  else if (move?.vsHot && !hot && painted?.spark?.frames?.length) impact = painted.spark;
  let along = null;
  let rot = null;
  if (impact?.hitScales?.length) {
    const step = Math.max(0, ((move?._hitIndex ?? 1) | 0) - 1);
    const i = Math.min(impact.hitScales.length - 1, step);
    along = impact.hitScales[i];
    rot = impact.hitRots?.[Math.min((impact.hitRots?.length ?? 1) - 1, step)] ?? 0;
  } else if (along == null) {
    along = impactRadiusScale(move, impact);
  }
  if (move?._slowMul > 0 && impact?.frames?.length) {
    const base = along != null ? along : (impact.scale > 0 ? impact.scale : 1);
    along = base * move._slowMul;
  }
  const multi = move?.multiHit > 1;
  const finisher = playsFinalImpact(move);
  const step = Math.max(0, ((move?._hitIndex ?? 1) | 0) - 1);
  const lift = !finisher && painted?.spark?.rise ? step * (victim?.bodyH ?? 80) * painted.spark.rise : 0;
  if (multi && !move?.vsHot && painted?.spark?.frames?.length && (!finisher || !painted?.impact?.replacesSpark)) {
    const sparkFace = painted.spark.flip ? (attacker.facing || 1) : 1;
    playPacked(scene, painted.spark, at.x, at.y - lift, sparkFace, impactRadiusScale(move, painted.spark));
  }
  if (finisher && !painted?.releaseImpact) {
    const flash = playPacked(scene, impact, at.x, at.y, face, along, rot);
    if (move?.flameTint && flash?.setTint) flash.setTint(flameTestColor(victim?.charDef?.symbol));
  }
  if (move?.onHit?.heal && painted?.heal?.frames?.length) {
    const chest = attacker.y - (attacker.bodyH ?? 80) * 0.62;
    playPacked(scene, painted.heal, attacker.x, chest, 1);
  }
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

/** Crack at the target's feet, then the plume. The warning follows them. */
export function armGeyser(scene, owner, move) {
  if (!scene || !move?.geyser) return;
  let best = null;
  let bestD = Infinity;
  for (const other of scene.fighters || []) {
    if (other === owner || !other.alive || other.state === 'ko' || other.state === 'dead') continue;
    if (other.state === 'defending' && other.defenseMove?.untargetable) continue;
    const d = Math.hypot((other.x ?? 0) - (owner.x ?? 0), (other.y ?? 0) - (owner.y ?? 0));
    if (d < bestD) { bestD = d; best = other; }
  }
  const face = owner?.facing || 1;
  const now = scene.simNow ?? scene.time?.now ?? 0;
  scene._geysers ??= [];
  scene._geysers.push({
    owner,
    target: best,
    move,
    born: now,
    until: now + (move.geyser.warnMs ?? 560),
    x: best?.x ?? (owner?.x ?? 0) + face * 120,
    y: best?.y ?? owner?.y ?? 0,
  });
}

export function tickGeysers(scene, time) {
  const list = scene?._geysers;
  if (!list?.length) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i];
    const target = g.target;
    if (target?.alive && target.state !== 'ko' && target.state !== 'dead') {
      g.x = target.x;
      g.y = target.y;
    }
    const art = artFor(g.owner?.charDef?.id, g.move?.name);
    if (!scene.simFast && art?.warn?.frames?.length && scene.add?.image) {
      if (!g.img?.scene) {
        g.img?.destroy?.();
        g.img = placeStill(scene, art.warn, g.x, g.y, 0);
        g.img.setDepth(4);
      }
      const frame = art.warn.frames[fxFrameIndex(art.warn, time - g.born)] || art.warn.frames[0];
      applyFrameLook(g.img, frame, art.warn, 1);
      g.img.setOrigin(art.warn.pivotX ?? 0.5, art.warn.pivotY ?? 0.61);
      g.img.setPosition(g.x, g.y);
    }
    if (time < g.until) continue;
    list.splice(i, 1);
    g.img?.destroy?.();
    scene.resolveBurst?.(g.owner, g.move, { x: g.x, y: g.y });
    if (!scene.simFast && art?.burst?.frames?.length) {
      spawnFxSprite(scene, art.burst, g.x, g.y, 1);
    }
  }
}

export function clearFxIndexCache() {
  indexSet = undefined;
  byKey.clear();
  oneShots.length = 0;
  embers.length = 0;
  stepEmbers.at = undefined;
}
