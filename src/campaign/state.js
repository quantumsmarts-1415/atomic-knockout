// Battle state machine for one chapter. Pure (no Phaser): the scene drives it
// and animates the events it returns.
import { mulberry32 } from '../engine/rng.js';
import { CHARACTERS } from '../data/characters.js';
import { parseMap, reachable, threatTiles, ringTiles, pathTo, key, dist } from './grid.js';
import { terrainAt } from './terrain.js';
import { resolve, forecast } from './combat.js';
import { awardXp, moveInfo } from './units.js';
import { planEnemy } from './ai.js';

let uidSeq = 1;

function makeUnit(rec, team, x, y, extra = {}) {
  const info = moveInfo(rec.id);
  return {
    uid: uidSeq++, rec, team, x, y,
    id: rec.id,
    name: CHARACTERS[rec.id]?.name || rec.id,
    level: rec.level, xp: rec.xp, hp: rec.hp, maxHp: rec.maxHp,
    power: rec.power, def: rec.def, spd: rec.spd, mov: rec.mov, range: rec.range,
    lord: !!rec.lord, moveName: info.name,
    ai: 'aggressive', boss: false,
    acted: false, alive: true,
    ...extra,
  };
}

export class CampaignBattle {
  /**
   * @param chapter  entry from CHAPTERS
   * @param party    unit records (already restored to full HP)
   * @param opts     { seed, enemyRecords } enemyRecords: id->record builder
   */
  constructor(chapter, party, { seed = 1, enemyRecords } = {}) {
    this.chapter = chapter;
    this.map = parseMap(chapter.map);
    this.rng = mulberry32(seed);
    this.units = [];
    this.turn = 1;
    this.phase = 'player';
    this.result = null; // 'victory' | 'defeat'
    this.kills = 0;
    const starts = chapter.starts;
    // The lord takes the chapter's rear slot; everyone else fills the rest in order.
    const lordSlot = Math.min(chapter.lordSlot ?? 0, starts.length - 1);
    const lordRec = party.find((r) => r.lord);
    const others = party.filter((r) => r !== lordRec);
    const slots = starts.map((_, i) => i).filter((i) => !lordRec || i !== lordSlot);
    if (lordRec) this.units.push(makeUnit(lordRec, 'player', starts[lordSlot][0], starts[lordSlot][1]));
    others.slice(0, slots.length).forEach((rec, n) => {
      const st = starts[slots[n]];
      this.units.push(makeUnit(rec, 'player', st[0], st[1]));
    });
    for (const e of chapter.enemies) {
      const rec = enemyRecords(e);
      this.units.push(makeUnit(rec, 'enemy', e.x, e.y, { ai: e.ai || 'aggressive', boss: !!e.boss }));
    }
  }

  get players() { return this.units.filter((u) => u.alive && u.team === 'player'); }
  get enemies() { return this.units.filter((u) => u.alive && u.team === 'enemy'); }
  unitAt(x, y) { return this.units.find((u) => u.alive && u.x === x && u.y === y) || null; }
  tile(x, y) { return terrainAt(this.map, x, y); }

  reachFor(unit) { return reachable(this.map, unit, this.units); }
  pathFor(unit, to, reach = this.reachFor(unit)) { return pathTo(reach, to); }
  threatFor(unit) { return threatTiles(this.map, unit, this.reachFor(unit)); }

  /** Foes of `unit` within its range if it stood at (x,y). */
  targetsFrom(unit, x = unit.x, y = unit.y) {
    const out = [];
    for (const t of ringTiles(this.map, x, y, unit.range[0], unit.range[1])) {
      const u = this.unitAt(t.x, t.y);
      if (u && u.team !== unit.team) out.push(u);
    }
    return out;
  }

  forecastFor(att, def) { return forecast(att, def, this.map); }

  canSeize(unit) {
    const s = this.chapter.seize;
    return this.chapter.win === 'seize' && unit.lord && unit.team === 'player' && s && unit.x === s[0] && unit.y === s[1];
  }

  moveUnit(unit, x, y) {
    unit.x = x;
    unit.y = y;
  }

  /** Strike. Returns { log, xp:[{unit,amount,levelUps}], killed:[units], forecast }. */
  attack(att, def) {
    const res = resolve(att, def, this.map, this.rng);
    const killed = [];
    for (const u of [att, def]) {
      if (u.hp <= 0 && u.alive) { u.alive = false; killed.push(u); }
    }
    const xp = [];
    for (const [u, foe] of [[att, def], [def, att]]) {
      if (u.team !== 'player') continue;
      const dealt = res.log.some((l) => l.by === (u === att ? 'att' : 'def') && l.hit);
      let amount = 8;
      if (dealt) amount = 20;
      if (killed.includes(foe)) amount = Math.max(40, Math.min(100, 50 + 8 * (foe.level - u.level)));
      if (!u.alive) amount = 0;
      if (amount > 0) {
        const ups = awardXp(u, amount, this.rng);
        xp.push({ unit: u, amount, levelUps: ups });
      }
    }
    if (killed.some((k) => k.team === 'enemy')) this.kills += killed.filter((k) => k.team === 'enemy').length;
    att.acted = true;
    this.updateResult();
    return { ...res, killed, xp };
  }

  wait(unit) { unit.acted = true; }

  seize(unit) {
    unit.acted = true;
    if (this.canSeize(unit)) this.result = 'victory';
    this.updateResult();
  }

  updateResult() {
    if (this.result) return this.result;
    const lord = this.units.find((u) => u.lord && u.team === 'player');
    if ((lord && !lord.alive) || !this.players.length) { this.result = 'defeat'; return this.result; }
    const { win } = this.chapter;
    if (win === 'rout' && !this.enemies.length) this.result = 'victory';
    if (win === 'boss' && !this.units.some((u) => u.boss && u.alive)) this.result = 'victory';
    if (win === 'seize' && !this.enemies.length) this.result = 'victory';
    return this.result;
  }

  /** Heal units standing on forts/thrones at the start of their phase. */
  startPhase(team) {
    this.phase = team;
    const healed = [];
    for (const u of this.units) {
      if (!u.alive || u.team !== team) continue;
      u.acted = false;
      const heal = this.tile(u.x, u.y)?.heal;
      if (heal && u.hp < u.maxHp) {
        const n = Math.min(u.maxHp - u.hp, Math.max(2, Math.round(u.maxHp * heal)));
        u.hp += n;
        healed.push({ unit: u, amount: n });
      }
    }
    return healed;
  }

  /** Called when every player unit has acted or the player ends the turn. */
  endPlayerPhase() {
    for (const u of this.players) u.acted = true;
    return this.startPhase('enemy');
  }

  endEnemyPhase() {
    this.turn += 1;
    return this.startPhase('player');
  }

  /** Next enemy still to act, boss last. */
  nextEnemy() {
    const waiting = this.enemies.filter((u) => !u.acted);
    waiting.sort((a, b) => (a.boss - b.boss) || (a.uid - b.uid));
    return waiting[0] || null;
  }

  plan(unit) { return planEnemy(this, unit); }

  /** Write survivors' stats back into their records. */
  commit() {
    const survivors = [];
    for (const u of this.units) {
      if (u.team !== 'player') continue;
      if (!u.alive) continue;
      Object.assign(u.rec, {
        level: u.level, xp: u.xp, hp: u.hp, maxHp: u.maxHp, power: u.power, def: u.def, spd: u.spd,
      });
      survivors.push(u.rec);
    }
    return survivors;
  }

  fallen() { return this.units.filter((u) => u.team === 'player' && !u.alive); }
}

export { key, dist };
