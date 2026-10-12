# Atomic Knockout

A Smash-style party brawler where every character is a periodic table element.
Design doc lives in the Obsidian vault: `Projects/Atomic Knockout Build Instructions.md`.

## Run it

```
npm install
npm run dev
```

Then open the printed localhost URL (usually http://localhost:5173).

## Deploy

Netlify builds with `npm run build` and publishes `dist/` (`netlify.toml`).
That folder is the game the browser fetches: pages, source modules, fonts,
Phaser, and the art the roster actually points at. Review clips, source
renders, and backups stay out of the upload. PNGs are optimized losslessly
when `oxipng` is on PATH; the build still finishes without it. The sheets
themselves are about a gigabyte, so the upload stays full quality and does
not shrink to a few dozen megabytes.

`npm run dev` is still the local server. It is also the phone-controller
relay, which a static Netlify site does not include. Keyboard and gamepad
play from the published site.

## Controls (keyboard, 2 players)

| | Player 1 | Player 2 |
|---|---|---|
| Move | A / D | ← / → |
| Jump | W | ↑ |
| Attack | F | K |
| Special | G | L |
| Pause | Esc or P | Esc or P |

## Code map

- `src/data/characters.js` — the roster. **Adding a character = adding a data entry here.** Stats, palettes, body proportions, and moves (with heat/current/kinetic damage typing) all live in data.
- `src/engine/Rig.js` — code-drawn vector cartoon character rig (cutout parts + procedural animation, palette-swappable).
- `src/engine/Fighter.js` — one combatant: movement, jumps, attacks, percent/knockback, stocks. Character-agnostic.
- `src/scenes/BattleScene.js` — the fight: stage, hit resolution, projectiles, blast zones, HUD, win check.
- `src/scenes/` — menus and flow (title, character select, results, pause).

## Damage model

Smash-style: percent rises as you take hits, knockback scales with percent,
you lose a stock by crossing a blast zone off-screen. Per-type defense
(heat / current / kinetic) reduces incoming damage 5% per point.
