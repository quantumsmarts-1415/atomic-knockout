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

test('call 4 wires Erin Signal Repeater and Yvette Flow sheets', () => {
  const expect = {
    'assets/fx/erin/signal-repeater/fx.json': {
      file: 'signal-repeater-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'body', peakFrame: 18,
    },
    'assets/fx/yvette/fiber-laser/fx.json': {
      file: 'fiber-laser-beam-anim.png', frames: 24, loop: false, blend: 'add',
      fit: 'length', stretch: 'length', pivot: 'left', peakFrame: 2,
    },
    'assets/fx/yvette/seismic-read/fx.json': {
      file: 'seismic-ripple-anim.png', frames: 24, cols: 3, rows: 8, loop: true, blend: 'add',
      anchor: 'ground', peakFrame: 15,
    },
    'assets/fx/yvette/lattice-clock/fx.json': {
      file: 'tick-perfect-burst-anim.png', frames: 24, loop: false, blend: 'add', peakFrame: 7,
    },
    'assets/fx/yvette/stress-gauge/fx.json': {
      file: 'stress-gauge-burst-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'fist', peakFrame: 17,
    },
  };
  for (const [path, want] of Object.entries(expect)) {
    const meta = read(path);
    assert.equal(meta.file, want.file, path);
    assert.equal(meta.frames, want.frames, path);
    assert.equal(meta.loop, want.loop, path);
    assert.equal(meta.blend, want.blend, path);
    assert.equal(meta.black, 16, path);
    assert.equal(meta.hit, false, path);
    assert.equal(meta.peakFrame, want.peakFrame, path);
    if (want.anchor) assert.equal(meta.anchor, want.anchor, path);
    if (want.fit) assert.equal(meta.fit, want.fit, path);
    if (want.stretch) assert.equal(meta.stretch, want.stretch, path);
    if (want.pivot) assert.equal(meta.pivot, want.pivot, path);
    if (want.cols) assert.equal(meta.cols, want.cols, path);
    if (want.rows) assert.equal(meta.rows, want.rows, path);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.file)), true, meta.file);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.peak)), true, meta.peak);
  }
  const seismic = read('assets/fx/yvette/seismic-read/fx.json');
  assert.equal(seismic.shatter.file, 'tick-perfect-burst-anim.png');
  assert.equal(seismic.shatter.frames, 24);
  assert.equal(seismic.shatter.blend, 'add');
  assert.equal(seismic.shatter.heightFrac, 0.7);
  assert.equal(fs.existsSync('assets/fx/yvette/seismic-read/tick-perfect-burst-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/erin/undersea-cable/fx.json'), false);
  assert.equal(fs.existsSync('assets/fx/erin/pink-glass-swipe/fx.json'), false);
  assert.equal(fs.existsSync('assets/fx/erin/resurface-laser/fx.json'), false);
  assert.equal(fs.existsSync('assets/fx/liv/chalcogen-hook/fx.json'), false);
});
