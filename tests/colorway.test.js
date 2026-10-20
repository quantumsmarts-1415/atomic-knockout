import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hsvFromRgb, resolveColorway, shiftPixel, swatchFor } from '../src/engine/colorway.js';
import { COLORWAYS, COLORWAY_IDS, chipHex } from '../src/data/colorways.js';
import { CHARACTERS } from '../src/data/characters.js';
import { artIsUpdated } from '../src/data/updatedArt.js';

const deg = (h) => Math.round(h * 360);

test('resolveColorway derives the shift from base and target hue', () => {
  const cw = resolveColorway({ base: 210, skin: 1 }, { name: 'Crimson', hue: 355 });
  assert.equal(deg(cw.hue), 145);
  assert.equal(cw.protect, 1);
  assert.equal(cw.tintA, 0);
  const off = resolveColorway({ base: 10, skin: 0 }, { name: 'Ash', hue: 10, sat: 0.3 });
  assert.equal(off.protect, 0);
  assert.equal(off.hue, 0);
  assert.equal(off.sat, 0.3);
});

test('shiftPixel rotates a saturated color onto the target hue', () => {
  const cw = resolveColorway({ base: 210, skin: 1 }, { name: 'Crimson', hue: 355 });
  const blue = [0.2, 0.45, 0.9];
  const out = shiftPixel(blue, cw);
  const [h, s, v] = hsvFromRgb(...out);
  const [h0, s0, v0] = hsvFromRgb(...blue);
  const want = (deg(h0) + 145) % 360;
  assert.ok(Math.abs(deg(h) - want) <= 2, `hue ${deg(h)} vs ${want}`);
  // value and saturation are preserved, so shading and contrast survive
  assert.ok(Math.abs(s - s0) < 0.02);
  assert.ok(Math.abs(v - v0) < 0.02);
});

test('shiftPixel leaves greys, whites, and blacks alone', () => {
  const cw = resolveColorway({ base: 210, skin: 1 }, { name: 'Crimson', hue: 355 });
  for (const g of [[0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1], [0.1, 0.1, 0.11]]) {
    const out = shiftPixel(g, cw);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(out[i] - g[i]) < 0.02, `${g} -> ${out}`);
  }
});

test('skin protection keeps a skin tone while recoloring the outfit', () => {
  const cw = resolveColorway({ base: 210, skin: 1 }, { name: 'Jade', hue: 150 });
  const skin = [0.93, 0.72, 0.56]; // ~26°, S 0.4, V 0.93
  const kept = shiftPixel(skin, cw);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(kept[i] - skin[i]) < 0.03, `skin moved: ${kept}`);
  const unprotected = resolveColorway({ base: 210, skin: 0 }, { name: 'Jade', hue: 150 });
  const moved = shiftPixel(skin, unprotected);
  const [hs] = hsvFromRgb(...skin);
  const [hm] = hsvFromRgb(...moved);
  assert.ok(Math.abs(deg(hm) - deg(hs)) > 90, 'skin should move when protection is off');
});

test('grey tint colorizes low-saturation pixels without touching black', () => {
  const cw = resolveColorway({ base: 10, skin: 1 }, { name: 'Ice', hue: 200, tint: [200, 0.2] });
  const white = [0.95, 0.95, 0.95];
  const [h, s] = hsvFromRgb(...shiftPixel(white, cw));
  assert.ok(Math.abs(deg(h) - 200) <= 2, `tint hue ${deg(h)}`);
  assert.ok(s > 0.15 && s < 0.25, `tint sat ${s}`);
  const black = [0.05, 0.05, 0.05];
  const out = shiftPixel(black, cw);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(out[i] - black[i]) < 0.02);
});

test('swatchFor and chipHex return packed RGB ints', () => {
  const cw = resolveColorway({ base: 0, skin: 0 }, { name: 'x', hue: 120 });
  assert.equal(swatchFor(0xff0000, cw), 0x00ff00);
  assert.equal(chipHex(0, 1, 1), 0xff0000);
  assert.equal(chipHex(240, 1, 1), 0x0000ff);
});

test('every colorway fighter is a gold-edge (updated art) fighter with 4–6 looks', () => {
  const fxIds = new Set(fs.readdirSync(new URL('../assets/fx', import.meta.url)).filter((d) => d !== 'status'));
  for (const id of COLORWAY_IDS) {
    const def = CHARACTERS[id];
    assert.ok(def, `${id} is not on the roster`);
    assert.ok(artIsUpdated(def, fxIds), `${id} does not have the gold edge`);
    assert.ok(def.palettes.length >= 4 && def.palettes.length <= 6, `${id} has ${def.palettes.length} looks`);
    assert.equal(def.palettes[0].colorway, null, `${id} slot 0 must be the painted standard`);
    const names = new Set(def.palettes.map((p) => p.name));
    assert.equal(names.size, def.palettes.length, `${id} has duplicate colorway names`);
    for (const p of def.palettes.slice(1)) {
      assert.ok(p.colorway, `${id}/${p.name} has no colorway`);
      assert.ok(Number.isFinite(p.body) && p.body >= 0 && p.body <= 0xffffff);
    }
  }
  const updated = new Set(
    Object.values(CHARACTERS).filter((c) => artIsUpdated(c, fxIds)).map((c) => c.id),
  );
  for (const id of COLORWAY_IDS) assert.ok(updated.has(id), `${id} is gold without a colorway listing`);
  assert.ok(updated.has('lucy'), 'lucy lights up from her effect folder before she has colorways');
  assert.ok(updated.has('tex'), 'tex lights up from his effect folder before he has colorways');
  assert.ok(updated.has('sterling'), 'sterling lights up from his effect folder before he has colorways');
  assert.ok(updated.has('cody'), 'cody lights up from his effect folder before he has colorways');
  assert.ok(updated.has('ruth'), 'ruth lights up from her effect folder before she has colorways');
});

test('fighters without colorways keep their standard look only', () => {
  for (const def of Object.values(CHARACTERS)) {
    if (COLORWAYS[def.id]) continue;
    for (const p of def.palettes) assert.ok(!p.colorway, `${def.id} should not carry a colorway`);
  }
});
