// On-hit and on-cast consequences that any move can opt into.
// Fighter and BattleScene stay character-agnostic; they read these flags.

export function applyOnHit(attacker, victim, move, time) {
  if (!move || victim === attacker) return;
  const immune = victim.debuffImmuneUntil && time < victim.debuffImmuneUntil;
  if (!immune && move.rustMetals && victim.charDef?.combat?.metal) {
    victim.kinDefMult = 0.7;
    victim.kinDefMultUntil = time + 2500;
  }
  if (!immune && move.stripBuffs) stripBuffs(victim);

  const fx = move.onHit;
  if (!fx || immune) return;

  if (fx.slow) victim.slowUntil = time + fx.slow;
  if (fx.stun) lock(victim, time, fx.stun, true);
  if (fx.freeze) lock(victim, time, fx.freeze, true);
  if (fx.root) victim.rootedUntil = Math.max(victim.rootedUntil ?? 0, time + fx.root);
  if (fx.blind) victim.blindUntil = time + fx.blind;
  if (fx.interrupt) lock(victim, time, fx.interrupt, true);
  if (fx.burn) {
    victim.burnUntil = time + (fx.burn.ms ?? 1200);
    victim.burnDps = fx.burn.dps ?? 2;
    victim.burnTick = time + 280;
  }
  if (fx.corrode) {
    victim.kinDefMult = fx.corrode.mult ?? 0.72;
    victim.kinDefMultUntil = time + (fx.corrode.ms ?? 2200);
  }
  if (fx.strip) stripBuffs(victim);
}

function lock(victim, time, ms, cancelAttack) {
  victim.lockedUntil = Math.max(victim.lockedUntil ?? 0, time + ms);
  if (!cancelAttack) return;
  if (victim.state === 'attack' || victim.state === 'charging') {
    victim.state = 'idle';
    victim.activeHit = null;
    victim.chargeStart = null;
  }
}

export function stripBuffs(fighter) {
  fighter.bonusHits = 0;
  fighter.bonusPacket = null;
  fighter.speedBuffUntil = 0;
  fighter.heatResistUntil = 0;
  fighter.burnUntil = 0;
  fighter.kinDefMultUntil = 0;
}

export function tickKit(fighter, time) {
  if (fighter.burnUntil && time < fighter.burnUntil && time >= (fighter.burnTick ?? 0)) {
    fighter.burnTick = time + 280;
    const dmg = fighter.burnDps ?? 2;
    fighter.percent = Math.min(999, fighter.percent + dmg);
    fighter.scene?.noteDot?.(fighter, 'heat', dmg);
  }
}

/** Flags a just-fired move asked to leave on its owner. */
export function applyOnCast(fighter, move, time, frac = 1) {
  if (move.selfDamage) {
    const selfMove = {
      name: move.name,
      type: move.selfDamage.type ?? 'heat',
      damage: move.selfDamage.damage ?? 4,
      baseKnockback: 30,
      knockbackGrowth: 0,
      isSelf: true,
      launch: 'radial',
    };
    fighter.takeHit(fighter, selfMove, time);
    fighter.scene?.noteHit?.(fighter, fighter, selfMove);
  }
  if (move.buff) grantBuff(fighter, move.buff, time);
  if (move.redox) {
    fighter.redox = Math.max(fighter.redox ?? 0, frac);
    fighter.bonusHits = 3;
    fighter.bonusPacket = { type: 'electrical', damage: 3 + 5 * fighter.redox, hitsName: move.name };
  }
  if (move.overclock) {
    fighter.speedBuff = move.overclock.speed ?? 1.35;
    fighter.speedBuffUntil = time + (move.overclock.ms ?? 2800);
    if (frac >= 0.98 && move.overclock.selfHeat) {
      fighter.takeHit(fighter, {
        type: 'heat', damage: move.overclock.selfHeat,
        baseKnockback: 20, knockbackGrowth: 0, isSelf: true, launch: 'radial',
      }, time);
    }
  }
  if (move.debuffImmune) fighter.debuffImmuneUntil = time + move.duration;
}

function grantBuff(fighter, buff, time) {
  const ms = buff.ms ?? 3500;
  if (buff.speed) {
    fighter.speedBuff = buff.speed;
    fighter.speedBuffUntil = time + ms;
  }
  if (buff.heatTaken != null) {
    fighter.heatResistMult = buff.heatTaken;
    fighter.heatResistUntil = time + ms;
  }
  if (buff.kineticTaken != null) {
    fighter.kineticResistMult = buff.kineticTaken;
    fighter.kineticResistUntil = time + ms;
  }
  if (buff.bonus) {
    fighter.bonusHits = buff.bonus.hits ?? 1;
    fighter.bonusPacket = { type: buff.bonus.type, damage: buff.bonus.damage, hitsName: buff.bonus.name };
  }
  if (buff.heatOnHit) {
    fighter.heatOnHit = buff.heatOnHit;
    fighter.heatOnHitUntil = time + ms;
    fighter.heatOnHitLeft = buff.hits ?? 8;
  }
  if (buff.slippery) {
    fighter.slipperyUntil = time + ms;
    fighter.slipperyMult = buff.slippery;
  }
}

export function combatOpts(defender) {
  const now = defender.scene?.time?.now ?? 0;
  const opts = {};
  if (defender.kinDefMultUntil > now) opts.kinDefMult = defender.kinDefMult ?? 0.75;
  if (defender.heatResistUntil > now) opts.heatTakenMult = defender.heatResistMult ?? 0.4;
  if (defender.kineticResistUntil > now && defender.kineticResistMult != null) {
    opts.kineticTakenMult = defender.kineticResistMult;
  }
  return opts;
}

/** Extra packets the attacker is carrying (redox, calcify, unquenchable). */
export function bonusPackets(attacker, time) {
  const out = [];
  if (!attacker) return out;
  if (attacker.bonusHits > 0 && attacker.bonusPacket) {
    out.push(attacker.bonusPacket);
    attacker.bonusHits -= 1;
  }
  if (attacker.heatOnHit && attacker.heatOnHitUntil > time && attacker.heatOnHitLeft > 0) {
    out.push({ type: 'heat', damage: attacker.heatOnHit });
    attacker.heatOnHitLeft -= 1;
  }
  return out;
}
