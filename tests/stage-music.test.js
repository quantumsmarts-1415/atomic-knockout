// Smash Ring stage music: every stage has its own OGG (+ MP3 fallback) track, mapped from data/stages.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGES } from '../src/data/stages.js';
import { TRACKS } from '../src/campaign/music.js';
import { stageTrack, STAGE_MUSIC_DIR } from '../src/engine/stageMusic.js';

test('every stage maps to its own track, with the old bgm-* placeholders gone', () => {
  const keys = STAGES.map((s) => s.music);
  assert.ok(keys.every(Boolean), 'each stage has a music key');
  assert.equal(new Set(keys).size, STAGES.length, 'no two stages share a track');
  assert.ok(keys.every((k) => !k.startsWith('bgm-')), 'placeholder keys replaced');
  for (const s of STAGES) {
    assert.equal(stageTrack(s), `stage-${s.id}`);
    assert.equal(TRACKS[s.music].loop, true, `${s.id} loops`);
    assert.equal(TRACKS[s.music].dir, STAGE_MUSIC_DIR);
    assert.equal(TRACKS[s.music].file, s.id);
  }
});

test('each stage track exists as OGG and MP3, is a real audio file, and matches index.json', () => {
  const index = JSON.parse(fs.readFileSync(`${STAGE_MUSIC_DIR}index.json`, 'utf8'));
  for (const s of STAGES) {
    const ogg = fs.readFileSync(`${STAGE_MUSIC_DIR}${s.id}.ogg`);
    const mp3 = fs.readFileSync(`${STAGE_MUSIC_DIR}${s.id}.mp3`);
    assert.equal(ogg.subarray(0, 4).toString(), 'OggS', `${s.id}.ogg is Ogg`);
    assert.ok(mp3.length > 100000, `${s.id}.mp3 has audio`);
    assert.ok(mp3.subarray(0, 3).toString() === 'ID3' || mp3[0] === 0xff, `${s.id}.mp3 is mp3`);
    const row = index.find((r) => r.stage_id === s.id);
    assert.ok(row && row.files.ogg.duration_s > 30, `${s.id} listed in index.json with a real loop length`);
  }
  assert.equal(index.length, STAGES.length);
});

test('fight-mode scene starts the stage track after create, skips fast sims, and leaves art loading alone', () => {
  const src = fs.readFileSync('src/scenes/BattleScene.js', 'utf8');
  const music = src.indexOf('startStageMusic(this, this.stage)');
  assert.ok(music > src.indexOf('  create() {'), 'started in create(), not preload()');
  const pre = src.slice(src.indexOf('  preload() {'), src.indexOf('  create() {'));
  assert.ok(!/Music|music/.test(pre), 'preload() (art loading) does not mention music');
  assert.match(fs.readFileSync('src/engine/stageMusic.js', 'utf8'), /simSpeed/);
});
