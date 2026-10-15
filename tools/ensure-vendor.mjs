#!/usr/bin/env node
// Copy browser ESM deps into vendor/ so the desktop package (and local
// index.html import map) do not rely on serving node_modules. electron-builder
// strips node_modules out of extraResources.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const copies = [
  ['node_modules/phaser/dist/phaser.esm.js', 'vendor/phaser.esm.js'],
  ['node_modules/qrcode-generator/dist/qrcode.mjs', 'vendor/qrcode.mjs'],
];

mkdirSync(join(root, 'vendor'), { recursive: true });
for (const [fromRel, toRel] of copies) {
  const from = join(root, fromRel);
  const to = join(root, toRel);
  if (!existsSync(from)) {
    console.error(`Missing ${fromRel}. Run npm install first.`);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log('vendor:', toRel);
}
