# Campaign mode

Title screen -> **Campaign**. A Fire Emblem-style grid tactics campaign built from the existing fighters
(no new fighter art). Eight chapters with a prologue, story intros/outros and mid-battle conversations.

## Controls
- Mouse: left click selects/confirms, right click or Esc cancels, hovering moves the cursor.
- Keyboard: arrows/WASD cursor, Enter/Space/Z/F/K confirm, Esc/X/Backspace cancel, E/Tab end turn, **C** toggles the close-up battle scenes.
- Gamepad: d-pad/left stick, A confirm, B cancel, Start end turn. In conversations A = next, B/Start = skip.
- Conversations: Enter / click = next line (finishes the typewriter first), Esc or the SKIP chip = skip the scene.

## Chapter select, replays and camp
- The menu is a chapter select: cleared chapters are gold and can be replayed (practice: the saved campaign is unchanged);
  the next chapter is marked NEXT; later ones are locked.
- **Camp Conversations** (menu button): short talks between party members, unlocked as chapters are cleared
  (`supports` in the story data, `supportsFor` in chapters.js, `save.seenSupports`). Story only, no stat bonuses.
- Boss encounters (`near` events with a `card: { id, name, epithet }`) open with a boss entrance card, then the conversation.
- Map movement uses the fighter's own walk sheet when it has loaded (loaded one fighter at a time when selected / before an
  enemy moves, at most 4 kept in memory); otherwise the unit glides with a bob. `?nowalk` forces gliding.

## Music
Soundtrack. Most tracks are composed in code; `battle`, `defeat_player` and `defeat_enemy` were made separately by a teammate (OGG + MP3, -19 LUFS) and copied in as they are. If a battle/defeat file is missing the game keeps the phase theme and plays no sting. Composed-in-code part: (`tools/music/synth.py` + `compose.py`, rendered by `python3 tools/music/compose.py && python3 tools/music/build.py`;
numpy/scipy + ffmpeg, no samples). Files are in `assets/campaign/music/` as `.ogg` (used) and `.mp3` (fallback), loudness-normalised
(loops -19 LUFS, stingers -16 LUFS, true peak under -1.5 dB), loops are seamless.

| track | where | length |
|---|---|---|
| title | chapter select, summary | 45.7 s loop |
| story | prologue / chapter intros and outros | 58.2 s loop |
| camp | camp conversations list and talks | 41.7 s loop |
| map_player | player phase (rotation 1 of 3) | 60.0 s loop |
| map_player_2 | player phase (rotation 2 of 3): the original boss theme, E minor 156 bpm | 49.2 s loop |
| map_player_3 | player phase (rotation 3 of 3): the second boss theme, F minor 140 bpm | 54.9 s loop |
| map_enemy | enemy phase | 55.7 s loop |
| boss | from the boss entrance card to the end of the chapter (C# minor, 156 bpm, double-kick + war drums, 35 Hz sub, crushing distorted bass, stacked low brass + choir hits; intro, two themes, half-time breakdown, climax; -16 LUFS, a little hotter than the maps) | 67.7 s loop |
| battle | the close-up battle scenes only; the phase theme resumes when the scene ends (40 s loop) | 40 s loop |
| defeat_player / defeat_enemy | short stings when a unit falls (the lord's fall plays `defeat` instead); played +3 dB hotter (`STINGER_BOOST`) | 2.7 / 1.9 s |
| victory / defeat / levelup | stingers (victory/defeat hold the next theme until they end; level-up just ducks it) | 7.6 / 11.9 / 2.9 s |

Player-phase map music rotates (`createMapRotation` in `music.js`): chapter N opens on `map_player`, `_2`, `_3` in turn (N mod 3), and inside a chapter the theme moves on after one full loop of player-phase listening (the enemy phase always plays `map_enemy`).

`src/campaign/music.js` plays them on its own AudioContext (fight mode audio is untouched), crossfading between themes.
Volume = `ak-master` (the Sound setting) x `ak-music` (localStorage, default 0.6); **M** toggles `ak-music-mute`. Music stops when the campaign is left.

## Story arc
Prologue "The Hum at the Edge" -> 1 Static in the Cloud (rout) -> 2 The Alkali Gate (seize) -> 3 Heavy Metal Heart (boss)
-> 4 The Salt Flats (defend 6 turns) -> 5 Through the Noble Mist (escape) -> 6 The Rare Earth Vale (rout)
-> 7 The Actinide Spire (seize) -> 8 The Last Row (boss, Ogden). The Static is a lonely call from the last
element on the table; the party answers it instead of silencing it.

## Moves and combat rules (`src/campaign/moves.js`, `combat.js`, `units.js`)
Every unit fights with its fighter's four real moves (`src/data/movesets.js`), shown in the action menu with an info card:
| slot | campaign action |
|---|---|
| basicDirectional | **Basic** attack, no cooldown, also the counterattack |
| basicCharge | **Charge**: takes the whole turn (a CHARGING tag shows), next turn it can **Release** at full-charge damage, or **Cancel Charge** and act normally. A zero-damage buff here becomes **Power Up** (+35% damage, 2 attacks, cooldown 3) |
| specialDirectional | **Special** attack, usable every other turn (cooldown 2) |
| specialDefense | **Guard**: no attack, the unit takes less damage until its next turn (shield/wall/block 50-60%, counter 35%) |

- **Damage** = the move's fighting-game damage % (defender-neutral, `resolveMoveDamage`) x `DAMAGE_SCALE` (2.4), capped at 60 per hit.
  The scale turns a 9% jab into ~22 HP so that 60-100 HP units fall in about 3-4 hits; change that one constant to retune everything.
  The element table still scales a move against the defender (0.6x-1.5x). On top: the unit's flat level bonus (+1 at every even level),
  minus the defender's Def (1-4) and terrain Def (0-3). Crit x2. A guarding defender takes less.
- **Range** by move kind: melee 1, long-reach melee / dash / zone 1-2, projectiles 1-2 (2 for heavy shells), beams 2-3.
- **HP** 60-100 (weight and kinetic defense), the lord +10; each level adds 3-5 HP. Older saves are rebuilt at their level when loaded (`upgradeRecord`).
- **Enemy AI** picks the best (tile, move, target); it also charges and releases, guards when wounded, and uses specials.
- **Balance check**: `node tools/campaign-balance.mjs [seeds]` plays the whole campaign with the autoplay AI (3 tries per chapter);
  the AI ignores terrain, guards and charges, so a real player does better. Enemy levels in the story data were tuned with it.

## Chapter data (`src/campaign/story/atomic-knockout.js`; adding your own story: `docs/campaign-story.md`)
`win`: `rout | seize | boss | defend | escape` (`seize: [x,y]`, `turns: N`, `exit: [[x,y],...]`).
`intro` / `outro`: lines `{ who: fighterId | null, text }` (`null` = narration).
`npcs`: neutral fighters a player unit can **Talk** to when adjacent (`with: id` restricts who) - they join the party.
`events`: `{ when, lines, spawn }` where `when` is one of
`{ start: true }`, `{ turn: n }`, `{ enemyTurn: n }`, `{ near: enemyId, dist }` (boss encounter), `{ death: enemyId }`.
`spawn` entries `{ id, level, x, y, team: 'player' | 'enemy', ai, boss }` arrive with a flash before the lines play.
Every id used in a chapter's lines/spawns/npcs is loaded before the chapter starts (`chapterSpeakers`).

## Files
- `src/campaign/*` pure logic (grid, terrain, combat, AI, battle state, progress); `tests/campaign.test.js`.
- `src/ui/campaignDialogue.js` the conversation player (used before/after battles and mid-battle).
- `src/scenes/CampaignScene.js` menu / story / summary; `src/scenes/CampaignBattleScene.js` the map.
- `src/campaign/sheetDims.js` (generated by `tools/scan-sheet-dims.mjs`) lets the loader repack oversized sheets before GPU upload.
- `tools/campaign-playtest.mjs` headless full-campaign playtest.
