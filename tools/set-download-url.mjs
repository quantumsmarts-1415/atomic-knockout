#!/usr/bin/env node
// Point the public download button at an external host (Google Drive, etc.)
// without uploading the ~1.5 GB installer to Netlify.
//
//   npm run download:url -- "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
//   npm run download:url -- "https://drive.google.com/uc?export=download&id=FILE_ID"
//
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site', 'downloads', 'latest.json');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const raw = (process.argv[2] || '').trim();
const mbArg = process.argv.find((a) => a.startsWith('--mb='));
const labelArg = process.argv.find((a) => a.startsWith('--label='));
const versionArg = process.argv.find((a) => a.startsWith('--version='));

if (!raw) {
  console.error('Usage: npm run download:url -- "<public-download-url>" [--mb=1581.6]');
  process.exit(1);
}

function toDirectDriveUrl(url) {
  try {
    const u = new URL(url);
    if (!/drive\.google\.com$/i.test(u.hostname) && !/\.google\.com$/i.test(u.hostname)) {
      return url;
    }
    // https://drive.google.com/file/d/FILE_ID/view?...
    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) {
      return `https://drive.google.com/uc?export=download&confirm=t&id=${fileMatch[1]}`;
    }
    // https://drive.google.com/open?id=FILE_ID
    const id = u.searchParams.get('id');
    if (id) {
      return `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;
    }
    // Already a uc?export=download link — ensure confirm=t for large files.
    if (u.pathname.includes('/uc') && u.searchParams.get('id')) {
      u.searchParams.set('export', 'download');
      u.searchParams.set('confirm', 't');
      return u.toString();
    }
  } catch {
    // keep original
  }
  return url;
}

const url = toDirectDriveUrl(raw);
const mb = mbArg ? Number(mbArg.slice('--mb='.length)) : null;
const label = labelArg ? labelArg.slice('--label='.length) : 'Windows Installer';
const version = versionArg ? versionArg.slice('--version='.length) : pkg.version;

const manifest = {
  builtAt: new Date().toISOString(),
  version,
  host: /drive\.google\.com/i.test(url) ? 'google-drive' : 'external',
  downloads: [
    {
      file: 'AtomicKnockout-Setup.exe',
      url,
      bytes: mb != null && Number.isFinite(mb) ? Math.round(mb * 1e6) : null,
      mb: mb != null && Number.isFinite(mb) ? mb : null,
      label,
      external: true,
    },
  ],
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${out}`);
console.log('Next: npm run build   # then publish dist/ on Netlify (tiny — no exe uploaded)');
