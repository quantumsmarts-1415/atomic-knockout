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
  if (fx.freeze) {
    lock(victim, time, fx.freeze, true);
    victim.frozenUntil = Math.max(victim.frozenUntil ?? 0, time + fx.freeze);
  }
  if (fx.root) victim.rootedUntil = Math.max(victim.rootedUntil ?? 0, time + fx.root);
  if (fx.blind) victim.blindUntil = time + fx.blind;
  if (fx.dazzle) {
    const ms = typeof fx.dazzle === 'number' ? fx.dazzle : (fx.blind ?? 800);
    victim.dazzleUntil = time + ms;
    victim.blindUntil = Math.max(victim.blindUntil ?? 0, victim.dazzleUntil);
  }
  if (fx.miss) victim.missNext = (victim.missNext ?? 0) + (fx.miss === true ? 1 : fx.miss);
  if (fx.reveal) victim.phasingUntil = 0;
  if (fx.chemVulnerable) {
    victim.chemVulnerableMult = fx.chemVulnerable;
    victim.chemVulnerableUntil = time + (fx.chemVulnerableMs ?? 2400);
  }
  if (fx.drift) victim.driftUntil = time + fx.drift;
  if (fx.interrupt) lock(victim, time, fx.interrupt, true);
  if (fx.poison) {
    const p = fx.poison;
    victim.poisonUntil = time + (p.ms ?? 1600);
    victim.poisonDps = p.dps ?? 1.4;
    victim.poisonRamp = p.ramp ?? 0;
    victim.poisonTick = time + (p.delay ?? 280);
    if (p.inherit) victim.poisonInherit = true;
  }
  if (fx.heal && attacker) attacker.percent = Math.max(0, (attacker.percent ?? 0) - fx.heal);
  if (fx.mute) {
    victim.muteType = fx.mute;
    victim.muteUntil = time + (fx.muteMs ?? 2600);
  }
  if (fx.vulnerable) {
    victim.vulnerableMult = fx.vulnerable;
    victim.vulnerableUntil = time + (fx.vulnerableMs ?? 2600);
  }
  if (fx.mark) {
    victim.mark = fx.mark;
    victim.markUntil = time + (fx.markMs ?? 3600);
    victim.markedBy = attacker?.charDef?.id ?? null;
  }
  if (fx.scramble) victim.scrambleUntil = time + (typeof fx.scramble === 'number' ? fx.scramble : 2400);
  if (fx.weaken) {
    victim.weakenUntil = time + (fx.weaken.ms ?? 1600);
    victim.weakenMult = fx.weaken.mult ?? 0.75;
  }
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

export function cleanse(fighter, kinds) {
  const list = kinds ?? [];
  if (list.includes('poison')) fighter.poisonUntil = 0;
  if (list.includes('burn')) fighter.burnUntil = 0;
  if (list.includes('blind')) {
    fighter.blindUntil = 0;
    fighter.dazzleUntil = 0;
  }
  if (list.includes('slow')) fighter.slowUntil = 0;
  if (list.includes('mark')) fighter.markUntil = 0;
  if (list.includes('debuff')) stripBuffs(fighter);
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
  if (fighter.poisonUntil && time < fighter.poisonUntil && time >= (fighter.poisonTick ?? 0)) {
    fighter.poisonTick = time + 280;
    const dmg = fighter.poisonDps ?? 1.4;
    fighter.percent = Math.min(999, fighter.percent + dmg);
    fighter.poisonDps = dmg + (fighter.poisonRamp ?? 0);
    fighter.scene?.noteDot?.(fighter, 'chemical', dmg);
  }
  tickGhostDrain(fighter, time);
}

/** Superheavy ghosts lose percent the whole time they are on screen. */
export function tickGhostDrain(fighter, time) {
  if (!fighter?.charDef?.ghost) return;
  if (!fighter.alive || fighter.state === 'ko' || fighter.state === 'dead') return;
  if (time < (fighter.drainPauseUntil ?? 0)) return;
  if (time < (fighter._ghostDrainAt ?? 0)) return;
  fighter._ghostDrainAt = time + 500;
  const cost = 1;
  fighter.percent = Math.min(999, (fighter.percent ?? 0) + cost);
  fighter.damageTaken = (fighter.damageTaken ?? 0) + cost;
  if (fighter.takenByType) {
    fighter.takenByType.radiation = (fighter.takenByType.radiation ?? 0) + cost;
  }
  fighter.scene?.noteDot?.(fighter, 'radiation', cost);
}

/** Highest incoming multiplier. That is the type a scan should punish. */
export function weakestType(combat) {
  if (!combat) return 'kinetic';
  const scores = [
    ['kinetic', 1 - (combat.kineticDef || 0)],
    ['heat', 1 - (combat.heatDef || 0)],
    ['electrical', combat.elecTaken ?? 1],
    ['radiation', 1 - (combat.radDef || 0)],
    ['chemical', combat.noble ? 0 : 1.15],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][0];
}

/** Flags a just-fired move asked to leave on its owner. */
export function applyOnCast(fighter, move, time, frac = 1) {
  if (move.selfDamage) {
    const selfMove = {
      name: move.name,
      type: move.selfDamage.type ?? 'heat',
      damage: (move.selfDamage.damage ?? 4) * (move.selfDamage.withCharge ? frac : 1),
      baseKnockback: 30,
      knockbackGrowth: 0,
      isSelf: true,
      noFlinch: !!move.selfDamage.noFlinch,
      launch: 'radial',
    };
    fighter.takeHit(fighter, selfMove, time);
    fighter.scene?.noteHit?.(fighter, fighter, selfMove);
  }
  if (move.buff) {
    const buff = move.buff.scaleWithCharge && move.buff.bonus
      ? { ...move.buff, bonus: { ...move.buff.bonus, damage: (move.buff.bonus.damage ?? 0) * frac } }
      : move.buff;
    grantBuff(fighter, buff, time);
  }
  if (move.cleanse) cleanse(fighter, move.cleanse);
  if (move.blinkMs) fighter.phasingUntil = time + move.blinkMs;
  if (move.revealAll && fighter.scene?.fighters) {
    for (const other of fighter.scene.fighters) other.phasingUntil = 0;
  }
  if (move.doubleNext) fighter.doubleNext = 1;
  if (move.lingerImmune) {
    fighter.lingerImmune = move.lingerImmune.types;
    fighter.lingerImmuneUntil = time + (move.lingerImmune.ms ?? 15000);
  }
  if (move.leap && fighter.body) {
    const dist = move.leap.dist ?? 170;
    const up = fighter.input?.jump ? -0.85 : fighter.input?.down ? 0.25 : -0.2;
    const nx = fighter.x + (fighter.facing || 1) * dist;
    const ny = fighter.y + up * dist;
    fighter.body.reset(nx, ny);
  }
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
  if (move.pauseDrain) fighter.drainPauseUntil = time + move.pauseDrain;
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
  if (buff.chemTaken != null) {
    fighter.chemResistMult = buff.chemTaken;
    fighter.chemResistUntil = time + ms;
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
  if (buff.heated) fighter.heatedUntil = Math.max(fighter.heatedUntil ?? 0, time + ms);
  if (buff.weight) {
    fighter.weightBuff = buff.weight;
    fighter.weightBuffUntil = time + ms;
  }
  if (buff.armDash) {
    fighter.armedDash = {
      until: time + ms,
      heat: buff.armDash.heat ?? 7,
      dashSpeed: buff.armDash.dashSpeed ?? 560,
    };
  }
}

/** Per-target damage tweaks that stay on the move instead of a character branch. */
export function prepareMove(move, attacker, defender, now = 0) {
  if (!move) return move;
  let next = move;
  const id = defender?.charDef?.id;
  if (attacker?.muteUntil > now && attacker.muteType) {
    const mute = attacker.muteType;
    if (next.type === mute) next = { ...next, damage: 0 };
    if (next.type2 === mute) next = { ...next, damage2: 0 };
  }
  if (move.bonusVsStun && defender && (defender.state === 'hurt' || (defender.lockedUntil ?? 0) > now)) {
    const mult = move.bonusVsStun;
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  if (move.stillBonus && attacker?.openedStill) {
    const mult = move.stillBonus;
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  if (move.bonusVsId && id && move.bonusVsId[id]) {
    const mult = move.bonusVsId[id];
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  const state = defender?.charDef?.combat?.state;
  if (move.bonusVsState && state && move.bonusVsState[state]) {
    const mult = move.bonusVsState[state];
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  const hot = defender && (defender.burnUntil > now || defender.heatedUntil > now || defender.heatOnHitUntil > now);
  if (move.vsHot && hot) {
    next = { ...next, type2: undefined, damage2: undefined, ...move.vsHot };
  }
  const selfHot = attacker && (attacker.burnUntil > now || attacker.heatedUntil > now);
  if (move.heatEmpower && selfHot) {
    next = { ...next, damage: (next.damage ?? 0) + move.heatEmpower };
  }
  const buffed = defender && (
    defender.bonusHits > 0
    || defender.speedBuffUntil > now
    || defender.heatResistUntil > now
    || defender.heatOnHitUntil > now
    || defender.armedDash?.until > now
  );
  if (move.bonusVsBuff && buffed) {
    next = { ...next, damage: (next.damage ?? 0) * move.bonusVsBuff, damage2: next.damage2 != null ? next.damage2 * move.bonusVsBuff : next.damage2 };
  }
  if (move.bonusVsMetal && defender?.charDef?.combat?.metal) {
    const mult = move.bonusVsMetal;
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  if (move.bonusVsPercent && defender) {
    const mult = 1 + Math.min(1.1, ((defender.percent ?? 0) / 100) * move.bonusVsPercent);
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  if (move.bonusVsMark && defender?.mark === move.bonusVsMark && defender.markUntil > now && defender.markedBy === attacker?.charDef?.id) {
    const mult = move.markMult ?? 1.35;
    next = { ...next, damage: (next.damage ?? 0) * mult, damage2: next.damage2 != null ? next.damage2 * mult : next.damage2 };
  }
  if (attacker?.weakenUntil > now) {
    const mult = attacker.weakenMult ?? 0.75;
    next = { ...next, damage: (next.damage ?? 0) * mult, damage2: next.damage2 != null ? next.damage2 * mult : next.damage2 };
  }
  if (attacker?.muteAllUntil > now) {
    next = { ...next, damage: 0, damage2: next.damage2 != null ? 0 : next.damage2 };
  }
  if (attacker?.scrambleUntil > now) {
    const types = ['kinetic', 'heat', 'electrical', 'chemical', 'radiation'];
    const type = types[Math.floor(now / 240) % types.length];
    next = { ...next, type, type2: undefined, damage2: undefined };
  }
  if (attacker?.doubleNext && ((next.damage ?? 0) > 0 || (next.damage2 ?? 0) > 0)) {
    attacker.doubleNext = 0;
    next = {
      ...next,
      damage: (next.damage ?? 0) * 2,
      damage2: next.damage2 != null ? next.damage2 * 2 : next.damage2,
    };
  }
  if (move.sharpen && attacker?._sharpenName === move.name) {
    const bonus = Math.max(0, (attacker._sharpen ?? 1) - 1) * (move.sharpen.step ?? 2);
    const capped = Math.min(move.sharpen.cap ?? 12, bonus);
    if (capped) next = { ...next, damage: (next.damage ?? 0) + capped };
  }
  if (move.perSecond && attacker) {
    const sec = Math.max(0, (now - (attacker.bornAt ?? now)) / 1000);
    const extra = Math.min(move.perSecondCap ?? 16, sec * move.perSecond);
    if (extra) next = { ...next, damage: (next.damage ?? 0) + extra };
  }
  return next;
}

export function combatOpts(defender) {
  const now = defender.scene?.time?.now ?? 0;
  const opts = {};
  if (defender.kinDefMultUntil > now) opts.kinDefMult = defender.kinDefMult ?? 0.75;
  if (defender.heatResistUntil > now) opts.heatTakenMult = defender.heatResistMult ?? 0.4;
  let chem = null;
  if (defender.chemResistUntil > now && defender.chemResistMult != null) chem = defender.chemResistMult;
  if (defender.chemVulnerableUntil > now && defender.chemVulnerableMult != null) {
    chem = (chem ?? 1) * defender.chemVulnerableMult;
  }
  if (chem != null) opts.chemTakenMult = chem;
  if (defender.kineticResistUntil > now && defender.kineticResistMult != null) {
    opts.kineticTakenMult = defender.kineticResistMult;
  }
  if (defender.vulnerableUntil > now) opts.takenMult = defender.vulnerableMult ?? 1.2;
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
