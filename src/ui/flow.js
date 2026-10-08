// Full-screen scenes. PauseMenu is included so leaving the match also
// drops the overlay. Entering Pause is a launch, not a showScene.
const FULL_SCENES = [
  'Boot', 'Title', 'PlayerJoin', 'CharacterSelect', 'StageSelect', 'Battle', 'Results', 'PauseMenu',
];

/**
 * Replace the current screen. Stops every other full-screen scene first so
 * it stops rendering, taking keys, and polling (the phone QR fetch cancels
 * on shutdown), then starts `key` fresh.
 */
export function showScene(from, key, data) {
  const manager = from.scene;
  for (const other of FULL_SCENES) {
    if (other === key) continue;
    const target = manager.get(other);
    if (!target) continue;
    const plugin = target.scene;
    if (plugin.isActive() || plugin.isPaused() || plugin.isSleeping()) manager.stop(other);
  }
  manager.start(key, data);
}
