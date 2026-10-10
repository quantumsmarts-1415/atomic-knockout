// Drop-in attack art. A PNG in assets/fx/<fighter>/<move-slug>/ replaces the
// code-drawn effect. Nothing in that folder means the old drawing and the
// old hit shape stay exactly as they are. The hit mask is the alpha of the
// loaded image, packed on the same 5 px grid as body masks.

import { effectBox, fxFolder, moveSlug, objectTypeOf } from '../data/attackFx.js';
import { fxPlacementHits } from './boxes.js';

const CELL = 5;
const ALPHA = 127;
const FILL = 0.22;
const byKey = new Map();
let indexSet = undefined;

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

async function loadFrame(scene, rel, key, box, pivotX, pivotY) {
  const img = await loadBitmap(`/${rel}`);
  if (!img) return null;
  const pix = pixelsOf(img);
  const fitted = fit(box, pix.width, pix.height);
  const mask = rasterAlpha({
    data: pix.data,
    width: pix.width,
    height: pix.height,
    displayW: fitted.w,
    displayH: fitted.h,
    pivotX,
    pivotY,
  });
  return { key: rememberTexture(scene, key, img), mask, displayW: fitted.w, displayH: fitted.h };
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

function composeBeam(start, tile, end, length, thick) {
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
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = rasterAlpha({ data, width: w, height: h, displayW: length, displayH: thick, pivotX: 0, pivotY: 0.5 });
  return { canvas, mask };
}

async function loadMoveArt(scene, char, slot, move, index) {
  const id = char.id;
  const folder = fxFolder(id, move.name).replace(/^assets\/fx\//, '');
  const objectType = objectTypeOf(move, slot);
  const sized = effectBox(char, move, objectType);
  const pivot = objectType === 'slash arc' || objectType === 'extend' || objectType === 'beam'
    ? { x: 0, y: 0.5 }
    : { x: 0.5, y: 0.5 };

  const wantBeam = objectType === 'beam' || objectType === 'extend';
  const capRel = `${folder}/cap-start.png`;
  const tileRel = `${folder}/tile.png`;
  const endRel = `${folder}/cap-end.png`;
  if (wantBeam && listed(index, capRel) && listed(index, tileRel) && listed(index, endRel)) {
    const [start, tile, end] = await Promise.all([
      loadBitmap(`/${capRel}`),
      loadBitmap(`/${tileRel}`),
      loadBitmap(`/${endRel}`),
    ]);
    if (start && tile && end) {
      const composed = composeBeam(start, tile, end, sized.w, sized.h);
      const key = `fx-${id}-${moveSlug(move.name)}-beam`;
      if (scene.textures?.exists(key)) scene.textures.remove(key);
      scene.textures.addImage(key, composed.canvas);
      const mask = composed.mask;
      return {
        objectType,
        box: sized,
        pivotX: 0,
        pivotY: 0.5,
        frames: [{ key, mask, displayW: sized.w, displayH: sized.h }],
        beam: true,
      };
    }
  }

  const frames = [];
  for (let i = 0; i < 8; i++) {
    const rel = `${folder}/frame-${i}.png`;
    if (index && !index.has(rel)) break;
    const frame = await loadFrame(scene, rel, `fx-${id}-${moveSlug(move.name)}-${i}`, sized, pivot.x, pivot.y);
    if (!frame) break;
    frames.push(frame);
  }
  if (!frames.length && listed(index, `${folder}/object.png`)) {
    const one = await loadFrame(scene, `${folder}/object.png`, `fx-${id}-${moveSlug(move.name)}`, sized, pivot.x, pivot.y);
    if (one) frames.push(one);
  }
  if (!frames.length && !wantBeam) return null;
  if (!frames.length) return null;
  return { objectType, box: sized, pivotX: pivot.x, pivotY: pivot.y, frames, beam: null };
}

export function fxProjectileView(scene, owner, move, x, y) {
  const art = artFor(owner?.charDef?.id, move?.name);
  const frame = art?.frames?.[0];
  if (!frame || !scene?.add?.image) return null;
  const img = scene.add.image(x, y, frame.key);
  img.setOrigin(art.pivotX, art.pivotY);
  img.setDisplaySize(frame.displayW, frame.displayH);
  img.setDepth(16);
  const face = owner?.facing || 1;
  img.rotation = face === -1 ? Math.PI : 0;
  return {
    gfx: img,
    fxMask: frame.mask,
    fxFrames: art.frames.map((f) => f.key),
    fxMasks: art.frames.map((f) => f.mask),
    fxScale: 1,
  };
}

export function stepFxProjectile(p, time) {
  if (!p?.fxFrames || !p.gfx?.setTexture) return;
  const i = Math.floor(Math.max(0, time - (p.born || 0)) / 125) % p.fxFrames.length;
  if (i !== p._fxFrame) {
    p._fxFrame = i;
    p.gfx.setTexture(p.fxFrames[i]);
    p.fxMask = p.fxMasks?.[i] || p.fxMask;
  }
  p.gfx.rotation = Math.atan2(p.vy || 0, p.vx || 1);
}

function placeStill(scene, art, x, y, rot) {
  const frame = art.frames[0];
  const img = scene.add.image(x, y, frame.key);
  img.setOrigin(art.pivotX, art.pivotY);
  img.setDisplaySize(frame.displayW, frame.displayH);
  img.setDepth(16);
  img.rotation = rot || 0;
  return img;
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

export function drawFxOneShot(scene, fighter, move, x, y, scale = 1) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  if (!art?.frames?.length || !scene?.add?.image) return null;
  if (art.objectType === 'projectile' || art.objectType === 'thrown') return null;
  if (art.objectType === 'slash arc' || art.objectType === 'extend') return null;
  const face = fighter?.facing || 1;
  const rot = art.objectType === 'beam' && face === -1 ? Math.PI : 0;
  const img = placeStill(scene, art, x, y, rot);
  if (scale !== 1) img.setDisplaySize(art.frames[0].displayW * scale, art.frames[0].displayH * scale);
  const life = move?.kind === 'zone'
    ? (move.zone?.ms ?? 1600)
    : art.objectType === 'shield' ? 500 : art.objectType === 'beam' ? 220 : 320;
  scene.tweens?.add?.({
    targets: img, alpha: 0, duration: life, onComplete: () => img.destroy?.(),
  });
  return {
    image: img,
    placement: { mask: art.frames[0].mask, x, y, rot, scale },
  };
}

export function fxHits(fighter, move, x, y, target, scale = 1) {
  const art = artFor(fighter?.charDef?.id, move?.name);
  const frame = art?.frames?.[0];
  if (!frame?.mask || !target) return null;
  const face = fighter?.facing || 1;
  const rot = (art.objectType === 'beam' || art.objectType === 'slash arc' || art.objectType === 'extend') && face === -1
    ? Math.PI
    : 0;
  return fxPlacementHits({ mask: frame.mask, x, y, rot, scale }, target);
}

const liveSlash = new WeakMap();

export function syncFxActors(scene) {
  if (!scene?.fighters) return;
  for (const fighter of scene.fighters) {
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
      const t = fighter.attackFrame || 0;
      img.setTexture(frames[t % frames.length].key);
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
}
