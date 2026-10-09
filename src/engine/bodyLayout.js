// Head-to-feet layout for a sprite cell.
// visibleH / bodyH is the body, not the raw alpha box: hair tips and thin
// glows stay outside it. One value per clip, so the scale does not pop
// from frame to frame inside a cycle.

export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)));
  return s[i];
}

export function median(values) {
  return percentile(values, 0.5);
}

// counts[y] = opaque pixels on that row (already limited to a horizontal
// window when the caller wants to ignore a side lock of hair).
// Head cut is low enough to catch a narrow crown. A short hair puff
// separated from the skull by a gap is skipped. Feet keep a coat hem
// and drop a sparse wisp under the shoes.
export function estimateBody(counts, frameH) {
  let top = frameH;
  let bot = -1;
  let max = 0;
  for (let y = 0; y < frameH; y++) {
    const n = counts[y];
    if (n > max) max = n;
    if (n > 0) {
      if (y < top) top = y;
      bot = y;
    }
  }
  if (bot < 0 || max < 2) return null;
  const span = bot - top + 1;
  const yA = top + Math.floor(span * 0.42);
  const yB = Math.min(bot, top + Math.floor(span * 0.75));
  let torso = 0;
  for (let y = yA; y <= yB; y++) if (counts[y] > torso) torso = counts[y];
  if (torso < 4) torso = max;

  const headCut = Math.max(4, torso * 0.2);
  const runs = [];
  let start = -1;
  for (let y = top; y <= bot; y++) {
    if (counts[y] >= headCut) {
      if (start < 0) start = y;
    } else if (start >= 0) {
      runs.push([start, y - 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, bot]);
  let bodyTop = runs.length ? runs[0][0] : top;
  // A hair puff is a short wide run, then a narrow gap, then the head.
  if (runs.length >= 2) {
    const gap = runs[1][0] - runs[0][1] - 1;
    const firstLen = runs[0][1] - runs[0][0] + 1;
    const secondLen = runs[1][1] - runs[1][0] + 1;
    if (gap >= 4 && firstLen < secondLen * 0.5 && secondLen > 24) bodyTop = runs[1][0];
  }

  const footCut = Math.max(3, torso * 0.08);
  let foot = bot;
  for (let y = bot; y >= bodyTop; y--) {
    if (counts[y] >= footCut) {
      foot = y;
      break;
    }
  }
  if (foot < bodyTop) foot = bot;
  return {
    top,
    bot,
    bodyTop,
    foot,
    fullH: bot - top + 1,
    bodyH: foot - bodyTop + 1,
    torso,
  };
}

// samples are a measurement taken at wider and wider windows.
// Foot: stop before a window that suddenly adds a glow or a tail.
// Head: a narrower window that jumps downward missed the skull.
export function elbowFoot(samples, jump = 70) {
  let chosen = samples[0];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] - chosen > jump) break;
    chosen = samples[i];
  }
  return chosen;
}

export function elbowHead(samples, jump = 28) {
  let chosen = samples[0];
  for (let i = 1; i < samples.length; i++) {
    if (chosen - samples[i] > jump) return samples[i];
    chosen = samples[i];
  }
  return chosen;
}

// head is the narrow window around the torso (side hair drops out).
// foot is the wide window (a stance still counts). full is the whole cell.
// A trim that would eat the skull or the legs is rejected.
export function combineBody(full, head, foot) {
  if (!full) return null;
  let bodyTop = full.bodyTop;
  if (head && head.bodyTop > bodyTop) {
    const trim = head.bodyTop - full.top;
    if (trim < full.fullH * 0.22) bodyTop = head.bodyTop;
  }
  let footRow = full.foot;
  if (foot && full.foot - foot.foot > 24) {
    const lift = full.foot - foot.foot;
    if (lift < full.fullH * 0.35) footRow = foot.foot;
  }
  if (footRow - bodyTop < full.fullH * 0.5) {
    bodyTop = full.bodyTop;
    footRow = full.foot;
  }
  return {
    top: full.top,
    bot: full.bot,
    bodyTop,
    foot: footRow,
    fullH: full.fullH,
    bodyH: Math.max(1, footRow - bodyTop + 1),
    torso: full.torso,
  };
}

// Standing height is the 80th percentile, so a walk crouch does not shrink
// the layout. Feet are the median sole, so the origin stays put.
export function summarizeBodies(frames, frameH) {
  if (!frames.length) return null;
  const foot = Math.round(median(frames.map((f) => f.foot)));
  const bodyH = Math.round(percentile(frames.map((f) => f.bodyH), 0.8));
  const fullH = Math.round(percentile(frames.map((f) => f.fullH), 0.8));
  return {
    frames: frames.length,
    foot,
    bodyH: Math.max(1, bodyH),
    fullH,
    footY: Number(((foot + 1) / frameH).toFixed(4)),
    hairPx: Math.max(0, Math.round(median(frames.map((f) => f.bodyTop - f.top)))),
  };
}

// Scale and origin for one clip. displayScale wins when it is stored;
// otherwise the body height is fitted to art.height. visibleH follows bodyH
// so move-clip manifests and sheets share one convention.
export function clipBodyLayout(artHeight, sheets, clipDef = {}) {
  const footY = clipDef.footY ?? sheets?.footY;
  const bodyH = clipDef.bodyH ?? clipDef.visibleH ?? sheets?.bodyH ?? sheets?.visibleH;
  if (typeof footY !== 'number' || !Number.isFinite(footY)) {
    throw new RangeError(`Clip footY must be a finite number, got ${footY}`);
  }
  if (typeof bodyH !== 'number' || !Number.isFinite(bodyH) || bodyH <= 0) {
    throw new RangeError(`Clip bodyH must be finite and > 0, got ${bodyH}`);
  }
  const displayScale = clipDef.displayScale ?? sheets?.displayScale ?? (artHeight / bodyH);
  if (typeof displayScale !== 'number' || !Number.isFinite(displayScale) || displayScale <= 0) {
    throw new RangeError(`Clip displayScale must be finite and > 0, got ${displayScale}`);
  }
  return { footY, bodyH, visibleH: bodyH, displayScale };
}
