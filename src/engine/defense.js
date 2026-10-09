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

function counterHitFx(defense, retort) {
  const on = {};
  if (defense?.counterStun) on.stun = defense.counterStun;
  if (defense?.counterBlind) on.blind = defense.counterBlind;
  if (retort?.stun) on.stun = retort.stun;
  if (retort?.blind) on.blind = retort.blind;
  if (retort?.slow) on.slow = retort.slow;
  return Object.keys(on).length ? on : undefined;
}

function groundSlam(move, attacker) {
  if (move?.ground || move?.slam) return true;
  const b = attacker?.body;
  const grounded = !!(b && (b.blocked?.down || b.touching?.down));
  if (!grounded) return false;
  const k = move?.kind;
  return !k || k === 'dash' || k === 'burst';
}

function rootMs(defense, attacker) {
  let ms = defense.rootMs ?? defense.counterRootMs ?? 0;
  if (!ms) return 0;
  const family = attacker?.charDef?.combat?.family ?? attacker?.combat?.family;
  if (defense.rootBonusVs && family === defense.rootBonusVs) ms *= 2;
  return ms;
}

/** Drop packets a defense is fully immune to. emptied means nothing remains. */
export function applyImmunities(move, defense) {
  const immune = defense?.immune;
  if (!immune?.length || !move) return { move, emptied: false };
  const types = typesOf(move);
  if (types.length && types.every((t) => immune.includes(t))) return { move, emptied: true };
  const next = { ...move };
  if (next.type && immune.includes(canonicalType(next.type))) {
    next.damage = 0;
    next.type = undefined;
  }
  if (next.type2 && immune.includes(canonicalType(next.type2))) {
    next.damage2 = 0;
    next.type2 = undefined;
  }
  const left = typesOf(next);
  return { move: next, emptied: left.length === 0 };
}

/**
 * @returns {{ result: 'pass'|'negate'|'pop'|'partial'|'counter', reduction?: number, noKnockback?: boolean, counter?: object }}
 */
export function interceptHit(defender, attacker, move, time) {
  const defense = defender.defenseMove;
  if (defender.state !== 'defending' || !defense) return { result: 'pass' };
  if (move?.isSelf) return { result: 'pass' };

  const types = typesOf(move);
  if (defense.absorbTypes?.length && !move?.isCounterAttack && types.some((t) => defense.absorbTypes.includes(t))) {
    return { result: 'negate', endDefense: true };
  }
  if (defense.blockGround && !move?.isCounterAttack && groundSlam(move, attacker)) {
    return {
      result: 'counter',
      counter: {
        name: defense.name,
        damage: defense.counterDamage ?? 6,
        type: defense.counterType ?? 'kinetic',
        baseKnockback: defense.counterKnockback ?? 120,
        knockbackGrowth: defense.counterKnockbackGrowth ?? 1.6,
        isCounterAttack: true,
        onHit: counterHitFx(defense),
      },
    };
  }
  if (defense.rewind && !move?.isCounterAttack && !move?.isSelf) {
    return { result: 'negate', rewind: true };
  }

  // phase:true dodges everything. phase:'overhead' still takes ground-tagged hits.
  if (defense.phase && !move?.breakPhase && !(defense.phase === 'overhead' && move?.ground)) {
    const ret = defense.phaseRetort;
    if (ret && !move?.isCounterAttack) {
      return {
        result: 'counter',
        counter: {
          name: defense.name,
          damage: ret.damage ?? 6,
          type: ret.type ?? 'radiation',
          baseKnockback: ret.knockback ?? 70,
          knockbackGrowth: ret.growth ?? 1.2,
          isCounterAttack: true,
          onHit: counterHitFx(defense, ret),
        },
      };
    }
    return { result: 'negate' };
  }
  if (defense.amalgam && attacker?.charDef?.combat?.metal && !move?.isCounterAttack) {
    const id = attacker.charDef?.id;
    attacker.kinDefMult = defense.amalgamVs?.[id] ?? defense.amalgamMult ?? 0.68;
    attacker.kinDefMultUntil = time + (defense.amalgamMs ?? 2400);
    return { result: 'negate' };
  }
  if (defense.backOpen && attacker && attacker !== defender) {
    const facing = defender.facing || 1;
    if ((attacker.x - defender.x) * facing < -10) {
      return { result: 'pass', damageMult: defense.behindMult ?? 1 };
    }
  }
  const vertical = Math.abs((attacker?.y ?? defender.y) - defender.y) > (defender.bodyH ?? 80) * 0.5;
  if ((defense.kind === 'wall' || defense.frontOnly) && vertical && defense.kind !== 'counter') {
    return { result: 'pass' };
  }

  if (!move?.isCounterAttack && defense.replay) {
    return {
      result: 'counter',
      counter: {
        name: defense.name,
        damage: move?.damage ?? 6,
        type: move?.type ?? 'radiation',
        type2: move?.type2,
        damage2: move?.damage2,
        baseKnockback: defense.counterKnockback ?? 140,
        knockbackGrowth: defense.counterKnockbackGrowth ?? 2,
        isCounterAttack: true,
      },
    };
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
          onHit: counterHitFx(defense),
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
          onHit: counterHitFx(defense, defense.retort),
        },
      };
    }
  }

  if (breaksBlock(move, defense) && defense.kind !== 'counter') {
    return { result: 'pass', damageMult: defense.pierceMult ?? 1 };
  }

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
    if (types.length && types.every((t) => t === cur)) {
      if (defense.cycleReflect) {
        return {
          result: 'counter',
          counter: {
            name: defense.name,
            damage: move.damage ?? defense.counterDamage ?? 6,
            type: cur,
            baseKnockback: defense.counterKnockback ?? 140,
            knockbackGrowth: defense.counterKnockbackGrowth ?? 2,
            isCounterAttack: true,
          },
        };
      }
      return { result: 'negate' };
    }
    return { result: 'partial', reduction: 0.4 };
  }

  if (defense.reflectTypes?.length && !move?.isCounterAttack) {
    const hit = types.find((t) => defense.reflectTypes.includes(t));
    if (hit) {
      return {
        result: 'counter',
        counter: {
          name: defense.name,
          damage: move.damage ?? 6,
          type: hit,
          baseKnockback: defense.counterKnockback ?? 120,
          knockbackGrowth: defense.counterKnockbackGrowth ?? 2,
          isCounterAttack: true,
        },
      };
    }
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
    if (defense.harden) {
      defender.hardenStacks = (defender.hardenStacks ?? 0) + 1;
      used = Math.min(defense.hardenCap ?? 0.8, used + defender.hardenStacks * (defense.hardenStep ?? 0.1));
    }
    if (move?.bonusVsBlock) used *= 0.45;
    return { result: 'partial', reduction: used, noKnockback: !!defense.noKnockback };
  }

  return { result: 'pass' };
}
