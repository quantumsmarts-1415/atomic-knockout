#!/usr/bin/env node
// Rebuild Windows/PNG icons from branding/cover.{jpg,png}.
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const branding = join(root, 'branding');
const cover = ['cover.png', 'cover.jpg']
  .map((name) => join(branding, name))
  .find((p) => existsSync(p));

if (!cover) {
  console.error('No branding/cover.png or branding/cover.jpg found.');
  process.exit(1);
}

function convert(args) {
  const r = spawnSync('convert', args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('ImageMagick `convert` failed. Install imagemagick first.');
    process.exit(r.status || 1);
  }
}

const png1024 = join(branding, 'cover-1024.png');
convert([cover, '-resize', '1024x1024^', '-gravity', 'center', '-extent', '1024x1024', png1024]);
convert([
  png1024,
  '(', '-clone', '0', '-resize', '256x256', ')',
  '(', '-clone', '0', '-resize', '128x128', ')',
  '(', '-clone', '0', '-resize', '64x64', ')',
  '(', '-clone', '0', '-resize', '48x48', ')',
  '(', '-clone', '0', '-resize', '32x32', ')',
  '(', '-clone', '0', '-resize', '16x16', ')',
  '-delete', '0',
  join(branding, 'icon.ico'),
]);
convert([png1024, '-resize', '512x512', join(branding, 'icon-512.png')]);
convert([png1024, '-resize', '256x256', join(branding, 'icon-256.png')]);
convert([png1024, '-resize', '128x128', join(branding, 'icon.png')]);
copyFileSync(join(branding, 'icon.ico'), join(root, 'game.ico'));
console.log('Updated branding icons from', cover);
