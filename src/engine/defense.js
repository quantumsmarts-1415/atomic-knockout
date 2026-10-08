// How a defending fighter answers one incoming hit. Data on the move, not
// per-character branches, so later elements can reuse the same words.
import { canonicalType } from '../data/balance.js';

function typesOf(move) {
  const out = [];
  if (move?.type) out.push(canonicalType(move.type));
  if (move?.type2) out.push(canonicalType(move.type2));
  return out;
}

function breaksBlock(move, defense) {
  const how = move?.breaksBlock;
  if (!how) return false;
  const frac = move._chargeFrac ?? 1;
  if (how === true) return true;
  if (how === 'full') return frac >= 0.95;
  if (how === 'weak') {
    const reduction = defense.blockReduction ?? defense.damageReduction ?? 1;
    return defense.kind === 'block' && reduction < 0.55;
  }
  return false;
}

function rootMs(defense, attacker) {
  let ms = defense.rootMs ?? defense.counterRootMs ?? 0;
  if (!ms) return 0;
  const family = attacker?.charDef?.combat?.family ?? attacker?.combat?.family;
  if (defense.rootBonusVs && family === defense.rootBonusVs) ms *= 2;
  return ms;
}

/**
 * @returns {{ result: 'pass'|'negate'|'pop'|'partial'|'counter', reduction?: number, noKnockback?: boolean, counter?: object }}
 */
export function interceptHit(defender, attacker, move, time) {
  const defense = defender.defenseMove;
  if (defender.state !== 'defending' || !defense) return { result: 'pass' };
  if (move?.isSelf) return { result: 'pass' };

  const types = typesOf(move);
  const vertical = Math.abs((attacker?.y ?? defender.y) - defender.y) > (defender.bodyH ?? 80) * 0.5;
  if ((defense.kind === 'wall' || defense.frontOnly) && vertical && defense.kind !== 'counter') {
    return { result: 'pass' };
  }

  if (!move?.isCounterAttack && defense.kind === 'counter') {
    const on = defense.counterOnTypes;
    if (!on || types.some((t) => on.includes(t))) {
      return {
        result: 'counter',
        counter: {
          name: defense.name,
          damage: defense.counterDamage ?? 8,
          type: defense.counterType ?? 'kinetic',
          baseKnockback: defense.counterKnockback ?? 180,
          knockbackGrowth: defense.counterKnockbackGrowth ?? 4,
          isCounterAttack: true,
          rootMs: rootMs(defense, attacker),
        },
      };
    }
  }

  if (!move?.isCounterAttack && defense.retort) {
    const when = defense.retort.when;
    if (!when || types.includes(when)) {
      return {
        result: 'counter',
        negate: defense.retort.negate !== false,
        counter: {
          name: defense.name,
          damage: defense.retort.damage ?? 7,
          type: defense.retort.type ?? 'kinetic',
          baseKnockback: defense.retort.knockback ?? 210,
          knockbackGrowth: defense.retort.growth ?? 4,
          isCounterAttack: true,
        },
      };
    }
  }

  if (breaksBlock(move, defense) && defense.kind !== 'counter') return { result: 'pass' };

  if (defense.kind === 'shield') return { result: 'pop' };

  if (defense.kind === 'oxide') {
    if (types.length && types.every((t) => t === 'chemical')) return { result: 'negate' };
    return { result: 'pop' };
  }

  if (defense.cycle?.length) {
    const step = defense.cycleMs ?? 380;
    const i = Math.floor(Math.max(0, time - (defender.defenseStart ?? time)) / step) % defense.cycle.length;
    const cur = defense.cycle[i];
    defender.cycleShowing = cur;
    if (types.length && types.every((t) => t === cur)) return { result: 'negate' };
    return { result: 'partial', reduction: 0.4 };
  }

  if (defense.blocks?.length) {
    const blocked = types.filter((t) => defense.blocks.includes(t));
    if (types.length && blocked.length === types.length) return { result: 'negate' };
  }

  if (defense.kind === 'wall' && !defense.blocks) return { result: 'negate' };

  const reduction = defense.damageReduction ?? defense.blockReduction;
  if (defense.kind === 'block' || reduction != null) {
    if (defense.onlyReduce && !types.some((t) => defense.onlyReduce.includes(t))) {
      return { result: 'pass' };
    }
    let used = reduction ?? 0.7;
    if (move?.bonusVsBlock) used *= 0.45;
    return { result: 'partial', reduction: used, noKnockback: !!defense.noKnockback };
  }

  return { result: 'pass' };
}
