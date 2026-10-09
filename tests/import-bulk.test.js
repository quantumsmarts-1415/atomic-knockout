import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { walkStretch, clipPadding, padBox, inkMargin } from '../tools/import-lib.js';
import { inspectFolder, importAll } from '../tools/import-all.js';
import { parseBuildout, draftFighter } from '../tools/draft-fighters.js';

function filled(w, h) {
  const png = new PNG({ width: w, height: h });
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = (y * w + x) << 2;
      png.data[i] = 180;
      png.data[i + 1] = 40;
      png.data[i + 2] = 40;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

test('a squashed walk is stretched to the idle body proportion', () => {
  const idle = [filled(48, 140)];
  const walk = [filled(48, 80)];
  const mul = walkStretch(idle, walk);
  assert.ok(mul > 1.4 && mul <= 1.8, `stretch ${mul}`);
});

test('a walk that already matches idle is left alone', () => {
  const idle = [filled(40, 100)];
  const walk = [filled(42, 104)];
  assert.equal(walkStretch(idle, walk), 1);
});

test('attack padding keeps ink off the frame edge and soles sit above the bottom', () => {
  const attack = clipPadding('attack', 180, 140);
  assert.ok(attack.left >= 14 && attack.right >= 14);
  assert.ok(attack.bottom >= attack.left);
  const padded = padBox([filled(20, 30)], attack);
  const margin = inkMargin(padded[0]);
  assert.ok(margin.left >= 14 && margin.right >= 14, JSON.stringify(margin));
  assert.ok(margin.bottom >= 8, JSON.stringify(margin));

  const idle = clipPadding('idle', 80, 140);
  assert.equal(idle.bottom, 8);
  assert.ok(idle.left < idle.bottom);
});

test('import-all skips an incomplete folder and names what is missing', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ak-import-'));
  const sprites = path.join(root, 'sprites');
  mkdirSync(path.join(sprites, 'half'), { recursive: true });
  writeFileSync(path.join(sprites, 'half', 'idle.png'), '');
  mkdirSync(path.join(sprites, 'ready'));
  for (const clip of ['idle', 'walk', 'attack']) {
    writeFileSync(path.join(sprites, 'ready', `${clip}.png`), '');
  }
  writeFileSync(path.join(sprites, 'ready', 'manifest.json'), '{}');
  const metaDir = path.join(root, 'fighters');
  mkdirSync(metaDir);
  writeFileSync(path.join(metaDir, 'ready.json'), '{}');
  try {
    const half = inspectFolder(path.join(sprites, 'half'), { metaDir });
    assert.equal(half.ok, false);
    assert.ok(half.missing.includes('walk.png'));
    assert.ok(half.missing.includes('attack.png'));
    assert.ok(half.missing.includes('manifest.json'));
    assert.ok(half.missing.includes('fighters/half.json'));

    const report = importAll(sprites, { metaDir, dryRun: true });
    assert.deepEqual(report.imported.map((r) => r.id), ['ready']);
    assert.deepEqual(report.skipped.map((r) => r.id), ['half']);
    assert.equal(report.failed.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const SNIPPET = `
-Tantalum
	Name: Tara
	Natural State: Solid
	Density: 16.678 g/cm³
	Hardness (Kinetic Attack): Mohs 6.5
	Tensile Strength (Kinetic Defense): ~200 MPa
	Boiling Point: 5731 K
	Electrical conductivity: 7.7 MS/m
	Electronegativity: 1.5
	Charge Move: "Capacitor Dump" A discharge. (draft)
-Tungsten
	Name: Wolf
	Natural State: Solid
	Density: 19.254 g/cm³
	Hardness (Kinetic Attack): Mohs 7.5
	Tensile Strength (Kinetic Defense): ~550-620 MPa
	Boiling Point: 6203 K
	Electrical conductivity: 20 MS/m
	Electronegativity: 2.36
	Charge Move: "White-Hot Filament" Heat. (draft)
-Helium
	Name: Helen
	Natural State: Gas
	Density: 0.0001786 g/cm³ (0.1786 g/L at STP)
	Hardness (Kinetic Attack): 0 (gas)
	Tensile Strength (Kinetic Defense): 0 (gas)
	Boiling Point: 4.22 K
	Electrical conductivity: N/A (gas; ≈0, insulator)
	Electronegativity: none
	Charge Move: "Air Wave" A push. (draft)
-Carbon
	Name: Carter
	Natural State: Solid
	Density: 2.266 g/cm³ (graphite) / 3.515 g/cm³ (diamond)
	Hardness (Kinetic Attack): Mohs 10 (diamond), 0.5 (graphite)
	Tensile Strength (Kinetic Defense): ~15 MPa (graphite)
	Boiling Point: 3915 K (sublimes; no liquid at normal pressure)
	Electrical conductivity: 0.1 MS/m (graphite) / ≈0 (diamond, insulator)
	Electronegativity: 2.55
	Charge Move: "Diamond Shard" A shard. (draft)
-Francium
	Name: Frank
	Natural State: Solid (presumed; never seen in bulk)
	Density: 2.458 g/cm³ (estimated)
	Hardness (Kinetic Attack): 0 (no data, no modifier)
	Tensile Strength (Kinetic Defense): 0 (no data, no modifier)
	Boiling Point: (no published value)
	Electrical conductivity: 0.33 MS/m (calculated)
	Electronegativity: 0.7 (estimated; some sources say just above 0.79)
	Charge Move: "Beta Turn" A change. (draft)
`;

test('the buildout draft matches the element numbers and picks tank air jumps', () => {
  const rows = Object.fromEntries(parseBuildout(SNIPPET).map((r) => [r.id, r]));
  assert.equal(rows.tara.elementData.density, 16.678);
  assert.equal(rows.tara.elementData.mohs, 6.5);
  assert.equal(rows.tara.symbol, 'Ta');
  assert.equal(rows.tara.atomicNumber, 73);
  assert.equal(rows.wolf.elementData.tensile, 585);
  assert.equal(rows.helen.elementData.conductivity, 0);
  assert.equal(rows.helen.elementData.en, null);
  assert.equal(rows.helen.elementData.noble, true);
  assert.equal(rows.carter.elementData.density, 2.266);
  assert.equal(rows.carter.elementData.mohs, 10);
  assert.equal(rows.carter.elementData.tensile, 15);
  assert.equal(rows.frank.elementData.boiling, null);
  assert.equal(rows.frank.elementData.en, 0.7);
  const tara = draftFighter(rows.tara);
  const helen = draftFighter(rows.helen);
  assert.equal(tara.airJumps, 0);
  assert.equal(helen.airJumps, 1);
  assert.equal(tara.tagline, 'Capacitor Dump');
  assert.ok(tara.palettes.length >= 1);
  assert.equal(tara.elementData.family, 'transition');
});
