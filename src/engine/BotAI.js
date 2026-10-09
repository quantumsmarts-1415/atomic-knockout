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
//
// Big multi-level stages (stage.botNav) pass the BotNav graph as `nav`;
// those bots path-find between tiers (navBotInput below) and may also return
// down: true to drop through a platform. Every other stage keeps the flat
// chase logic exactly as before.
// ---------------------------------------------------------------------------
import { nodeAt, findPath, jumpReach, liftAt, reachableFrom } from './BotNav.js';

export function computeBotInput(time, bot, fighters, bounds, nav = null) {
  const input = { left: false, right: false, jump: false, attack: false, special: false };

  const targets = fighters.filter((f) => f !== bot && f.alive && f.state !== 'ko' && f.state !== 'dead');
  if (nav) return navBotInput(time, bot, targets, nav);
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
  const basicRange = (bot.charDef.moves.basicDirectional.rangeW ?? 60) + 20;
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
  // Hop up steps (Holdout Keep's raised keep, The Core's pillar) instead of
  // pressing into the wall forever. Jump is edge-triggered in Fighter, so
  // this goes through the same nextJumpAt throttle.
  const b = bot.body;
  const grounded = !!b && (b.blocked.down || b.touching.down);
  const walled = !!b && ((input.right && (b.blocked.right || b.touching.right))
    || (input.left && (b.blocked.left || b.touching.left)));
  if (grounded && walled && time >= ai.nextJumpAt) {
    input.jump = true;
    ai.nextJumpAt = time + 400;
  } else if (time >= ai.nextJumpAt && roll(bot) < 0.008) {
    input.jump = true;
    ai.nextJumpAt = time + 500;
  }
  // Side platforms are one-way. If the opponent is on the floor below,
  // drop back down instead of camping where short moves cannot reach.
  // Down does not fall through the solid stage, so this is a no-op there.
  if (grounded && target.y > bot.y + 100) {
    input.down = true;
    input.jump = false;
  }

  tryAttacks(time, bot, target, ai, input, bounds);
  return applyScriptedSlots(time, bot, input);
}

// ------------------------------------------------------------ nav (big stages)
const ATTACK_DY = 90;   // only swing when the target is about level with you
const STUCK_MS = 3500;  // same edge this long without progress -> ban it
const BAN_MS = 6000;

function navBotInput(time, bot, targets, nav) {
  const input = { left: false, right: false, jump: false, attack: false, special: false, down: false };
  bot._ai ??= { nextAttackAt: 0, nextSpecialAt: 0, nextJumpAt: 0 };
  const ai = bot._ai;
  ai.reach ??= jumpReach(bot.charDef.stats);
  ai.banned ??= new Map();
  ai.nextAirJumpAt ??= 0;
  ai.dropUntil ??= 0;
  const b = bot.body;
  if (!b) return input;
  const grounded = b.blocked.down || b.touching.down;
  const moveTo = (x, dead = 10) => {
    if (x < bot.x - dead) input.left = true;
    else if (x > bot.x + dead) input.right = true;
    return Math.abs(x - bot.x) <= dead;
  };
  if (time < ai.dropUntil) input.down = true;

  // nearest target by straight-line distance (tiers matter here)
  let target = null;
  let best = Infinity;
  for (const f of targets) {
    const d = Math.hypot(f.x - bot.x, f.y - bot.y);
    if (d < best) { best = d; target = f; }
  }

  const halfW = Math.max(6, (bot.bodyW ?? 12) / 2 - 2);
  let cur = grounded ? nodeAt(nav, bot.x, bot.y, 7, halfW) : null;
  // grounded but between known spans (e.g. teetering on a lip): still on the last surface
  if (grounded && !cur && ai.node != null && Math.abs(nav.nodes[ai.node].y - bot.y) <= 7 && nav.nodes[ai.node].kind !== 'stop') cur = nav.nodes[ai.node];
  if (cur && cur.id !== ai.node) { ai.node = cur.id; ai.air = null; }
  if (grounded && ai.air && time - ai.air.at > 200) ai.air = null;

  if (!grounded) {
    airControl(time, bot, target, nav, ai, input, moveTo);
    if (target) tryAttacks(time, bot, target, ai, input, deckOf(nav, ai));
    return applyScriptedSlots(time, bot, input);
  }
  if (!cur) {
    // standing on something the graph doesn't know (rare): walk to the
    // nearest known surface point at this height
    if (target) moveTo(target.x, 30);
    return applyScriptedSlots(time, bot, input);
  }
  if (!target) { moveTo(cur.cx, 30); return applyScriptedSlots(time, bot, input); }

  // ---- plan: path to the target's surface, or as close as we can get
  const now = new Set();
  for (const [k, until] of ai.banned) { if (until > time) now.add(k); else ai.banned.delete(k); }
  const goal = targetNode(nav, target);
  let path = null;
  if (goal && goal.id !== cur.id) {
    path = findPath(nav, cur.id, goal.id, ai.reach, now);
    if (!path) {
      // unreachable for this character (e.g. a tank vs. a perch): go to the
      // reachable surface closest to the target instead
      const reach = reachableFrom(nav, cur.id, ai.reach);
      let alt = null;
      let ad = Infinity;
      for (const id of reach) {
        const n = nav.nodes[id];
        const d = Math.hypot(Math.min(Math.max(target.x, n.x0), n.x1) - target.x, n.y - target.y);
        if (d < ad) { ad = d; alt = n; }
      }
      if (alt && alt.id !== cur.id) path = findPath(nav, cur.id, alt.id, ai.reach, now);
    }
  }
  const e = path?.[0] ?? null;
  const key = e ? `${e.from}>${e.to}` : null;
  if (key !== ai.edgeKey) { ai.edgeKey = key; ai.edgeSince = time; }
  else if (e && !['board', 'ride', 'exit'].includes(e.type) && time - ai.edgeSince > STUCK_MS) {
    ai.banned.set(key, time + BAN_MS);
    ai.edgeSince = time;
  }
  ai.lastEdge = e ? `${e.type}>${e.to}` : 'engage';

  if (!e) {
    engage(time, bot, target, cur, nav, ai, input, moveTo);
    return applyScriptedSlots(time, bot, input);
  }
  followEdge(time, bot, e, cur, nav, ai, input, moveTo);
  // opportunistic swings at anyone level with us on the way
  tryAttacks(time, bot, target, ai, input, deckOf(nav, ai));
  return applyScriptedSlots(time, bot, input);
}

// The surface the target is on (or will land on), null if over the void.
function targetNode(nav, t) {
  const tb = t.body;
  if (tb && (tb.blocked.down || tb.touching.down)) {
    const n = nodeAt(nav, t.x, t.y, 7, Math.max(6, (t.bodyW ?? 12) / 2 - 2));
    if (n) return n;
  }
  return nav.firstBelow(t.x, t.y - 6);
}

function followEdge(time, bot, e, cur, nav, ai, input, moveTo) {
  const B = nav.nodes[e.to];
  switch (e.type) {
    case 'walk':
      moveTo(B.cx, 4);
      break;
    case 'jump':
      if (moveTo(e.tx, 14) && time >= ai.nextJumpAt) {
        input.jump = true;
        ai.nextJumpAt = time + 350;
        ai.air = { e, at: time, usedAir: false };
        input.left = e.lx < bot.x - 6;
        input.right = e.lx > bot.x + 6;
      }
      break;
    case 'drop':
      if (moveTo(e.x, 16)) {
        input.left = input.right = false;
        input.down = true;
        ai.dropUntil = time + 260;
        ai.air = { e, at: time };
      }
      break;
    case 'walkoff':
      moveTo(e.ex + e.side * 80, 0);
      ai.air = { e, at: time };
      break;
    case 'board': {
      // B is the stop; step on only while the lift is parked there
      if (liftAt(nav, B, 6)) moveTo(B.cx, 24);
      else if (cur.x1 > B.x0 && cur.x0 < B.x1) moveTo(B.cx, 24); // floor under the shaft: it comes to us
      else moveTo(B.cx < cur.cx ? cur.x0 + 30 : cur.x1 - 30, 10); // wait at the edge, not in the shaft
      break;
    }
    case 'exit':
      if (liftAt(nav, cur, 6)) moveTo(B.cx, 10);
      else moveTo(cur.cx, 30);
      break;
    case 'ride':
    default:
      moveTo(cur.cx, 30);
  }
}

function airControl(time, bot, target, nav, ai, input, moveTo) {
  const b = bot.body;
  const vy = b.velocity.y;
  // a hit (or nothing under us any more) cancels the move we were making --
  // otherwise a bot knocked off mid-drop would never try to recover
  if (ai.air && (bot.state === 'hurt' || (!nav.firstBelow(bot.x, bot.y - 4) && (ai.air.e.type !== 'jump' || time - ai.air.at > 900)))) ai.air = null;
  const a = ai.air;
  if (a && time - a.at < 2500) {
    const e = a.e;
    const B = nav.nodes[e.to];
    if (e.type === 'jump') {
      moveTo(e.lx, 6);
      const by = B.kind === 'stop' ? nav.liftY[B.lift.mover] : B.y;
      if (e.mode === 'double' && !a.usedAir && vy > -140 && bot.y > by - 18 && bot.airJumpsLeft > 0) {
        input.jump = true;
        a.usedAir = true;
      }
    } else if (e.type === 'walkoff') {
      moveTo(Math.min(Math.max(e.x, B.x0 + 30), B.x1 - 30), 6);
    }
    // drop: fall straight
    return;
  }
  // no committed edge (knocked back, fell): recover if nothing is below us
  const below = nav.firstBelow(bot.x, bot.y - 4);
  if (!below) {
    let tx = bot.x;
    let td = Infinity;
    for (const n of nav.nodes) {
      if (n.kind === 'stop') continue;
      const cx = Math.min(Math.max(bot.x, n.x0 + 40), n.x1 - 40);
      // prefer surfaces we can still get on top of
      const d = Math.abs(cx - bot.x) + Math.max(0, bot.y - n.y - 60) * 2;
      if (d < td) { td = d; tx = cx; }
    }
    moveTo(tx, 4);
    if (vy > 40 && bot.airJumpsLeft > 0 && time >= ai.nextAirJumpAt) {
      input.jump = true;
      ai.nextAirJumpAt = time + 320;
    }
    ai.recovering = true;
    return;
  }
  ai.recovering = false;
  // over solid ground: drift toward the target, but never off the edge
  if (target) {
    const dir = Math.sign(target.x - bot.x);
    if (dir && nav.firstBelow(bot.x + dir * 50, bot.y - 4)) moveTo(target.x, 20);
  }
}

function engage(time, bot, target, cur, nav, ai, input, moveTo) {
  const basic = bot.charDef.moves.basicDirectional;
  const basicRange = (basic.rangeW ?? 60) + 20;
  const dx = target.x - bot.x;
  // stay on this surface: chase along it, but not past its ends
  const lo = cur.x0 + 24;
  const hi = cur.x1 - 24;
  const want = Math.min(Math.max(target.x, lo), hi);
  if (Math.abs(dx) > basicRange) moveTo(want, 6); // else in range: hold ground
  // walled (a ledge lip): hop it, same as the flat bots
  const b = bot.body;
  const walled = (input.right && (b.blocked.right || b.touching.right)) || (input.left && (b.blocked.left || b.touching.left));
  if (walled && time >= ai.nextJumpAt) { input.jump = true; ai.nextJumpAt = time + 400; }
  else if (time >= ai.nextJumpAt && roll(bot) < 0.006 && bot.x > lo + 60 && bot.x < hi - 60) {
    input.jump = true; // the odd hop so they don't look glued down
    ai.nextJumpAt = time + 600;
  }
  tryAttacks(time, bot, target, ai, input, deckOf(nav, ai));
}

function roll(bot) {
  const rng = bot.scene?.rng;
  return typeof rng === 'function' ? rng() : Math.random();
}

function deckOf(nav, ai) {
  if (ai.deck) return ai.deck;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const n of nav.nodes) {
    if (n.kind === 'stop') continue;
    if (n.x0 < minX) minX = n.x0;
    if (n.x1 > maxX) maxX = n.x1;
  }
  ai.deck = { minX, maxX };
  return ai.deck;
}

function diveLeavesDeck(bot, input, target, bounds) {
  const move = bot.charDef?.moves?.specialDirectional;
  if (!bounds || move?.kind !== 'dive') return false;
  let dir = 0;
  if (input.right && !input.left) dir = 1;
  else if (input.left && !input.right) dir = -1;
  else dir = Math.sign((target?.x ?? bot.x) - bot.x) || bot.facing || 1;
  const travel = (move.dashSpeed ?? 160) * 0.9 + 80;
  if (dir > 0) return bot.x + travel > bounds.maxX;
  return bot.x - travel < bounds.minX;
}

function tryAttacks(time, bot, target, ai, input, bounds) {
  if (input.down) return;
  const basic = bot.charDef.moves.basicDirectional;
  const special = bot.charDef.moves.specialDirectional;
  const basicRange = (basic.rangeW ?? 60) + 20;
  const specialRange = specialRangeOf(special);
  const dist = Math.abs(target.x - bot.x);
  const dy = Math.abs(target.y - bot.y);
  const ready = bot.state !== 'attack' && bot.state !== 'hurt' && bot.state !== 'ko'
    && bot.state !== 'charging' && bot.state !== 'defending' && bot.state !== 'dead';
  let wantBasic = ready && dist <= basicRange && dy < ATTACK_DY
    && time >= ai.nextAttackAt && time >= (bot.attackCooldownUntil ?? 0);
  let wantSpecial = ready && dist <= specialRange && dy < ATTACK_DY + 20
    && time >= ai.nextSpecialAt && time >= (bot.specialCooldownUntil ?? 0);
  // Both buttons are edge-triggered on the same frame; attack would eat the
  // special press. Alternate so a bot actually uses both directional moves.
  if (wantSpecial && diveLeavesDeck(bot, input, target, bounds)) wantSpecial = false;
  if (wantBasic && wantSpecial) {
    if ((ai.swing ?? 0) % 2 === 0) wantSpecial = false;
    else wantBasic = false;
    ai.swing = (ai.swing ?? 0) + 1;
  }
  if (wantBasic || wantSpecial) {
    // In range the bot otherwise holds still. A neutral press would charge
    // or block instead of the directional move, so face the target for
    // this one press.
    if (!input.left && !input.right && !input.down && !input.jump) {
      if (target.x >= bot.x) input.right = true;
      else input.left = true;
    }
  }
  if (wantBasic) {
    input.attack = true;
    ai.nextAttackAt = time + basic.duration + basic.cooldown + 80;
  }
  if (wantSpecial) {
    input.special = true;
    ai.nextSpecialAt = time + special.duration + special.cooldown + 200;
  }
}

function specialRangeOf(special) {
  if (special.kind === 'burst' || special.kind === 'zone') return (special.radius ?? special.zone?.radius ?? 90) + 24;
  if (special.kind === 'beam') return (special.beamLen ?? 160) + 20;
  return 240;
}

// A fixed cycle so every bot presses all four slots: directional attacks,
// then a neutral charge long enough to pass fizzleBelow / detonateAtFull,
// then a neutral defense hold. Directional chasing is left alone outside
// those windows (t = 1000 stays a walk, which the stage CPU test relies on).
const SLOT_CYCLE = 6400;

function applyScriptedSlots(time, bot, input) {
  const t = time % SLOT_CYCLE;
  const neutral = () => {
    input.left = false;
    input.right = false;
    input.jump = false;
    input.down = false;
  };
  // A held button is not a new press. If the fighter is busy when the
  // window opens, let go until they are free so the slot still fires.
  const busy = bot.state === 'attack' || bot.state === 'hurt' || bot.state === 'defending' || bot.state === 'ko';
  if (t >= 2500 && t < 2620) {
    neutral();
    input.attack = false;
    input.special = false;
  } else if (t >= 2620 && t < 4100) {
    neutral();
    input.special = false;
    input.attack = bot.state === 'charging' || !busy;
  } else if (t >= 4100 && t < 4220) {
    neutral();
    input.attack = false;
    input.special = false;
  } else if (t >= 4220 && t < 5300) {
    neutral();
    input.attack = false;
    input.special = bot.state === 'defending' || !busy;
  } else if (t >= 5300 && t < 5420) {
    neutral();
    input.attack = false;
    input.special = false;
  }
  return input;
}
