// Campaign story access + helpers. The story itself (maps, units, dialogue) is DATA in ./story/;
// swap which one is active in ./story/index.js. See docs/campaign-story.md.
import STORY from './story/index.js';

export const LORD_ID = STORY.lord;
export const PROLOGUE = STORY.prologue;
export const CHAPTERS = STORY.chapters;
export const SUPPORTS = STORY.supports || [];
export { STORY };

/** Camp conversations unlocked by progress (save.chapter = how many chapters are cleared). */
export function supportsFor(save) {
  const cleared = save?.chapter || 0;
  return SUPPORTS.filter((s) => cleared > s.after);
}

export function chapterById(id) {
  return CHAPTERS.find((c) => c.id === id) || null;
}

/** Every fighter a chapter shows on screen: speakers, spawns and recruits as well as the troops. */
export function chapterSpeakers(ch) {
  const ids = new Set();
  for (const l of [...(ch.intro || []), ...(ch.outro || [])]) if (l.who) ids.add(l.who);
  for (const e of ch.events || []) {
    for (const l of e.lines || []) if (l.who) ids.add(l.who);
    for (const s of e.spawn || []) ids.add(s.id);
  }
  for (const e of ch.events || []) if (e.card) ids.add(e.card.id);
  for (const n of ch.npcs || []) {
    ids.add(n.id);
    for (const l of n.lines || []) if (l.who) ids.add(l.who);
  }
  return [...ids];
}
