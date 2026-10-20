import test from 'node:test';
import { frameData, STEP_MS } from '../src/engine/feel.js';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import { computeBotInput } from '../src/engine/BotAI.js';
import { gateStored, interceptHit } from '../src/engine/defense.js';
import { anodizeTint, applyDot, applyOnCast, applyOnHit, bankStolenPackets, bonusPackets, cleanse, fighterOnSwapLine, lightUnquenchable, markedStrikeTargets, scaledByHaste, sheetFrameAt, stripBuffs, tickKit, visibleAlpha, withRedFrame, withShatter } from '../src/engine/kit.js';
import { resolvePacket } from '../src/data/balance.js';
import { applyImmunities, rearmDefense } from '../src/engine/defense.js';
import { stickAim } from '../src/engine/batch3.js';

const SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];
const TYPES = new Set(['kinetic', 'heat', 'electrical', 'chemical', 'radiation', 'physical']);

test('every fighter has four named moves with legal damage types', () => {
  assert.strictEqual(Object.keys(CHARACTERS).length, 118);
  for (const c of Object.values(CHARACTERS)) {
    for (const slot of SLOTS) {
      const move = c.moves[slot];
      assert.ok(move?.name, `${c.id} missing ${slot}`);
      assert.ok(move.duration > 0 && move.cooldown >= 0, `${c.id} ${move.name} timing`);
      for (const t of [move.type, move.type2, move.type3, move.wallType, move.counterType].filter(Boolean)) {
        assert.ok(TYPES.has(t), `${c.id} ${move.name} type ${t}`);
      }
      for (const t of [move.type, move.type2].filter(Boolean)) {
        assert.notStrictEqual(t, 'physical', `${c.id} ${move.name} still says physical`);
      }
      if (move.kind === 'wall') {
        for (const k of ['wallRangeW', 'wallRangeH', 'wallYFrac', 'wallKnockbackGrowth']) {
          assert.ok(Number.isFinite(move[k]), `${c.id} ${move.name} missing ${k}`);
        }
      }
    }
  }
});

test('Nick meteorite dives diagonally instead of dropping straight down', () => {
  const m = CHARACTERS.nick.moves.specialDirectional;
  assert.equal(m.name, 'Meteorite Drop');
  assert.equal(m.fromAbove, true);
  assert.ok(m.projectileSpeed >= 300, `horizontal dive speed ${m.projectileSpeed}`);
  assert.ok(m.fallSpeed >= 600, `fall speed ${m.fallSpeed}`);
  assert.ok(m.skyLead >= 120, `sky lead ${m.skyLead}`);
  assert.ok(m.delayMs <= 400, `telegraph ${m.delayMs}`);
});

test('owner-locked kits stay as specified', () => {
  const l = CHARACTERS.lillie.moves;
  assert.deepStrictEqual(
    [l.basicCharge.name, l.basicDirectional.name, l.specialDefense.name, l.specialDirectional.name],
    ['Mega Discharge', 'Spark Jab', 'Absorb', 'Crimson Tide'],
  );
  assert.equal(l.basicDirectional.combo.hits, 3);
  assert.deepStrictEqual(l.specialDefense.immune, ['heat', 'electrical', 'chemical', 'radiation']);
  assert.equal(l.specialDefense.powersCharge, true);
  assert.equal(l.basicCharge.bankCap, 18);
  assert.equal(l.specialDirectional.roll, true);
  assert.equal(l.specialDirectional.carry, true);

  const h = CHARACTERS.hydra.moves;
  assert.deepStrictEqual(
    [h.basicCharge.name, h.basicDirectional.name, h.specialDefense.name, h.specialDirectional.name],
    ['Supernova', 'Flame Dash', 'Fire Wall', 'Hydrogen Bomb'],
  );
  const nova = h.basicCharge;
  assert.equal(nova.releaseOnHit, true);
  assert.equal(nova.fxScale, 'radius');
  assert.equal(nova.chargeRadiusMult, 2);
  assert.equal(nova.chargeDamageMult, 2);
  assert.equal(nova.chargeKnockbackMult, 2);
  const grown = (base, mult, frac) => base * (1 + (mult - 1) * frac);
  assert.equal(grown(nova.radius, nova.chargeRadiusMult, 0), 64);
  assert.equal(grown(nova.radius, nova.chargeRadiusMult, 0.5), 96);
  assert.equal(grown(nova.radius, nova.chargeRadiusMult, 1), 128);
  assert.equal(grown(nova.damage, nova.chargeDamageMult, 1), 10);
  assert.equal(grown(nova.baseKnockback, nova.chargeKnockbackMult, 1), 400);
  assert.equal(grown(nova.selfDamage.damage, nova.selfDamage.chargeMult, 0), 4);
  assert.equal(grown(nova.selfDamage.damage, nova.selfDamage.chargeMult, 1), 6);
  const novaFrames = frameData(nova.duration, nova.cooldown, nova);
  assert.equal(novaFrames.startup, 4);
  assert.equal(novaFrames.recovery, 11);
  assert.equal(novaFrames.coolF, 22);
  const dash = h.basicDirectional;
  const dashFrames = frameData(dash.duration, dash.cooldown, {
    ...dash,
    startupF: Math.max(1, Math.round((dash.duration / STEP_MS) * 0.05)),
  });
  assert.equal(dashFrames.startup, 1);
  assert.equal(dashFrames.recovery, 12);
  assert.equal(dashFrames.coolF, 23);
  const bomb = h.specialDirectional;
  const bombFrames = frameData(bomb.duration, bomb.cooldown, bomb);
  assert.equal(bombFrames.startup, 4);
  assert.equal(bombFrames.recovery, 11);
  assert.equal(bombFrames.coolF, 29);
  assert.equal(Math.round(h.specialDefense.duration / STEP_MS), 19);
  assert.equal(Math.round(h.specialDefense.cooldown / STEP_MS), 20);
  assert.strictEqual(CHARACTERS.helen.moves.basicCharge.name, 'Air Wave');
  assert.strictEqual(CHARACTERS.helen.moves.specialDirectional.name, 'Balloon Bop');
  assert.strictEqual(CHARACTERS.natalie.moves.specialDirectional.name, 'Brine Burst');
  assert.notStrictEqual(
    CHARACTERS.natalie.moves.specialDirectional.name,
    CHARACTERS.lillie.moves.specialDirectional.name,
  );
});

test('a dive bot will not launch toward the open side of the deck', () => {
  const bot = fake('scarlett', 900, 500);
  bot.charDef = {
    ...bot.charDef,
    moves: {
      ...bot.charDef.moves,
      specialDirectional: { ...bot.charDef.moves.specialDirectional, kind: 'dive', dashSpeed: 160 },
    },
  };
  bot.facing = 1;
  const foe = fake('helen', 1040, 500);
  const bounds = { minX: 240, maxX: 1040 };
  const input = computeBotInput(1000, bot, [bot, foe], bounds);
  assert.strictEqual(input.special, false);
  const mid = fake('scarlett', 640, 500);
  const near = fake('helen', 800, 500);
  const diving = computeBotInput(1000, mid, [mid, near], bounds);
  assert.strictEqual(diving.special, true);
});

test('bots cycle a neutral charge and a neutral defense without walking', () => {
  const bot = fake('kyle', 400, 500);
  const foe = fake('hydra', 900, 500);
  const bounds = { minX: 0, maxX: 2000 };
  const walk = computeBotInput(1000, bot, [bot, foe], bounds);
  assert.strictEqual(walk.right, true, 'directional phase still chases');
  const charge = computeBotInput(3000, bot, [bot, foe], bounds);
  assert.strictEqual(charge.attack, true);
  assert.strictEqual(!!(charge.left || charge.right || charge.jump || charge.down), false);
  const defense = computeBotInput(4300, bot, [bot, foe], bounds);
  assert.strictEqual(defense.special, true);
  assert.strictEqual(defense.attack, false);
  assert.strictEqual(!!(defense.left || defense.right), false);
});

test('a charge that fizzles below full is held through the scripted release', () => {
  const bot = fake('kyle', 400, 500);
  bot.state = 'charging';
  bot.chargeStart = 2620;
  const foe = fake('hydra', 900, 500);
  const bounds = { minX: 0, maxX: 2000 };
  const early = computeBotInput(4100, bot, [bot, foe], bounds);
  assert.strictEqual(early.attack, true);
  assert.strictEqual(early.special, false);
  const ready = computeBotInput(4120, bot, [bot, foe], bounds);
  assert.strictEqual(ready.attack, false);
});

test('neo uses the approved neon kit', () => {
  const moves = CHARACTERS.neo.moves;
  assert.strictEqual(moves.basicCharge.name, 'High-Voltage Tube');
  assert.strictEqual(moves.basicCharge.kind, 'beam');
  assert.strictEqual(moves.basicCharge.chargeLengthMult, 2.5);
  assert.strictEqual(moves.basicCharge.tubeCharge, true);
  assert.strictEqual(moves.basicDirectional.name, 'Staff Crack');
  assert.strictEqual(moves.basicDirectional.type, 'kinetic');
  assert.strictEqual(moves.basicDirectional.type2, 'electrical');
  const sign = moves.specialDefense;
  assert.strictEqual(sign.name, 'No Vacancy');
  assert.deepStrictEqual(sign.blocks, ['kinetic', 'heat', 'electrical', 'chemical', 'radiation']);
  assert.strictEqual(sign.frontOnly, true);
  assert.strictEqual(sign.backOpen, true);
  assert.strictEqual(sign.openAfter, true);
  assert.strictEqual(sign.vacancySign, true);
  assert.ok(sign.vacancyAt < sign.duration);
  const neo = { state: 'defending', defenseMove: sign, facing: 1, x: 100, y: 500, bodyH: 116 };
  assert.strictEqual(interceptHit(neo, { x: 220, y: 500 }, { type: 'radiation', damage: 8 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(neo, { x: 20, y: 500 }, { type: 'kinetic', damage: 8 }, 0).result, 'pass');
  const flash = moves.specialDirectional;
  assert.strictEqual(flash.name, 'Neon Flash');
  assert.strictEqual(flash.type, 'electrical');
  assert.strictEqual(flash.onHit.dazzle, 800);
  const tube = frameData(moves.basicCharge.duration, moves.basicCharge.cooldown, moves.basicCharge);
  assert.strictEqual(tube.recovery, 12);
  assert.ok(tube.total < 45, 'tube wait is shortened');
  for (const c of Object.values(CHARACTERS)) {
    for (const slot of SLOTS) assert.notStrictEqual(c.moves[slot].name, 'Neon Flare');
  }
});

test('maggie uses the approved magnesium kit', () => {
  const moves = CHARACTERS.maggie.moves;
  const lit = moves.basicCharge;
  assert.strictEqual(lit.name, 'Unquenchable');
  assert.strictEqual(lit.buff.ms, 7000);
  assert.strictEqual(lit.buff.unquenchable, true);
  assert.strictEqual(lit.buff.heatOnHit, 3);
  assert.strictEqual(lit.buff.hits, 0);
  assert.strictEqual(lit.buff.selfDot.dps, 1);
  assert.ok(frameData(lit.duration, lit.cooldown, lit).total < 40);
  const jab = moves.basicDirectional;
  assert.strictEqual(jab.name, 'Flare Jab');
  assert.strictEqual(jab.type, 'kinetic');
  assert.strictEqual(jab.type2, 'heat');
  assert.strictEqual(jab.vfx, 'flare');
  assert.ok(frameData(jab.duration, jab.cooldown, jab).total < 30);
  const ribbon = moves.specialDefense;
  assert.strictEqual(ribbon.name, 'Ribbon Guard');
  assert.deepStrictEqual(ribbon.blocks, ['chemical', 'kinetic']);
  assert.strictEqual(ribbon.igniteOn, 'heat');
  assert.ok(ribbon.cooldown < 400);
  const guard = { state: 'defending', defenseMove: ribbon, facing: 1, x: 100, y: 400, bodyH: 100 };
  const foe = { x: 180, y: 400 };
  assert.strictEqual(interceptHit(guard, foe, { type: 'chemical', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'kinetic', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'heat', damage: 6 }, 0).result, 'pass');
  const flare = moves.specialDirectional;
  assert.strictEqual(flare.name, 'Blinding Flare');
  assert.strictEqual(flare.onHit.dazzle.ms, 2000);
  assert.ok(frameData(flare.duration, flare.cooldown, flare).recovery <= 12);
});

test('allen uses the approved aluminum kit', () => {
  const moves = CHARACTERS.allen.moves;
  const burn = moves.basicCharge;
  assert.strictEqual(burn.name, 'Thermite Burn');
  assert.strictEqual(burn.breaksBlock, undefined);
  assert.strictEqual(burn.type, 'heat');
  assert.strictEqual(burn.onHit.burn.dps, 3);
  assert.strictEqual(burn.onHit.burn.every, 1000);
  assert.strictEqual(burn.onHit.burn.ms, 3500);
  assert.ok(frameData(burn.duration, burn.cooldown, burn).total < 45);
  const whip = moves.basicDirectional;
  assert.strictEqual(whip.name, 'Power-Line Whips');
  assert.strictEqual(whip.type, 'electrical');
  assert.strictEqual(whip.type2, 'kinetic');
  assert.strictEqual(whip.multiHit, undefined);
  assert.ok(frameData(whip.duration, whip.cooldown, whip).total < 30);
  const skin = moves.specialDefense;
  assert.strictEqual(skin.name, 'Oxide Skin');
  assert.strictEqual(skin.kind, 'oxide');
  assert.strictEqual(skin.regrow, 'press');
  assert.ok(skin.cooldown < 400);
  assert.strictEqual(rearmDefense(skin, 5000), 5200);
  assert.strictEqual(rearmDefense(burn, 5000), null);
  const guard = { state: 'defending', defenseMove: skin, facing: 1, x: 100, y: 400, bodyH: 100 };
  const foe = { x: 180, y: 400 };
  assert.strictEqual(interceptHit(guard, foe, { type: 'chemical', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'kinetic', damage: 6 }, 0).result, 'pop');
  const blocked = { state: 'defending', defenseMove: { blocks: ['heat'] }, facing: 1, x: 100, y: 400, bodyH: 100 };
  assert.strictEqual(interceptHit(blocked, foe, burn, 0).result, 'negate');
  const vortex = moves.specialDirectional;
  assert.strictEqual(vortex.name, 'Turbine Vortex');
  assert.strictEqual(vortex.type, 'kinetic');
  assert.ok(vortex.pull > 0);
  const victim = { percent: 10, scene: { noteDot() {} } };
  applyOnHit(null, victim, burn, 0);
  assert.strictEqual(victim.percent, 10);
  tickKit(victim, 1000);
  assert.strictEqual(victim.percent, 13);
  tickKit(victim, 1500);
  assert.strictEqual(victim.percent, 13);
  tickKit(victim, 2000);
  assert.strictEqual(victim.percent, 16);
  tickKit(victim, 3000);
  assert.strictEqual(victim.percent, 19);
  tickKit(victim, 4000);
  assert.strictEqual(victim.percent, 19);
  assert.strictEqual(victim.state, undefined);
  assert.strictEqual(victim.hitlagFrames, undefined);
});

test('silas uses the approved silicon kit', () => {
  const moves = CHARACTERS.silas.moves;
  const clock = moves.basicCharge;
  assert.strictEqual(clock.name, 'Overclock');
  assert.strictEqual(clock.overclock.speed, 1.4);
  assert.strictEqual(clock.overclock.attack, 1.4);
  assert.strictEqual(clock.overclock.selfHeat, 7);
  assert.ok(frameData(clock.duration, clock.cooldown, clock).total < 50);
  const full = { scene: {} };
  full.takeHit = (_a, move) => { full.self = move; return move.damage; };
  applyOnCast(full, { ...clock, _chargeFrac: 1 }, 0, 1);
  assert.strictEqual(full.speedBuff, 1.4);
  assert.strictEqual(full.attackHaste, 1.4);
  assert.ok(full.attackHasteUntil > 0);
  assert.strictEqual(full.self.type, 'heat');
  assert.strictEqual(full.self.damage, 7);
  assert.strictEqual(full.self.isSelf, true);
  const tap = { scene: {}, takeHit() { throw new Error('a short charge should not overheat'); } };
  applyOnCast(tap, clock, 0, 0.4);
  assert.strictEqual(tap.speedBuff, 1.4);
  assert.strictEqual(tap.attackHaste, 1.4);
  const blade = moves.basicDirectional;
  assert.strictEqual(blade.name, 'Crystal Blade');
  assert.strictEqual(blade.type, 'kinetic');
  assert.strictEqual(blade.damage, 13.44);
  assert.strictEqual(blade.shatter.damage, 2.24);
  const shattered = withShatter(blade);
  assert.strictEqual(shattered.damage, 13.44);
  assert.strictEqual(shattered.type2, 'kinetic');
  assert.strictEqual(shattered.damage2, 2.24);
  assert.ok(frameData(blade.duration, blade.cooldown, blade).total < 30);
  const hasted = scaledByHaste(blade, clock.overclock.attack);
  assert.ok(hasted.duration < blade.duration);
  assert.ok(hasted.cooldown < blade.cooldown);
  const pane = moves.specialDefense;
  assert.strictEqual(pane.name, 'Silica Pane');
  assert.deepStrictEqual(pane.blocks, ['heat', 'chemical']);
  assert.ok(pane.cooldown < 400);
  const guard = { state: 'defending', defenseMove: pane, facing: 1, x: 100, y: 400, bodyH: 100 };
  const foe = { x: 180, y: 400 };
  assert.strictEqual(interceptHit(guard, foe, { type: 'heat', damage: 10 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'chemical', damage: 10 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'kinetic', damage: 6 }, 0).result, 'pass');
  const strong = interceptHit(guard, foe, { type: 'kinetic', damage: 12 }, 0);
  assert.strictEqual(strong.result, 'counter');
  assert.strictEqual(strong.negate, true);
  assert.strictEqual(strong.endDefense, true);
  assert.strictEqual(strong.counter.damage, 7.84);
  assert.strictEqual(strong.counter.type, 'kinetic');
  assert.strictEqual(strong.selfHit.damage, 7.84);
  assert.strictEqual(strong.selfHit.type, 'kinetic');
  assert.strictEqual(interceptHit(guard, foe, { type: 'kinetic', damage: 8 }, 0).endDefense, true);
  const surge = moves.specialDirectional;
  assert.strictEqual(surge.name, 'Binary Surge');
  assert.strictEqual(surge.type, 'electrical');
  assert.strictEqual(surge.missRetry, true);
  assert.ok(surge.retryMs < 180);
  assert.strictEqual(surge.damage, 12.32);
  assert.ok(frameData(surge.duration, surge.cooldown, surge).total < 40);
  const stripped = { speedBuffUntil: 500, attackHasteUntil: 500, bonusHits: 1, bonusPacket: {} };
  stripBuffs(stripped);
  assert.strictEqual(stripped.attackHasteUntil, 0);
  assert.strictEqual(stripped.speedBuffUntil, 0);
});

test('phillip uses the approved phosphorus kit', () => {
  const moves = CHARACTERS.phillip.moves;
  const flare = moves.basicCharge;
  assert.strictEqual(flare.name, 'Phosphor Flare');
  assert.strictEqual(flare.type, 'heat');
  assert.strictEqual(flare.type2, 'chemical');
  assert.strictEqual(flare.rain, 5);
  assert.ok(flare.chargeSpreadMult > 1);
  assert.strictEqual(flare.chargeDamageMult, undefined);
  assert.ok(frameData(flare.duration, flare.cooldown, flare).total < 40);
  const tracers = moves.basicDirectional;
  assert.strictEqual(tracers.name, 'Tracers');
  assert.strictEqual(tracers.type, 'heat');
  assert.strictEqual(tracers.type2, 'kinetic');
  assert.strictEqual(tracers.salvo, 5);
  assert.strictEqual(tracers.trailMs, 500);
  assert.ok(frameData(tracers.duration, tracers.cooldown, tracers).total < 35);
  const form = moves.specialDefense;
  assert.strictEqual(form.name, 'Red Phosphorus Form');
  assert.deepStrictEqual(form.blocks, ['heat', 'chemical']);
  assert.strictEqual(form.rooted, true);
  assert.strictEqual(form.stripBlocked, true);
  assert.ok(form.cooldown < 400);
  const guard = { state: 'defending', defenseMove: form, facing: 1, x: 100, y: 400, bodyH: 100 };
  const foe = { x: 180, y: 400 };
  assert.strictEqual(interceptHit(guard, foe, { type: 'heat', damage: 8 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'chemical', damage: 8 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, foe, { type: 'kinetic', damage: 8 }, 0).result, 'pass');
  const mixed = interceptHit(guard, foe, { type: 'heat', damage: 4, type2: 'kinetic', damage2: 5 }, 0);
  assert.strictEqual(mixed.result, 'pass');
  assert.deepStrictEqual(mixed.stripTypes, ['heat']);
  const thrown = moves.specialDirectional;
  assert.strictEqual(thrown.name, 'Spontaneous Ignition');
  assert.strictEqual(thrown.kind, 'projectile');
  assert.strictEqual(thrown.type, 'kinetic');
  assert.strictEqual(thrown.onHit.burn.dps, 1);
  assert.strictEqual(thrown.onHit.burn.every, 1000);
  assert.strictEqual(thrown.onHit.burn.untilKo, true);
  assert.ok(frameData(thrown.duration, thrown.cooldown, thrown).total < 40);
  const victim = { percent: 10, scene: { noteDot() {} } };
  applyOnHit(null, victim, thrown, 0);
  assert.strictEqual(victim.percent, 10);
  assert.strictEqual(victim.burnSticky, true);
  tickKit(victim, 1000);
  assert.strictEqual(victim.percent, 11);
  tickKit(victim, 1500);
  assert.strictEqual(victim.percent, 11);
  tickKit(victim, 2000);
  assert.strictEqual(victim.percent, 12);
  stripBuffs(victim);
  cleanse(victim, ['burn']);
  assert.strictEqual(victim.burnSticky, true);
  tickKit(victim, 3000);
  assert.strictEqual(victim.percent, 13);
  applyOnHit(null, victim, { onHit: { burn: { dps: 9, every: 200, ms: 400 } } }, 3000);
  assert.strictEqual(victim.burnDps, 1);
  victim.burnUntil = 0;
  victim.burnSticky = false;
  tickKit(victim, 4000);
  assert.strictEqual(victim.percent, 13);
  assert.strictEqual(victim.state, undefined);
  const flora = { charDef: CHARACTERS.flora };
  const kyle = { charDef: CHARACTERS.kyle, percent: 0, scene: { noteDot() {} } };
  const oxana = { charDef: CHARACTERS.oxana, percent: 0, scene: { noteDot() {} } };
  const noble = { charDef: CHARACTERS.neo, percent: 0, scene: { noteDot() {} } };
  const poison = { onHit: { poison: { dps: 2, ms: 2000 } } };
  applyOnHit(flora, kyle, poison, 0);
  applyOnHit(flora, oxana, poison, 0);
  applyOnHit(flora, noble, poison, 0);
  assert.ok(kyle.poisonDps > oxana.poisonDps);
  assert.strictEqual(noble.poisonDps, 0);
  tickKit(noble, 280);
  assert.strictEqual(noble.percent, 0);
});

test('damage over time only raises percent', () => {
  const fighter = { percent: 12, scene: { noteDot() {} } };
  assert.strictEqual(applyDot(fighter, 1, 'heat'), 1);
  assert.strictEqual(fighter.percent, 13);
  assert.strictEqual(fighter.state, undefined);
  assert.strictEqual(fighter.hitlagFrames, undefined);
  const lit = {
    percent: 4,
    unquenchableUntil: 9000,
    _unquenchTick: 1000,
    selfDotDps: 1,
    selfDotEvery: 1000,
    selfDotType: 'heat',
    scene: { noteDot() {} },
  };
  tickKit(lit, 1000);
  assert.strictEqual(lit.percent, 5);
  tickKit(lit, 1400);
  assert.strictEqual(lit.percent, 5);
  tickKit(lit, 2000);
  assert.strictEqual(lit.percent, 6);
  assert.strictEqual(lit.state, undefined);
  const attacker = { heatOnHit: 3, heatOnHitUntil: 8000, heatOnHitLeft: Number.POSITIVE_INFINITY };
  assert.strictEqual(bonusPackets(attacker, 1000)[0].damage, 3);
  assert.strictEqual(bonusPackets(attacker, 1200)[0].damage, 3);
  const kept = { unquenchableUntil: 4000, heatOnHitUntil: 4000, burnUntil: 10 };
  stripBuffs(kept);
  assert.strictEqual(kept.unquenchableUntil, 4000);
  assert.strictEqual(kept.heatOnHitUntil, 4000);
  assert.strictEqual(kept.burnUntil, 0);
  const maggie = {
    charDef: CHARACTERS.maggie,
    percent: 0,
    scene: { noteDot() {} },
  };
  lightUnquenchable(maggie, 1000);
  assert.ok(maggie.unquenchableUntil >= 8000);
  assert.strictEqual(maggie.heatOnHit, 3);
  assert.ok(!Number.isFinite(maggie.heatOnHitLeft));
});

test('pilot fighters use the element doc kits', () => {
  assert.deepStrictEqual(
    ['tara', 'wolf', 'rex', 'oz', 'pit'].map((id) => CHARACTERS[id].element),
    ['Tantalum', 'Tungsten', 'Rhenium', 'Osmium', 'Platinum'],
  );
  assert.strictEqual(CHARACTERS.tara.moves.basicCharge.name, 'Capacitor Dump');
  assert.strictEqual(CHARACTERS.wolf.moves.basicDirectional.name, 'Tin Eater');
  assert.strictEqual(CHARACTERS.rex.moves.specialDefense.name, 'Creep Resistance');
  assert.strictEqual(CHARACTERS.oz.moves.specialDirectional.name, 'Tetroxide Puff');
  assert.strictEqual(CHARACTERS.pit.moves.specialDefense.name, 'Cisplatin Clamp');
  assert.ok(CHARACTERS.oz.combat.weight >= CHARACTERS.chroma.combat.weight);
  assert.ok(CHARACTERS.oz.combat.speed <= CHARACTERS.chroma.combat.speed);
  assert.strictEqual(CHARACTERS.tara.moves.specialDefense.immune[0], 'chemical');
  assert.strictEqual(CHARACTERS.wolf.moves.specialDefense.immune[0], 'heat');
});

test('batch 2 kits match the edited move doc', () => {
  const tide = CHARACTERS.lillie.moves.specialDirectional;
  assert.strictEqual(tide.type, 'kinetic');
  assert.strictEqual(tide.type2, 'chemical');
  assert.strictEqual(tide.type3, 'heat');
  assert.strictEqual(tide.pop, undefined);
  assert.strictEqual(tide.carry, true);
  const whip = CHARACTERS.allen.moves.basicDirectional;
  assert.ok(whip.pull > 0);
  assert.strictEqual(whip.multiHit, undefined);
  const helen = CHARACTERS.helen.moves;
  assert.strictEqual(helen.basicCharge.kind, 'projectile');
  assert.strictEqual(helen.basicDirectional.damage < 8, true);
  assert.strictEqual(helen.specialDirectional.angleable, true);
  assert.strictEqual(helen.specialDirectional.lift, true);
  assert.strictEqual(helen.specialDefense.kind, 'shield');
  const kyle = CHARACTERS.kyle.moves;
  assert.strictEqual(kyle.basicCharge.maxChargeMs, 1500);
  assert.strictEqual(kyle.basicCharge.fizzleBelow, 1);
  assert.strictEqual(kyle.basicCharge.roll, true);
  const peel = kyle.specialDirectional;
  assert.strictEqual(peel.name, 'Banana Peel');
  assert.strictEqual(peel.zone.type, 'radiation');
  assert.strictEqual(peel.zone.trap, true);
  assert.strictEqual(peel.zone.solo, true);
  assert.strictEqual(peel.zone.trip, true);
  assert.strictEqual(peel.zone.angleDeg, 0);
  assert.ok(peel.zone.damage < 2);
  const melt = CHARACTERS.gail.moves.specialDefense;
  assert.strictEqual(melt.name, 'Melt Down');
  assert.strictEqual(melt.intangible, true);
  assert.strictEqual(melt.puddle, true);
  const shards = CHARACTERS.arsenio.moves.specialDirectional;
  assert.strictEqual(shards.name, 'Gray Arsenic Shards');
  assert.strictEqual(shards.type, 'kinetic');
  assert.strictEqual(shards.type2, 'chemical');
  assert.strictEqual(shards.explodeOnly, true);
  const gate = CHARACTERS.gertrude.moves.specialDefense;
  assert.strictEqual(gate.name, 'Transistor Gate');
  assert.strictEqual(gate.storeType, 'electrical');
  const stored = gateStored({ type: 'electrical', damage: 6, type2: 'kinetic', damage2: 4 }, 'electrical');
  assert.strictEqual(stored.stored, 6);
  assert.strictEqual(stored.emptied, false);
  assert.strictEqual(stored.move.type2, 'kinetic');
  const only = gateStored({ type: 'electrical', damage: 5 }, 'electrical');
  assert.strictEqual(only.emptied, true);
  const fey = CHARACTERS.fey.moves.specialDirectional;
  assert.strictEqual(fey.name, 'Thermite');
  assert.strictEqual(fey.breaksBlock, undefined);
  assert.strictEqual(fey.onHit.burn.dps, 3);
  assert.strictEqual(fey.onHit.burn.ms, 3500);
  assert.strictEqual(CHARACTERS.fey.moves.specialDefense.catchMetals, true);
  assert.strictEqual(CHARACTERS.scarlett.moves.specialDirectional.name, 'Micro Rocket');
  assert.strictEqual(CHARACTERS.scarlett.moves.specialDirectional.kind, 'projectile');
  assert.strictEqual(CHARACTERS.cal.moves.specialDirectional.name, 'Slime Splash');
  assert.strictEqual(CHARACTERS.cal.moves.specialDefense.wallLingerMs, 7000);
  assert.strictEqual(CHARACTERS.cooper.moves.basicCharge.name, 'Tesla Coil');
  assert.strictEqual(CHARACTERS.cooper.moves.specialDirectional.name, 'Bronze Sword');
  assert.strictEqual(CHARACTERS.aaron.moves.basicCharge.kind, 'buff');
  assert.strictEqual(CHARACTERS.aaron.moves.basicCharge.buff.ms, 10000);
  assert.strictEqual(CHARACTERS.selena.moves.specialDefense.copyMove, true);
  assert.strictEqual(CHARACTERS.selena.moves.basicDirectional.replayCapture, undefined);
  assert.strictEqual(CHARACTERS.zane.moves.specialDefense.lockAttackMs, 10000);
  assert.strictEqual(CHARACTERS.zane.moves.specialDefense.drain.damage, 1);
  assert.strictEqual(CHARACTERS.gertrude.moves.basicCharge.predict.lead, 1);
  assert.strictEqual(CHARACTERS.gertrude.moves.basicDirectional.echoMult, 2);
  assert.strictEqual(CHARACTERS.ruben.moves.specialDirectional.type, 'kinetic');
  assert.strictEqual(CHARACTERS.ruben.moves.specialDirectional.igniteType, 'heat');
  assert.strictEqual(CHARACTERS.ruben.moves.basicCharge.onHit.freeze, 240);
  const guard = {
    state: 'defending', defenseStart: 0, defenseMove: CHARACTERS.van.moves.specialDefense,
    facing: 1, x: 0, y: 0, bodyH: 100,
  };
  assert.strictEqual(interceptHit(guard, { x: 40 }, { type: 'electrical', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(guard, { x: 40 }, { type: 'kinetic', damage: 6 }, 0).result, 'pass');
  const mixed = interceptHit(guard, { x: 40 }, { type: 'electrical', damage: 4, type2: 'kinetic', damage2: 5 }, 0);
  assert.strictEqual(mixed.result, 'pass');
  assert.deepStrictEqual(mixed.stripTypes, ['electrical']);
  const rubber = {
    state: 'defending', defenseMove: CHARACTERS.sully.moves.specialDefense,
    _blockCharges: { chemical: 3, kinetic: 2, heat: 1 },
    facing: 1, x: 0, y: 0, bodyH: 100,
  };
  assert.strictEqual(interceptHit(rubber, { x: 40 }, { type: 'chemical', damage: 4 }, 10).result, 'negate');
  assert.strictEqual(rubber._blockCharges.chemical, 2);
  assert.strictEqual(interceptHit(rubber, { x: 40 }, { type: 'heat', damage: 4 }, 10).result, 'negate');
  assert.strictEqual(interceptHit(rubber, { x: 40 }, { type: 'heat', damage: 4 }, 10).result, 'pass');
  const chrome = {
    state: 'defending', defenseMove: CHARACTERS.chroma.moves.specialDefense,
    facing: 1, x: 0, y: 0, bodyH: 100,
  };
  const scaled = interceptHit(chrome, { x: 40 }, { type: 'heat', damage: 8, type2: 'kinetic', damage2: 6 }, 0);
  assert.strictEqual(scaled.result, 'pass');
  assert.strictEqual(scaled.typeScale.heat, 0.5);
  assert.strictEqual(scaled.typeScale.kinetic, undefined);
});

test('sterling glow ticks radiation and the seeker does not bonus it', () => {
  const moves = CHARACTERS.sterling.moves;
  const seeker = moves.basicCharge;
  assert.strictEqual(seeker.name, 'Bone Seeker');
  assert.strictEqual(seeker.kind, 'projectile');
  assert.strictEqual(seeker.type, 'radiation');
  assert.strictEqual(seeker.homing, 6);
  assert.strictEqual(seeker.bonusVsMark, undefined);
  const hook = moves.basicDirectional;
  assert.strictEqual(hook.name, 'Night-Glow Hook');
  assert.strictEqual(hook.type, 'kinetic');
  assert.strictEqual(hook.damage, 6.4);
  assert.strictEqual(hook.onHit.glow.dps, 1);
  assert.strictEqual(hook.onHit.glow.every, 1000);
  assert.strictEqual(hook.onHit.glow.ms, 4000);
  const glowing = { percent: 10, alive: true, state: 'idle', scene: { noteDot() {} } };
  applyOnHit({ charDef: { id: 'sterling' } }, glowing, hook, 0);
  assert.strictEqual(glowing.mark, 'glow');
  assert.strictEqual(glowing.markUntil, 4000);
  assert.strictEqual(glowing.glowUntil, 4000);
  assert.strictEqual(glowing.glowTint, undefined);
  assert.strictEqual(glowing.clingFrom.move, 'Night-Glow Hook');
  assert.strictEqual(glowing.clingFrom.until, 4000);
  tickKit(glowing, 1000);
  assert.strictEqual(glowing.percent, 11);
  tickKit(glowing, 1500);
  assert.strictEqual(glowing.percent, 11);
  tickKit(glowing, 4000);
  assert.strictEqual(glowing.percent, 11);
  const flare = moves.specialDefense;
  assert.strictEqual(flare.name, 'Road Flare');
  assert.strictEqual(flare.zone.type, 'heat');
  assert.strictEqual(flare.zone.follow, true);
  assert.strictEqual(flare.onStruck.miss, true);
  const rocket = moves.specialDirectional;
  assert.strictEqual(rocket.name, 'Crimson Rocket');
  assert.strictEqual(rocket.type, 'heat');
  assert.strictEqual(rocket.type2, 'kinetic');
});

test('cody rods block kinetic and the paint coat is two percent for seven seconds', () => {
  const moves = CHARACTERS.cody.moves;
  const dot = moves.basicCharge;
  assert.strictEqual(dot.name, 'Quantum Dot');
  assert.strictEqual(dot.chargeSpeedMult, 0.42);
  assert.strictEqual(dot.chargeDamageMult, 2.3);
  assert.deepStrictEqual(dot.redFrames, [3, 4, 5, 6, 7, 8, 18, 19, 20]);
  assert.strictEqual(sheetFrameAt(dot, 0, 1000 / 9.6 * 4), 4);
  assert.strictEqual(withRedFrame(dot, 4).damage, 4.5);
  assert.strictEqual(withRedFrame(dot, 0).damage, 3);
  const rods = moves.specialDefense;
  const guard = { state: 'defending', defenseMove: rods, x: 0, y: 0 };
  assert.strictEqual(applyImmunities({ type: 'radiation', damage: 8 }, rods).emptied, true);
  assert.strictEqual(interceptHit(guard, { x: 40 }, { type: 'kinetic', damage: 6 }, 0).result, 'negate');
  const heat = interceptHit(guard, { x: 40 }, { type: 'heat', damage: 6 }, 0);
  assert.strictEqual(heat.result, 'partial');
  assert.strictEqual(heat.reduction, 0.45);
  assert.strictEqual(interceptHit(guard, { x: 40 }, { type: 'electrical', damage: 6 }, 0).result, 'pass');
  const paint = moves.specialDirectional;
  assert.strictEqual(paint.onHit.poison.dps, 2);
  assert.strictEqual(paint.onHit.poison.every, 1000);
  assert.strictEqual(paint.onHit.poison.ms, 7000);
  assert.strictEqual(paint.onHit.poison.flat, true);
  assert.strictEqual(paint.onHit.slow, 7000);
  assert.strictEqual(paint.onHit.coatMs, 7000);
  const coated = { percent: 10, alive: true, state: 'idle', scene: { noteDot() {} } };
  applyOnHit({ charDef: { id: 'cody' } }, coated, paint, 0);
  assert.strictEqual(coated.slowUntil, 7000);
  assert.strictEqual(coated.clingFrom.until, 7000);
  tickKit(coated, 1000);
  assert.strictEqual(coated.percent, 12);
  tickKit(coated, 7000);
  assert.strictEqual(coated.percent, 12);
});

test('ruth swaps whoever touches the line and the hook ignores armor', () => {
  const moves = CHARACTERS.ruth.moves;
  assert.strictEqual(moves.basicCharge.name, 'Sunlight Dye');
  assert.strictEqual(moves.basicCharge.kind, 'beam');
  assert.strictEqual(moves.basicCharge.type, 'electrical');
  const hook = moves.basicDirectional;
  assert.strictEqual(hook.name, 'Hardener Hook');
  assert.strictEqual(hook.ignoreReductions, true);
  assert.strictEqual(hook.breaksBlock, true);
  const swap = moves.specialDefense;
  assert.strictEqual(swap.name, 'Metathesis Swap');
  assert.strictEqual(swap.swapLine, true);
  assert.strictEqual(swap.kind, undefined);
  const ruth = { x: 200, y: 400, bodyH: 80, bodyW: 40, facing: 1, alive: true };
  const ahead = { id: 'ahead', x: 520, y: 400, bodyH: 80, bodyW: 40, alive: true, state: 'idle' };
  const above = { id: 'above', x: 360, y: 200, bodyH: 80, bodyW: 40, alive: true, state: 'idle' };
  const behind = { id: 'behind', x: 40, y: 400, bodyH: 80, bodyW: 40, alive: true, state: 'idle' };
  assert.strictEqual(fighterOnSwapLine(ruth, [above, behind, ahead], 1200).id, 'ahead');
  assert.strictEqual(fighterOnSwapLine(ruth, [above, behind], 1200), null);
  const crack = moves.specialDirectional;
  assert.strictEqual(crack.name, 'Ammonia Crack');
  assert.strictEqual(crack.type, 'chemical');
  assert.strictEqual(crack.kind, 'burst');
  assert.ok(crack.coneDeg > 0);
  assert.strictEqual(crack.zone.type, 'chemical');
  assert.ok(crack.zone.ms >= 1000);
});

test('niobe pulse locks a special for fifteen seconds and the stone stays put', () => {
  const moves = CHARACTERS.niobe.moves;
  const ring = moves.basicCharge;
  assert.strictEqual(ring.name, 'Particle Ring');
  assert.strictEqual(ring.kind, 'beam');
  assert.strictEqual(ring.type, 'electrical');
  assert.strictEqual(ring.type2, 'radiation');
  assert.strictEqual(ring.damage, 3.51);
  assert.strictEqual(ring.damage2, 2.96);
  const edge = moves.basicDirectional;
  assert.strictEqual(edge.name, 'Anodized Edge');
  assert.strictEqual(edge.sharpen.step, 1);
  assert.strictEqual(edge.sharpen.cap, 5);
  assert.strictEqual(anodizeTint(1, edge.sharpen), 0x6ec8ff);
  assert.strictEqual(anodizeTint(6, edge.sharpen), 0xf0c14a);
  const stone = moves.specialDefense;
  assert.strictEqual(stone.name, 'Weeping Stone');
  assert.strictEqual(stone.rooted, true);
  assert.strictEqual(stone.noKnockback, true);
  assert.strictEqual(stone.blockReduction, 0.82);
  assert.deepStrictEqual(stone.onlyReduce, ['kinetic', 'heat']);
  const pulse = moves.specialDirectional;
  assert.strictEqual(pulse.name, 'MRI Pulse');
  assert.strictEqual(pulse.kind, 'beam');
  assert.strictEqual(pulse.type, 'electrical');
  assert.strictEqual(pulse.type2, undefined);
  assert.ok(pulse.damage < ring.damage);
  assert.strictEqual(pulse.onHit.muteSpecialMs, 15000);
  const victim = { state: 'idle' };
  applyOnHit({ charDef: { id: 'niobe' } }, victim, pulse, 400);
  assert.strictEqual(victim.specialMutedUntil, 15400);
  const punch = CHARACTERS.tessa.moves.basicCharge;
  assert.strictEqual(punch.name, 'Peltier Punch');
  assert.strictEqual(punch.buff.heatTaken, 0.6);
  assert.strictEqual(punch.buff.ms, 2000);
  const tessa = { charDef: { id: 'tessa' }, percent: 0 };
  applyOnCast(tessa, punch, 1000);
  assert.strictEqual(tessa.heatResistUntil, 3000);
  assert.strictEqual(tessa.buffCling.move, 'Peltier Punch');
  assert.strictEqual(tessa.buffCling.until, 3000);
});

test('tex tags for ten seconds and the camera hits every tag', () => {
  const moves = CHARACTERS.tex.moves;
  const flash = moves.basicCharge;
  assert.strictEqual(flash.name, 'Metastable Flash');
  assert.strictEqual(flash.kind, 'burst');
  assert.strictEqual(flash.type, 'radiation');
  assert.strictEqual(flash.damage, 14);
  const lasso = moves.basicDirectional;
  assert.strictEqual(lasso.name, 'Tracer Lasso');
  assert.strictEqual(lasso.type, 'kinetic');
  assert.strictEqual(lasso.type2, 'radiation');
  assert.strictEqual(lasso.damage, 7);
  assert.strictEqual(lasso.damage2, 7);
  assert.strictEqual(lasso.breakPhase, true);
  assert.strictEqual(lasso.onHit.mark, 'tracer');
  assert.strictEqual(lasso.onHit.markMs, 10000);
  assert.strictEqual(lasso.onHit.reveal, true);
  const tagged = { alive: true, state: 'idle' };
  applyOnHit({ charDef: { id: 'tex' } }, tagged, lasso, 1000);
  assert.strictEqual(tagged.mark, 'tracer');
  assert.strictEqual(tagged.markUntil, 11000);
  assert.strictEqual(tagged.markedBy, 'tex');
  assert.strictEqual(tagged.revealedUntil, 11000);
  assert.strictEqual(tagged.phasingUntil, 0);
  assert.strictEqual(visibleAlpha(tagged, 10999, 0.15), 1);
  assert.strictEqual(visibleAlpha(tagged, 11000, 0.15), 0.15);
  cleanse(tagged, ['mark']);
  assert.strictEqual(tagged.markUntil, 0);
  assert.strictEqual(tagged.revealedUntil, 0);

  const draw = moves.specialDefense;
  assert.strictEqual(draw.name, 'Quick Draw');
  assert.strictEqual(draw.kind, 'counter');
  const guard = { state: 'defending', defenseMove: draw, facing: 1, x: 0, y: 0, bodyH: 116 };
  const answer = interceptHit(guard, { x: 80, y: 0 }, { type: 'kinetic', damage: 9 }, 0);
  assert.strictEqual(answer.result, 'counter');
  assert.strictEqual(answer.counter.type, 'radiation');
  assert.strictEqual(answer.counter.damage, 7);
  assert.strictEqual(answer.counter.isCounterAttack, true);

  const camera = moves.specialDirectional;
  assert.strictEqual(camera.name, 'Gamma Camera');
  assert.strictEqual(camera.kind, 'beam');
  assert.strictEqual(camera.type, 'radiation');
  assert.strictEqual(camera.damage, 11);
  assert.strictEqual(camera.hitMarked, 'tracer');
  const tex = { charDef: { id: 'tex' }, alive: true, state: 'idle' };
  const near = { alive: true, state: 'idle', mark: 'tracer', markUntil: 5000, markedBy: 'tex' };
  const far = { alive: true, state: 'defending', mark: 'tracer', markUntil: 5000, markedBy: 'tex' };
  const other = { alive: true, state: 'idle', mark: 'tracer', markUntil: 5000, markedBy: 'ivy' };
  const expired = { alive: true, state: 'idle', mark: 'tracer', markUntil: 1000, markedBy: 'tex' };
  const struck = new Set([near]);
  const extra = markedStrikeTargets(tex, camera, [tex, near, far, other, expired], 2000, struck);
  assert.deepStrictEqual(extra, [far]);
  const hiding = {
    state: 'defending',
    defenseMove: { phase: true, fadeAlpha: 0.15 },
    facing: 1, x: 400, y: 0, bodyH: 116,
  };
  assert.strictEqual(interceptHit(hiding, tex, { ...camera, hitsRevealed: true }, 0).result, 'pass');
  assert.strictEqual(interceptHit(hiding, tex, camera, 0).result, 'negate');
});

test('molly launches a greased block and keeps the rod and the enzyme cloud', () => {
  const moves = CHARACTERS.molly.moves;
  const rod = moves.basicCharge;
  assert.strictEqual(rod.name, 'Red-Hot Rod');
  assert.strictEqual(rod.kind, 'beam');
  assert.strictEqual(rod.type, 'kinetic');
  assert.strictEqual(rod.type2, 'heat');
  assert.strictEqual(rod.damage, 6);
  assert.strictEqual(rod.damage2, 7);
  const slide = moves.basicDirectional;
  assert.strictEqual(slide.name, 'Grease Slide');
  assert.strictEqual(slide.kind, 'projectile');
  assert.strictEqual(slide.ground, true);
  assert.strictEqual(slide.trip, true);
  assert.strictEqual(slide.tripMs, 680);
  assert.strictEqual(slide.damage, 7);
  const lube = moves.specialDefense;
  assert.strictEqual(lube.name, 'Dry Lube');
  assert.strictEqual(lube.blockReduction, 0.4);
  assert.strictEqual(lube.noKnockback, true);
  assert.deepStrictEqual(lube.onlyReduce, ['kinetic']);
  const cloud = moves.specialDirectional;
  assert.strictEqual(cloud.name, 'Nitrogenase');
  assert.strictEqual(cloud.kind, 'zone');
  assert.strictEqual(cloud.zone.bonusVsId.nitra, 2);
  assert.strictEqual(cloud.zone.sheet, true);
  assert.strictEqual(cloud.zone.damage, 0.7);
});

test('agatha reflects heat, electricity, and radiation and tarnishes for two percent', () => {
  const moves = CHARACTERS.agatha.moves;
  const bullet = moves.basicCharge;
  assert.strictEqual(bullet.name, 'Silver Bullet');
  assert.strictEqual(bullet.damage, 5);
  assert.strictEqual(bullet.bonusVsBuff, 1.75);
  const slash = moves.basicDirectional;
  assert.strictEqual(slash.name, 'Current Slash');
  assert.strictEqual(slash.type, 'kinetic');
  assert.strictEqual(slash.type2, 'electrical');
  assert.strictEqual(slash.damage, 4);
  assert.strictEqual(slash.damage2, 3);
  const mirror = moves.specialDefense;
  assert.strictEqual(mirror.name, 'Mirror Flash');
  assert.deepStrictEqual(mirror.reflectTypes, ['heat', 'electrical', 'radiation']);
  assert.strictEqual(mirror.reflectPower, 1);
  const agatha = { x: 0, y: 0, state: 'defending', defenseMove: mirror };
  const heat = interceptHit(agatha, { x: 40, y: 0 }, { type: 'heat', damage: 8 }, 0);
  assert.strictEqual(heat.result, 'counter');
  assert.strictEqual(heat.negate, true);
  assert.strictEqual(heat.counter.damage, 8);
  assert.strictEqual(heat.counter.type, 'heat');
  const kinetic = interceptHit(agatha, { x: 40, y: 0 }, { type: 'kinetic', damage: 8 }, 0);
  assert.strictEqual(kinetic.result, 'pass');
  const tarnish = moves.specialDirectional;
  assert.strictEqual(tarnish.name, 'Tarnish Cloud');
  assert.strictEqual(tarnish.zone.flat, true);
  assert.strictEqual(tarnish.zone.percentOnly, true);
  assert.strictEqual(tarnish.zone.damage, 2);
  assert.strictEqual(tarnish.zone.ms, 7000);
  assert.strictEqual(tarnish.zone.tick, 1000);
  assert.strictEqual(tarnish.zone.onHit.corrode.mult, 0.7);
  assert.strictEqual(tarnish.zone.onHit.corrode.ms, 7000);
  const open = resolvePacket(10, 'kinetic', null, { kineticDef: 0.5 }, {});
  const etched = resolvePacket(10, 'kinetic', null, { kineticDef: 0.5 }, { kinDefMult: 0.7 });
  assert.ok(etched > open);
  assert.ok(Math.abs(etched - 6.5) < 1e-6);
});

test('indy films the floor, roots with no knockback, and weakens electrical defense', () => {
  const moves = CHARACTERS.indy.moves;
  const film = moves.basicCharge;
  assert.strictEqual(film.name, 'Invisible Film');
  assert.strictEqual(film.kind, 'zone');
  assert.strictEqual(film.zone.ms, 10000);
  assert.strictEqual(film.zone.feet, true);
  assert.strictEqual(film.zone.type, 'electrical');
  const seal = moves.basicDirectional;
  assert.strictEqual(seal.name, 'Sticky Seal');
  assert.strictEqual(seal.onHit.root, 3000);
  assert.strictEqual(seal.baseKnockback, 0);
  assert.strictEqual(seal.knockbackGrowth, 0);
  const putty = moves.specialDefense;
  assert.strictEqual(putty.name, 'Putty Guard');
  assert.strictEqual(putty.blockReduction, 0.5);
  assert.strictEqual(putty.noKnockback, true);
  assert.deepStrictEqual(putty.onlyReduce, ['kinetic']);
  const whip = moves.specialDirectional;
  assert.strictEqual(whip.name, 'Solder Whip');
  assert.strictEqual(whip.kind, 'projectile');
  assert.strictEqual(whip.type, 'heat');
  assert.strictEqual(whip.type2, undefined);
  assert.strictEqual(whip.damage, 6);
  assert.strictEqual(whip.onHit.elecTaken.ms, 5000);
  const victim = { state: 'idle' };
  applyOnHit({ charDef: { id: 'indy' } }, victim, whip, 1000);
  assert.strictEqual(victim.elecTakenMult, 1.4);
  assert.strictEqual(victim.elecTakenUntil, 6000);
  const base = resolvePacket(10, 'electrical', null, {}, {});
  const weak = resolvePacket(10, 'electrical', null, {}, { elecTakenMult: 1.4 });
  assert.ok(Math.abs(weak - base * 1.4) < 1e-6);
});

test('saab sniper charge pierces defense and the dust cough slows attacks', () => {
  const moves = CHARACTERS.saab.moves;
  const sniper = moves.basicCharge;
  assert.strictEqual(sniper.name, 'Sniper Round');
  assert.strictEqual(sniper.chargeDamageMult, 2.2);
  assert.strictEqual(sniper.chargePierce, 1);
  assert.strictEqual(sniper.chargeBright, true);
  assert.strictEqual(sniper.pierce, undefined);
  const bare = resolvePacket(10, 'kinetic', null, { kineticDef: 0.5 }, {});
  const half = resolvePacket(10, 'kinetic', null, { kineticDef: 0.5 }, { pierce: 0.5 });
  const full = resolvePacket(10, 'kinetic', null, { kineticDef: 0.5 }, { pierce: 1 });
  assert.ok(Math.abs(bare - 5) < 1e-6);
  assert.ok(Math.abs(half - 7.5) < 1e-6);
  assert.ok(Math.abs(full - 10) < 1e-6);
  const dust = moves.basicDirectional;
  assert.strictEqual(dust.name, 'Toxic Dust Cloud');
  assert.strictEqual(dust.type, 'chemical');
  assert.strictEqual(dust.onHit.slow, 2200);
  assert.strictEqual(dust.onHit.attackSlow.ms, 2200);
  assert.strictEqual(dust.onHit.coatMs, 2200);
  const coughing = { state: 'idle' };
  applyOnHit({ charDef: { id: 'saab' } }, coughing, dust, 400);
  assert.strictEqual(coughing.attackHaste, 0.72);
  assert.strictEqual(coughing.attackHasteUntil, 2600);
  assert.strictEqual(coughing.clingFrom.move, 'Toxic Dust Cloud');
  assert.strictEqual(coughing.clingFrom.until, 2600);
  const slowed = scaledByHaste({ duration: 200, cooldown: 400, startupF: 4, endlagF: 6, activeF: 3 }, 0.72);
  assert.ok(slowed.duration > 200);
  const coat = moves.specialDefense;
  assert.strictEqual(coat.name, 'Flame Retardant');
  assert.deepStrictEqual(coat.immune, ['heat']);
  assert.ok(coat.cleanse.includes('burn'));
  const needles = moves.specialDirectional;
  assert.strictEqual(needles.name, 'Stibnite Needles');
  assert.strictEqual(needles.fan, 4);
  assert.strictEqual(needles.oneArt, true);
  assert.strictEqual(needles.bonusVsMark, undefined);
});

test('batch 11 kits follow the approved briefs', () => {
  const tessa = CHARACTERS.tessa.moves;
  assert.strictEqual(tessa.specialDirectional.floor, true);
  assert.strictEqual(tessa.specialDirectional.ground, undefined);
  assert.strictEqual(tessa.specialDefense.kind, 'shield');
  assert.strictEqual(tessa.specialDefense.healOnBlock, 7);

  const iona = CHARACTERS.iona.moves;
  assert.strictEqual(iona.basicDirectional.name, 'Iodine Spray');
  assert.strictEqual(iona.basicDirectional.onHit.heal, 2);
  assert.strictEqual(iona.specialDefense.cleanse, undefined);
  assert.strictEqual(iona.specialDefense.clearType, 'radiation');
  assert.deepStrictEqual(iona.specialDefense.immune, ['radiation']);
  assert.strictEqual(iona.specialDirectional.kind, 'zone');
  assert.strictEqual(iona.specialDirectional.zone.trap, true);
  assert.strictEqual(iona.specialDirectional.zone.type2, 'heat');

  const xander = CHARACTERS.xander.moves;
  assert.strictEqual(xander.basicCharge.kind, 'projectile');
  assert.strictEqual(xander.basicCharge.type, 'electrical');
  assert.strictEqual(xander.basicCharge.type2, 'heat');
  assert.strictEqual(xander.basicCharge.recoilSelf, 240);
  assert.strictEqual(xander.basicDirectional.damage, 4.2);
  assert.strictEqual(xander.specialDirectional.kind, 'projectile');
  assert.strictEqual(xander.specialDefense.retort.stun, 420);

  const caesar = CHARACTERS.caesar.moves;
  assert.strictEqual(caesar.basicCharge.damage, 0);
  assert.strictEqual(caesar.basicCharge.onHit.freeze, 1000);
  assert.strictEqual(caesar.basicCharge.chargeControlMult, 3);
  assert.strictEqual(caesar.basicDirectional.hyperArmor, true);
  assert.ok(caesar.basicDirectional.dashSpeed < 400);
  assert.ok(caesar.basicDirectional.damage >= 12);
  assert.strictEqual(caesar.specialDirectional.dropZone.ms, 10000);
  assert.strictEqual(caesar.specialDirectional.dropZone.sheet, true);

  const barry = CHARACTERS.barry.moves;
  assert.strictEqual(barry.basicCharge.kind, 'dive');
  assert.strictEqual(barry.basicCharge.slamAtFeet, true);
  assert.strictEqual(barry.specialDefense.chalkTint, 0xe2e4d6);
  assert.strictEqual(barry.specialDefense.weightMult, 1.45);
  assert.deepStrictEqual(barry.specialDefense.immune, ['radiation']);
  assert.strictEqual(barry.specialDirectional.floor, true);
  assert.strictEqual(barry.specialDirectional.floorLift, 0.22);

  const lana = CHARACTERS.lana.moves;
  assert.strictEqual(lana.basicCharge.perTravel, 140);
  assert.strictEqual(lana.specialDefense.name, 'Hydrogen Sponge');
  assert.strictEqual(lana.specialDefense.reflectProjectiles, undefined);
  assert.strictEqual(lana.specialDefense.sponge.keep, 0.4);
  assert.strictEqual(lana.specialDirectional.kind, 'projectile');
  assert.strictEqual(lana.specialDirectional.onHit.corrode.mult, 0.68);
  assert.strictEqual(lana.specialDirectional.onHit.chemVulnerable, 1.4);
  const cracked = { state: 'idle' };
  applyOnHit({ charDef: { id: 'lana' } }, cracked, lana.specialDirectional, 500);
  assert.strictEqual(cracked.kinDefMult, 0.68);
  assert.strictEqual(cracked.chemVulnerableMult, 1.4);
  const open = resolvePacket(10, 'chemical', null, {}, {});
  const soft = resolvePacket(10, 'chemical', null, {}, { chemTakenMult: 1.4 });
  assert.ok(Math.abs(soft - open * 1.4) < 1e-6);

  const indy = CHARACTERS.indy.moves.specialDefense;
  assert.strictEqual(indy.name, 'Putty Guard');
  assert.strictEqual(indy.blockReduction, 0.5);
  assert.strictEqual(indy.noKnockback, true);
});

test('prometheus and sam kits follow the approved brief', () => {
  const prom = CHARACTERS.prometheus.moves;
  const fire = prom.basicCharge;
  assert.strictEqual(fire.name, 'Stolen Fire');
  assert.strictEqual(fire.type, 'kinetic');
  assert.strictEqual(fire.damage, 4);
  assert.strictEqual(fire.type2, 'heat');
  assert.strictEqual(fire.damage2, 4);
  assert.strictEqual(fire.stealHeat.cap, 14);
  assert.strictEqual(fire.stealHeat.keep, 0.85);
  const rock = prom.specialDefense;
  assert.strictEqual(rock.name, 'Chained to the Rock');
  assert.strictEqual(rock.noKnockback, true);
  assert.strictEqual(rock.rooted, true);
  assert.strictEqual(rock.regen, 3);
  const battery = prom.specialDirectional;
  assert.strictEqual(battery.name, 'Beta Battery');
  assert.strictEqual(battery.kind, 'projectile');
  assert.strictEqual(battery.zone, undefined);
  assert.strictEqual(battery.onHit.glow.dps, 1);
  assert.strictEqual(battery.onHit.glow.every, 1000);
  assert.strictEqual(battery.onHit.glow.ms, 10000);
  assert.strictEqual(battery.onHit.glow.immediate, true);
  const stuck = {
    percent: 20, alive: true, state: 'idle', x: 100, y: 200, bodyH: 80,
    scene: { noteDot() {} },
  };
  applyOnHit(
    { charDef: { id: 'prometheus' } },
    stuck,
    { ...battery, _hitAt: { x: 120, y: 160 } },
    0,
  );
  assert.strictEqual(stuck.glowTick, 0);
  assert.strictEqual(stuck.glowUntil, 10000);
  assert.strictEqual(stuck.stuckFrom.ox, 20);
  assert.strictEqual(stuck.stuckFrom.oy, -40);
  assert.strictEqual(stuck.stuckFrom.until, 10000);
  for (let t = 0; t <= 10000; t += 1000) tickKit(stuck, t);
  assert.strictEqual(stuck.percent, 30);
  const holder = {
    charDef: CHARACTERS.prometheus,
    lastPackets: [{ type: 'heat', dealt: 10 }, { type: 'kinetic', dealt: 4 }],
  };
  bankStolenPackets(holder);
  assert.ok(Math.abs(holder._storedHeat - 8.5) < 1e-6);
  holder.lastPackets = [{ type: 'heat', dealt: 20 }];
  bankStolenPackets(holder);
  assert.strictEqual(holder._storedHeat, 14);
  const dot = { charDef: CHARACTERS.prometheus, percent: 0, scene: { noteDot() {} } };
  applyDot(dot, 4, 'heat');
  assert.ok(Math.abs(dot._storedHeat - 3.4) < 1e-6);

  const magnet = CHARACTERS.sam.moves.basicCharge;
  assert.strictEqual(magnet.name, 'Heatproof Magnet');
  assert.strictEqual(magnet.kind, 'burst');
  assert.strictEqual(magnet.type, 'kinetic');
  assert.strictEqual(magnet.damage, 5);
  assert.strictEqual(magnet.type2, 'heat');
  assert.strictEqual(magnet.damage2, 4);
  assert.strictEqual(magnet.pull.metals, true);
  assert.ok(magnet.pull.radius >= 1600);
  assert.ok(magnet.chargeRadiusMult > 1);
  assert.strictEqual(magnet.offsetX, 24);
  assert.strictEqual(prom.basicDirectional.name, 'Torchbearer Swing');
  const duck = CHARACTERS.sam.moves.specialDefense;
  assert.strictEqual(duck.phase, 'overhead');
  assert.strictEqual(duck.shrink, 0.5);
  const toss = CHARACTERS.sam.moves.specialDirectional;
  assert.strictEqual(toss.returns, true);
  assert.strictEqual(toss.aimStick, true);
  assert.deepStrictEqual(stickAim({}, 1), { x: 1, y: 0 });
  assert.deepStrictEqual(stickAim({ left: true }, 1), { x: -1, y: 0 });
  assert.deepStrictEqual(stickAim({ jump: true }, 1), { x: 0, y: -1 });
  const diag = stickAim({ up: true, right: true }, -1);
  assert.ok(Math.abs(diag.x - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(diag.y + Math.SQRT1_2) < 1e-9);
});

function fake(id, x, y) {
  return {
    x, y, alive: true, state: 'idle', charDef: CHARACTERS[id], bodyW: 60, bodyH: 110,
    airJumpsLeft: 1,
    body: {
      blocked: { down: true, left: false, right: false },
      touching: { down: false, left: false, right: false },
      velocity: { x: 0, y: 0 },
    },
  };
}
