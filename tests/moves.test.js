import test from 'node:test';
import { frameData, STEP_MS } from '../src/engine/feel.js';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import { computeBotInput } from '../src/engine/BotAI.js';
import { gateStored, interceptHit } from '../src/engine/defense.js';
import { anodizeTint, applyDot, applyOnCast, applyOnHit, bonusPackets, cleanse, fighterInView, fighterOnSwapLine, finalBlow, grantTonic, halfLifeScale, lightUnquenchable, markedStrikeTargets, prepareMove, rewindPoint, scaledByHaste, sheetFrameAt, slowHitScale, stripBuffs, takingDps, tickKit, visibleAlpha, withRedFrame, withShatter } from '../src/engine/kit.js';
import { enGapMult, resolvePacket } from '../src/data/balance.js';
import { applyImmunities, rearmDefense } from '../src/engine/defense.js';

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
  assert.strictEqual(CHARACTERS.wolf.moves.basicDirectional.name, 'Carbide Drill');
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

test('europa kits follow the approved brief', () => {
  const moves = CHARACTERS.europa.moves;
  const check = moves.basicDirectional;
  assert.strictEqual(check.name, 'Counterfeit Check');
  assert.strictEqual(check.type, 'electrical');
  assert.strictEqual(check.stripProtection, true);
  assert.strictEqual(check.cancelInvis, true);
  assert.strictEqual(check.breakPhase, true);
  const sponge = moves.specialDefense;
  assert.strictEqual(sponge.name, 'Neutron Sponge');
  assert.deepStrictEqual(sponge.blocks, ['kinetic', 'radiation']);
  assert.strictEqual(sponge.soakRadiation, true);
  assert.strictEqual(sponge.releaseRods.damage, 4);
  assert.strictEqual(sponge.releaseRods.glowType, 'radiation');
  const defender = { state: 'defending', defenseMove: sponge, x: 0, y: 0 };
  assert.strictEqual(interceptHit(defender, {}, { type: 'kinetic', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(defender, {}, { type: 'radiation', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(defender, {}, { type: 'heat', damage: 6 }, 0).result, 'pass');
  const geyser = moves.specialDirectional;
  assert.strictEqual(geyser.name, 'Icy Geyser');
  assert.strictEqual(geyser.kind, 'burst');
  assert.strictEqual(geyser.type, 'kinetic');
  assert.strictEqual(geyser.onHit.slow, 700);
  assert.ok(geyser.geyser.warnMs >= 400);
  assert.strictEqual(moves.basicCharge.name, 'Phosphor Bloom');
  assert.strictEqual(moves.basicCharge.type, 'radiation');
  assert.strictEqual(moves.basicCharge.damage, 9);
});

test('goldie kits follow the approved brief', () => {
  const moves = CHARACTERS.goldie.moves;
  const mri = moves.basicCharge;
  assert.strictEqual(mri.name, 'MRI Contrast');
  assert.strictEqual(mri.kind, 'burst');
  assert.strictEqual(mri.damage, 0);
  assert.strictEqual(mri.radius, 78);
  assert.strictEqual(mri.noKnockback, true);
  assert.strictEqual(mri.baseKnockback, 0);
  assert.strictEqual(mri.knockbackGrowth, 0);
  assert.strictEqual(mri.onHit.doublePercent, true);
  assert.strictEqual(mri.onHit.stun, 1000);
  const scanned = { percent: 40 };
  applyOnHit({ charDef: { id: 'goldie' } }, scanned, mri, 1000);
  assert.strictEqual(scanned.percent, 80);
  assert.strictEqual(scanned.lockedUntil, 2000);
  assert.strictEqual(scanned.clingFrom.until, 2000);
  assert.strictEqual(scanned.clingFrom.move, 'MRI Contrast');
  const warded = { percent: 25, debuffImmuneUntil: 5000 };
  applyOnHit({ charDef: { id: 'goldie' } }, warded, mri, 1000);
  assert.strictEqual(warded.percent, 50);
  assert.strictEqual(warded.lockedUntil, undefined);
  const capped = { percent: 600 };
  applyOnHit({ charDef: { id: 'goldie' } }, capped, mri, 0);
  assert.strictEqual(capped.percent, 999);
  const palm = moves.basicDirectional;
  assert.strictEqual(palm.name, 'Magnetocaloric Palm');
  assert.strictEqual(palm.type, 'kinetic');
  assert.strictEqual(palm.damage, 7);
  assert.strictEqual(palm.type2, 'heat');
  assert.strictEqual(palm.damage2, 6);
  const chill = moves.specialDefense;
  assert.strictEqual(chill.name, 'Magnetic Chill');
  assert.deepStrictEqual(chill.immune, ['heat']);
  assert.deepStrictEqual(chill.cleanse, ['burn']);
  const burning = { burnUntil: 5000, burnSticky: false };
  cleanse(burning, chill.cleanse);
  assert.strictEqual(burning.burnUntil, 0);
  const curie = moves.specialDirectional;
  assert.strictEqual(curie.name, 'Curie Point Burst');
  assert.strictEqual(curie.kind, 'projectile');
  assert.strictEqual(curie.damage, 0);
  assert.strictEqual(curie._ghost, true);
  assert.strictEqual(curie.igniteType, 'heat');
  assert.strictEqual(curie.igniteDamage, 8);
  assert.strictEqual(curie.igniteRadius, 150);
  assert.strictEqual(curie.metalsOnly, true);
  assert.ok(curie.igniteAt > 0.4 && curie.igniteAt < 0.85);
  assert.strictEqual(CHARACTERS.goldie.combat.metal, true);
  assert.strictEqual(CHARACTERS.helen.combat.metal, false);
});

test('terra kits follow the approved brief', () => {
  const moves = CHARACTERS.terra.moves;
  const sonar = moves.basicCharge;
  assert.strictEqual(sonar.name, 'Sonar Pulse');
  assert.strictEqual(sonar.kind, 'beam');
  assert.strictEqual(sonar.type, 'kinetic');
  assert.strictEqual(sonar.damage, 7);
  assert.strictEqual(sonar.breakPhase, true);
  assert.strictEqual(sonar.onHit.reveal, true);
  assert.strictEqual(sonar.stageWide, true);
  const punch = moves.basicDirectional;
  assert.strictEqual(punch.name, 'Flex Punch');
  assert.strictEqual(punch.type, 'kinetic');
  assert.strictEqual(punch.damage, 8);
  const speaker = moves.specialDefense;
  assert.strictEqual(speaker.name, 'Floor Speaker');
  assert.strictEqual(speaker.retort.type, 'kinetic');
  assert.strictEqual(speaker.retort.damage, 6);
  assert.strictEqual(speaker.retortBurst, true);
  const bolt = moves.specialDirectional;
  assert.strictEqual(bolt.name, 'Green Phosphor Bolt');
  assert.strictEqual(bolt.kind, 'projectile');
  assert.strictEqual(bolt.type, 'radiation');
  assert.strictEqual(bolt.damage, 8);
});

test('haley kits follow the approved brief', () => {
  const moves = CHARACTERS.haley.moves;
  const cutter = moves.basicCharge;
  assert.strictEqual(cutter.name, 'Plasma Cutter');
  assert.ok(cutter.kind == null || cutter.kind === 'melee');
  assert.ok(cutter.rangeW > 0 && cutter.rangeW < 110);
  assert.strictEqual(cutter.type, 'heat');
  assert.strictEqual(cutter.damage, 4);
  assert.strictEqual(cutter.type2, 'electrical');
  assert.strictEqual(cutter.damage2, 3);
  assert.ok(cutter.chargeDamageMult > 1);
  const kick = moves.basicDirectional;
  assert.strictEqual(kick.name, 'Carbide Kick');
  assert.strictEqual(kick.type, 'kinetic');
  assert.strictEqual(kick.damage, 4);
  assert.strictEqual(kick.type2, 'heat');
  assert.strictEqual(kick.damage2, 3);
  const gate = moves.specialDefense;
  assert.strictEqual(gate.name, 'High-K Gate');
  assert.deepStrictEqual(gate.blocks, ['kinetic', 'electrical']);
  assert.deepStrictEqual(gate.immune, ['kinetic', 'electrical']);
  assert.strictEqual(gate.breakOn, 'heat');
  const defender = { state: 'defending', defenseMove: gate, x: 0, y: 0, facing: 1 };
  assert.strictEqual(interceptHit(defender, {}, { type: 'kinetic', damage: 8 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(defender, {}, { type: 'electrical', damage: 8 }, 0).result, 'negate');
  const heat = interceptHit(defender, {}, { type: 'heat', damage: 6 }, 0);
  assert.strictEqual(heat.result, 'pass');
  assert.strictEqual(heat.endDefense, true);
  assert.strictEqual(heat.shatter, true);
  const mixed = interceptHit(defender, {}, { type: 'heat', damage: 6, type2: 'kinetic', damage2: 5 }, 0);
  assert.ok(mixed.stripTypes.includes('kinetic'));
  const sink = moves.specialDirectional;
  assert.strictEqual(sink.name, 'Neutron Sink');
  assert.strictEqual(sink.kind, 'projectile');
  assert.strictEqual(sink.type, 'kinetic');
  assert.strictEqual(sink.stick, true);
  assert.strictEqual(sink.onHit.mute, 'radiation');
  assert.strictEqual(sink.onHit.muteCling, true);
  assert.ok(sink.onHit.muteMs >= 2000);
  const foe = {};
  applyOnHit({ charDef: { id: 'haley' } }, foe, sink, 1000);
  assert.strictEqual(foe.muteType, 'radiation');
  assert.strictEqual(foe.muteUntil, 3600);
  assert.strictEqual(foe.clingFrom.id, 'haley');
  assert.strictEqual(foe.clingFrom.move, 'Neutron Sink');
  assert.strictEqual(foe.clingFrom.until, 3600);
  const silenced = prepareMove(
    { type: 'radiation', damage: 9, type2: 'kinetic', damage2: 4 },
    { muteUntil: 9000, muteType: 'radiation' },
    { charDef: {} },
    1000,
  );
  assert.strictEqual(silenced.damage, 0);
  assert.strictEqual(silenced.damage2, 4);
});

test('thule kits follow the approved brief', () => {
  const moves = CHARACTERS.thule.moves;
  const ultima = moves.basicCharge;
  assert.strictEqual(ultima.name, 'Ultima Thule');
  assert.strictEqual(ultima.kind, 'projectile');
  assert.strictEqual(ultima.type, 'kinetic');
  assert.strictEqual(ultima.damage, 8);
  assert.strictEqual(ultima.growWithDistance.reach, 1000);
  assert.strictEqual(ultima.growWithDistance.mult, 1.85);
  assert.ok(ultima.projectileSpeed * (ultima.projectileLife / 1000) > 1500, 'the throw can cross the stage');
  const jab = moves.basicDirectional;
  assert.strictEqual(jab.name, 'Blue Glow Jab');
  assert.notStrictEqual(jab.name, 'Polar Night');
  assert.strictEqual(jab.type, 'kinetic');
  assert.strictEqual(jab.damage, 7);
  assert.strictEqual(jab.type2, undefined);
  assert.strictEqual(jab.hitsRevealed, true);
  const marked = {};
  applyOnHit({ charDef: { id: 'thule' } }, marked, jab, 1000);
  assert.strictEqual(marked.revealedUntil, 1500);
  assert.strictEqual(marked.revealTint, 0x8ec8ff);
  const veil = moves.specialDefense;
  assert.strictEqual(veil.name, 'Aurora Veil');
  assert.strictEqual(veil.kind, 'block');
  assert.strictEqual(veil.onStruck.miss, true);
  assert.strictEqual(veil.onStruck.dazzleCling, true);
  const foe = {};
  applyOnHit({ charDef: { id: 'thule' } }, foe, { name: veil.name, onHit: veil.onStruck }, 1000);
  assert.strictEqual(foe.missNext, 1);
  assert.strictEqual(foe.dazzledBy.id, 'thule');
  assert.strictEqual(foe.dazzledBy.move, 'Aurora Veil');
  const ray = moves.specialDirectional;
  assert.strictEqual(ray.name, 'Handheld X-Ray');
  assert.strictEqual(ray.kind, 'beam');
  assert.strictEqual(ray.type, 'radiation');
  assert.strictEqual(ray.damage, 9);
  assert.strictEqual(ray.beamLen, 520);
});

test('holly kits follow the approved brief', () => {
  const moves = CHARACTERS.holly.moves;
  const laser = moves.basicCharge;
  assert.strictEqual(laser.name, 'Stone Breaker');
  assert.strictEqual(laser.kind, 'beam');
  assert.strictEqual(laser.type, 'heat');
  assert.strictEqual(laser.damage, 9);
  assert.strictEqual(laser.beamArtPx, 1100);
  assert.deepStrictEqual(laser.bonusVsId, { carter: 2, bord: 2, silas: 2 });
  const doubled = prepareMove(laser, {}, { charDef: { id: 'silas' } }, 0);
  assert.strictEqual(doubled.damage, 18);
  const plain = prepareMove(laser, {}, { charDef: { id: 'sandy' } }, 0);
  assert.strictEqual(plain.damage, 9);
  const strike = moves.basicDirectional;
  assert.strictEqual(strike.name, 'Calibration Strike');
  assert.strictEqual(strike.type, 'kinetic');
  assert.strictEqual(strike.damage, 7);
  assert.strictEqual(strike.fixed, true);
  assert.strictEqual(strike.breaksBlock, true);
  const bend = moves.specialDefense;
  assert.strictEqual(bend.name, "Bend Don't Break");
  assert.strictEqual(bend.noKnockdown, true);
  assert.strictEqual(bend.blockReduction, 0.45);
  assert.deepStrictEqual(bend.onlyReduce, ['kinetic']);
  const defender = { state: 'defending', defenseMove: bend, x: 0, y: 0 };
  const kinetic = interceptHit(defender, {}, { type: 'kinetic', damage: 10 }, 0);
  assert.strictEqual(kinetic.result, 'partial');
  assert.strictEqual(kinetic.noKnockback, true);
  assert.ok(kinetic.reduction >= 0.45);
  assert.strictEqual(interceptHit(defender, {}, { type: 'heat', damage: 6 }, 0).result, 'pass');
  const pole = moves.specialDirectional;
  assert.strictEqual(pole.name, 'Pole Piece');
  assert.strictEqual(pole.kind, 'projectile');
  assert.strictEqual(pole.type, 'kinetic');
  assert.strictEqual(pole.damage, 8);
  assert.ok(pole.pullProjectiles >= 90);
  assert.ok(pole.projectileRadius > 0);
});

test('dizzy kits follow the approved brief', () => {
  const moves = CHARACTERS.dizzy.moves;
  const gust = moves.basicCharge;
  assert.strictEqual(gust.name, 'Turbine Gust');
  assert.strictEqual(gust.kind, 'beam');
  assert.strictEqual(gust.type, 'kinetic');
  assert.strictEqual(gust.damage, 7);
  assert.ok(gust.chargeDamageMult > 1);
  assert.ok(gust.chargeKnockbackMult > 1);
  const punch = moves.basicDirectional;
  assert.strictEqual(punch.name, 'EV Motor Punch');
  assert.strictEqual(punch.type, 'kinetic');
  assert.strictEqual(punch.damage, 3);
  assert.strictEqual(punch.type2, 'electrical');
  assert.strictEqual(punch.damage2, 2);
  assert.strictEqual(punch.multiHit, 3);
  assert.strictEqual(punch.fullWhenHot, true);
  const fd = frameData(punch.duration, punch.cooldown, punch);
  assert.ok(fd.active * STEP_MS >= 180, 'three hits need an active window past 180 ms');
  const hot = { burnUntil: 9000, heatedUntil: 9000 };
  const kept = prepareMove(punch, hot, { charDef: {} }, 1000);
  assert.strictEqual(kept.damage, 3);
  assert.strictEqual(kept.damage2, 2);
  const taxed = prepareMove({ ...punch, fullWhenHot: false, hotPenalty: 0.5 }, hot, { charDef: {} }, 1000);
  assert.strictEqual(taxed.damage, 1.5);
  assert.strictEqual(taxed.damage2, 1);
  const wall = moves.specialDefense;
  assert.strictEqual(wall.name, 'Control Rod Wall');
  assert.deepStrictEqual(wall.blocks, ['kinetic', 'radiation']);
  const defender = { state: 'defending', defenseMove: wall, x: 0, y: 0 };
  assert.strictEqual(interceptHit(defender, {}, { type: 'kinetic', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(defender, {}, { type: 'radiation', damage: 6 }, 0).result, 'negate');
  assert.strictEqual(interceptHit(defender, {}, { type: 'heat', damage: 6 }, 0).result, 'pass');
  const flash = moves.specialDirectional;
  assert.strictEqual(flash.name, 'Stage Light Flash');
  assert.strictEqual(flash.kind, 'beam');
  assert.strictEqual(flash.type, 'heat');
  assert.strictEqual(flash.aimStick, true);
  assert.strictEqual(flash.beamCap, 1100);
  assert.ok(flash.beamLen < flash.beamCap);
  assert.strictEqual(flash.onHit.stun, 1000);
  const stunned = {};
  applyOnHit({ charDef: { id: 'dizzy' } }, stunned, flash, 1000);
  assert.strictEqual(stunned.lockedUntil, 2000);
  assert.strictEqual(stunned.clingFrom.move, 'Stage Light Flash');
  assert.strictEqual(stunned.clingFrom.until, 2000);
});

test('tara and rex kits follow the approved briefs', () => {
  const tara = CHARACTERS.tara.moves;
  const dump = tara.basicCharge;
  assert.strictEqual(dump.name, 'Capacitor Dump');
  assert.strictEqual(dump.kind, 'beam');
  assert.strictEqual(dump.type, 'electrical');
  assert.strictEqual(dump.damage, 6);
  assert.strictEqual(dump.chargeDamageMult, 1.75);
  assert.strictEqual(dump.chargeLengthMult, 2.15);
  assert.strictEqual(dump.beamLen, 148);
  assert.strictEqual(dump.beamArtPx, 640);
  const bash = tara.basicDirectional;
  assert.strictEqual(bash.name, 'Bone Plate Bash');
  assert.notStrictEqual(bash.name, 'Tantalizing Hook');
  assert.strictEqual(bash.type, 'kinetic');
  assert.ok(bash.damage > 0);
  assert.strictEqual(bash.pull, undefined);
  assert.strictEqual(bash.onHit.heal, 2);
  const healed = { charDef: { id: 'tara' }, percent: 20 };
  applyOnHit(healed, { charDef: { combat: {} } }, bash, 1000);
  assert.strictEqual(healed.percent, 18);
  const guard = tara.specialDefense;
  assert.strictEqual(guard.name, 'Tantalus Guard');
  assert.deepStrictEqual(guard.immune, ['chemical']);
  assert.deepStrictEqual(guard.blocks, ['chemical']);
  assert.strictEqual(guard.fizzChem, true);
  const defender = { state: 'defending', defenseMove: guard, x: 0, y: 0, facing: 1 };
  assert.strictEqual(interceptHit(defender, {}, { type: 'chemical', damage: 9 }, 0).result, 'negate');
  const pin = tara.specialDirectional;
  assert.strictEqual(pin.name, 'Implant Pin');
  assert.strictEqual(pin.type, 'kinetic');
  assert.strictEqual(pin.damage, 5);
  assert.strictEqual(pin.stick, true);
  assert.strictEqual(pin.pinFoot, true);
  assert.strictEqual(pin.onHit.root, 3000);
  assert.strictEqual(pin.noKnockback, true);
  const pinned = { charDef: { combat: {} } };
  applyOnHit({ charDef: { id: 'tara' } }, pinned, pin, 1000);
  assert.strictEqual(pinned.rootedUntil, 4000);
  assert.strictEqual(pinned.clingFrom.move, 'Implant Pin');
  assert.strictEqual(pinned.clingFrom.until, 4000);

  const rex = CHARACTERS.rex.moves;
  const octane = rex.basicCharge;
  assert.strictEqual(octane.name, 'High Octane');
  assert.strictEqual(octane.kind, 'buff');
  assert.ok(octane.buff.speed > 1);
  assert.strictEqual(octane.selfDamage.type, 'heat');
  assert.ok(octane.selfDamage.damage > 0 && octane.selfDamage.damage < octane.blast.damage);
  assert.strictEqual(octane.blast.type, 'heat');
  assert.ok(octane.blast.damage >= 10);
  assert.ok(octane.radius > 0);
  const edge = rex.basicDirectional;
  assert.strictEqual(edge.name, "King's Edge");
  assert.strictEqual(edge.type, 'kinetic');
  assert.strictEqual(edge.damage, 8);
  assert.strictEqual(edge.bonusWhileDps, 3);
  assert.strictEqual(edge.heatEmpower, undefined);
  const plain = prepareMove(edge, { burnUntil: 0 }, { charDef: {} }, 1000);
  assert.strictEqual(plain.damage, 8);
  const dotted = prepareMove(edge, { burnUntil: 5000 }, { charDef: {} }, 1000);
  assert.strictEqual(dotted.damage, 11);
  assert.strictEqual(takingDps({ poisonUntil: 2000 }, 1000), true);
  assert.strictEqual(takingDps({ burnUntil: 0 }, 1000), false);
  const creep = rex.specialDefense;
  assert.strictEqual(creep.noKnockback, true);
  assert.strictEqual(creep.noPush, true);
  assert.strictEqual(creep.grabImmune, true);
  assert.strictEqual(creep.debuffImmune, true);
  assert.deepStrictEqual(creep.onlyReduce, ['kinetic']);
  const lash = rex.specialDirectional;
  assert.strictEqual(lash.name, 'Thermocouple Lash');
  assert.strictEqual(lash.type, 'electrical');
  assert.strictEqual(lash.damage, 8);
  assert.strictEqual(lash.vsHot.type, 'heat');
  assert.strictEqual(lash.vsHot.damage, 11);
  assert.ok(lash.rangeW >= 110);
  const cold = prepareMove(lash, {}, { burnUntil: 0, heatedUntil: 0 }, 1000);
  assert.strictEqual(cold.type, 'electrical');
  assert.strictEqual(cold.damage, 8);
  const hot = prepareMove(lash, {}, { burnUntil: 4000 }, 1000);
  assert.strictEqual(hot.type, 'heat');
  assert.strictEqual(hot.damage, 11);
});

test('wolf kit follows the approved brief', () => {
  const wolf = CHARACTERS.wolf.moves;
  const filament = wolf.basicCharge;
  assert.strictEqual(filament.name, 'White-Hot Filament');
  assert.strictEqual(filament.kind, 'burst');
  assert.strictEqual(filament.type, 'heat');
  assert.strictEqual(filament.damage, 7);
  assert.strictEqual(filament.chargeDamageMult, 1.9);
  assert.strictEqual(filament.chargeRadiusMult, 1.85);
  let longest = 0;
  let who = '';
  for (const fighter of Object.values(CHARACTERS)) {
    const ms = fighter.moves.basicCharge?.maxChargeMs ?? 0;
    if (ms >= longest) {
      longest = ms;
      who = fighter.id;
    }
  }
  assert.strictEqual(who, 'wolf');
  assert.ok(filament.maxChargeMs > 3000);
  const drill = wolf.basicDirectional;
  assert.strictEqual(drill.name, 'Carbide Drill');
  assert.notStrictEqual(drill.name, 'Tin Eater');
  assert.strictEqual(drill.type, 'kinetic');
  assert.strictEqual(drill.damage, 3);
  assert.strictEqual(drill.multiHit, 5);
  assert.strictEqual(drill.kind, undefined);
  assert.strictEqual(drill.bonusVsId, undefined);
  const poke = finalBlow({ ...drill, _hitIndex: 1 });
  assert.strictEqual(poke.noKnockback, true);
  assert.strictEqual(poke.noFlinch, true);
  assert.strictEqual(poke.baseKnockback, 0);
  const finisher = finalBlow({ ...drill, _hitIndex: 5 });
  assert.strictEqual(finisher.baseKnockback, 170);
  assert.strictEqual(finisher.noFlinch, undefined);
  const guard = wolf.specialDefense;
  assert.strictEqual(guard.name, 'Unmeltable');
  assert.deepStrictEqual(guard.immune, ['heat']);
  assert.deepStrictEqual(guard.blocks, ['heat']);
  assert.deepStrictEqual(guard.onlyReduce, ['kinetic']);
  assert.strictEqual(guard.blockReduction, 0.22);
  const defender = { state: 'defending', defenseMove: guard, x: 0, y: 0, facing: 1 };
  assert.strictEqual(interceptHit(defender, {}, { type: 'heat', damage: 9 }, 0).result, 'negate');
  const kinetic = interceptHit(defender, {}, { type: 'kinetic', damage: 6 }, 0);
  assert.strictEqual(kinetic.result, 'partial');
  assert.strictEqual(kinetic.reduction, 0.22);
  const dart = wolf.specialDirectional;
  assert.strictEqual(dart.name, 'Armor Piercer');
  assert.strictEqual(dart.type, 'kinetic');
  assert.strictEqual(dart.damage, 7);
  assert.strictEqual(dart.breaksBlock, true);
  assert.strictEqual(dart.pierce, true);
  const shield = {
    state: 'defending',
    defenseMove: { kind: 'block', blocks: ['kinetic'], blockReduction: 0.8 },
    x: 0, y: 0, facing: 1,
  };
  assert.strictEqual(interceptHit(shield, {}, dart, 0).result, 'pass');
});

test('only the last hit of a string stuns or launches', () => {
  const early = finalBlow({
    multiHit: 3,
    _hitIndex: 1,
    baseKnockback: 180,
    knockbackGrowth: 4,
    pull: 40,
    onHit: { stun: 400, poison: { dps: 1 } },
  });
  assert.strictEqual(early.noKnockback, true);
  assert.strictEqual(early.noFlinch, true);
  assert.strictEqual(early.baseKnockback, 0);
  assert.strictEqual(early.pull, 0);
  assert.strictEqual(early.onHit.stun, 0);
  assert.ok(early.onHit.poison);
  const last = finalBlow({
    multiHit: 3,
    _hitIndex: 3,
    baseKnockback: 180,
    onHit: { stun: 400 },
  });
  assert.strictEqual(last.baseKnockback, 180);
  assert.strictEqual(last.onHit.stun, 400);
  const combo = finalBlow({
    combo: { hits: 3 },
    _comboStep: 2,
    _hitIndex: 1,
    baseKnockback: 55,
    onHit: { freeze: 300 },
  });
  assert.strictEqual(combo.noKnockback, true);
  assert.strictEqual(combo.onHit.freeze, 0);
  const finisher = finalBlow({
    combo: { hits: 3 },
    _comboStep: 3,
    baseKnockback: 230,
  });
  assert.strictEqual(finisher.baseKnockback, 230);
  assert.strictEqual(finisher.noKnockback, undefined);
});

test('attacks do not ignite gas fighters', () => {
  const plug = CHARACTERS.ira.moves.basicDirectional;
  assert.strictEqual(plug.name, 'Spark Plug');
  assert.strictEqual(plug.bonusVsState, undefined);
  const catalyst = CHARACTERS.pit.moves.basicCharge;
  assert.strictEqual(catalyst.name, 'Catalyst Ignition');
  assert.strictEqual(catalyst.bonusVsState, undefined);
  assert.strictEqual(catalyst.igniteGases, true);
  assert.ok(catalyst.gasCloud > 0);
  const gas = { charDef: { combat: { state: 'gas' } } };
  applyOnHit({ charDef: { id: 'ira' } }, gas, {
    name: 'Spark Plug',
    onHit: { burn: { dps: 4, ms: 1200 } },
  }, 1000);
  assert.ok(!(gas.burnUntil > 1000));
  const solid = { charDef: { combat: { state: 'metal' } } };
  applyOnHit({ charDef: { id: 'ira' } }, solid, {
    name: 'Spark Plug',
    onHit: { burn: { dps: 4, ms: 1200 } },
  }, 1000);
  assert.ok(solid.burnUntil > 1000);
});

test('oz, ira, and aurelius keep the approved move rules', () => {
  const oz = CHARACTERS.oz.moves;
  assert.equal(oz.specialDirectional.name, 'Tetroxide Puff');
  assert.equal(oz.specialDirectional.type, 'chemical');
  assert.equal(oz.specialDirectional.onHit, undefined);
  assert.equal(oz.specialDirectional.zone.sheet, true);
  assert.equal(oz.basicCharge.groundImpact, true);
  assert.equal(oz.basicCharge.chargeRadiusMult, 2.15);
  assert.equal(oz.specialDefense.rooted, true);
  assert.equal(oz.specialDefense.noKnockback, true);
  assert.equal(oz.specialDefense.blockReduction, 0.55);
  assert.equal(oz.specialDefense.recoil.damage, 4);
  const ira = CHARACTERS.ira.moves;
  assert.equal(ira.basicDirectional.name, 'Spark Plug');
  assert.equal(ira.basicDirectional.type, 'kinetic');
  assert.equal(ira.basicDirectional.type2, 'electrical');
  assert.equal(ira.basicDirectional.bonusVsState, undefined);
  assert.equal(ira.specialDefense.flatHit, 8);
  assert.deepEqual(ira.specialDirectional.fanTypes, ['kinetic', 'heat', 'electrical', 'chemical']);
  assert.equal(ira.specialDirectional.fanDeg, 30);
  assert.equal(ira.specialDirectional.ghostCopies, 3);
  const iraCharges = Object.values(ira).map((move) => move.maxChargeMs || 0);
  assert.equal(Math.max(...iraCharges), ira.basicCharge.maxChargeMs);
  assert.ok(ira.basicCharge.maxChargeMs < CHARACTERS.wolf.moves.basicCharge.maxChargeMs);
  assert.equal(ira.basicCharge.meteor, true);
  assert.equal(ira.basicCharge.impactAt, 0.9);
  const gold = CHARACTERS.aurelius.moves;
  assert.equal(gold.basicDirectional.name, 'Circuit Contact');
  assert.equal(gold.basicDirectional.type, 'kinetic');
  assert.equal(gold.basicDirectional.type2, 'electrical');
  assert.ok(gold.basicDirectional.rangeW < 110);
  assert.deepEqual(gold.specialDefense.immune, ['chemical']);
  assert.deepEqual(gold.specialDefense.reflectTypes, ['heat', 'radiation']);
  assert.equal(gold.basicCharge.onHit.freeze, 640);
  assert.equal(gold.basicCharge.onHit.gold, 640);
  assert.equal(gold.specialDirectional.lob, 620);
  assert.equal(gold.specialDirectional.angleable, undefined);
  assert.equal(gold.specialDirectional.baseKnockback, 200);
  const caught = { charDef: { combat: { state: 'metal' } } };
  applyOnHit({ charDef: { id: 'aurelius' } }, caught, gold.basicCharge, 1000);
  assert.ok(caught.goldUntil > 1000);
  assert.equal(caught.weightBuff, 2.7);
  assert.ok(caught.weightBuffUntil >= caught.goldUntil);
  assert.ok(caught.frozenUntil > 1000);
});

test('pit ignites gas clouds and flame-tests by electronegativity', () => {
  const pit = CHARACTERS.pit.moves;
  assert.equal(pit.basicCharge.name, 'Catalyst Ignition');
  assert.equal(pit.basicCharge.igniteGases, true);
  assert.equal(pit.basicCharge.bonusVsState, undefined);
  assert.ok(pit.basicCharge.gasCloud > 0);
  assert.equal(pit.basicDirectional.name, 'Record Scratch');
  assert.equal(pit.basicDirectional.type, 'kinetic');
  assert.equal(pit.basicDirectional.angleDeg, 15);
  assert.ok(pit.basicDirectional.baseKnockback > 0);
  const clamp = pit.specialDefense;
  assert.equal(clamp.name, 'Cisplatin Clamp');
  assert.equal(clamp.counterType, 'chemical');
  assert.equal(clamp.counterDamage, 7);
  assert.equal(clamp.rootMs, 700);
  assert.equal(clamp.counterKnockback, 0);
  assert.equal(clamp.counterCoat, 'Cisplatin Clamp');
  const flare = pit.specialDirectional;
  assert.equal(flare.name, 'Flame Test');
  assert.equal(flare.type, 'heat');
  assert.equal(flare.type2, 'chemical');
  assert.equal(flare.enScale, true);
  assert.equal(flare.flameTint, true);
  const wide = enGapMult({ en: 2.28 }, { en: 0.93 });
  const close = enGapMult({ en: 2.28 }, { en: 2.2 });
  assert.ok(wide > close);
  assert.equal(enGapMult({ en: 2.28 }, { en: null }), 1);
  assert.equal(enGapMult({ en: null }, { en: 1.0 }), 1);
});

test('hog, talia, pablo, and bianca keep the approved batch rules', () => {
  const hog = CHARACTERS.hog.moves;
  assert.equal(hog.basicCharge.name, 'Thermometer Burst');
  assert.equal(hog.basicCharge.type, 'kinetic');
  assert.equal(hog.basicCharge.type2, 'chemical');
  assert.equal(hog.basicCharge.heatTakenBonus, 1.4);
  assert.equal(hog.basicDirectional.name, 'Quicksilver Lash');
  assert.equal(hog.basicDirectional.rangeW, 124);
  assert.equal(hog.specialDefense.amalgam, true);
  assert.equal(hog.specialDefense.amalgamVs.aurelius, 0.38);
  assert.equal(hog.specialDirectional.zone.onHit, undefined);
  assert.equal(hog.specialDirectional.zone.type, 'chemical');
  assert.equal(hog.specialDirectional.zone.drift, 48);
  const heated = prepareMove(hog.basicCharge, { heatTaken: true }, { charDef: { id: 'sandy' } }, 0);
  assert.ok(Math.abs(heated.damage - 5 * 1.4) < 1e-9);
  assert.ok(Math.abs(heated.damage2 - 3.8 * 1.4) < 1e-9);
  const cold = prepareMove(hog.basicCharge, { heatTaken: false }, { charDef: { id: 'sandy' } }, 0);
  assert.equal(cold.damage, 5);

  const talia = CHARACTERS.talia.moves;
  assert.equal(talia.basicCharge.zone.ramp, 0.5);
  assert.equal(talia.basicCharge.zone.statusCling, "Poisoner's Poison");
  assert.equal(talia.basicCharge.zone.sheet, true);
  assert.equal(talia.specialDefense.immune[0], 'chemical');
  assert.deepEqual(talia.specialDefense.cleanse, ['poison']);
  const dart = talia.specialDirectional;
  assert.equal(dart.damage, 1);
  assert.equal(dart.onHit.poison.delay, 1100);
  const victim = { charDef: { combat: { en: 2 } } };
  applyOnHit({ charDef: { id: 'talia', combat: { en: 1.62 } } }, victim, dart, 1000);
  assert.equal(victim.poisonTick, 2100);
  assert.ok(victim.poisonUntil > victim.poisonTick);
  assert.equal(victim.clingFrom.until, victim.poisonTick);
  assert.equal(victim.poisonFrom.burstAt, 2100);

  const pablo = CHARACTERS.pablo.moves;
  assert.equal(pablo.basicCharge.name, 'Machine Gun');
  assert.equal(pablo.basicCharge.damage, 1);
  assert.equal(pablo.basicCharge.salvo, 12);
  assert.equal(pablo.basicCharge.type, 'kinetic');
  assert.equal(pablo.basicDirectional.name, 'Lead Pipe');
  assert.equal(pablo.basicDirectional.onHit.interrupt, 200);
  assert.deepEqual(pablo.specialDefense.immune, ['radiation']);
  assert.equal(pablo.specialDefense.blockReduction, 0.5);
  assert.equal(pablo.specialDirectional.name, 'Shotgun');
  assert.equal(pablo.specialDirectional.fan, 6);
  assert.equal(pablo.specialDirectional.type, 'kinetic');
  const early = finalBlow({ ...pablo.basicCharge, multiHit: 12, _hitIndex: 3, baseKnockback: 140, onHit: { stun: 200 } });
  assert.equal(early.baseKnockback, 0);
  assert.equal(early.noFlinch, true);
  assert.equal(early.onHit.stun, 0);
  const last = finalBlow({ ...pablo.basicCharge, multiHit: 12, _hitIndex: 12, baseKnockback: 140 });
  assert.equal(last.baseKnockback, 140);

  const bianca = CHARACTERS.bianca.moves;
  assert.equal(bianca.basicCharge.name, 'Hopper Crystal');
  assert.equal(bianca.basicCharge.kind, 'burst');
  assert.equal(bianca.basicCharge.spikes.count, 5);
  assert.equal(bianca.basicDirectional.multiHit, 3);
  assert.equal(bianca.basicDirectional.hitRadius, 56);
  const step = finalBlow({ ...bianca.basicDirectional, _hitIndex: 1 });
  assert.equal(step.baseKnockback, 0);
  const kick = finalBlow({ ...bianca.basicDirectional, _hitIndex: 3 });
  assert.equal(kick.baseKnockback, 120);
  assert.equal(bianca.specialDefense.slowMetals, 0.28);
  assert.equal(bianca.specialDefense.float, true);
  assert.equal(bianca.specialDefense.grabImmune, true);
  assert.equal(bianca.specialDirectional.lob, 520);
  assert.equal(bianca.specialDirectional.nearCleanse, 78);
  assert.equal(bianca.specialDirectional.type, 'chemical');
  assert.equal(bianca.specialDirectional.dropZone, undefined);
});

test('polonius, tate, ronan, and frank keep the approved batch rules', () => {
  const polonius = CHARACTERS.polonius.moves;
  assert.equal(polonius.basicCharge.name, 'Blue Glow Burst');
  assert.equal(polonius.basicCharge.type, 'heat');
  assert.equal(polonius.basicCharge.type2, 'radiation');
  assert.equal(polonius.basicCharge.selfGlowMs, 1400);
  assert.equal(polonius.basicDirectional.name, 'Rapier Thrust');
  assert.equal(polonius.specialDefense.kind, 'wall');
  assert.equal(polonius.specialDefense.behindMult, 2);
  assert.equal(polonius.specialDefense.pierceMult, 2);
  assert.equal(polonius.specialDirectional.stripBuffs, true);
  assert.equal(polonius.specialDirectional.onHit.strip, true);

  const tate = CHARACTERS.tate.moves;
  assert.equal(tate.basicCharge.blinkMs, 420);
  assert.equal(tate.basicCharge.type, 'heat');
  assert.equal(tate.basicCharge.type2, 'radiation');
  assert.equal(tate.basicDirectional.ignoreReductions, true);
  assert.equal(tate.basicDirectional.breaksBlock, true);
  assert.equal(tate.specialDefense.fadeAlpha, 0.15);
  assert.equal(tate.specialDefense.phase, true);
  assert.equal(tate.specialDefense.drain.every, 1000);
  assert.equal(tate.specialDirectional.type, 'chemical');
  assert.equal(tate.specialDirectional.type2, 'radiation');

  const ronan = CHARACTERS.ronan.moves;
  assert.equal(ronan.basicCharge.riseUnder, true);
  assert.equal(ronan.basicDirectional.name, 'Half-Life Hook');
  assert.equal(ronan.basicDirectional.type, 'kinetic');
  assert.equal(ronan.basicDirectional.type2, 'radiation');
  assert.equal(ronan.basicDirectional.halfLife.pause, 900);
  const hook = {};
  assert.equal(halfLifeScale(hook, ronan.basicDirectional, 1000), 1);
  assert.equal(halfLifeScale(hook, ronan.basicDirectional, 1500), 0.5);
  assert.equal(halfLifeScale(hook, ronan.basicDirectional, 1800), 0.25);
  assert.equal(halfLifeScale(hook, ronan.basicDirectional, 4000), 1);
  assert.equal(ronan.specialDefense.regen, 1.5);
  assert.equal(ronan.specialDirectional.kind, 'zone');
  assert.equal(ronan.specialDirectional.zone.drift, 110);
  assert.equal(ronan.specialDirectional.zone.sheet, true);
  assert.equal(ronan.specialDirectional.zone.feet, true);
  assert.equal(ronan.specialDirectional.zone.knockback, 0);
  assert.equal(ronan.specialDirectional.dropZone, undefined);

  const frank = CHARACTERS.frank.moves;
  assert.equal(frank.basicCharge.buff.weight, 1.32);
  assert.equal(frank.basicCharge.buff.bonus.type, 'radiation');
  assert.equal(frank.basicDirectional.flicker, true);
  assert.equal(frank.basicDirectional.startupF, 1);
  assert.equal(frank.basicDirectional.rangeH, 14);
  assert.equal(frank.specialDefense.phase, true);
  assert.equal(frank.specialDefense.phaseRetort.type, 'radiation');
  assert.equal(frank.specialDirectional.projectileLife, 220);
  assert.equal(frank.specialDirectional.type, 'radiation');
});

test('ray and ace keep the approved batch rules', () => {
  const ray = CHARACTERS.ray.moves;
  assert.equal(ray.basicCharge.name, 'Radium Tonic');
  assert.equal(ray.basicCharge.tonic.every, 1000);
  assert.equal(ray.basicCharge.tonic.cost, 1.1);
  assert.equal(ray.basicCharge.maxChargeMs, 3000);
  const drinker = { _tonicSteps: 2 };
  assert.equal(grantTonic(drinker, ray.basicCharge, 5000), 2);
  assert.equal(drinker.attackPower, 1.32);
  assert.equal(drinker.attackPowerUntil, 7200);
  assert.equal(drinker._tonicSteps, 0);
  assert.equal(grantTonic(drinker, ray.basicCharge, 8000), 0);
  assert.equal(ray.basicDirectional.name, 'Alpha Uppercut');
  assert.equal(ray.basicDirectional.type, 'kinetic');
  assert.equal(ray.basicDirectional.type2, 'radiation');
  assert.equal(ray.basicDirectional.lift, true);
  assert.equal(ray.specialDefense.onlyReduce[0], 'kinetic');
  assert.equal(ray.specialDefense.recoil.type, 'radiation');
  assert.equal(ray.specialDirectional.dropZone.knockback, 0);
  assert.equal(ray.specialDirectional.dropZone.statusCling, 'Luminous Splash');
  assert.equal(ray.specialDirectional.dropZone.feet, true);

  const ace = CHARACTERS.ace.moves;
  assert.equal(ace.basicCharge.name, 'Actinic Ray');
  assert.equal(ace.basicCharge.kind, 'beam');
  assert.equal(ace.basicCharge.type, 'radiation');
  assert.equal(ace.basicCharge.beamArtPx, 640);
  assert.equal(ace.basicDirectional.name, 'Ace of Rays');
  assert.equal(ace.basicDirectional.type, 'kinetic');
  assert.equal(ace.basicDirectional.type2, 'radiation');
  assert.equal(ace.specialDefense.name, 'Smoke Detector');
  assert.deepEqual(ace.specialDefense.immune, ['radiation']);
  assert.equal(ace.specialDefense.revealNear.radius, 220);
  assert.equal(ace.specialDefense.cycle, undefined);
  assert.equal(ace.specialDirectional.name, 'Neutron Deck');
  assert.equal(ace.specialDirectional.explodeOnly, true);
  assert.equal(ace.specialDirectional.hitRadius, 56);
  assert.equal(ace.specialDirectional.fan, undefined);
  assert.equal(ace.specialDirectional.type, 'radiation');
});

test('pat, uri, neptune, and pluto keep the approved batch rules', () => {
  const pat = CHARACTERS.pat.moves;
  assert.equal(pat.basicCharge.name, 'Proto Daughter');
  assert.equal(pat.basicCharge.type, 'radiation');
  assert.equal(pat.basicCharge.homing, 7);
  assert.equal(pat.basicDirectional.onHit.slowStack, true);
  assert.equal(pat.specialDefense.rewind, true);
  assert.equal(pat.specialDirectional.type, 'chemical');
  assert.equal(pat.specialDirectional.type2, 'radiation');
  const coated = { slowUntil: 0 };
  const patter = { charDef: { id: 'pat' } };
  applyOnHit(patter, coated, pat.basicDirectional, 1000);
  assert.equal(coated.slowStacks, 1);
  applyOnHit(patter, coated, pat.basicDirectional, 1200);
  assert.equal(coated.slowStacks, 2);
  assert.equal(coated.clingFrom.stacks, 2);
  assert.equal(coated.clingFrom.move, 'Sediment Layer');
  const log = [
    { t: 0, x: 10, y: 20, percent: 4 },
    { t: 400, x: 30, y: 20, percent: 9 },
    { t: 900, x: 80, y: 20, percent: 14 },
  ];
  assert.equal(rewindPoint(log, 1500).t, 400);
  assert.equal(rewindPoint(log, 1500).percent, 9);

  const uri = CHARACTERS.uri.moves;
  assert.equal(uri.basicCharge.chain.jump, true);
  assert.equal(uri.basicCharge.chain.count, 2);
  assert.equal(uri.basicDirectional.name, 'Penetrator Dart');
  assert.equal(uri.basicDirectional.breaksBlock, true);
  assert.equal(uri.basicDirectional.pierce, undefined);
  assert.equal(uri.specialDefense.noKnockback, true);
  assert.equal(uri.specialDefense.blockReduction, 0.82);
  assert.equal(uri.specialDirectional.landBurst, true);
  assert.equal(uri.specialDirectional.dropZone.knockback, 0);
  assert.equal(uri.specialDirectional.dropZone.type2, 'chemical');
  assert.equal(uri.specialDirectional.dropZone.useHold, true);
  assert.equal(uri.specialDirectional.zone, undefined);

  const neptune = CHARACTERS.neptune.moves;
  assert.equal(neptune.basicCharge.name, 'Mad Science Flask');
  assert.equal(neptune.basicCharge.explodeOnly, true);
  assert.equal(neptune.basicCharge.hitRadius, 54);
  assert.equal(neptune.basicCharge.chargeRadiusMult, 1.35);
  assert.equal(neptune.basicDirectional.name, 'Trident Thrust');
  assert.equal(neptune.basicDirectional.multiHit, 3);
  assert.deepEqual(neptune.specialDefense.immune, ['radiation', 'chemical']);
  assert.equal(neptune.specialDefense.phase, undefined);
  assert.equal(neptune.specialDirectional.name, 'Breeder Seed');
  assert.equal(neptune.specialDirectional.hatch.ms, 1000);
  assert.equal(neptune.specialDirectional.explodeOnly, undefined);
  assert.equal(neptune.specialDirectional.type, 'heat');
  assert.equal(neptune.specialDirectional.type2, 'radiation');

  const pluto = CHARACTERS.pluto.moves;
  assert.equal(pluto.basicCharge.critWindow, true);
  assert.equal(pluto.basicCharge.overhold.scale, 0.7);
  assert.equal(pluto.basicDirectional.name, 'Decay-Heat Palm');
  assert.equal(pluto.basicDirectional.type, 'heat');
  assert.equal(pluto.basicDirectional.type2, 'radiation');
  assert.equal(pluto.specialDefense.name, 'Demoted');
  assert.equal(pluto.specialDefense.phase, 'overhead');
  assert.equal(pluto.specialDefense.shrink, 0.5);
  assert.equal(pluto.specialDirectional.name, 'Plutonium Pit');
  assert.equal(pluto.specialDirectional.landBurst, true);
  assert.equal(pluto.specialDirectional.type, 'kinetic');
  assert.equal(pluto.specialDirectional.type2, 'radiation');
});

test('einstein, fermi, and mendel keep the approved batch rules', () => {
  const einstein = CHARACTERS.einstein.moves;
  assert.equal(einstein.basicCharge.name, 'Mass-Energy');
  assert.equal(einstein.basicCharge.type, 'heat');
  assert.equal(einstein.basicCharge.type2, 'radiation');
  assert.equal(einstein.basicCharge.hitRadius, 74);
  assert.equal(einstein.basicCharge.selfDamage.withCharge, true);
  assert.equal(einstein.basicDirectional.onHit.slowCling, true);
  assert.equal(einstein.specialDefense.replay, true);
  assert.equal(einstein.specialDirectional.rain, 5);
  assert.equal(einstein.specialDirectional.type, 'radiation');
  const slowed = { slowUntil: 0 };
  applyOnHit({ charDef: { id: 'einstein' } }, slowed, einstein.basicDirectional, 1000);
  assert.equal(slowed.clingFrom.move, 'Time Dilation');
  assert.equal(slowed._animPace, 0.45);
  assert.equal(slowed.slowStacks, 1);

  const fermi = CHARACTERS.fermi.moves;
  assert.equal(fermi.basicCharge.name, 'Chicago Pile');
  assert.equal(fermi.basicCharge.type, 'radiation');
  assert.equal(fermi.basicCharge.type2, 'heat');
  assert.equal(fermi.basicDirectional.slowHit, true);
  assert.ok(Math.abs(slowHitScale(150) - 280 / 150) < 1e-9);
  assert.equal(slowHitScale(40), 2.2);
  assert.equal(fermi.specialDefense.outline, true);
  assert.equal(fermi.specialDefense.reflectProjectiles, undefined);
  assert.equal(fermi.specialDefense.phase, true);
  assert.equal(fermi.specialDirectional.name, 'Fermi Paradox');
  assert.equal(fermi.specialDirectional.kind, 'projectile');
  assert.equal(fermi.specialDirectional.stageBounce, true);
  assert.equal(fermi.specialDirectional.unseen, true);
  const owner = { x: 100, y: 200, facing: 1, bodyH: 100 };
  const seen = { x: 220, y: 200, bodyH: 100 };
  const hidden = { x: 40, y: 200, bodyH: 100 };
  assert.equal(fighterInView(owner, seen), true);
  assert.equal(fighterInView(owner, hidden), false);

  const mendel = CHARACTERS.mendel.moves;
  assert.equal(mendel.basicCharge.doze, true);
  assert.equal(mendel.basicCharge.buff.showBoost, true);
  assert.equal(mendel.basicCharge.buff.kineticTaken, 0.7);
  assert.equal(mendel.basicDirectional.multiHit, 5);
  const early = finalBlow({ ...mendel.basicDirectional, _hitIndex: 1 });
  const last = finalBlow({ ...mendel.basicDirectional, _hitIndex: 5 });
  assert.equal(early.noKnockback, true);
  assert.equal(early.baseKnockback, 0);
  assert.equal(last.noKnockback, undefined);
  assert.equal(last.baseKnockback, mendel.basicDirectional.baseKnockback);
  assert.equal(mendel.specialDefense.swallow, true);
  assert.equal(mendel.specialDirectional.dropOn, true);
  assert.equal(mendel.specialDirectional.fromAbove, true);
  assert.equal(mendel.specialDirectional.type, 'kinetic');
  assert.equal(mendel.specialDirectional.type2, 'radiation');
});

test('amy, curie, burke, and cali keep the approved batch rules', () => {
  const amy = CHARACTERS.amy.moves;
  assert.equal(amy.basicCharge.name, 'Alarm Blare');
  assert.equal(amy.basicCharge.type, 'kinetic');
  assert.equal(amy.basicCharge.onHit.stun, 280);
  assert.equal(amy.basicDirectional.name, 'Test Button');
  assert.equal(amy.basicDirectional.type, 'kinetic');
  assert.equal(amy.basicDirectional.type2, 'radiation');
  assert.equal(amy.specialDefense.absorbState, 'gas');
  assert.equal(amy.specialDefense.retort.knockback, 272.8);
  assert.equal(amy.specialDirectional.name, 'Ionizing Beam');
  assert.equal(amy.specialDirectional.kind, 'beam');
  assert.equal(amy.specialDirectional.type, 'radiation');
  assert.equal(amy.specialDirectional.beamCap, 440);
  assert.equal(amy.specialDirectional.beamArtPx, 440);
  assert.equal(amy.specialDirectional.zone, undefined);

  const curie = CHARACTERS.curie.moves;
  assert.equal(curie.basicCharge.chain.count, 1);
  assert.equal(curie.basicCharge.chain.type, 'chemical');
  assert.equal(curie.basicCharge.chain.useImpact, true);
  assert.equal(curie.basicCharge.chain.knockback, 122.4);
  assert.equal(curie.basicDirectional.type2, 'radiation');
  assert.equal(curie.specialDefense.scanWeak, true);
  assert.equal(curie.specialDirectional.landBurst, true);
  assert.equal(curie.specialDirectional.dropZone.useHold, true);
  assert.equal(curie.specialDirectional.dropZone.knockback, 0);
  assert.equal(curie.specialDirectional.zone, undefined);

  const burke = CHARACTERS.burke.moves;
  assert.equal(burke.basicCharge.storeHits.cap, 20);
  assert.equal(burke.basicDirectional.type, 'kinetic');
  assert.deepEqual(burke.specialDefense.blocks, ['kinetic', 'heat', 'electrical', 'chemical', 'radiation']);
  assert.equal(burke.specialDefense.crackAfterHits, 4);
  assert.equal(burke.specialDirectional.fadeIfMiss, true);
  assert.equal(burke.specialDirectional.projectileLife, 260);

  const cali = CHARACTERS.cali.moves;
  assert.equal(cali.basicCharge.buff.bonus.type, 'radiation');
  assert.equal(cali.basicCharge.buff.bonus.hits, 3);
  assert.equal(cali.basicDirectional.kind, 'dash');
  assert.equal(cali.specialDefense.stuntDouble, true);
  assert.deepEqual(cali.specialDefense.absorbTypes, ['kinetic', 'heat', 'electrical', 'chemical', 'radiation']);
  assert.equal(cali.specialDirectional.kind, 'projectile');
  assert.equal(cali.specialDirectional.bonusVsMetal, 1.45);
  assert.equal(cali.specialDirectional.bonusVsId.aurelius, 1.8);
  assert.equal(cali.specialDirectional.beamLen, undefined);
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
