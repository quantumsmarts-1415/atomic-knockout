# Smash Ring stage music

Each arena in `src/data/stages.js` has its own looping track: `music: 'stage-<id>'` plays `assets/music/stages/<id>.ogg` (OGG is preferred because it loops without a gap; the MP3 is the fallback for browsers without Vorbis). `assets/music/stages/index.json` and `index.md` list each track's key, BPM, mood, loop length and loudness.

| Stage | Track |
| --- | --- |
| Elemental Isle, Twin Peaks, The Core, Crystal Spire, Hydrogen Breakout, Silicon Foundry, Brimstone Caldera, Neon Nexus, Holdout Keep, Carbon Skyhook | `stage-<stage id>` |

`src/engine/stageMusic.js` starts the track from `BattleScene.create()` (never from `preload()`, so the art loading sequence is untouched), fades it out when the scene shuts down, and skips fast tournament sims. It uses the campaign's music engine (`src/campaign/music.js`, its own AudioContext), so Settings > Sound applies. To add a stage's track, drop `<id>.ogg` and `<id>.mp3` in the folder and set `music: 'stage-<id>'` on the stage.

Tests: `tests/stage-music.test.js` (mapping, files, index) and `tests/stage-music-play.test.js` (headless: a match plays its stage's track and stops after).
