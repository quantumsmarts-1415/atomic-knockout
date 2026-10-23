// Bytes a browser actually fetches, before and after lazy loading.
// Art files are not rewritten. Run: node tools/download-size.mjs
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ROSTER, CHARACTERS } from '../src/data/characters.js';
import { STAGES } from '../src/data/stages.js';
import { TITLE_PARTNER_ID } from '../src/ui/portraits.js';
import { portraitCropIds, portraitFile } from '../src/data/portraitCrops.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
  for (const id of portraitCropIds()) addFile(set, portraitFile(id));
  addFile(set, 'assets/portraits/portrait-crops.json');
  for (const stage of STAGES) {
    addFile(set, `art-src/stages/${stage.id}/thumb.jpg`);
    addFile(set, `art-src/stages/${stage.id}/preview.jpg`);
    const art = stage.art;
    if (!art?.dir) continue;
    for (const layer of art.layers || []) addFile(set, `${art.dir}${layer.file}`);
    if (art.terrain) addFile(set, `${art.dir}${art.terrain}`);
    if (art.movingPlatform) addFile(set, `${art.dir}${art.movingPlatform}`);
    for (const file of Object.values(stage.intro?.art || {})) addFile(set, `${art.dir}${file}`);
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
        walkFxFiles(meta, set, `${relative(root, dir)}/`);
        addFile(set, relative(root, abs));
      }
    }
  };
  walk(fxRoot);
  return set;
}

function bytesOf(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return 0;
  return statSync(abs).size;
}

function sum(rels) {
  let n = 0;
  let missing = 0;
  for (const rel of rels) {
    const b = bytesOf(rel);
    if (!b && !existsSync(join(root, rel))) missing += 1;
    n += b;
  }
  return { bytes: n, files: rels.length, missing };
}

function mb(n) {
  return Math.round((n / 1e6) * 10) / 10;
}

function fighterFiles(id) {
  const c = CHARACTERS[id];
  const files = [];
  if (c?.art?.file) files.push(c.art.file);
  const sheets = c?.art?.sheets;
  if (sheets?.dir && sheets.clips) {
    for (const [clip, def] of Object.entries(sheets.clips)) {
      files.push(`${sheets.dir}${def.file || `${c.id}_${clip}.png`}`);
    }
  }
  const fxDir = join(root, 'assets/fx', id);
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
      if (entry.name !== 'fx.json') continue;
      const meta = JSON.parse(readFileSync(abs, 'utf8'));
      const base = `${relative(root, dir)}/`;
      const set = new Set();
      walkFxFiles(meta, set, base);
      files.push(...set, relative(root, abs));
    }
  };
  walk(fxDir);
  return files;
}

function stageFiles(id, { full = true, thumb = true, preview = true } = {}) {
  const stage = STAGES.find((s) => s.id === id);
  const files = [];
  if (thumb) files.push(`art-src/stages/${id}/thumb.jpg`);
  if (preview) files.push(`art-src/stages/${id}/preview.jpg`);
  if (!full || !stage?.art?.dir) return files;
  const art = stage.art;
  for (const layer of art.layers || []) files.push(`${art.dir}${layer.file}`);
  if (art.terrain) files.push(`${art.dir}${art.terrain}`);
  if (art.movingPlatform) files.push(`${art.dir}${art.movingPlatform}`);
  for (const file of Object.values(stage.intro?.art || {})) files.push(`${art.dir}${file}`);
  return files;
}

const ref = referenced();
const refSum = sum(ref);

const allPortraits = ROSTER.map((c) => c.art?.file).filter(Boolean);
const allThumbs = STAGES.map((s) => `art-src/stages/${s.id}/thumb.jpg`);
const allPreviews = STAGES.map((s) => `art-src/stages/${s.id}/preview.jpg`);
const allStageFull = STAGES.flatMap((s) => stageFiles(s.id, { thumb: false, preview: false }));

const title = ['hydra', TITLE_PARTNER_ID].map((id) => CHARACTERS[id]?.art?.file).filter(Boolean);
const oldBoot = sum([...allPortraits, ...allThumbs, ...allPreviews, ...allStageFull]);
const newBoot = sum([...title, ...allThumbs]);

function session(ids, stageId, boot) {
  const extra = [];
  for (const id of ids) extra.push(...fighterFiles(id));
  extra.push(...stageFiles(stageId));
  extra.push(
    'assets/fx/status/poison/poison-status-sheet.jpg',
    'assets/fx/status/poison/fx.json',
    'assets/fx/status/smoke-wisp/sheet.png',
    'assets/fx/status/smoke-wisp/fx.json',
    'assets/fx/status/on-fire-small/sheet.png',
    'assets/fx/status/on-fire-small/fx.json',
  );
  const bootSet = new Set(boot);
  const fresh = extra.filter((f) => !bootSet.has(f));
  return sum([...new Set([...boot, ...fresh])]);
}

const oldBootList = [...allPortraits, ...allThumbs, ...allPreviews, ...allStageFull];
const newBootList = [...title, ...allThumbs];

const pairs = [
  ['hydra', 'helen'],
  ['gertrude', 'uri'],
  ['cody', 'niobe'],
];

const sessions = {};
for (const pair of pairs) {
  const key = pair.join('-vs-');
  sessions[key] = {
    beforeMB: mb(session(pair, 'holdout-keep', oldBootList).bytes),
    afterMB: mb(session(pair, 'holdout-keep', newBootList).bytes),
    beforeFiles: session(pair, 'holdout-keep', oldBootList).files,
    afterFiles: session(pair, 'holdout-keep', newBootList).files,
  };
}

console.log(JSON.stringify({
  referencedFiles: ref.size,
  referencedMB: mb(refSum.bytes),
  missingReferenced: refSum.missing,
  oldBootMB: mb(oldBoot.bytes),
  oldBootFiles: oldBoot.files,
  newBootMB: mb(newBoot.bytes),
  newBootFiles: newBoot.files,
  portraitsMB: mb(sum(allPortraits).bytes),
  thumbsMB: mb(sum(allThumbs).bytes),
  previewsMB: mb(sum(allPreviews).bytes),
  stageLayersMB: mb(sum(allStageFull).bytes),
  sessions,
}, null, 2));

if (process.argv.includes('--dupes')) {
  const hashes = new Map();
  let hashed = 0;
  for (const rel of ref) {
    if (!/\.(png|jpe?g)$/i.test(rel)) continue;
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    const hash = createHash('sha256').update(readFileSync(abs)).digest('hex');
    const row = hashes.get(hash) || { bytes: statSync(abs).size, files: [] };
    row.files.push(rel);
    hashes.set(hash, row);
    hashed += 1;
  }
  let extra = 0;
  let groups = 0;
  for (const row of hashes.values()) {
    if (row.files.length < 2) continue;
    groups += 1;
    extra += row.bytes * (row.files.length - 1);
  }
  console.log(JSON.stringify({ hashed, duplicateGroups: groups, duplicateExtraMB: mb(extra) }));
}
