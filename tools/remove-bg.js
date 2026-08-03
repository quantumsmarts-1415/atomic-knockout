// Dev tool: edge-connected flood-fill background removal for Gemini concept-art renders.
// Usage: node tools/remove-bg.js <input.png> <output-cut.png> [threshold] [mode]
//
// Samples the background color from the border pixels (the renders use a
// plain flat-color backdrop), then erases every pixel that is (a) close
// enough to that sampled color AND (b) reachable from the border through
// other near-background pixels. Comparing every candidate to the fixed
// sampled color (not neighbor-to-neighbor) avoids "color drift" leaking the
// fill into the character through anti-aliased edges. Connectivity-gating
// still protects an enclosed near-background pocket inside the silhouette
// (e.g. between an arm and the torso) from being erased by a first pass —
// run with a higher threshold a second time, or by hand, for those.
//
// mode: "auto" (default) k-means-fits 2 background centroids from the
// border, as above. Use "checker" for renders whose fake checkerboard uses
// MORE than 2 colors (e.g. two different checker patterns baked into one
// image, light gray/white in one region and black/dark-gray in another --
// seen on Cal's render). A plain 2-centroid fit can't cover 4+ colors at a
// usable threshold: too tight and half the checker survives, too loose and
// it eats into the character's own light/dark shading. "checker" instead
// treats any border-connected, near-grayscale (low-saturation) pixel as
// background regardless of its lightness, which covers every shade of an
// achromatic checkerboard in one pass without needing to fit its colors --
// the character's skin/armor/lava tones are all visibly warm (non-gray) by
// comparison, so real content is protected by chroma, not brightness.
//
// "checker-edge" is for the hard case "checker" can't handle: a character
// whose own suit/armor is ALSO neutral gray/white (seen on Scarlett's
// silver-armor render over a light checkerboard) -- there, chroma can't
// tell background and character apart at all, since neither has any. What
// still tells them apart is that the checkerboard is flat within each
// square (low local gradient) while her linework and shading are not, so
// this mode gates flood-fill CONNECTIVITY on low local gradient IN ADDITION
// to low saturation -- the fill can spread through a checker square's flat
// interior but can't cross her bold outline strokes or shading edges. Trade
// -off: this necessarily leaves a thin (1-2px) residue right at checker
// SQUARE BOUNDARIES too, since that's also a color step -- much less
// objectionable than a solid unremoved block, but not pixel-perfect. Do NOT
// "fix" this by growing the erased region afterward using saturation alone
// (no gradient gate) -- tried that, it happily eats several pixels into her
// actual outline strokes wherever they sit near the checker (which is
// everywhere along her silhouette), turning clean edges into static noise.
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath, thresholdArg, modeArg] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node remove-bg.js <input.png> <output.png> [threshold] [mode: auto|checker|checker-edge]');
  process.exit(1);
}
const MODE = modeArg ?? 'auto';
// checker/checker-edge's threshold is a max(r,g,b)-min(r,g,b) saturation
// cap, not a color distance, so it needs a much smaller default than
// "auto"'s.
const THRESH = thresholdArg ? Number(thresholdArg) : (MODE === 'auto' ? 40 : 14);
const GRAD_THRESH = 18; // checker-edge only: max per-channel-sum step to a neighbor still counted as "flat"

const png = PNG.sync.read(readFileSync(inPath));
const { width: w, height: h, data } = png;
const idx = (x, y) => (w * y + x) << 2;
const colorAt = (x, y) => {
  const i = idx(x, y);
  return [data[i], data[i + 1], data[i + 2]];
};
const dist = (a, b) => {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

let isBgColor;
// canCross(x,y): connectivity gate for the border flood-fill (pass 1) only.
// Defaults to isBgColor's color-only test; checker-edge overrides it to add
// the gradient gate. The enclosed-pocket pass (pass 2) and the erase
// decision always use isBgColor alone -- see file header for why.
let canCross;
if (MODE === 'checker' || MODE === 'checker-edge') {
  // Any (near-)grayscale pixel is background, whatever its brightness --
  // covers an arbitrary number of baked-in checker shades in one pass. See
  // the file header for why this is safe against the character's own art.
  const saturation = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
  isBgColor = (c) => saturation(c) <= THRESH;
  console.log(`${MODE} mode: treating any pixel with channel spread <= ${THRESH} as background`);
  if (MODE === 'checker-edge') {
    const gradAt = (x, y) => {
      const c = colorAt(x, y);
      let maxD = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = colorAt(nx, ny);
        const d = Math.abs(c[0] - n[0]) + Math.abs(c[1] - n[1]) + Math.abs(c[2] - n[2]);
        if (d > maxD) maxD = d;
      }
      return maxD;
    };
    canCross = (x, y) => isBgColor(colorAt(x, y)) && gradAt(x, y) <= GRAD_THRESH;
    console.log(`checker-edge: also gating on local gradient <= ${GRAD_THRESH}`);
  }
} else {
  // Sample background color(s) from the border pixels. Gemini sometimes
  // bakes in a fake checkerboard instead of real transparency (two
  // alternating flat colors), so cluster into up to 2 representative colors
  // via k-means rather than assuming one flat color — a pixel counts as
  // "background" if it's close to EITHER centroid. For a genuinely flat
  // backdrop the two centroids just converge to the same color, so this
  // subsumes the flat case too.
  const borderSamples = [];
  for (let x = 0; x < w; x++) { borderSamples.push(colorAt(x, 0)); borderSamples.push(colorAt(x, h - 1)); }
  for (let y = 0; y < h; y++) { borderSamples.push(colorAt(0, y)); borderSamples.push(colorAt(w - 1, y)); }

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
  const bgCentroids = kmeans2(borderSamples);
  console.log(`Sampled background colors: rgb(${bgCentroids[0].join(',')}) / rgb(${bgCentroids[1].join(',')})`);
  isBgColor = (c) => dist(c, bgCentroids[0]) < THRESH || dist(c, bgCentroids[1]) < THRESH;
}
canCross ??= (x, y) => isBgColor(colorAt(x, y));

const visited = new Uint8Array(w * h);
const erase = new Uint8Array(w * h);
const stack = [];
const pushIfBg = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (visited[p]) return;
  if (canCross(x, y)) stack.push([x, y]);
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

for (let p = 0; p < w * h; p++) {
  if (erase[p]) data[(p << 2) + 3] = 0;
}

// Second pass: erase enclosed background-colored pockets (e.g. a gap
// between an arm and the torso) that the border-connected pass above
// intentionally leaves alone. Find connected components of remaining
// opaque near-bg-color pixels; erase a component if it's small enough
// to plausibly be a gap rather than actual clothing/shading, or if it
// directly touches an already-erased pixel (meaning it's a sliver right
// at the transparent boundary, not solid interior).
const compVisited = new Uint8Array(w * h);
for (let sy = 0; sy < h; sy++) {
  for (let sx = 0; sx < w; sx++) {
    const sp = sy * w + sx;
    if (compVisited[sp] || erase[sp]) continue;
    if (!isBgColor(colorAt(sx, sy))) { compVisited[sp] = 1; continue; }
    // Flood the component of near-bg-color opaque pixels.
    const comp = [sp];
    const cstack = [[sx, sy]];
    compVisited[sp] = 1;
    let touchesErased = false;
    while (cstack.length) {
      const [x, y] = cstack.pop();
      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = ny * w + nx;
        if (erase[np]) { touchesErased = true; continue; }
        if (compVisited[np]) continue;
        if (!isBgColor(colorAt(nx, ny))) continue;
        compVisited[np] = 1;
        comp.push(np);
        cstack.push([nx, ny]);
      }
    }
    // Any component of near-bg-color pixels not reachable from the border
    // (pass 1 already erased those) is by definition an enclosed pocket —
    // erase it too, regardless of size.
    for (const p of comp) erase[p] = 1;
    void touchesErased;
  }
}
for (let p = 0; p < w * h; p++) {
  if (erase[p]) data[(p << 2) + 3] = 0;
}

// Soft feather at the erase/keep boundary.
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

writeFileSync(outPath, PNG.sync.write(png));
console.log(`Wrote ${outPath} (${w}x${h})`);
