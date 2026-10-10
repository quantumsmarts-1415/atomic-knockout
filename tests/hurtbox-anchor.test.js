// Stored mask center against the source-sheet pixels, both facings.
// On-screen alignment is tests/mask-render.test.js, which reads the canvas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ROSTER } from '../src/data/characters.js';
import { maskBook } from '../src/engine/boxes.js';
import { rasterFrame, cellStats, clipScale, CELL } from '../tools/maskRaster.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const { PNG } = require('pngjs');

const LIMIT = 0.10;

test('mask centers stay within 10% of the visible body for both facings', () => {
  const bad = [];
  for (const c of ROSTER) {
    const sheets = c.art?.sheets;
    if (!sheets?.clips) continue;
    for (const clip of ['idle', 'walk']) {
      const def = sheets.clips[clip];
      if (!def) continue;
      const file = `${process.cwd()}/${sheets.dir}${c.id}_${clip}.png`;
      if (!existsSync(file)) continue;
      const png = PNG.sync.read(readFileSync(file));
      const lay = clipScale(c.art, sheets, def);
      const solids = rasterFrame(
        png, 0, lay.frameW, lay.frameH, lay.footY, lay.scale, c.art.facing ?? 1, lay.bodyH,
      );
      const stats = cellStats(solids);
      const mask = maskBook(c.id)?.clips?.[clip]?.[0];
      assert.ok(mask, `${c.id} ${clip}`);
      const width = Math.max(stats.width, mask.maxX - mask.minX, 1);
      const err = mask.cx - stats.pixelCx;
      const limit = Math.max(CELL, width * LIMIT);
      if (Math.abs(err) > limit) bad.push(`${c.id} ${clip} err ${err.toFixed(1)} width ${width.toFixed(0)}`);
      // Facing left mirrors the same local center around the fighter.
      const x = 400;
      const right = x + mask.cx;
      const left = x - mask.cx;
      const pixRight = x + stats.pixelCx;
      const pixLeft = x - stats.pixelCx;
      assert.ok(Math.abs(right - pixRight) <= limit, `${c.id} ${clip} facing right`);
      assert.ok(Math.abs(left - pixLeft) <= limit, `${c.id} ${clip} facing left`);
    }
  }
  assert.deepEqual(bad, []);
});
