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
  
  // Test actual cooldown enforcement:
  // Move started at 4000, duration 50, cooldown 400 -> specialCooldownUntil should be 4450.
  // Next update at 4100 should NOT allow special again.
  f.input = {}; f.update(4050, 16);
  f.state = 'idle'; // simulate exiting defense state
  f.input = { attack: false, special: true }; f.update(4100, 16);
  assert.notStrictEqual(f.state, 'defending');
  assert.strictEqual(f.state, 'idle');
  
  // Now try after cooldown expires at 4500
  f.input = {}; f.update(4450, 16);
  f.input = { attack: false, special: true }; f.update(4500, 16);
  assert.strictEqual(f.state, 'defending');
});

test('Anti-spam timing validation: duration + cooldown vs hitstun', () => {
  const mockScene = createMockScene();
  const charDef = { ...baseCharDef, moves: {
    // Simulating Lillie's pre-fix move that was an infinite combo:
    // duration 180, cooldown 90. Base hitstun is 320ms.
    basicDirectional: { duration: 180, cooldown: 90, type: 'physical' }
  }};
  
  const f = new Fighter(mockScene, 0, 0, charDef, 0, 0);
  f.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  // Attacker starts swinging at T=1000
  f.input = { left: true, attack: true, special: false }; f.update(1000, 16);
  assert.strictEqual(f.state, 'attack');
  assert.strictEqual(f.attackCooldownUntil, 1000 + 180 + 90); // 1270
  
  // Victim hit calculation
  const victim = new Fighter(mockScene, 0, 0, charDef, 0, 0);
  victim.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  const move = { type: 'physical', damage: 10, baseKnockback: 100, knockbackGrowth: 10 };
  
  // Assume hit lands at T=1144 (80% through the 180ms duration)
  victim.takeHit(f, move, 1144, 1);
  assert.strictEqual(victim.state, 'hurt');
  // Base hitstun is 320 + min(percent*2, 300) = 320 + 20 = 340. 
  // 1144 + 340 = 1484
  assert.strictEqual(victim.stateUntil, 1144 + 340);
  
  // Attacker can swing again at T=1270. 
  // 1270 < 1484, so the attacker can easily land another hit before victim recovers.
  assert.strictEqual(f.attackCooldownUntil < victim.stateUntil, true);
  
  // NOW test the fixed timings: Lillie's cooldown bumped to 280.
  const charDefFixed = { ...baseCharDef, moves: {
    basicDirectional: { duration: 180, cooldown: 280, type: 'physical' }
  }};
  const f2 = new Fighter(mockScene, 0, 0, charDefFixed, 0, 0);
  f2.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  f2.input = {}; f2.update(950, 16);
  f2.input = { left: true, attack: true, special: false }; f2.update(1000, 16);
  
  // Next attack available at T = 1000 + 180 + 280 = 1460
  // Hit lands at earliest 25% of swing: 1460 + (180 * 0.25) = 1460 + 45 = 1505
  const nextEarliestHit = f2.attackCooldownUntil + (180 * 0.25);
  
  // Base hitstun is 320ms + percent calculation. 
  // If the first hit landed at T=1144, the victim is in hitstun until T = 1144 + 340 (at 0%) = 1484.
  // 1505 > 1484, meaning the victim has 21ms to act (block, dodge, jump) before the next hit lands!
  // True combo is properly broken.
  assert.strictEqual(nextEarliestHit > 1484, true);
});

test('Charge scaling mechanics', () => {
  const mockScene = createMockScene();
  const charDef = { ...baseCharDef, moves: {
    basicCharge: { 
      duration: 200, cooldown: 200, type: 'physical', 
      damage: 10, chargeDamageMult: 2.0, 
      baseKnockback: 100, chargeKnockbackMult: 1.5,
      knockbackGrowth: 5,
      maxChargeMs: 1000 
    }
  }};
  
  const f = new Fighter(mockScene, 0, 0, charDef, 0, 0);
  f.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  // Start charge at 1000
  f.input = { attack: true, special: false }; f.update(1000, 16);
  assert.strictEqual(f.state, 'charging');
  
  // Release at 1500 (50% charge)
  f.input = { attack: false, special: false }; f.update(1500, 16);
  assert.strictEqual(f.state, 'attack');
  assert.strictEqual(f.currentMove.damage, 15); // 10 + (10 * 1.0 * 0.5)
  assert.strictEqual(f.currentMove.baseKnockback, 125); // 100 + (100 * 0.5 * 0.5)
});

test('Block and Counter mechanics', () => {
  const mockScene = createMockScene();
  const charDefBlock = { ...baseCharDef, moves: {
    specialDefense: { kind: 'block', damageReduction: 0.8, duration: 500, cooldown: 100 }
  }};
  
  const fBlock = new Fighter(mockScene, 0, 0, charDefBlock, 0, 0);
  fBlock.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  fBlock.body = { setVelocity: () => {}, velocity: {x:0, y:0}, blocked: {}, touching: {} };
  
  // Enter block state
  fBlock.input = { attack: false, special: true }; fBlock.update(1000, 16);
  assert.strictEqual(fBlock.state, 'defending');
  
  const attacker = { x: -10, y: 0, facing: 1 };
  const move = { type: 'physical', damage: 10, baseKnockback: 100, knockbackGrowth: 10 };
  
  // Should take 20% damage (80% reduction)
  const dmg = fBlock.takeHit(attacker, move, 1100, 1);
  assert.ok(Math.abs(dmg - 2) < 0.001);
  assert.ok(Math.abs(fBlock.percent - 2) < 0.001);
  
  // Counter test
  const charDefCounter = { ...baseCharDef, moves: {
    specialDefense: { kind: 'counter', counterDamage: 8, counterType: 'heat', counterKnockback: 150, duration: 500, cooldown: 100 }
  }};
  const fCounter = new Fighter(mockScene, 0, 0, charDefCounter, 0, 0);
  fCounter.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  fCounter.body = { setVelocity: () => {}, velocity: {x:0, y:0}, blocked: {}, touching: {} };
  
  fCounter.input = { attack: false, special: true }; fCounter.update(1000, 16);
  assert.strictEqual(fCounter.state, 'defending');
  
  let attackerHit = false;
  attacker.takeHit = (victim, retaliateMove, time, facing) => {
    attackerHit = true;
    assert.strictEqual(retaliateMove.damage, 8);
    assert.strictEqual(retaliateMove.type, 'heat');
    assert.strictEqual(retaliateMove.isCounterAttack, true);
  };
  
  const dmg2 = fCounter.takeHit(attacker, move, 1100, 1);
  assert.strictEqual(dmg2, 0);
  assert.strictEqual(fCounter.percent, 0);
  assert.strictEqual(attackerHit, true);
});
