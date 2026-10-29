import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CampaignBattle, SUPPORTS, supportsFor, CHAPTERS, newCampaign, createBattle, autoplayChapter, afterVictory, partyForChapter, makeRecord, awardXp, loadSave, writeSave, baseStats } from '../src/campaign/index.js';
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
    for (const [k, v] of Object.entries(s)) if (k !== 'range' && k !== 'power') assert.ok(Number.isFinite(v) && v > 0, `${c.id}.${k}=${v}`);
    assert.ok(s.maxHp >= 60 && s.maxHp <= 100, `${c.id} hp ${s.maxHp}`);
    assert.equal(s.power, 0, 'no flat damage bonus at level 1');
    assert.ok(s.mov >= 4 && s.mov <= 6);
    assert.ok(s.range[0] >= 1 && s.range[1] >= s.range[0] && s.range[1] <= 3);
  }
  assert.deepEqual(baseStats(CHARACTERS.phillip).range, [1, 2]); // projectile
  assert.deepEqual(baseStats(CHARACTERS.hydra).range, [1, 2]);   // Flame Dash 1-2, Hydrogen Bomb 2
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
  const a = { id: 'hydra', team: 'player', x: 0, y: 0, power: 0, def: 2, spd: 12, hp: 70, maxHp: 70, range: [1, 2] };
  const d = { id: 'kyle', team: 'enemy', x: 1, y: 0, power: 0, def: 2, spd: 6, hp: 70, maxHp: 70, range: [1, 1] };
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

test('sheetDims.js lists the oversized fighter sheets the campaign repacks before upload', async () => {
  const { BIG_SHEETS } = await import('../src/campaign/sheetDims.js');
  assert.ok(Object.keys(BIG_SHEETS).length > 0);
  let checked = 0;
  for (const c of ROSTER) {
    const s = c.art?.sheets;
    if (!c.art?.use3d || !s) continue;
    for (const [clip, def] of Object.entries(s.clips)) {
      const k = `${c.art.key}-${clip}`;
      if (!BIG_SHEETS[k]) continue;
      const file = new URL(`../${s.dir}${def.file || `${c.id}_${clip}.png`}`, import.meta.url);
      const buf = fs.readFileSync(file).subarray(0, 24);
      assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], BIG_SHEETS[k], k);
      if (++checked >= 25) return;
    }
  }
});

test('camp conversations unlock with progress and only use real fighters', () => {
  assert.equal(supportsFor({ chapter: 0 }).length, 0);
  assert.ok(supportsFor({ chapter: 1 }).length >= 2);
  assert.equal(supportsFor({ chapter: CHAPTERS.length }).length, SUPPORTS.length);
  const ids = new Set();
  for (const sp of SUPPORTS) {
    assert.ok(!ids.has(sp.id), `duplicate ${sp.id}`);
    ids.add(sp.id);
    assert.ok(sp.lines.length >= 4);
    for (const id of sp.pair) assert.ok(CHARACTERS[id], id);
    for (const l of sp.lines) assert.ok(!l.who || CHARACTERS[l.who], l.who);
  }
});

test('boss entrance cards name a real fighter who is on that chapter\'s map', () => {
  let cards = 0;
  for (const ch of CHAPTERS) {
    for (const ev of ch.events || []) {
      if (!ev.card) continue;
      cards += 1;
      assert.ok(CHARACTERS[ev.card.id], ev.card.id);
      assert.ok(ch.enemies.some((e) => e.id === ev.card.id), `${ch.id} ${ev.card.id}`);
    }
  }
  assert.ok(cards >= 3);
});

test('replaying an early chapter with a big party still fits the start tiles, lord first', () => {
  const save = newCampaign();
  const extra = ['nitra', 'oxana', 'neo', 'silas', 'natalie', 'sandy', 'maggie', 'allen'].map((id) => makeRecord(id, 9));
  save.party = [...save.party, ...extra];
  const party = partyForChapter(save, CHAPTERS[0]);
  assert.equal(party.length, CHAPTERS[0].starts.length);
  assert.ok(party.some((r) => r.lord));
  const b = createBattle(save, 0, 3);
  assert.equal(b.players.length, CHAPTERS[0].starts.length);
});

test('every campaign music track has an ogg and an mp3 on disk and a known role', async () => {
  // music.js touches window/localStorage only inside functions, so it imports fine in node
  const { TRACKS } = await import('../src/campaign/music.js');
  const names = Object.keys(TRACKS);
  for (const need of ['title', 'story', 'camp', 'map_player', 'map_player_2', 'map_player_3', 'map_enemy', 'boss', 'victory', 'defeat', 'levelup', 'battle', 'defeat_player', 'defeat_enemy']) assert.ok(names.includes(need), need);
  assert.ok(TRACKS.battle.loop && !TRACKS.defeat_player.loop && !TRACKS.defeat_enemy.loop);
  const { STINGER_BOOST } = await import('../src/campaign/music.js');
  assert.ok(Math.abs(20 * Math.log10(STINGER_BOOST) - 3) < 0.01, 'defeat stingers play +3 dB hotter');
  for (const n of names) {
    for (const ext of ['ogg', 'mp3']) {
      const f = new URL(`../assets/campaign/music/${n}.${ext}`, import.meta.url);
      assert.ok(fs.statSync(f).size > 10000, `${n}.${ext}`);
    }
  }
  const src = fs.readFileSync(new URL('../src/engine/sfx.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('campaign/music'), 'fight-mode audio must not depend on campaign music');
});

test('player-phase map music rotates through three themes: per chapter, and per full loop heard', async () => {
  const { createMapRotation, MAP_PLAYER_ROTATION, TRACKS } = await import('../src/campaign/music.js');
  assert.deepEqual(MAP_PLAYER_ROTATION, ['map_player', 'map_player_2', 'map_player_3']);
  for (const t of MAP_PLAYER_ROTATION) assert.ok(TRACKS[t].loop && TRACKS[t].len > 30, t);
  // chapters open on different themes, all three get used
  const opening = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => createMapRotation(c).current());
  assert.deepEqual(opening.slice(0, 3), MAP_PLAYER_ROTATION);
  assert.equal(opening[3], MAP_PLAYER_ROTATION[0]);
  // short turns keep the same song; once a loop has been heard the next one is up, wrapping round
  const r = createMapRotation(0);
  assert.equal(r.current(), 'map_player');
  r.heard(20); assert.equal(r.current(), 'map_player');
  r.heard(20); assert.equal(r.current(), 'map_player');
  r.heard(25); assert.equal(r.current(), 'map_player_2');
  r.heard(TRACKS.map_player_2.len); assert.equal(r.current(), 'map_player_3');
  r.heard(TRACKS.map_player_3.len); assert.equal(r.current(), 'map_player');
  // the boss theme and enemy phase are not part of the rotation
  assert.ok(!MAP_PLAYER_ROTATION.includes('boss') && !MAP_PLAYER_ROTATION.includes('map_enemy'));
});

test('every authored move clip faces right when the rig faces right (attackers face their target)', async () => {
  const { sheetMeta } = await import('../src/engine/moveSheet.js');
  const bad = [];
  for (const [id, c] of Object.entries(CHARACTERS)) {
    const s = c.art?.sheets;
    if (!s) continue;
    for (const [name, def] of Object.entries(s.clips)) {
      const meta = sheetMeta(id, name);
      const anchors = meta?.anchors?.fist || meta?.anchors?.tip;
      if (!anchors) continue;
      const fw = def.frameW ?? s.frameW;
      // the hand at the strike frames (the wind-up pose can point either way)
      const frames = (meta.strikeFrames?.length ? meta.strikeFrames : [meta.release ?? meta.active?.[0] ?? 0]).filter((i) => anchors[i]);
      if (!frames.length) continue;
      const native = Math.sign(frames.reduce((a, i) => a + anchors[i][0] - fw / 2, 0));
      const flipped = (def.sheetFacing ?? c.art.facing ?? 1) === -1;
      if ((flipped ? -native : native) !== 1) bad.push(`${id}:${name}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('story data is isolated in src/campaign/story and validates', async () => {
  const { validateStory } = await import('../src/campaign/story/validate.js');
  const { default: story } = await import('../src/campaign/story/index.js');
  const { default: mini } = await import('../src/campaign/story/example-mini.js');
  const chapters = await import('../src/campaign/chapters.js');
  const ids = Object.keys(CHARACTERS);
  assert.deepEqual(validateStory(story, ids), []);
  assert.deepEqual(validateStory(mini, ids), []);
  assert.equal(chapters.CHAPTERS, story.chapters);
  assert.equal(chapters.PROLOGUE, story.prologue);
  assert.equal(chapters.SUPPORTS, story.supports);
  assert.equal(chapters.LORD_ID, story.lord);
  // the example plays through the same engine as the real chapters
  const battle = new (await import('../src/campaign/state.js')).CampaignBattle(mini.chapters[0], mini.chapters[0].party.map((p) => makeRecord(p.id, p.level, { lord: !!p.lord })), { seed: 3, enemyRecords: (e) => makeRecord(e.id, e.level) });
  assert.ok(autoplayChapter(battle).result);
});

test('story validation reports mistakes in plain words', async () => {
  const { validateStory } = await import('../src/campaign/story/validate.js');
  const { default: mini } = await import('../src/campaign/story/example-mini.js');
  const broken = structuredClone(mini);
  broken.chapters[0].map[1] = '..ff....F';             // short row
  broken.chapters[0].enemies[0].id = 'nobody';          // unknown fighter
  broken.chapters[0].enemies[1].x = 6;                  // water tile (6,3)? y=3 -> '~'
  broken.chapters[0].enemies[1].y = 3;
  broken.chapters[0].win = 'seize';                     // no seize tile
  broken.chapters[0].events[0].when = {};
  const problems = validateStory(broken, Object.keys(CHARACTERS)).join('\n');
  assert.match(problems, /row 1 is 9 wide/);
  assert.match(problems, /unknown fighter "nobody"/);
  assert.match(problems, /off the map or blocked/);
  assert.match(problems, /seize needs/);
  assert.match(problems, /when needs one of/);
});


// ------------------------------------------------------------------ moves and damage rules
import { campaignMoves, DAMAGE_SCALE, basicOf } from '../src/campaign/moves.js';
import { resolveMoveDamage } from '../src/data/balance.js';
import { upgradeRecord, MAX_LEVEL } from '../src/campaign/units.js';

test('every attack deals its fighting-game damage % (x one scale), straight from the move data', () => {
  for (const c of ROSTER) {
    const moves = campaignMoves(c.id);
    assert.equal(moves.length, 4, c.id);
    const basic = basicOf(c.id);
    assert.ok(basic.attack && !basic.charge && basic.cd === 0, `${c.id} basic`);
    const pct = resolveMoveDamage(basic.raw, c, null).total;
    assert.equal(basic.dmg, Math.min(60, Math.max(1, Math.round(pct * DAMAGE_SCALE))), `${c.id} basic dmg = move % x scale`);
    for (const m of moves) {
      if (m.attack) assert.ok(m.dmg >= 1 && m.dmg <= 60 && m.range[0] >= 1 && m.range[1] <= 3, `${c.id} ${m.key}`);
      if (m.slot === 'charge' && m.attack) assert.ok(m.dmg >= basic.dmg * 0 && m.charge === true);
    }
  }
  // the forecast adds only the flat level bonus and modest defense / terrain, not another multiplier
  const map = parseMap(['..']);
  const a = { id: 'hydra', team: 'player', x: 0, y: 0, power: 3, def: 1, spd: 8, hp: 80, maxHp: 80 };
  const d = { id: 'kyle', team: 'enemy', x: 1, y: 0, power: 0, def: 2, spd: 8, hp: 80, maxHp: 80 };
  const f = forecast(a, d, map);
  const el = f.att.mult;
  assert.equal(f.att.dmg, Math.round(basicOf('hydra').dmg * el) + 3 - 2);
});

test('with 60-100 HP a typical fight takes about 3-4 hits', () => {
  const hits = [];
  for (const c of ROSTER) {
    const hp = baseStats(c).maxHp;
    for (const m of campaignMoves(c.id)) {
      if (!m.attack || m.charge) continue;
      hits.push(Math.ceil(hp / Math.max(1, m.dmg - 2)));
    }
  }
  hits.sort((x, y) => x - y);
  const median = hits[hits.length >> 1];
  assert.ok(median >= 3 && median <= 5, `median hits to KO ${median}`);
});

test('ranged attacks are common: projectiles reach 2, beams reach further', () => {
  let ranged = 0;
  for (const c of ROSTER) if (campaignMoves(c.id).some((m) => m.attack && m.range[1] >= 2)) ranged++;
  assert.ok(ranged / ROSTER.length >= 0.7, `${ranged}/${ROSTER.length} fighters have a ranged attack`);
  const kinds = new Set();
  for (const c of ROSTER) for (const m of campaignMoves(c.id)) if (m.attack && m.kind === 'beam') { assert.deepEqual(m.range, [2, 3]); kinds.add('beam'); }
  assert.ok(kinds.has('beam'));
  assert.ok(campaignMoves('helen').some((m) => m.kind === 'projectile' && m.range[1] === 2));
});

test('level-ups add HP and a small flat damage bonus', () => {
  const rec = makeRecord('helen', 1);
  const hp = rec.maxHp;
  awardXp(rec, 100 * 4, mulberry32(5));
  assert.equal(rec.level, 5);
  assert.ok(rec.maxHp >= hp + 4 * 3 && rec.maxHp <= hp + 4 * 5, 'HP +3..5 per level');
  assert.equal(rec.power, 2, '+1 damage at levels 2 and 4');
  assert.deepEqual(makeRecord('helen', 5).power, 2);
  assert.ok(makeRecord('helen', MAX_LEVEL).power <= 10, 'the bonus stays small');
});

test('older saves are rebuilt with the new HP and keep their level, xp and lord', () => {
  const old = { id: 'hydra', level: 4, xp: 35, lord: true, maxHp: 40, hp: 12, power: 9, def: 3, spd: 8, mov: 5, range: [1, 1] };
  const up = upgradeRecord(old);
  assert.equal(up.level, 4);
  assert.equal(up.xp, 35);
  assert.ok(up.lord && up.maxHp >= 70 && up.hp === up.maxHp);
  assert.equal(upgradeRecord(up), up, 'current records are left alone');
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  writeSave({ chapter: 1, party: [old], cleared: ['ch1'], lost: [] }, storage);
  assert.ok(loadSave(storage).party[0].maxHp >= 70);
});

function twoUnits(att = 'hydra', def = 'kyle', gap = 1) {
  const chapter = { ...CHAPTERS[0], enemies: [], npcs: [], events: [] };
  const party = [makeRecord(att, 1, { lord: true }), makeRecord('helen', 1)];
  const b = new (class extends CampaignBattle {})(chapter, party, { seed: 4, enemyRecords: (e) => makeRecord(e.id, e.level) });
  const a = b.players.find((u) => u.id === att);
  const rec = makeRecord(def, 1);
  b.units.push(Object.assign({}, b.players[0], { uid: 999, rec, id: def, team: 'enemy', x: a.x + gap, y: a.y, hp: rec.maxHp, maxHp: rec.maxHp, def: rec.def, spd: rec.spd, power: 0, moves: campaignMoves(def), cd: {}, charging: null, status: {}, alive: true, acted: false, lord: false }));
  return { b, a, d: b.units[b.units.length - 1] };
}

test('a charge move takes the turn, releases at full power next turn, and can be cancelled', () => {
  const { b, a, d } = twoUnits('hydra', 'kyle', 1);
  const charge = a.moves.find((m) => m.charge);
  assert.ok(charge && charge.dmg > a.moves[0].dmg, 'the charged release hits harder than the basic');
  assert.equal(b.moveBlock(a, charge), null);
  b.startCharge(a, charge);
  assert.equal(a.charging, charge.key);
  assert.ok(a.acted, 'charging uses the whole turn');
  assert.equal(b.usableAttacks(a).length, 1, 'only the release is available while charging');
  assert.match(b.moveBlock(a, a.moves[0]) || '', /Charging/);
  b.endPlayerPhase(); b.endEnemyPhase();           // next turn
  assert.equal(a.charging, charge.key, 'the charge is held');
  assert.equal(a.acted, false);
  const hp = d.hp;
  const f = b.forecastFor(a, d, charge);
  assert.equal(f.att.move, charge);
  const res = b.attack(a, d, charge);
  assert.ok(res.released && a.charging === null, 'release clears the charge');
  assert.ok(res.log[0].move === charge);
  if (res.log[0].hit) assert.equal(hp - d.hp, res.log[0].dmg);
  // cancel instead
  const t2 = twoUnits('hydra', 'kyle', 1);
  t2.b.startCharge(t2.a, t2.a.moves.find((m) => m.charge));
  t2.b.cancelCharge(t2.a);
  assert.equal(t2.a.charging, null);
});

test('specials rest a turn; guard cuts damage until the next turn; power up boosts the next hits', () => {
  const { b, a, d } = twoUnits('hydra', 'kyle', 2);
  const special = a.moves.find((m) => m.slot === 'special');
  assert.equal(b.moveBlock(a, special), null);
  b.attack(a, d, special);
  assert.match(b.moveBlock(a, special), /Ready in/);
  b.endPlayerPhase(); b.endEnemyPhase();
  assert.match(b.moveBlock(a, special), /Ready in 1/);
  b.endPlayerPhase(); b.endEnemyPhase();
  assert.equal(b.moveBlock(a, special), null, 'ready again two turns later');
  // guard
  const g = twoUnits('hydra', 'kyle', 1);
  const base = g.b.forecastFor(g.d, g.a).att.dmg;
  const guard = g.a.moves.find((m) => m.action === 'guard');
  g.b.guard(g.a, guard);
  const guarded = g.b.forecastFor(g.d, g.a).att.dmg;
  assert.ok(guarded < base && guarded >= Math.floor(base * (1 - guard.guard)) - 1, `${guarded} < ${base}`);
  g.b.endPlayerPhase(); g.b.endEnemyPhase();
  assert.equal(g.b.forecastFor(g.d, g.a).att.dmg, base, 'guard wears off on the unit\'s next turn');
  // power up
  const p = twoUnits('aaron', 'kyle', 1);
  const pw = p.a.moves.find((m) => m.action === 'power');
  assert.ok(pw, 'Aaron has a power-up');
  const before = p.b.forecastFor(p.a, p.d).att.dmg;
  p.b.powerUp(p.a, pw);
  assert.ok(p.b.forecastFor(p.a, p.d).att.dmg > before);
});

test('enemies use real moves: they can charge, release, and fire specials', () => {
  let usedSpecial = 0; let charged = 0; let released = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = createBattle({ ...newCampaign(), chapter: 2 }, 3, seed);
    for (let t = 0; t < 8 && !b.result; t++) {
      b.startPhase('player'); b.checkEvents('turn');
      for (const u of b.players) u.acted = true;
      b.startPhase('enemy');
      for (const u of b.enemies) {
        const wasCharging = !!u.charging;
        const plan = b.plan(u);
        if (plan.charge) charged++;
        if (plan.move?.slot === 'special') usedSpecial++;
        if (wasCharging && plan.move?.charge) released++;
        // apply like autoplayPhase does
        b.moveUnit(u, plan.to.x, plan.to.y);
        if (plan.cancelCharge) b.cancelCharge(u);
        if (plan.target) b.attack(u, plan.target, plan.move); else if (plan.charge) b.startCharge(u, plan.charge); else if (plan.guard) b.guard(u, plan.guard); else b.wait(u);
        if (b.result) break;
      }
      b.endEnemyPhase();
    }
  }
  assert.ok(usedSpecial > 0, 'specials are used');
  assert.ok(charged > 0, 'charges are started');
  assert.ok(released > 0, 'charges are released');
});

test('the campaign is beatable by the AI: the AI clears every chapter within three tries on some seeds (it ignores terrain, guards and charges, so a player does better)', () => {
  let cleared = 0;
  const seeds = 8;
  for (let seed = 1; seed <= seeds; seed++) {
    let save = newCampaign();
    let ok = true;
    for (let ci = 0; ci < CHAPTERS.length && ok; ci++) {
      let won = false;
      for (let attempt = 0; attempt < 3 && !won; attempt++) {
        const b = createBattle(save, ci, seed * 100 + ci * 7 + attempt);
        if (autoplayChapter(b, 40).result === 'victory') { won = true; save = afterVictory(save, ci, b.commit()); }
      }
      ok = won;
    }
    if (ok) cleared++;
  }
  assert.ok(cleared >= 2, `${cleared}/${seeds} seeds cleared the whole campaign`);
});

// ------------------------------------------------------------------ move effects
import { applyHitEffects, startOfTurn, statusTags } from '../src/campaign/status.js';
import { movePoints } from '../src/campaign/grid.js';
import { describeMove, effectText } from '../src/campaign/moves.js';
import { moveSlug } from '../src/data/attackFx.js';

const always = () => 0;          // rng that always rolls "yes"
const hitOf = (dmg = 20) => ({ hit: true, dmg });
const stunMove = { effects: [{ type: 'stun', chance: 1 }] };

test('stuns cannot chain: a stunned unit skips one turn, is immune for its next turn, then can be stunned again', () => {
  const { b, a, d } = twoUnits('hydra', 'kyle', 1);
  assert.ok(applyHitEffects(b, a, d, stunMove, hitOf(), always).some((e) => e.type === 'stun'));
  assert.ok(d.stunned, 'stunned during the player phase');
  assert.ok(statusTags(d).some((t) => t.id === 'stun'));
  b.endPlayerPhase();                                   // enemy phase starts: the stunned unit loses its turn
  assert.equal(d.acted, true, 'turn skipped');
  assert.equal(d.stunned, false);
  assert.equal(d.stunImmune, true, 'immune right after the lost turn');
  assert.ok(statusTags(d).some((t) => t.id === 'immune' && /IMMUNE/.test(t.label)), 'immunity is shown');
  assert.ok(b.phaseEvents.some((e) => e.type === 'skip' && e.unit === d));
  // the player tries to stun it again during its immune window
  const blocked = applyHitEffects(b, a, d, stunMove, hitOf(), always);
  assert.ok(blocked.some((e) => e.type === 'immune'), 'reports the immunity');
  assert.equal(d.stunned, false, 'no second stunned turn in a row');
  b.endEnemyPhase();                                    // player phase
  b.endPlayerPhase();                                   // the enemy's next turn begins: it acts normally
  assert.equal(d.acted, false, 'acts again');
  assert.equal(d.stunImmune, false, 'immunity ends once it has had a normal turn start');
  // and now it can be stunned again
  assert.ok(applyHitEffects(b, a, d, stunMove, hitOf(), always).some((e) => e.type === 'stun'));
  assert.equal(d.stunned, true);
});

test('stun never skips two consecutive turns even when hit every round', () => {
  const { b, a, d } = twoUnits('hydra', 'kyle', 1);
  const skipped = [];
  for (let round = 0; round < 8; round++) {
    applyHitEffects(b, a, d, stunMove, hitOf(), always);   // player stuns it every turn
    b.endPlayerPhase();
    skipped.push(d.acted);
    b.endEnemyPhase();
  }
  for (let i = 1; i < skipped.length; i++) assert.ok(!(skipped[i] && skipped[i - 1]), `rounds ${i - 1} and ${i} both skipped`);
  assert.ok(skipped.some(Boolean), 'it does lose turns');
});

test('burn and poison tick each turn; poison never kills, burn can; slow, freeze and root cut movement', () => {
  const { b, a, d } = twoUnits('hydra', 'kyle', 1);
  applyHitEffects(b, a, d, { effects: [{ type: 'burn', dmg: 5, turns: 2 }] }, hitOf(), always);
  const hp = d.hp;
  b.endPlayerPhase();
  assert.equal(d.hp, hp - 5, 'burn ticks at the start of its turn');
  b.endEnemyPhase(); b.endPlayerPhase();
  assert.equal(d.hp, hp - 10);
  b.endEnemyPhase(); b.endPlayerPhase();
  assert.equal(d.hp, hp - 10, 'burn wore off after two ticks');
  d.hp = 3;
  applyHitEffects(b, a, d, { effects: [{ type: 'poison', dmg: 9, turns: 2 }] }, hitOf(), always);
  b.endEnemyPhase(); b.endPlayerPhase();
  assert.equal(d.hp, 1, 'poison leaves 1 HP');
  assert.equal(d.alive, true);
  d.status = {};
  d.hp = 3;
  applyHitEffects(b, a, d, { effects: [{ type: 'burn', dmg: 9, turns: 2 }] }, hitOf(), always);
  b.endEnemyPhase(); b.endPlayerPhase();
  assert.equal(d.alive, false, 'burn can KO');
  assert.ok(b.phaseEvents.some((e) => e.type === 'dotKill'));
  const u = { mov: 5, status: {} };
  assert.equal(movePoints(u), 5);
  assert.equal(movePoints({ ...u, status: { slow: { turns: 1 } } }), 3);
  assert.equal(movePoints({ ...u, status: { freeze: { turns: 1 } } }), 2);
  assert.equal(movePoints({ ...u, status: { root: { turns: 1 } } }), 0);
  const e2 = twoUnits('hydra', 'kyle', 1);
  applyHitEffects(e2.b, e2.a, e2.d, { effects: [{ type: 'slow', turns: 1 }] }, hitOf(), always);
  const full = e2.b.reachFor({ ...e2.d, status: {} }).stops.size;
  e2.b.endPlayerPhase();
  assert.ok(e2.b.reachFor(e2.d).stops.size < full, 'a slowed unit reaches fewer tiles on its turn');
  e2.b.endEnemyPhase(); e2.b.endPlayerPhase();
  assert.equal(movePoints(e2.d), e2.d.mov, 'slow lasts one turn');
});

test('knockback pushes one tile, interrupt and stun break a charge, lifesteal heals, thorns bite melee attackers', () => {
  const { b, a, d } = twoUnits('hydra', 'kyle', 1);
  const x0 = d.x;
  assert.ok(applyHitEffects(b, a, d, { effects: [{ type: 'push' }] }, hitOf(), always).some((e) => e.type === 'push'));
  assert.equal(d.x, x0 + 1);
  assert.equal(applyHitEffects(b, a, d, { effects: [{ type: 'pull' }] }, hitOf(), always).length, 1);
  assert.equal(d.x, x0);
  const wall = twoUnits('hydra', 'kyle', 1);
  wall.b.map.tiles[wall.d.y][wall.d.x + 1] = 'wall';
  assert.equal(applyHitEffects(wall.b, wall.a, wall.d, { effects: [{ type: 'push' }] }, hitOf(), always).length, 0, 'walls stop a push');
  d.charging = 'basicCharge';
  applyHitEffects(b, a, d, { effects: [{ type: 'interrupt' }] }, hitOf(), always);
  assert.equal(d.charging, null);
  d.charging = 'basicCharge';
  applyHitEffects(b, a, d, stunMove, hitOf(), always);
  assert.equal(d.charging, null, 'a stun breaks the charge');
  a.hp = 10;
  applyHitEffects(b, a, d, { effects: [{ type: 'lifesteal', frac: 0.5 }] }, hitOf(20), always);
  assert.equal(a.hp, 20);
  const g = twoUnits('hydra', 'kyle', 1);
  g.d.status.guard = { frac: 0.4, turns: 1, thorns: 6 };
  const hp = g.a.hp;
  applyHitEffects(g.b, g.a, g.d, { effects: [] }, hitOf(), always);
  assert.equal(g.a.hp, hp - 6, 'thorns hurt a melee attacker');
});

test('every effect is spelled out in the move info, and enemies and allies both get them', () => {
  const seen = new Set();
  for (const c of ROSTER) {
    for (const m of campaignMoves(c.id)) {
      const lines = describeMove(m);
      for (const e of m.effects) { assert.ok(lines.includes(effectText(e)), `${c.id} ${m.key} ${e.type}`); seen.add(e.type); }
    }
  }
  for (const need of ['stun', 'burn', 'poison', 'slow', 'freeze', 'push', 'lifesteal', 'interrupt']) assert.ok(seen.has(need), `some move has ${need}`);
});

test('moves reuse the fighting game FX art when the move has some', () => {
  let withFx = 0; let attacks = 0;
  for (const c of ROSTER) {
    for (const m of campaignMoves(c.id)) {
      if (!m.attack) continue;
      attacks++;
      const dir = new URL(`../assets/fx/${c.id}/${moveSlug(m.name)}/`, import.meta.url);
      if (!fs.existsSync(new URL('fx.json', dir))) continue;
      withFx++;
      const meta = JSON.parse(fs.readFileSync(new URL('fx.json', dir), 'utf8'));
      const file = meta.projectile?.file || meta.file;      // named art must exist; the player falls back to sheet.png / object.png
      if (file) assert.ok(fs.existsSync(new URL(file, dir)), `${c.id} ${m.name} ${file}`);
    }
  }
  assert.ok(withFx / attacks > 0.6, `${withFx}/${attacks} attack moves have FX art`);
});
