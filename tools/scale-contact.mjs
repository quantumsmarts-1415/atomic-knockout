// Contact sheet of idle, walk, and attack for every fighter, drawn with
// the layout scale so the shoes share a foot line and the crown shares a
// head line. Attack uses the idle sheet, which is what the game does until
// a move clip exists.
//
//   node tools/scale-contact.mjs <outDir>
import { PNG } from 'pngjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters.js';

const ALPHA = 16;
const CELL_W = 168;
const ROW_H = 250;
const FOOT = 196;
const COLS = ['idle', 'walk', 'attack'];

const GLYPH = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '11111', '10001', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};

function text(png, x, y, message, rgb) {
  let cx = x;
  for (const ch of message.toUpperCase()) {
    const g = GLYPH[ch];
    if (!g) { cx += 4; continue; }
    for (let gy = 0; gy < g.length; gy++) {
      for (let gx = 0; gx < g[gy].length; gx++) {
        if (g[gy][gx] !== '1') continue;
        const px = cx + gx;
        const py = y + gy;
        if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
        const i = (py * png.width + px) << 2;
        png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
      }
    }
    cx += 6;
  }
}

function hline(png, y, x0, x1, rgb) {
  const yy = Math.max(0, Math.min(png.height - 1, y));
  for (let x = x0; x < x1; x++) {
    const i = (yy * png.width + x) << 2;
    png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
  }
}

function frameOf(png, frameW, frameH, index) {
  const cols = Math.max(1, Math.round(png.width / frameW));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { ox: col * frameW, oy: row * frameH };
}

function blit(dst, dx, dy, src, ox, oy, frameW, frameH, scale, footY) {
  const originX = frameW / 2;
  const originY = footY * frameH;
  for (let y = 0; y < frameH; y++) {
    const py = dy + (y - originY) * scale;
    const y0 = Math.floor(py);
    const y1 = y0 + 1;
    if (y1 < 0 || y0 >= dst.height) continue;
    for (let x = 0; x < frameW; x++) {
      const si = ((oy + y) * src.width + (ox + x)) << 2;
      if (src.data[si + 3] <= ALPHA) continue;
      const px = dx + (x - originX) * scale;
      const x0 = Math.floor(px);
      if (x0 < 0 || x0 >= dst.width) continue;
      if (y0 >= 0 && y0 < dst.height) {
        const di = (y0 * dst.width + x0) << 2;
        dst.data[di] = src.data[si];
        dst.data[di + 1] = src.data[si + 1];
        dst.data[di + 2] = src.data[si + 2];
        dst.data[di + 3] = 255;
      }
    }
  }
}

function layoutOf(art, clipName) {
  const sheets = art.sheets;
  const def = clipName === 'attack' ? (sheets.clips.attack ?? sheets.clips.idle) : sheets.clips[clipName];
  if (!def) return null;
  const frameW = def.frameW ?? sheets.frameW;
  const frameH = def.frameH ?? sheets.frameH;
  const footY = def.footY ?? sheets.footY;
  const bodyH = def.bodyH ?? def.visibleH ?? sheets.bodyH ?? sheets.visibleH;
  const displayScale = def.displayScale
    ?? ((def.bodyH == null && def.visibleH == null) ? sheets.displayScale : null)
    ?? (art.height / bodyH);
  const fileClip = sheets.clips[clipName] ? clipName : 'idle';
  return { frameW, frameH, footY, bodyH, displayScale, fileClip, count: def.count ?? sheets.clips.idle.count };
}

function drawFighter(c) {
  const width = CELL_W * COLS.length;
  const png = new PNG({ width, height: ROW_H });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 22; png.data[i + 1] = 24; png.data[i + 2] = 32; png.data[i + 3] = 255;
  }
  text(png, 6, 4, c.id, [220, 220, 230]);
  const headY = FOOT - c.art.height;
  for (let col = 0; col < COLS.length; col++) {
    const name = COLS[col];
    const x0 = col * CELL_W;
    hline(png, headY, x0 + 8, x0 + CELL_W - 8, [70, 190, 110]);
    hline(png, FOOT, x0 + 8, x0 + CELL_W - 8, [80, 150, 240]);
    text(png, x0 + 8, 16, name === 'attack' ? 'attack' : name, [180, 180, 190]);
    const layout = layoutOf(c.art, name);
    if (!layout || !c.art.sheets.clips[layout.fileClip]) {
      text(png, x0 + 8, 40, 'none', [140, 90, 90]);
      continue;
    }
    const path = `${c.art.sheets.dir}${c.id}_${layout.fileClip}.png`;
    let sheet;
    try {
      sheet = PNG.sync.read(readFileSync(path));
    } catch {
      text(png, x0 + 8, 40, 'missing', [140, 90, 90]);
      continue;
    }
    const index = name === 'walk' ? Math.floor((layout.count - 1) / 2) : 0;
    const { ox, oy } = frameOf(sheet, layout.frameW, layout.frameH, index);
    blit(png, x0 + CELL_W / 2, FOOT, sheet, ox, oy, layout.frameW, layout.frameH, layout.displayScale, layout.footY);
  }
  return png;
}

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: node tools/scale-contact.mjs <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const roster = Object.values(CHARACTERS);
const rows = roster.map(drawFighter);
rows.forEach((png, i) => {
  const id = roster[i].id;
  writeFileSync(`${outDir}/${id}.png`, PNG.sync.write(png));
});
const gridCols = 2;
const gridRows = Math.ceil(rows.length / gridCols);
const grid = new PNG({ width: rows[0].width * gridCols, height: ROW_H * gridRows });
grid.data.fill(18);
rows.forEach((png, i) => {
  const gx = (i % gridCols) * png.width;
  const gy = Math.floor(i / gridCols) * ROW_H;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const si = (y * png.width + x) << 2;
      const di = ((gy + y) * grid.width + (gx + x)) << 2;
      grid.data[di] = png.data[si];
      grid.data[di + 1] = png.data[si + 1];
      grid.data[di + 2] = png.data[si + 2];
      grid.data[di + 3] = 255;
    }
  }
});
writeFileSync(`${outDir}/all-fighters.png`, PNG.sync.write(grid));
console.log(`wrote ${rows.length} sheets and ${outDir}/all-fighters.png`);
