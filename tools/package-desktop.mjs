#!/usr/bin/env node
// Build the playable game into game-dist/, then package a Windows desktop app
// with electron-builder (installer + portable). Copies artifacts into
// site/downloads/ for the Netlify download page.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = join(root, 'release');
const downloadsDir = join(root, 'site', 'downloads');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
  if (r.status !== 0) process.exit(r.status || 1);
}

function filesMatching(dir, re) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => re.test(name) && statSync(join(dir, name)).isFile())
    .map((name) => ({ name, path: join(dir, name), bytes: statSync(join(dir, name)).size }))
    .sort((a, b) => b.bytes - a.bytes);
}

const skipGameBuild = process.argv.includes('--skip-game-build');
const portableOnly = process.argv.includes('--portable-only');
const builderArgs = portableOnly
  ? ['--win', 'portable', '--x64']
  : ['--win', '--x64'];

if (!skipGameBuild) {
  run('node', ['tools/make-icons.mjs']);
  run('node', ['tools/publish.mjs']);
}

if (!existsSync(join(root, 'game-dist', 'index.html'))) {
  console.error('game-dist/ is missing. Run without --skip-game-build first.');
  process.exit(1);
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

// Windows Smart App Control / SmartScreen only trust Authenticode-signed
// installers. Pass a real OV/EV cert via CSC_LINK (+ CSC_KEY_PASSWORD).
// Without those env vars we skip signing so local/unsigned Drive builds still work.
const hasCert = !!(process.env.CSC_LINK || process.env.WIN_CSC_LINK);
const builderEnv = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: hasCert ? (process.env.CSC_IDENTITY_AUTO_DISCOVERY || 'true') : 'false',
};
if (hasCert) {
  console.log('Code signing enabled (CSC_LINK / WIN_CSC_LINK present).');
} else {
  console.log('Code signing skipped — set CSC_LINK (+ CSC_KEY_PASSWORD) for a Smart App Control–friendly build.');
}

run('npx', ['electron-builder', ...builderArgs], {
  env: builderEnv,
});

// Default: keep the ~1.5 GB installer in release/ and host it on Google Drive
// (or similar). Pass --publish-local to also copy it into site/downloads for
// a Netlify-hosted binary (slow / heavy).
const publishLocal = process.argv.includes('--publish-local');
const publishPortable = process.argv.includes('--with-portable-download');
const setups = filesMatching(releaseDir, /Setup.*\.exe$/i);
const portables = filesMatching(releaseDir, /Portable.*\.exe$/i);
const anyExe = filesMatching(releaseDir, /\.exe$/i);
const primary = setups[0] || anyExe[0];

if (!primary) {
  console.error('No Windows .exe artifacts found in release/.');
  process.exit(1);
}

mkdirSync(downloadsDir, { recursive: true });
for (const stale of readdirSync(downloadsDir)) {
  if (/\.(exe|zip|yml|blockmap)$/i.test(stale)) {
    rmSync(join(downloadsDir, stale), { force: true });
  }
}

const copied = [];
if (publishLocal) {
  const destName = /portable/i.test(primary.name)
    ? 'AtomicKnockout-Portable.exe'
    : 'AtomicKnockout-Setup.exe';
  copyFileSync(primary.path, join(downloadsDir, destName));
  copied.push({ file: destName, bytes: primary.bytes, source: primary.name, local: true });
  if (publishPortable && portables[0] && portables[0].path !== primary.path) {
    const dest = 'AtomicKnockout-Portable.exe';
    copyFileSync(portables[0].path, join(downloadsDir, dest));
    copied.push({ file: dest, bytes: portables[0].bytes, source: portables[0].name, local: true });
  }
}

const mb = Number((primary.bytes / 1e6).toFixed(1));
const manifest = publishLocal
  ? {
      builtAt: new Date().toISOString(),
      version: pkg.version,
      host: 'netlify',
      downloads: copied.map((c) => ({
        file: c.file,
        url: `/downloads/${c.file}`,
        bytes: c.bytes,
        mb: Number((c.bytes / 1e6).toFixed(1)),
        label: c.file.includes('Portable') ? 'Windows Portable' : 'Windows Installer',
      })),
    }
  : {
      builtAt: new Date().toISOString(),
      version: pkg.version,
      host: 'local-release',
      releaseFile: primary.name,
      releasePath: `release/${primary.name}`,
      downloads: [],
      note: `Installer built at release/${primary.name} (${mb} MB). Upload that file to Google Drive (anyone-with-link), then run: npm run download:url -- "<share-url>" --mb=${mb}`,
    };

writeFileSync(join(downloadsDir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  releaseDir,
  primary: { name: primary.name, mb },
  publishLocal,
  downloads: manifest.downloads,
  note: manifest.note || null,
}, null, 2));
