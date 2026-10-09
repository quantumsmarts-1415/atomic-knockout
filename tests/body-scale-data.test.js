import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';

// Same resolution as clipDisplayLayout, without importing Phaser.
function layout(art, def) {
  const sheets = art.sheets;
  const footY = def.footY ?? sheets.footY;
  const bodyH = def.bodyH ?? def.visibleH ?? sheets.bodyH ?? sheets.visibleH;
  const displayScale = def.displayScale
    ?? ((def.bodyH == null && def.visibleH == null) ? sheets.displayScale : null)
    ?? (art.height / bodyH);
  return { footY, bodyH, displayScale };
}

test('every clip draws the head-to-feet body at art.height', () => {
  for (const c of Object.values(CHARACTERS)) {
    const sheets = c.art?.sheets;
    if (!sheets) continue;
    const heights = [];
    for (const [name, def] of Object.entries(sheets.clips)) {
      const box = layout(c.art, def);
      const onScreen = box.displayScale * box.bodyH;
      assert.ok(
        Math.abs(onScreen - c.art.height) < 0.05,
        `${c.id} ${name} draws ${onScreen}px, art.height is ${c.art.height}`,
      );
      assert.ok(box.footY > 0.65 && box.footY <= 1, `${c.id} ${name} footY ${box.footY}`);
      heights.push(onScreen);
    }
    for (const h of heights) {
      assert.ok(Math.abs(h - heights[0]) < 0.05, `${c.id} clips disagree`);
    }
  }
});
