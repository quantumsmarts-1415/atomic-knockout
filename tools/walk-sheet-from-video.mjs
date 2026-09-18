#!/usr/bin/env node
/**
 * Walk sheet from Gemini walk video — FIXED FRAME CROP (no per-frame recenter).
 *
 * Old (buggy) approach: stabilize/recenter each frame on character silhouette,
 * feet, or bbox → forward/back jump as the bbox wobbles.
 *
 * New approach: extract full video frames, then let build-sheet.js compute ONE
 * union bbox across the chosen frames and apply that identical crop to every
 * frame. The unmoving center is the background / total screen area.
 *
 * Usage:
 *   node tools/walk-sheet-from-video.mjs <video.mp4> <outSheet.png> [options]
 *
 * Options:
 *   --frames-dir <dir>   Where to write/read extracted PNGs (default: beside sheet)
 *   --fps <n>            ffmpeg extract rate (default: 8)
 *   --start <i>          first frame index into sorted frames (default: 6)
 *   --end <i>            last frame index inclusive (default: 70)
 *   --step <n>           frame step (default: 2 → every-other ≈ 33 @ fps 8)
 *   --threshold <n>      magenta key threshold (default: 60)
 *   --padding <n>        union-bbox padding (default: 20)
 *   --skip-extract       reuse existing frames dir
 *   --meta <path>        optional one-line meta dump
 *
 * Prints frameW/H/footY/visibleH/count for characters.js clips.walk.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
function has(flag) {
  return process.argv.includes(flag);
}

const video = process.argv[2];
const outSheet = process.argv[3];
if (!video || !outSheet) {
  console.error('Usage: node tools/walk-sheet-from-video.mjs <video.mp4> <outSheet.png> [options]');
  process.exit(1);
}

const fps = Number(arg('--fps', '8'));
const start = Number(arg('--start', '6'));
const end = Number(arg('--end', '70'));
const step = Number(arg('--step', '2'));
const threshold = Number(arg('--threshold', '60'));
const padding = Number(arg('--padding', '20'));
const skipExtract = has('--skip-extract');
const metaPath = arg('--meta', null);

const framesDir = resolve(
  arg('--frames-dir', join(dirname(outSheet), '..', 'frames', basename(outSheet, '.png')))
);

if (!skipExtract) {
  if (existsSync(framesDir)) rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  console.log(`Extracting ${video} @ fps=${fps} → ${framesDir} (FULL FRAME, no stabilize/recenter)`);
  const ff = spawnSync(
    'ffmpeg',
    ['-y', '-i', resolve(video), '-vf', `fps=${fps}`, join(framesDir, 'frame_%04d.png')],
    { stdio: 'inherit' }
  );
  if (ff.status !== 0) process.exit(ff.status ?? 1);
} else {
  console.log(`Reusing frames in ${framesDir} (skip-extract)`);
}

const buildSheet = join(root, 'tools/build-sheet.js');
const outAbs = resolve(outSheet);
mkdirSync(dirname(outAbs), { recursive: true });

console.log(
  `build-sheet FIXED union crop: start=${start} end=${end} step=${step} thresh=${threshold} pad=${padding}`
);
console.log('(No per-frame character centering — union bbox only.)');

const bs = spawnSync(
  'node',
  [buildSheet, framesDir, outAbs, String(start), String(end), String(step), String(threshold), String(padding)],
  { encoding: 'utf8' }
);
process.stdout.write(bs.stdout || '');
process.stderr.write(bs.stderr || '');
if (bs.status !== 0) process.exit(bs.status ?? 1);

// Parse printed config line from build-sheet
const cfg = /frameW:\s*(\d+),\s*frameH:\s*(\d+),\s*footY:\s*([\d.]+),\s*visibleH:\s*(\d+),\s*clips:\s*\{\s*idle:\s*\{\s*count:\s*(\d+)/.exec(
  bs.stdout || ''
);
if (cfg) {
  const [, frameW, frameH, footY, visibleH, count] = cfg;
  const line = `${basename(outSheet, '.png')}: frameW=${frameW} frameH=${frameH} count=${count} fps=10 footY=${footY} visibleH=${visibleH}`;
  console.log(`WALK CONFIG → walk: { count: ${count}, fps: 10, loop: true, frameW: ${frameW}, frameH: ${frameH}, footY: ${footY}, visibleH: ${visibleH} }`);
  if (metaPath) writeFileSync(resolve(metaPath), line + '\n');
}
