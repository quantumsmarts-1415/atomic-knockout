// Combat forecast and resolution (stat rework, Oct 2026). Pure: callers pass an rng.
//
//   damage  flat HP, the Smash Ring numbers: move base (Normal 10, Special 15, Charge 20, Defense 5, ghosts +5) plus the
//           average of (Attack - Defense) over the move's damage types. A type the defender is immune to counts 0 in the
//           average; a move whose types are ALL immune does nothing. Never below 0.
//   hits    a move with several hits splits its base evenly; the stat bonus lands on the LAST hit. Every hit rolls on its own.
//   roll    one roll per hit gives exactly one of: miss, hit, crit (crit = x2). The slot sets crit% = miss% (Normal 5,
//           Special 15, Charge 10, Defense 5); each Skill point is +1 hit% and +1 crit%. Terrain dodge (avoid) and
//           blindness add to the miss chance. Terrain defense and Speed play no part in combat.
//   counter the defender strikes back with its basic move only if the attacker stands inside that move's range
//   (a chapter's `tutorial: { dmg, critMax }` softens its enemies: damage x dmg and crit capped at critMax)
import { campaignMoves, basicOf } from './moves.js';
import { terrainAt } from './terrain.js';
import { dist } from './grid.js';
import { RW, REWORK_SLOT_OF_CAMPAIGN, bonusFromTables, hitDamage, rollOutcome, rollTable } from '../data/statRework.js';
import { CHARACTERS } from '../data/characters.js';

export const CRIT_MULT = RW.critMult;
export const BLIND_MISS = 30;

/** The unit's moves (plain test units without a `moves` list fall back to their fighter's). */
export function movesOf(unit) {
  return unit.moves || campaignMoves(unit.id);
}

export function basicOfUnit(unit) {
  return movesOf(unit).find((m) => m.key === 'basicDirectional') || basicOf(unit.id);
}

/** The stat tables a unit fights with: its own (level-ups grow them) or its fighter's sheet numbers. */
function atkTable(u) { return u.atk || CHARACTERS[u.id]?.rework?.atk || null; }
function defTable(u) { return u.dst || CHARACTERS[u.id]?.rework?.def || null; }

/** Stat bonus of `move` used by `att` on `def` (null when every type is immune). */
export function statBonusFor(att, def, move) {
  return bonusFromTables(atkTable(att), defTable(def), move.types || []);
}

function strike(att, def, map, move) {
  const tile = terrainAt(map, def.x, def.y);
  const power = att.status?.power ? att.status.power.mult : 1;
  const weaken = att.status?.weaken ? att.status.weaken.mult : 1;
  const vuln = def.status?.vulnerable ? def.status.vulnerable.mult : 1;
  const guard = def.status?.guard ? 1 - def.status.guard.frac : 1;
  const hits = Math.max(0, move.hits ?? 1);
  const bonus = statBonusFor(att, def, move);
  const mult = power * weaken * vuln * (att.dmgMult ?? 1) * guard;
  const per = [];
  for (let n = 1; n <= Math.max(1, hits); n++) {
    const raw = hits > 0 ? hitDamage({ base: move.base ?? 0, bonus, hits, n }) : 0;
    per.push(Math.round(raw * mult));
  }
  const blind = att.status?.blind ? BLIND_MISS : 0;
  const table = rollTable({ slot: REWORK_SLOT_OF_CAMPAIGN[move.slot] || 'normal', skill: att.skill ?? RW.skillStart, avoid: (tile?.avoid || 0) + blind });
  if (att.critMax != null && table.crit > att.critMax) { table.hit += table.crit - att.critMax; table.crit = att.critMax; }
  const total = per.reduce((a, b) => a + b, 0);
  return {
    move,
    bonus,
    hits: Math.max(1, hits),
    perHit: per,
    dmg: total,                                   // every hit landing, no crit
    table,
    hit: Math.round(100 - table.miss),            // hit or crit
    crit: Math.round(table.crit),
    exp: total * (table.hit / 100 + (CRIT_MULT * table.crit) / 100),
  };
}

export function inRange(unit, dx, dy) {
  const d = Math.abs(dx) + Math.abs(dy);
  return d >= unit.range[0] && d <= unit.range[1];
}

/**
 * What would happen if `att` uses `move` (default: its basic move) on `def` from where each stands now.
 * The defender counters with its basic move when the attacker is inside that move's range.
 */
export function forecast(att, def, map, move = null) {
  const m = move || basicOfUnit(att);
  const d = dist(att.x, att.y, def.x, def.y);
  const out = { dist: d, move: m, att: strike(att, def, map, m), def: null, attHits: 1, defHits: 0 };
  const counter = basicOfUnit(def);
  if (counter && !def.stunned && !(def.sleeping > 0) && inRange({ range: counter.range }, att.x - def.x, att.y - def.y)) {
    out.def = strike(def, att, map, counter);
    out.defHits = 1;
  }
  return out;
}

/**
 * Play the exchange. Mutates hp on both units and returns the strike log, one entry per hit:
 * [{ by:'att'|'def', hit, crit, dmg, targetHp, killed, move, n, of }]
 */
export function resolve(att, def, map, rng, move = null) {
  const f = forecast(att, def, map, move);
  const seq = ['att'];
  if (f.def) seq.push('def');
  const log = [];
  for (const side of seq) {
    const who = side === 'att' ? att : def;
    const tgt = side === 'att' ? def : att;
    if (who.hp <= 0 || tgt.hp <= 0) break;
    const s = side === 'att' ? f.att : f.def;
    for (let n = 1; n <= s.hits; n++) {
      if (who.hp <= 0 || tgt.hp <= 0) break;
      const outcome = rollOutcome(s.table, rng());
      const hit = outcome !== 'miss';
      const crit = outcome === 'crit';
      const dmg = hit ? s.perHit[n - 1] * (crit ? CRIT_MULT : 1) : 0;
      tgt.hp = Math.max(0, tgt.hp - dmg);
      if (dmg > 0 && tgt.sleeping > 0) tgt.sleeping = 0;   // damage wakes a sleeper
      log.push({ by: side, hit, crit, dmg, targetHp: tgt.hp, killed: tgt.hp <= 0, move: s.move, n, of: s.hits });
      if (tgt.hp <= 0) break;
    }
  }
  return { log, forecast: f };
}
