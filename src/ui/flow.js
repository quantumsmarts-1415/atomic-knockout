import { MOTION } from './theme.js';

// Full-screen scenes. PauseMenu is included so leaving the match also
// drops the overlay. Entering Pause is a launch, not a showScene.
const FULL_SCENES = [
  'Boot', 'Title', 'PlayerJoin', 'CharacterSelect', 'StageSelect', 'Battle', 'Results', 'PauseMenu',
];

/**
 * Replace the current screen. Stops every other full-screen scene first so
 * it stops rendering, taking keys, and polling (the phone QR fetch cancels
 * on shutdown), then starts `key` fresh.
 *
 * Menus fade to the void for MOTION.sceneFade first; the new scene fades
 * back in through enterScene(). Pass { fade: false } for an instant cut
 * (the match uses its own cards). A second call while a fade is already
 * running is ignored, so a double-tap cannot start two scenes.
 */
export function showScene(from, key, data, { fade = true } = {}) {
  const manager = from.scene;
  const start = () => {
    from.__leaving = false;
    for (const other of FULL_SCENES) {
      if (other === key) continue;
      const target = manager.get(other);
      if (!target) continue;
      const plugin = target.scene;
      if (plugin.isActive() || plugin.isPaused() || plugin.isSleeping()) manager.stop(other);
    }
    manager.start(key, data);
  };
  const cam = from.cameras?.main;
  if (!fade || !cam?.fadeOut) {
    start();
    return;
  }
  if (from.__leaving) return;
  from.__leaving = true;
  cam.once('camerafadeoutcomplete', start);
  cam.fadeOut(MOTION.sceneFade, 7, 6, 14);
}

/** Fade a freshly created menu in from the void. */
export function enterScene(scene, duration = MOTION.sceneFade) {
  scene.__leaving = false;
  const cam = scene.cameras?.main;
  if (cam?.fadeIn) cam.fadeIn(duration, 7, 6, 14);
}

/** True while this scene is fading out to another one. */
export function isLeaving(scene) {
  return !!scene.__leaving;
}
