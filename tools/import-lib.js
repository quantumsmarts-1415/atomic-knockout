// Turn a fighter folder (horizontal strips + manifest) into the grid
// sheets, foot line, and display scale the roster already uses.
//
// Frame count: a strip whose height matches frameH is an even row of
// frameW cells, so the count is width / frameW even when the manifest
// disagrees. A walk strip exported at another size is split on the
// transparent gaps between poses. See docs/adding-fighters.md.
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { estimateBody, summarizeBodies } from '../src/engine/bodyLayout.js';

const ALPHA = 24;

export function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

export function contentSegments(png, minGap = 6) {
  const counts = new Uint16Array(png.width);
  const { data, width, height } = png;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[((y * width + x) << 2) + 3] > ALPHA) counts[x]++;
    }
  }
  const raw = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    const on = x < width && counts[x] >= 3;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      raw.push([start, x - 1]);
      start = -1;
    }
  }
  const merged = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    if (!prev || seg[0] - prev[1] - 1 >= minGap) merged.push([seg[0], seg[1]]);
    else prev[1] = seg[1];
  }
  return merged;
}

// Equal cells that each hold their poses without cutting a body in half.
function countFromBlobs(width, segments) {
  let best = null;
  for (let c = 2; c <= 16; c++) {
    const cell = Math.floor(width / c);
    if (cell < 8) continue;
    const slack = width - cell * c;
    const used = new Set();
    let overflow = 0;
    for (const [a, b] of segments) {
      const i0 = Math.floor(a / cell);
      const i1 = Math.floor(Math.max(a, b) / cell);
      if (i0 === i1 && i0 < c) used.add(i0);
      else overflow++;
    }
    if (overflow) continue;
    const empty = c - used.size;
    const score = empty * 5 + slack + Math.abs(c - segments.length) * 2;
    if (!best || score < best.score) best = { count: c, frameW: cell, slack, score, empty };
  }
  return best;
}

export function detectBlobCount(png) {
  let fallback = null;
  for (const gap of [6, 12, 24, 40, 70]) {
    const segs = contentSegments(png, gap);
    const pick = countFromBlobs(png.width, segs);
    if (!pick) continue;
    if (pick.empty === 0) return { ...pick, gap, segments: segs.length };
    if (!fallback) fallback = { ...pick, gap, segments: segs.length };
  }
  return fallback;
}

/**
 * How many cells are in a horizontal strip, and how wide each one is.
 * `declared` is the manifest clip count. It is not trusted when the pixels disagree.
 */
export function resolveStrip(png, frameW, frameH, declared, clipName) {
  const width = png.width;
  const height = png.height;
  const declaredCount = Math.max(1, Math.round(declared || 1));
  const heightMatches = Math.abs(height - frameH) <= 2;
  const tiled = heightMatches && frameW > 0 && Math.abs(width / frameW - Math.round(width / frameW)) < 0.02;
  if (tiled) {
    const count = Math.max(1, Math.round(width / frameW));
    const cellW = Math.floor(width / count);
    return {
      count,
      frameW: cellW,
      frameH: height,
      slack: width - cellW * count,
      how: count === declaredCount ? 'tiled' : 'tiled-count',
    };
  }
  const blobs = detectBlobCount(png);
  if (blobs && (clipName === 'walk' || !heightMatches || blobs.count !== declaredCount)) {
    return {
      count: blobs.count,
      frameW: blobs.frameW,
      frameH: height,
      slack: blobs.slack,
      how: `gaps:${blobs.gap}`,
    };
  }
  const count = declaredCount;
  const cellW = Math.max(1, Math.floor(width / count));
  return {
    count,
    frameW: cellW,
    frameH: height,
    slack: width - cellW * count,
    how: 'manifest',
  };
}

export function sliceFrames(png, count, frameW, frameH) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const ox = i * frameW;
    const frame = new PNG({ width: frameW, height: frameH });
    for (let y = 0; y < frameH; y++) {
      if (y >= png.height) break;
      for (let x = 0; x < frameW; x++) {
        const sx = ox + x;
        const di = (y * frameW + x) << 2;
        if (sx >= png.width) continue;
        const si = (y * png.width + sx) << 2;
        frame.data[di] = png.data[si];
        frame.data[di + 1] = png.data[si + 1];
        frame.data[di + 2] = png.data[si + 2];
        frame.data[di + 3] = png.data[si + 3];
      }
    }
    frames.push(frame);
  }
  return frames;
}

export function unionBounds(frames, pad = 2) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  const w = frames[0].width;
  const h = frames[0].height;
  for (const frame of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (frame.data[((y * w + x) << 2) + 3] <= 10) continue;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: w, y1: h };
  return {
    x0: Math.max(0, x0 - pad),
    y0: Math.max(0, y0 - pad),
    x1: Math.min(w, x1 + 1 + pad),
    y1: Math.min(h, y1 + 1 + pad),
  };
}

export function cropFrames(frames, box) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  return frames.map((frame) => {
    const out = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((y + box.y0) * frame.width + (x + box.x0)) << 2;
        const di = (y * w + x) << 2;
        out.data[di] = frame.data[si];
        out.data[di + 1] = frame.data[si + 1];
        out.data[di + 2] = frame.data[si + 2];
        out.data[di + 3] = frame.data[si + 3];
      }
    }
    return out;
  });
}

function rowCounts(png) {
  const counts = new Int32Array(png.height);
  const { data, width, height } = png;
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) {
      if (data[((y * width + x) << 2) + 3] > ALPHA) n++;
    }
    counts[y] = n;
  }
  return counts;
}

export function measureFrames(frames) {
  const bodies = [];
  for (const frame of frames) {
    const body = estimateBody(rowCounts(frame), frame.height);
    if (body) bodies.push(body);
  }
  if (!bodies.length) return null;
  return summarizeBodies(bodies, frames[0].height);
}

// Area-average downscale. Alpha is straight (not premultiplied) on output.
export function downscale(src, dw, dh) {
  const out = new PNG({ width: dw, height: dh });
  const sx = src.width / dw;
  const sy = src.height / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(src.height, Math.max(y0 + 1, Math.ceil((y + 1) * sy)));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(src.width, Math.max(x0 + 1, Math.ceil((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) << 2;
          const al = src.data[i + 3];
          r += src.data[i] * al;
          g += src.data[i + 1] * al;
          b += src.data[i + 2] * al;
          a += al;
          n++;
        }
      }
      const di = (y * dw + x) << 2;
      if (n === 0 || a < 1) {
        out.data[di + 3] = 0;
        continue;
      }
      out.data[di] = Math.round(r / a);
      out.data[di + 1] = Math.round(g / a);
      out.data[di + 2] = Math.round(b / a);
      out.data[di + 3] = Math.round(a / n);
    }
  }
  return out;
}

export function padFrames(frames, pad = 2) {
  return padBox(frames, { left: pad, right: pad, top: pad, bottom: pad });
}

/** Transparent margin. Attack clips use a wide edge so a sword or hammer
 *  that was drawn to the cell border no longer sits on it. Every clip gets
 *  a taller bottom pad so the sole is not the last texel. */
export function clipPadding(clipName, frameW, frameH) {
  const edge = clipName === 'attack'
    ? Math.max(14, Math.round(Math.max(frameW, frameH) * 0.08))
    : 3;
  return { left: edge, right: edge, top: edge, bottom: Math.max(edge, 8) };
}

export function padBox(frames, pad) {
  const left = pad.left ?? 0;
  const right = pad.right ?? 0;
  const top = pad.top ?? 0;
  const bottom = pad.bottom ?? 0;
  if (!left && !right && !top && !bottom) return frames;
  return frames.map((frame) => {
    const w = frame.width + left + right;
    const h = frame.height + top + bottom;
    const out = new PNG({ width: w, height: h });
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const si = (y * frame.width + x) << 2;
        const di = ((y + top) * w + (x + left)) << 2;
        out.data[di] = frame.data[si];
        out.data[di + 1] = frame.data[si + 1];
        out.data[di + 2] = frame.data[si + 2];
        out.data[di + 3] = frame.data[si + 3];
      }
    }
    return out;
  });
}

export function opaqueSpan(frame) {
  let x0 = frame.width;
  let x1 = -1;
  const { data, width, height } = frame;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[((y * width + x) << 2) + 3] <= ALPHA) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  return x1 < 0 ? 0 : x1 - x0 + 1;
}

function medianNum(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

/**
 * Walk strips are often a shorter canvas with the same character squashed
 * into it. Stretch Y until the body's width-to-height matches idle.
 * The comparison uses the measured body and the ink width, not the cell.
 * Returns 1 when walk is already as tall as idle, and never shrinks a walk.
 */
export function walkStretch(idleFrames, walkFrames) {
  const idleM = measureFrames(idleFrames);
  const walkM = measureFrames(walkFrames);
  if (!idleM?.bodyH || !walkM?.bodyH) return 1;
  const idleW = medianNum(idleFrames.map(opaqueSpan));
  const walkW = medianNum(walkFrames.map(opaqueSpan));
  if (!(idleW > 0) || !(walkW > 0)) return 1;
  const mul = (walkW / walkM.bodyH) / (idleW / idleM.bodyH);
  if (mul < 1.08) return 1;
  return Math.min(1.8, mul);
}

/** Minimum transparent pixels from opaque ink to each side of a frame. */
export function inkMargin(frame) {
  let x0 = frame.width;
  let y0 = frame.height;
  let x1 = -1;
  let y1 = -1;
  const { data, width, height } = frame;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[((y * width + x) << 2) + 3] <= ALPHA) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { left: width, right: width, top: height, bottom: height };
  return { left: x0, right: width - 1 - x1, top: y0, bottom: height - 1 - y1 };
}

export function packGrid(frames) {
  const n = frames.length;
  const frameW = frames[0].width;
  const frameH = frames[0].height;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const sheet = new PNG({ width: cols * frameW, height: rows * frameH });
  frames.forEach((frame, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * frameW;
    const oy = row * frameH;
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const si = (y * frameW + x) << 2;
        const di = ((oy + y) * sheet.width + (ox + x)) << 2;
        sheet.data[di] = frame.data[si];
        sheet.data[di + 1] = frame.data[si + 1];
        sheet.data[di + 2] = frame.data[si + 2];
        sheet.data[di + 3] = frame.data[si + 3];
      }
    }
  });
  return sheet;
}

export function scaleForBody(measured, targetBody) {
  const body = measured?.bodyH > 0 ? measured.bodyH : targetBody;
  return targetBody / body;
}

export function layoutNumbers(measured, artHeight) {
  const bodyH = Math.max(1, measured?.bodyH || 1);
  const displayScale = Number((artHeight / bodyH).toFixed(5));
  return {
    footY: measured?.footY ?? 1,
    bodyH,
    visibleH: bodyH,
    displayScale,
  };
}

export function fitPortrait(png, maxH = 420) {
  if (png.height <= maxH && png.width <= maxH) return png;
  const scale = maxH / Math.max(png.width, png.height);
  return downscale(png, Math.max(1, Math.round(png.width * scale)), Math.max(1, Math.round(png.height * scale)));
}
