// One coating for every skin-style defense. The tint is painted on the
// fighter's own pixels. It rises from the feet with a soft leading edge,
// then stays on the body while the face is masked out with a feathered
// edge. The face is measured from the current frame, so idle, walk, and
// attack cells each keep their own hole.

import { estimateBody } from './bodyLayout.js';

export const COATS = {
  'Ozone Layer': { color: 0x3a78ff, mode: 'multiply', amount: 0.62, gloss: 0.22, sweepMs: 260, linger: true },
  'Oxide Skin': { color: 0xf3f5f7, mode: 'lighten', amount: 0.58, gloss: 0, sweepMs: 280, matte: true, flake: true },
  'Teflon Coat': { color: 0xf6f7f4, mode: 'lighten', amount: 0.46, gloss: 0.52, sweepMs: 250 },
  'Oil Bath': { color: 0xd4923a, mode: 'multiply', amount: 0.64, gloss: 0.5, sweepMs: 260 },
  'Diamond Plating': { color: 0xf4f8ff, mode: 'lighten', amount: 0.26, gloss: 0.34, sweepMs: 240, sparkle: true },
  'Nitride Shell': { color: 0x6d849c, mode: 'multiply', amount: 0.7, gloss: 0.1, sweepMs: 3000, paceCharge: true },
  'Red Phosphorus Form': { color: 0x7a2e2e, mode: 'multiply', amount: 0.74, gloss: 0, sweepMs: 280, matte: true },
  'Vulcanized Rubber': { color: 0x3a322c, mode: 'multiply', amount: 0.74, gloss: 0, sweepMs: 260, matte: true },
  'Calcify': { color: 0xe7e0d4, mode: 'lighten', amount: 0.52, gloss: 0.06, sweepMs: 280, matte: true },
  'Aerospace Plating': { color: 0x9eb4c8, mode: 'multiply', amount: 0.55, gloss: 0.3, sweepMs: 260 },
  'Mirror Chrome': { color: 0xd8dee6, mode: 'lighten', amount: 0.42, gloss: 0.62, sweepMs: 240, sparkle: true },
  'Work Hardening': { color: 0x8a9098, mode: 'multiply', amount: 0.38, gloss: 0.1, sweepMs: 260, deepen: 0.08 },
  'Superalloy Shell': { color: 0x3e4c5c, mode: 'multiply', amount: 0.72, gloss: 0.08, sweepMs: 280 },
  'Blue Glaze': { color: 0x1d4ed8, mode: 'multiply', amount: 0.64, gloss: 0.55, sweepMs: 240 },
  'Electroplate': { color: 0xc5ccd4, mode: 'lighten', amount: 0.42, gloss: 0.36, sweepMs: 250 },
  'Hot-Dip Galvanize': { color: 0xb7c4d4, mode: 'lighten', amount: 0.4, gloss: 0.24, sweepMs: 260, sparkle: true },
  'Sacrificial Anode': { color: 0xd5d3ce, mode: 'lighten', amount: 0.5, gloss: 0, sweepMs: 260, matte: true },
  'Salt Crust': { color: 0xf4f1ea, mode: 'lighten', amount: 0.58, gloss: 0.04, sweepMs: 200, matte: true },
  'Tyrian Stain': { color: 0x6a1b9a, mode: 'multiply', amount: 0.64, gloss: 0.16, sweepMs: 220 },
  'Flash Tube Counter': { color: 0xe8dcff, mode: 'lighten', amount: 0.48, gloss: 0.22, sweepMs: 200 },
  'Embrittle': { color: 0xc8ccd0, mode: 'lighten', amount: 0.22, gloss: 0.06, sweepMs: 200 },
  'Four-State Guard': {
    color: 0x7a3dff, mode: 'multiply', amount: 0.55, gloss: 0.12, sweepMs: 180,
    cycle: [0x7a3dff, 0x2fbf62, 0x3a78ff, 0xf0c43a], cycleMs: 360,
  },
  'Melt Down': { color: 0xd7dee6, mode: 'lighten', amount: 0.62, gloss: 0.74, sweepMs: 180, full: true },
  'Zircaloy Cladding': { color: 0x6e747c, mode: 'multiply', amount: 0.58, gloss: 0.14, sweepMs: 260, matte: true },
  'Tarnish Guard': { color: 0xf4f7fb, mode: 'lighten', amount: 0.48, gloss: 0.62, sweepMs: 240, sparkle: true },
  'Tin Cry': { color: 0x8d9398, mode: 'multiply', amount: 0.32, gloss: 0, sweepMs: 200, matte: true },
};

const FADE_MS = 220;

export function coatSpec(move) {
  if (!move?.name) return null;
  return COATS[move.name] ?? null;
}

function clamp01(n) {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function smooth(t) {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

function isSkin(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const warm = r > 160 && g > 100 && b > 70 && r > b + 18 && r - g < 80 && g + 15 > b && max - min > 18;
  const pale = r > 185 && g > 170 && b > 160 && max - min < 50 && max - min > 8 && r < 252 && g < 252;
  return warm || pale;
}

function medianX(data, width, y0, y1) {
  const hist = new Int32Array(width);
  let n = 0;
  const yStart = Math.max(0, y0);
  const yEnd = Math.min((data.length / (width * 4)) - 1, y1);
  for (let y = yStart; y <= yEnd; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 40) {
        hist[x] += 1;
        n += 1;
      }
    }
  }
  if (!n) return width * 0.5;
  const mid = n * 0.5;
  let acc = 0;
  for (let x = 0; x < width; x++) {
    acc += hist[x];
    if (acc >= mid) return x;
  }
  return width * 0.5;
}

/**
 * Face ellipse in pixel space for one sprite frame.
 * Skin-colored pixels in the upper body win when they form a compact face.
 * Otherwise the hole sits on the head band of the opaque silhouette.
 */
export function faceRegionFromPixels(data, width, height) {
  if (!data || width < 2 || height < 2) return null;
  const counts = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    let n = 0;
    for (let x = 0; x < width; x++) if (data[row + x * 4 + 3] > 40) n += 1;
    counts[y] = n;
  }
  const body = estimateBody(counts, height);
  if (!body || body.bodyH < 8) return null;
  const headH = Math.max(8, Math.round(body.bodyH * 0.16));
  const yHead0 = body.bodyTop;
  const yHead1 = Math.min(body.foot, body.bodyTop + headH);
  let cx = medianX(data, width, yHead0, yHead1);
  let cy = body.bodyTop + body.bodyH * 0.075;
  let rx = body.bodyH * 0.1;
  let ry = body.bodyH * 0.078;

  // Skin only nudges the hole inside the head band. Chest highlights and
  // a full hair mass must not drag it down onto the collar.
  const skin = [];
  const x0 = Math.max(0, Math.floor(cx - body.bodyH * 0.22));
  const x1 = Math.min(width - 1, Math.ceil(cx + body.bodyH * 0.22));
  for (let y = yHead0; y <= yHead1; y++) {
    const row = y * width * 4;
    for (let x = x0; x <= x1; x++) {
      const i = row + x * 4;
      if (data[i + 3] < 48) continue;
      if (isSkin(data[i], data[i + 1], data[i + 2])) skin.push(x, y);
    }
  }
  if (skin.length >= 24) {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < skin.length; i += 2) {
      sx += skin[i];
      sy += skin[i + 1];
    }
    const n = skin.length / 2;
    cx = sx / n;
    const nudged = sy / n;
    const lo = body.bodyTop + body.bodyH * 0.03;
    const hi = body.bodyTop + body.bodyH * 0.13;
    cy = Math.min(hi, Math.max(lo, nudged));
  }

  const maxChin = body.bodyTop + body.bodyH * 0.2;
  if (cy + ry > maxChin) ry = Math.max(body.bodyH * 0.05, maxChin - cy);
  const chin = Math.min(body.foot - 4, cy + ry);
  return {
    cx,
    cy,
    rx: Math.max(4, rx),
    ry: Math.max(4, ry),
    bodyTop: body.bodyTop,
    bodyH: body.bodyH,
    foot: body.foot,
    top: body.top,
    chin,
    skin: skin.length / 2,
  };
}

function sweepEdge(region, sweep) {
  const crown = Number.isFinite(region.top) ? region.top : Math.max(0, region.cy - region.ry * 1.6);
  const span = Math.max(1, region.foot - crown);
  return {
    span,
    edge: region.foot - clamp01(sweep) * span,
    feather: Math.max(4, span * 0.065),
  };
}

/**
 * 0 on the face and above the rising edge, 1 on the coated body.
 * The rim of the face ellipse and the leading edge are both feathered.
 */
export function coatCoverage(x, y, region, sweep, full = false) {
  if (!region) return 0;
  const { edge, feather } = sweepEdge(region, sweep);
  let rise;
  if (y >= edge + feather) rise = 1;
  else if (y <= edge - feather) rise = 0;
  else rise = smooth((y - (edge - feather)) / (feather * 2));
  if (full) return rise;
  const nx = (x - region.cx) / Math.max(1, region.rx);
  const ny = (y - region.cy) / Math.max(1, region.ry);
  const d = Math.hypot(nx, ny);
  let face = 1;
  if (d <= 0.7) face = 0;
  else if (d < 1.2) face = smooth((d - 0.7) / 0.5);
  return rise * face;
}

export function coatSheen(x, y, region, sweep, gloss, full = false) {
  if (!gloss || !region) return 0;
  const cover = coatCoverage(x, y, region, sweep, full);
  if (cover <= 0) return 0;
  const { edge, span } = sweepEdge(region, sweep);
  const band = Math.max(0, 1 - Math.abs(y - edge) / Math.max(6, span * 0.055));
  const streak = Math.max(0, 1 - Math.abs(x - region.cx) / Math.max(1, region.rx * 2.4));
  return gloss * cover * Math.min(1, band * 0.85 + streak * 0.28);
}

export function tintChannels(r, g, b, spec, sheen = 0) {
  const cr = (spec.color >> 16) & 255;
  const cg = (spec.color >> 8) & 255;
  const cb = spec.color & 255;
  const s = spec.amount ?? 0.6;
  let R;
  let G;
  let B;
  if (spec.mode === 'lighten') {
    R = r + (cr - r) * s;
    G = g + (cg - g) * s;
    B = b + (cb - b) * s;
  } else {
    R = r * (1 - s) + (r * cr / 255) * s;
    G = g * (1 - s) + (g * cg / 255) * s;
    B = b * (1 - s) + (b * cb / 255) * s;
  }
  if (sheen > 0) {
    R = Math.min(255, R + (255 - R) * sheen);
    G = Math.min(255, G + (255 - G) * sheen);
    B = Math.min(255, B + (255 - B) * sheen);
  }
  return [Math.round(R), Math.round(G), Math.round(B)];
}

export function sparkleAt(x, y, bucket) {
  return x % 14 === (bucket * 3) % 14 && y % 14 === (bucket * 5) % 14;
}

function paintedSpec(spec, fighter, elapsed = 0) {
  let next = spec;
  if (spec.cycle?.length) {
    const step = spec.cycleMs ?? 360;
    const i = Math.floor(Math.max(0, elapsed) / step) % spec.cycle.length;
    next = { ...spec, color: spec.cycle[i] };
  }
  if (spec.deepen && fighter?.hardenStacks) {
    next = {
      ...next,
      amount: Math.min(0.92, (spec.amount ?? 0.4) + fighter.hardenStacks * spec.deepen),
    };
  }
  return next;
}

function heldCoat(name, fighter, now) {
  const spec = coatSpec({ name });
  if (!spec) return null;
  return { spec: paintedSpec(spec, fighter, 9999), move: { name }, sweep: 1, phase: 'hold' };
}

function moveCoat(fighter, move, now, phase) {
  const spec = coatSpec(move);
  if (!spec || fighter._coatFlaked) return null;
  if (spec.paceCharge && fighter._shellBroken) return null;
  const elapsed = Math.max(0, now - (fighter.defenseStart ?? now));
  let sweep = 1;
  if (phase === 'rise') {
    const ms = spec.paceCharge && move?.chargeMs ? move.chargeMs : (spec.sweepMs ?? 260);
    sweep = clamp01(elapsed / ms);
  }
  return { spec: paintedSpec(spec, fighter, elapsed), move, sweep, phase };
}

/** The coat that should be on the sprite right now, or null. */
export function coatWindow(fighter, now) {
  if (!fighter || fighter._coatFlaked) return null;
  if (fighter.state === 'defending' && fighter.defenseMove) {
    const live = moveCoat(fighter, fighter.defenseMove, now, 'rise');
    if (live) return live;
  }
  if (fighter.lingerImmuneUntil > now && fighter.lingerImmune?.includes('radiation')) {
    const ward = fighter.charDef?.moves?.specialDefense;
    const live = moveCoat(fighter, ward, now, 'hold');
    if (live?.spec.linger) return live;
  }
  if (fighter.mitigateUntil > now) {
    const shell = fighter.charDef?.moves?.specialDefense;
    const live = moveCoat(fighter, shell, now, 'hold');
    if (live?.spec.paceCharge) return live;
  }
  if (fighter.debuffCoatUntil > now && fighter.debuffCoat) {
    const mark = heldCoat(fighter.debuffCoat, fighter, now);
    if (mark) return mark;
  }
  if (fighter.buffCoatUntil > now && fighter.buffCoat) {
    const buff = heldCoat(fighter.buffCoat, fighter, now);
    if (buff) return buff;
  }
  if (fighter.state !== 'defending' && fighter.kineticResistUntil > now && fighter._hardenCoat) {
    const hard = heldCoat(fighter._hardenCoat, fighter, now);
    if (hard) return hard;
  }
  return null;
}

export function coatFadeMs() {
  return FADE_MS;
}
