import { CHAPTERS } from './chapters.js';
import { CampaignBattle } from './state.js';
import { makeRecord } from './units.js';
import { partyForChapter } from './progress.js';

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

/** Let the AI play every unit of `team` (used by the enemy phase and by tests). */
export function autoplayPhase(battle, team = 'enemy') {
  const events = [];
  const pick = () => battle.units.filter((u) => u.alive && u.team === team && !u.acted)
    .sort((a, b) => (a.boss - b.boss) || (a.uid - b.uid))[0];
  for (let u = pick(); u && !battle.result; u = pick()) {
    const plan = battle.plan(u);
    battle.moveUnit(u, plan.to.x, plan.to.y);
    if (plan.target) events.push({ unit: u, ...battle.attack(u, plan.target) });
    else battle.wait(u);
  }
  return events;
}

/** Full AI-vs-AI chapter; returns the result and turns used. */
export function autoplayChapter(battle, maxTurns = 40) {
  while (!battle.result && battle.turn <= maxTurns) {
    battle.startPhase('player');
    for (const u of battle.players) if (u.lord) u.ai = 'boss'; // the sim's lord sits tight (never leaves, only fights what walks up)
    autoplayPhase(battle, 'player');
    if (battle.result) break;
    // the seize chapter needs the lord on the throne; head there when nothing is left to fight
    battle.startPhase('enemy');
    autoplayPhase(battle, 'enemy');
    if (battle.result) break;
    battle.endEnemyPhase();
  }
  return { result: battle.result || 'timeout', turns: battle.turn };
}
