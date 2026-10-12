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

test('call 2 wires Rhoda and Paula Flow sheets onto their moves', () => {
  const withPeak = {
    'assets/fx/rhoda/catalytic-converter/fx.json': {
      file: 'catalytic-vortex-anim.png', frames: 24, loop: true, blend: 'screen', anchor: 'aura', peakFrame: 0,
    },
    'assets/fx/rhoda/rose-thorn/fx.json': {
      file: 'rose-thorn-impact-anim.png', frames: 20, loop: false, blend: 'add', anchor: 'fist', peakFrame: 6,
    },
    'assets/fx/rhoda/high-beam/fx.json': {
      file: 'high-beam-cone-anim.png', frames: 24, loop: false, blend: 'add', peakFrame: 5,
    },
  };
  const sheets = {
    'assets/fx/paula/cold-fusion/fx.json': {
      file: 'cold-fusion-blast-anim.png', frames: 24, loop: false, blend: 'add',
    },
    'assets/fx/paula/fuel-cell-bolt/fx.json': {
      file: 'fuel-cell-bolt-anim.png', frames: 24, loop: false, blend: 'add', once: true,
    },
    'assets/fx/paula/hydrogen-sponge/fx.json': {
      file: 'hydrogen-sponge-anim.png', frames: 24, loop: true, blend: 'screen', anchor: 'body',
    },
  };
  for (const [path, want] of Object.entries({ ...withPeak, ...sheets })) {
    const meta = read(path);
    assert.equal(meta.file, want.file, path);
    assert.equal(meta.frames, want.frames, path);
    assert.equal(meta.loop, want.loop, path);
    assert.equal(meta.blend, want.blend, path);
    assert.equal(meta.black, 16, path);
    if (want.anchor) assert.equal(meta.anchor, want.anchor, path);
    if (want.once) assert.equal(meta.once, true, path);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.file)), true, meta.file);
    if (want.peakFrame != null) {
      assert.equal(meta.peakFrame, want.peakFrame, path);
      assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.peak)), true, meta.peak);
    }
  }
  assert.equal(fs.existsSync('assets/fx/paula/white-gold-jab/fx.json'), false);
  assert.equal(fs.existsSync('assets/fx/rhoda/tarnish-guard/fx.json'), false);
});
