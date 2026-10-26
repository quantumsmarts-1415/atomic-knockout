// Drop-in move clips. A character may ship a horizontal strip and a small
// manifest; nothing in the moveset has to change. No file means the idle
// telegraph stays.

export const MOVE_KEYS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];

const clipsById = new Map();

export function clamp01(t) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// 1–8, or null when the manifest entry should be ignored.
export function clipFrameCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 8) return null;
  return i;
}

function smooth(a, b, t) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const u = (t - a) / (b - a);
  return u * u * (3 - 2 * u);
}

// Anticipation squashes, the strike stretches and lunges, recovery settles.
export function squashStretch(t) {
  const u = clamp01(t);
  let scaleX;
  let scaleY;
  let lunge;
  if (u < 0.28) {
    const k = u / 0.28;
    scaleX = 1 + 0.10 * k;
    scaleY = 1 - 0.12 * k;
    lunge = -8 * k;
  } else if (u < 0.55) {
    const k = (u - 0.28) / 0.27;
    scaleX = 1.10 - 0.20 * k;
    scaleY = 0.88 + 0.22 * k;
    lunge = -8 + 22 * k;
  } else {
    const k = (u - 0.55) / 0.45;
    scaleX = 0.90 + 0.10 * k;
    scaleY = 1.10 - 0.10 * k;
    lunge = 14 * (1 - k);
  }
  return { scaleX, scaleY, lunge, y: (1 - scaleY) * 6 };
}

export function clipPose(t, frameCount) {
  const n = clipFrameCount(frameCount);
  const u = clamp01(t);
  const still = { scaleX: 1, scaleY: 1, lunge: 0, y: 0 };
  if (n == null) {
    return { ok: false, mode: 'none', frames: 0, frame: 0, frameB: 0, blend: 0, ...still };
  }
  if (n >= 4) {
    const frame = u >= 1 ? n - 1 : Math.min(n - 1, Math.floor(u * n));
    return { ok: true, mode: 'scrub', frames: n, frame, frameB: frame, blend: 0, ...still };
  }
  const body = squashStretch(u);
  if (n === 1) {
    return { ok: true, mode: 'tween', frames: 1, frame: 0, frameB: 0, blend: 0, ...body };
  }
  if (n === 2) {
    return { ok: true, mode: 'tween', frames: 2, frame: 0, frameB: 1, blend: smooth(0.22, 0.46, u), ...body };
  }
  const toStrike = smooth(0.18, 0.36, u);
  const toRecover = smooth(0.55, 0.75, u);
  return {
    ok: true,
    mode: 'tween',
    frames: 3,
    frame: toRecover > 0 ? 1 : 0,
    frameB: toRecover > 0 ? 2 : 1,
    blend: toRecover > 0 ? toRecover : toStrike,
    ...body,
  };
}

export function moveManifestUrl(characterId) {
  return `/public/assets/sprites/moves/${characterId}/manifest.json`;
}

export function moveStripUrl(characterId, moveKey) {
  return `/public/assets/sprites/moves/${characterId}/${moveKey}.png`;
}

export function moveTextureKey(characterId, moveKey) {
  return `move-${characterId}-${moveKey}`;
}

function positive(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// Missing cell size, footY, and visibleH fall back to that character's idle cell.
export function normalizeManifest(raw, idle = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw.moves && typeof raw.moves === 'object' ? raw.moves : null;
  if (!src) return null;
  const moves = {};
  for (const key of MOVE_KEYS) {
    const entry = src[key];
    if (!entry || typeof entry !== 'object') continue;
    const frames = clipFrameCount(entry.frames);
    const cellW = positive(entry.cellW ?? raw.cellW ?? idle.cellW);
    const cellH = positive(entry.cellH ?? raw.cellH ?? idle.cellH);
    const footY = finite(entry.footY ?? raw.footY ?? idle.footY);
    const visibleH = positive(entry.visibleH ?? raw.visibleH ?? idle.visibleH);
    if (frames == null || cellW == null || cellH == null || footY == null || visibleH == null) continue;
    moves[key] = { frames, cellW, cellH, footY, visibleH };
  }
  return { moves };
}

export function setMoveClips(characterId, moves) {
  clipsById.set(characterId, moves ?? {});
}

export function moveClipFor(characterId, moveKey) {
  return clipsById.get(characterId)?.[moveKey] ?? null;
}

export async function collectMoveStrips(roster) {
  const jobs = [];
  await Promise.all(roster.map(async (c) => {
    if (!c?.id) return;
    // Only fighters whose art opts in have a key-pose strip folder. Probing
    // every fighter 404'd once per fighter in each match.
    if (!c.art?.moveStrips) return;
    let res;
    try {
      res = await fetch(moveManifestUrl(c.id));
    } catch {
      return;
    }
    if (!res.ok) return;
    let raw;
    try {
      raw = await res.json();
    } catch {
      return;
    }
    const norm = normalizeManifest(raw, idleCellOf(c));
    if (!norm) return;
    setMoveClips(c.id, norm.moves);
    for (const [key, def] of Object.entries(norm.moves)) {
      jobs.push({
        id: c.id,
        moveKey: key,
        url: moveStripUrl(c.id, key),
        textureKey: moveTextureKey(c.id, key),
        ...def,
      });
    }
  }));
  return jobs;
}

export function idleCellOf(charDef) {
  const sheets = charDef?.art?.sheets;
  const idle = sheets?.clips?.idle ?? {};
  return {
    cellW: idle.frameW ?? sheets?.frameW,
    cellH: idle.frameH ?? sheets?.frameH,
    footY: idle.footY ?? sheets?.footY,
    // Body height, not the raw alpha box. A manifest that omits visibleH
    // inherits the idle body so the clip matches the idle scale.
    visibleH: idle.bodyH ?? idle.visibleH ?? sheets?.bodyH ?? sheets?.visibleH,
  };
}
