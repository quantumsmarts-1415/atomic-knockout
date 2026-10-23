import test from 'node:test';
import assert from 'node:assert';
import { CHARACTERS } from '../src/data/characters.js';
import {
  TUNING, chemicalMult, densityT, deriveProfile, electricalTakenMult, resolvePacket, resolveMoveDamage,
} from '../src/data/balance.js';

test('gases have no kinetic modifiers and nobles ignore chemical damage', () => {
  const h = CHARACTERS.hydra.combat;
  assert.strictEqual(h.kineticAtk, 0);
  assert.strictEqual(h.kineticDef, 0);
  assert.ok(h.speed > TUNING.baseSpeed, 'hydrogen should be faster than the base');
  assert.ok(h.weight < 1, 'hydrogen should be light');

  const helen = CHARACTERS.helen.combat;
  assert.strictEqual(helen.noble, true);
  const chem = resolvePacket(10, 'chemical', CHARACTERS.flora.combat, helen);
  assert.strictEqual(chem, 0);
});

test('missing tensile strength is a zero kinetic-defense modifier', () => {
  assert.strictEqual(CHARACTERS.natalie.combat.kineticDef, 0);
  assert.strictEqual(CHARACTERS.bord.combat.kineticDef, 0);
  assert.ok(CHARACTERS.ben.combat.kineticDef > 0.2);
});

test('mohs scales kinetic attack and diamond is the hardest hitter', () => {
  const carter = CHARACTERS.carter.combat.kineticAtk;
  const chroma = CHARACTERS.chroma.combat.kineticAtk;
  const lillie = CHARACTERS.lillie.combat.kineticAtk;
  assert.ok(carter > chroma);
  assert.ok(chroma > lillie);
  assert.ok(lillie > 0);
  assert.ok(Math.abs(carter - TUNING.mohsMax) < 1e-9);
});

test('electrical defense is a bell: mid-range takes more than either extreme', () => {
  const insulator = electricalTakenMult(0);
  const mid = electricalTakenMult(3);
  const copper = electricalTakenMult(59);
  const missing = electricalTakenMult(null);
  assert.ok(mid > insulator, `mid ${mid} should exceed insulator ${insulator}`);
  assert.ok(mid > copper, `mid ${mid} should exceed copper ${copper}`);
  assert.ok(mid > 1, 'mid-range takes more than unmodified damage');
  assert.ok(insulator < 1 && copper < 1);
  assert.strictEqual(missing, 1);
});

test('chemical damage grows with electronegativity difference', () => {
  const flora = CHARACTERS.flora.combat;
  const natalie = CHARACTERS.natalie.combat;
  const kyle = CHARACTERS.kyle.combat;
  const oxana = CHARACTERS.oxana.combat;
  const same = resolvePacket(10, 'chemical', flora, flora);
  const vsSodium = resolvePacket(10, 'chemical', flora, natalie);
  const vsPotassium = resolvePacket(10, 'chemical', flora, kyle);
  const vsOxygen = resolvePacket(10, 'chemical', flora, oxana);
  assert.ok(Math.abs(same - 10) < 1e-9);
  assert.ok(vsPotassium > vsSodium);
  assert.ok(vsSodium > vsOxygen);
  assert.ok(vsOxygen > same);
  const gap = Math.abs(flora.en - kyle.en);
  const expected = 10 * Math.min(TUNING.chemClamp[1], 1 + TUNING.chemPerEn * gap);
  assert.ok(Math.abs(vsPotassium - expected) < 1e-9);
  assert.strictEqual(CHARACTERS.phillip.combat.en, 2.19);
  assert.strictEqual(flora.en, 3.98);
  assert.strictEqual(CHARACTERS.neo.combat.en, null);
  assert.strictEqual(resolvePacket(10, 'chemical', flora, CHARACTERS.neo.combat), 0);
  assert.strictEqual(resolvePacket(10, 'chemical', flora, CHARACTERS.helen.combat), 0);
  const unpublished = deriveProfile({
    density: 1, mohs: 1, tensile: 10, boiling: 1000, conductivity: 1, en: null, noble: false,
  });
  assert.strictEqual(chemicalMult(flora, unpublished), 1);
  assert.strictEqual(resolvePacket(10, 'chemical', flora, unpublished), 10);
  const move = { type: 'chemical', damage: 10 };
  const onKyle = resolveMoveDamage(move, CHARACTERS.flora, CHARACTERS.kyle).total;
  const onOxana = resolveMoveDamage(move, CHARACTERS.flora, CHARACTERS.oxana).total;
  assert.ok(onKyle > onOxana);
  assert.strictEqual(resolveMoveDamage(move, CHARACTERS.flora, CHARACTERS.aaron).total, 0);
});

test('density orders speed and weight, and every roster fighter stays in clamp', () => {
  const ids = Object.keys(CHARACTERS);
  for (const id of ids) {
    const c = CHARACTERS[id].combat;
    assert.ok(c, `${id} has a combat profile`);
    assert.ok(c.speed >= TUNING.speedClamp[0] && c.speed <= TUNING.speedClamp[1], id);
    assert.ok(c.jumpVelocity >= TUNING.jumpClamp[0] && c.jumpVelocity <= TUNING.jumpClamp[1], id);
    assert.ok(c.weight >= TUNING.weightClamp[0] && c.weight <= TUNING.weightClamp[1], id);
  }
  assert.ok(CHARACTERS.hydra.combat.speed > CHARACTERS.chroma.combat.speed);
  assert.ok(CHARACTERS.hydra.combat.weight < CHARACTERS.chroma.combat.weight);
  assert.ok(CHARACTERS.chroma.combat.radDef > CHARACTERS.hydra.combat.radDef);
});

test('jumps are one shared hop, with a second jump only for light fighters', () => {
  assert.strictEqual(CHARACTERS.helen.stats.airJumps, 1);
  assert.strictEqual(CHARACTERS.helen.stats.jumps, 2);
  assert.strictEqual(CHARACTERS.sully.stats.airJumps, 0);
  assert.strictEqual(CHARACTERS.sully.stats.jumps, 1);
  assert.strictEqual(CHARACTERS.helen.stats.speed, CHARACTERS.helen.combat.speed);
  for (const c of Object.values(CHARACTERS)) {
    assert.ok(c.stats.airJumps === 0 || c.stats.airJumps === 1, c.id);
    const g = 1500 * c.stats.gravityScale;
    const apex = c.stats.jumpVelocity ** 2 / (2 * g);
    assert.ok(Math.abs(apex - 140) < 0.5, `${c.id} apex ${apex}`);
  }
});

test('cold gases take more heat damage than refractory metals', () => {
  const heatOnHelen = resolvePacket(10, 'heat', null, CHARACTERS.helen.combat);
  const heatOnVan = resolvePacket(10, 'heat', null, CHARACTERS.van.combat);
  assert.ok(heatOnHelen > 10);
  assert.ok(heatOnVan < 10);
});

test('a dual-type move resolves each packet on its own', () => {
  const move = { type: 'kinetic', damage: 8, type2: 'heat', damage2: 6 };
  const { packets, total } = resolveMoveDamage(move, CHARACTERS.carter, CHARACTERS.hydra);
  assert.strictEqual(packets.length, 2);
  assert.strictEqual(packets[0].type, 'kinetic');
  assert.strictEqual(packets[1].type, 'heat');
  assert.ok(total > 0);
  assert.ok(packets[0].dealt > 8, 'diamond hardness should raise kinetic damage');
});

test('densityT is null for missing data and ordered across the table', () => {
  assert.strictEqual(densityT(0), null);
  assert.strictEqual(densityT(null), null);
  assert.ok(densityT(0.00009) < densityT(0.003));
  assert.ok(densityT(0.003) < densityT(0.5));
  assert.ok(densityT(0.5) < densityT(7));
  assert.ok(densityT(7) < densityT(22));
});

test('deriveProfile treats unpublished conductivity as no electrical modifier', () => {
  const ghost = deriveProfile({
    density: null, mohs: 0, tensile: 0, boiling: null, conductivity: null, en: null,
  });
  assert.strictEqual(ghost.kineticAtk, 0);
  assert.strictEqual(ghost.kineticDef, 0);
  assert.strictEqual(ghost.heatDef, 0);
  assert.strictEqual(ghost.elecAtk, 0);
  assert.strictEqual(ghost.elecTaken, 1);
  assert.strictEqual(ghost.radDef, 0);
  assert.strictEqual(ghost.speed, TUNING.baseSpeed);
});
