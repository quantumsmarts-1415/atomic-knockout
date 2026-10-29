import { CHAPTERS } from './chapters.js';
import { CampaignBattle } from './state.js';
import { makeRecord } from './units.js';
import { partyForChapter } from './progress.js';
import { distanceField, key as gkey } from './grid.js';

export * from './chapters.js';
export * from './progress.js';
export * from './units.js';
export { CampaignBattle } from './state.js';

export function createBattle(save, chapterIndex, seed = (Date.now() & 0xffff) || 1) {
  const chapter = CHAPTERS[chapterIndex];
  const party = partyForChapter(save, chapter);
  return new CampaignBattle(chapter, party, {
    seed,
    enemyRecords: (e) => makeRecord(e.id, e.level),
  });
}

/** Where the sim lord should head (seize/escape chapters), or null to stay put. */
function lordGoal(b) {
  const c = b.chapter;
  if (c.win === 'escape' && b.turn >= 3) return { x: c.exit[0][0], y: c.exit[0][1] };
  if (c.win === 'seize' && (b.enemies.length <= 3 || b.turn >= 12)) return { x: c.seize[0], y: c.seize[1] };
  return null;
}

/** Let the AI play every unit of `team` (used by the enemy phase and by tests). */
export function autoplayPhase(battle, team = 'enemy') {
  const events = [];
  const pick = () => battle.units.filter((u) => u.alive && u.team === team && !u.acted)
    .sort((a, b) => (a.boss - b.boss) || (a.uid - b.uid))[0];
  for (let u = pick(); u && !battle.result; u = pick()) {
    const goal = u.lord && team === 'player' ? lordGoal(battle) : null;
    if (goal) {
      const reach = battle.reachFor(u);
      const field = distanceField(battle.map, [goal]);
      let best = null;
      for (const st of reach.stops.values()) {
        const d = field.get(gkey(st.x, st.y));
        if (d != null && (!best || d < best.d)) best = { st, d };
      }
      if (best) battle.moveUnit(u, best.st.x, best.st.y);
      if (u.x === goal.x && u.y === goal.y) { if (battle.chapter.win === 'escape') battle.escape(u); else battle.seize(u); }
      else battle.wait(u);
      continue;
    }
    const plan = battle.plan(u);
    if (plan.cancelCharge) battle.cancelCharge(u);
    battle.moveUnit(u, plan.to.x, plan.to.y);
    if (plan.target) events.push({ unit: u, ...battle.attack(u, plan.target, plan.move) });
    else if (plan.guard) battle.guard(u, plan.guard);
    else if (plan.charge) battle.startCharge(u, plan.charge);
    else battle.wait(u);
  }
  return events;
}

/** Full AI-vs-AI chapter; returns the result and turns used. */
export function autoplayChapter(battle, maxTurns = 40) {
  let started = false;
  while (!battle.result && battle.turn <= maxTurns) {
    if (!started) { battle.startPhase('player'); started = true; } // later player phases begin in endEnemyPhase()
    battle.checkEvents('turn');
    if (battle.turn === 3) for (const n of battle.units.filter((x) => x.team === 'npc' && x.alive)) { n.team = 'player'; n.ai = 'aggressive'; n.acted = false; battle.recruited.push(n); } // the sim assumes a player reaches recruits by turn 3
    for (const u of battle.players) if (u.lord) u.ai = 'boss'; // the sim's lord sits tight (never leaves, only fights what walks up)
    autoplayPhase(battle, 'player');
    if (battle.result) break;
    // the seize chapter needs the lord on the throne; head there when nothing is left to fight
    battle.startPhase('enemy');
    battle.checkEvents('enemyTurn');
    autoplayPhase(battle, 'enemy');
    if (battle.result) break;
    battle.endEnemyPhase();
  }
  return { result: battle.result || 'timeout', turns: battle.turn };
}
