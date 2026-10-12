// Draws the shared coating on top of whatever frame the rig is showing.
// The hole is recomputed when the cell changes, so a walk or attack pose
// does not leave the face covered.

import {
  coatCoverage, coatFadeMs, coatSheen, coatSpec, coatWindow, faceRegionFromPixels,
  sparkleAt, tintChannels,
} from './coat.js';

const MAX_H = 300;
const slots = new WeakMap();
const flakes = [];
let seq = 0;

function sourceImage(frame) {
  const image = frame?.source?.image;
  if (!image) return null;
  if (image.complete === false) return null;
  if (!(image.width > 0)) return null;
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
  const key = `coat-px-${++seq}`;
  if (!scene.textures.exists(key)) scene.textures.createCanvas(key, 4, 4);
  const image = scene.make.image({ x: 0, y: 0, key, add: false });
  image.setBlendMode?.(0);
  rig.add(image);
  slot = { key, image, stamp: '', frameId: '' };
  slots.set(spr, slot);
  return slot;
}

function paintCoat(tex, base, face, spec, sweep, bucket) {
  const w = tex.width;
  const h = tex.height;
  const ctx = tex.getContext();
  const img = ctx.createImageData(w, h);
  const out = img.data;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      const a = base[i + 3];
      if (a < 8) continue;
      const cover = coatCoverage(x + 0.5, y + 0.5, face, sweep, !!spec.full);
      if (cover < 0.012) continue;
      let sheen = coatSheen(x + 0.5, y + 0.5, face, sweep, spec.gloss || 0, !!spec.full);
      if (spec.sparkle && cover > 0.82 && sparkleAt(x, y, bucket)) sheen = Math.max(sheen, 0.92);
      const [r, g, b] = tintChannels(base[i], base[i + 1], base[i + 2], spec, sheen);
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = Math.round(a * cover);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
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
  const base = new Uint8ClampedArray(snap.data);
  const face = faceRegionFromPixels(base, dw, dh);
  return { base, face, dw, dh };
}

function syncSprite(scene, rig, spr, visual, now) {
  const slot = ensureSlot(scene, rig, spr);
  const img = slot.image;
  if (!visual) {
    img.setVisible(false);
    return;
  }
  const tex = scene.textures.get(slot.key);
  const frame = spr.frame;
  const frameId = `${spr.texture?.key || ''}:${frame?.name}:${frame?.cutX}:${frame?.cutY}`;
  if (slot.frameId !== frameId || !slot.base || !slot.face) {
    const cap = captureFrame(tex, spr);
    if (!cap?.face) {
      img.setVisible(false);
      return;
    }
    slot.base = cap.base;
    slot.face = cap.face;
    slot.frameId = frameId;
    slot.stamp = '';
  }
  const bucket = visual.spec.sparkle ? Math.floor(now / 90) : 0;
  const stamp = `${Math.round(visual.sweep * 24)}|${bucket}|${visual.spec.color}`;
  if (slot.stamp !== stamp) {
    paintCoat(tex, slot.base, slot.face, visual.spec, visual.sweep, bucket);
    slot.stamp = stamp;
  }
  img.setTexture(slot.key);
  img.setVisible(true);
  img.setOrigin(spr.originX, spr.originY);
  img.setDisplaySize(Math.abs(spr.displayWidth), Math.abs(spr.displayHeight));
  img.setFlipX(!!spr.flipX);
  img.x = spr.x;
  img.y = spr.y;
  img.rotation = spr.rotation || 0;
  img.setAlpha(Math.max(0, Math.min(1, (visual.alpha ?? 1) * spr.alpha)));
  rig.bringToTop?.(img);
}

const VECTOR = ['frontLeg', 'backLeg', 'torso', 'frontArm', 'backArm'];

function syncVector(rig, visual) {
  if (!rig?.torso) return;
  if (!visual || (visual.alpha ?? 1) <= 0.01) {
    if (rig._coatTinted) {
      for (const name of VECTOR) rig[name]?.clearTint?.();
      rig._coatTinted = false;
    }
    return;
  }
  const sweep = visual.sweep * (visual.alpha ?? 1);
  const color = visual.spec.color;
  const show = {
    frontLeg: sweep > 0.05,
    backLeg: sweep > 0.05,
    torso: sweep > 0.42,
    frontArm: sweep > 0.42,
    backArm: sweep > 0.42,
  };
  for (const name of VECTOR) {
    const part = rig[name];
    if (!part?.setTint) continue;
    if (show[name]) part.setTint(color);
    else part.clearTint?.();
  }
  rig._coatTinted = true;
}

function hideSprites(rig) {
  for (const spr of [rig?.sprite, rig?.fadeSprite, rig?.clipA, rig?.clipB]) {
    const slot = spr && slots.get(spr);
    slot?.image?.setVisible(false);
  }
}

function spawnFlakes(scene, fighter, color) {
  const now = scene.simNow ?? 0;
  const n = 22;
  for (let i = 0; i < n; i++) {
    const rect = scene.add.rectangle?.(
      fighter.x + (Math.random() - 0.5) * (fighter.bodyW || 36),
      fighter.y - Math.random() * (fighter.bodyH || 90),
      8 + Math.random() * 6,
      5,
      color,
      0.96,
    );
    if (!rect) return;
    rect.setDepth?.(22);
    rect.setAngle?.(Math.random() * 50 - 25);
    flakes.push({
      rect,
      vx: (Math.random() - 0.5) * 110,
      vy: -40 - Math.random() * 120,
      born: now,
      life: 460,
    });
  }
}

function stepFlakes(scene) {
  const now = scene.simNow ?? 0;
  for (let i = flakes.length - 1; i >= 0; i--) {
    const flake = flakes[i];
    const t = (now - flake.born) / flake.life;
    if (t >= 1 || !flake.rect?.active) {
      flake.rect?.destroy?.();
      flakes.splice(i, 1);
      continue;
    }
    flake.rect.x += flake.vx * 0.016;
    flake.rect.y += flake.vy * 0.016;
    flake.vy += 50 * 0.016;
    flake.rect.setAlpha?.(0.92 * (1 - t));
    flake.rect.rotation = (flake.rect.rotation || 0) + 0.04;
  }
}

function visualFor(fighter, now) {
  const live = coatWindow(fighter, now);
  if (live) {
    const visual = { spec: live.spec, sweep: live.sweep, alpha: 1 };
    fighter._coatVis = visual;
    fighter._coatFadeAt = 0;
    return visual;
  }
  if (fighter._coatFlaked) {
    fighter._coatVis = null;
    fighter._coatFadeAt = 0;
    return null;
  }
  if (!fighter._coatVis) return null;
  if (!fighter._coatFadeAt) fighter._coatFadeAt = now;
  const t = (now - fighter._coatFadeAt) / coatFadeMs();
  if (t >= 1) {
    fighter._coatVis = null;
    fighter._coatFadeAt = 0;
    return null;
  }
  return { spec: fighter._coatVis.spec, sweep: fighter._coatVis.sweep, alpha: 1 - t };
}

export function syncCoats(scene) {
  if (!scene?.fighters || scene.simFast) return;
  const now = scene.simNow ?? 0;
  stepFlakes(scene);
  for (const fighter of scene.fighters) {
    if (fighter._coatShed && !fighter._coatShedPlayed) {
      spawnFlakes(scene, fighter, fighter._coatShed.color ?? 0xf3f5f7);
      fighter._coatShedPlayed = true;
    }
    const rig = fighter.rig;
    if (!rig) continue;
    const visual = visualFor(fighter, now);
    if (rig.torso) {
      hideSprites(rig);
      syncVector(rig, visual);
      continue;
    }
    syncVector(rig, null);
    if (!visual) {
      hideSprites(rig);
      continue;
    }
    const sprites = bodySprites(rig);
    const seen = new Set(sprites);
    for (const spr of [rig.sprite, rig.fadeSprite, rig.clipA, rig.clipB]) {
      if (spr && !seen.has(spr)) slots.get(spr)?.image?.setVisible(false);
    }
    for (const spr of sprites) syncSprite(scene, rig, spr, visual, now);
  }
}

export { coatSpec };
