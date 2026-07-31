// Quick low-res grid of every extracted frame, for eyeballing which
// contiguous range stays on-brief (Gemini sometimes drifts mid-clip).
// Usage: node tools/contact-sheet.js <framesDir> <outPng> [cols]
import { readPng } from './sheet-lib.js';
import { PNG } from 'pngjs';
import { readdirSync, writeFileSync } from 'node:fs';

const [, , framesDir, outPath, colsArg] = process.argv;
if (!framesDir || !outPath) {
  console.error('Usage: node contact-sheet.js <framesDir> <outPng> [cols]');
  process.exit(1);
}
const files = readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
const THUMB_W = 160, THUMB_H = 90;
const cols = colsArg ? Number(colsArg) : 8;
const rows = Math.ceil(files.length / cols);

const sheet = new PNG({ width: cols * THUMB_W, height: rows * THUMB_H });
sheet.data.fill(64);

files.forEach((f, i) => {
  const png = readPng(`${framesDir}/${f}`);
  const col = i % cols, row = Math.floor(i / cols);
  const ox = col * THUMB_W, oy = row * THUMB_H;
  for (let ty = 0; ty < THUMB_H; ty++) {
    for (let tx = 0; tx < THUMB_W; tx++) {
      const sx = Math.floor((tx / THUMB_W) * png.width);
      const sy = Math.floor((ty / THUMB_H) * png.height);
      const si = (png.width * sy + sx) << 2;
      const di = (sheet.width * (oy + ty) + (ox + tx)) << 2;
      sheet.data[di] = png.data[si]; sheet.data[di + 1] = png.data[si + 1];
      sheet.data[di + 2] = png.data[si + 2]; sheet.data[di + 3] = 255;
    }
  }
  console.log(`${i}: ${f} -> col ${col}, row ${row}`);
});

writeFileSync(outPath, PNG.sync.write(sheet));
console.log(`Wrote ${outPath} (${cols}x${rows} grid, ${files.length} frames)`);
