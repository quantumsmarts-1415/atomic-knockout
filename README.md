# Atomic Knockout

A Smash-style party brawler where every character is a periodic table element.
Design doc lives in the Obsidian vault: `Projects/Atomic Knockout Build Instructions.md`.

## Play (desktop — customer experience)

The real product is a **Windows desktop app**: official icon on the desktop,
double-click, play in its own window (no browser).

```bash
npm install
npm run build:game
npm run desktop          # Electron window using game-dist/ or the repo
npm run dist:win         # Windows installer + portable → site/downloads/
```

- Installer: creates a Start Menu + **Desktop shortcut** with the cover-art icon
- Portable: single `.exe` you can run without installing
- Phone controllers still work from the desktop app over local Wi‑Fi

## Public website (Netlify + Google Drive)

The Netlify site is a **lightweight download page**, not the in-browser game.
For v0.1, host the ~1.5 GB Windows installer on **Google Drive** — much easier
than uploading the binary through Netlify.

```bash
npm run dist:win
# Upload release/AtomicKnockout-Setup-*.exe to Google Drive
# Share: Anyone with the link → Viewer
npm run download:url -- "https://drive.google.com/file/d/FILE_ID/view?usp=sharing" --mb=1581.6
npm run build            # tiny dist/ landing page for Netlify
```

- Build command: `npm run build`
- Publish directory: `dist`
- Publish from the Netlify UI by hand. Leave automatic deploys, deploy
  previews, and branch deploys off.
- Optional: `npm run dist:win -- --publish-local` copies the .exe into
  `site/downloads/` if you later want Netlify to host the binary itself.

## Windows trust (Smart App Control / SmartScreen)

Unsigned builds are blocked or warned on locked-down Windows (Smart App
Control, SmartScreen “unknown publisher”). That is expected until the
installer is **Authenticode-signed** with an organization (OV) or extended
validation (EV) code-signing certificate from a public CA (DigiCert,
Sectigo, SSL.com, etc.). A self-signed cert does **not** help.

When you have a `.pfx` (or cloud HSM / Azure Trusted Signing):

```bash
export CSC_LINK="/path/to/QuantumSmarts.pfx"   # or WIN_CSC_LINK
export CSC_KEY_PASSWORD="…"                    # if the PFX is encrypted
npm run dist:win
```

`tools/package-desktop.mjs` enables signing automatically when `CSC_LINK`
or `WIN_CSC_LINK` is set; otherwise it builds unsigned for local testing.

## Dev (browser)

```bash
npm install
npm run dev
```

Then open the printed localhost URL (usually http://localhost:5173).

`npm run build:game` still packages the playable asset set into `game-dist/`
for the desktop app (about a gigabyte of sheets). Review clips, source
renders, and backups stay out. PNGs are optimized losslessly when `oxipng`
is on PATH.

## Branding

Official cover art lives in `branding/cover.jpg`. Rebuild icons after replacing it:

```bash
npm run branding:icons
```

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
- `desktop/` — Electron shell (native window, no browser chrome).
- `site/` — customer download landing page for Netlify.

## Damage model

Smash-style: percent rises as you take hits, knockback scales with percent,
you lose a stock by crossing a blast zone off-screen. Per-type defense
(heat / current / kinetic) reduces incoming damage 5% per point.
