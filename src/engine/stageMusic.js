// Fight-mode stage music: each arena in data/stages.js has its own looping track (`music: 'stage-<id>'`,
// files in assets/music/stages/<id>.ogg|mp3, OGG preferred because it loops without a gap).
// It runs on the campaign's music engine (its own AudioContext, separate from sfx.js), so the volume follows
// Settings (ak-master x ak-music) and nothing about the art loading changes: the track is fetched in the
// background after the match scene has been created.
import { registerTracks, playMusic, stopMusic, refresh, preload } from '../campaign/music.js';
import { STAGES } from '../data/stages.js';

export const STAGE_MUSIC_DIR = 'assets/music/stages/';

registerTracks(Object.fromEntries(STAGES.filter((s) => s.music).map((s) => [s.music, { loop: true, dir: STAGE_MUSIC_DIR, file: s.id }])));

/** The track key for a stage, or null. */
export function stageTrack(stage) {
  return stage?.music || null;
}

/** Start the stage's track for this match scene; it fades out when the scene shuts down. */
export function startStageMusic(scene, stage) {
  const track = stageTrack(stage);
  if (!track || (scene.setup?.simSpeed || 1) > 1) return null; // sims run headless and fast
  playMusic(track, { fade: 1.2 });
  const timer = setInterval(refresh, 500);
  const stop = () => {
    clearInterval(timer);
    stopMusic(0.8);
  };
  scene.events.once('shutdown', stop);
  scene.events.once('destroy', stop);
  return track;
}

/** Fetch a stage's track ahead of time (e.g. when it is highlighted on the stage select). */
export function preloadStageMusic(stage) {
  const track = stageTrack(stage);
  if (track) preload([track]);
}
