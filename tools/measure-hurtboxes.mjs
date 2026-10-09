// Measures head, torso, and leg hurtboxes from each fighter's idle and walk
// sheets, in the same pixels the sprite is drawn at. Crouch, jump, and
// attack are the idle body shrunk or shifted, stored beside the measured poses.
//
//   node tools/measure-hurtboxes.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { estimateBody } from '../src/engine/bodyLayout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'src/data/hurtboxes.js');

function round(n) {
  return Math.round(n * 10) / 10;
}

function scaleAroundFeet(parts, sx, sy, lift = 0) {
  const out = {};
  for (const [name, b] of Object.entries(parts)) {
    const cx = b.x + b.w / 2;
    const w = Math.max(6, b.w * sx);
    const h = Math.max(6, b.h * sy);
    const bottom = (b.y + b.h) * sy + lift;
    out[name] = { x: round(cx - w / 2), y: round(bottom - h), w: round(w), h: round(h) };
  }
  return out;
}

function shiftForward(parts, dx) {
  const out = {};
  for (const [name, b] of Object.entries(parts)) {
    const extra = name === 'torso' ? 8 : name === 'head' ? 4 : 0;
    out[name] = {
      x: round(b.x + dx),
      y: b.y,
      w: round(b.w + extra),
      h: b.h,
    };
  }
  return out;
}

function synth(w, h) {
  const headH = h * 0.24;
  const torsoH = h * 0.40;
  const legH = h - headH - torsoH;
  const box = (width, top, height) => ({
    x: round(-width / 2), y: round(top), w: round(width), h: round(height),
  });
  return {
    head: box(w * 0.62, -h, headH),
    torso: box(w * 0.96, -h + headH, torsoH),
    legs: box(w * 0.72, -legH, legH),
  };
}

function posesFrom(idle, walk) {
  return {
    idle,
    walk: walk || idle,
    crouch: scaleAroundFeet(idle, 1.12, 0.68),
    jump: scaleAroundFeet(idle, 0.84, 0.90, -4),
    attack: shiftForward(scaleAroundFeet(idle, 1.04, 0.92), 8),
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)));
  return s[i];
}

function measureClip(png, frameW, frameH, count, footY, scale) {
  const cols = Math.max(1, Math.floor(png.width / frameW));
  const footPx = Math.min(frameH - 1, Math.max(0, Math.round(footY * frameH) - 1));
  const samples = { head: [], torso: [], legs: [] };
  for (let f = 0; f < count; f++) {
    const ox = (f % cols) * frameW;
    const oy = Math.floor(f / cols) * frameH;
    const row = new Int32Array(frameH);
    for (let y = 0; y < frameH; y++) {
      let n = 0;
      const py = oy + y;
      for (let x = 0; x < frameW; x++) {
        if (png.data[(((py * png.width + ox + x) << 2) + 3)] > 40) n++;
      }
      row[y] = n;
    }
    const body = estimateBody(row, frameH);
    if (!body) continue;
    const top = body.bodyTop;
    const bot = Math.min(footPx + 2, body.foot);
    if (bot - top < 8) continue;
    const span = bot - top;
    const bands = {
      head: [top, top + Math.round(span * 0.28)],
      torso: [top + Math.round(span * 0.28), top + Math.round(span * 0.66)],
      legs: [top + Math.round(span * 0.66), bot],
    };
    for (const [name, [y0, y1]] of Object.entries(bands)) {
      if (y1 <= y0) continue;
      const col = new Int32Array(frameW);
      for (let y = y0; y <= y1; y++) {
        const py = oy + y;
        for (let x = 0; x < frameW; x++) {
          if (png.data[(((py * png.width + ox + x) << 2) + 3)] > 40) col[x]++;
        }
      }
      const runs = [];
      let s = -1;
      for (let x = 0; x <= frameW; x++) {
        const on = x < frameW && col[x] > 1;
        if (on && s < 0) s = x;
        else if (!on && s >= 0) {
          let n = 0;
          for (let i = s; i < x; i++) n += col[i];
          runs.push({ a: s, b: x - 1, n });
          s = -1;
        }
      }
      if (!runs.length) continue;
      runs.sort((p, q) => q.n - p.n);
      const main = runs[0];
      let a = main.a;
      let b = main.b;
      const mid = (main.a + main.b) / 2;
      for (const run of runs.slice(1)) {
        const gap = run.a > main.b ? run.a - main.b - 1 : main.a - run.b - 1;
        if (gap < 14 && run.n > main.n * 0.12 && Math.abs((run.a + run.b) / 2 - mid) < frameW * 0.35) {
          a = Math.min(a, run.a);
          b = Math.max(b, run.b);
        }
      }
      const gx0 = (a - frameW / 2) * scale;
      const gx1 = ((b + 1) - frameW / 2) * scale;
      const gy0 = (y0 - footPx) * scale;
      const gy1 = ((y1 + 1) - footPx) * scale;
      samples[name].push({ x0: gx0, x1: gx1, y0: gy0, y1: Math.min(gy1, 4) });
    }
  }
  const parts = {};
  for (const name of ['head', 'torso', 'legs']) {
    const list = samples[name];
    if (!list.length) continue;
    const x0 = percentile(list.map((s) => s.x0), 0.2);
    const x1 = percentile(list.map((s) => s.x1), 0.8);
    const y0 = percentile(list.map((s) => s.y0), 0.2);
    const y1 = percentile(list.map((s) => s.y1), 0.8);
    const w = Math.max(6, x1 - x0);
    const h = Math.max(6, y1 - y0);
    parts[name] = { x: round(x0), y: round(y0), w: round(w), h: round(h) };
  }
  return Object.keys(parts).length ? parts : null;
}

function layoutOf(art, def) {
  const sheets = art.sheets;
  const footY = def.footY ?? sheets.footY ?? 1;
  const displayScale = def.displayScale
    ?? ((def.bodyH == null && def.visibleH == null) ? sheets.displayScale : null)
    ?? (art.height / (def.bodyH ?? def.visibleH ?? sheets.bodyH ?? sheets.visibleH ?? art.height));
  return { footY, displayScale };
}

async function main() {
  const { ROSTER } = await import(join(root, 'src/data/characters.js'));
  const all = {};
  let measured = 0;
  let fallback = 0;
  for (const c of ROSTER) {
    const art = c.art;
    const w = art?.bodyW ?? 40;
    const h = art?.bodyH ?? 110;
    const sheets = art?.sheets;
    let idle = null;
    let walk = null;
    if (sheets?.clips?.idle && art.use3d !== false) {
      const def = sheets.clips.idle;
      const file = join(root, `${sheets.dir}${c.id}_idle.png`);
      if (existsSync(file)) {
        const png = PNG.sync.read(readFileSync(file));
        const lay = layoutOf(art, def);
        idle = measureClip(png, def.frameW || sheets.frameW, def.frameH || sheets.frameH, def.count, lay.footY, lay.displayScale);
      }
      const walkDef = sheets.clips.walk;
      if (walkDef) {
        const fileW = join(root, `${sheets.dir}${c.id}_walk.png`);
        if (existsSync(fileW)) {
          const png = PNG.sync.read(readFileSync(fileW));
          const lay = layoutOf(art, walkDef);
          walk = measureClip(png, walkDef.frameW || sheets.frameW, walkDef.frameH || sheets.frameH, walkDef.count, lay.footY, lay.displayScale);
        }
      }
    }
    if (!idle) {
      idle = synth(w, h);
      fallback++;
    } else measured++;
    all[c.id] = posesFrom(idle, walk);
    if ((measured + fallback) % 20 === 0) console.error('measured', measured + fallback);
  }
  const body = `// Generated by tools/measure-hurtboxes.mjs. Boxes are game pixels from the
// feet: x is the left edge with the art facing right, y is the top (negative
// is above the feet). idle and walk are measured from the sprite sheets.
// crouch, jump, and attack are that idle body shrunk or shifted.
export const HURTBOXES = ${JSON.stringify(all, null, 2)};
`;
  writeFileSync(outFile, body);
  console.log(`wrote ${Object.keys(all).length} fighters (${measured} from sheets, ${fallback} from body size)`);
}

main();
