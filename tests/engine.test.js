import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { applyDefense, CHARACTERS } from '../src/data/characters.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const phaserPath = require.resolve('phaser');

mock.module(phaserPath, {
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

const { default: Fighter, diveVelocityX } = await import('../src/engine/Fighter.js');

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
  play: function() { return this; },
  setFlipX: function() { return this; },
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
  let guard = 0;
  while (f.hitlagFrames > 0 && guard < 40) {
    f.update(1000 + guard * 17, 17);
    guard++;
  }
  f.update(2000, 17);
  assert.ok(Math.abs(velocityX) > 0 || Math.abs(velocityY) > 0, `launch vx ${velocityX} vy ${velocityY}`);
});

test('a damage-over-time hit does not flinch, launch, or freeze', () => {
  const mockScene = createMockScene();
  const charDef = { ...baseCharDef, moves: { basicDirectional: { duration: 100, cooldown: 100, type: 'physical' } } };
  const f = new Fighter(mockScene, 0, 0, charDef, 0, 0);
  f.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  f.state = 'idle';
  const vx = velocityX;
  const dmg = f.takeHit({ x: -40, y: 0, facing: 1 }, {
    type: 'chemical', damage: 4, baseKnockback: 220, knockbackGrowth: 8, dot: true, kind: 'burst',
  }, 1000, 1);
  assert.strictEqual(dmg, 4);
  assert.strictEqual(f.percent, 4);
  assert.strictEqual(f.state, 'idle');
  assert.strictEqual(f.hitlagFrames || 0, 0);
  assert.ok(!f.pendingLaunch);
  assert.strictEqual(f._flashShow || 0, 0);
  assert.strictEqual(velocityX, vx);
});

test('heat on Ribbon Guard lights Unquenchable', () => {
  const mockScene = createMockScene();
  const maggie = CHARACTERS.maggie;
  const f = new Fighter(mockScene, 0, 0, maggie, 0, 0);
  f.rig = { animate: () => {}, setFlash: () => {}, play: () => {}, updateSheetFacing: () => {} };
  f.state = 'defending';
  f.defenseMove = maggie.moves.specialDefense;
  const dmg = f.takeHit({ x: 120, y: 0, facing: -1, charDef: CHARACTERS.hydra }, {
    type: 'heat', damage: 8, baseKnockback: 80, knockbackGrowth: 2,
  }, 4000, -1);
  assert.ok(dmg > 0);
  assert.ok(f.unquenchableUntil >= 4000 + 7000);
  assert.strictEqual(f.heatOnHit, 3);
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
  
  const jab = lillieDef.moves.basicDirectional;
  assert.equal(jab.combo.hits, 3);
  const lDur = jab.duration;
  const lCool = jab.cooldown;
  const lStartup = (jab.startupF ?? 3) * (1000 / 60);
  const lNextAttackAvailable = 1000 + lDur + lCool;
  // Spark Jab is a real on-hit chain: the follow-up is pressable inside the combo window.
  assert.ok(
    lNextAttackAvailable < 1000 + lStartup + jab.combo.window,
    `Spark Jab follow-up misses the combo window: next ${lNextAttackAvailable}`,
  );
  
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

test('Melt Down ignores hits, Transistor Gate banks electrical, and a peel knocks down', () => {
  const mockScene = createMockScene();
  const rig = () => ({ animate() {}, setFlash() {}, play() {}, updateSheetFacing() {} });
  const body = () => ({
    setVelocity() {}, setVelocityX() {}, velocity: { x: 0, y: 0 }, blocked: { down: true }, touching: {},
  });

  const gail = new Fighter(mockScene, 0, 0, CHARACTERS.gail, 0, 0);
  gail.rig = rig();
  gail.body = body();
  gail.startDefense(1000);
  assert.strictEqual(gail.defenseMove.name, 'Melt Down');
  const ignored = gail.takeHit({ x: -40, y: 0, facing: 1 }, {
    name: 'hit', type: 'kinetic', damage: 12, baseKnockback: 220, knockbackGrowth: 4,
  }, 1100, 1);
  assert.strictEqual(ignored, 0);
  assert.strictEqual(gail.percent, 0);
  assert.strictEqual(gail.state, 'defending');

  const gert = new Fighter(mockScene, 0, 0, CHARACTERS.gertrude, 0, 0);
  gert.rig = rig();
  gert.body = body();
  gert.startDefense(1000);
  const mixed = gert.takeHit({ x: -40, y: 0, facing: 1, charDef: CHARACTERS.neo }, {
    name: 'arc', type: 'electrical', damage: 6, type2: 'kinetic', damage2: 4,
    baseKnockback: 40, knockbackGrowth: 1,
  }, 1100, 1);
  assert.ok(mixed > 0 && mixed < 6, `kinetic remainder ${mixed}`);
  assert.strictEqual(gert._nextBonus, 6);
  gert.startDefense(1150);
  const pure = gert.takeHit({ x: -40, y: 0, facing: 1, charDef: CHARACTERS.neo }, {
    name: 'zap', type: 'electrical', damage: 5, baseKnockback: 80, knockbackGrowth: 2,
  }, 1200, 1);
  assert.strictEqual(pure, 0);
  assert.strictEqual(gert._nextBonus, 11);
  gert.state = 'idle';
  const before = CHARACTERS.gertrude.moves.basicDirectional.damage;
  gert.startMove(2000, CHARACTERS.gertrude.moves.basicDirectional, 'basic', 'basicDirectional');
  assert.ok(gert.currentMove.damage > before);
  assert.strictEqual(gert._nextBonus, 0);

  const dummy = new Fighter(mockScene, 80, 0, CHARACTERS.oxana, 0, 0);
  dummy.rig = rig();
  dummy.body = body();
  dummy.takeHit({ x: 0, y: 0, facing: 1, charDef: CHARACTERS.kyle }, {
    name: 'Banana Peel', type: 'radiation', damage: 1.2,
    baseKnockback: 240, knockbackGrowth: 2.2, angleDeg: 0, kind: 'melee', trip: true, tripMs: 780,
  }, 2000, 1);
  assert.strictEqual(dummy.state, 'hurt');
  assert.ok(dummy.trippedUntil >= 2000 + 700);
  assert.ok(dummy.percent < 3);
  assert.ok(dummy.hurtUnits <= 24);
});

test('a tagged Gamma Camera connects through a phase', () => {
  const mockScene = createMockScene();
  const rig = () => ({ animate() {}, setFlash() {}, play() {}, updateSheetFacing() {} });
  const body = () => ({
    setVelocity() {}, setVelocityX() {}, setVelocityY() {},
    velocity: { x: 0, y: 0 }, blocked: {}, touching: {},
  });
  const hidden = new Fighter(mockScene, 0, 0, { ...baseCharDef, id: 'hide', moves: {} }, 0, 0);
  hidden.rig = rig();
  hidden.body = body();
  hidden.phasingUntil = 5000;
  hidden.state = 'defending';
  hidden.defenseMove = { phase: true, intangible: true };
  const dmg = hidden.takeHit({ x: -80, y: 0, facing: 1, charDef: { id: 'tex' } }, {
    name: 'Gamma Camera', type: 'radiation', damage: 11, hitsRevealed: true,
    baseKnockback: 60, knockbackGrowth: 1.2,
  }, 1000, 1);
  assert.ok(dmg > 0, `tagged flash damage ${dmg}`);
  const faded = new Fighter(mockScene, 40, 0, { ...baseCharDef, id: 'hide2', moves: {} }, 0, 0);
  faded.rig = rig();
  faded.body = body();
  faded.phasingUntil = 5000;
  assert.strictEqual(faded.takeHit({ x: -80, y: 0, facing: 1, charDef: { id: 'tex' } }, {
    name: 'Gamma Camera', type: 'radiation', damage: 11,
    baseKnockback: 60, knockbackGrowth: 1.2,
  }, 1000, 1), 0);
});

test('a charged sniper ignores defense and a pass-through shot does not', () => {
  const mockScene = createMockScene();
  mockScene.simFast = true;
  const rig = () => ({ animate() {}, setFlash() {}, play() {}, updateSheetFacing() {} });
  const saab = new Fighter(mockScene, 0, 0, CHARACTERS.saab, 0, 0);
  saab.rig = rig();
  saab.state = 'charging';
  saab.chargeStart = 0;
  saab.fireCharge(950);
  assert.strictEqual(saab.currentMove.name, 'Sniper Round');
  assert.ok(Math.abs(saab.currentMove.damage - 12.1) < 1e-6);
  assert.strictEqual(saab.currentMove.defensePierce, 1);
  assert.strictEqual(saab.currentMove._chargeFrac, 1);
  assert.ok(!saab.currentMove.pierce);
  saab.state = 'charging';
  saab.chargeStart = 0;
  saab.fireCharge(475);
  assert.ok(Math.abs(saab.currentMove.defensePierce - 0.5) < 1e-6);
  assert.ok(saab.currentMove.damage > 5.5 && saab.currentMove.damage < 12.1);

  const wall = new Fighter(mockScene, 80, 0, {
    ...baseCharDef,
    id: 'wall',
    combat: { kineticDef: 0.5 },
    moves: {},
  }, 0, 0);
  wall.rig = rig();
  wall.body = {
    setVelocity() {}, setVelocityX() {}, setVelocityY() {},
    velocity: { x: 0, y: 0 }, blocked: { down: true }, touching: { down: true },
  };
  const attacker = { x: -40, y: 0, facing: 1, charDef: { id: 'wall-arm', combat: {} } };
  const through = wall.takeHit(attacker, {
    name: 'Hopper Crystal', type: 'kinetic', damage: 10, pierce: true,
    baseKnockback: 10, knockbackGrowth: 0.1,
  }, 1000, 1);
  assert.ok(Math.abs(through - 5) < 1e-6, `pass-through damage ${through}`);
  const charged = wall.takeHit(attacker, {
    name: 'Sniper Round', type: 'kinetic', damage: 10, defensePierce: 1,
    baseKnockback: 10, knockbackGrowth: 0.1,
  }, 2000, 1);
  assert.ok(Math.abs(charged - 10) < 1e-6, `charged damage ${charged}`);
});

test('a full defining second freezes for three seconds and the sponge drinks chemical hits', () => {
  const mockScene = createMockScene();
  mockScene.simFast = true;
  const rig = () => ({ animate() {}, setFlash() {}, play() {}, updateSheetFacing() {} });
  const caesar = new Fighter(mockScene, 0, 0, CHARACTERS.caesar, 0, 0);
  caesar.rig = rig();
  caesar.state = 'charging';
  caesar.chargeStart = 0;
  caesar.fireCharge(1000);
  assert.strictEqual(caesar.currentMove.onHit.freeze, 3000);
  assert.strictEqual(caesar.currentMove.onHit.coatMs, 3000);
  caesar.state = 'charging';
  caesar.chargeStart = 0;
  caesar.fireCharge(0);
  assert.strictEqual(caesar.currentMove.onHit.freeze, 1000);

  const lana = new Fighter(mockScene, 0, 0, CHARACTERS.lana, 0, 0);
  lana.rig = rig();
  lana.body = {
    setVelocity() {}, setVelocityX() {}, setVelocityY() {},
    velocity: { x: 0, y: 0 }, blocked: { down: true }, touching: { down: true },
  };
  lana.state = 'defending';
  lana.defenseMove = CHARACTERS.lana.moves.specialDefense;
  const foe = { x: -40, y: 0, facing: 1, charDef: { id: 'foe', combat: {} } };
  const soaked = lana.takeHit(foe, {
    name: 'splash', type: 'chemical', damage: 8,
    baseKnockback: 40, knockbackGrowth: 1,
  }, 1000, 1);
  assert.strictEqual(soaked, 0);
  assert.strictEqual(lana._sponge, 8);
  const nicked = lana.takeHit(foe, {
    name: 'jab', type: 'kinetic', damage: 10,
    baseKnockback: 40, knockbackGrowth: 1,
  }, 1100, 1);
  assert.ok(nicked > 0 && nicked < 10, `partial sponge damage ${nicked}`);
  assert.ok(lana._sponge > 8);
});

test('high-k gate blocks kinetic and electrical, and heat shatters it', () => {
  const scene = createMockScene();
  const rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, setAlpha() {}, setDepth() {} };
  const haley = new Fighter(scene, 40, 0, CHARACTERS.haley, 0, 0);
  haley.rig = rig;
  haley.state = 'defending';
  haley.defenseMove = CHARACTERS.haley.moves.specialDefense;
  const sandy = new Fighter(scene, -80, 0, CHARACTERS.sandy, 0, 0);
  sandy.rig = rig;
  const kinetic = { type: 'kinetic', damage: 10, baseKnockback: 80, knockbackGrowth: 2 };
  const blocked = haley.takeHit(sandy, kinetic, 1000, 1);
  assert.strictEqual(blocked, 0);
  assert.strictEqual(haley.state, 'defending');
  assert.strictEqual(haley.percent, 0);
  const sparked = haley.takeHit(sandy, { type: 'electrical', damage: 8, baseKnockback: 40, knockbackGrowth: 1 }, 1100, 1);
  assert.strictEqual(sparked, 0);
  assert.strictEqual(haley.state, 'defending');
  const burned = haley.takeHit(sandy, { type: 'heat', damage: 7, baseKnockback: 40, knockbackGrowth: 1 }, 1200, 1);
  assert.ok(burned > 0, `heat breaks the gate (${burned})`);
  assert.notStrictEqual(haley.state, 'defending');
  assert.strictEqual(haley.defenseMove, null);
});

test('blue glow jab connects through a phase and flashes the outline', () => {
  const scene = createMockScene();
  const rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, setAlpha() {}, setDepth() {} };
  const thule = new Fighter(scene, -70, 0, CHARACTERS.thule, 0, 0);
  thule.rig = rig;
  const hidden = new Fighter(scene, 40, 0, CHARACTERS.tess, 0, 0);
  hidden.rig = rig;
  hidden.phasingUntil = 9000;
  const jab = CHARACTERS.thule.moves.basicDirectional;
  const dmg = hidden.takeHit(thule, jab, 1000, 1);
  assert.ok(dmg > 0, `phased fighter still takes the jab (${dmg})`);
  assert.strictEqual(hidden.revealedUntil, 1500);
  assert.strictEqual(hidden.revealTint, 0x8ec8ff);
  assert.ok(hidden.phasingUntil > 1000);
  const still = new Fighter(scene, 40, 0, CHARACTERS.tess, 0, 0);
  still.rig = rig;
  still.phasingUntil = 9000;
  const blocked = still.takeHit(thule, { type: 'kinetic', damage: 8, baseKnockback: 40, knockbackGrowth: 1 }, 1000, 1);
  assert.strictEqual(blocked, 0);
});

test('aurora veil dazzles the attacker so the next swing misses', () => {
  const scene = createMockScene();
  const rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, setAlpha() {}, setDepth() {} };
  const thule = new Fighter(scene, 40, 0, CHARACTERS.thule, 0, 0);
  thule.rig = rig;
  thule.state = 'defending';
  thule.defenseMove = CHARACTERS.thule.moves.specialDefense;
  const sandy = new Fighter(scene, -80, 0, CHARACTERS.sandy, 0, 0);
  sandy.rig = rig;
  thule.takeHit(sandy, { name: 'jab', type: 'kinetic', damage: 8, baseKnockback: 40, knockbackGrowth: 1 }, 1000, 1);
  assert.strictEqual(sandy.missNext, 1);
  assert.strictEqual(sandy.dazzledBy.id, 'thule');
  assert.strictEqual(sandy.dazzledBy.move, 'Aurora Veil');
});

test('calibration strike is the listed number through defense and buffs', () => {
  const scene = createMockScene();
  const rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, setAlpha() {}, setDepth() {} };
  const holly = CHARACTERS.holly;
  const attacker = new Fighter(scene, -80, 0, holly, 0, 0);
  attacker.rig = rig;
  attacker.attackPowerUntil = 9000;
  attacker.attackPower = 1.8;
  attacker.bonusHits = 3;
  attacker.bonusPacket = { type: 'kinetic', damage: 6 };
  const victim = new Fighter(scene, 40, 0, CHARACTERS.bord, 0, 0);
  victim.rig = rig;
  victim.kineticResistUntil = 9000;
  victim.kineticResistMult = 0.35;
  victim.state = 'defending';
  victim.defenseMove = { name: 'Guard', kind: 'block', blockReduction: 0.8, onlyReduce: ['kinetic'] };
  const dmg = victim.takeHit(attacker, holly.moves.basicDirectional, 1000, 1);
  assert.strictEqual(dmg, 7);
  assert.strictEqual(victim.percent, 7);
});

test('bend don\'t break keeps Holly standing and cuts kinetic hits', () => {
  const scene = createMockScene();
  const rig = { animate() {}, setFlash() {}, play() {}, updateSheetFacing() {}, setAlpha() {}, setDepth() {} };
  const attacker = new Fighter(scene, -90, 0, CHARACTERS.sandy, 0, 0);
  attacker.rig = rig;
  const open = new Fighter(scene, 40, 0, CHARACTERS.holly, 0, 0);
  const guarded = new Fighter(scene, 40, 0, CHARACTERS.holly, 0, 0);
  open.rig = rig;
  guarded.rig = rig;
  guarded.state = 'defending';
  guarded.defenseMove = CHARACTERS.holly.moves.specialDefense;
  const shot = { type: 'kinetic', damage: 10, baseKnockback: 320, knockbackGrowth: 6 };
  const raw = open.takeHit(attacker, shot, 1000, 1);
  const cut = guarded.takeHit(attacker, shot, 1000, 1);
  assert.ok(cut > 0 && cut < raw, `reduced kinetic ${cut} vs ${raw}`);
  assert.strictEqual(guarded.state, 'defending');
  assert.ok(!guarded.pendingLaunch);
  guarded.takeHit(attacker, { type: 'heat', damage: 8, baseKnockback: 400, knockbackGrowth: 8 }, 1100, 1);
  assert.strictEqual(guarded.state, 'defending');
  assert.ok(!guarded.pendingLaunch);
});

test('a dive stops at the ledge and hops back if it is already past it', () => {
  const isle = [{ x: 640, w: 990 }];
  assert.strictEqual(diveVelocityX(640, 220, isle), 220);
  assert.strictEqual(diveVelocityX(1088, 220, isle, 0.2), 0);
  assert.ok(diveVelocityX(1200, 220, isle) < 0);
});
