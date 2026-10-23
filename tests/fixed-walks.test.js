import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { CHARACTERS } from '../src/data/characters.js';
import { artIsUpdated } from '../src/data/updatedArt.js';
import { measureFrames } from '../tools/import-lib.js';

const roster = JSON.parse(readFileSync('src/data/imported-roster.json', 'utf8'));

const WALKS = {
  zora: { frameW: 792, frameH: 1113, footY: 0.9883, visibleH: 1064, fps: 8.73 },
  rhoda: { frameW: 854, frameH: 1041, footY: 0.9866, visibleH: 997, fps: 9 },
  erin: { frameW: 620, frameH: 1028, footY: 0.9864, visibleH: 985, fps: 7.58 },
  yara: { frameW: 504, frameH: 909, footY: 0.9835, visibleH: 876, fps: 10 },
};

function worldH(art, def) {
  const body = def.bodyH ?? def.visibleH ?? art.sheets.bodyH ?? art.sheets.visibleH;
  const scale = def.displayScale ?? art.sheets.displayScale ?? (art.height / body);
  return scale * body;
}

function gridFrames(png, count, frameW, frameH) {
  const cols = Math.ceil(Math.sqrt(count));
  const frames = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const frame = new PNG({ width: frameW, height: frameH });
    PNG.bitblt(png, frame, col * frameW, row * frameH, frameW, frameH, 0, 0);
    frames.push(frame);
  }
  return frames;
}

function stripFrames(png, count, frameW, frameH) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const frame = new PNG({ width: frameW, height: frameH });
    PNG.bitblt(png, frame, i * frameW, 0, frameW, frameH, 0, 0);
    frames.push(frame);
  }
  return frames;
}

test('redrawn walks match idle height and the walk.json foot line', () => {
  for (const [id, spec] of Object.entries(WALKS)) {
    const art = CHARACTERS[id].art;
    const idle = art.sheets.clips.idle;
    const walk = art.sheets.clips.walk;
    const attack = art.sheets.clips.attack;
    assert.equal(walk.count, 12, id);
    assert.equal(walk.fps, spec.fps, id);
    assert.equal(walk.loop, true, id);
    assert.equal(walk.frameW, spec.frameW, id);
    assert.equal(walk.frameH, spec.frameH, id);
    assert.equal(walk.footY, spec.footY, id);
    assert.equal(walk.visibleH, spec.visibleH, id);
    assert.equal(walk.bodyH, spec.visibleH, id);
    assert.equal(walk.visibleH, idle.visibleH, id);
    assert.equal(walk.frameH, idle.frameH, id);
    assert.ok(Math.abs(walk.footY - idle.footY) <= 0.015, id);
    assert.equal(walk.displayScale, art.height / walk.visibleH, id);
    for (const clip of [idle, walk, attack]) {
      assert.ok(Math.abs(worldH(art, clip) - worldH(art, idle)) < 1, `${id} ${clip.count}`);
    }
    const png = PNG.sync.read(readFileSync(`art-src/imported/sheets/${id}_walk.png`));
    assert.equal(png.width, spec.frameW * 4, id);
    assert.equal(png.height, spec.frameH * 3, id);
    const measured = measureFrames(gridFrames(png, 12, spec.frameW, spec.frameH));
    const targetFoot = Math.round(spec.footY * spec.frameH) - 1;
    const footTol = Math.max(1, Math.round(spec.frameH / 150));
    const bodyTol = Math.max(4, Math.round((spec.frameH * 4) / 150));
    assert.ok(Math.abs(measured.foot - targetFoot) <= footTol, `${id} foot ${measured.foot}`);
    assert.ok(Math.abs(measured.bodyH - walk.bodyH) <= bodyTol, `${id} body ${measured.bodyH}`);
    const saved = roster[id].art.sheets.clips.walk;
    assert.equal(saved.frameW, spec.frameW, id);
    assert.equal(saved.frameH, spec.frameH, id);
    assert.equal(saved.footY, spec.footY, id);
    assert.equal(saved.visibleH, spec.visibleH, id);
    assert.equal(artIsUpdated(CHARACTERS[id], new Set()), true, id);
  }
});

test('lucy copper wheel matches idle height and keeps the select gold', () => {
  const art = CHARACTERS.lucy.art;
  const idle = art.sheets.clips.idle;
  const walk = art.sheets.clips.walk;
  const attack = art.sheets.clips.attack;
  assert.equal(attack.count, 5);
  assert.equal(attack.fps, 12);
  assert.equal(attack.loop, false);
  assert.equal(attack.frameW, 665);
  assert.equal(attack.frameH, 620);
  assert.equal(attack.footY, 0.9694);
  assert.equal(attack.visibleH, 563);
  assert.equal(attack.bodyH, 563);
  assert.equal(attack.displayScale, art.height / attack.visibleH);
  assert.ok(Math.abs(worldH(art, walk) - worldH(art, idle)) < 1);
  assert.ok(Math.abs(worldH(art, attack) - worldH(art, idle)) < 1);
  const png = PNG.sync.read(readFileSync('art-src/imported/sheets/lucy_attack.png'));
  assert.equal(png.width, 665 * 5);
  assert.equal(png.height, 620);
  const measured = measureFrames(stripFrames(png, 5, 665, 620));
  const targetFoot = Math.round(attack.footY * attack.frameH) - 1;
  assert.ok(Math.abs(measured.foot - targetFoot) <= 1, `foot ${measured.foot}`);
  assert.ok(Math.abs(measured.bodyH - attack.bodyH) <= 4, `body ${measured.bodyH}`);
  const saved = roster.lucy.art.sheets.clips.attack;
  assert.equal(saved.frameW, 665);
  assert.equal(saved.frameH, 620);
  assert.equal(saved.footY, 0.9694);
  assert.equal(saved.visibleH, 563);
  assert.equal(artIsUpdated(CHARACTERS.lucy, new Set(['lucy'])), true);
});
