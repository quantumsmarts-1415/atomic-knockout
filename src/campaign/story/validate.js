// Checks a campaign story object (see docs/campaign-story.md) and returns a list of human-readable problems.
// Pure: pass `knownFighters` (an iterable of fighter ids) to also check every id used in the story.
import { GLYPH_TO_TERRAIN, TERRAIN } from '../terrain.js';

const WINS = ['rout', 'seize', 'boss', 'defend', 'escape'];
const WHENS = ['start', 'turn', 'enemyTurn', 'near', 'death'];

export function validateStory(story, knownFighters = null) {
  const bad = [];
  const known = knownFighters ? new Set(knownFighters) : null;
  const err = (where, msg) => bad.push(`${where}: ${msg}`);
  const fighter = (where, id) => {
    if (typeof id !== 'string' || !id) err(where, 'missing fighter id');
    else if (known && !known.has(id)) err(where, `unknown fighter "${id}"`);
  };
  const lines = (where, list, required = false) => {
    if (list == null) { if (required) err(where, 'lines are required'); return; }
    if (!Array.isArray(list)) { err(where, 'lines must be an array'); return; }
    if (required && !list.length) err(where, 'needs at least one line');
    list.forEach((l, i) => {
      if (typeof l?.text !== 'string' || !l.text.trim()) err(`${where}[${i}]`, 'line needs text');
      if (l?.who != null) fighter(`${where}[${i}].who`, l.who);
      if (l?.side != null && l.side !== 'L' && l.side !== 'R') err(`${where}[${i}]`, 'side must be L or R');
    });
  };

  if (!story || typeof story !== 'object') return ['story: not an object'];
  for (const k of ['id', 'title']) if (typeof story[k] !== 'string' || !story[k]) err('story', `${k} must be a string`);
  fighter('story.lord', story.lord);
  lines('prologue.lines', story.prologue?.lines, true);
  if (!Array.isArray(story.chapters) || !story.chapters.length) { err('story', 'chapters must be a non-empty array'); return bad; }
  const ids = new Set();
  story.chapters.forEach((ch, ci) => {
    const w = `chapter ${ci + 1} (${ch?.id})`;
    if (!ch?.id || ids.has(ch.id)) err(w, 'id missing or duplicated');
    ids.add(ch.id);
    for (const k of ['title', 'kicker', 'objective']) if (typeof ch[k] !== 'string' || !ch[k]) err(w, `${k} must be a string`);
    if (!WINS.includes(ch.win)) err(w, `win must be one of ${WINS.join(', ')}`);
    const rows = ch.map;
    if (!Array.isArray(rows) || !rows.length) { err(w, 'map must be an array of rows'); return; }
    const width = rows[0].length;
    const h = rows.length;
    const terrainAt = (x, y) => TERRAIN[GLYPH_TO_TERRAIN[rows[y]?.[x]]];
    rows.forEach((r, y) => {
      if (r.length !== width) err(w, `map row ${y} is ${r.length} wide, expected ${width}`);
      for (const c of r) if (!GLYPH_TO_TERRAIN[c]) err(w, `map row ${y} has unknown glyph "${c}"`);
    });
    const inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < h;
    const walkable = (x, y) => inside(x, y) && terrainAt(x, y) && Number.isFinite(terrainAt(x, y).cost);
    if (!Array.isArray(ch.starts) || !ch.starts.length) err(w, 'starts needs player start tiles');
    else {
      ch.starts.forEach(([x, y], i) => { if (!walkable(x, y)) err(w, `start ${i} (${x},${y}) is off the map or blocked`); });
      if (new Set(ch.starts.map((s) => s.join(','))).size !== ch.starts.length) err(w, 'duplicate start tiles');
    }
    const party = ch.party || [];
    // Only chapter 1 lists the party; later chapters carry the saved party forward.
    if (ci === 0) {
      if (!party.length) err(w, 'the first chapter needs a party');
      if (!party.some((p) => p.id === story.lord)) err(w, `the first chapter's party must include the lord "${story.lord}"`);
    }
    if (party.length > (ch.starts?.length || 0)) err(w, `party of ${party.length} has only ${ch.starts?.length || 0} start tiles`);
    party.forEach((p, i) => fighter(`${w} party[${i}]`, p.id));
    (ch.enemies || []).forEach((e, i) => {
      fighter(`${w} enemies[${i}]`, e.id);
      if (!walkable(e.x, e.y)) err(w, `enemy ${e.id} (${e.x},${e.y}) is off the map or blocked`);
    });
    if (!(ch.enemies || []).length) err(w, 'needs at least one enemy');
    if (ch.win === 'seize' && !(Array.isArray(ch.seize) && walkable(...ch.seize))) err(w, 'seize needs a walkable [x, y]');
    if (ch.win === 'defend' && !(ch.turns > 0)) err(w, 'defend needs turns');
    if (ch.win === 'escape' && !(Array.isArray(ch.exit) && ch.exit.length && ch.exit.every(([x, y]) => walkable(x, y)))) err(w, 'escape needs exit tiles [[x, y], ...]');
    if (ch.win === 'boss' && !(ch.enemies || []).some((e) => e.boss)) err(w, 'boss objective needs an enemy with boss: true');
    lines(`${w} intro`, ch.intro);
    lines(`${w} outro`, ch.outro);
    (ch.events || []).forEach((ev, i) => {
      const ew = `${w} events[${i}]`;
      const keys = Object.keys(ev.when || {}).filter((k) => WHENS.includes(k));
      if (!keys.length) err(ew, `when needs one of ${WHENS.join(', ')}`);
      if (ev.when?.near != null) fighter(`${ew}.when.near`, ev.when.near);
      if (ev.when?.death != null) fighter(`${ew}.when.death`, ev.when.death);
      lines(`${ew}.lines`, ev.lines);
      (ev.spawn || []).forEach((s, j) => { fighter(`${ew}.spawn[${j}]`, s.id); if (!walkable(s.x, s.y)) err(`${ew}.spawn[${j}]`, 'off the map or blocked'); });
      if (ev.card) fighter(`${ew}.card`, ev.card.id);
    });
    (ch.npcs || []).forEach((n, i) => {
      fighter(`${w} npcs[${i}]`, n.id);
      if (!walkable(n.x, n.y)) err(`${w} npcs[${i}]`, 'off the map or blocked');
      lines(`${w} npcs[${i}].lines`, n.lines);
    });
  });
  (story.supports || []).forEach((s, i) => {
    const w = `supports[${i}] (${s?.id})`;
    if (!(s.after >= 0 && s.after < story.chapters.length)) err(w, 'after must be a chapter index');
    (s.pair || []).forEach((p) => fighter(`${w}.pair`, p));
    lines(`${w}.lines`, s.lines, true);
  });
  return bad;
}
