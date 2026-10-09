// Import every complete character folder in a sprites directory.
//
//   node tools/import-all.js path/to/sprites
//   node tools/import-all.js path/to/sprites --portraits path/to/portraits --dry-run
//
// A folder is complete when it has idle.png, walk.png, attack.png,
// manifest.json, and fighters/<id>.json (or a meta file passed via --meta-dir).
// Incomplete folders are skipped and listed. Moves in movesets.js are not touched.
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importFighter } from './import-fighter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = ['idle', 'walk', 'attack'];

function parseArgs(argv) {
  const positional = [];
  const named = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith('--')) named[key] = true;
      else { named[key] = next; i++; }
    } else positional.push(a);
  }
  return { dir: positional[0], named };
}

export function inspectFolder(folder, options = {}) {
  const id = path.basename(path.resolve(folder));
  const missing = [];
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    return { id, folder, ok: false, missing: ['not a directory'] };
  }
  for (const clip of CLIPS) {
    if (!existsSync(path.join(folder, `${clip}.png`))) missing.push(`${clip}.png`);
  }
  if (!existsSync(path.join(folder, 'manifest.json'))) missing.push('manifest.json');
  const metaDir = options.metaDir || path.join(ROOT, 'fighters');
  const meta = path.join(metaDir, `${id}.json`);
  if (!existsSync(meta)) missing.push(`fighters/${id}.json`);
  return { id, folder, meta: existsSync(meta) ? meta : null, ok: missing.length === 0, missing };
}

export function importAll(spritesDir, options = {}) {
  if (!existsSync(spritesDir)) throw new Error(`no sprites directory ${spritesDir}`);
  const names = readdirSync(spritesDir).filter((name) => {
    const full = path.join(spritesDir, name);
    return statSync(full).isDirectory();
  }).sort();
  const imported = [];
  const skipped = [];
  const failed = [];
  for (const name of names) {
    const folder = path.join(spritesDir, name);
    const plan = inspectFolder(folder, options);
    if (!plan.ok) {
      skipped.push(plan);
      continue;
    }
    if (options.dryRun) {
      imported.push({ id: plan.id, dryRun: true });
      continue;
    }
    try {
      const portrait = options.portraits
        ? path.join(options.portraits, `${plan.id}-cut.png`)
        : null;
      const result = importFighter(folder, {
        id: plan.id,
        meta: plan.meta,
        portrait: portrait && existsSync(portrait) ? portrait : null,
      });
      imported.push({ id: result.id, height: result.record.height, element: result.record.element });
    } catch (err) {
      failed.push({ id: plan.id, error: err.message || String(err) });
    }
  }
  return { imported, skipped, failed };
}

function main() {
  const { dir, named } = parseArgs(process.argv);
  if (!dir || named.help) {
    console.error('Usage: node tools/import-all.js <sprites-dir> [--portraits dir] [--meta-dir dir] [--dry-run]');
    process.exit(dir ? 0 : 1);
  }
  const report = importAll(path.resolve(dir), {
    portraits: named.portraits ? path.resolve(named.portraits) : null,
    metaDir: named['meta-dir'] ? path.resolve(named['meta-dir']) : null,
    dryRun: !!named['dry-run'],
  });
  console.log(`imported ${report.imported.length}`);
  for (const row of report.imported) {
    console.log(row.dryRun ? `  ${row.id} (dry run)` : `  ${row.id} (${row.element}) at ${row.height}px`);
  }
  console.log(`skipped ${report.skipped.length}`);
  for (const row of report.skipped) console.log(`  ${row.id}: missing ${row.missing.join(', ')}`);
  if (report.failed.length) {
    console.log(`failed ${report.failed.length}`);
    for (const row of report.failed) console.log(`  ${row.id}: ${row.error}`);
    process.exit(1);
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) main();
