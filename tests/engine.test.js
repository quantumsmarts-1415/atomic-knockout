import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { applyDefense, CHARACTERS } from '../src/data/characters.js';

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
  
  // Use LIVE CHARACTERS data
  const lillieDef = CHARACTERS.lillie;
  const benDef = CHARACTERS.ben;
  
  // Lillie timing check
  const lillie = new Fighter(mockScene, 0, 0, lillieDef, 0, 0);
  lillie.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  lillie.input = { left: true, attack: true, special: false }; lillie.update(1000, 16);
  assert.strictEqual(lillie.state, 'attack');
  
  const lDur = lillieDef.moves.basicDirectional.duration;
  const lCool = lillieDef.moves.basicDirectional.cooldown;
  const lStartup = lDur * 0.25; 
  
  const lHitLandedTime = 1000 + lStartup;
  const lHitstunEnd = lHitLandedTime + 340; // 340ms is base hitstun
  
  const lNextAttackAvailable = 1000 + lDur + lCool;
  const lNextEarliestHit = lNextAttackAvailable + lStartup;
  
  // The next hit MUST land AFTER hitstun ends to break the true combo
  assert.ok(lNextEarliestHit > lHitstunEnd, `Lillie true combo possible! Next hit: ${lNextEarliestHit}, Hitstun end: ${lHitstunEnd}`);
  
  // Ben timing check
  const ben = new Fighter(mockScene, 0, 0, benDef, 0, 0);
  ben.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  
  ben.input = { left: true, attack: true, special: false }; ben.update(1000, 16);
  assert.strictEqual(ben.state, 'attack');
  
  const bDur = benDef.moves.basicDirectional.duration;
  const bCool = benDef.moves.basicDirectional.cooldown;
  const bStartup = bDur * 0.25; 
  
  const bHitLandedTime = 1000 + bStartup;
  const bHitstunEnd = bHitLandedTime + 340; // 340ms is base hitstun
  
  const bNextAttackAvailable = 1000 + bDur + bCool;
  const bNextEarliestHit = bNextAttackAvailable + bStartup;
  
  // The next hit MUST land AFTER hitstun ends to break the true combo
  assert.ok(bNextEarliestHit > bHitstunEnd, `Ben true combo possible! Next hit: ${bNextEarliestHit}, Hitstun end: ${bHitstunEnd}`);
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
