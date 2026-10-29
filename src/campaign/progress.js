// Campaign progress and save slot. Records carry level/xp/stats between chapters.
import { CHAPTERS } from './chapters.js';
import { makeRecord, restored } from './units.js';

const SAVE_KEY = 'ak-campaign-v1';

export function newCampaign() {
  return { chapter: 0, party: CHAPTERS[0].party.map((p) => makeRecord(p.id, p.level, { lord: !!p.lord })), cleared: [], lost: [] };
}

export function averageLevel(party) {
  if (!party.length) return 1;
  return Math.max(1, Math.round(party.reduce((a, r) => a + r.level, 0) / party.length));
}

/** Party for a chapter: survivors at full HP plus that chapter's recruits. */
export function partyForChapter(save, chapter) {
  const party = save.party.map(restored);
  const avg = averageLevel(party);
  for (const r of chapter.recruits || []) {
    if (party.some((p) => p.id === r.id)) continue;
    party.push(makeRecord(r.id, r.join === 'level' ? avg : (r.level || 1)));
  }
  return party;
}

/** After a win: keep survivors, advance the chapter pointer. */
export function afterVictory(save, chapterIndex, survivors) {
  const next = {
    ...save,
    party: survivors.map((r) => ({ ...r })),
    chapter: Math.min(CHAPTERS.length, chapterIndex + 1),
    cleared: [...new Set([...save.cleared, CHAPTERS[chapterIndex].id])],
  };
  return next;
}

export function loadSave(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.party) || typeof s.chapter !== 'number') return null;
    return s;
  } catch { return null; }
}

export function writeSave(save, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage full or blocked */ }
}

export function clearSave(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
