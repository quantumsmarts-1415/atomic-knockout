// Pre-deploy sprite-sheet quality gate. For every roster character with
// Gemini sheets, measures each frame of each clip sheet:
//   solid% = pixels with alpha >= 200 / area of that frame's visible bbox
//   semi%  = pixels with 20 < alpha < 200 / all visible (alpha > 20) pixels
// and fails if the clip's mean solid% is under MIN_SOLID or mean semi% is
// over MAX_SEMI. Catches over-keyed sheets like the 2026-09 idle sheets
// (Sully ~1% solid / 67% semi) before they reach Netlify.
// Usage: node tools/check-sheets.mjs [--min-solid 15] [--max-semi 25] [--clips idle,walk] [ids...]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const MIN_SOLID = Number(opt('--min-solid', 15));
const MAX_SEMI = Number(opt('--max-semi', 25));
const CLIPS = opt('--clips', 'idle,walk').split(',');
const only = new Set(args);

export function measureSheet(png, frameW, frameH, count) {
  const cols = Math.floor(png.width / frameW);
  let solidSum = 0, semiSum = 0;
  for (let f = 0; f < count; f++) {
    const ox = (f % cols) * frameW, oy = Math.floor(f / cols) * frameH;
    let x0 = frameW, y0 = frameH, x1 = -1, y1 = -1, vis = 0, semi = 0;
    for (let y = 0; y < frameH; y++) for (let x = 0; x < frameW; x++) {
      const a = png.data[((png.width * (oy + y) + ox + x) << 2) + 3];
      if (a > 20) { vis++; if (a < 200) semi++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (!vis) return { solid: 0, semi: 1, emptyFrame: f };
    let solid = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (png.data[((png.width * (oy + y) + ox + x) << 2) + 3] >= 200) solid++;
    solidSum += solid / ((x1 - x0 + 1) * (y1 - y0 + 1));
    semiSum += semi / vis;
  }
  return { solid: solidSum / count, semi: semiSum / count };
}

async function main() {
  const { ROSTER } = await import(join(root, 'src/data/characters.js'));
  const roster = Array.isArray(ROSTER) ? ROSTER : Object.values(ROSTER);
  let failed = 0, checked = 0;
  for (const c of roster) {
    const s = c.art?.sheets;
    if (!s || c.art.use3d === false || (only.size && !only.has(c.id))) continue;
    for (const clip of CLIPS) {
      const def = s.clips?.[clip];
      if (!def) continue;
      const file = join(root, `${s.dir}${def.file || `${c.id}_${clip}.png`}`);
      if (!existsSync(file)) { console.log(`FAIL ${c.id} ${clip}: missing ${file}`); failed++; continue; }
      const png = PNG.sync.read(readFileSync(file));
      const m = measureSheet(png, def.frameW || s.frameW, def.frameH || s.frameH, def.count);
      const bad = m.solid * 100 < MIN_SOLID || m.semi * 100 > MAX_SEMI;
      checked++; if (bad) failed++;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${c.id.padEnd(9)} ${clip.padEnd(5)} solid ${(m.solid * 100).toFixed(1).padStart(5)}%  semi ${(m.semi * 100).toFixed(1).padStart(5)}%${m.emptyFrame !== undefined ? `  (frame ${m.emptyFrame} empty)` : ''}`);
    }
  }
  console.log(`${checked} sheets checked, ${failed} failed (min solid ${MIN_SOLID}%, max semi ${MAX_SEMI}%)`);
  process.exitCode = failed ? 1 : 0;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
