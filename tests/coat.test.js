import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import {
  COATS, coatCoverage, coatSpec, coatWindow, faceRegionFromPixels, tintChannels,
} from '../src/engine/coat.js';

function blank(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  if (!fill) return data;
  for (let y = fill.y; y < fill.y + fill.h; y++) {
    for (let x = fill.x; x < fill.x + fill.w; x++) {
      const i = (y * w + x) * 4;
      data[i] = fill.r;
      data[i + 1] = fill.g;
      data[i + 2] = fill.b;
      data[i + 3] = 255;
    }
  }
  return data;
}

function disc(data, w, cx, cy, rad, rgb) {
  for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
    for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = (y * w + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
}

function frameSlice(png, fw, fh, index) {
  const cols = Math.floor(png.width / fw);
  const c = index % cols;
  const r = Math.floor(index / cols);
  const data = new Uint8ClampedArray(fw * fh * 4);
  for (let y = 0; y < fh; y++) {
    const src = ((r * fh + y) * png.width + c * fw) * 4;
    data.set(png.data.subarray(src, src + fw * 4), y * fw * 4);
  }
  return data;
}

test('coating defenses share one tint list and leave panes alone', () => {
  assert.equal(coatSpec({ name: 'Ozone Layer' }).color, 0x3a78ff);
  assert.equal(coatSpec({ name: 'Oxide Skin' }).flake, true);
  assert.equal(coatSpec({ name: 'Oxide Skin' }).mode, 'lighten');
  assert.equal(coatSpec({ name: 'Teflon Coat' }).gloss > 0.4, true);
  assert.equal(coatSpec({ name: 'Oil Bath' }).mode, 'multiply');
  assert.equal(coatSpec({ name: 'Diamond Plating' }).sparkle, true);
  assert.equal(coatSpec({ name: 'Nitride Shell' }).paceCharge, true);
  assert.equal(coatSpec({ name: 'Red Phosphorus Form' }).gloss, 0);
  assert.equal(coatSpec({ name: 'Vulcanized Rubber' }).color, 0x3a322c);
  assert.equal(coatSpec({ name: 'Mirror Chrome' }).sparkle, true);
  assert.equal(coatSpec({ name: 'Four-State Guard' }).cycle.length, 4);
  assert.equal(coatSpec({ name: 'Blue Glaze' }).gloss > 0.4, true);
  assert.equal(coatSpec({ name: 'Silica Pane' }), null);
  assert.equal(coatSpec({ name: 'Ribbon Guard' }), null);
  assert.equal(coatSpec({ name: 'No Vacancy' }), null);
  assert.equal(coatSpec({ name: 'Beryllium Mirror' }), null);
  assert.equal(coatSpec({ name: 'Boron Carbide Wall' }), null);
  assert.equal(Object.keys(COATS).length, 22);
});

test('a skin-colored face is left open and the torso is coated', () => {
  const w = 80;
  const h = 160;
  const data = blank(w, h, { x: 28, y: 18, w: 24, h: 130, r: 90, g: 90, b: 100 });
  disc(data, w, 40, 36, 9, [230, 170, 140]);
  const face = faceRegionFromPixels(data, w, h);
  assert.ok(face.skin > 20, `skin pixels ${face.skin}`);
  assert.ok(Math.abs(face.cx - 40) < 8, `cx ${face.cx}`);
  assert.ok(Math.abs(face.cy - 36) < 10, `cy ${face.cy}`);
  assert.ok(coatCoverage(face.cx, face.cy, face, 1) < 0.08);
  const torsoY = face.bodyTop + face.bodyH * 0.55;
  assert.ok(coatCoverage(face.cx, torsoY, face, 1) > 0.8);
  assert.ok(coatCoverage(face.cx, torsoY, face, 0.05) < 0.25);
  const rim = coatCoverage(face.cx + face.rx, face.cy, face, 1);
  assert.ok(rim > 0.15 && rim < 0.95, `soft rim ${rim}`);
});

test('the face hole follows the head into the next pose', () => {
  const w = 90;
  const h = 160;
  const idle = blank(w, h, { x: 30, y: 16, w: 22, h: 130, r: 80, g: 80, b: 90 });
  disc(idle, w, 41, 34, 8, [232, 176, 142]);
  const attack = blank(w, h, { x: 38, y: 28, w: 22, h: 120, r: 80, g: 80, b: 90 });
  disc(attack, w, 62, 48, 8, [232, 176, 142]);
  const a = faceRegionFromPixels(idle, w, h);
  const b = faceRegionFromPixels(attack, w, h);
  assert.ok(b.cx > a.cx + 8, `cx ${a.cx} -> ${b.cx}`);
  assert.ok(b.cy > a.cy + 6, `cy ${a.cy} -> ${b.cy}`);
  assert.ok(coatCoverage(a.cx, a.cy, b, 1) > 0.45);
});

test('a helmet with no skin still opens the head band', () => {
  const w = 60;
  const h = 140;
  const data = blank(w, h, { x: 18, y: 12, w: 24, h: 110, r: 70, g: 110, b: 150 });
  const face = faceRegionFromPixels(data, w, h);
  assert.equal(face.skin < 40, true);
  assert.ok(face.cy < face.bodyTop + face.bodyH * 0.22, `cy ${face.cy} top ${face.bodyTop}`);
  assert.ok(coatCoverage(face.cx, face.cy, face, 1) < 0.2);
});

test('nitride rises across the charge and ozone stays through the linger', () => {
  const ozone = { name: 'Ozone Layer', chargeMs: 0, lingerImmune: { types: ['radiation'] } };
  const rising = coatWindow({
    state: 'defending',
    defenseMove: { name: 'Nitride Shell', chargeMs: 3000 },
    defenseStart: 1000,
    charDef: { moves: { specialDefense: { name: 'Nitride Shell', chargeMs: 3000 } } },
  }, 2500);
  assert.ok(Math.abs(rising.sweep - 0.5) < 0.02, rising.sweep);
  const held = coatWindow({
    state: 'idle',
    defenseMove: null,
    defenseStart: 0,
    mitigateUntil: 9000,
    charDef: { moves: { specialDefense: { name: 'Nitride Shell', chargeMs: 3000 } } },
  }, 4000);
  assert.equal(held.sweep, 1);
  const linger = coatWindow({
    state: 'idle',
    defenseMove: null,
    defenseStart: 0,
    lingerImmuneUntil: 15000,
    lingerImmune: ['radiation'],
    charDef: { moves: { specialDefense: ozone } },
  }, 2000);
  assert.equal(linger.spec, COATS['Ozone Layer']);
  assert.equal(linger.sweep, 1);
  const flaked = coatWindow({
    state: 'idle',
    _coatFlaked: true,
    defenseStart: 0,
    charDef: { moves: { specialDefense: { name: 'Oxide Skin' } } },
  }, 10);
  assert.equal(flaked, null);
  const pane = coatWindow({
    state: 'defending',
    defenseMove: { name: 'Silica Pane' },
    defenseStart: 0,
    charDef: { moves: { specialDefense: { name: 'Silica Pane' } } },
  }, 100);
  assert.equal(pane, null);
});

test('pale coats lighten and colored coats multiply', () => {
  const [wr, wg, wb] = tintChannels(80, 90, 100, COATS['Oxide Skin'], 0);
  assert.ok(wr > 80 && wg > 90 && wb > 100);
  const [br, bg, bb] = tintChannels(200, 200, 200, COATS['Ozone Layer'], 0);
  assert.ok(bb > br && bb > bg, `${br},${bg},${bb}`);
  const [sr, sg, sb] = tintChannels(40, 40, 40, COATS['Teflon Coat'], 0.5);
  assert.ok(sr > 40 && sg > sr - 8);
});

test('oxana idle and walk frames each keep the hole on the head', () => {
  const art = CHARACTERS.oxana.art.sheets;
  const idlePng = PNG.sync.read(fs.readFileSync('art-src/gemini-test/sheets/oxana_idle.png'));
  const walkPng = PNG.sync.read(fs.readFileSync('art-src/gemini-test/sheets/oxana_walk.png'));
  const idle = art.clips.idle;
  const walk = art.clips.walk;
  const low = frameSlice(idlePng, idle.frameW ?? art.frameW, idle.frameH ?? art.frameH, 2);
  const high = frameSlice(idlePng, idle.frameW ?? art.frameW, idle.frameH ?? art.frameH, 4);
  const walked = frameSlice(walkPng, walk.frameW, walk.frameH, 8);
  const a = faceRegionFromPixels(low, idle.frameW ?? art.frameW, idle.frameH ?? art.frameH);
  const b = faceRegionFromPixels(high, idle.frameW ?? art.frameW, idle.frameH ?? art.frameH);
  const c = faceRegionFromPixels(walked, walk.frameW, walk.frameH);
  assert.ok(a.cy > b.cy + 4, `idle head ${a.cy} vs ${b.cy}`);
  assert.ok(coatCoverage(a.cx, a.cy, a, 1) < 0.25, `idle cover ${coatCoverage(a.cx, a.cy, a, 1)}`);
  assert.ok(coatCoverage(a.cx, a.bodyTop + a.bodyH * 0.55, a, 1) > 0.75);
  assert.ok(coatCoverage(c.cx, c.cy, c, 1) < 0.25);
  assert.ok(Math.abs(c.cx / walk.frameW - a.cx / (idle.frameW ?? art.frameW)) < 0.2);
});
