import test from 'node:test';
import { frameData, STEP_MS } from '../src/engine/feel.js';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import { computeBotInput } from '../src/engine/BotAI.js';
import { gateStored, interceptHit } from '../src/engine/defense.js';
import { applyDot, applyOnCast, applyOnHit, bonusPackets, cleanse, lightUnquenchable, scaledByHaste, stripBuffs, tickKit, withShatter } from '../src/engine/kit.js';
import { rearmDefense } from '../src/engine/defense.js';

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
