# Adding a campaign story

The story is **data**, kept apart from the game logic:

| file | what |
|---|---|
| `src/campaign/story/silas-robots.js` | the shipped story, "The Static Collars": Silas's AI robots enslave the elements; 10 chapters of robot waves, an element freed at the end of each (outline: `docs/campaign-story-robots.md`) |
| `src/campaign/story/atomic-knockout.js` | the previous story (Chloe/Aaron raiders, 8 chapters), kept as a drop-in alternative |
| `src/campaign/story/example-mini.js` | a tiny complete story to copy from (not used by the game) |
| `src/campaign/story/index.js` | **the one line that picks the active story** |
| `src/campaign/story/validate.js` | `validateStory(story, fighterIds)` returns a list of problems in plain words |
| `src/campaign/chapters.js` | exposes the active story (`CHAPTERS`, `PROLOGUE`, `SUPPORTS`, `LORD_ID`) and helpers; no story text lives here |

## Steps
1. Copy `src/campaign/story/example-mini.js` to `src/campaign/story/my-story.js` and edit it.
2. In `src/campaign/story/index.js` import yours instead:
   ```js
   import story from './my-story.js';
   export default story;
   ```
3. Check it: `node --test tests/campaign.test.js` (the shipped story is validated by the tests; to check yours, temporarily
   keep it active, or run `node -e "import('./src/campaign/story/validate.js')..."` with your story and the fighter ids).
4. Saves are per campaign progress (`ak-campaign-v1`): chapter ids are stored, so start a New Campaign after swapping stories.

## Shape of a story
```js
export default {
  id, title,
  lord: 'hydra',                 // must be in chapter 1's party; if this unit falls, the chapter is lost
  prologue: { kicker, title, lines },
  chapters: [ chapter, ... ],
  supports: [ { id, after, title, pair: [idA, idB], lines } ],   // optional camp conversations
}
```

### Chapter
| field | meaning |
|---|---|
| `id`, `kicker`, `title`, `objective` | labels (id must be unique) |
| `win` | `rout` kill everyone, `seize` lord ends on `seize: [x, y]`, `boss` kill the enemy with `boss: true`, `defend` survive `turns: N` enemy phases, `escape` lord reaches one of `exit: [[x, y], ...]` |
| `map` | array of equal-length strings. `.` plain `,` road `_` courtyard `f` forest `^` mountain `~` water `#` wall `F` fort `v` village `T` throne |
| `starts` | player start tiles `[[x, y], ...]` (one per party member); `lordSlot` picks the lord's tile |
| `party` | **chapter 1 only**: `{ id, level, lord? }`. Later chapters carry the saved party forward (plus recruits) |
| `enemies` | `{ id, level, x, y, ai }` with `ai`: `aggressive` charges, `hold` waits until you are in range, `boss` stays put; add `boss: true` for the boss. **Robots:** add `robot: true`, the id is then the *element's* fighter id (stats, four real moves, FX come from that fighter) and the unit is drawn with the shared robot body, tinted. Optional `name`, `scale`, `tint` (override the element colour) and `key` (a handle events can point at) |
| `frees` | `[fighterId, ...]`: elements freed when the chapter is won. They join the party (at the party's average level) and show on the summary as "FREED: ...". Each id can be freed once |
| `foes` | `[fighterId, ...]`: people (not robots) who speak against you in this chapter (e.g. `silas` over the loudspeakers), so their art is loaded |
| `npcs` | neutral fighters a unit can **Talk** to when adjacent; `{ id, x, y, with: id \| null, lines }`; they join the party |
| `intro`, `outro` | dialogue before / after the battle |
| `events` | `{ when, lines, spawn?, card? }`, see below |

### Dialogue lines
`{ who: fighterId | null, text, side?: 'L' | 'R' }`. `who: null` is narration. Every fighter id must exist in `src/data/characters.js`
(use the lowercase id, e.g. `ben`, `hydra`); portraits and battle art come from the fighter's existing art.

### Events
`when` is one of `{ start: true }`, `{ turn: n }`, `{ turn: n, orClear: true }` (a **wave**: arrives on turn n, or the moment no enemies are left, whichever is first; needs a `spawn`), `{ enemyTurn: n }`, `{ near: enemyIdOrKey, dist }` (a player unit comes within `dist`
tiles; fires when the move is confirmed), `{ death: enemyIdOrKey }`. Each event fires once. While a wave can still arrive, a rout / seize / escape / defend victory is held back, so a quick win never skips it. `spawn` adds units with a flash:
`[{ id, level, x, y, team: 'player' | 'enemy', ai, boss, robot?, key?, name? }]`. `card: { id, name, epithet }` shows a boss entrance card first; for a robot boss use `card: { robot: true, name, epithet }` (no portrait needed).

## Tips
- Keep maps around 16x10 (the screen fits that); tiles `x` run left to right, `y` top to bottom, from 0.
- Level enemies a little under your party's level on early chapters; `autoplayChapter` (the AI sim in `tests/campaign.test.js`)
  can play any chapter for a quick beatability check.
- Everything must stay family-friendly; fighters' own art is used as is.

## Robots
See `src/campaign/robots.js`: every robot shares one body and wears its element's colour (the fighter's first palette colour). The body is a placeholder (Silas's own sheets, flat-tinted) until the real art is delivered; the brief is `docs/campaign-robot-art-brief.md`. Browser check: `PORT=5173 node tools/campaign-robots-check.mjs`.
