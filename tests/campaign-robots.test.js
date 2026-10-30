// The robot enemies of the campaign: one shared body tinted per element, real element moves, waves, keys, freed elements.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CampaignBattle, makeRecord, freedFor } from '../src/campaign/index.js';
import { ROBOT_ART_READY, ROBOT_BODY_ID, ROBOT_DIR, robotTint, robotName, bodyIdOf, bodyDefOf, artIdsFor } from '../src/campaign/robots.js';
import { campaignMoves } from '../src/campaign/moves.js';
import { validateStory } from '../src/campaign/story/validate.js';
import { CHARACTERS } from '../src/data/characters.js';

const MAP = ['..........', '..........', '..........', '..........', '..........'];
const mk = (over = {}) => ({
  id: 't1', title: 'T', kicker: 'T', objective: 'Rout', win: 'rout', map: MAP,
  starts: [[0, 1], [0, 2], [0, 3]], lordSlot: 0,
  party: [{ id: 'hydra', level: 1, lord: true }, { id: 'helen', level: 1 }],
  enemies: [{ id: 'nitra', robot: true, level: 1, x: 8, y: 2, ai: 'hold' }],
  intro: [{ who: 'hydra', text: 'x' }], outro: [{ who: 'hydra', text: 'y' }],
  ...over,
});
const battleOf = (ch, seed = 3) => new CampaignBattle(ch, ch.party.map((p) => makeRecord(p.id, p.level, { lord: !!p.lord })), { seed, enemyRecords: (e) => makeRecord(e.id, e.level) });

test('a robot is its element in a shared body: real moves and stats from the element, element colour, one body for all', () => {
  const b = battleOf(mk({ enemies: [{ id: 'nitra', robot: true, level: 2, x: 8, y: 2 }, { id: 'kyle', robot: true, level: 2, x: 8, y: 3 }] }));
  const [n, k] = b.enemies;
  for (const u of [n, k]) {
    assert.equal(u.robot, true);
    assert.equal(u.bodyId, ROBOT_BODY_ID);
    assert.equal(bodyIdOf(u), ROBOT_BODY_ID, 'every robot is drawn with the one robot body');
    assert.equal(u.team, 'enemy');
    assert.deepEqual(u.moves.map((m) => m.name), campaignMoves(u.id).map((m) => m.name), 'the element\'s own four Smash Ring moves');
  }
  assert.equal(n.id, 'nitra');
  assert.equal(n.tint, CHARACTERS.nitra.palettes[0].body, 'tinted with the element\'s fighter palette');
  assert.equal(k.tint, robotTint('kyle'));
  assert.notEqual(n.tint, k.tint);
  assert.equal(n.name, `${CHARACTERS.nitra.element}-Bot`);
  assert.equal(robotName('kyle'), 'Potassium-Bot');
  assert.deepEqual(n.moves.map((m) => m.name), ['Gust', 'Mini Tornado', 'Cryo Splash', 'Nitride Shell']);
  const player = b.players[0];
  assert.equal(player.robot, undefined, 'allies are never robots');
  assert.equal(bodyIdOf(player), player.id);
  assert.deepEqual(artIdsFor([...b.units]), [...new Set(b.units.map((u) => (u.robot ? ROBOT_BODY_ID : u.id)))]);
});

test('robot art: the placeholder is an existing fighter body until the real sheets ship', () => {
  if (ROBOT_ART_READY) {
    const def = bodyDefOf('robot');
    for (const [clip, c] of Object.entries(def.art.sheets.clips)) assert.ok(fs.existsSync(new URL(`../${ROBOT_DIR}${c.file}`, import.meta.url)), `robot sheet ${clip} is on disk`);
    assert.equal(ROBOT_BODY_ID, 'robot');
  } else {
    assert.ok(CHARACTERS[ROBOT_BODY_ID]?.art?.sheets, 'placeholder body is a real fighter with sheets');
    assert.equal(ROBOT_BODY_ID, 'silas', 'placeholder is Silas\'s untouched sheets (not pre-modesty art)');
    assert.equal(bodyDefOf(ROBOT_BODY_ID), CHARACTERS.silas);
  }
});

test('a wave arrives the moment the field is cleared, so a quick win never skips it; the fight ends only after the last wave', () => {
  const wave = { when: { turn: 4, orClear: true }, lines: [{ who: null, text: 'More!' }], spawn: [{ id: 'kyle', robot: true, level: 1, x: 8, y: 1 }, { id: 'cal', robot: true, level: 1, x: 8, y: 3 }] };
  const ch = mk({ events: [wave] });
  const b = battleOf(ch);
  b.startPhase('player');
  assert.equal(b.pendingSpawns(), true);
  const first = b.enemies[0];
  first.hp = 0; first.alive = false;
  assert.equal(b.updateResult(), null, 'no victory while a wave is still due');
  const out = b.checkEvents('death', { unit: first });
  assert.equal(out.length, 1, 'clearing the field calls the wave in');
  assert.equal(out[0].spawned.length, 2);
  assert.ok(out[0].spawned.every((u) => u.robot && u.team === 'enemy' && u.arrived));
  assert.equal(b.pendingSpawns(), false);
  assert.equal(b.checkEvents('turn').length, 0, 'a wave fires once');
  for (const u of b.enemies) { u.alive = false; u.hp = 0; }
  assert.equal(b.updateResult(), 'victory');
});

test('a wave also arrives on its turn when the field is not clear', () => {
  const ch = mk({ events: [{ when: { turn: 2, orClear: true }, lines: [], spawn: [{ id: 'kyle', robot: true, level: 1, x: 9, y: 2 }] }] });
  const b = battleOf(ch);
  b.startPhase('player');
  assert.equal(b.checkEvents('turn').length, 0);
  b.turn = 2;
  const out = b.checkEvents('turn');
  assert.equal(out.length, 1);
  assert.equal(b.enemies.length, 2);
});

test('events can target a robot by story key, so a freed ally with the same fighter id never triggers them', () => {
  const ch = mk({
    enemies: [{ id: 'hydra', key: 'warden', robot: true, level: 1, x: 3, y: 2, ai: 'hold' }],
    events: [{ when: { near: 'warden', dist: 6 }, lines: [{ who: null, text: 'It looms.' }] }, { when: { death: 'warden' }, lines: [{ who: null, text: 'It falls.' }] }],
  });
  assert.deepEqual(validateStory({ id: 's', title: 's', lord: 'hydra', prologue: { lines: [{ who: null, text: 'p' }] }, chapters: [ch] }, Object.keys(CHARACTERS)), []);
  const b = battleOf(ch);
  b.startPhase('player');
  assert.equal(b.checkEvents('move').length, 1, 'near fires on the keyed robot');
  const warden = b.enemies[0];
  assert.equal(b.checkEvents('death', { unit: b.players[0] }).length, 0, 'the lord (also id hydra) is not the warden');
  assert.equal(b.checkEvents('death', { unit: warden }).length, 1);
});

test('freedFor lists only the elements the party does not have yet', () => {
  const frees = ['nitra', 'oxana'];
  assert.deepEqual(freedFor({ frees }, [makeRecord('nitra', 1)]), ['oxana']);
  assert.deepEqual(freedFor({ frees }, []), ['nitra', 'oxana']);
  assert.deepEqual(freedFor({}, []), []);
});

test('validateStory understands robots, frees and waves, and reports mistakes in plain words', () => {
  const base = () => ({ id: 's', title: 's', lord: 'hydra', prologue: { lines: [{ who: null, text: 'p' }] }, chapters: [mk({ frees: ['nitra'] })] });
  const known = Object.keys(CHARACTERS);
  assert.deepEqual(validateStory(base(), known), []);
  const a = base(); a.chapters[0].frees = ['nobody'];
  assert.match(validateStory(a, known).join('\n'), /unknown fighter "nobody"/);
  const b = base(); b.chapters.push({ ...mk({ id: 't2', frees: ['nitra'] }), party: [] });
  assert.match(validateStory(b, known).join('\n'), /already freed/);
  const c = base(); c.chapters[0].events = [{ when: { orClear: true }, lines: [] }];
  assert.match(validateStory(c, known).join('\n'), /needs a spawn/);
  const d = base(); d.chapters[0].events = [{ when: { near: 'ghost' }, lines: [] }];
  assert.match(validateStory(d, known).join('\n'), /no enemy or spawn with key\/id "ghost"/);
  const e = base(); e.chapters[0].enemies[0].robot = 'yes';
  assert.match(validateStory(e, known).join('\n'), /robot must be true/);
});
