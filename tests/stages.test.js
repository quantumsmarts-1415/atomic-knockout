import test from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STAGES, getStageBlast, getStageSpawns, getStageBounds, stageThumbFile, stagePreviewFile } from '../src/data/stages.js';
import { CHARACTERS } from '../src/data/characters.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1280;
const H = 720;
const GRAVITY = 1500;
const PLAT_H = 18;

// Every walkable top surface: ground/obstacle tops and soft platforms
// (moving platforms count at every point of their sweep).
function surfaces(st) {
  const out = st.solids.map((s) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, y: s.y ?? st.groundY, solid: true }));
  for (const p of st.platforms) {
    const r = p.move?.axis === 'x' ? p.move.range / 2 : 0;
    const ry = p.move?.axis === 'y' ? p.move.range / 2 : 0;
    out.push({ x0: p.x - p.w / 2 - r, x1: p.x + p.w / 2 + r, y: p.y - ry, yLow: p.y + ry, solid: false, move: p.move });
  }
  return out;
}

test('stage ids are unique and every stage has a name, layout geometry and ground', () => {
  const ids = new Set();
  for (const st of STAGES) {
    assert.ok(st.id && !ids.has(st.id), `duplicate/missing id ${st.id}`);
    ids.add(st.id);
    assert.ok(st.name && st.desc, `${st.id} needs name + desc`);
    assert.ok(st.solids.some((s) => s.h === undefined), `${st.id} needs at least one ground solid`);
    for (const p of st.platforms) assert.ok(p.w > 40, `${st.id} platform too narrow`);
  }
  assert.ok(STAGES.length >= 9, 'expected the 4 original + 5 painted stages');
});

test('blast zones enclose the screen and every solid/platform (incl. moving sweep)', () => {
  for (const st of STAGES) {
    const b = getStageBlast(st);
    assert.ok(b.left < 0 && b.right > W && b.top < 0 && b.bottom > H, `${st.id} blast zone must sit outside the screen`);
    for (const s of surfaces(st)) {
      assert.ok(s.x0 > b.left + 40 && s.x1 < b.right - 40, `${st.id} surface x ${s.x0}-${s.x1} too close to a side blast line`);
      assert.ok(s.y > b.top + 100 && (s.yLow ?? s.y) < b.bottom - 100, `${st.id} surface y ${s.y} too close to top/bottom blast`);
    }
  }
});

test('surfaces sit inside the visible play area (not under the HUD or off-screen)', () => {
  for (const st of STAGES) {
    for (const s of surfaces(st)) {
      assert.ok(s.y >= 200 && (s.yLow ?? s.y) <= 600, `${st.id} surface at y ${s.y} outside y 200-600`);
      assert.ok(s.x1 > 0 && s.x0 < W, `${st.id} surface entirely off-screen`);
    }
  }
});

test('every seat has a spawn that drops onto solid ground, inside the blast zone', () => {
  for (const st of STAGES) {
    const spawns = getStageSpawns(st);
    const b = getStageBlast(st);
    assert.ok(spawns.length >= 6, `${st.id} needs 6 spawns (one per seat)`);
    const solids = surfaces(st).filter((s) => s.solid);
    spawns.forEach((sp, i) => {
      assert.ok(sp.x > b.left && sp.x < b.right && sp.y > b.top && sp.y < b.bottom, `${st.id} spawn ${i} outside blast zone`);
      assert.ok(sp.x >= 0 && sp.x <= W, `${st.id} spawn ${i} off-screen`);
      // highest solid surface below the spawn point under its x
      const below = solids.filter((s) => sp.x >= s.x0 + 20 && sp.x <= s.x1 - 20 && s.y >= sp.y);
      assert.ok(below.length, `${st.id} spawn ${i} (x ${sp.x}) has no ground under it`);
      // and the respawn point (120px higher) still drops onto that ground
      assert.ok(sp.y - 120 > b.top + 40, `${st.id} spawn ${i} respawn point too close to the top blast line`);
    });
  }
});

test('1v1 spawns are mirrored around the stage center (fair start)', () => {
  for (const st of STAGES.filter((s) => s.spawns)) {
    const [a, b] = st.spawns;
    assert.ok(Math.abs((a.x + b.x) / 2 - 640) <= 2 && a.y === b.y, `${st.id} P1/P2 spawns not mirrored`);
  }
});

test('painted stages: platforms within reach of every air-jumper; solid steps hoppable by everyone', () => {
  // roster jump physics, same formula as the stages.js header notes
  const reach = Object.values(CHARACTERS).map((c) => {
    const g = GRAVITY * (c.stats.gravityScale ?? 1);
    const single = c.stats.jumpVelocity ** 2 / (2 * g);
    const air = (c.stats.airJumps ?? 0) > 0 ? (c.stats.jumpVelocity * 0.92) ** 2 / (2 * g) : 0;
    return { id: c.id, single, total: single + air, airJumps: c.stats.airJumps ?? 0 };
  });
  const minAirReach = Math.min(...reach.filter((r) => r.airJumps > 0).map((r) => r.total));
  const minSingle = Math.min(...reach.map((r) => r.single));
  for (const st of STAGES.filter((s) => s.art)) {
    const surf = surfaces(st);
    for (const p of surf.filter((s) => !s.solid)) {
      // something to jump from: a lower surface overlapping or within a
      // short diagonal hop (120px) horizontally -- e.g. a tri-plat's top
      // platform is reached from the side platforms, not the floor
      const from = surf.filter((s) => s !== p && s.y > p.y && s.x1 > p.x0 - 120 && s.x0 < p.x1 + 120);
      assert.ok(from.length, `${st.id} platform at y ${p.y} has nothing under it`);
      const gap = Math.min(...from.map((s) => s.y - (p.yLow ?? p.y)));
      assert.ok(gap <= minAirReach - 40, `${st.id} platform gap ${gap} > weakest air-jumper reach ${minAirReach.toFixed(0)} - 40`);
    }
    for (const s of st.solids.filter((x) => x.h !== undefined)) {
      assert.ok(s.h < minSingle - 15, `${st.id} solid step ${s.h}px tall walls off a ${minSingle.toFixed(0)}px jumper`);
    }
  }
});

test('stage art files exist (thumb/preview for all; layers/terrain for painted)', () => {
  for (const st of STAGES) {
    for (const f of [stageThumbFile(st), stagePreviewFile(st)]) assert.ok(existsSync(join(root, f)), `missing ${f}`);
    if (!st.art) continue;
    for (const l of st.art.layers) assert.ok(existsSync(join(root, st.art.dir + l.file)), `missing ${st.art.dir}${l.file}`);
    assert.ok(existsSync(join(root, st.art.dir + st.art.terrain)), `missing ${st.id} terrain`);
    if (st.platforms.some((p) => p.move)) assert.ok(st.art.movingPlatform && existsSync(join(root, st.art.dir + st.art.movingPlatform)), `${st.id} moving platform art`);
    // fighters' midpoint rarely strays more than ~600px off-center, and the
    // scene also clamps the shift to the 80px painted margin
    for (const l of st.art.layers) assert.ok(l.par >= 0 && l.par * 600 <= 80, `${st.id} layer ${l.file} parallax would show its edge`);
  }
});

test('CPU ledge bounds stay over the ground', () => {
  for (const st of STAGES) {
    const b = getStageBounds(st);
    assert.ok(b.minX < b.maxX && b.minX >= 0 - 1 && b.maxX <= W + 1, `${st.id} bounds ${b.minX}-${b.maxX}`);
  }
});

// JPEG/PNG pixel size without decoding (enough for asset sanity checks)
function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

test('stage intros: known type, art present; door halves exactly cover the 1280x720 screen', () => {
  const KNOWN = ['doors']; // keep in sync with engine/stageIntros.js STAGE_INTROS
  for (const st of STAGES.filter((s) => s.intro)) {
    assert.ok(KNOWN.includes(st.intro.type), `${st.id}: unknown intro type ${st.intro.type}`);
    assert.ok(st.art, `${st.id}: intro art loads from art.dir`);
    for (const f of Object.values(st.intro.art ?? {})) {
      const p = join(root, st.art.dir + f);
      assert.ok(existsSync(p), `missing ${st.art.dir}${f}`);
    }
    if (st.intro.type === 'doors') {
      const l = imageSize(readFileSync(join(root, st.art.dir + st.intro.art.doorLeft)));
      const r = imageSize(readFileSync(join(root, st.art.dir + st.intro.art.doorRight)));
      assert.deepStrictEqual([l.w + r.w, l.h, r.h], [W, H, H], `${st.id}: closed doors must cover the screen`);
      // opaque formats only (JPEG) so there can't be holes in the closed doors
      for (const f of [st.intro.art.doorLeft, st.intro.art.doorRight]) assert.match(f, /\.jpe?g$/, `${f} should be opaque`);
    }
  }
  assert.ok(STAGES.some((s) => s.intro), 'expected at least one stage intro (hydrogen-breakout)');
});
