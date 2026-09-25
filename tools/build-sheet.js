// Turns a chosen range of extracted idle-video frames into a game-ready
// grid sprite sheet: key background transparent, crop all frames to one
// consistent union bbox (+padding), compose into a grid, report footY /
// visibleH for characters.js. See gemini-sprite-pipeline memory for the recipe.
// Usage: node tools/build-sheet.js <framesDir> <outPng> <startIdx> <endIdx> <step> [threshold] [padding] [mode] [pocketThreshold] [gradThreshold]
// mode: "fixed" (default), "gradient", or "edge" --
//   "gradient": character's own colors are close to the backdrop (e.g.
//     metallic/gray armor against a gray vignette) and "fixed" leaves either
//     background residue or bleeds into the character depending on
//     threshold. See keyBackgroundGradient in sheet-lib.js for why.
//   "edge": the hardest case -- the character's own FILL color (not just its
//     edge) legitimately overlaps the backdrop over a large area, so neither
//     fixed nor gradient mode can protect it (found on Allen/Aluminum). Gates
//     flood-fill connectivity on local gradient too, so it can't tunnel
//     across a real ink outline even through a thin anti-aliased gap. See
//     keyBackgroundEdgeGated in sheet-lib.js for why.
//   "connected": explicit key color, border-connected flood fill ONLY (no
//     enclosed-pocket pass, so key-ish interior pixels stay opaque), soft
//     alpha + despill on the edge band. See keyBackgroundConnected.
// Named flags (may appear anywhere after the positionals):
//   --key <magenta|blue|green|RRGGBB> / --key-color <RRGGBB>
//       key color (default magenta). In "connected" mode it is the backdrop
//       color (auto-calibrated from the border). In fixed mode it is only
//       used if passed explicitly; otherwise the original border-sampled
//       k-means behavior is unchanged.
//   --connected         shorthand for mode "connected"
//   --soft <n>          connected: alpha ramp width in RGB distance (default 70)
//   --band <px>         connected: soft-alpha edge band width (default 2)
//   --spill-band <px>   connected: hue-gated blue/key despill depth (default band+6)
//   --pocket-min <n>    connected: also key enclosed near-key pockets >= n px (default 0 = off)
import { readPng, keyBackground, keyBackgroundGradient, keyBackgroundEdgeGated, keyBackgroundConnected, parseKeyColor, cropPng } from './sheet-lib.js';
import { PNG } from 'pngjs';
import { readdirSync, writeFileSync } from 'node:fs';

const VALUE_FLAGS = new Set(['--key', '--key-color', '--soft', '--band', '--spill-band', '--pocket-min']);
const BOOL_FLAGS = new Set(['--connected']);
const positional = [], named = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (VALUE_FLAGS.has(a)) named[a] = process.argv[++i];
  else if (BOOL_FLAGS.has(a)) named[a] = true;
  else positional.push(a);
}
const [framesDir, outPath, startArg, endArg, stepArg, threshArg, padArg, modeArg, pocketArg, gradArg, minPocketArg] = positional;
if (!framesDir || !outPath || startArg === undefined || endArg === undefined) {
  console.error('Usage: node build-sheet.js <framesDir> <outPng> <startIdx> <endIdx> <step> [threshold] [padding] [mode] [pocketThreshold] [gradThreshold] [minPocketSize]');
  process.exit(1);
}
const start = Number(startArg), end = Number(endArg), step = stepArg ? Number(stepArg) : 1;
const THRESH = threshArg ? Number(threshArg) : 40;
const PAD = padArg ? Number(padArg) : 20;
const MODE = named['--connected'] ? 'connected' : (modeArg || 'fixed');
const KEY_EXPLICIT = parseKeyColor(named['--key-color'] || named['--key']);
const KEY = KEY_EXPLICIT || parseKeyColor('magenta');
// In gradient/edge mode the enclosed-pocket cleanup pass still uses a fixed
// sampled background color (there's no "neighbor" inside a fully enclosed
// pocket to grow from) -- for a character whose own colors sit close to
// that fixed centroid (busy silhouettes with lots of small enclosed gaps,
// e.g. flowing hair/flame gaps), the default 40 can eat real character
// detail that happens to be adjacent to a real pocket. Lower this
// (e.g. 15-20) if a magenta-background test shows bleed even after
// gradient mode fixed the border.
const POCKET_THRESH = pocketArg ? Number(pocketArg) : 40;
const GRAD_THRESH = gradArg ? Number(gradArg) : 18; // edge mode only
const MIN_POCKET_SIZE = minPocketArg ? Number(minPocketArg) : 1500; // edge mode only

const files = readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
const chosen = [];
for (let i = start; i <= end; i += step) if (files[i]) chosen.push(files[i]);
console.log(`Using ${chosen.length} frames:`, chosen.join(', '));
console.log(`Key mode: ${MODE}${MODE === 'connected' || KEY_EXPLICIT ? ` key=#${KEY.map(v => v.toString(16).padStart(2, '0')).join('')}` : ' (border-sampled)'}`);

const keyed = chosen.map(f => {
  const png = readPng(`${framesDir}/${f}`);
  const box = MODE === 'gradient' ? keyBackgroundGradient(png, THRESH, POCKET_THRESH)
    : MODE === 'edge' ? keyBackgroundEdgeGated(png, THRESH, GRAD_THRESH, POCKET_THRESH, MIN_POCKET_SIZE)
    : MODE === 'connected' ? keyBackgroundConnected(png, {
        keyColor: KEY, threshold: THRESH,
        soft: named['--soft'] !== undefined ? Number(named['--soft']) : undefined,
        band: named['--band'] !== undefined ? Number(named['--band']) : undefined,
        spillBand: named['--spill-band'] !== undefined ? Number(named['--spill-band']) : undefined,
        pocketMin: named['--pocket-min'] !== undefined ? Number(named['--pocket-min']) : undefined,
      })
    : keyBackground(png, THRESH, KEY_EXPLICIT);
  return { png, box };
});

let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
for (const { box } of keyed) {
  ux0 = Math.min(ux0, box.x0); uy0 = Math.min(uy0, box.y0);
  ux1 = Math.max(ux1, box.x1); uy1 = Math.max(uy1, box.y1);
}
const { width: fullW, height: fullH } = keyed[0].png;
ux0 = Math.max(0, ux0 - PAD); uy0 = Math.max(0, uy0 - PAD);
ux1 = Math.min(fullW, ux1 + PAD); uy1 = Math.min(fullH, uy1 + PAD);
const unionBox = { x0: ux0, y0: uy0, x1: ux1, y1: uy1 };
const frameW = ux1 - ux0, frameH = uy1 - uy0;
console.log(`Union bbox: ${JSON.stringify(unionBox)} -> frame ${frameW}x${frameH}`);

const cropped = keyed.map(({ png }) => cropPng(png, unionBox));

const n = cropped.length;
const cols = Math.ceil(Math.sqrt(n));
const rows = Math.ceil(n / cols);
const sheet = new PNG({ width: cols * frameW, height: rows * frameH });

let footSum = 0, heightSum = 0;
cropped.forEach((c, i) => {
  const col = i % cols, row = Math.floor(i / cols);
  const ox = col * frameW, oy = row * frameH;
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      const si = (frameW * y + x) << 2;
      const di = (sheet.width * (oy + y) + (ox + x)) << 2;
      sheet.data[di] = c.data[si]; sheet.data[di + 1] = c.data[si + 1];
      sheet.data[di + 2] = c.data[si + 2]; sheet.data[di + 3] = c.data[si + 3];
    }
  }
  // per-frame content bbox within the now-cropped frame, for footY/visibleH
  let cx0 = frameW, cy0 = frameH, cx1 = 0, cy1 = 0;
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      const a = c.data[((frameW * y + x) << 2) + 3];
      if (a > 10) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; }
    }
  }
  footSum += (cy1 + 1);
  heightSum += (cy1 + 1 - cy0);
});

writeFileSync(outPath, PNG.sync.write(sheet));
const footY = (footSum / n / frameH);
const visibleH = Math.round(heightSum / n);
console.log(`Wrote ${outPath} (${cols}x${rows} grid, ${n} real frames, frame ${frameW}x${frameH})`);
console.log(`characters.js config: frameW: ${frameW}, frameH: ${frameH}, footY: ${footY.toFixed(4)}, visibleH: ${visibleH}, clips: { idle: { count: ${n}, fps: 3.6, loop: true } }`);
