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

// Collects border-pixel color samples for background-centroid estimation,
// but screens out localized contamination (e.g. a character's hair spikes
// poking into the top edge of a tightly-framed portrait video) using a
// sliding-window local median along each edge: real background varies
// smoothly (a vignette can run the full range across a whole edge, like
// 87->144 top-to-bottom on one side), but a foreground intrusion is a
// short, sharply-different run against its own immediate neighbors. Keeping
// only pixels close to their own local window's median tolerates a global
// gradient while rejecting the intrusion, without needing to discard an
// entire edge (which would throw away good data on three sides just because
// hair happened to graze the fourth). Found on Silas (Silicon) -- his idle
// video frames tightly crop his head, so his hair spikes touch y=0 in most
// frames; without this, kmeans2 could pick a bad second "background"
// centroid that's actually his hair color, and the enclosed-pocket pass
// would then erase his hair wholesale wherever it appears elsewhere in the
// frame. window=21, outlier gate=35 tuned against that case.
function sampleCleanBorder(png, window = 21, gate = 35) {
  const { width: w, height: h } = png;
  const filterLine = (points) => {
    const kept = [];
    const half = Math.floor(window / 2);
    for (let i = 0; i < points.length; i++) {
      const lo = Math.max(0, i - half), hi = Math.min(points.length - 1, i + half);
      const rs = [], gs = [], bs = [];
      for (let j = lo; j <= hi; j++) { const [r, g, b] = points[j]; rs.push(r); gs.push(g); bs.push(b); }
      rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
      const mid = Math.floor(rs.length / 2);
      const med = [rs[mid], gs[mid], bs[mid]];
      if (dist(points[i], med) <= gate) kept.push(points[i]);
    }
    return kept;
  };
  const top = [], bottom = [], left = [], right = [];
  for (let x = 0; x < w; x++) { top.push(colorAt(png, x, 0)); bottom.push(colorAt(png, x, h - 1)); }
  for (let y = 0; y < h; y++) { left.push(colorAt(png, 0, y)); right.push(colorAt(png, w - 1, y)); }
  return [...filterLine(top), ...filterLine(bottom), ...filterLine(left), ...filterLine(right)];
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
export function keyBackground(png, threshold = 40, keyColor = null) {
  const { width: w, height: h, data } = png;
  const idx = (x, y) => (w * y + x) << 2;

  // keyColor is only set when --key/--key-color is passed explicitly; the
  // default (null) keeps the original border-sampled k-means behavior.
  const bgCentroids = keyColor
    ? (() => { const k = calibrateKeyColor(png, keyColor); return [k, k]; })()
    : kmeans2(sampleCleanBorder(png));
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

// Alternative keying for frames whose backdrop is a soft vignette/gradient
// close in color to the character's own palette (e.g. Neo's silver armor
// against a gray-gradient backdrop) -- fixed-centroid distance either
// leaves swaths of background un-erased or bleeds into the character
// depending on threshold, because the true background color range is wider
// than the gap to the character's color. Instead, grow the erased region
// from the border by comparing each candidate pixel to its ALREADY-ERASED
// NEIGHBOR (not a fixed sampled color), so it follows a smooth gradient
// indefinitely but stops dead at the character's outline (anime line art
// has a hard-edged dark stroke there, which breaks the neighbor-tolerance
// chain even when the fill colors on both sides are similar). Still needs
// the fixed-centroid pocket pass afterward for fully enclosed background
// pockets, since those never touch the growing border region at all.
export function keyBackgroundGradient(png, tolerance = 14, pocketThreshold = 40) {
  const { width: w, height: h, data } = png;
  const idx = (x, y) => (w * y + x) << 2;

  const bgCentroids = kmeans2(sampleCleanBorder(png));
  const isBgColor = (c) => dist(c, bgCentroids[0]) < pocketThreshold || dist(c, bgCentroids[1]) < pocketThreshold;

  paintOverWatermark(png, bgCentroids[0]);

  const visited = new Uint8Array(w * h);
  const erase = new Uint8Array(w * h);
  const stack = [];
  // Gate the initial border seeding on isBgColor rather than seeding every
  // border pixel unconditionally -- every character before Silas had a
  // clear background margin all the way around, so "every border pixel is
  // background" always held in practice, but his tightly-cropped portrait
  // video has his hair spikes actually touching y=0. Seeding from a
  // hair-colored border pixel would erase/grow through his hair using ITS
  // own color as the neighbor-tolerance seed, wiping out the whole spike.
  // keyBackground (fixed mode) already gated its border seeding this way;
  // this brings gradient mode's initial seeding in line with it.
  for (let x = 0; x < w; x++) {
    if (isBgColor(colorAt(png, x, 0))) stack.push([x, 0]);
    if (isBgColor(colorAt(png, x, h - 1))) stack.push([x, h - 1]);
  }
  for (let y = 0; y < h; y++) {
    if (isBgColor(colorAt(png, 0, y))) stack.push([0, y]);
    if (isBgColor(colorAt(png, w - 1, y))) stack.push([w - 1, y]);
  }
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    erase[p] = 1;
    const c = colorAt(png, x, y);
    const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (visited[np]) continue;
      if (dist(colorAt(png, nx, ny), c) < tolerance) stack.push([nx, ny]);
    }
  }

  // enclosed pockets (same fixed-centroid approach as keyBackground)
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

// Third keying strategy, for the hardest case neither fixed nor gradient
// mode can handle: a character whose own armor fill color (not just its
// anti-aliased edge) legitimately overlaps the backdrop's color range over
// a LARGE area -- found on Allen (Aluminum), whose mid-tone metallic gray
// covers thousands of interior pixels within the same distance band as the
// sampled backdrop gray. Fixed mode has no way to protect that area (it's
// close to the centroid by definition); gradient mode makes it worse (nothing
// stops it from chaining across the smooth panel-to-panel shading once the
// border-connected fill leaks through any single thin/anti-aliased gap in
// the ink outline). This mode ports the "checker-edge" trick from
// remove-bg.js: gate the border-connected flood fill's CONNECTIVITY on local
// gradient in addition to color distance, so it still spreads freely through
// the backdrop's own flat/gradient interior (low local gradient there) but
// cannot hop across a real ink outline stroke even through a single-pixel
// anti-aliased gap, because the outline itself is a sharp local step. The
// enclosed-pocket pass is ALSO gradient-gated here (unlike keyBackground/
// keyBackgroundGradient, where it deliberately stays color-only) AND size-
// gated -- see the comment at the pocket-pass loop below for why both were
// needed; a gradient gate alone still erased hundreds of small legitimate
// shading-detail pockets one at a time before the size gate was added.
export function keyBackgroundEdgeGated(png, colorThreshold = 40, gradThreshold = 18, pocketThreshold = 40, minPocketSize = 1500) {
  const { width: w, height: h, data } = png;
  const idx = (x, y) => (w * y + x) << 2;

  const bgCentroids = kmeans2(sampleCleanBorder(png));
  const isBgColor = (c) => dist(c, bgCentroids[0]) < colorThreshold || dist(c, bgCentroids[1]) < colorThreshold;
  const isPocketBgColor = (c) => dist(c, bgCentroids[0]) < pocketThreshold || dist(c, bgCentroids[1]) < pocketThreshold;

  paintOverWatermark(png, bgCentroids[0]);

  const gradAt = (x, y) => {
    const c = colorAt(png, x, y);
    let maxD = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = colorAt(png, nx, ny);
      const d = Math.abs(c[0] - n[0]) + Math.abs(c[1] - n[1]) + Math.abs(c[2] - n[2]);
      if (d > maxD) maxD = d;
    }
    return maxD;
  };
  const canCross = (x, y) => isBgColor(colorAt(png, x, y)) && gradAt(x, y) <= gradThreshold;
  const canCrossPocket = (x, y) => isPocketBgColor(colorAt(png, x, y)) && gradAt(x, y) <= gradThreshold;

  const visited = new Uint8Array(w * h);
  const erase = new Uint8Array(w * h);
  const stack = [];
  const pushIfCrossable = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (canCross(x, y)) stack.push([x, y]);
  };
  for (let x = 0; x < w; x++) { pushIfCrossable(x, 0); pushIfCrossable(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIfCrossable(0, y); pushIfCrossable(w - 1, y); }
  while (stack.length) {
    const [x, y] = stack.pop();
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    erase[p] = 1;
    pushIfCrossable(x + 1, y); pushIfCrossable(x - 1, y); pushIfCrossable(x, y + 1); pushIfCrossable(x, y - 1);
  }

  // enclosed pockets -- gradient-gated like pass 1, PLUS a minimum size gate.
  // Both turned out necessary on Allen, found the hard way (a first version
  // with only the gradient gate looked clean at a glance but, on a closer
  // zoom Benjamin caught, had peppered his armor's own recessed shading
  // grooves and the aura's own dark sub-strokes with hundreds of tiny
  // erased holes -- each recess/dark streak segment is its own small,
  // locally-flat, near-centroid-colored component, so canCrossPocket
  // happily erases each one individually even though none of them are
  // background). The gradient gate alone can't fix this: a small real
  // shading groove and a small slice of real background both look "flat
  // and background-colored" at that scale. Size is what actually
  // distinguishes them here -- the one pocket that legitimately needs
  // erasing (the flat disk between Allen's aura ring and his silhouette) is
  // thousands of pixels, while his shading detail's individual enclosed
  // dark bits are tens to low hundreds. minPocketSize defaults to 400,
  // comfortably above the shading noise floor and comfortably below a real
  // aura-sized gap; raise it if a future character's real background pocket
  // is smaller than that (rare -- most such pockets are gaps between limbs
  // or full aura rings, not slivers) and it's leaking through un-erased.
  const compVisited = new Uint8Array(w * h);
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const sp = sy * w + sx;
      if (compVisited[sp] || erase[sp]) continue;
      if (!canCrossPocket(sx, sy)) { compVisited[sp] = 1; continue; }
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
          if (!canCrossPocket(nx, ny)) continue;
          compVisited[np] = 1;
          comp.push(np);
          cstack.push([nx, ny]);
        }
      }
      if (comp.length >= minPocketSize) { for (const p of comp) erase[p] = 1; }
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

// Named key colors for --key. Magenta is the historical Gemini backdrop.
export const KEY_COLORS = {
  magenta: [255, 0, 255],
  blue: [0, 0, 255],
  green: [0, 255, 0],
};

// Parses "blue" / "0000ff" / "#0000FF" into [r,g,b]; null for falsy input.
export function parseKeyColor(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (KEY_COLORS[s]) return KEY_COLORS[s].slice();
  const m = /^#?([0-9a-f]{6})$/.exec(s);
  if (!m) throw new Error(`Bad key color "${v}" (use magenta|blue|green or RRGGBB)`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// A nominally pure key (#0000FF) never survives video encoding exactly --
// Gemini's "pure blue" decodes as ~(16,67,237), ~70 away from #0000FF. So
// take the border pixels that are within `radius` of the nominal key and use
// their per-channel median as the real backdrop color. Falls back to the
// nominal key if too few border pixels qualify.
export function calibrateKeyColor(png, nominal, radius = 110) {
  const { width: w, height: h } = png;
  const rs = [], gs = [], bs = [];
  const take = (x, y) => {
    const c = colorAt(png, x, y);
    if (dist(c, nominal) <= radius) { rs.push(c[0]); gs.push(c[1]); bs.push(c[2]); }
  };
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y); }
  if (rs.length < 0.25 * 2 * (w + h)) return nominal.slice();
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  return [med(rs), med(gs), med(bs)];
}

function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (c === 0) return -1;
  let hh = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  hh *= 60;
  return hh < 0 ? hh + 360 : hh;
}
function hueDiff(r, g, b, ref) {
  const hh = hueOf(r, g, b);
  if (hh < 0 || ref < 0) return 360;
  const dd = Math.abs(hh - ref) % 360;
  return dd > 180 ? 360 - dd : dd;
}

// Edge-connected chroma key with soft edges + despill (--connected mode).
// Unlike keyBackground there is NO enclosed-pocket pass: a pixel becomes
// transparent only if it is within `threshold` of the key AND connected to
// the frame border through other key-like pixels. Interior pixels that happen
// to be key-ish (violet hair/gems vs a magenta key -- the Flora bug) stay
// opaque, so the body can't get speckled holes.
// Edge band (opaque pixels within `band` px of the keyed region): alpha is
// ramped by color distance (threshold -> threshold+soft) so anti-aliased
// backdrop blends become partial alpha instead of a hard stair-step, and the
// backdrop contribution is un-mixed out of the color (C = a*F + (1-a)*K ->
// F = (C-(1-a)K)/a), then any remaining excess of the key's dominant
// channel(s) is clamped to the local interior ratio on key-hued pixels up to
// `spillBand` px in (chroma subsampling tints the inside of the ink line) --
// no blue fringe, while violet hair / purple gems keep their hue.
// opts.pocketMin > 0 additionally keys enclosed near-key components of at
// least that many pixels (off by default).
export function keyBackgroundConnected(png, opts = {}) {
  const { width: w, height: h, data } = png;
  const nominal = opts.keyColor || KEY_COLORS.magenta;
  const threshold = opts.threshold ?? 50;
  const soft = opts.soft ?? 70;
  const band = opts.band ?? 2;
  // Video chroma subsampling bleeds the key a couple of px further in than
  // the alpha edge (it tints the inside of the dark ink outline), so the
  // key-channel clamp runs on a slightly wider ring than the alpha ramp.
  const spillBand = Math.max(band, opts.spillBand ?? band + 6);
  const pocketMin = opts.pocketMin ?? 0;
  const key = calibrateKeyColor(png, nominal);

  paintOverWatermark(png, key);

  const N = w * h;
  const d = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const i = p << 2;
    const dr = data[i] - key[0], dg = data[i + 1] - key[1], db = data[i + 2] - key[2];
    d[p] = Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // 1) border-connected flood fill through key-like pixels
  const bg = new Uint8Array(N);
  const stack = [];
  const seed = (p) => { if (!bg[p] && d[p] < threshold) { bg[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }

  // 1b) optional: large enclosed near-key pockets (real gaps between limbs)
  if (pocketMin > 0) {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (seen[s] || bg[s] || d[s] >= threshold) continue;
      const comp = [s]; seen[s] = 1; const cs = [s];
      while (cs.length) {
        const p = cs.pop(); const x = p % w, y = (p / w) | 0;
        for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
          if (q < 0 || seen[q] || bg[q] || d[q] >= threshold) continue;
          seen[q] = 1; comp.push(q); cs.push(q);
        }
      }
      if (comp.length >= pocketMin) for (const p of comp) bg[p] = 1;
    }
  }

  // 2) distance (in px, 4-neighbor BFS) from the keyed region, up to spillBand
  const dpx = new Uint8Array(N).fill(255);
  let frontier = [];
  for (let p = 0; p < N; p++) if (bg[p]) { dpx[p] = 0; frontier.push(p); }
  for (let k = 1; k <= spillBand; k++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && dpx[q] === 255) { dpx[q] = k; next.push(q); }
      }
    }
    frontier = next;
  }

  // dominant key channel(s): e.g. blue -> [2], magenta -> [0,2]
  const kmax = Math.max(...nominal);
  const keyCh = [0, 1, 2].filter((c) => nominal[c] === kmax && kmax > 0);
  const otherCh = [0, 1, 2].filter((c) => !keyCh.includes(c));

  // 3) soft alpha from color distance, processed ring by ring outward from
  // the keyed region. A ring-k pixel can't be more transparent than its most
  // transparent ring-(k-1) neighbor, so every partial-alpha pixel stays
  // connected to the keyed background (no semi-transparent specks hiding
  // behind an opaque outline, which would read as tiny interior holes).
  const alphaF = new Float32Array(N).fill(1);
  const ring = [];
  for (let k = 0; k <= band; k++) ring.push([]);
  for (let p = 0; p < N; p++) if (dpx[p] <= band) ring[dpx[p]].push(p);
  for (const p of ring[0]) alphaF[p] = 0;
  for (let k = 1; k <= band; k++) {
    for (const p of ring[k]) {
      const x = p % w, y = (p / w) | 0;
      let floor = 1;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && dpx[q] === k - 1 && alphaF[q] < floor) floor = alphaF[q];
      }
      let a = (d[p] - threshold) / soft;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      alphaF[p] = Math.max(a, floor);
    }
  }

  // Only pixels whose hue is near the key's hue count as spill: blue-tinted
  // ink/edges get clamped, violet hair and purple gems (hue ~270-290 vs
  // blue ~226) are left alone even right at the silhouette edge.
  const spillHue = opts.spillHue ?? 30;
  const keyHue = hueOf(key[0], key[1], key[2]);
  // Key-channel dominance ratio of the solid interior near p (pixels deeper
  // than spillBand, which are never modified), e.g. violet hair ~1.5
  // blue:red, green suit / skin -> 1 (no blue dominance allowed).
  const refRatio = (p) => {
    const x = p % w, y = (p / w) | 0;
    let sum = 0, n = 0;
    for (let yy = Math.max(0, y - 6); yy <= Math.min(h - 1, y + 6); yy++) {
      for (let xx = Math.max(0, x - 6); xx <= Math.min(w - 1, x + 6); xx++) {
        const q = yy * w + xx;
        if (dpx[q] <= spillBand) continue;
        const j = q << 2;
        const o = Math.max(8, ...otherCh.map((c) => data[j + c]));
        const kv = Math.min(...keyCh.map((c) => data[j + c]));
        sum += Math.min(3, Math.max(1, kv / o));
        n++;
      }
    }
    return n ? sum / n : 1;
  };

  for (let p = 0; p < N; p++) {
    const i = p << 2;
    if (bg[p]) { data[i + 3] = 0; continue; }
    if (dpx[p] > spillBand) continue;
    const a = dpx[p] <= band ? alphaF[p] : 1;
    // 4a) un-mix the key from partially transparent pixels
    //     (C = a*F + (1-a)*K -> F = (C-(1-a)K)/a). Gain is capped (a >= 0.5)
    //     so near-transparent pixels can't blow up into saturated specks.
    if (a > 0 && a < 1) {
      const ag = Math.max(a, 0.5);
      for (let c = 0; c < 3; c++) {
        const f = (data[i + c] - (1 - ag) * key[c]) / ag;
        data[i + c] = f < 0 ? 0 : f > 255 ? 255 : Math.round(f);
      }
    }
    // 4b) despill: key channel(s) may exceed the other channels only by the
    //     local interior's own ratio (keeps violet hair violet, turns a
    //     spill-tinted outline like (17,22,98) back into dark ink).
    if (otherCh.length && a > 0 && hueDiff(data[i], data[i + 1], data[i + 2], keyHue) <= spillHue) {
      const lim = Math.max(...otherCh.map((c) => data[i + c])) * refRatio(p);
      for (const c of keyCh) if (data[i + c] > lim) data[i + c] = Math.round(lim);
    }
    data[i + 3] = Math.round(data[i + 3] * a);
  }

  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[((w * y + x) << 2) + 3] > 10) {
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
