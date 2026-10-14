// Build Windows .ico + PNG sizes from the official Atomic Knockout art.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'assets/branding/atomic-knockout.jpg');
const buildDir = join(root, 'build');
mkdirSync(buildDir, { recursive: true });

const sizes = [16, 32, 48, 64, 128, 256, 512];
const pngBuffers = [];

for (const size of sizes) {
  const buf = await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();
  pngBuffers.push(buf);
  if (size === 256 || size === 512) {
    writeFileSync(join(buildDir, `icon-${size}.png`), buf);
  }
}

writeFileSync(join(buildDir, 'icon.png'), pngBuffers[pngBuffers.length - 1]); // 512
const ico = await pngToIco(pngBuffers.filter((_, i) => sizes[i] <= 256));
writeFileSync(join(buildDir, 'icon.ico'), ico);
copyFileSync(join(buildDir, 'icon.ico'), join(root, 'game.ico'));

console.log(JSON.stringify({
  source: 'assets/branding/atomic-knockout.jpg',
  wrote: ['build/icon.png', 'build/icon.ico', 'build/icon-256.png', 'build/icon-512.png', 'game.ico'],
}, null, 2));
