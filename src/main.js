import * as Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import BattleScene from './scenes/BattleScene.js';
import TitleScene from './scenes/TitleScene.js';
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
  backgroundColor: '#0d1220',
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
  scene: [BootScene, TitleScene, CharacterSelectScene, StageSelectScene, BattleScene, ResultsScene, PauseMenuScene],
};

const game = new Phaser.Game(config);
window.game = game; // handy for debugging + automated playtesting
export default game;
