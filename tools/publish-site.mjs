#!/usr/bin/env node
// Build the public Netlify download site into dist/.
// This is intentionally NOT the playable game — customers download the
// desktop package from here.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const dist = join(root, 'dist');
const branding = join(root, 'branding');

if (existsSync(join(branding, 'cover.jpg')) || existsSync(join(branding, 'cover.png'))) {
  const icons = spawnSync('node', ['tools/make-icons.mjs'], { cwd: root, stdio: 'inherit' });
  if (icons.status !== 0) process.exit(icons.status || 1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(site, dist, { recursive: true });
mkdirSync(join(dist, 'branding'), { recursive: true });
for (const name of [
  'cover.jpg',
  'cover.png',
  'icon.ico',
  'icon.png',
  'icon-256.png',
  'icon-512.png',
]) {
  const from = join(branding, name);
  if (existsSync(from)) copyFileSync(from, join(dist, 'branding', name));
}

const latestSrc = join(dist, 'downloads', 'latest.json');
if (!existsSync(latestSrc)) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  writeFileSync(latestSrc, `${JSON.stringify({
    builtAt: null,
    version: pkg.version,
    downloads: [],
    note: 'Upload the installer to Google Drive, then: npm run download:url -- "<share-url>"',
  }, null, 2)}\n`);
}

const latest = JSON.parse(readFileSync(latestSrc, 'utf8'));
console.log(JSON.stringify({
  publish: 'dist',
  mode: 'download-site',
  host: latest.host || null,
  downloadCount: (latest.downloads || []).length,
  hasLocalInstaller: existsSync(join(dist, 'downloads', 'AtomicKnockout-Setup.exe')),
}, null, 2));
