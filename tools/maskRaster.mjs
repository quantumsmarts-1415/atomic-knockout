// Rasterise one sprite-sheet frame into a coarse collision mask.
// Cells are CELL game pixels. A cell is solid when at least ~22% of the
// source pixels that land in it have alpha above 0.5. Detached specks
// (flames, smoke, sparks) are dropped; the component on the body is kept,
// plus anything separated from it by a single empty cell.
export const CELL = 5;

function clipFrameSize(sheets, def) {
  const frameW = def.frameW ?? sheets.frameW;
  const frameH = def.frameH ?? sheets.frameH;
  return { frameW, frameH };
}

function clipScale(art, sheets, def) {
  const { frameW, frameH } = clipFrameSize(sheets, def);
  const footY = def.footY ?? sheets.footY ?? 1;
  const visibleH = def.bodyH ?? def.visibleH ?? sheets.bodyH ?? sheets.visibleH ?? frameH;
  let scale = def.displayScale
    ?? ((def.bodyH == null && def.visibleH == null) ? sheets.displayScale : null);
  if (!(scale > 0)) {
    const target = art.height || art.bodyH || 120;
    scale = target / visibleH;
  }
  return { frameW, frameH, footY, scale, bodyH: art.bodyH || visibleH * scale };
}
const ALPHA = 127;
const FILL = 0.22;
const FOOT_SLACK = 3;

export { clipScale };

function key(c, r) {
  return (c + 4096) * 8192 + (r + 4096);
}

function components(solids) {
  const at = new Map();
  for (const s of solids) at.set(key(s.c, s.r), s);
  const seen = new Set();
  const comps = [];
  for (const s of solids) {
    const k0 = key(s.c, s.r);
    if (seen.has(k0)) continue;
    const comp = [];
    const stack = [s];
    seen.add(k0);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const n = at.get(key(cur.c + dx, cur.r + dy));
          if (!n) continue;
          const k = key(n.c, n.r);
          if (seen.has(k)) continue;
          seen.add(k);
          stack.push(n);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

function scoreBody(comp, bodyH) {
  let sx = 0;
  let sy = 0;
  for (const s of comp) {
    sx += (s.c + 0.5) * CELL;
    sy += (s.r + 0.5) * CELL;
  }
  sx /= comp.length;
  sy /= comp.length;
  const targetY = -(bodyH || 100) * 0.45;
  const dist = Math.hypot(sx, sy - targetY);
  return comp.length * Math.exp(-dist / Math.max(28, (bodyH || 100) * 0.55));
}

function absorbNear(main, comps) {
  const set = new Set(main.map((s) => key(s.c, s.r)));
  const used = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const comp of comps) {
      if (used.has(comp) || comp === main) continue;
      let near = false;
      for (const s of comp) {
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (set.has(key(s.c + dx, s.r + dy))) {
              near = true;
              break;
            }
          }
        }
        if (near) break;
      }
      if (!near) continue;
      used.add(comp);
      for (const s of comp) {
        const k = key(s.c, s.r);
        if (set.has(k)) continue;
        set.add(k);
        main.push(s);
      }
      grew = true;
    }
  }
  return main;
}

export function keepBody(solids, bodyH) {
  if (!solids.length) return [];
  const comps = components(solids);
  let best = null;
  let bestScore = -1;
  for (const comp of comps) {
    if (comp.length < 2) continue;
    const score = scoreBody(comp, bodyH);
    if (score > bestScore) {
      bestScore = score;
      best = comp;
    }
  }
  if (!best) best = comps[0];
  return absorbNear(best, comps);
}

// Pack solid cells into "ox|oy|cols|rows|base64". Bit 0 of byte 0 is cell 0,
// row-major from the top-left of the grid.
export function packCells(solids) {
  if (!solids?.length) return null;
  let minC = Infinity;
  let minR = Infinity;
  let maxC = -Infinity;
  let maxR = -Infinity;
  for (const s of solids) {
    if (s.c < minC) minC = s.c;
    if (s.r < minR) minR = s.r;
    if (s.c > maxC) maxC = s.c;
    if (s.r > maxR) maxR = s.r;
  }
  const cols = maxC - minC + 1;
  const rows = maxR - minR + 1;
  const bytes = new Uint8Array(Math.ceil((cols * rows) / 8));
  for (const s of solids) {
    const i = (s.r - minR) * cols + (s.c - minC);
    bytes[i >> 3] |= 1 << (i & 7);
  }
  const b64 = Buffer.from(bytes).toString('base64');
  return `${minC * CELL}|${minR * CELL}|${cols}|${rows}|${b64}`;
}

export function cellStats(solids) {
  if (!solids.length) return { cx: 0, cy: 0, width: 0, n: 0, pixelCx: 0, pixelCy: 0 };
  let sx = 0;
  let sy = 0;
  let px = 0;
  let py = 0;
  let pn = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const s of solids) {
    const x = (s.c + 0.5) * CELL;
    const y = (s.r + 0.5) * CELL;
    sx += x;
    sy += y;
    if (s.n) {
      px += s.px;
      py += s.py;
      pn += s.n;
    }
    const left = s.c * CELL;
    const right = left + CELL;
    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
  }
  const n = solids.length;
  return {
    cx: sx / n,
    cy: sy / n,
    width: maxX - minX,
    n,
    pixelCx: pn ? px / pn : sx / n,
    pixelCy: pn ? py / pn : sy / n,
  };
}

// Raster one frame. Returns the kept body cells (with per-cell pixel sums).
export function rasterFrame(png, frameIndex, frameW, frameH, footY, scale, artFacing, bodyH) {
  const gridCols = Math.max(1, Math.floor(png.width / frameW));
  const fx = (frameIndex % gridCols) * frameW;
  const fy = Math.floor(frameIndex / gridCols) * frameH;
  if (fy + frameH > png.height + 1 || fx + frameW > png.width + 1) return [];
  const flip = artFacing === -1 ? -1 : 1;
  const foot = footY * frameH;
  const minC = Math.floor(((-frameW / 2) * scale) / CELL) - 2;
  const maxC = Math.ceil(((frameW / 2) * scale) / CELL) + 2;
  const minR = Math.floor(((0 - foot) * scale) / CELL) - 2;
  const maxR = Math.ceil(((frameH - foot) * scale) / CELL) + 2;
  const gw = maxC - minC + 1;
  const gh = maxR - minR + 1;
  if (gw < 2 || gh < 2 || gw * gh > 400000) return [];
  const opaque = new Uint32Array(gw * gh);
  const cover = new Uint32Array(gw * gh);
  const sumX = new Float64Array(gw * gh);
  const sumY = new Float64Array(gw * gh);
  const data = png.data;
  const stride = png.width;
  for (let y = 0; y < frameH; y++) {
    const py = fy + y;
    const gy = (y + 0.5 - foot) * scale;
    if (gy > FOOT_SLACK) continue;
    const row = py * stride + fx;
    for (let x = 0; x < frameW; x++) {
      const gx = (x + 0.5 - frameW / 2) * scale * flip;
      const c = Math.floor(gx / CELL);
      const r = Math.floor(gy / CELL);
      const i = (c - minC) + (r - minR) * gw;
      cover[i] += 1;
      if (data[((row + x) << 2) + 3] > ALPHA) {
        opaque[i] += 1;
        sumX[i] += gx;
        sumY[i] += gy;
      }
    }
  }
  const solids = [];
  for (let i = 0; i < cover.length; i++) {
    if (!cover[i] || opaque[i] / cover[i] < FILL) continue;
    const c = minC + (i % gw);
    const r = minR + Math.floor(i / gw);
    solids.push({ c, r, n: opaque[i], px: sumX[i], py: sumY[i] });
  }
  return keepBody(solids, bodyH || frameH * scale);
}

export function strikeCells(attack, idle) {
  if (!attack?.length || !idle?.length) return null;
  const dil = new Set();
  let idleCx = 0;
  let idleFront = -Infinity;
  for (const s of idle) {
    idleCx += (s.c + 0.5) * CELL;
    const right = (s.c + 1) * CELL;
    if (right > idleFront) idleFront = right;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) dil.add(key(s.c + dx, s.r + dy));
    }
  }
  idleCx /= idle.length;
  const cand = [];
  for (const s of attack) {
    const x = (s.c + 0.5) * CELL;
    if (dil.has(key(s.c, s.r))) continue;
    if (x < idleCx - CELL) continue;
    cand.push(s);
  }
  if (cand.length < 3) return null;
  const comps = components(cand);
  const kept = [];
  for (const comp of comps) {
    if (comp.length < 2) continue;
    let cx = 0;
    for (const s of comp) cx += (s.c + 0.5) * CELL;
    cx /= comp.length;
    if (cx < idleCx - CELL) continue;
    let use = comp;
    if (comp.length > attack.length * 0.45) {
      use = comp.filter((s) => (s.c + 0.5) * CELL >= idleFront - CELL);
    }
    for (const s of use) kept.push(s);
  }
  if (kept.length < 3) return null;
  let cx = 0;
  for (const s of kept) cx += (s.c + 0.5) * CELL;
  if (cx / kept.length < idleCx - CELL) return null;
  return kept;
}

export function pushFrom(solids) {
  if (!solids?.length) return null;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of solids) {
    const top = s.r * CELL;
    const bot = top + CELL;
    if (top < minY) minY = top;
    if (bot > maxY) maxY = bot;
  }
  const span = Math.max(CELL, maxY - minY);
  const cut = minY + span * 0.28;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let sx = 0;
  let n = 0;
  for (const s of solids) {
    const cy = (s.r + 0.5) * CELL;
    if (cy < cut) continue;
    const left = s.c * CELL;
    const right = left + CELL;
    if (left < x0) x0 = left;
    if (right > x1) x1 = right;
    const bot = (s.r + 1) * CELL;
    if (bot > y1) y1 = bot;
    sx += (s.c + 0.5) * CELL;
    n += 1;
  }
  if (!n || y1 <= cut) return null;
  const mid = sx / n;
  const w = Math.max(10, (x1 - x0) * 0.62);
  const round = (v) => Math.round(v * 10) / 10;
  return [round(mid - w / 2), round(cut), round(w), round(y1 - cut)];
}

export function ellipseCells(bodyW, bodyH) {
  const w = bodyW || 40;
  const h = bodyH || 110;
  const rx = w * 0.38;
  const ry = h * 0.46;
  const cy = -h * 0.5;
  const solids = [];
  const c0 = Math.floor((-w) / CELL) - 1;
  const c1 = Math.ceil(w / CELL) + 1;
  const r0 = Math.floor((-h) / CELL) - 1;
  const r1 = 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      const nx = x / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1 && y <= FOOT_SLACK) solids.push({ c, r, n: 0, px: 0, py: 0 });
    }
  }
  return solids;
}
