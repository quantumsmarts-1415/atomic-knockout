import * as Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import BattleScene from './scenes/BattleScene.js';
import TitleScene from './scenes/TitleScene.js';
import PlayerJoinScene from './scenes/PlayerJoinScene.js';
import CharacterSelectScene from './scenes/CharacterSelectScene.js';
import StageSelectScene from './scenes/StageSelectScene.js';
import ResultsScene from './scenes/ResultsScene.js';
import PauseMenuScene from './scenes/PauseMenuScene.js';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#07060E',
  // Prefer a working canvas over a blank WebGL context on weak laptop GPUs.
  render: {
    antialias: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, PlayerJoinScene, CharacterSelectScene, StageSelectScene, BattleScene, ResultsScene, PauseMenuScene],
};

if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.load('700 48px Orbitron');
  document.fonts.load('600 22px Sora');
  document.fonts.load('400 18px "Share Tech Mono"');
}

const game = new Phaser.Game(config);
window.game = game; // handy for debugging + automated playtesting

// Defensive re-fit: Scale.FIT computes its initial size synchronously while
// the game boots, which can happen a frame before the browser has finished
// laying out #game's height:100% chain (most likely on a fresh full page
// load rather than a warm reload). If that first measurement comes back
// wrong, nothing else naturally corrects it since the window itself never
// resizes afterward. Forcing one more measurement once the page is fully
// loaded is a standard, safe fix for a canvas that boots at the wrong size.
window.addEventListener('load', () => game.scale.refresh());

export default game;
