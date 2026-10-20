// On-hit and on-cast consequences that any move can opt into.
// Fighter and BattleScene stay character-agnostic; they read these flags.
import { chemicalMult } from '../data/balance.js';

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
    const spec = typeof fx.dazzle === 'object' ? fx.dazzle : null;
    const ms = spec ? (spec.ms ?? 800) : (typeof fx.dazzle === 'number' ? fx.dazzle : (fx.blind ?? 800));
    victim.dazzleUntil = time + ms;
    victim.dazzleColor = spec?.color ?? 0xfff6e8;
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
    const chem = chemicalMult(attacker?.charDef?.combat, victim.charDef?.combat);
    victim.poisonUntil = time + (p.ms ?? 1600);
    victim.poisonDps = (p.dps ?? 1.4) * chem;
    victim.poisonRamp = (p.ramp ?? 0) * chem;
    victim.poisonTick = time + (p.delay ?? p.every ?? 280);
    victim.poisonEvery = p.every ?? 280;
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
    if (fx.reveal) victim.revealedUntil = victim.markUntil;
  }
  if (fx.glow) {
    const g = typeof fx.glow === 'object' ? fx.glow : {};
    victim.glowUntil = time + (g.ms ?? 4000);
    victim.glowDps = g.dps ?? 1;
    victim.glowEvery = g.every ?? 1000;
    victim.glowTick = time + victim.glowEvery;
    victim.glowTint = g.tint ?? 0x7dffe8;
  }
  if (fx.coat) {
    victim.debuffCoat = fx.coat;
    victim.debuffCoatUntil = time + (fx.coatMs ?? fx.markMs ?? 2000);
  }
  if (fx.scramble) victim.scrambleUntil = time + (typeof fx.scramble === 'number' ? fx.scramble : 2400);
  if (fx.weaken) {
    victim.weakenUntil = time + (fx.weaken.ms ?? 1600);
    victim.weakenMult = fx.weaken.mult ?? 0.75;
  }
  if (fx.burn) {
    const sticky = !!fx.burn.untilKo;
    // A washable burn does not put out white phosphorus.
    if (!(victim.burnSticky && !sticky)) {
      victim.burnUntil = sticky ? Number.POSITIVE_INFINITY : time + (fx.burn.ms ?? 1200);
      victim.burnDps = fx.burn.dps ?? 2;
      victim.burnEvery = fx.burn.every ?? 280;
      victim.burnTick = time + victim.burnEvery;
      victim.burnSticky = sticky;
      victim.burnOwnerId = attacker?.charDef?.id ?? null;
      victim.burnMove = move.name;
    }
  }
  if (fx.corrode) {
    victim.kinDefMult = fx.corrode.mult ?? 0.72;
    victim.kinDefMultUntil = time + (fx.corrode.ms ?? 2200);
  }
  if (fx.kineticTaken) {
    const spec = fx.kineticTaken;
    victim.kineticResistMult = spec.mult ?? 1.25;
    victim.kineticResistUntil = time + (spec.ms ?? 5000);
    if (spec.coat) {
      victim.debuffCoat = spec.coat;
      victim.debuffCoatUntil = victim.kineticResistUntil;
    }
  }
  if (fx.strip) stripBuffs(victim);
}

/** Fighters a marked-target move hits even when they are off the shot. */
export function markedStrikeTargets(owner, move, fighters, now, already) {
  if (!move?.hitMarked || !owner || !fighters) return [];
  const out = [];
  for (const target of fighters) {
    if (already?.has?.(target) || target === owner || !target.alive || target.state === 'ko') continue;
    if (target.mark !== move.hitMarked || !(target.markUntil > now)) continue;
    if (target.markedBy !== owner.charDef?.id) continue;
    out.push(target);
  }
  return out;
}

/** A tracer tag keeps its target drawn at full strength through a fade. */
export function visibleAlpha(fighter, time, faded) {
  if ((fighter?.revealedUntil ?? 0) > time) return 1;
  return faded;
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
  if (list.includes('burn') && !fighter.burnSticky) fighter.burnUntil = 0;
  if (list.includes('blind')) {
    fighter.blindUntil = 0;
    fighter.dazzleUntil = 0;
  }
  if (list.includes('slow')) fighter.slowUntil = 0;
  if (list.includes('mark')) {
    fighter.markUntil = 0;
    fighter.revealedUntil = 0;
    fighter.glowUntil = 0;
  }
  if (list.includes('debuff')) {
    stripBuffs(fighter);
    fighter.debuffCoatUntil = 0;
    fighter.glowUntil = 0;
    fighter.slowUntil = 0;
    fighter.weakenUntil = 0;
    fighter.rootedUntil = 0;
    fighter.vulnerableUntil = 0;
  }
}

/** End a hold and drop armor buffs. Debuffs (burns, poison, slows, corrosion) stay. */
export function stripProtection(fighter) {
  if (!fighter) return false;
  let removed = false;
  if (fighter.state === 'defending' && fighter.defenseMove) {
    const zoneName = fighter.defenseMove.zone?.name;
    fighter.scene?.dropPins?.(fighter);
    if (zoneName) fighter.scene?.clearOwnedZones?.(fighter, zoneName);
    fighter.state = 'idle';
    fighter.defenseMove = null;
    fighter.alpha = 1;
    removed = true;
  }
  const now = fighter.scene?.time?.now ?? 0;
  if (fighter.heatResistUntil > now && (fighter.heatResistMult ?? 1) < 1) {
    fighter.heatResistUntil = 0;
    removed = true;
  }
  if (fighter.kineticResistUntil > now && (fighter.kineticResistMult ?? 1) < 1) {
    fighter.kineticResistUntil = 0;
    removed = true;
  }
  if (fighter.chemResistUntil > now && (fighter.chemResistMult ?? 1) < 1) {
    fighter.chemResistUntil = 0;
    removed = true;
  }
  if (fighter.buffCoatUntil > now) {
    fighter.buffCoatUntil = 0;
    removed = true;
  }
  if (fighter.attackPowerUntil > now) {
    fighter.attackPowerUntil = 0;
    removed = true;
  }
  if (fighter.bonusHits > 0) {
    fighter.bonusHits = 0;
    fighter.bonusPacket = null;
    removed = true;
  }
  if (fighter.unquenchableUntil > now) {
    fighter.unquenchableUntil = 0;
    removed = true;
  }
  if (fighter.heatOnHitUntil > now) {
    fighter.heatOnHitUntil = 0;
    fighter.heatOnHitLeft = 0;
    removed = true;
  }
  if (fighter.hardenStacks) {
    fighter.hardenStacks = 0;
    removed = true;
  }
  if (fighter.lingerImmuneUntil > now) {
    fighter.lingerImmuneUntil = 0;
    removed = true;
  }
  if (fighter.mitigateUntil > now) {
    fighter.mitigateUntil = 0;
    removed = true;
  }
  return removed;
}

export function stripBuffs(fighter) {
  fighter.bonusHits = 0;
  fighter.bonusPacket = null;
  fighter.speedBuffUntil = 0;
  fighter.attackHasteUntil = 0;
  fighter.heatResistUntil = 0;
  if (!fighter.burnSticky) fighter.burnUntil = 0;
  fighter.kinDefMultUntil = 0;
  fighter.attackPowerUntil = 0;
  fighter.buffCoatUntil = 0;
  // Unquenchable stays lit. White phosphorus (burnSticky) stays lit.
  // Water, cold, and heat do not clear either one.
}

/** Damage over time only raises percent. No hitstun, flinch, knockback, flash, or hitstop. */
export function applyDot(fighter, amount, type = 'heat') {
  if (!(amount > 0) || fighter?.percent == null) return 0;
  fighter.percent = Math.min(999, fighter.percent + amount);
  fighter.scene?.noteDot?.(fighter, type, amount);
  return amount;
}

export function tickKit(fighter, time) {
  if (fighter.burnUntil && time < fighter.burnUntil && time >= (fighter.burnTick ?? 0)) {
    fighter.burnTick = time + (fighter.burnEvery ?? 280);
    applyDot(fighter, fighter.burnDps ?? 2, 'heat');
  }
  if (fighter.poisonUntil && time < fighter.poisonUntil && time >= (fighter.poisonTick ?? 0)) {
    fighter.poisonTick = time + (fighter.poisonEvery ?? 280);
    const dmg = fighter.poisonDps ?? 1.4;
    applyDot(fighter, dmg, 'chemical');
    fighter.poisonDps = dmg + (fighter.poisonRamp ?? 0);
  }
  if (fighter.glowUntil && time < fighter.glowUntil && time >= (fighter.glowTick ?? 0)) {
    fighter.glowTick = time + (fighter.glowEvery ?? 1000);
    applyDot(fighter, fighter.glowDps ?? 1, 'radiation');
  }
  if (fighter.unquenchableUntil > time && time >= (fighter._unquenchTick ?? 0)) {
    fighter._unquenchTick = time + (fighter.selfDotEvery ?? 1000);
    applyDot(fighter, fighter.selfDotDps ?? 1, fighter.selfDotType ?? 'heat');
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
  const cost = applyDot(fighter, 1, 'radiation');
  fighter.damageTaken = (fighter.damageTaken ?? 0) + cost;
  if (fighter.takenByType) {
    fighter.takenByType.radiation = (fighter.takenByType.radiation ?? 0) + cost;
  }
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

/** Ribbon Guard's heat hit, or casting Unquenchable, lights the same flame. */
export function lightUnquenchable(fighter, time) {
  const buff = fighter?.charDef?.moves?.basicCharge?.buff;
  if (!buff?.unquenchable) return;
  grantBuff(fighter, buff, time);
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
  if (move.chargeHeal) {
    fighter.percent = Math.max(0, (fighter.percent ?? 0) - move.chargeHeal * frac);
  }
  if (move.buff) {
    let buff = move.buff;
    if (move.buff.scaleWithCharge) {
      buff = { ...move.buff };
      if (buff.bonus) buff.bonus = { ...buff.bonus, damage: (buff.bonus.damage ?? 0) * frac };
      if (buff.attackPower) buff.attackPower = 1 + (buff.attackPower - 1) * frac;
    }
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
    const ms = move.overclock.ms ?? 2800;
    fighter.speedBuff = move.overclock.speed ?? 1.35;
    fighter.speedBuffUntil = time + ms;
    fighter.attackHaste = move.overclock.attack ?? move.overclock.speed ?? 1.35;
    fighter.attackHasteUntil = time + ms;
    if (frac >= 0.98 && move.overclock.selfHeat) {
      fighter._overheatUntil = time + 480;
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
  if (buff.attackPower) {
    fighter.attackPower = buff.attackPower;
    fighter.attackPowerUntil = time + ms;
  }
  if (buff.coat) {
    fighter.buffCoat = buff.coat;
    fighter.buffCoatUntil = time + ms;
  }
  if (buff.bonus) {
    fighter.bonusHits = buff.bonus.hits ?? 1;
    fighter.bonusPacket = { type: buff.bonus.type, damage: buff.bonus.damage, hitsName: buff.bonus.name };
  }
  if (buff.heatOnHit) {
    fighter.heatOnHit = buff.heatOnHit;
    fighter.heatOnHitUntil = Math.max(fighter.heatOnHitUntil ?? 0, time + ms);
    const left = buff.hits > 0 ? buff.hits : Number.POSITIVE_INFINITY;
    fighter.heatOnHitLeft = Math.max(fighter.heatOnHitLeft ?? 0, left);
  }
  if (buff.unquenchable) {
    fighter.unquenchableUntil = Math.max(fighter.unquenchableUntil ?? 0, time + ms);
    fighter.selfDotDps = buff.selfDot?.dps ?? 1;
    fighter.selfDotEvery = buff.selfDot?.every ?? 1000;
    fighter.selfDotType = buff.selfDot?.type ?? 'heat';
    if (!(fighter._unquenchTick > time)) fighter._unquenchTick = time + fighter.selfDotEvery;
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

/** Shorten a swing's commitment while an attack-speed buff is up. */
export function scaledByHaste(move, haste = 1) {
  if (!(haste > 1) || !move) return move;
  const scale = 1 / haste;
  const ms = (n, floor) => Math.max(floor, Math.round((n ?? 0) * scale));
  const frames = (n, floor) => (n == null ? n : Math.max(floor, Math.round(n * scale)));
  return {
    ...move,
    duration: ms(move.duration ?? 0, 1),
    cooldown: ms(move.cooldown ?? 0, 0),
    startupF: frames(move.startupF, 1),
    endlagF: frames(move.endlagF, 0),
    activeF: frames(move.activeF, 1),
  };
}

/** Extra shard packet added only once the blade has connected. */
export function withShatter(move) {
  if (!move?.shatter) return move;
  const extra = typeof move.shatter === 'number' ? move.shatter : (move.shatter.damage ?? 0);
  const type = (typeof move.shatter === 'object' && move.shatter.type) || 'kinetic';
  if (!(extra > 0)) return move;
  if (!move.type2) return { ...move, type2: type, damage2: extra };
  if (move.type2 === type) return { ...move, damage2: (move.damage2 ?? 0) + extra };
  return { ...move, damage: (move.damage ?? 0) + extra };
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
  if (move.percentScale && defender) {
    const cap = move.percentScale.cap ?? 2.5;
    const mult = Math.min(cap, 1 + Math.max(0, defender.percent ?? 0) / 100);
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  } else if (move.bonusVsPercent && defender) {
    const mult = 1 + Math.min(1.1, ((defender.percent ?? 0) / 100) * move.bonusVsPercent);
    next = {
      ...next,
      damage: (next.damage ?? 0) * mult,
      damage2: next.damage2 != null ? next.damage2 * mult : next.damage2,
    };
  }
  if (move.bonusAbovePercent && defender && (defender.percent ?? 0) > (move.bonusAbovePercent.at ?? 0)) {
    const mult = move.bonusAbovePercent.mult ?? 1;
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
    if (Number.isFinite(attacker.heatOnHitLeft)) attacker.heatOnHitLeft -= 1;
  }
  return out;
}
