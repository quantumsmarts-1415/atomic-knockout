import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '../src/data/characters.js';
import { computeBotInput } from '../src/engine/BotAI.js';

const SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];
const TYPES = new Set(['kinetic', 'heat', 'electrical', 'chemical', 'radiation', 'physical']);

test('every fighter has four named moves with legal damage types', () => {
  assert.strictEqual(Object.keys(CHARACTERS).length, 29);
  for (const c of Object.values(CHARACTERS)) {
    for (const slot of SLOTS) {
      const move = c.moves[slot];
      assert.ok(move?.name, `${c.id} missing ${slot}`);
      assert.ok(move.duration > 0 && move.cooldown >= 0, `${c.id} ${move.name} timing`);
      for (const t of [move.type, move.type2, move.wallType, move.counterType].filter(Boolean)) {
        assert.ok(TYPES.has(t), `${c.id} ${move.name} type ${t}`);
      }
      if (c.id !== 'lillie') {
        for (const t of [move.type, move.type2].filter(Boolean)) {
          assert.notStrictEqual(t, 'physical', `${c.id} ${move.name} still says physical`);
        }
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
  assert.strictEqual(l.basicDirectional.name, 'Spark Jab');
  assert.strictEqual(l.specialDirectional.name, 'Water Reaction');
  assert.strictEqual(l.basicCharge.name, 'Volt Dash');
  assert.strictEqual(l.specialDefense.name, 'Reactive Armor');
  assert.strictEqual(l.specialDirectional.damage, 11);
  assert.strictEqual(l.basicCharge.dashSpeed, 650);

  const h = CHARACTERS.hydra.moves;
  assert.deepStrictEqual(
    [h.basicCharge.name, h.basicDirectional.name, h.specialDefense.name, h.specialDirectional.name],
    ['Supernova', 'Flame Dash', 'Fire Wall', 'Hydrogen Bomb'],
  );
  assert.strictEqual(CHARACTERS.helen.moves.basicCharge.name, 'Balloon Bop');
  assert.strictEqual(CHARACTERS.helen.moves.specialDirectional.name, 'Air Wave');
  assert.strictEqual(CHARACTERS.natalie.moves.specialDirectional.name, 'Brine Burst');
  assert.notStrictEqual(
    CHARACTERS.natalie.moves.specialDirectional.name,
    CHARACTERS.lillie.moves.specialDirectional.name,
  );
});

test('a dive bot will not launch toward the open side of the deck', () => {
  const bot = fake('scarlett', 900, 500);
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
