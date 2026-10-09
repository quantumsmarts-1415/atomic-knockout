# Adding a fighter

One command turns a character folder into sheets, a select-screen portrait, and a roster entry. Stats come from a small JSON file. Moves, when the element has a kit, go in `src/data/movesets.js` and replace the placeholder the importer leaves behind.

```bash
node tools/import-fighter.js path/to/sprites/tara \
  --portrait path/to/portraits/tara-cut.png \
  --meta fighters/tara.json
```

The portrait and the meta file are optional on the command line when they sit in the usual places: `../portraits/<id>-cut.png` next to the sprite folder, and `fighters/<id>.json` in this repo. For a folder named `tara` that is already laid out that way:

```bash
node tools/import-fighter.js path/to/sprites/tara
```

Re-running the command replaces that fighter's sheets and layout numbers. Move tuning in `movesets.js` is left alone. Drop in a new sprite folder and run it again when the art arrives.

A whole directory goes in one pass. A folder that is missing a strip, the manifest, or `fighters/<id>.json` is skipped and the missing pieces are printed:

```bash
node tools/import-all.js path/to/sprites --portraits path/to/portraits
```

Stats for a new element come from the character buildout doc. The draft is identity, element numbers, height, air jumps, and a starter palette. Moves stay hand-written in `movesets.js`. An existing `fighters/<id>.json` is kept unless `--force` is set.

```bash
node tools/draft-fighters.js --doc "Atomic Knockout - Character Buildout.md" --element Tantalum
node tools/draft-fighters.js --doc "Atomic Knockout - Character Buildout.md" --all
```

A tensile range uses the midpoint (tungsten 550–620 MPa is 585). A metal whose single hop is under 90px is drafted with `airJumps: 0`.

## Character folder

```
tara/
  idle.png
  walk.png
  attack.png
  manifest.json
```

`manifest.json`:

```json
{
  "frameW": 682,
  "frameH": 598,
  "footY": 0.97,
  "visibleH": 540,
  "clips": {
    "idle":   { "count": 6, "fps": 6,  "loop": true },
    "walk":   { "count": 6, "fps": 10, "loop": true },
    "attack": { "count": 6, "fps": 12, "loop": false }
  }
}
```

`idle.png`, `walk.png`, and `attack.png` are horizontal strips.

- If a strip is exactly `frameH` tall, the frame count is `width / frameW`. A walk manifest whose `count` does not match the strip is ignored.
- If the strip was exported at another size (the pilot walks are), the tool splits it on the transparent gaps between poses. The manifest count is only a fallback when the gaps are ambiguous.

A clip may set its own `frameW` / `frameH`. `footY` is a 0–1 fraction of the frame height and `visibleH` is the authored body height; both are hints. The importer measures the head-to-feet body the same way the rest of the roster does (`src/engine/bodyLayout.js`) and stores `footY`, `bodyH`, `visibleH`, and `displayScale` so every clip draws at `height` pixels. `displayScale * bodyH` equals that height for idle, walk, and attack.

Walk sheets are often a shorter canvas than idle. The importer compares the measured body (ink width over body height), not the canvas size, and stretches the walk on Y until that proportion matches idle. Attack frames get a wide transparent margin so a sword or hammer drawn to the cell edge does not sit on the frame. Every clip gets a few extra pixels under the soles so the shoe is not the last texel.

Sheets are downscaled until the body is that in-game height (the same 118–148px band the original fighters use on screen), then packed into a grid the way `tools/build-sheet.js` does. Phaser loads them from `art-src/imported/sheets/<id>_<clip>.png`. The portrait is written to `art-src/imported/<id>-cut.png` and shown on the periodic-table select screen.

The registry is `src/data/imported-roster.json`, mirrored into `src/data/imported.js`. `src/data/characters.js` merges it and runs the same stat derivation as the original 24.

## Meta file

`fighters/<id>.json` is the element. Numbers use the same units as `src/data/elements.js`: density in g/cm³, Mohs hardness, tensile strength in MPa, boiling point in kelvin, conductivity in MS/m, Pauling electronegativity. A range in the design doc uses the midpoint (tungsten 550–620 MPa is 585).

```json
{
  "name": "Tara",
  "element": "Tantalum",
  "symbol": "Ta",
  "atomicNumber": 73,
  "tagline": "The capacitor that holds the charge.",
  "teach": "One sentence for the results screen.",
  "height": 130,
  "facing": 1,
  "airJumps": 0,
  "elementData": {
    "state": "solid",
    "family": "transition",
    "metal": true,
    "noble": false,
    "density": 16.678,
    "mohs": 6.5,
    "tensile": 200,
    "boiling": 5731,
    "conductivity": 7.7,
    "en": 1.5
  },
  "palettes": [
    { "name": "Capacitor", "skin": 15721958, "body": 5330272, "accent": 4243647, "eye": 16766771 }
  ]
}
```

`facing` is the direction the art already faces (`1` right, `-1` left). The rig flips a left-facing sheet so the fighter still starts facing right. `height` is the on-screen body in pixels. Palette channels are hex written as decimal (`0xRRGGBB`).

Density, hardness, tensile strength, boiling point, and conductivity become speed, weight, and the kinetic / heat / electrical / radiation modifiers through `src/data/balance.js`. Do not hand-tune those. `airJumps` stays a per-character choice. A metal this dense hops about 70px, which is enough for the solid steps when it stays on the ground. Give it `airJumps: 0`, the same as Vanadium. An air jump on that hop cannot clear the painted-stage gaps, and the stage tests treat anyone with an air jump as someone who must.

## Moves

Add a four-move kit to `src/data/movesets.js`, keyed by the fighter id. The slots match the rest of the roster:

| Slot | Input |
| --- | --- |
| `basicCharge` | hold normal, no direction |
| `basicDirectional` | normal + a direction |
| `specialDefense` | hold special, no direction |
| `specialDirectional` | special + a direction |

Reuse the kinds that already exist (`melee`, `dash`, `burst`, `projectile`, `beam`, `buff`, `block`, `counter`, `wall`) and the effect flags (`onHit.root`, `onHit.drift`, `pull`, `immune`, `breaksBlock`, `pierce`, `bonusVsId`, `bonusVsState`, `vsHot`, `heatEmpower`, `recoil`, `igniteGases`). A move with no strip of its own plays the attack clip under the usual effect graphics.

After the kit is in, `npm test` checks that every fighter still has four named moves and that idle, walk, and attack all draw at `art.height`.

## Select screen

The table is the real periodic table: 18 columns, periods 1–7, lanthanides and actinides on the two rows below. Locked cells stay on the chart so the roster can grow to 118 without another layout change. Keyboard, gamepad-style arrow keys, and the phone controller all send left / right / up / down; the cursor steps to the next element in that direction and the table scrolls to keep it on screen. Confirm is the attack button. Back is the special button. Left and right on the color step still change palette.
