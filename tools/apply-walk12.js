// Replace a fighter's walk clip with the 12-frame re-cut in walk12/<id>/.
//
//   node tools/apply-walk12.js [walk12]
//
// Keeps the imported walk cell (frameW x frameH), foot line, and body height.
// Only count and fps change. Idle and attack sheets are left alone.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { sliceFrames, unionBounds, cropFrames, measureFrames, downscale, packGrid } from './import-lib.js';
import { loadRoster, writeRoster } from './import-fighter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET_DIR = path.join(ROOT, 'art-src/imported/sheets');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function inkSpan(frame) {
  let x0 = frame.width;
  let x1 = -1;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (frame.data[((y * frame.width + x) << 2) + 3] <= 10) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  return x1 < 0 ? null : { x0, x1 };
}

function stamp(frame, cellW, cellH, dx, dy) {
  const out = new PNG({ width: cellW, height: cellH });
  let clipTop = 0;
  let clipBot = 0;
  let clipSide = 0;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const si = (y * frame.width + x) << 2;
      if (frame.data[si + 3] <= 10) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || tx >= cellW || ty < 0 || ty >= cellH) {
        if (ty < 0) clipTop++;
        else if (ty >= cellH) clipBot++;
        else clipSide++;
        continue;
      }
      const di = (ty * cellW + tx) << 2;
      out.data[di] = frame.data[si];
      out.data[di + 1] = frame.data[si + 1];
      out.data[di + 2] = frame.data[si + 2];
      out.data[di + 3] = frame.data[si + 3];
    }
  }
  return { out, clipTop, clipBot, clipSide };
}

function fitWalk(id, srcDir, walk) {
  const manifest = readJson(path.join(srcDir, 'manifest-walk12.json'));
  const spec = manifest.clips?.walk12;
  if (!spec || spec.count !== 12) throw new Error(`${id} walk12 count is not 12`);
  const srcW = manifest.frameW;
  const srcH = manifest.frameH;
  const png = PNG.sync.read(readFileSync(path.join(srcDir, 'walk12.png')));
  if (png.width < srcW * 12 || png.height < srcH) {
    throw new Error(`${id} walk12.png is ${png.width}x${png.height}, expected a ${srcW}x${srcH} x12 strip`);
  }
  const cellW = walk.frameW;
  const cellH = walk.frameH;
  const targetBody = walk.bodyH;
  const targetFoot = Math.round(walk.footY * cellH) - 1;
  const sliced = sliceFrames(png, 12, srcW, srcH);
  const frames = cropFrames(sliced, unionBounds(sliced, 2));
  const measured = measureFrames(frames);
  if (!measured?.bodyH) throw new Error(`${id} walk12 has no measurable body`);

  const resize = (mul) => {
    const dw = Math.max(1, Math.round(frames[0].width * mul));
    const dh = Math.max(1, Math.round(frames[0].height * mul));
    return frames.map((frame) => downscale(frame, dw, dh));
  };
  let scale = targetBody / measured.bodyH;
  let fitted = resize(scale);
  let sized = measureFrames(fitted);
  if (sized && Math.abs(sized.bodyH - targetBody) > 2) {
    scale *= targetBody / sized.bodyH;
    fitted = resize(scale);
    sized = measureFrames(fitted);
  }
  if (!sized) throw new Error(`${id} scaled walk has no body`);

  let x0 = Infinity;
  let x1 = -1;
  for (const frame of fitted) {
    const box = inkSpan(frame);
    if (!box) continue;
    if (box.x0 < x0) x0 = box.x0;
    if (box.x1 > x1) x1 = box.x1;
  }
  const dx = Math.round((cellW - (x1 - x0 + 1)) / 2) - x0;
  let dy = targetFoot - sized.foot;
  let stamped = fitted.map((frame) => stamp(frame, cellW, cellH, dx, dy));
  let placed = measureFrames(stamped.map((s) => s.out));
  if (placed && placed.foot !== targetFoot) {
    dy += targetFoot - placed.foot;
    stamped = fitted.map((frame) => stamp(frame, cellW, cellH, dx, dy));
    placed = measureFrames(stamped.map((s) => s.out));
  }
  return {
    sheet: packGrid(stamped.map((s) => s.out)),
    fps: spec.fps,
    count: 12,
    foot: placed?.foot ?? null,
    bodyH: placed?.bodyH ?? null,
    targetFoot,
    targetBody,
    clipTop: stamped.reduce((n, s) => n + s.clipTop, 0),
    clipBot: stamped.reduce((n, s) => n + s.clipBot, 0),
    clipSide: stamped.reduce((n, s) => n + s.clipSide, 0),
  };
}

export function applyWalk12(dir, roster) {
  const names = readdirSync(dir).filter((name) => existsSync(path.join(dir, name, 'walk12.png'))).sort();
  const reports = [];
  for (const id of names) {
    const walk = roster[id]?.art?.sheets?.clips?.walk;
    if (!walk) throw new Error(`no imported walk clip for ${id}`);
    const kept = {
      frameW: walk.frameW,
      frameH: walk.frameH,
      footY: walk.footY,
      bodyH: walk.bodyH,
      visibleH: walk.visibleH,
      displayScale: walk.displayScale,
    };
    const fit = fitWalk(id, path.join(dir, id), walk);
    writeFileSync(path.join(SHEET_DIR, `${id}_walk.png`), PNG.sync.write(fit.sheet));
    walk.count = fit.count;
    walk.fps = fit.fps;
    walk.frameW = kept.frameW;
    walk.frameH = kept.frameH;
    walk.footY = kept.footY;
    walk.bodyH = kept.bodyH;
    walk.visibleH = kept.visibleH;
    walk.displayScale = kept.displayScale;
    reports.push({
      id,
      fps: fit.fps,
      cell: `${kept.frameW}x${kept.frameH}`,
      footDelta: fit.foot == null ? null : fit.foot - fit.targetFoot,
      bodyDelta: fit.bodyH == null ? null : fit.bodyH - fit.targetBody,
      clipTop: fit.clipTop,
      clipBot: fit.clipBot,
      clipSide: fit.clipSide,
    });
  }
  return reports;
}

function main() {
  const dir = path.resolve(process.argv[2] || path.join(ROOT, 'walk12'));
  const roster = loadRoster();
  const reports = applyWalk12(dir, roster);
  writeRoster(roster);
  for (const row of reports) {
    const warn = Math.abs(row.footDelta) > 1 || Math.abs(row.bodyDelta) > 3 || row.clipTop > 80;
    console.log(`${warn ? 'WARN' : 'ok  '} ${row.id} ${row.cell} fps ${row.fps} foot ${row.footDelta} body ${row.bodyDelta} clip T${row.clipTop}/B${row.clipBot}/S${row.clipSide}`);
  }
  const bad = reports.filter((row) => Math.abs(row.footDelta) > 1 || Math.abs(row.bodyDelta) > 4);
  if (bad.length) {
    console.error(`${bad.length} walks missed the foot line or body height`);
    process.exit(1);
  }
  console.log(`replaced ${reports.length} walks`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) main();
