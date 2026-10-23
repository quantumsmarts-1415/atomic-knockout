import test from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STAGES, getStageBlast, getStageSpawns, getStageBounds, stageThumbFile, stagePreviewFile, getStageWorld, moverPosition, elevatorCycle } from '../src/data/stages.js';
import { buildNavGraph, jumpReach, reachableFrom, findPath, nodeAt } from '../src/engine/BotNav.js';
import { computeBotInput } from '../src/engine/BotAI.js';
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
    if (p.move?.stops) {
      // elevator: covers every height between its top and bottom stop
      out.push({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, y: Math.min(...p.move.stops), yLow: Math.max(...p.move.stops), solid: false, move: p.move });
      continue;
    }
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
    const wd = getStageWorld(st);
    assert.ok(b.left < 0 && b.right > wd.width && b.top < 0 && b.bottom > wd.height, `${st.id} blast zone must sit outside the screen/world`);
    for (const s of surfaces(st)) {
      assert.ok(s.x0 > b.left + 40 && s.x1 < b.right - 40, `${st.id} surface x ${s.x0}-${s.x1} too close to a side blast line`);
      assert.ok(s.y > b.top + 100 && (s.yLow ?? s.y) < b.bottom - 100, `${st.id} surface y ${s.y} too close to top/bottom blast`);
    }
  }
});

test('surfaces sit inside the visible play area (not under the HUD or off-screen)', () => {
  for (const st of STAGES) {
    if (st.camera) {
      // camera stages: inside the world, clear of its top sky and bottom edge
      const wd = getStageWorld(st);
      for (const s of surfaces(st)) {
        assert.ok(s.y >= wd.height * 0.25 && (s.yLow ?? s.y) <= wd.height - 150, `${st.id} surface at y ${s.y} too near the world's top/bottom`);
        assert.ok(s.x0 >= 0 && s.x1 <= wd.width, `${st.id} surface outside the world`);
      }
      continue;
    }
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
      assert.ok(sp.x >= 0 && sp.x <= getStageWorld(st).width, `${st.id} spawn ${i} off-screen`);
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
    const cx = getStageWorld(st).width / 2;
    assert.ok(Math.abs((a.x + b.x) / 2 - cx) <= 2 && a.y === b.y, `${st.id} P1/P2 spawns not mirrored`);
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
  // Every fighter shares one hop height. Heavy fighters have no air jump.
  const hop = reach.filter((r) => r.single >= 90);
  assert.strictEqual(hop.length, reach.length, 'the shared hop clears the stage floor');
  assert.ok(reach.some((r) => r.airJumps === 0), 'heavy fighters keep a single jump');
  const air = hop.filter((r) => r.airJumps > 0);
  // The painted spare (40px) is the launch roster's, whose shortest hop is
  // about 105px. Later air-jumpers between 90 and 100px still have to clear
  // the gap itself.
  const launchAir = air.filter((r) => r.single >= 100);
  const minAirReach = Math.min(...launchAir.map((r) => r.total));
  const minShortAir = Math.min(...air.map((r) => r.total));
  const minSingle = Math.min(...hop.map((r) => r.single));
  for (const st of STAGES.filter((s) => s.art)) {
    const surf = surfaces(st);
    for (const p of surf.filter((s) => !s.solid)) {
      // something to jump from: a lower surface overlapping or within a
      // short diagonal hop (120px) horizontally -- e.g. a tri-plat's top
      // platform is reached from the side platforms, not the floor
      const from = surf.filter((s) => s !== p && s.y > p.y && s.x1 > p.x0 - 120 && s.x0 < p.x1 + 120);
      assert.ok(from.length, `${st.id} platform at y ${p.y} has nothing under it`);
      const gap = Math.min(...from.map((s) => s.y - (p.yLow ?? p.y)));
      assert.ok(gap <= minAirReach - 40, `${st.id} platform gap ${gap} > launch air-jumper reach ${minAirReach.toFixed(0)} - 40`);
      assert.ok(gap <= minShortAir, `${st.id} platform gap ${gap} > shortest air-jumper reach ${minShortAir.toFixed(0)}`);
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
    if (st.camera) {
      // camera stages: par is a scrollFactor; layers + terrain are world-sized
      // (BattleScene's offset keeps a world-sized layer covering the view at
      // every zoom >= whole-world zoom, which needs the world at 16:9)
      const wd = getStageWorld(st);
      assert.strictEqual(wd.width * 9, wd.height * 16, `${st.id} world must be 16:9 for full zoom-out`);
      let prev = -1;
      for (const l of st.art.layers) {
        assert.ok(l.par >= 0 && l.par < 1 && l.par > prev, `${st.id} layer ${l.file} scrollFactor must rise 0..1 back to front`);
        prev = l.par;
        const sz = imageSize(readFileSync(join(root, st.art.dir + l.file)));
        assert.deepStrictEqual([sz.w, sz.h], [wd.width, wd.height], `${st.id} ${l.file} must be world-sized`);
      }
      const tz = imageSize(readFileSync(join(root, st.art.dir + st.art.terrain)));
      assert.deepStrictEqual([tz.w, tz.h], [wd.width, wd.height], `${st.id} terrain must be world-sized`);
      continue;
    }
    // fighters' midpoint rarely strays more than ~600px off-center, and the
    // scene also clamps the shift to the 80px painted margin
    for (const l of st.art.layers) assert.ok(l.par >= 0 && l.par * 600 <= 80, `${st.id} layer ${l.file} parallax would show its edge`);
  }
});

test('CPU ledge bounds stay over the ground', () => {
  for (const st of STAGES) {
    const b = getStageBounds(st);
    const wd = getStageWorld(st);
    assert.ok(b.minX < b.maxX && b.minX >= 0 - 1 && b.maxX <= wd.width + 1, `${st.id} bounds ${b.minX}-${b.maxX}`);
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
  const KNOWN = ['doors', 'warmup']; // keep in sync with engine/stageIntros.js STAGE_INTROS
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

// ------------------------------------------------------------ camera stages
const camStages = STAGES.filter((s) => s.camera);

test('camera stages opt in explicitly; every other stage stays a fixed 1280x720 screen', () => {
  assert.ok(camStages.length >= 1, 'expected a big camera stage (carbon-skyhook)');
  for (const st of STAGES) {
    if (!st.camera) {
      assert.ok(!st.world && !st.botNav, `${st.id}: world/botNav only make sense with a camera`);
      assert.deepStrictEqual(getStageWorld(st), { width: W, height: H });
      continue;
    }
    const wd = getStageWorld(st);
    // "MUCH bigger": at least 2x the screen both ways, and a playable floor
    // ~2x as wide as the normal stages' ~1000px
    assert.ok(wd.width >= 2 * W && wd.height >= 2 * H, `${st.id} world ${wd.width}x${wd.height} not 2x the screen`);
    const g = getStageBounds(st);
    assert.ok(g.maxX - g.minX >= 1800, `${st.id} floor only ${g.maxX - g.minX}px wide`);
    const tiers = new Set(surfaces(st).map((s) => s.y));
    assert.ok(tiers.size >= 8, `${st.id} needs many vertical layers (has ${tiers.size})`);
    const z = st.camera;
    assert.ok((z.maxZoom ?? 1) <= 1 && (z.minZoom ?? 0) <= W / wd.width, `${st.id} camera zoom range must allow the whole world`);
    assert.ok(st.botNav, `${st.id}: big stages need botNav so CPUs can climb`);
  }
});

test('moving platforms: sine movers unchanged; elevators dwell at every stop and stay on their track', () => {
  // the original sine formula (pre-elevator BattleScene) for every sine mover
  for (const st of STAGES) {
    for (const p of st.platforms.filter((q) => q.move && !q.move.stops)) {
      for (let t = 0; t < 20000; t += 137) {
        const off = Math.sin((t / p.move.period) * Math.PI * 2) * (p.move.range / 2);
        const want = p.move.axis === 'x' ? { x: p.x + off, y: p.y } : { x: p.x, y: p.y + off };
        assert.deepStrictEqual(moverPosition(p, t), want);
      }
    }
  }
  for (const st of STAGES) {
    for (const p of st.platforms.filter((q) => q.move?.stops)) {
      const { stops } = p.move;
      const cyc = elevatorCycle(p.move);
      assert.deepStrictEqual(moverPosition(p, 0), { x: p.x, y: p.y }, `${st.id} elevator starts where it's placed`);
      const parked = new Map(stops.map((s) => [s, 0]));
      let prev = moverPosition(p, 0).y;
      for (let t = 0; t < cyc.period; t += 10) {
        const { x, y } = moverPosition(p, t);
        assert.strictEqual(x, p.x);
        assert.ok(y >= Math.min(...stops) - 0.01 && y <= Math.max(...stops) + 0.01, `${st.id} elevator left its track (${y})`);
        // never faster than 2x its average speed (eased), so a rider can't be shaken off
        assert.ok(Math.abs(y - prev) <= (p.move.speed * 2 * 10) / 1000 + 0.01, `${st.id} elevator jumped ${Math.abs(y - prev)}px in 10ms`);
        prev = y;
        for (const s of stops) if (Math.abs(y - s) <= 3) parked.set(s, parked.get(s) + 10);
      }
      for (const [s, ms] of parked) assert.ok(ms >= p.move.dwell, `${st.id} elevator only parks ${ms}ms at y ${s}`);
    }
  }
});

test('big stages: every stop of an elevator is flush with a surface you can walk on/off at', () => {
  for (const st of camStages) {
    const nav = buildNavGraph(st);
    for (const L of nav.lifts) {
      for (const stop of L.stops) {
        assert.ok(stop.out.some((e) => e.type === 'exit'), `${st.id} lift stop y ${stop.y} has nowhere to step off`);
      }
    }
  }
});

test('big stages: bot nav graph -- everyone can climb every tier and always get back down', () => {
  for (const st of camStages) {
    const nav = buildNavGraph(st);
    const spawnNode = nodeAt(nav, st.spawns[0].x, st.groundY);
    assert.ok(spawnNode, `${st.id} P1 spawn not over a nav surface`);
    const solids = nav.nodes.filter((n) => n.kind === 'solid');
    const topY = Math.min(...nav.nodes.map((n) => n.y));
    for (const c of Object.values(CHARACTERS)) {
      const reach = jumpReach(c.stats);
      const r = reachableFrom(nav, spawnNode.id, reach);
      // every solid tier and the summit, for every character (tanks via
      // ledges/stairs/lift); air-jumpers reach literally everything
      for (const n of solids) assert.ok(r.has(n.id), `${st.id}: ${c.id} can't reach solid y ${n.y} x ${n.x0}-${n.x1}`);
      assert.ok(nav.nodes.some((n) => n.y === topY && n.kind !== 'stop' && r.has(n.id)), `${st.id}: ${c.id} can't reach the summit`);
      if (reach.airJumps > 0) assert.strictEqual(r.size, nav.nodes.length, `${st.id}: air-jumper ${c.id} misses ${nav.nodes.filter((n) => !r.has(n.id)).map((n) => n.y)}`);
      else assert.ok(r.size >= nav.nodes.length - 2, `${st.id}: ${c.id} reaches only ${r.size}/${nav.nodes.length}`);
      // no dead ends: from anywhere reachable there's a way back to the spawn floor
      for (const id of r) assert.ok(findPath(nav, id, spawnNode.id, reach), `${st.id}: ${c.id} stuck on node ${id}`);
    }
    // walk-offs/drops always land on something (never off the stage)
    for (const n of nav.nodes) {
      for (const e of n.out.filter((x) => x.type === 'walkoff' || x.type === 'drop')) {
        const B = nav.nodes[e.to];
        assert.ok(e.x >= B.x0 && e.x <= B.x1 && B.y > n.y, `${st.id}: ${e.type} from y ${n.y} at x ${e.x} misses its landing`);
      }
    }
  }
});

// minimal fighter stand-in for the pure CPU controller
function fakeFighter(charId, x, y, { grounded = true, vy = 0 } = {}) {
  return {
    x, y, alive: true, state: 'idle', charDef: CHARACTERS[charId], bodyW: 60, bodyH: 110,
    airJumpsLeft: CHARACTERS[charId].stats.airJumps,
    body: { blocked: { down: grounded, left: false, right: false }, touching: { down: false, left: false, right: false }, velocity: { x: 0, y: vy } },
  };
}

test('a bot above an opponent keeps dropping after their feet leave the platform', () => {
  const foe = fakeFighter('ruth', 700, 560);
  const bounds = { minX: 145, maxX: 1135 };
  const bot = fakeFighter('maggie', 640, 370);
  bot.scene = { rng: () => 0.5 };
  const grounded = computeBotInput(1000, bot, [bot, foe], bounds);
  assert.strictEqual(grounded.down, true);
  assert.strictEqual(grounded.jump, false);
  // One grounded frame used to sink a fraction of a pixel. The next frame
  // was airborne, so down released and the platform caught them again.
  bot.body.blocked.down = false;
  bot.y = 372;
  const falling = computeBotInput(1016, bot, [bot, foe], bounds);
  assert.strictEqual(falling.down, true);
  assert.strictEqual(falling.jump, false);
  const camper = fakeFighter('maggie', 640, 370);
  camper.scene = { rng: () => 0.5 };
  const started = computeBotInput(2800, camper, [camper, foe], bounds);
  assert.strictEqual(started.down, true);
  camper.body.blocked.down = false;
  camper.y = 372;
  const throughCharge = computeBotInput(3000, camper, [camper, foe], bounds);
  assert.strictEqual(throughCharge.down, true, 'scripted charge must not reseat the drop');
  camper._ai.dropUntil = 1000;
  const done = computeBotInput(4000, camper, [camper, foe], bounds);
  assert.strictEqual(!!done.down, false);
});

test('big-stage CPU: a tank heads for the lift to reach the summit; nobody walks into the void', () => {
  const st = STAGES.find((s) => s.id === 'carbon-skyhook');
  const nav = buildNavGraph(st);
  // Every heavy fighter shares the 140px hop, which clears the first gap.
  // Van takes that jump instead of walking around to the lift.
  const van = fakeFighter('van', 800, st.groundY);
  const foe = fakeFighter('hydra', 1065, 560);
  const inp = computeBotInput(1000, van, [van, foe], getStageBounds(st), nav);
  assert.ok(inp.left !== inp.right, 'heavy still paths toward the summit');
  assert.match(van._ai.lastEdge, /^jump/);
  // on the outer dock, target hanging off-stage to the left: hold the ledge
  const dockX = 280 + 24;
  const guard = fakeFighter('natalie', dockX, 1120);
  const off = fakeFighter('hydra', 120, 1150, { grounded: false, vy: 200 });
  for (let t = 0; t < 2000; t += 16) {
    const i = computeBotInput(t, guard, [guard, off], getStageBounds(st), nav);
    assert.ok(!i.left, 'must not walk off the outer ledge after an off-stage target');
  }
  // flat stages: unchanged controller (no nav -> never presses down)
  const flat = STAGES.find((s) => s.id === 'holdout-keep');
  const a = fakeFighter('natalie', 500, flat.groundY);
  const b2 = fakeFighter('sully', 800, flat.groundY);
  const fi = computeBotInput(1000, a, [a, b2], getStageBounds(flat));
  assert.ok(fi.down === undefined && fi.right, 'flat-stage CPU unchanged');
});
