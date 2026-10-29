// Status effects on the tactics map: the fighting game's move effects, translated to turns.
//
//   stun        target skips its next turn. Stuns cannot chain: a unit that just lost a turn is immune until its next
//               turn begins (`stunImmune`), so nobody is stunned two turns in a row.
//   burn        damage at the start of each of the unit's turns (can KO);  poison: same, but never takes the last HP
//   slow/freeze/root  -2 / -3 / all movement on its next turn (attacks still work)
//   blind       -30% hit chance on its next turn;  weaken: its hits do -25%;  vulnerable: it takes +30% from hits
//   guard/power set by its own moves (see moves.js);  regen heals at the start of its turns
//   interrupt   cancels a charge;  push/pull move the target 1 tile;  lifesteal/recoil/thorns move HP around
// Statuses live in `unit.status[name] = { turns, ... }`; turns count down at the start of the unit's own phase.
import { terrainAt } from './terrain.js';

export const STATUS_LABEL = {
  stun: ['STUNNED', '#FF6FA8'], burn: ['BURN', '#FF7A3C'], poison: ['POISON', '#9AE04A'],
  slow: ['SLOW', '#7CC8FF'], freeze: ['FROZEN', '#BFF0FF'], root: ['ROOTED', '#C9A15A'],
  blind: ['BLIND', '#E8E8A0'], weaken: ['WEAKENED', '#B79CFF'], vulnerable: ['EXPOSED', '#FF6F6F'],
  regen: ['REGEN', '#53E0A8'], guard: ['GUARD', '#35A8FF'], power: ['POWER UP', '#FF9A3C'],
};

/** Everything to show on a unit: [{ label, color }] (charge, stun, immunity and each status). */
export function statusTags(u) {
  const tags = [];
  if (u.charging) tags.push({ id: 'charging', label: 'CHARGING', color: '#FFD166' });
  if (u.stunned) tags.push({ id: 'stun', label: 'STUNNED', color: STATUS_LABEL.stun[1] });
  if (u.stunImmune) tags.push({ id: 'immune', label: 'STUN IMMUNE', color: '#D6E4FF' });
  for (const [name] of Object.entries(u.status || {})) {
    const l = STATUS_LABEL[name];
    if (l) tags.push({ id: name, label: l[0], color: l[1] });
  }
  return tags;
}

function clampHp(u) { u.hp = Math.max(0, Math.min(u.maxHp, u.hp)); }

/** Apply a move's hit effects. `hit` is the strike entry; returns events for the scene to show. */
export function applyHitEffects(battle, att, def, move, hit, rng) {
  const ev = [];
  if (!hit.hit || !move?.effects) return ev;
  const dealt = hit.dmg;
  const target = def;
  for (const e of move.effects) {
    switch (e.type) {
      case 'stun': {
        if (target.hp <= 0) break;
        if (target.stunImmune) { ev.push({ type: 'immune', unit: target }); break; }
        if (target.stunned) break;
        if (rng() < e.chance) { target.stunned = true; target.charging = null; ev.push({ type: 'stun', unit: target }); }
        break;
      }
      case 'burn': case 'poison':
        if (target.hp > 0) { target.status[e.type] = { dmg: e.dmg, turns: e.turns }; ev.push({ type: e.type, unit: target }); }
        break;
      case 'slow': case 'freeze': case 'root':
        if (target.hp > 0) { target.status[e.type] = { turns: e.turns + 1 }; ev.push({ type: e.type, unit: target }); }
        break;
      case 'blind': case 'weaken': case 'vulnerable':
        if (target.hp > 0) { target.status[e.type] = { turns: e.turns + 1, mult: e.mult }; ev.push({ type: e.type, unit: target }); }
        break;
      case 'interrupt':
        if (target.charging && target.hp > 0) { target.charging = null; ev.push({ type: 'interrupt', unit: target }); }
        break;
      case 'strip':
        if (target.status.guard || target.status.power) { delete target.status.guard; delete target.status.power; ev.push({ type: 'strip', unit: target }); }
        break;
      case 'lifesteal': {
        const n = Math.round(dealt * e.frac);
        if (n > 0 && att.hp > 0) { att.hp += n; clampHp(att); ev.push({ type: 'lifesteal', unit: att, amount: n }); }
        break;
      }
      case 'push': case 'pull': {
        if (target.hp <= 0) break;
        const dx = Math.sign(target.x - att.x);
        const dy = Math.sign(target.y - att.y);
        const sx = dx !== 0 && Math.abs(target.x - att.x) >= Math.abs(target.y - att.y) ? dx : 0;
        const sy = sx === 0 ? dy : 0;
        const dir = e.type === 'push' ? 1 : -1;
        const nx = target.x + sx * dir;
        const ny = target.y + sy * dir;
        const t = terrainAt(battle.map, nx, ny);
        const dAfter = Math.abs(nx - att.x) + Math.abs(ny - att.y);
        if (t && Number.isFinite(t.cost) && !battle.unitAt(nx, ny) && (e.type === 'push' || dAfter >= 1)) {
          battle.moveUnit(target, nx, ny);
          ev.push({ type: e.type, unit: target, to: { x: nx, y: ny } });
        }
        break;
      }
      default: break;
    }
  }
  // thorns: a guarding unit hurts melee attackers
  const th = def.status?.guard?.thorns;
  if (th && att !== def && Math.abs(att.x - def.x) + Math.abs(att.y - def.y) === 1 && att.hp > 0) {
    att.hp = Math.max(1, att.hp - th);
    ev.push({ type: 'thorns', unit: att, amount: th });
  }
  return ev;
}

/** Recoil from using a move, once per use (never takes the last HP). */
export function applyRecoil(user, move) {
  const e = move.effects?.find((x) => x.type === 'recoil');
  if (!e || user.hp <= 1) return null;
  const n = Math.min(e.dmg, user.hp - 1);
  user.hp -= n;
  return { type: 'recoil', unit: user, amount: n };
}

/**
 * Start of `unit`'s phase: stun skips the turn (and grants stun immunity until the next turn),
 * burn/poison tick, regen heals. Returns events for the scene.
 */
export function startOfTurn(unit) {
  const ev = [];
  if (unit.stunned) {
    unit.stunned = false;
    unit.stunImmune = true;
    unit.acted = true;
    unit.charging = null;
    ev.push({ type: 'skip', unit });
  } else unit.stunImmune = false;
  for (const k of ['burn', 'poison']) {
    const st = unit.status[k];
    if (!st || unit.hp <= 0) continue;
    const n = k === 'poison' ? Math.min(st.dmg, Math.max(0, unit.hp - 1)) : Math.min(st.dmg, unit.hp);
    if (n > 0) { unit.hp -= n; ev.push({ type: `${k}Tick`, unit, amount: n }); }
  }
  const rg = unit.status.regen;
  if (rg && unit.hp > 0 && unit.hp < unit.maxHp) {
    const n = Math.min(unit.maxHp - unit.hp, Math.round(unit.maxHp * rg.frac));
    unit.hp += n;
    ev.push({ type: 'regenTick', unit, amount: n });
  }
  return ev;
}

/** Cleanse: remove the debuffs from a unit. */
export function cleanse(unit) {
  for (const k of ['burn', 'poison', 'slow', 'freeze', 'root', 'blind', 'weaken', 'vulnerable']) delete unit.status[k];
  unit.stunned = false;
}
