// Turns a chosen range of extracted idle-video frames into a game-ready
// grid sprite sheet: key background transparent, crop all frames to one
// consistent union bbox (+padding), compose into a grid, report footY /
// visibleH for characters.js. See gemini-sprite-pipeline memory for the recipe.
// Usage: node tools/build-sheet.js <framesDir> <outPng> <startIdx> <endIdx> <step> [threshold] [padding] [mode]
// mode: "fixed" (default) or "gradient" -- use "gradient" when the character's
// own colors are close to the backdrop (e.g. metallic/gray armor against a
// gray vignette) and "fixed" leaves either background residue or bleeds into
// the character depending on threshold. See keyBackgroundGradient in
// sheet-lib.js for why.
import { readPng, keyBackground, keyBackgroundGradient, cropPng } from './sheet-lib.js';
import { PNG } from 'pngjs';
import { readdirSync, writeFileSync } from 'node:fs';

const [, , framesDir, outPath, startArg, endArg, stepArg, threshArg, padArg, modeArg, pocketArg] = process.argv;
if (!framesDir || !outPath || startArg === undefined || endArg === undefined) {
  console.error('Usage: node build-sheet.js <framesDir> <outPng> <startIdx> <endIdx> <step> [threshold] [padding] [mode] [pocketThreshold]');
  process.exit(1);
}
const start = Number(startArg), end = Number(endArg), step = stepArg ? Number(stepArg) : 1;
const THRESH = threshArg ? Number(threshArg) : 40;
const PAD = padArg ? Number(padArg) : 20;
const MODE = modeArg || 'fixed';
// In gradient mode the enclosed-pocket cleanup pass still uses a fixed
// sampled background color (there's no "neighbor" inside a fully enclosed
// pocket to grow from) -- for a character whose own colors sit close to
// that fixed centroid (busy silhouettes with lots of small enclosed gaps,
// e.g. flowing hair/flame gaps), the default 40 can eat real character
// detail that happens to be adjacent to a real pocket. Lower this
// (e.g. 15-20) if a magenta-background test shows bleed even after
// gradient mode fixed the border.
const POCKET_THRESH = pocketArg ? Number(pocketArg) : 40;

const files = readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
const chosen = [];
for (let i = start; i <= end; i += step) if (files[i]) chosen.push(files[i]);
console.log(`Using ${chosen.length} frames:`, chosen.join(', '));

const keyed = chosen.map(f => {
  const png = readPng(`${framesDir}/${f}`);
  const box = MODE === 'gradient' ? keyBackgroundGradient(png, THRESH, POCKET_THRESH) : keyBackground(png, THRESH);
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
