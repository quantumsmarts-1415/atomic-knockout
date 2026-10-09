import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { detectBlobCount, resolveStrip } from '../tools/import-lib.js';

function blank(w, h) {
  return new PNG({ width: w, height: h });
}

function stamp(png, x, y, w, h) {
  for (let yy = y; yy < y + h && yy < png.height; yy++) {
    for (let xx = x; xx < x + w && xx < png.width; xx++) {
      const i = (yy * png.width + xx) << 2;
      png.data[i] = 200;
      png.data[i + 1] = 40;
      png.data[i + 2] = 40;
      png.data[i + 3] = 255;
    }
  }
}

test('a row of frameW cells ignores a wrong manifest count', () => {
  const png = blank(300, 100);
  stamp(png, 10, 10, 40, 70);
  stamp(png, 110, 10, 40, 70);
  stamp(png, 210, 10, 40, 70);
  const strip = resolveStrip(png, 100, 100, 6, 'walk');
  assert.strictEqual(strip.count, 3);
  assert.strictEqual(strip.how, 'tiled-count');
});

test('a rescaled walk strip is split on the gaps, not the manifest count', () => {
  const png = blank(400, 50);
  stamp(png, 8, 6, 30, 36);
  stamp(png, 108, 6, 30, 36);
  stamp(png, 208, 6, 28, 36);
  stamp(png, 308, 6, 30, 36);
  const found = detectBlobCount(png);
  assert.strictEqual(found.count, 4);
  const strip = resolveStrip(png, 200, 180, 2, 'walk');
  assert.strictEqual(strip.count, 4);
  assert.ok(strip.how.startsWith('gaps'));
});
