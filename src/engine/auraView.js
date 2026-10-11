// Unquenchable is built from Maggie's current sprite, not the generic figure
// on the aura sheet. The sheet only lends flame color and the rising tips.

import { artFor, fxFrameIndex } from './fxArt.js';

const MAX_H = 300;
const RIM = 22;
const slots = new WeakMap();
const flames = new WeakMap();
const texCache = new Map();
let seq = 0;

function sourceImage(frame) {
  const image = frame?.source?.image;
  if (!image || image.complete === false || !(image.width > 0)) return null;
  return image;
}

function bodySprites(rig) {
  if (!rig || rig.torso) return [];
  const out = [];
  for (const spr of [rig.sprite, rig.fadeSprite, rig.clipA, rig.clipB]) {
    if (!spr?.visible || !(spr.alpha > 0.02) || !spr.frame) continue;
    if (!sourceImage(spr.frame)) continue;
    out.push(spr);
  }
  return out;
}

function ensureSlot(scene, rig, spr) {
  let slot = slots.get(spr);
  if (slot?.image?.scene) return slot;
  const key = `aura-px-${++seq}`;
  if (!scene.textures.exists(key)) scene.textures.createCanvas(key, 4, 4);
  const image = scene.make.image({ x: 0, y: 0, key, add: false });
  image.setBlendMode?.('ADD');
  rig.add(image);
  slot = { key, image, frameId: '' };
  slots.set(spr, slot);
  return slot;
}

function captureFrame(tex, spr) {
  const frame = spr.frame;
  const image = sourceImage(frame);
  if (!image) return null;
  const sw = frame.cutWidth || frame.realWidth || frame.width;
  const sh = frame.cutHeight || frame.realHeight || frame.height;
  if (!(sw > 1) || !(sh > 1)) return null;
  const scale = Math.min(1, MAX_H / sh);
  const dw = Math.max(2, Math.round(sw * scale));
  const dh = Math.max(2, Math.round(sh * scale));
  if (tex.width !== dw || tex.height !== dh) tex.setSize(dw, dh);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, dw, dh);
  ctx.drawImage(image, frame.cutX || 0, frame.cutY || 0, sw, sh, 0, 0, dw, dh);
  const snap = ctx.getImageData(0, 0, dw, dh);
  return { base: new Uint8ClampedArray(snap.data), dw, dh };
}

function chamfer(solid, w, h) {
  const n = w * h;
  const dist = new Uint16Array(n);
  dist.fill(65535);
  for (let i = 0; i < n; i++) if (solid[i]) dist[i] = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 3);
      if (y > 0) d = Math.min(d, dist[i - w] + 3);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - w - 1] + 4);
      if (x + 1 < w && y > 0) d = Math.min(d, dist[i - w + 1] + 4);
      dist[i] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = dist[i];
      if (x + 1 < w) d = Math.min(d, dist[i + 1] + 3);
      if (y + 1 < h) d = Math.min(d, dist[i + w] + 3);
      if (x + 1 < w && y + 1 < h) d = Math.min(d, dist[i + w + 1] + 4);
      if (x > 0 && y + 1 < h) d = Math.min(d, dist[i + w - 1] + 4);
      dist[i] = d;
    }
  }
  return dist;
}

function buildField(base, w, h) {
  const n = w * h;
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) solid[i] = base[i * 4 + 3] >= 28 ? 1 : 0;
  const dist = chamfer(solid, w, h);
  const limit = RIM * 3;
  const idx = [];
  const weight = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) {
        const edge = (x > 0 && !solid[i - 1]) || (x + 1 < w && !solid[i + 1])
          || (y > 0 && !solid[i - w]) || (y + 1 < h && !solid[i + w]);
        if (!edge) continue;
        idx.push(i);
        weight.push(0);
        continue;
      }
      const d = dist[i];
      if (d > 0 && d <= limit) {
        idx.push(i);
        weight.push(Math.min(255, Math.round((d / limit) * 255)));
      }
    }
  }
  return { idx, weight, w, h };
}

function flameSample(scene, art) {
  const key = art?.texture?.frames?.[0]?.key;
  if (!key || texCache.has(key)) return texCache.get(key) || null;
  const src = scene.textures.get(key)?.getSourceImage?.();
  if (!src?.width) return null;
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const rec = {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    w: canvas.width,
    h: canvas.height,
  };
  texCache.set(key, rec);
  return rec;
}

function paintRim(tex, field, sample, scroll) {
  const { idx, weight, w, h } = field;
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  const out = img.data;
  const tw = sample?.w || 0;
  const th = sample?.h || 0;
  const pix = sample?.data;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const t = weight[k] / 255;
    let r = 255 + (170 - 255) * t;
    let g = 248 + (206 - 248) * t;
    let b = 236 + (230 - 236) * t;
    let a = (1 - t) * (1 - t * 0.35) * 200;
    if (pix && tw > 0 && th > 0) {
      const x = i % w;
      const y = (i / w) | 0;
      const u = ((x + scroll) % tw + tw) % tw;
      const v = ((y - scroll * 2) % th + th) % th;
      let p = (v * tw + u) * 4;
      if (pix[p + 3] <= 16) {
        for (let dy = 1; dy <= 3 && pix[p + 3] <= 16; dy++) {
          for (const s of [-dy, dy]) {
            const vv = (v + s + th) % th;
            const q = (vv * tw + u) * 4;
            if (pix[q + 3] > 16) { p = q; break; }
          }
        }
      }
      const ta = pix[p + 3];
      if (ta > 16) {
        const tr = pix[p];
        const tg = pix[p + 1];
        const tb = pix[p + 2];
        const lum = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb;
        const add = Math.min(1, lum / 220) * (ta / 255);
        r += tr * add * 0.65;
        g += tg * add * 0.55;
        b += tb * add * 0.4;
        if (lum > 190) a += 48;
      }
    }
    const o = i * 4;
    out[o] = r < 0 ? 0 : r > 255 ? 255 : r;
    out[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    out[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    out[o + 3] = a < 0 ? 0 : a > 255 ? 255 : a;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

function syncSprite(scene, rig, spr, art, sample, scroll, alpha) {
  const slot = ensureSlot(scene, rig, spr);
  const img = slot.image;
  const frame = spr.frame;
  const frameId = `${spr.texture?.key || ''}:${frame?.name}:${frame?.cutX}:${frame?.cutY}`;
  const tex = scene.textures.get(slot.key);
  if (slot.frameId !== frameId || !slot.field) {
    const cap = captureFrame(tex, spr);
    if (!cap) {
      img.setVisible(false);
      return;
    }
    slot.field = buildField(cap.base, cap.dw, cap.dh);
    slot.frameId = frameId;
  }
  paintRim(tex, slot.field, sample, scroll);
  img.setTexture(slot.key);
  img.setVisible(true);
  img.setOrigin(spr.originX, spr.originY);
  img.setDisplaySize(Math.abs(spr.displayWidth), Math.abs(spr.displayHeight));
  img.setFlipX(!!spr.flipX);
  img.x = spr.x;
  img.y = spr.y;
  img.rotation = spr.rotation || 0;
  img.setAlpha(Math.max(0, Math.min(1, alpha * spr.alpha)));
  rig.bringToTop?.(img);
}

function hideSprites(rig) {
  for (const spr of [rig?.sprite, rig?.fadeSprite, rig?.clipA, rig?.clipB]) {
    slots.get(spr)?.image?.setVisible(false);
  }
}

function dropFlames(fighter) {
  const live = flames.get(fighter);
  live?.forEach((img) => img.destroy?.());
  if (live) flames.delete(fighter);
}

function syncFlames(scene, fighter, art, now, strength, lit) {
  if (!art?.frames?.length || strength < 0.04) {
    dropFlames(fighter);
    return;
  }
  let imgs = flames.get(fighter);
  if (!imgs?.[0]?.scene) {
    dropFlames(fighter);
    imgs = [0, 1].map(() => {
      const img = scene.add.image(0, 0, art.frames[0].key);
      img.setOrigin(art.pivotX ?? 0.5, art.pivotY ?? 1);
      img.setBlendMode?.('ADD');
      img.setDepth(14);
      return img;
    });
    flames.set(fighter, imgs);
  }
  const bodyH = fighter.bodyH ?? 80;
  const crown = fighter.y - bodyH * 0.96;
  const grow = lit ? 1 : 0.55 + 0.45 * strength;
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const t = ((now / 760) + i * 0.5) % 1;
    const frame = art.frames[fxFrameIndex(art, now + i * 180)] || art.frames[0];
    img.setTexture(frame.key);
    img.setDisplaySize(frame.displayW * grow, frame.displayH * grow);
    img.setPosition(fighter.x, crown - t * bodyH * 0.36);
    img.setAlpha(strength * (0.3 + 0.7 * (1 - t)));
    img.setVisible(true);
  }
}

function auraState(fighter, now) {
  const move = fighter.charDef?.moves?.basicCharge;
  if (!move?.buff?.unquenchable) return null;
  const art = artFor(fighter.charDef?.id, move.name);
  if (!art?.spriteAura) return null;
  const charging = fighter.state === 'charging' && fighter.chargeStart != null;
  const lit = (fighter.unquenchableUntil ?? 0) > now;
  if (!charging && !lit) return null;
  const max = move.maxChargeMs || 1;
  const frac = charging ? Math.max(0, Math.min(1, (now - fighter.chargeStart) / max)) : 1;
  return { art, strength: lit ? 1 : frac, lit };
}

export function syncAuras(scene) {
  if (!scene?.fighters || scene.simFast) return;
  const now = scene.simNow ?? 0;
  const scroll = Math.floor(now * 0.11);
  for (const fighter of scene.fighters) {
    const visual = auraState(fighter, now);
    const rig = fighter.rig;
    if (!visual) {
      if (rig) hideSprites(rig);
      dropFlames(fighter);
      continue;
    }
    const flicker = 0.86 + 0.14 * Math.sin(now / 46);
    const sample = flameSample(scene, visual.art);
    if (rig && !rig.torso) {
      const sprites = bodySprites(rig);
      const seen = new Set(sprites);
      for (const spr of [rig.sprite, rig.fadeSprite, rig.clipA, rig.clipB]) {
        if (spr && !seen.has(spr)) slots.get(spr)?.image?.setVisible(false);
      }
      for (const spr of sprites) {
        syncSprite(scene, rig, spr, visual.art, sample, scroll, visual.strength * flicker);
      }
    } else if (rig) hideSprites(rig);
    syncFlames(scene, fighter, visual.art, now, visual.strength * flicker, visual.lit);
  }
}
