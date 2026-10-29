// Battle state machine for one chapter. Pure (no Phaser): the scene drives it
// and animates the events it returns.
import { mulberry32 } from '../engine/rng.js';
import { CHARACTERS } from '../data/characters.js';
import { hostile, parseMap, reachable, threatTiles, ringTiles, pathTo, key, dist } from './grid.js';
import { terrainAt } from './terrain.js';
import { resolve, forecast } from './combat.js';
import { awardXp, moveInfo } from './units.js';
import { campaignMoves, unionRange, healMoveOf, healAmount } from './moves.js';
import { planEnemy } from './ai.js';
import { applyHitEffects, applyRecoil, startOfTurn, cleanse } from './status.js';

let uidSeq = 1;


export const SEIZE_HINT = 'Defeat the boss to seize';

function makeUnit(rec, team, x, y, extra = {}) {
  const info = moveInfo(rec.id);
  return {
    uid: uidSeq++, rec, team, x, y,
    id: rec.id,
    name: CHARACTERS[rec.id]?.name || rec.id,
    level: rec.level, xp: rec.xp, hp: rec.hp, maxHp: rec.maxHp,
    power: rec.power, def: rec.def, spd: rec.spd, mov: rec.mov, range: unionRange(rec.id),
    moves: campaignMoves(rec.id).concat(healMoveOf(rec.id) || []), cd: {}, charging: null, status: {},
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
    this.fired = new Set();
    this.recruited = [];
    const starts = chapter.starts;
    // The lord takes the chapter's rear slot; everyone else fills the rest in order.
    const lordSlot = Math.min(chapter.lordSlot ?? 0, starts.length - 1);
    const lordRec = party.find((r) => r.lord);
    const others = party.filter((r) => r !== lordRec).sort((a, b) => b.level - a.level);
    const slots = starts.map((_, i) => i).filter((i) => !lordRec || i !== lordSlot);
    if (lordRec) this.units.push(makeUnit(lordRec, 'player', starts[lordSlot][0], starts[lordSlot][1]));
    others.slice(0, slots.length).forEach((rec, n) => {
      const st = starts[slots[n]];
      this.units.push(makeUnit(rec, 'player', st[0], st[1]));
    });
    for (const e of chapter.enemies) {
      const rec = enemyRecords(e);
      const tut = chapter.tutorial; // an easing chapter: its enemies hit softer and crit less; `wake` staggers when they advance
      this.units.push(makeUnit(rec, 'enemy', e.x, e.y, {
        ai: e.ai || 'aggressive', boss: !!e.boss, wake: e.wake || 0,
        ...(tut ? { dmgMult: tut.dmg ?? 1, critMax: tut.critMax ?? 50 } : {}),
      }));
    }
    this.enemyRecords = enemyRecords;
    this.avgLevel = Math.max(1, Math.round(party.reduce((a, r) => a + r.level, 0) / Math.max(1, party.length)));
    for (const n of chapter.npcs || []) {
      const rec = enemyRecords({ id: n.id, level: n.level ?? this.avgLevel });
      this.units.push(makeUnit(rec, 'npc', n.x, n.y, { ai: 'none', talkWith: n.with || null, talkLines: n.lines || [] }));
    }
  }

  get players() { return this.units.filter((u) => u.alive && u.team === 'player'); }
  get enemies() { return this.units.filter((u) => u.alive && u.team === 'enemy'); }
  unitAt(x, y) { return this.units.find((u) => u.alive && u.x === x && u.y === y) || null; }
  tile(x, y) { return terrainAt(this.map, x, y); }

  reachFor(unit) { return reachable(this.map, unit, this.units); }
  pathFor(unit, to, reach = this.reachFor(unit)) { return pathTo(reach, to); }
  threatFor(unit) { return threatTiles(this.map, unit, this.reachFor(unit)); }

  /** Foes of `unit` in range of `move` (default: any move it can use now) if it stood at (x,y). */
  targetsFrom(unit, x = unit.x, y = unit.y, move = null) {
    const ranges = move ? [move.range] : this.usableAttacks(unit).map((m) => m.range);
    const seen = new Set();
    const out = [];
    for (const r of ranges) {
      for (const t of ringTiles(this.map, x, y, r[0], r[1])) {
        const u = this.unitAt(t.x, t.y);
        if (u && hostile(unit, u) && !seen.has(u.uid)) { seen.add(u.uid); out.push(u); }
      }
    }
    return out;
  }

  forecastFor(att, def, move = null) { return forecast(att, def, this.map, move); }

  // --------------------------------------------------------------- moves
  /** Why `move` cannot be used right now, or null when it can. */
  moveBlock(unit, move) {
    if (unit.charging) {
      if (move.key === unit.charging) return null;           // release
      return 'Charging: release or cancel first';
    }
    if (move.action === 'attack' && move.charge) return null; // starting a charge needs no target
    const cd = unit.cd[move.key] || 0;
    if (cd > 0) return `Ready in ${cd} turn${cd > 1 ? 's' : ''}`;
    return null;
  }

  /** Attack moves the unit can fire at a target this turn (a charge in progress counts as the release). */
  usableAttacks(unit) {
    if (unit.charging) return unit.moves.filter((m) => m.key === unit.charging);
    return unit.moves.filter((m) => m.attack && !m.charge && !this.moveBlock(unit, m));
  }

  /** The charge move to release this turn, if the unit is charging. */
  chargedMove(unit) {
    return unit.charging ? unit.moves.find((m) => m.key === unit.charging) || null : null;
  }

  /** Charging takes the whole turn; the release comes next turn at full power. */
  startCharge(unit, move) {
    unit.charging = move.key;
    unit.acted = true;
  }

  cancelCharge(unit) {
    unit.charging = null;
  }

  /** Guard: damage reduction until the unit's next turn. Returns the guard status. */
  guard(unit, move) {
    unit.status.guard = { frac: move.guard, turns: 1 };
    for (const e of move.effects) {
      if (e.type === 'cleanse') cleanse(unit);
      else if (e.type === 'regen') unit.status.regen = { frac: e.frac, turns: 1 };
      else if (e.type === 'thorns') unit.status.guard.thorns = e.dmg;
    }
    unit.acted = true;
    return unit.status.guard;
  }

  /** Power up: bigger hits for the next attacks. */
  powerUp(unit, move) {
    const e = move.effects.find((x) => x.type === 'power');
    unit.status.power = { mult: e.mult, turns: e.turns };
    unit.cd[move.key] = move.cd;
    unit.acted = true;
    return unit.status.power;
  }

  /** Wounded allies a healer could heal from (x,y) with `move` (default: its HEAL), nearest first. */
  healTargets(unit, x = unit.x, y = unit.y, move = unit.moves.find((m) => m.action === 'heal')) {
    if (!move) return [];
    const out = [];
    for (const t of ringTiles(this.map, x, y, move.range[0], move.range[1])) {
      const u = this.unitAt(t.x, t.y);
      if (u && u !== unit && u.team === unit.team && u.hp < u.maxHp) out.push(u);
    }
    return out;
  }

  /** Heal `target`: the whole action. A player healer earns EXP for what it restored. Returns { amount, xp }. */
  heal(healer, target, move = healer.moves.find((m) => m.action === 'heal')) {
    const amount = healAmount(target);
    target.hp += amount;
    healer.acted = true;
    let xp = null;
    if (healer.team === 'player' && amount > 0) {
      const gain = Math.min(45, 12 + Math.round(amount * 0.8));
      xp = { unit: healer, amount: gain, levelUps: awardXp(healer, gain, this.rng) };
    }
    return { amount, xp, target, healer, move };
  }

  /** Why the lord cannot seize right now ('' when it can, or when this is not a seize chapter): the boss must fall first. */
  seizeBlock() {
    if (this.chapter.win !== 'seize') return '';
    return this.units.some((u) => u.boss && u.alive && u.team === 'enemy') ? SEIZE_HINT : '';
  }

  canSeize(unit) {
    const s = this.chapter.seize;
    return this.chapter.win === 'seize' && unit.lord && unit.team === 'player' && !!s && unit.x === s[0] && unit.y === s[1] && !this.seizeBlock();
  }

  canEscape(unit) {
    const ex = this.chapter.exit;
    return this.chapter.win === 'escape' && unit.lord && unit.team === 'player' && !!ex && ex.some(([x, y]) => x === unit.x && y === unit.y);
  }

  escape(unit) {
    unit.acted = true;
    if (this.canEscape(unit)) this.result = 'victory';
    this.updateResult();
  }

  /** Recruitable neighbours of `unit` at (x,y). */
  talkTargets(unit, x = unit.x, y = unit.y) {
    if (unit.team !== 'player') return [];
    return this.units.filter((n) => n.alive && n.team === 'npc' && dist(x, y, n.x, n.y) === 1 && (!n.talkWith || n.talkWith === unit.id));
  }

  /** The unit talks to an npc: it joins the party. Returns { lines, npc }. */
  talk(unit, npc) {
    unit.acted = true;
    npc.team = 'player';
    npc.ai = 'aggressive';
    npc.acted = false;
    this.recruited.push(npc);
    return { lines: npc.talkLines, npc };
  }

  moveUnit(unit, x, y) {
    unit.x = x;
    unit.y = y;
  }

  /** Strike. Returns { log, xp:[{unit,amount,levelUps}], killed:[units], forecast }. */
  attack(att, def, move = null) {
    move = move || att.moves.find((m) => m.key === 'basicDirectional');
    const released = att.charging === move.key;
    if (released) att.charging = null;
    if (move.cd) att.cd[move.key] = move.cd;
    const res = resolve(att, def, this.map, this.rng, move);
    // effects of every strike that landed (the counter's effects hit the attacker)
    const effects = [];
    for (const l of res.log) {
      if (!l.hit) continue;
      const [from, to] = l.by === 'att' ? [att, def] : [def, att];
      effects.push(...applyHitEffects(this, from, to, l.move, l, this.rng));
    }
    const recoil = applyRecoil(att, move);
    if (recoil) effects.push(recoil);
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
    return { ...res, killed, xp, move, released, effects };
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
    if (win === 'escape' && !this.enemies.length) this.result = 'victory';
    if (win === 'defend' && !this.enemies.length && !this.pendingSpawns()) this.result = 'victory';
    if (win === 'boss' && !this.units.some((u) => u.boss && u.alive)) this.result = 'victory';
    if (win === 'seize' && !this.enemies.length) this.result = 'victory';
    return this.result;
  }

  /** Heal units standing on forts/thrones at the start of their phase. */
  startPhase(team) {
    this.phase = team;
    const healed = [];
    this.phaseEvents = [];
    for (const u of this.units) {
      if (!u.alive || u.team !== team) continue;
      u.acted = false;
      for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k] -= 1;
      // statuses count down at the start of the owner's phase; burn/poison/regen tick and a stun skips the turn
      const ticking = startOfTurn(u);
      for (const [name, st] of Object.entries(u.status)) { st.turns -= 1; if (st.turns <= 0) delete u.status[name]; }
      this.phaseEvents.push(...ticking);
      if (u.hp <= 0) { u.alive = false; this.phaseEvents.push({ type: 'dotKill', unit: u }); this.updateResult(); continue; }
      // a pinned throne boss would out-heal a small party (20% a turn on top of the throne's cover), so only others rest on healing tiles
      const heal = u.boss && u.ai === 'boss' && this.chapter.win === 'seize' ? 0 : this.tile(u.x, u.y)?.heal;
      if (heal && u.hp < u.maxHp) {
        const n = Math.min(u.maxHp - u.hp, Math.max(2, Math.round(u.maxHp * heal)));
        u.hp += n;
        healed.push({ unit: u, amount: n });
      }
    }
    this.lastHealed = healed;
    return healed;
  }

  /** Called when every player unit has acted or the player ends the turn. */
  endPlayerPhase() {
    for (const u of this.players) u.acted = true;
    return this.startPhase('enemy');
  }

  endEnemyPhase() {
    this.turn += 1;
    if (this.chapter.win === 'defend' && this.turn > this.chapter.turns && !this.result) this.result = 'victory';
    return this.startPhase('player');
  }

  // -------------------------------------------------------------- events
  pendingSpawns() {
    return (this.chapter.events || []).some((e, i) => !this.fired.has(i) && e.spawn?.some((s) => (s.team || 'enemy') === 'enemy'));
  }

  freeTileNear(x, y) {
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx; const ny = y + dy;
          const t = this.tile(nx, ny);
          if (t && Number.isFinite(t.cost) && !this.unitAt(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return { x, y };
  }

  /**
   * Fire any story events due. kind: 'start' | 'turn' | 'enemyTurn' | 'move' | 'death'.
   * Spawns are applied here; the scene shows the lines and adds views for `spawned`.
   * Returns [{ event, lines, spawned }].
   */
  checkEvents(kind, ctx = {}) {
    const out = [];
    (this.chapter.events || []).forEach((ev, i) => {
      if (this.fired.has(i) || (this.result && kind !== 'death')) return;
      const w = ev.when || {};
      let hit = false;
      if (kind === 'start') hit = !!w.start;
      else if (kind === 'turn') hit = w.turn === this.turn;
      else if (kind === 'enemyTurn') hit = w.enemyTurn === this.turn;
      else if (kind === 'death') hit = w.death === ctx.unit?.id;
      else if (kind === 'move' && w.near) {
        const target = this.units.find((u) => u.alive && u.team === 'enemy' && u.id === w.near);
        hit = !!target && this.players.some((p) => dist(p.x, p.y, target.x, target.y) <= (w.dist ?? 4));
      }
      if (!hit) return;
      this.fired.add(i);
      const spawned = [];
      for (const sp of ev.spawn || []) {
        const at = this.freeTileNear(sp.x, sp.y);
        const team = sp.team || 'enemy';
        const rec = this.enemyRecords({ id: sp.id, level: sp.level ?? this.avgLevel });
        const u = makeUnit(rec, team, at.x, at.y, { ai: sp.ai || 'aggressive', boss: !!sp.boss, arrived: true });
        this.units.push(u);
        spawned.push(u);
      }
      out.push({ event: ev, lines: ev.lines || [], spawned });
    });
    return out;
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
        v: 2, level: u.level, xp: u.xp, hp: u.hp, maxHp: u.maxHp, power: u.power, def: u.def, spd: u.spd,
      });
      survivors.push(u.rec);
    }
    return survivors;
  }

  fallen() { return this.units.filter((u) => u.team === 'player' && !u.alive); }
}

export { key, dist };
