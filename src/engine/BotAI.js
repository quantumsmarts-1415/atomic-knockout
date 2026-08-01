// ---------------------------------------------------------------------------
// BotAI -- the "basic CPU controller that can stand in for a human player"
// from Phase 8 of the build plan, pulled forward so lobby seats can be
// filled with a bot instead of requiring a real phone/keyboard player.
//
// Deliberately simple, per the plan's own scope: move toward/away from the
// nearest opponent, jump occasionally, and choose when to attack. This is
// the same full-strength moveset any player uses -- it is NOT the weakened
// "(Symbol)-bot grunt" from the campaign (Phase 8/9), which is a separate,
// later concern.
//
// Call once per frame per bot fighter; returns the same {left,right,jump,
// attack,special} shape every other input source produces, so BattleScene
// can just assign it straight onto fighter.input.
// ---------------------------------------------------------------------------
export function computeBotInput(time, bot, fighters, bounds) {
  const input = { left: false, right: false, jump: false, attack: false, special: false };

  const targets = fighters.filter((f) => f !== bot && f.alive && f.state !== 'ko' && f.state !== 'dead');
  if (!targets.length) return input;

  let target = targets[0];
  let bestDist = Math.abs(target.x - bot.x);
  for (const f of targets) {
    const d = Math.abs(f.x - bot.x);
    if (d < bestDist) { bestDist = d; target = f; }
  }

  bot._ai ??= { nextAttackAt: 0, nextSpecialAt: 0, nextJumpAt: 0 };
  const ai = bot._ai;

  const dx = target.x - bot.x;
  const dist = Math.abs(dx);
  const basic = bot.charDef.moves.basic;
  const special = bot.charDef.moves.special;
  const basicRange = (basic.rangeW ?? 60) + 20;
  const specialRange = special.kind === 'burst' ? (special.radius ?? 90) : 240;

  // Stage-edge safety takes priority over chasing -- a bot that walks itself
  // off the platform to reach a target isn't "standing in for a player."
  if (bot.x < bounds.minX + 60) {
    input.right = true;
  } else if (bot.x > bounds.maxX - 60) {
    input.left = true;
  } else if (dist > basicRange) {
    input.left = dx < 0;
    input.right = dx > 0;
  }
  // else: already in range, hold ground rather than walking into the target

  // Light, occasional jumping -- reacts a bit to an airborne target, plus a
  // small random chance so bots don't read as perfectly flat-footed.
  if (time >= ai.nextJumpAt) {
    const shouldJump = (target.y < bot.y - 60 && Math.random() < 0.35) || Math.random() < 0.01;
    if (shouldJump) {
      input.jump = true;
      ai.nextJumpAt = time + 500;
    }
  }

  if (dist <= basicRange && time >= ai.nextAttackAt) {
    input.attack = true;
    ai.nextAttackAt = time + basic.duration + basic.cooldown + 80;
  }
  if (dist <= specialRange && time >= ai.nextSpecialAt && Math.random() < 0.5) {
    input.special = true;
    ai.nextSpecialAt = time + special.duration + special.cooldown + 200;
  }

  return input;
}
