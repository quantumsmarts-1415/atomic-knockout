// How a defending fighter answers one incoming hit. Data on the move, not
// per-character branches, so later elements can reuse the same words.
import { canonicalType } from '../data/balance.js';

function typesOf(move) {
  const out = [];
  if (move?.type) out.push(canonicalType(move.type));
  if (move?.type2) out.push(canonicalType(move.type2));
  if (move?.type3) out.push(canonicalType(move.type3));
  return out;
}

function typedDamage(move, type) {
  let n = 0;
  if (!type) return (move?.damage ?? 0) + (move?.damage2 ?? 0);
  if (move?.type && canonicalType(move.type) === type) n += move.damage ?? 0;
  if (move?.type2 && canonicalType(move.type2) === type) n += move.damage2 ?? 0;
  return n;
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

function counterHitFx(defense, retort, extra) {
  const on = {};
  if (defense?.counterStun) on.stun = defense.counterStun;
  if (defense?.counterBlind) on.blind = defense.counterBlind;
  if (retort?.stun) on.stun = retort.stun;
  if (retort?.blind) on.blind = retort.blind;
  if (retort?.slow) on.slow = retort.slow;
  if (extra?.root) on.root = extra.root;
  if (extra?.coat) {
    on.coat = extra.coat;
    on.coatMs = extra.coatMs ?? extra.root ?? 800;
  }
  return Object.keys(on).length ? on : undefined;
}

function groundSlam(move, attacker, defense) {
  if (defense?.seismicOnly) return !!(move?.ground || move?.slam);
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
  if (next.type3 && immune.includes(canonicalType(next.type3))) {
    next.damage3 = 0;
    next.type3 = undefined;
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
  if (defense.detonateOn?.length && !move?.isCounterAttack && types.some((t) => defense.detonateOn.includes(t))) {
    return { result: 'negate', endDefense: true, detonate: defense.detonate };
  }
  if (defense.blockGround && !move?.isCounterAttack && groundSlam(move, attacker, defense)) {
    const range = defense.counterRange ?? 0;
    const dist = attacker
      ? Math.hypot((attacker.x ?? defender.x) - defender.x, (attacker.y ?? defender.y) - defender.y)
      : 0;
    if (range > 0 && dist > range) return { result: 'negate' };
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

  // Gold foil: most hits pass (phase, below). Every Nth one scatters back at full power.
  if (defense.foilEvery && !move?.isCounterAttack) {
    defender._foil = (defender._foil ?? 0) + 1;
    if (defender._foil % defense.foilEvery === 0) {
      return {
        result: 'counter',
        counter: {
          name: defense.name,
          damage: move?.damage ?? 8,
          type: move?.type ?? 'kinetic',
          type2: move?.type2,
          damage2: move?.damage2,
          baseKnockback: move?.baseKnockback ?? 180,
          knockbackGrowth: move?.knockbackGrowth ?? 4,
          isCounterAttack: true,
        },
      };
    }
  }

  // Polarity flip: metal fighters bounce off. Everyone else is untouched.
  if (defense.repelMetals && !move?.isCounterAttack) {
    if (attacker?.charDef?.combat?.metal) {
      const pow = defense.repelPower ?? 1;
      return {
        result: 'counter',
        counter: {
          name: defense.name,
          damage: (move?.damage ?? 6) * pow,
          type: move?.type ?? 'kinetic',
          type2: move?.type2,
          damage2: move?.damage2 != null ? move.damage2 * pow : undefined,
          baseKnockback: defense.counterKnockback ?? 160,
          knockbackGrowth: defense.counterKnockbackGrowth ?? 3,
          isCounterAttack: true,
        },
      };
    }
    return { result: 'pass' };
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
      const rooted = rootMs(defense, attacker);
      return {
        result: 'counter',
        counter: {
          name: defense.name,
          damage: defense.counterDamage ?? 8,
          type: defense.counterType ?? 'kinetic',
          baseKnockback: defense.counterKnockback ?? 180,
          knockbackGrowth: defense.counterKnockbackGrowth ?? 4,
          isCounterAttack: true,
          rootMs: rooted,
          onHit: counterHitFx(defense, null, {
            root: rooted || undefined,
            coat: defense.counterCoat,
            coatMs: rooted || defense.counterCoatMs,
          }),
        },
      };
    }
  }

  if (!move?.isCounterAttack && defense.retort) {
    const when = defense.retort.when;
    const min = defense.retort.minDamage ?? 0;
    if ((!when || types.includes(when)) && typedDamage(move, when) >= min) {
      const ret = defense.retort;
      return {
        result: 'counter',
        negate: ret.negate !== false,
        endDefense: !!ret.shatter,
        selfHit: ret.selfDamage ? {
          name: defense.name,
          damage: ret.selfDamage,
          type: ret.type ?? 'kinetic',
          baseKnockback: ret.selfKnockback ?? 110,
          knockbackGrowth: ret.selfGrowth ?? 2,
          isCounterAttack: true,
        } : undefined,
        counter: {
          name: defense.name,
          damage: ret.damage ?? 7,
          type: ret.type ?? 'kinetic',
          baseKnockback: ret.knockback ?? 210,
          knockbackGrowth: ret.growth ?? 4,
          isCounterAttack: true,
          onHit: counterHitFx(defense, ret),
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
    if (types.includes(cur)) {
      if (types.every((t) => t === cur)) {
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
      return { result: 'pass', stripTypes: [cur] };
    }
    return { result: 'pass' };
  }

  if (defense.blockCharges && defender._blockCharges) {
    const charges = defender._blockCharges;
    const blocked = types.filter((t) => (charges[t] ?? 0) > 0);
    if (blocked.length) {
      for (const t of blocked) charges[t] -= 1;
      if (blocked.length === types.length) return { result: 'negate' };
      return { result: 'pass', stripTypes: blocked };
    }
  }

  if (defense.reduceTypes) {
    return { result: 'pass', typeScale: defense.reduceTypes };
  }

  if (defense.reflectTypes?.length && !move?.isCounterAttack) {
    const reflected = types.filter((t) => defense.reflectTypes.includes(t));
    if (reflected.length) {
      const keep = types.filter((t) => !defense.reflectTypes.includes(t));
      const pow = defense.reflectPower ?? 1;
      const packet = (t) => {
        if (move?.type && canonicalType(move.type) === t) return (move.damage ?? 0) * pow;
        if (move?.type2 && canonicalType(move.type2) === t) return (move.damage2 ?? 0) * pow;
        return 0;
      };
      return {
        result: 'counter',
        negate: keep.length === 0,
        keepTypes: keep,
        counter: {
          name: defense.name,
          damage: packet(reflected[0]) || (move.damage ?? 6) * pow,
          type: defense.reflectAs ?? reflected[0],
          type2: reflected[1],
          damage2: reflected[1] ? packet(reflected[1]) : undefined,
          baseKnockback: defense.counterKnockback ?? move.baseKnockback ?? 160,
          knockbackGrowth: defense.counterKnockbackGrowth ?? move.knockbackGrowth ?? 3,
          isCounterAttack: true,
        },
      };
    }
  }

  if (defense.blocks?.length) {
    const blocked = types.filter((t) => defense.blocks.includes(t));
    if (types.length && blocked.length === types.length) return { result: 'negate' };
    // A mixed hit keeps the types this guard does not list.
    if (defense.stripBlocked && blocked.length) return { result: 'pass', stripTypes: blocked };
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

/**
 * Pull one damage type off a hit and remember how much was switched off.
 * A hit that was only that type comes back emptied.
 */
export function gateStored(move, type) {
  const want = canonicalType(type);
  const next = { ...(move ?? {}) };
  let stored = 0;
  const take = (typeKey, damageKey) => {
    if (!next[typeKey] || canonicalType(next[typeKey]) !== want) return;
    stored += next[damageKey] ?? 0;
    next[damageKey] = 0;
    next[typeKey] = undefined;
  };
  take('type', 'damage');
  take('type2', 'damage2');
  take('type3', 'damage3');
  const left = [next.type, next.type2, next.type3].filter(Boolean);
  return { move: next, stored, emptied: left.length === 0 };
}

/** When a skin that only regrows on the next press may be started again. */
export function rearmDefense(move, time) {
  if (move?.regrow !== 'press') return null;
  return time + Math.max(0, move.cooldown ?? 0);
}
