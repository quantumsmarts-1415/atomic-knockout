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
  assert.equal(fs.existsSync('assets/fx/rhoda/tarnish-guard/fx.json'), false);
});

test('call 3 wires Paula peaks, Sandy, and the rest of Erin', () => {
  const expect = {
    'assets/fx/paula/cold-fusion/fx.json': {
      file: 'cold-fusion-blast-anim.png', frames: 24, loop: false, blend: 'add', peakFrame: 13,
    },
    'assets/fx/paula/fuel-cell-bolt/fx.json': {
      file: 'fuel-cell-bolt-anim.png', frames: 24, loop: false, blend: 'add', once: true, peakFrame: 5,
    },
    'assets/fx/paula/hydrogen-sponge/fx.json': {
      file: 'hydrogen-sponge-anim.png', frames: 24, loop: true, blend: 'screen', anchor: 'body', peakFrame: 15,
    },
    'assets/fx/paula/white-gold-jab/fx.json': {
      file: 'white-gold-jab-impact-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'fist', peakFrame: 17,
    },
    'assets/fx/sandy/sledgehammer-swing/fx.json': {
      file: 'hammer-boom-impact-anim.png', frames: 23, loop: false, blend: 'add', anchor: 'fist', peakFrame: 2,
    },
    'assets/fx/sandy/tin-cry/fx.json': {
      file: 'tin-cry-sonic-blast-anim.png', frames: 24, loop: false, blend: 'add', pivot: 'left', peakFrame: 17,
    },
    'assets/fx/sandy/tin-pest/fx.json': {
      file: 'tin-pest-crumble-anim.png', frames: 24, loop: false, blend: 'screen', anchor: 'ground',
      puddle: true, holdAt: 7, breakFrom: 8, peakFrame: 11,
    },
    'assets/fx/erin/undersea-cable/fx.json': {
      file: 'cable-signal-pulse-anim.png', frames: 24, loop: false, blend: 'add',
      fit: 'length', stretch: 'length', pivot: 'left', peakFrame: 18,
    },
    'assets/fx/erin/pink-glass-swipe/fx.json': {
      file: 'pink-glass-swipe-arc-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'fist', peakFrame: 10,
    },
    'assets/fx/erin/resurface-laser/fx.json': {
      file: 'resurface-laser-anim.png', frames: 24, loop: false, blend: 'add',
      fit: 'length', stretch: 'length', pivot: 'left', peakFrame: 3,
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
    if (want.once) assert.equal(meta.once, true, path);
    if (want.fit) assert.equal(meta.fit, want.fit, path);
    if (want.stretch) assert.equal(meta.stretch, want.stretch, path);
    if (want.pivot) assert.equal(meta.pivot, want.pivot, path);
    if (want.puddle) assert.equal(meta.puddle, true, path);
    if (want.holdAt != null) assert.equal(meta.holdAt, want.holdAt, path);
    if (want.breakFrom != null) assert.equal(meta.breakFrom, want.breakFrom, path);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.file)), true, meta.file);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.peak)), true, meta.peak);
  }
  const can = read('assets/fx/sandy/tin-can-kick/fx.json');
  assert.equal(can.file, undefined);
  assert.equal(can.impact.file, 'can-ricochet-ping-anim.png');
  assert.equal(can.impact.frames, 24);
  assert.equal(can.impact.blend, 'add');
  assert.equal(can.impact.black, 16);
  assert.equal(can.impact.heightFrac, 0.5);
  assert.equal(fs.existsSync('assets/fx/sandy/tin-can-kick/can-ricochet-ping-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/sandy/tin-can-kick/can-ricochet-ping.jpg'), true);
  assert.equal(fs.existsSync('assets/fx/paula/cold-fusion/cold-fusion-cell-sheet.png'), false);
  assert.equal(fs.existsSync('assets/fx/erin/resurface-laser/strip-protection-shatter.png'), false);
  assert.equal(fs.existsSync('assets/fx/sandy/tin-can-kick/tin-can.png'), false);
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
});

test('call 5 wires Liv and the Tess sheets that arrived complete', () => {
  const withPeak = {
    'assets/fx/liv/192-beams/fx.json': {
      file: 'fusion-ignition-blast-anim.png', frames: 24, loop: false, blend: 'add', peakFrame: 8,
    },
    'assets/fx/liv/chalcogen-hook/fx.json': {
      file: 'chalcogen-hook-impact-anim.png', frames: 24, loop: false, blend: 'screen', anchor: 'fist', peakFrame: 10,
    },
    'assets/fx/liv/hohlraum/fx.json': {
      file: 'hohlraum-can-anim.png', frames: 21, cols: 3, rows: 7, loop: false, blend: 'add',
      anchor: 'body', holdAt: 0, breakFrom: 8, peakFrame: 0,
    },
    'assets/fx/liv/last-instant/fx.json': {
      file: 'last-instant-spark-anim.png', frames: 24, loop: false, blend: 'add', once: true, peakFrame: 11,
    },
  };
  const sheets = {
    'assets/fx/tess/electron-hunger/fx.json': {
      file: 'electron-hunger-tether-anim.png', frames: 24, loop: false, blend: 'add', pivot: 'left', peakFrame: 15,
    },
    'assets/fx/tess/last-halogen/fx.json': {
      file: 'halogen-swipe-arc-anim.png', frames: 24, loop: false, blend: 'add', anchor: 'fist', peakFrame: 17,
    },
    'assets/fx/tess/six-atom-spread/fx.json': {
      file: 'six-atom-shot-anim.png', frames: 24, cols: 3, rows: 8, loop: true, blend: 'add', peakFrame: 16,
    },
  };
  for (const [path, want] of Object.entries({ ...withPeak, ...sheets })) {
    const meta = read(path);
    assert.equal(meta.file, want.file, path);
    assert.equal(meta.frames, want.frames, path);
    assert.equal(meta.loop, want.loop, path);
    assert.equal(meta.blend, want.blend, path);
    assert.equal(meta.black, 16, path);
    assert.equal(meta.hit, false, path);
    if (want.anchor) assert.equal(meta.anchor, want.anchor, path);
    if (want.once) assert.equal(meta.once, true, path);
    if (want.pivot) assert.equal(meta.pivot, want.pivot, path);
    if (want.cols) assert.equal(meta.cols, want.cols, path);
    if (want.rows) assert.equal(meta.rows, want.rows, path);
    if (want.holdAt != null) assert.equal(meta.holdAt, want.holdAt, path);
    if (want.breakFrom != null) assert.equal(meta.breakFrom, want.breakFrom, path);
    assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.file)), true, meta.file);
    if (want.peakFrame != null) {
      assert.equal(meta.peakFrame, want.peakFrame, path);
      assert.equal(fs.existsSync(path.replace(/fx\.json$/, meta.peak)), true, meta.peak);
    } else {
      assert.equal(meta.peak, undefined, path);
    }
  }
  const can = read('assets/fx/liv/hohlraum/fx.json');
  assert.equal(can.burst.file, 'fusion-ignition-blast-anim.png');
  assert.equal(can.burst.scale, 0.6);
  assert.equal(can.burst.blend, 'add');
  assert.equal(fs.existsSync('assets/fx/liv/hohlraum/fusion-ignition-blast-anim.png'), true);
  assert.equal(read('assets/fx/liv/192-beams/fx.json').scaleWith, 'radius');
  assert.equal(fs.existsSync('assets/fx/liv/192-beams/ignition-beams-sheet.png'), false);
});

test('call 6 wires Smoky Haze, Brock fumes, and the Tess peak stills', () => {
  const haze = read('assets/fx/tess/smoky-haze/fx.json');
  assert.equal(haze.file, 'smoky-haze-anim.png');
  assert.equal(haze.frames, 24);
  assert.equal(haze.loop, true);
  assert.equal(haze.blend, 'screen');
  assert.equal(haze.black, 16);
  assert.equal(haze.anchor, 'body');
  assert.equal(haze.peakFrame, 13);
  assert.equal(fs.existsSync('assets/fx/tess/smoky-haze/smoky-haze-anim.png'), true);
  assert.equal(fs.existsSync('assets/fx/tess/smoky-haze/smoky-haze.jpg'), true);

  const screen = read('assets/fx/brock/red-fume-screen/fx.json');
  assert.equal(screen.file, 'fume-screen-anim.png');
  assert.equal(screen.frames, 24);
  assert.equal(screen.cols, 6);
  assert.equal(screen.rows, 4);
  assert.equal(screen.loop, true);
  assert.equal(screen.blend, 'screen');
  assert.equal(screen.anchor, 'front');
  assert.equal(screen.peak, undefined);
  assert.equal(fs.existsSync('assets/fx/brock/red-fume-screen/fume-screen-anim.png'), true);

  const dye = read('assets/fx/brock/tyrian-purple/fx.json');
  assert.equal(dye.file, 'tyrian-splash-anim.png');
  assert.equal(dye.frames, 24);
  assert.equal(dye.loop, false);
  assert.equal(dye.once, true);
  assert.equal(dye.blend, 'screen');
  assert.equal(dye.pivot, 'left');
  assert.equal(dye.peak, undefined);
  assert.equal(fs.existsSync('assets/fx/brock/tyrian-purple/tyrian-splash-anim.png'), true);

  const stench = read('assets/fx/brock/bromos-stench/fx.json');
  assert.equal(stench.peak, 'stench-fume-burst.jpg');
  assert.equal(stench.peakFrame, 18);
  assert.equal(fs.existsSync('assets/fx/brock/bromos-stench/stench-fume-burst.jpg'), true);

  assert.equal(fs.existsSync('assets/fx/krypto/excimer-laser/fx.json'), false);
  assert.equal(fs.existsSync('assets/fx/brock/caustic-splash/fx.json'), false);
});
