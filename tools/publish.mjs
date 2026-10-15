// Build the playable game payload for the desktop package.
//
//   npm run build:game
//
// game-dist/ is the game the desktop app serves: HTML, source modules,
// fonts, Phaser, and the art files the roster and stages point at.
// Review clips, Blender/Gemini source, backups, and the Node phone relay
// stay out. PNG bytes are rewritten losslessly. A sheet that already crops
// to its visible pixels drops fully transparent padding.
// The public Netlify site is built separately with npm run build.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { ROSTER } from '../src/data/characters.js';
import { STAGES } from '../src/data/stages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Playable game payload used by the desktop package. The public Netlify site
// is the download landing page in site/, not this folder.
const dist = join(root, process.env.GAME_DIST || 'game-dist');

function addFile(set, rel) {
  if (!rel) return;
  const clean = String(rel).replace(/^\//, '');
  if (!clean || clean.includes('..')) return;
  set.add(clean);
}

function walkFxFiles(value, set, base) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.file === 'string') addFile(set, `${base}${value.file}`);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') walkFxFiles(child, set, base);
  }
}

function referenced() {
  const set = new Set();
  for (const c of ROSTER) {
    if (c.art?.file) addFile(set, c.art.file);
    const sheets = c.art?.sheets;
    if (!sheets?.dir || !sheets.clips) continue;
    for (const [clip, def] of Object.entries(sheets.clips)) {
      addFile(set, `${sheets.dir}${def.file || `${c.id}_${clip}.png`}`);
    }
  }
  for (const stage of STAGES) {
    addFile(set, `art-src/stages/${stage.id}/thumb.jpg`);
    addFile(set, `art-src/stages/${stage.id}/preview.jpg`);
    const art = stage.art;
    if (!art?.dir) continue;
    for (const layer of art.layers || []) addFile(set, `${art.dir}${layer.file}`);
    if (art.terrain) addFile(set, `${art.dir}${art.terrain}`);
    if (art.movingPlatform) addFile(set, `${art.dir}${art.movingPlatform}`);
    const intro = stage.intro?.art || {};
    for (const file of Object.values(intro)) addFile(set, `${art.dir}${file}`);
  }
  const fxRoot = join(root, 'assets/fx');
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_old' || entry.name === 'backup') continue;
        walk(abs);
        continue;
      }
      if (entry.name === 'fx.json') {
        const meta = JSON.parse(readFileSync(abs, 'utf8'));
        const base = `${relative(root, dir)}/`;
        walkFxFiles(meta, set, base);
        addFile(set, relative(root, abs));
      }
    }
  };
  walk(fxRoot);
  return set;
}

function sha256(file) {
  const hash = createHash('sha256');
  hash.update(readFileSync(file));
  return hash.digest('hex');
}

function copyRel(rel) {
  const from = join(root, rel);
  const to = join(dist, rel);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

function contentBox(png) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function trimCroppedFx(rel) {
  if (!rel.endsWith('.png') || !rel.startsWith('assets/fx/')) return 0;
  const jsonPath = join(dirname(join(dist, rel)), 'fx.json');
  if (!existsSync(jsonPath)) return 0;
  let meta;
  try { meta = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch { return 0; }
  const name = rel.slice(rel.lastIndexOf('/') + 1);
  const specs = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.file === name) specs.push(node);
    for (const child of Object.values(node)) if (child && typeof child === 'object' && child !== node) visit(child);
  };
  visit(meta);
  if (!specs.length || specs.some((spec) => spec.crop !== 'frame' || (spec.frames > 1))) return 0;
  const abs = join(dist, rel);
  const before = statSync(abs).size;
  const png = PNG.sync.read(readFileSync(abs));
  const box = contentBox(png);
  if (!box) return 0;
  const pad = 2;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const w = Math.min(png.width - x, box.w + pad * 2);
  const h = Math.min(png.height - y, box.h + pad * 2);
  if (w * h > png.width * png.height * 0.8) return 0;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x, y, w, h, 0, 0);
  const buf = PNG.sync.write(out);
  if (buf.length >= before) return 0;
  writeFileSync(abs, buf);
  return before - buf.length;
}

function relBetween(fromFile, toFile) {
  const rel = relative(dirname(fromFile), toFile);
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function dedupeFx(present) {
  const groups = new Map();
  for (const rel of present) {
    const hash = sha256(join(root, rel));
    if (!groups.has(hash)) groups.set(hash, []);
    groups.get(hash).push(rel);
  }
  let removed = 0;
  let saved = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canon = group[0];
    for (const dup of group.slice(1)) {
      if (!dup.startsWith('assets/fx/')) continue;
      const jsonPath = join(dist, dirname(dup), 'fx.json');
      if (!existsSync(jsonPath)) continue;
      const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
      const name = dup.slice(dup.lastIndexOf('/') + 1);
      let changed = false;
      const point = (node) => {
        if (!node || typeof node !== 'object') return;
        if (node.file === name) {
          node.file = relBetween(dup, canon);
          changed = true;
        }
        for (const child of Object.values(node)) {
          if (child && typeof child === 'object') point(child);
        }
      };
      point(meta);
      if (!changed) continue;
      writeFileSync(jsonPath, `${JSON.stringify(meta, null, 2)}\n`);
      saved += statSync(join(dist, dup)).size;
      rmSync(join(dist, dup));
      removed += 1;
    }
  }
  return { removed, saved };
}

function dirSize(dir) {
  let n = 0;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const abs = join(at, entry.name);
      if (entry.isDirectory()) walk(abs);
      else n += statSync(abs).size;
    }
  };
  walk(dir);
  return n;
}

function main() {
  const files = referenced();
  const missing = [];
  let before = 0;
  const seen = new Map();
  const unique = [];
  for (const rel of files) {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const size = statSync(abs).size;
    before += size;
    const hash = sha256(abs);
    if (seen.has(hash)) continue;
    seen.set(hash, rel);
    unique.push(rel);
  }

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  const present = [...files].filter((rel) => existsSync(join(root, rel)));
  const staticFiles = [
    'index.html',
    'controller.html',
  ];
  const copyTree = (rel) => {
    const abs = join(root, rel);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) copyTree(child);
      else staticFiles.push(child);
    }
  };
  copyTree('src');
  copyTree('fonts');
  for (const rel of staticFiles) copyRel(rel);
  for (const rel of present) copyRel(rel);

  // electron-builder strips any `node_modules` path from extraResources, which
  // left the packaged desktop app unable to fetch Phaser. Ship vendors instead.
  const vendor = [
    ['node_modules/phaser/dist/phaser.esm.js', 'vendor/phaser.esm.js'],
    ['node_modules/qrcode-generator/dist/qrcode.mjs', 'vendor/qrcode.mjs'],
  ];
  for (const [fromRel, toRel] of vendor) {
    const from = join(root, fromRel);
    const to = join(dist, toRel);
    if (!existsSync(from)) throw new Error(`missing vendor source ${fromRel}`);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  const dupesRemoved = dedupeFx(present, seen);

  let trimmed = 0;
  for (const rel of present) {
    if (!existsSync(join(dist, rel))) continue;
    trimmed += trimCroppedFx(rel);
  }

  const pngs = [];
  const collectPng = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) collectPng(abs);
      else if (entry.name.endsWith('.png')) pngs.push(abs);
    }
  };
  collectPng(dist);
  let optimized = false;
  for (let i = 0; i < pngs.length; i += 40) {
    const oxipng = spawnSync('oxipng', ['-o', '2', '--strip', 'safe', ...pngs.slice(i, i + 40)], { stdio: 'inherit' });
    if (oxipng.status !== 0) {
      optimized = false;
      break;
    }
    optimized = true;
  }

  const fxIndex = [];
  const walkFx = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walkFx(abs, rel);
      else if (/\.(png|jpe?g|json)$/i.test(entry.name)) fxIndex.push(rel);
    }
  };
  const fxDist = join(dist, 'assets/fx');
  if (existsSync(fxDist)) walkFx(fxDist, '');
  writeFileSync(join(dist, 'fx-index.json'), JSON.stringify(fxIndex));

  const after = dirSize(dist);
  const mb = (n) => (n / 1e6).toFixed(1);
  console.log(JSON.stringify({
    referencedFiles: files.size,
    missing: missing.length,
    referencedMB: mb(before),
    uniqueMB: mb(unique.reduce((n, rel) => n + statSync(join(root, rel)).size, 0)),
    duplicatesSkipped: files.size - missing.length - unique.length,
    duplicatesRemoved: dupesRemoved.removed,
    dedupeSavedMB: mb(dupesRemoved.saved),
    trimSavedMB: mb(trimmed),
    oxipng: optimized,
    distMB: mb(after),
  }, null, 2));
  if (missing.length) console.log('missing', missing.slice(0, 20));
}

main();
