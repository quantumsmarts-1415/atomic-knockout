// Shared helpers for turning Gemini idle-video frames into a game sprite sheet.
// Used by contact-sheet.js (eyeball which frames to use) and build-sheet.js
// (key background, crop to union bbox, compose grid, report footY/visibleH).
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

export function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

export function colorAt(png, x, y) {
  const i = (png.width * y + x) << 2;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

export function dist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function kmeans2(samples) {
  let c0 = samples[0], c1 = samples[samples.length - 1];
  for (let iter = 0; iter < 12; iter++) {
    const g0 = [], g1 = [];
    for (const s of samples) (dist(s, c0) <= dist(s, c1) ? g0 : g1).push(s);
    const avg = (arr) => arr.length
      ? [
          Math.round(arr.reduce((a, c) => a + c[0], 0) / arr.length),
          Math.round(arr.reduce((a, c) => a + c[1], 0) / arr.length),
          Math.round(arr.reduce((a, c) => a + c[2], 0) / arr.length),
        ]
      : null;
    const n0 = avg(g0), n1 = avg(g1);
    if (n0) c0 = n0;
    if (n1) c1 = n1;
  }
  return [c0, c1];
}

// Paints over the small fixed sparkle/badge watermark Gemini bakes into the
// bottom-right corner of every frame (~x:1130-1220, y:555-635 in 1280x720)
// with the locally sampled background color, so it doesn't survive keying.
export function paintOverWatermark(png, bgColor) {
  const { width: w, height: h } = png;
  const x0 = Math.round((1130 / 1280) * w), x1 = Math.round((1220 / 1280) * w);
  const y0 = Math.round((555 / 720) * h), y1 = Math.round((635 / 720) * h);
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const i = (w * y + x) << 2;
      png.data[i] = bgColor[0]; png.data[i + 1] = bgColor[1]; png.data[i + 2] = bgColor[2]; png.data[i + 3] = 255;
    }
  }
}

// Keys the background to transparent (edge-connected flood fill from the
// border, k-means over 2 centroids so it handles a real checkerboard too),
// then erases fully-enclosed background-colored pockets, then feathers the
// erase/keep boundary. Returns the opaque-pixel bbox {x0,y0,x1,y1} (exclusive).
export function keyBackground(png, threshold = 40) {
  const { width: w, height: h, data } = png;
  const idx = (x, y) => (w * y + x) << 2;

  const borderSamples = [];
  for (let x = 0; x < w; x++) { borderSamples.push(colorAt(png, x, 0)); borderSamples.push(colorAt(png, x, h - 1)); }
  for (let y = 0; y < h; y++) { borderSamples.push(colorAt(png, 0, y)); borderSamples.push(colorAt(png, w - 1, y)); }
  const bgCentroids = kmeans2(borderSamples);
  const isBgColor = (c) => dist(c, bgCentroids[0]) < threshold || dist(c, bgCentroids[1]) < threshold;

  paintOverWatermark(png, bgCentroids[0]);

  const visited = new Uint8Array(w * h);
  const erase = new Uint8Array(w * h);
  const stack = [];
  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (isBgColor(colorAt(png, x, y))) stack.push([x, y]);
  };
  for (let x = 0; x < w; x++) { pushIfBg(x, 0); pushIfBg(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIfBg(0, y); pushIfBg(w - 1, y); }
  while (stack.length) {
    const [x, y] = stack.pop();
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    erase[p] = 1;
    pushIfBg(x + 1, y); pushIfBg(x - 1, y); pushIfBg(x, y + 1); pushIfBg(x, y - 1);
  }

  // enclosed pockets
  const compVisited = new Uint8Array(w * h);
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const sp = sy * w + sx;
      if (compVisited[sp] || erase[sp]) continue;
      if (!isBgColor(colorAt(png, sx, sy))) { compVisited[sp] = 1; continue; }
      const comp = [sp];
      const cstack = [[sx, sy]];
      compVisited[sp] = 1;
      while (cstack.length) {
        const [x, y] = cstack.pop();
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (erase[np]) continue;
          if (compVisited[np]) continue;
          if (!isBgColor(colorAt(png, nx, ny))) continue;
          compVisited[np] = 1;
          comp.push(np);
          cstack.push([nx, ny]);
        }
      }
      for (const p of comp) erase[p] = 1;
    }
  }

  for (let p = 0; p < w * h; p++) if (erase[p]) data[(p << 2) + 3] = 0;

  const alphaSnapshot = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alphaSnapshot[p] = data[(p << 2) + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alphaSnapshot[p] === 0) continue;
      const touchesErased =
        alphaSnapshot[p - 1] === 0 || alphaSnapshot[p + 1] === 0 ||
        alphaSnapshot[p - w] === 0 || alphaSnapshot[p + w] === 0;
      if (touchesErased) data[idx(x, y) + 3] = Math.round(data[idx(x, y) + 3] * 0.55);
    }
  }

  // bbox of remaining non-fully-transparent pixels
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[idx(x, y) + 3] > 10) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export function cropPng(png, box) {
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (png.width * (y + box.y0) + (x + box.x0)) << 2;
      const di = (w * y + x) << 2;
      out.data[di] = png.data[si]; out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2]; out.data[di + 3] = png.data[si + 3];
    }
  }
  return out;
}
