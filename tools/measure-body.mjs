// Measure head-to-feet body height on each roster sheet.
//   node tools/measure-body.mjs
import { PNG } from 'pngjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { CHARACTERS } from '../src/data/characters.js';
import { estimateBody, summarizeBodies } from '../src/engine/bodyLayout.js';

const ALPHA = 24;
const OUT = '/tmp/ak-body';
mkdirSync(OUT, { recursive: true });

// Per-clip window overrides. A side lock of hair (Helen) sits outside a
// narrow torso window. A glow that fills the cell (Ben, Silas) keeps
// pixels far below the shoes, so the foot line is the torso window.
const HEAD_HALF = {
  'helen:idle': 0.1,
};
// Ben's hex and Silas's circuit glow sit out at the same radius as a
// spread leg, so a torso window cuts the shoes off. Their stored footY
// is the shoe line from the original sheet pass; do not auto-lift it.
const FOOT_HALF = {};

function measureFrame(png, ox, oy, frameW, frameH, key) {
  const { width, data } = png;
  const full = new Int32Array(frameH);
  const opaque = (x, y) => data[(((oy + y) * width + (ox + x)) << 2) + 3] > ALPHA;
  for (let y = 0; y < frameH; y++) {
    let n = 0;
    for (let x = 0; x < frameW; x++) if (opaque(x, y)) n++;
    full[y] = n;
  }
  const fullBody = estimateBody(full, frameH);
  if (!fullBody) return null;
  const headHalf = HEAD_HALF[key];
  const footHalf = FOOT_HALF[key];
  if (headHalf == null && footHalf == null) return fullBody;

  const y0 = fullBody.top + Math.floor((fullBody.bot - fullBody.top) * 0.45);
  const y1 = fullBody.top + Math.floor((fullBody.bot - fullBody.top) * 0.7);
  let xSum = 0;
  let xN = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < frameW; x++) if (opaque(x, y)) { xSum += x; xN++; }
  }
  const cx = xN ? xSum / xN : frameW / 2;
  const headC = headHalf != null ? new Int32Array(frameH) : null;
  const footC = footHalf != null ? new Int32Array(frameH) : null;
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      if (!opaque(x, y)) continue;
      const dx = Math.abs(x - cx) / frameW;
      if (headC && dx <= headHalf) headC[y]++;
      if (footC && dx <= footHalf) footC[y]++;
    }
  }
  const head = headC ? estimateBody(headC, frameH) : null;
  const foot = footC ? estimateBody(footC, frameH) : null;
  let bodyTop = fullBody.bodyTop;
  if (head && head.bodyTop - fullBody.top < fullBody.fullH * 0.22) bodyTop = head.bodyTop;
  let footRow = fullBody.foot;
  if (foot && fullBody.foot - foot.foot > 24 && fullBody.foot - foot.foot < fullBody.fullH * 0.4) {
    footRow = foot.foot;
  }
  return {
    top: fullBody.top,
    bot: fullBody.bot,
    bodyTop,
    foot: footRow,
    fullH: fullBody.fullH,
    bodyH: Math.max(1, footRow - bodyTop + 1),
    torso: fullBody.torso,
  };
}

function measureClip(png, frameW, frameH, count, id, name) {
  const cols = Math.max(1, Math.round(png.width / frameW));
  const frames = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = col * frameW;
    const oy = row * frameH;
    if (oy + frameH > png.height + 2 || ox + frameW > png.width + 2) break;
    const body = measureFrame(png, ox, oy, frameW, frameH, `${id}:${name}`);
    if (body) frames.push(body);
  }
  return summarizeBodies(frames, frameH);
}

function writeProof(png, frameW, frameH, measure, outPath) {
  const scale = Math.min(1, 280 / frameW, 360 / frameH);
  const w = Math.max(1, Math.round(frameW * scale));
  const h = Math.max(1, Math.round(frameH * scale));
  const o = new PNG({ width: w, height: h });
  const foot = Math.round(measure.footY * frameH) - 1;
  const head = foot - measure.bodyH;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(frameH - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(frameW - 1, Math.floor(x / scale));
      const si = (sy * png.width + sx) << 2;
      const di = (y * w + x) << 2;
      const a = png.data[si + 3];
      o.data[di] = a > 16 ? png.data[si] : 18;
      o.data[di + 1] = a > 16 ? png.data[si + 1] : 20;
      o.data[di + 2] = a > 16 ? png.data[si + 2] : 26;
      o.data[di + 3] = 255;
    }
  }
  const line = (sy, r, g, b) => {
    const y = Math.max(0, Math.min(h - 1, Math.round(sy * scale)));
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) << 2;
      o.data[di] = r; o.data[di + 1] = g; o.data[di + 2] = b;
    }
  };
  line(head, 40, 210, 90);
  line(foot, 70, 150, 255);
  mkdirSync(OUT + '/proof', { recursive: true });
  writeFileSync(outPath, PNG.sync.write(o));
}

const report = [];
for (const c of Object.values(CHARACTERS)) {
  const art = c.art;
  const sheets = art?.sheets;
  if (!sheets?.clips) continue;
  for (const [name, def] of Object.entries(sheets.clips)) {
    const frameW = def.frameW ?? sheets.frameW;
    const frameH = def.frameH ?? sheets.frameH;
    const path = `${sheets.dir}${c.id}_${name}.png`;
    let png;
    try {
      png = PNG.sync.read(readFileSync(path));
    } catch (err) {
      console.log(`${c.id} ${name}: MISSING (${err.message})`);
      continue;
    }
    const m = measureClip(png, frameW, frameH, def.count, c.id, name);
    if (!m) continue;
    const curH = def.visibleH ?? sheets.visibleH;
    const curFoot = def.footY ?? sheets.footY;
    const displayH = art.height;
    const displayScale = Number((displayH / m.bodyH).toFixed(5));
    const row = {
      id: c.id,
      clip: name,
      frameW,
      frameH,
      height: displayH,
      curH,
      curFoot: Number(Number(curFoot).toFixed(4)),
      fullH: m.fullH,
      bodyH: m.bodyH,
      hairPx: m.hairPx,
      footY: m.footY,
      displayScale,
      // On-screen body now vs after. 1 means the stored box already was the body.
      grow: Number((curH / m.bodyH).toFixed(3)),
    };
    report.push(row);
    writeProof(png, frameW, frameH, m, `${OUT}/proof/${c.id}-${name}.png`);
    console.log(
      `${c.id.padEnd(8)} ${name.padEnd(5)} full ${String(m.fullH).padStart(4)} body ${String(m.bodyH).padStart(4)} hair ${String(m.hairPx).padStart(3)} cur ${String(curH).padStart(4)} foot ${m.footY.toFixed(4)} was ${Number(curFoot).toFixed(4)} grow ${row.grow}`,
    );
  }
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`wrote ${OUT}/report.json`);
