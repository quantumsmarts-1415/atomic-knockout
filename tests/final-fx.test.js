import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { objectTypeOf } from '../src/data/attackFx.js';

function read(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

test('call 1 wires Yara and Zora Flow sheets onto their moves', () => {
  const expect = {
    'assets/fx/yara/maglev-launch/fx.json': {
      file: 'maglev-glide-trail-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'trail', peakFrame: 9,
    },
    'assets/fx/yara/garnet-cut/fx.json': {
      file: 'garnet-cut-slash-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'fist', peakFrame: 8,
    },
    'assets/fx/yara/flux-pin/fx.json': {
      file: 'flux-pin-lock-anim.png', frames: 24, loop: true, blend: 'add', anchor: 'pin', peakFrame: 21,
    },
    'assets/fx/yara/ytterby-mine/fx.json': {
      file: 'ytterby-mine-burst-anim.png', frames: 23, loop: false, blend: 'add', peakFrame: 6,
    },
    'assets/fx/zora/ceramic-blade/fx.json': {
      file: 'ceramic-sweep-arc-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'fist', peakFrame: 10,
    },
    'assets/fx/zora/cubic-cut/fx.json': {
      file: 'cubic-cut-sparkle-anim.png', frames: 23, loop: false, blend: 'add', anchor: 'fist', peakFrame: 6,
    },
  };
  for (const [path, want] of Object.entries(expect)) {
    const meta = read(path);
    assert.equal(meta.file, want.file, path);
    assert.equal(meta.frames, want.frames, path);
    assert.equal(meta.loop, want.loop, path);
    assert.equal(meta.blend, want.blend, path);
    assert.equal(meta.black, 16, path);
    assert.equal(meta.peakFrame, want.peakFrame, path);
    if (want.anchor) assert.equal(meta.anchor, want.anchor, path);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.file)), true, meta.file);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.peak)), true, meta.peak);
  }
  assert.equal(objectTypeOf({ kind: 'mine', name: 'Ytterby Mine' }, 'specialDirectional'), 'area or burst');
});
