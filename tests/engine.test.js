import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { applyDefense } from '../src/data/characters.js';

mock.module('phaser', {
  namedExports: {
    Math: { Clamp: (v, min, max) => Math.min(Math.max(v, min), max) },
    Geom: { Rectangle: class { constructor(x,y,w,h) { this.x=x; this.y=y; this.width=w; this.height=h; } } },
    Scene: class Scene {},
    GameObjects: { 
      Container: class Container { 
        constructor(scene, x, y) { this.scene = scene; this.x = x; this.y = y; }
        setSize() {} setPosition() {} add() {} 
      },
      Sprite: class Sprite {}
    }
  }
});

const { default: Fighter } = await import('../src/engine/Fighter.js');

test('applyDefense reduces damage by 5% per point', () => {
  const defense = { physical: 4, heat: 0 };
  assert.strictEqual(applyDefense(10, 'physical', defense), 8);
  assert.strictEqual(applyDefense(10, 'heat', defense), 10);
  assert.strictEqual(applyDefense(10, 'radiation', defense), 10);
});

const mockObj = { 
  setOrigin: function() { return this; }, 
  setScale: function() { return this; }, 
  setVisible: function() { return this; },
  setTintFill: function() { return this; },
  clearTint: function() { return this; },
  play: function() { return this; }
};

let velocityX = 0, velocityY = 0;

function createMockScene() {
  return {
    time: { now: 1000, delayedCall: () => {} },
    spawnProjectile: () => {},
    resolveBurst: () => {},
    textures: { exists: () => true },
    physics: { add: { existing: (obj) => { 
      obj.body = { 
        setSize: () => {}, setOffset: () => {}, setCollideWorldBounds: () => {}, 
        setDrag: () => {}, setBounce: () => {}, setMaxVelocity: () => {}, 
        setVelocity: (x,y) => { velocityX = x; velocityY = y; }, 
        setVelocityX: (x) => { velocityX = x; }, 
        setVelocityY: (y) => { velocityY = y; }, 
        velocity: {x:0, y:0}, blocked: {}, touching: {}, gravity: {y:0}, maxVelocity: {y:0} 
      }; 
    }}},
    add: { 
      image: () => ({ ...mockObj }),
      sprite: () => ({ ...mockObj }),
      graphics: () => ({ generateTexture: () => {}, destroy: () => {}, clear: () => {}, fillStyle: () => {}, fillRect: () => {}, fillCircle: () => {}, lineStyle: () => {}, strokeLineShape: () => {}, fillPoint: () => {} }),
      container: () => ({ add: () => {} }),
      existing: () => {}
    }
  };
}

const baseCharDef = {
  id: 'test_char',
  stats: { weight: 1.0, speed: 200, airJumps: 1, gravityScale: 1.0 },
  defense: { physical: 0 },
  palettes: [{ name: 'Test', skin: 0, body: 0, accent: 0, eye: 0 }],
  art: { use3d: false, sheets: { dir: '', clips: {} } },
  body: { headRadius: 10, torsoWidth: 10, torsoHeight: 10, armLength: 10, armWidth: 10, legLength: 10, legWidth: 10 }
};

test('Knockback formula and damage reduction via takeHit', () => {
  const mockScene = createMockScene();
  const charDef = { ...baseCharDef, moves: { basicDirectional: { duration: 100, cooldown: 100, type: 'physical' } } };
  
  const f = new Fighter(mockScene, 0, 0, charDef, 0, 0);
  f.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  const attacker = { x: -10, y: 0, facing: 1 };
  const move = { type: 'physical', damage: 10, baseKnockback: 100, knockbackGrowth: 10 };
  
  const dmg = f.takeHit(attacker, move, 1000, 1);
  assert.strictEqual(dmg, 10);
  assert.strictEqual(f.percent, 10);
  assert.strictEqual(Math.abs(velocityX) > 0, true);
  assert.strictEqual(Math.abs(velocityY) > 0, true);
});

test('Cooldowns and move-slot selection', () => {
  const mockScene = createMockScene();
  const charDef = { ...baseCharDef, moves: {
    basicDirectional: { duration: 100, cooldown: 100, type: 'physical' },
    basicCharge: { duration: 200, cooldown: 200, type: 'physical', damage: 10, baseKnockback: 10, knockbackGrowth: 1 },
    specialDirectional: { duration: 150, cooldown: 300, type: 'physical' },
    specialDefense: { duration: 50, cooldown: 400, type: 'physical' }
  }};
  
  const f = new Fighter(mockScene, 0, 0, charDef, 0, 0);
  f.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  f.input = { attack: true, special: false }; f.update(1000, 16);
  assert.strictEqual(f.state, 'charging');
  
  f.input = { attack: false, special: false }; f.update(1050, 16);
  assert.strictEqual(f.state, 'attack');
  assert.strictEqual(f.currentMove.type, 'physical');
  assert.strictEqual(f.currentMove.duration, 200);
  
  f.state = 'idle'; f.attackCooldownUntil = 0; f.specialCooldownUntil = 0;
  f.input = { left: true, attack: true, special: false }; f.update(2000, 16);
  assert.strictEqual(f.state, 'attack');
  assert.strictEqual(f.currentMove, charDef.moves.basicDirectional);
  
  f.state = 'idle'; f.attackCooldownUntil = 0;
  f.input = { left: true, attack: false, special: true }; f.update(3000, 16);
  assert.strictEqual(f.state, 'attack');
  assert.strictEqual(f.currentMove, charDef.moves.specialDirectional);
  
  f.state = 'idle'; f.specialCooldownUntil = 0;
  f.input = {}; f.update(3900, 16); f.input = { attack: false, special: true }; f.update(4000, 16);
  assert.strictEqual(f.state, 'defending');
  assert.strictEqual(f.defenseMove, charDef.moves.specialDefense);
});
