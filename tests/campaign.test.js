import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHAPTERS, newCampaign, createBattle, autoplayChapter, afterVictory, partyForChapter, makeRecord, awardXp, loadSave, writeSave, baseStats } from '../src/campaign/index.js';
import { TERRAIN, TERRAIN_IDS } from '../src/campaign/terrain.js';
import { parseMap, reachable, key, distanceField } from '../src/campaign/grid.js';
import { forecast, resolve } from '../src/campaign/combat.js';
import { CHARACTERS, ROSTER } from '../src/data/characters.js';
import { mulberry32 } from '../src/engine/rng.js';

test('every terrain has a tile image on disk', () => {
  for (const id of TERRAIN_IDS) {
    assert.ok(fs.existsSync(new URL(`../assets/campaign/tiles/${id}.jpg`, import.meta.url)), id);
  }
});

test('chapter maps parse, units start on passable distinct tiles', () => {
  for (const ch of CHAPTERS) {
    const map = parseMap(ch.map);
    assert.equal(map.w, 16, ch.id);
    assert.equal(map.h, 10, ch.id);
    const seen = new Set();
    const ok = (x, y) => { const t = TERRAIN[map.tiles[y][x]]; return Number.isFinite(t.cost); };
    for (const [x, y] of ch.starts) { assert.ok(ok(x, y), `${ch.id} start ${x},${y}`); assert.ok(!seen.has(key(x, y))); seen.add(key(x, y)); }
    for (const e of ch.enemies) {
      assert.ok(CHARACTERS[e.id], e.id);
      assert.ok(ok(e.x, e.y), `${ch.id} enemy ${e.id}`);
      assert.ok(!seen.has(key(e.x, e.y)), `${ch.id} overlap ${e.id}`);
      seen.add(key(e.x, e.y));
    }
    assert.ok(ch.starts.length >= 10);
    assert.ok(CHAPTERS.length >= 6);
    if (ch.win === 'seize') assert.ok(ok(...ch.seize));
    if (ch.win === 'escape') for (const [x, y] of ch.exit) assert.ok(ok(x, y), `${ch.id} exit`);
    if (ch.win === 'defend') assert.ok(ch.turns >= 3);
    for (const n of ch.npcs || []) { assert.ok(CHARACTERS[n.id], n.id); assert.ok(ok(n.x, n.y), `${ch.id} npc ${n.id}`); assert.ok(!seen.has(key(n.x, n.y))); seen.add(key(n.x, n.y)); }
    for (const e of ch.events || []) for (const sp of e.spawn || []) assert.ok(CHARACTERS[sp.id], sp.id);
    for (const l of [...(ch.intro || []), ...(ch.outro || []), ...(ch.events || []).flatMap((e) => e.lines || [])]) assert.ok(l.who === null || CHARACTERS[l.who], `${ch.id} speaker ${l.who}`);
    if (ch.win === 'boss') assert.ok(ch.enemies.some((e) => e.boss));
    // everything is connected to the start area
    const field = distanceField(map, [{ x: ch.starts[0][0], y: ch.starts[0][1] }]);
    for (const e of ch.enemies) assert.ok(field.has(key(e.x, e.y)), `${ch.id} ${e.id} reachable`);
    if (ch.seize) assert.ok(field.has(key(...ch.seize)));
  }
});

test('stats derive sensibly for the whole roster', () => {
  for (const c of ROSTER) {
    const s = baseStats(c);
    for (const [k, v] of Object.entries(s)) if (k !== 'range') assert.ok(Number.isFinite(v) && v > 0, `${c.id}.${k}=${v}`);
    assert.ok(s.maxHp >= 15 && s.maxHp <= 45, `${c.id} hp ${s.maxHp}`);
    assert.ok(s.power >= 4 && s.power <= 20, `${c.id} pow ${s.power}`);
    assert.ok(s.mov >= 4 && s.mov <= 6);
    assert.ok(s.range[0] === 1 && s.range[1] >= 1 && s.range[1] <= 2);
  }
  assert.deepEqual(baseStats(CHARACTERS.phillip).range, [1, 2]); // projectile
  assert.deepEqual(baseStats(CHARACTERS.hydra).range, [1, 1]);
});

test('movement respects terrain cost, walls and enemy blockers', () => {
  const map = parseMap(['.f.~#', '.....', '..^..']);
  const u = { id: 'hydra', team: 'player', x: 0, y: 0, mov: 3, alive: true, range: [1, 1] };
  const r = reachable(map, u, [u]);
  assert.ok(r.stops.has('1,0'));            // forest costs 2
  assert.equal(r.all.get('1,0').cost, 2);
  assert.equal(r.all.get('2,2')?.cost, undefined, 'mountain (3) after 2 steps is out of reach');
  assert.equal(r.all.get('1,1').cost, 2, 'detour around the forest costs the same');
  assert.ok(!r.all.has('3,0'), 'water');
  assert.ok(!r.all.has('4,0'), 'wall');
  const foe = { id: 'kyle', team: 'enemy', x: 0, y: 1, mov: 3, alive: true, range: [1, 1] };
  const r3 = reachable(map, u, [u, foe]);
  assert.ok(!r3.all.has('0,1'), 'cannot pass through enemies');
  const ally = { id: 'helen', team: 'player', x: 1, y: 1, mov: 3, alive: true, range: [1, 1] };
  const r4 = reachable(map, u, [u, ally]);
  assert.ok(r4.all.has('1,1') && !r4.stops.has('1,1'), 'pass through allies but cannot stop on them');
});

test('forecast: terrain, double attack, counter range', () => {
  const map = parseMap(['....f', '.....']);
  const a = { id: 'hydra', team: 'player', x: 0, y: 0, power: 8, def: 2, spd: 12, hp: 20, maxHp: 20, range: [1, 1] };
  const d = { id: 'kyle', team: 'enemy', x: 1, y: 0, power: 8, def: 2, spd: 6, hp: 20, maxHp: 20, range: [1, 1] };
  const f = forecast(a, d, map);
  assert.equal(f.attHits, 2);
  assert.equal(f.defHits, 1);
  const onForest = forecast(a, { ...d, x: 4, y: 0 }, map);
  assert.equal(onForest.def, null, 'out of the defender melee range -> no counter');
  const archer = { ...a, range: [1, 2], x: 2, y: 0 };
  const far = forecast(archer, d, map);
  assert.equal(far.dist, 1);
  const farther = forecast({ ...archer, x: 3, y: 0 }, { ...d, x: 1, y: 0 }, map);
  assert.equal(farther.def, null, 'ranged attacker at range 2 is not countered by melee');
  const fortMap = parseMap(['.F']);
  const inFort = forecast({ ...a }, { ...d, x: 1, y: 0 }, fortMap);
  const onPlain = forecast({ ...a }, { ...d, x: 1, y: 0 }, parseMap(['..']));
  assert.ok(inFort.att.hit < onPlain.att.hit && inFort.att.dmg < onPlain.att.dmg);
});

test('resolve is deterministic for a seed and kills end the exchange', () => {
  const map = parseMap(['..']);
  const mk = () => [
    { id: 'hydra', team: 'player', x: 0, y: 0, power: 30, def: 2, spd: 10, hp: 20, maxHp: 20, range: [1, 1] },
    { id: 'kyle', team: 'enemy', x: 1, y: 0, power: 30, def: 2, spd: 10, hp: 5, maxHp: 5, range: [1, 1] },
  ];
  const [a1, d1] = mk(); const [a2, d2] = mk();
  const r1 = resolve(a1, d1, map, mulberry32(9));
  const r2 = resolve(a2, d2, map, mulberry32(9));
  assert.deepEqual(r1.log, r2.log);
  if (r1.log[0].killed) assert.equal(r1.log.length, 1);
});

test('xp levels units up and carries the remainder', () => {
  const rec = makeRecord('helen', 1);
  const hp = rec.maxHp;
  const ups = awardXp(rec, 250, mulberry32(3));
  assert.equal(rec.level, 3);
  assert.equal(rec.xp, 50);
  assert.equal(ups.length, 2);
  assert.ok(rec.maxHp > hp);
});

test('a chapter plays out: permadeath, result, progress carry-over', () => {
  let save = newCampaign();
  assert.equal(save.party.length, 6);
  assert.ok(save.party.some((r) => r.lord && r.id === 'hydra'));
  const b = createBattle(save, 0, 11);
  assert.equal(b.players.length, 6);
  assert.equal(b.enemies.length, CHAPTERS[0].enemies.length);
  const out = autoplayChapter(b, 40);
  assert.ok(['victory', 'defeat', 'timeout'].includes(out.result));
  for (const u of b.units) if (!u.alive) assert.equal(u.hp, 0);
  // find a seed that wins chapter 1, then confirm survivors and level carry over
  for (let seed = 1; seed < 60; seed++) {
    const w = createBattle(newCampaign(), 0, seed);
    const r = autoplayChapter(w, 40);
    if (r.result !== 'victory') continue;
    const survivors = w.commit();
    assert.equal(survivors.length, w.players.length);
    save = afterVictory(newCampaign(), 0, survivors);
    assert.equal(save.chapter, 1);
    const party = partyForChapter(save, CHAPTERS[1]);
    assert.ok(party.length >= survivors.length + 3, 'recruits join');
    assert.ok(party.every((p) => p.hp === p.maxHp), 'healed between chapters');
    for (const s of survivors) assert.ok(party.find((p) => p.id === s.id && p.level === s.level));
    return;
  }
  assert.fail('no seed won chapter 1 under autoplay');
});

test('lord death is defeat; routing the enemy is victory; seize wins chapter 2', () => {
  const b = createBattle(newCampaign(), 0, 4);
  b.units.find((u) => u.lord).alive = false;
  assert.equal(b.updateResult(), 'defeat');
  const c = createBattle(newCampaign(), 0, 4);
  for (const e of c.enemies) e.alive = false;
  assert.equal(c.updateResult(), 'victory');
  const save = { ...newCampaign(), chapter: 1 };
  const s = createBattle(save, 1, 4);
  const lord = s.units.find((u) => u.lord);
  assert.ok(!s.canSeize(lord));
  s.moveUnit(lord, ...CHAPTERS[1].seize);
  assert.ok(s.canSeize(lord));
  s.seize(lord);
  assert.equal(s.result, 'victory');
});

test('save slot round-trips', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  assert.equal(loadSave(storage), null);
  const s = newCampaign();
  writeSave(s, storage);
  assert.deepEqual(loadSave(storage), s);
});

test('campaign arc: 6-8 chapters with varied objectives and a prologue', async () => {
  const { PROLOGUE } = await import('../src/campaign/chapters.js');
  assert.ok(CHAPTERS.length >= 6 && CHAPTERS.length <= 8);
  const wins = new Set(CHAPTERS.map((c) => c.win));
  for (const w of ['rout', 'seize', 'boss', 'defend', 'escape']) assert.ok(wins.has(w), `objective ${w}`);
  assert.ok(PROLOGUE.lines.length >= 4);
  assert.ok(CHAPTERS.every((c) => c.intro.length >= 3 && c.outro.length >= 2));
});

test('defend wins when the turns run out; escape wins when the lord reaches the exit', () => {
  const save = newCampaign();
  const di = CHAPTERS.findIndex((c) => c.win === 'defend');
  const d = createBattle(save, di, 5);
  for (let i = 0; i < CHAPTERS[di].turns; i++) { assert.equal(d.result, null); d.endPlayerPhase(); d.endEnemyPhase(); }
  assert.equal(d.result, 'victory');
  const ei = CHAPTERS.findIndex((c) => c.win === 'escape');
  const e = createBattle(save, ei, 5);
  const lord = e.units.find((u) => u.lord);
  assert.ok(!e.canEscape(lord));
  e.moveUnit(lord, ...CHAPTERS[ei].exit[0]);
  assert.ok(e.canEscape(lord));
  e.escape(lord);
  assert.equal(e.result, 'victory');
});

test('events: turn spawns reinforcements, near-boss fires once, talk recruits an npc', () => {
  const save = newCampaign();
  const i3 = CHAPTERS.findIndex((c) => c.id === 'ch3');
  const b = createBattle(save, i3, 3);
  assert.equal(b.checkEvents('turn').length, 0);
  b.turn = 3;
  const fired = b.checkEvents('turn');
  assert.equal(fired.length, 1);
  assert.equal(fired[0].spawned.length, 2);
  assert.ok(fired[0].spawned.every((u) => u.team === 'player' && u.alive && !b.units.some((o) => o !== u && o.x === u.x && o.y === u.y)));
  assert.equal(b.checkEvents('turn').length, 0, 'events fire once');
  const titan = b.units.find((u) => u.id === 'titan');
  const p = b.players[0];
  b.moveUnit(p, titan.x, titan.y + 2);
  const near = b.checkEvents('move');
  assert.equal(near.length, 1);
  assert.ok(near[0].lines.some((l) => l.who === 'titan'));
  // talk
  const i2 = CHAPTERS.findIndex((c) => c.id === 'ch2');
  const c2 = createBattle({ ...save, chapter: i2 }, i2, 3);
  const flora = c2.units.find((u) => u.id === 'flora');
  assert.equal(flora.team, 'npc');
  assert.ok(!c2.targetsFrom(c2.players[0], flora.x, flora.y).includes(flora), 'npcs are not attackable');
  const talker = c2.players[0];
  c2.moveUnit(talker, flora.x + 1, flora.y);
  assert.deepEqual(c2.talkTargets(talker), [flora]);
  const r = c2.talk(talker, flora);
  assert.ok(r.lines.length >= 2);
  assert.equal(flora.team, 'player');
  assert.ok(c2.commit().some((rec) => rec.id === 'flora'));
});
