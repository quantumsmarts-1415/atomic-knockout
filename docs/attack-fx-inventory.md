# Attack effect inventory

Every move on the 118-fighter roster puts something on screen besides the idle body. This list is that something: the shot, the throw, the beam, the extender, the burst, the slash, or the shield.

There are **472** effects. Scores were given by looking at a capture of each drawing family. Moves that share a family are the same picture in a different color or size, so they share that score.

## Counts

- By type: shield: 118, area or burst: 112, slash arc: 109, projectile: 71, beam: 32, thrown: 19, extend: 11
- By how they are drawn: code-drawn shape: 281, procedural particles: 98, sprite art: 93
- By score: 1: 337, 3: 93, 2: 42
- By family: bubble: 108, particles: 98, sheet-slash: 83, star: 83, beam: 32, slash: 27, sheet-extend: 10, gust-lines: 8, ring: 6, zone: 6, column: 4, spear: 3, wave: 3, balloon: 1

## Scores

- **1** — a placeholder. A star, a flat bar, a circle, or a puff of the same sparks, with nothing of the named object in it.
- **2** — still code, but the shape is recognizable: a spear point, a balloon, a wind chevron, a gust of streaks, or a slash stroke.
- **3** — the swing is carried by the fighter’s attack sheet, which is real sprite art, with a code slash still drawn on top.
- **4** — a dedicated effect image that reads as the object.
- **5** — a dedicated animated effect image.

Nothing in the game is a 4 or a 5 yet. Those scores are what a dropped-in PNG is for.

## Drop-in art

Put a transparent PNG in the folder named in the spec. The game picks it up on the next match and stops drawing the code version for that move. The hit shape becomes the alpha of the image, packed on a 5 pixel grid, the same grid the body masks use. Pixels with alpha at or below 50% are empty. No file in the folder means the old drawing and the old hit stay.

Beams and extenders prefer three files: `cap-start.png`, `tile.png`, and `cap-end.png`. The tile repeats along the length. A lone `object.png` is used when those three are absent. Every other type uses `object.png`. `frame-0.png` through `frame-7.png` replace the still image and play at 8 frames a second.

Art points right. A projectile or a burst pivots at its center. A slash or an extender pivots at the left center, which stays on the hand while the image aims outward. Beam caps pivot at the seam: start and tile on the left center, end cap on the right center.

The folder list is served at `/fx-index`. The loader only fetches files that are actually there.

## Worst 30

These are the lowest scores, and among the placeholders the largest on screen. The contact sheet is `docs/attack-fx-worst30.png`.

| # | Fighter | Move | Type | On screen | Score |
| --- | --- | --- | --- | --- | --- |
| 1 | Fermi | Fermi Paradox | area or burst | 920×920 | 1 |
| 2 | Lillie | Water Reaction | area or burst | 220×220 | 1 |
| 3 | Oxana | Oxidation Burst | area or burst | 216×216 | 1 |
| 4 | Neo | Neon Flare | area or burst | 204×204 | 1 |
| 5 | Allen | Turbine Vortex | area or burst | 200×200 | 1 |
| 6 | Nitra | Cryo Vortex | area or burst | 192×192 | 1 |
| 7 | Sully | Volcanic Eruption | area or burst | 192×192 | 1 |
| 8 | Liv | 192 Beams | area or burst | 184×184 | 1 |
| 9 | Aaron | Noble Discharge | area or burst | 176×176 | 1 |
| 10 | Bord | Ground Shatter | area or burst | 176×176 | 1 |
| 11 | Natalie | Brine Burst | area or burst | 176×176 | 1 |
| 12 | Pit | Catalyst Ignition | area or burst | 176×176 | 1 |
| 13 | Scarlett | Aerial Dive | area or burst | 176×176 | 1 |
| 14 | Kyle | Nerve Shock | area or burst | 172×172 | 1 |
| 15 | Maggie | Blinding Flare | area or burst | 172×172 | 1 |
| 16 | Cal | Marrow Burst | area or burst | 168×168 | 1 |
| 17 | Flo | Island of Stability | area or burst | 168×168 | 1 |
| 18 | Carter | Graphene Wave | area or burst | 164×164 | 1 |
| 19 | Van | Prism Surge | area or burst | 164×164 | 1 |
| 20 | Chroma | Prismatic Shatter | area or burst | 160×160 | 1 |
| 21 | Fermi | Chicago Pile | area or burst | 160×160 | 1 |
| 22 | Niko | Rising Sun | area or burst | 160×160 | 1 |
| 23 | Silas | Binary Surge | area or burst | 160×160 | 1 |
| 24 | Copernicus | Revolution | area or burst | 156×156 | 1 |
| 25 | Goldie | MRI Contrast | area or burst | 156×156 | 1 |
| 26 | Phillip | Spontaneous Ignition | area or burst | 156×156 | 1 |
| 27 | Tate | Self-Vaporize | area or burst | 156×156 | 1 |
| 28 | Einstein | Mass-Energy | area or burst | 148×148 | 1 |
| 29 | Indy | Invisible Film | area or burst | 148×148 | 1 |
| 30 | Brock | Bromos Stench | area or burst | 144×144 | 1 |

## Every effect

| Fighter | Move | Type | Drawn | Size | Rotation | Animation | Score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hydra | Supernova | area or burst | procedural particles: tinted star and streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Hydra | Flame Dash | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Hydra | Fire Wall | shield | code-drawn shape: vertical rectangle | 18×110 | no rotation | fades over about 360 ms | 1 |
| Hydra | Hydrogen Bomb | thrown | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Helen | Balloon Bop | projectile | code-drawn shape: ellipse with a highlight | 48×59 | no rotation | flies in a straight line, one still shape | 2 |
| Helen | Noble Gust | slash arc | code-drawn shape: thick slash stroke | 82×50 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Helen | Bubble Shield | shield | code-drawn shape: translucent circle | 76×76 | no rotation | fades over about 500 ms | 1 |
| Helen | Air Wave | projectile | code-drawn shape: chevron stroke | 79×32 | no rotation | flies in a straight line, one still shape | 2 |
| Titan | Titanium Ram | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Titan | Lance Jab | extend | code-drawn shape: thick slash stroke | 84×36 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Titan | Aerospace Plating | shield | code-drawn shape: translucent circle | 91×91 | no rotation | fades over about 500 ms | 1 |
| Titan | Aero Lance | projectile | code-drawn shape: spearhead polygon | 22×14 | rotated to face left or right | flies in a straight line, one still shape | 2 |
| Lillie | Volt Dash | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Lillie | Spark Jab | slash arc | code-drawn shape: thick slash stroke | 88×44 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Lillie | Reactive Armor | shield | code-drawn shape: thin ring | 70×70 | no rotation | fades over about 500 ms | 1 |
| Lillie | Water Reaction | area or burst | procedural particles: tinted star and streaks | 220×220 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ben | Resonant Strike | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Ben | Precision Strike | slash arc | code-drawn shape: thick slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Ben | Rigid Stance | shield | code-drawn shape: translucent circle | 80×80 | no rotation | fades over about 500 ms | 1 |
| Ben | Gyro Disc | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Bord | Heavy Ram | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Bord | Crystal Smash | slash arc | code-drawn shape: thick slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Bord | Boron Carbide Wall | shield | code-drawn shape: vertical rectangle | 18×100 | no rotation | fades over about 360 ms | 1 |
| Bord | Ground Shatter | area or burst | procedural particles: tinted star and streaks | 176×176 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Carter | Diamond Shard | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Carter | Diamond Cross | slash arc | code-drawn shape: thick slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Carter | Diamond Plating | shield | code-drawn shape: translucent circle | 82×82 | no rotation | fades over about 500 ms | 1 |
| Carter | Graphene Wave | area or burst | procedural particles: tinted star and streaks | 164×164 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Nitra | Nitrogen Rush | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Nitra | Frost Fang | slash arc | code-drawn shape: thick slash stroke | 84×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Nitra | Inert Shield | shield | code-drawn shape: translucent circle | 72×72 | no rotation | fades over about 500 ms | 1 |
| Nitra | Cryo Vortex | area or burst | procedural particles: tinted star and streaks | 192×192 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Oxana | Bellows Breath | projectile | code-drawn shape: chevron stroke | 70×29 | no rotation | flies in a straight line, one still shape | 2 |
| Oxana | Vortex Kick | slash arc | code-drawn shape: thick slash stroke | 88×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Oxana | Ozone Layer | shield | code-drawn shape: translucent circle | 70×70 | no rotation | fades over about 500 ms | 1 |
| Oxana | Oxidation Burst | area or burst | procedural particles: tinted star and streaks | 216×216 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Flora | Pale Yellow Jet | projectile | code-drawn shape: four-point star | 41×41 | no rotation | flies in a straight line, one still shape | 1 |
| Flora | Etching Jab | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Flora | Teflon Coat | shield | code-drawn shape: translucent circle | 70×70 | no rotation | fades over about 500 ms | 1 |
| Flora | Radical Cascade | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Neo | High-Voltage Tube | beam | code-drawn shape: flat rectangle | 150×22 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Neo | Staff Crack | slash arc | code-drawn shape: thick slash stroke | 94×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Neo | No Vacancy | shield | code-drawn shape: translucent circle | 72×72 | no rotation | fades over about 500 ms | 1 |
| Neo | Neon Flare | area or burst | procedural particles: tinted star and streaks | 204×204 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Natalie | Lake Drop | area or burst | procedural particles: tinted star and streaks | 120×120 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Natalie | Flame Fist | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Natalie | Oil Bath | shield | code-drawn shape: translucent circle | 70×70 | no rotation | fades over about 500 ms | 1 |
| Natalie | Brine Burst | area or burst | procedural particles: tinted star and streaks | 176×176 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Maggie | Unquenchable | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Maggie | Flare Jab | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Maggie | Ribbon Guard | shield | code-drawn shape: translucent circle | 67×67 | no rotation | fades over about 500 ms | 1 |
| Maggie | Blinding Flare | area or burst | procedural particles: tinted star and streaks | 172×172 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Allen | Thermite Burn | beam | code-drawn shape: flat rectangle | 130×26 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Allen | Turbine Strike | slash arc | code-drawn shape: thick slash stroke | 90×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Allen | Oxide Skin | shield | code-drawn shape: translucent circle | 72×72 | no rotation | fades over about 500 ms | 1 |
| Allen | Turbine Vortex | area or burst | procedural particles: tinted star and streaks | 200×200 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Silas | Overclock | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Silas | Crystal Blade | slash arc | code-drawn shape: thick slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Silas | Silica Pane | shield | code-drawn shape: translucent circle | 72×72 | no rotation | fades over about 500 ms | 1 |
| Silas | Binary Surge | area or burst | procedural particles: tinted star and streaks | 160×160 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Phillip | Strike Anywhere | area or burst | procedural particles: tinted star and streaks | 104×104 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Phillip | Glow Strike | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Phillip | Red Phosphorus Form | shield | code-drawn shape: translucent circle | 72×72 | no rotation | fades over about 500 ms | 1 |
| Phillip | Spontaneous Ignition | area or burst | procedural particles: tinted star and streaks | 156×156 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Sully | Black Powder | area or burst | procedural particles: tinted star and streaks | 108×108 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Sully | Brimstone Slam | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Sully | Vulcanized Rubber | shield | code-drawn shape: translucent circle | 95×95 | no rotation | fades over about 500 ms | 1 |
| Sully | Volcanic Eruption | area or burst | procedural particles: tinted star and streaks | 192×192 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Chloe | Bleach Out | projectile | code-drawn shape: four-point star | 46×46 | no rotation | flies in a straight line, one still shape | 1 |
| Chloe | Toxic Jab | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Chloe | Salt Bond | shield | code-drawn shape: translucent circle | 67×67 | no rotation | fades over about 500 ms | 1 |
| Chloe | Gas Cloud | area or burst | code-drawn shape: filled circle | 128×128 | no rotation | lingers about 2000 ms | 1 |
| Aaron | Lazy Haymaker | slash arc | code-drawn shape: thick slash stroke | 78×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Aaron | Inert Guard Strike | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Aaron | Shield Gas | shield | code-drawn shape: translucent circle | 76×76 | no rotation | fades over about 500 ms | 1 |
| Aaron | Noble Discharge | area or burst | procedural particles: tinted star and streaks | 176×176 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Kyle | Action Potential | projectile | code-drawn shape: four-point star | 41×41 | no rotation | flies in a straight line, one still shape | 1 |
| Kyle | Static Cross | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Kyle | Ion Channel | shield | code-drawn shape: thin ring | 74×74 | no rotation | fades over about 500 ms | 1 |
| Kyle | Nerve Shock | area or burst | procedural particles: tinted star and streaks | 172×172 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Cal | Calcify | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Cal | Bone Crush | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Cal | Quick-Set Cement | shield | code-drawn shape: vertical rectangle | 18×96 | no rotation | fades over about 360 ms | 1 |
| Cal | Marrow Burst | area or burst | procedural particles: tinted star and streaks | 168×168 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Scarlett | Afterburner | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Scarlett | Wing Slash | slash arc | code-drawn shape: thick slash stroke | 100×72 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Scarlett | Folded Wings | shield | code-drawn shape: translucent circle | 68×68 | no rotation | fades over about 500 ms | 1 |
| Scarlett | Aerial Dive | area or burst | procedural particles: tinted star and streaks | 176×176 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Van | Redox Flow | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Van | Alloy Fist | slash arc | code-drawn shape: thick slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Van | Four-State Guard | shield | code-drawn shape: thin ring | 91×91 | no rotation | fades over about 500 ms | 1 |
| Van | Prism Surge | area or burst | procedural particles: tinted star and streaks | 164×164 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Chroma | Ruby Laser | beam | code-drawn shape: flat rectangle | 160×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Chroma | Chrome Edge | slash arc | code-drawn shape: thick slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | the idle body during the swing; the stroke grows across the active frames | 2 |
| Chroma | Mirror Chrome | shield | code-drawn shape: translucent circle | 68×68 | no rotation | fades over about 500 ms | 1 |
| Chroma | Prismatic Shatter | area or burst | procedural particles: tinted star and streaks | 160×160 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ace | Actinic Ray | beam | code-drawn shape: flat rectangle | 138×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Ace | Ace of Rays | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Ace | Wild Card | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ace | Royal Flush | projectile | code-drawn shape: four-point star | 17×17 | no rotation | flies in a straight line, one still shape | 1 |
| Agatha | Silver Bullet | projectile | code-drawn shape: four-point star | 17×17 | no rotation | flies in a straight line, one still shape | 1 |
| Agatha | Silver Lining | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 86×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Agatha | Photo Negative | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Agatha | Darkroom Print | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Amy | Alarm Blare | area or burst | code-drawn shape: four short streaks | 172×172 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Amy | Test Button | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Amy | Ion Chamber | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Amy | Chirping Detector | area or burst | code-drawn shape: filled circle | 112×112 | no rotation | lingers about 2800 ms | 1 |
| Arsenio | Inheritance Powder | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Arsenio | Paris Green Slash | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 80×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Arsenio | Sublimate | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Arsenio | Green Wallpaper | area or burst | code-drawn shape: filled circle | 132×132 | no rotation | lingers about 1800 ms | 1 |
| Aurelius | Midas Touch | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 56×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Aurelius | Gold Leaf Sweep | extend | sprite art: attack sheet plus a code-drawn slash stroke | 120×34 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Aurelius | Golden Visor | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Aurelius | Ingot Lob | thrown | code-drawn shape: four-point star | 41×41 | no rotation | flies in a straight line, one still shape | 1 |
| Barry | Heavyweight Drop | area or burst | procedural particles: tinted star and streaks | 108×108 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Barry | Mud Weight | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Barry | Barium Meal | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Barry | Poison Pellet | thrown | code-drawn shape: four-point star | 23×23 | no rotation | slides along the ground, one still shape | 1 |
| Bianca | Hopper Crystal | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Bianca | Staircase Kick | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×56 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Bianca | Diamagnetic Repel | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Bianca | Pink Bismuth | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Boar | Quantum Leap | area or burst | procedural particles: tinted star and streaks | 116×116 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Boar | Shell Gore | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Boar | Complementarity | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Boar | Spectral Line | beam | code-drawn shape: flat rectangle | 300×8 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Brock | Bromos Stench | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Brock | Caustic Splash | projectile | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Brock | Red Fume Screen | shield | code-drawn shape: thin ring | 86×86 | no rotation | fades over about 500 ms | 1 |
| Brock | Tyrian Purple | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Burke | Bombarded Target | area or burst | procedural particles: tinted star and streaks | 140×140 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Burke | Golden Bear Swipe | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 82×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Burke | Hot Cell | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Burke | Express Shipment | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Caesar | Defining Second | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Caesar | Rubicon Dash | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Caesar | Electron Tribute | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Caesar | Fallout Coin | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Cali | Neutron Kickstart | area or burst | procedural particles: tinted star and streaks | 136×136 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Cali | Surf's Up | area or burst | code-drawn shape: four short streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Cali | Stunt Double | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Cali | Prospecting Probe | beam | code-drawn shape: flat rectangle | 200×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Ceres | Ferro Rod Sparks | beam | code-drawn shape: flat rectangle | 128×26 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Ceres | Ceria Polish | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Ceres | Self-Cleaning | shield | code-drawn shape: thin ring | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ceres | Dwarf Planet | thrown | code-drawn shape: four-point star | 46×46 | no rotation | slides along the ground, one still shape | 1 |
| Cody | Quantum Dot | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Cody | Battery Prod | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Cody | Control Rod | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Cody | Yellow Paint Bomb | thrown | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Collin | Gamma Knife | beam | code-drawn shape: flat rectangle | 146×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Collin | Kobold Strike | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Collin | Superalloy Shell | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Collin | Blue Glaze | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Cooper | Electromagnet | area or burst | procedural particles: tinted star and streaks | 132×132 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Cooper | Live Wire | extend | sprite art: attack sheet plus a code-drawn slash stroke | 116×28 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Cooper | Grounding Rod | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Cooper | Verdigris Spray | projectile | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Copernicus | Heliocentric | area or burst | code-drawn shape: four short streaks | 240×240 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Copernicus | Revolution | area or burst | procedural particles: tinted star and streaks | 156×156 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Copernicus | Evaporate | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Copernicus | Orrery Shot | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Curie | Double Nobel | area or burst | procedural particles: tinted star and streaks | 116×116 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Curie | Pocket Vial | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Curie | Spectrometer Scan | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Curie | Pitchblende Toss | thrown | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Dash | Triple Dash | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Dash | Blink Kick | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Dash | Afterimage Decay | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Dash | Darmstadt Dart | projectile | code-drawn shape: four-point star | 12×12 | no rotation | flies in a straight line, one still shape | 1 |
| Dizzy | Hard to Get | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Dizzy | Dizzy Spin | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Dizzy | Spin Deflect | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Dizzy | Vertigo Wave | projectile | code-drawn shape: chevron stroke | 31×13 | no rotation | flies in a straight line, one still shape | 2 |
| Duke | Long Reign | area or burst | procedural particles: tinted star and streaks | 124×124 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Duke | Ducal Cleave | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 96×56 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Duke | Fission Split | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Duke | Heavy Ion Bolt | projectile | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Einstein | Mass-Energy | area or burst | procedural particles: tinted star and streaks | 148×148 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Einstein | Time Dilation | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Einstein | Thought Experiment | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Einstein | Fallout Rain | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Erin | Undersea Cable | beam | code-drawn shape: flat rectangle | 156×14 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Erin | Pink Glass Swipe | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Erin | Signal Repeater | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Erin | Resurface Laser | beam | code-drawn shape: flat rectangle | 136×12 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Europa | Phosphor Bloom | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Europa | Counterfeit Check | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Europa | Ice Moon Shell | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Europa | Banknote Star | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Fermi | Chicago Pile | area or burst | procedural particles: tinted star and streaks | 160×160 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Fermi | Slow Neutron Punch | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Fermi | Exclusion Zone | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Fermi | Fermi Paradox | area or burst | procedural particles: tinted star and streaks | 920×920 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Fey | Forge Hammer | area or burst | procedural particles: tinted star and streaks | 108×108 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Fey | Cold Iron Cut | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 78×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Fey | Lodestone Guard | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Fey | Rust Bloom | projectile | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Flo | Island of Stability | area or burst | procedural particles: tinted star and streaks | 168×168 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Flo | Riptide | area or burst | code-drawn shape: four short streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Flo | Identity Crisis | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Flo | Magic Number | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Ford | Dense Nucleus | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 78×52 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Ford | Backscatter | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Ford | Gold Foil | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ford | Transmute Ray | beam | code-drawn shape: flat rectangle | 240×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Frank | Beta Turn | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Frank | Vanishing Jab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×40 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Frank | Trace Amount | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Frank | Alpha Flick | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Gail | Superconductor Arc | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Gail | Embrittle | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 62×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Gail | Body-Heat Melt | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Gail | Blue LED | beam | code-drawn shape: flat rectangle | 148×12 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Gertrude | Mendeleev's Prediction | area or burst | procedural particles: tinted star and streaks | 92×92 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Gertrude | Point Contact | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 62×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Gertrude | Thermal Lens | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Gertrude | Crystal Radio Wave | projectile | code-drawn shape: four-point star | 26×26 | no rotation | flies in a straight line, one still shape | 1 |
| Goldie | MRI Contrast | area or burst | procedural particles: tinted star and streaks | 156×156 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Goldie | Magnetocaloric Palm | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 66×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Goldie | Magnetic Chill | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Goldie | Room-Temp Magnet | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 88×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Haley | Plasma Cutter | beam | code-drawn shape: flat rectangle | 132×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Haley | Carbide Kick | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Haley | High-K Gate | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Haley | Neutron Sink | projectile | code-drawn shape: four-point star | 32×32 | no rotation | flies in a straight line, one still shape | 1 |
| Hog | Puddle Rise | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×64 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Hog | Quicksilver Lash | extend | sprite art: attack sheet plus a code-drawn slash stroke | 124×28 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Hog | Amalgamate | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Hog | Hatter's Fume | area or burst | code-drawn shape: filled circle | 140×140 | no rotation | lingers about 1500 ms | 1 |
| Holly | Stone Breaker | beam | code-drawn shape: flat rectangle | 136×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Holly | Calibration Strike | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Holly | Bend Don't Break | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Holly | Pole Piece | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Hoss | Stampede | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Hoss | Iron Hoof | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 78×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Hoss | Doubly Magic | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Hoss | Lucky Horseshoe | thrown | code-drawn shape: four-point star | 35×35 | no rotation | slides along the ground, one still shape | 1 |
| Indy | Invisible Film | area or burst | code-drawn shape: filled circle | 148×148 | no rotation | lingers about 1900 ms | 1 |
| Indy | Sticky Seal | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 66×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Indy | Putty Guard | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Indy | Solder Whip | extend | sprite art: attack sheet plus a code-drawn slash stroke | 128×32 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Iona | Violet Vapor | projectile | code-drawn shape: four-point star | 52×52 | no rotation | flies in a straight line, one still shape | 1 |
| Iona | Tincture Swab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Iona | Iodide Shield | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Iona | Touch Powder | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Ira | Extinction Layer | area or burst | procedural particles: tinted star and streaks | 104×104 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ira | Spark Plug | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Ira | Prototype Kilogram | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ira | Iris Scatter | projectile | code-drawn shape: four-point star | 20×20 | no rotation | flies in a straight line, one still shape | 1 |
| Krypto | Excimer Laser | beam | code-drawn shape: flat rectangle | 108×12 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Krypto | Super Pounce | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Krypto | Flash Tube Counter | shield | code-drawn shape: thin ring | 86×86 | no rotation | fades over about 500 ms | 1 |
| Krypto | Meter Line | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Lana | Regenerative Charge | area or burst | procedural particles: tinted star and streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Lana | Hidden Strike | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Lana | Lens Bend | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Lana | Cracking Catalyst | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Lars | Cyclotron Beam | beam | code-drawn shape: flat rectangle | 220×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Lars | Spiral Fist | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Lars | Dee Plates | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Lars | Atom Smasher | projectile | code-drawn shape: four-point star | 26×26 | no rotation | flies in a straight line, one still shape | 1 |
| Liv | 192 Beams | area or burst | procedural particles: tinted star and streaks | 184×184 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Liv | Chalcogen Hook | extend | sprite art: attack sheet plus a code-drawn slash stroke | 78×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Liv | Hohlraum | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Liv | Last Instant | projectile | code-drawn shape: four-point star | 17×17 | no rotation | flies in a straight line, one still shape | 1 |
| Lucy | City of Light | area or burst | procedural particles: tinted star and streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Lucy | Final Lanthanide | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Lucy | Scintillator | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Lucy | Annihilation Pair | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Mac | Decay Cascade | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Mac | Red Hammer | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 88×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Mac | Nesting Doll | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Mac | Short Fuse | thrown | code-drawn shape: four-point star | 35×35 | no rotation | arcs through the air, one still shape | 1 |
| Mae | Liquid Drop Split | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Mae | Overlooked | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Mae | Border Slip | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Mae | Neutron Splitter | projectile | code-drawn shape: four-point star | 20×20 | no rotation | flies in a straight line, one still shape | 1 |
| Manny | Permanganate Splash | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Manny | Rock Crusher | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Manny | Work Hardening | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Manny | Dry Cell Lob | thrown | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Mendel | Dream of the Table | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Mendel | One Atom at a Time | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Mendel | Empty Square | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Mendel | Group Drop | thrown | code-drawn shape: four-point star | 46×46 | no rotation | arcs through the air, one still shape | 1 |
| Molly | Red-Hot Rod | beam | code-drawn shape: flat rectangle | 140×18 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Molly | Grease Slide | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Molly | Dry Lube | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Molly | Nitrogenase | area or burst | code-drawn shape: filled circle | 112×112 | no rotation | lingers about 1100 ms | 1 |
| Nadia | Magnet Pull | area or burst | code-drawn shape: four short streaks | 140×140 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Nadia | Bass Drop Punch | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Nadia | Polarity Flip | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Nadia | Rotor Throw | thrown | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Neptune | Tidal Surge | area or burst | code-drawn shape: four short streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Neptune | Trident Thrust | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 86×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Neptune | Far Orbit | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Neptune | Breeder Seed | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Nick | Memory Snap | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Nick | Nickel and Dime | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Nick | Electroplate | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Nick | Meteorite Drop | thrown | code-drawn shape: four-point star | 35×35 | no rotation | slides along the ground, one still shape | 1 |
| Niko | Rising Sun | area or burst | procedural particles: tinted star and streaks | 160×160 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Niko | Three-Atom Combo | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Niko | Nine-Year Wait | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Niko | Zinc Ion Beam | beam | code-drawn shape: flat rectangle | 250×18 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Niobe | Particle Ring | beam | code-drawn shape: flat rectangle | 200×18 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Niobe | Anodized Edge | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Niobe | Weeping Stone | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Niobe | Magnet Quench | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Noble | Dynamite Stick | area or burst | procedural particles: tinted star and streaks | 120×120 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Noble | Medal Swing | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 92×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Noble | Peace Prize | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Noble | Blasting Cap | projectile | code-drawn shape: four-point star | 20×20 | no rotation | flies in a straight line, one still shape | 1 |
| Ogden | End of the Table | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ogden | Light-Speed Jab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Ogden | Broken Noble | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ogden | Millisecond Beam | beam | code-drawn shape: flat rectangle | 560×10 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Oz | Densest Slam | area or burst | procedural particles: tinted star and streaks | 108×108 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Oz | Nib Stab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 46×28 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Oz | Immovable Object | shield | code-drawn shape: translucent circle | 95×95 | no rotation | fades over about 500 ms | 1 |
| Oz | Tetroxide Puff | area or burst | procedural particles: tinted star and streaks | 136×136 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Pablo | Lead Balloon | area or burst | procedural particles: tinted star and streaks | 112×112 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Pablo | Lead Pipe | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Pablo | Lead Apron | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Pablo | Sinker Cast | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Pat | Proto Daughter | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Pat | Sediment Layer | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Pat | Deep Time Rewind | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Pat | Twin Hazard Bolt | projectile | code-drawn shape: four-point star | 26×26 | no rotation | flies in a straight line, one still shape | 1 |
| Paula | Cold Fusion | area or burst | procedural particles: tinted star and streaks | 136×136 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Paula | White Gold Jab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 66×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Paula | Hydrogen Sponge | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Paula | Fuel Cell Bolt | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Percy | Frozen Light | beam | code-drawn shape: flat rectangle | 220×18 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Percy | Green Twin Strike | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Percy | Welder's Goggles | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Percy | Green Glass Shard | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Pit | Catalyst Ignition | area or burst | procedural particles: tinted star and streaks | 176×176 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Pit | Record Scratch | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 78×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Pit | Cisplatin Clamp | shield | code-drawn shape: translucent circle | 84×84 | no rotation | fades over about 500 ms | 1 |
| Pit | Flame Test | projectile | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Pluto | Critical Mass | area or burst | procedural particles: tinted star and streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Pluto | Decay-Heat Palm | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Pluto | Demoted | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Pluto | Deep Space Probe | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Polonius | Blue Glow Burst | area or burst | procedural particles: tinted star and streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Polonius | Rapier Thrust | slash arc | code-drawn shape: thick slash stroke | 92×24 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 2 |
| Polonius | Behind the Arras | shield | code-drawn shape: vertical rectangle | 18×100 | no rotation | fades over about 360 ms | 1 |
| Polonius | Static Eliminator | slash arc | code-drawn shape: thick slash stroke | 100×36 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 2 |
| Prometheus | Stolen Fire | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Prometheus | Torchbearer Swing | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 80×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Prometheus | Chained to the Rock | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Prometheus | Beta Battery | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Ray | Radium Tonic | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ray | Alpha Uppercut | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 50×64 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Ray | Decay Halo | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ray | Luminous Splash | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Rex | High Octane | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Rex | King's Edge | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Rex | Creep Resistance | shield | code-drawn shape: translucent circle | 87×87 | no rotation | fades over about 500 ms | 1 |
| Rex | Thermocouple Lash | extend | sprite art: attack sheet plus a code-drawn slash stroke | 112×30 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Rhoda | Catalytic Converter | area or burst | procedural particles: tinted star and streaks | 104×104 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Rhoda | Rose Thorn | extend | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Rhoda | Tarnish Guard | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Rhoda | High Beam | beam | code-drawn shape: flat rectangle | 180×36 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Roger | X-Ray Vision | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Roger | Skeleton Flash | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Roger | Crookes Tube | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Roger | Penetrating Ray | beam | code-drawn shape: flat rectangle | 340×14 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Ronan | Ground Seep | area or burst | procedural particles: tinted star and streaks | 92×92 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ronan | Decay Daughters | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Ronan | Radon Spa | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ronan | Radon Creep | thrown | code-drawn shape: four-point star | 35×35 | no rotation | slides along the ground, one still shape | 1 |
| Ruben | Condensate Collapse | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Ruben | Molten Palm | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Ruben | Laser Cooling | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ruben | Violet Ember | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Ruth | Sunlight Dye | beam | code-drawn shape: flat rectangle | 180×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Ruth | Hardener Hook | extend | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 4 body frames during the swing; the stroke grows across the active frames | 3 |
| Ruth | Metathesis Swap | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Ruth | Grubbs Catalyst | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Saab | Printing Press | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 80×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Saab | Kohl Swipe | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Saab | Flame Retardant | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Saab | Stibnite Needles | projectile | code-drawn shape: four-point star | 15×15 | no rotation | flies in a straight line, one still shape | 1 |
| Sam | Heatproof Magnet | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Sam | Samarskite Smash | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Sam | Mine Shaft Duck | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Sam | Pickaxe Toss | thrown | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Sandy | Tin Cry | area or burst | code-drawn shape: four short streaks | 140×140 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Sandy | Organ Pipe Swing | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 86×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Sandy | Tin Pest | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Sandy | Tin Can Kick | thrown | code-drawn shape: four-point star | 29×29 | no rotation | slides along the ground, one still shape | 1 |
| Sarge | Sound Off | area or burst | procedural particles: tinted star and streaks | 96×96 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Sarge | Six-Count Flurry | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 78×52 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Sarge | Periodic Shield | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Sarge | Decay Mortar | thrown | code-drawn shape: four-point star | 32×32 | no rotation | arcs through the air, one still shape | 1 |
| Selena | Photoconductor | beam | code-drawn shape: flat rectangle | 210×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Selena | Crescent Kick | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Selena | Photocopy | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Selena | Moonbeam | beam | code-drawn shape: flat rectangle | 160×18 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Sterling | Bone Seeker | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Sterling | Night-Glow Hook | extend | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Sterling | Road Flare | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Sterling | Crimson Rocket | projectile | code-drawn shape: four-point star | 26×26 | no rotation | flies in a straight line, one still shape | 1 |
| Talia | Poisoner's Poison | area or burst | procedural particles: tinted star and streaks | 124×124 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Talia | Green Line Stab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 58×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Talia | Prussian Blue | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Talia | Pale Horse Dart | projectile | code-drawn shape: four-point star | 17×17 | no rotation | flies in a straight line, one still shape | 1 |
| Tara | Capacitor Dump | beam | code-drawn shape: flat rectangle | 148×24 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Tara | Tantalizing Hook | extend | sprite art: attack sheet plus a code-drawn slash stroke | 92×42 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Tara | Tantalus Guard | shield | code-drawn shape: translucent circle | 84×84 | no rotation | fades over about 500 ms | 1 |
| Tara | Implant Pin | projectile | code-drawn shape: spearhead polygon | 15×10 | rotated to face left or right | flies in a straight line, one still shape | 2 |
| Tate | Self-Vaporize | area or burst | procedural particles: tinted star and streaks | 156×156 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Tate | Targeted Alpha | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 52×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Tate | Never Seen | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Tate | Unstable Bolt | projectile | code-drawn shape: four-point star | 26×26 | no rotation | flies in a straight line, one still shape | 1 |
| Terra | Sonar Pulse | beam | code-drawn shape: flat rectangle | 520×16 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Terra | Flex Punch | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 76×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Terra | Floor Speaker | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Terra | Green Phosphor Bolt | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Tess | Electron Hunger | area or burst | code-drawn shape: four short streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 2 |
| Tess | Last Halogen | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×48 | the stroke sweeps from about -60° to +26° | 7 body frames during the swing; the stroke grows across the active frames | 3 |
| Tess | Smoky Haze | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Tess | Six-Atom Spread | projectile | code-drawn shape: four-point star | 15×15 | no rotation | flies in a straight line, one still shape | 1 |
| Tessa | Peltier Punch | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Tessa | Garlic Breath | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 72×46 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Tessa | Phase Rewrite | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Tessa | Tellus Tremor | thrown | code-drawn shape: four-point star | 41×41 | no rotation | slides along the ground, one still shape | 1 |
| Tex | Metastable Flash | area or burst | procedural particles: tinted star and streaks | 128×128 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Tex | Tracer Lasso | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 104×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Tex | Quick Draw | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Tex | Gamma Camera | beam | code-drawn shape: flat rectangle | 210×28 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Thor | Thunder Hammer | area or burst | procedural particles: tinted star and streaks | 116×116 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Thor | Thunderclap | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 80×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Thor | Breeder Blanket | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Thor | Lantern Mantle | projectile | code-drawn shape: four-point star | 29×29 | no rotation | flies in a straight line, one still shape | 1 |
| Thule | Ultima Thule | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |
| Thule | Polar Night | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Thule | Aurora Veil | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Thule | Handheld X-Ray | beam | code-drawn shape: flat rectangle | 150×32 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Uri | Chain Reaction | area or burst | procedural particles: tinted star and streaks | 144×144 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Uri | Self-Sharpening Jab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Uri | DU Plating | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Uri | Yellowcake Lob | thrown | code-drawn shape: four-point star | 35×35 | no rotation | flies in a straight line, one still shape | 1 |
| Wolf | White-Hot Filament | area or burst | procedural particles: tinted star and streaks | 112×112 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Wolf | Tin Eater | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Wolf | Unmeltable | shield | code-drawn shape: translucent circle | 91×91 | no rotation | fades over about 500 ms | 1 |
| Wolf | Armor Piercer | projectile | code-drawn shape: spearhead polygon | 15×10 | rotated to face left or right | flies in a straight line, one still shape | 2 |
| Xander | Ion Thruster | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Xander | Arc Lamp Jab | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Xander | Anesthesia | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Xander | Xenon Strobe | beam | code-drawn shape: flat rectangle | 190×24 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Yara | Maglev Launch | area or burst | procedural particles: tinted star and streaks | 80×80 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Yara | Garnet Cut | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Yara | Flux Pin | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Yara | Ytterby Mine | thrown | code-drawn shape: four-point star | 29×29 | no rotation | slides along the ground, one still shape | 1 |
| Yvette | Lattice Clock | area or burst | procedural particles: tinted star and streaks | 100×100 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Yvette | Stress Gauge | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 74×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Yvette | Seismic Read | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Yvette | Fiber Laser | beam | code-drawn shape: flat rectangle | 210×14 | aimed with facing, no spin | appears for about 220 ms and fades | 1 |
| Zane | Hot-Dip Galvanize | area or burst | procedural particles: tinted star and streaks | 112×112 | streaks fly outward, no spin on the core | fades over about 160–320 ms | 1 |
| Zane | Brass Knuckles | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 68×48 | the stroke sweeps from about -60° to +26° | 6 body frames during the swing; the stroke grows across the active frames | 3 |
| Zane | Sacrificial Anode | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Zane | Fume Fever | projectile | code-drawn shape: four-point star | 41×41 | no rotation | flies in a straight line, one still shape | 1 |
| Zora | Ceramic Blade | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 64×46 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Zora | Cubic Cut | slash arc | sprite art: attack sheet plus a code-drawn slash stroke | 70×48 | the stroke sweeps from about -60° to +26° | 5 body frames during the swing; the stroke grows across the active frames | 3 |
| Zora | Zircaloy Cladding | shield | code-drawn shape: translucent circle | 86×86 | no rotation | fades over about 500 ms | 1 |
| Zora | Counterfeit Gem | projectile | code-drawn shape: four-point star | 23×23 | no rotation | flies in a straight line, one still shape | 1 |

## Replacement spec

### Hydra — Supernova

assets/fx/hydra/supernova/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hydra — Flame Dash

assets/fx/hydra/flame-dash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hydra — Fire Wall

assets/fx/hydra/fire-wall/object.png. Transparent PNG at full resolution, pointing right, fitted inside 18×110 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hydra — Hydrogen Bomb

assets/fx/hydra/hydrogen-bomb/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

the blast is a circle cap on a rectangle stem

### Helen — Balloon Bop

assets/fx/helen/balloon-bop/object.png. Transparent PNG at full resolution, pointing right, fitted inside 48×59 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Helen — Noble Gust

assets/fx/helen/noble-gust/object.png. Transparent PNG at full resolution, pointing right, fitted inside 82×50 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Helen — Bubble Shield

assets/fx/helen/bubble-shield/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×76 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Helen — Air Wave

assets/fx/helen/air-wave/object.png. Transparent PNG at full resolution, pointing right, fitted inside 79×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Titan — Titanium Ram

assets/fx/titan/titanium-ram/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Titan — Lance Jab

assets/fx/titan/lance-jab/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 84×36 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/titan/lance-jab/object.png is used instead when the three-part set is absent, fitted inside 84×36 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

### Titan — Aerospace Plating

assets/fx/titan/aerospace-plating/object.png. Transparent PNG at full resolution, pointing right, fitted inside 91×91 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Titan — Aero Lance

assets/fx/titan/aero-lance/object.png. Transparent PNG at full resolution, pointing right, fitted inside 22×14 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lillie — Volt Dash

assets/fx/lillie/volt-dash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lillie — Spark Jab

assets/fx/lillie/spark-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 88×44 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lillie — Reactive Armor

assets/fx/lillie/reactive-armor/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×70 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lillie — Water Reaction

assets/fx/lillie/water-reaction/object.png. Transparent PNG at full resolution, pointing right, fitted inside 220×220 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ben — Resonant Strike

assets/fx/ben/resonant-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ben — Precision Strike

assets/fx/ben/precision-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ben — Rigid Stance

assets/fx/ben/rigid-stance/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ben — Gyro Disc

assets/fx/ben/gyro-disc/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bord — Heavy Ram

assets/fx/bord/heavy-ram/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bord — Crystal Smash

assets/fx/bord/crystal-smash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bord — Boron Carbide Wall

assets/fx/bord/boron-carbide-wall/object.png. Transparent PNG at full resolution, pointing right, fitted inside 18×100 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bord — Ground Shatter

assets/fx/bord/ground-shatter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 176×176 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Carter — Diamond Shard

assets/fx/carter/diamond-shard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Carter — Diamond Cross

assets/fx/carter/diamond-cross/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Carter — Diamond Plating

assets/fx/carter/diamond-plating/object.png. Transparent PNG at full resolution, pointing right, fitted inside 82×82 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Carter — Graphene Wave

assets/fx/carter/graphene-wave/object.png. Transparent PNG at full resolution, pointing right, fitted inside 164×164 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nitra — Nitrogen Rush

assets/fx/nitra/nitrogen-rush/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nitra — Frost Fang

assets/fx/nitra/frost-fang/object.png. Transparent PNG at full resolution, pointing right, fitted inside 84×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nitra — Inert Shield

assets/fx/nitra/inert-shield/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×72 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nitra — Cryo Vortex

assets/fx/nitra/cryo-vortex/object.png. Transparent PNG at full resolution, pointing right, fitted inside 192×192 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Oxana — Bellows Breath

assets/fx/oxana/bellows-breath/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Oxana — Vortex Kick

assets/fx/oxana/vortex-kick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 88×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Oxana — Ozone Layer

assets/fx/oxana/ozone-layer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×70 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Oxana — Oxidation Burst

assets/fx/oxana/oxidation-burst/object.png. Transparent PNG at full resolution, pointing right, fitted inside 216×216 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flora — Pale Yellow Jet

assets/fx/flora/pale-yellow-jet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 41×41 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flora — Etching Jab

assets/fx/flora/etching-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flora — Teflon Coat

assets/fx/flora/teflon-coat/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×70 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flora — Radical Cascade

assets/fx/flora/radical-cascade/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

echoes 2 more times

### Neo — High-Voltage Tube

assets/fx/neo/high-voltage-tube/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 150×22 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/neo/high-voltage-tube/object.png is used instead when the three-part set is absent, fitted inside 150×22 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 22 px tall

### Neo — Staff Crack

assets/fx/neo/staff-crack/object.png. Transparent PNG at full resolution, pointing right, fitted inside 94×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Neo — No Vacancy

assets/fx/neo/no-vacancy/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×72 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Neo — Neon Flare

assets/fx/neo/neon-flare/object.png. Transparent PNG at full resolution, pointing right, fitted inside 204×204 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Natalie — Lake Drop

assets/fx/natalie/lake-drop/object.png. Transparent PNG at full resolution, pointing right, fitted inside 120×120 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Natalie — Flame Fist

assets/fx/natalie/flame-fist/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Natalie — Oil Bath

assets/fx/natalie/oil-bath/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×70 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Natalie — Brine Burst

assets/fx/natalie/brine-burst/object.png. Transparent PNG at full resolution, pointing right, fitted inside 176×176 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Maggie — Unquenchable

assets/fx/maggie/unquenchable/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Maggie — Flare Jab

assets/fx/maggie/flare-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Maggie — Ribbon Guard

assets/fx/maggie/ribbon-guard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 67×67 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Maggie — Blinding Flare

assets/fx/maggie/blinding-flare/object.png. Transparent PNG at full resolution, pointing right, fitted inside 172×172 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Allen — Thermite Burn

assets/fx/allen/thermite-burn/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 130×26 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/allen/thermite-burn/object.png is used instead when the three-part set is absent, fitted inside 130×26 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 26 px tall

### Allen — Turbine Strike

assets/fx/allen/turbine-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 90×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Allen — Oxide Skin

assets/fx/allen/oxide-skin/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×72 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Allen — Turbine Vortex

assets/fx/allen/turbine-vortex/object.png. Transparent PNG at full resolution, pointing right, fitted inside 200×200 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Silas — Overclock

assets/fx/silas/overclock/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Silas — Crystal Blade

assets/fx/silas/crystal-blade/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Silas — Silica Pane

assets/fx/silas/silica-pane/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×72 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Silas — Binary Surge

assets/fx/silas/binary-surge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 160×160 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Phillip — Strike Anywhere

assets/fx/phillip/strike-anywhere/object.png. Transparent PNG at full resolution, pointing right, fitted inside 104×104 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Phillip — Glow Strike

assets/fx/phillip/glow-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Phillip — Red Phosphorus Form

assets/fx/phillip/red-phosphorus-form/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×72 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Phillip — Spontaneous Ignition

assets/fx/phillip/spontaneous-ignition/object.png. Transparent PNG at full resolution, pointing right, fitted inside 156×156 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sully — Black Powder

assets/fx/sully/black-powder/object.png. Transparent PNG at full resolution, pointing right, fitted inside 108×108 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sully — Brimstone Slam

assets/fx/sully/brimstone-slam/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sully — Vulcanized Rubber

assets/fx/sully/vulcanized-rubber/object.png. Transparent PNG at full resolution, pointing right, fitted inside 95×95 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sully — Volcanic Eruption

assets/fx/sully/volcanic-eruption/object.png. Transparent PNG at full resolution, pointing right, fitted inside 192×192 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chloe — Bleach Out

assets/fx/chloe/bleach-out/object.png. Transparent PNG at full resolution, pointing right, fitted inside 46×46 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chloe — Toxic Jab

assets/fx/chloe/toxic-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chloe — Salt Bond

assets/fx/chloe/salt-bond/object.png. Transparent PNG at full resolution, pointing right, fitted inside 67×67 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chloe — Gas Cloud

assets/fx/chloe/gas-cloud/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Aaron — Lazy Haymaker

assets/fx/aaron/lazy-haymaker/object.png. Transparent PNG at full resolution, pointing right, fitted inside 78×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Aaron — Inert Guard Strike

assets/fx/aaron/inert-guard-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Aaron — Shield Gas

assets/fx/aaron/shield-gas/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×76 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Aaron — Noble Discharge

assets/fx/aaron/noble-discharge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 176×176 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Kyle — Action Potential

assets/fx/kyle/action-potential/object.png. Transparent PNG at full resolution, pointing right, fitted inside 41×41 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Kyle — Static Cross

assets/fx/kyle/static-cross/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Kyle — Ion Channel

assets/fx/kyle/ion-channel/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×74 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Kyle — Nerve Shock

assets/fx/kyle/nerve-shock/object.png. Transparent PNG at full resolution, pointing right, fitted inside 172×172 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cal — Calcify

assets/fx/cal/calcify/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cal — Bone Crush

assets/fx/cal/bone-crush/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cal — Quick-Set Cement

assets/fx/cal/quick-set-cement/object.png. Transparent PNG at full resolution, pointing right, fitted inside 18×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cal — Marrow Burst

assets/fx/cal/marrow-burst/object.png. Transparent PNG at full resolution, pointing right, fitted inside 168×168 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Scarlett — Afterburner

assets/fx/scarlett/afterburner/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Scarlett — Wing Slash

assets/fx/scarlett/wing-slash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 100×72 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Scarlett — Folded Wings

assets/fx/scarlett/folded-wings/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×68 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Scarlett — Aerial Dive

assets/fx/scarlett/aerial-dive/object.png. Transparent PNG at full resolution, pointing right, fitted inside 176×176 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Van — Redox Flow

assets/fx/van/redox-flow/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Van — Alloy Fist

assets/fx/van/alloy-fist/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Van — Four-State Guard

assets/fx/van/four-state-guard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 91×91 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Van — Prism Surge

assets/fx/van/prism-surge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 164×164 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chroma — Ruby Laser

assets/fx/chroma/ruby-laser/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 160×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/chroma/ruby-laser/object.png is used instead when the three-part set is absent, fitted inside 160×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Chroma — Chrome Edge

assets/fx/chroma/chrome-edge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chroma — Mirror Chrome

assets/fx/chroma/mirror-chrome/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×68 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Chroma — Prismatic Shatter

assets/fx/chroma/prismatic-shatter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 160×160 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ace — Actinic Ray

assets/fx/ace/actinic-ray/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 138×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/ace/actinic-ray/object.png is used instead when the three-part set is absent, fitted inside 138×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Ace — Ace of Rays

assets/fx/ace/ace-of-rays/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ace_attack.png

### Ace — Wild Card

assets/fx/ace/wild-card/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ace — Royal Flush

assets/fx/ace/royal-flush/object.png. Transparent PNG at full resolution, pointing right, fitted inside 17×17 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

fan of 5

### Agatha — Silver Bullet

assets/fx/agatha/silver-bullet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 17×17 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Agatha — Silver Lining

assets/fx/agatha/silver-lining/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/agatha_attack.png

### Agatha — Photo Negative

assets/fx/agatha/photo-negative/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Agatha — Darkroom Print

assets/fx/agatha/darkroom-print/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Amy — Alarm Blare

assets/fx/amy/alarm-blare/object.png. Transparent PNG at full resolution, pointing right, fitted inside 172×172 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Amy — Test Button

assets/fx/amy/test-button/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/amy_attack.png

### Amy — Ion Chamber

assets/fx/amy/ion-chamber/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Amy — Chirping Detector

assets/fx/amy/chirping-detector/object.png. Transparent PNG at full resolution, pointing right, fitted inside 112×112 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Arsenio — Inheritance Powder

assets/fx/arsenio/inheritance-powder/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Arsenio — Paris Green Slash

assets/fx/arsenio/paris-green-slash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/arsenio_attack.png

### Arsenio — Sublimate

assets/fx/arsenio/sublimate/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Arsenio — Green Wallpaper

assets/fx/arsenio/green-wallpaper/object.png. Transparent PNG at full resolution, pointing right, fitted inside 132×132 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Aurelius — Midas Touch

assets/fx/aurelius/midas-touch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 56×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/aurelius_attack.png

### Aurelius — Gold Leaf Sweep

assets/fx/aurelius/gold-leaf-sweep/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 120×34 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/aurelius/gold-leaf-sweep/object.png is used instead when the three-part set is absent, fitted inside 120×34 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/aurelius_attack.png

### Aurelius — Golden Visor

assets/fx/aurelius/golden-visor/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Aurelius — Ingot Lob

assets/fx/aurelius/ingot-lob/object.png. Transparent PNG at full resolution, pointing right, fitted inside 41×41 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Barry — Heavyweight Drop

assets/fx/barry/heavyweight-drop/object.png. Transparent PNG at full resolution, pointing right, fitted inside 108×108 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Barry — Mud Weight

assets/fx/barry/mud-weight/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/barry_attack.png

### Barry — Barium Meal

assets/fx/barry/barium-meal/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Barry — Poison Pellet

assets/fx/barry/poison-pellet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bianca — Hopper Crystal

assets/fx/bianca/hopper-crystal/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bianca — Staircase Kick

assets/fx/bianca/staircase-kick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×56 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/bianca_attack.png

### Bianca — Diamagnetic Repel

assets/fx/bianca/diamagnetic-repel/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Bianca — Pink Bismuth

assets/fx/bianca/pink-bismuth/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Boar — Quantum Leap

assets/fx/boar/quantum-leap/object.png. Transparent PNG at full resolution, pointing right, fitted inside 116×116 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Boar — Shell Gore

assets/fx/boar/shell-gore/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Boar — Complementarity

assets/fx/boar/complementarity/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Boar — Spectral Line

assets/fx/boar/spectral-line/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 300×8 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/boar/spectral-line/object.png is used instead when the three-part set is absent, fitted inside 300×8 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 8 px tall

### Brock — Bromos Stench

assets/fx/brock/bromos-stench/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Brock — Caustic Splash

assets/fx/brock/caustic-splash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Brock — Red Fume Screen

assets/fx/brock/red-fume-screen/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 136 px across

### Brock — Tyrian Purple

assets/fx/brock/tyrian-purple/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Burke — Bombarded Target

assets/fx/burke/bombarded-target/object.png. Transparent PNG at full resolution, pointing right, fitted inside 140×140 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Burke — Golden Bear Swipe

assets/fx/burke/golden-bear-swipe/object.png. Transparent PNG at full resolution, pointing right, fitted inside 82×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/burke_attack.png

### Burke — Hot Cell

assets/fx/burke/hot-cell/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Burke — Express Shipment

assets/fx/burke/express-shipment/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Caesar — Defining Second

assets/fx/caesar/defining-second/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Caesar — Rubicon Dash

assets/fx/caesar/rubicon-dash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Caesar — Electron Tribute

assets/fx/caesar/electron-tribute/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Caesar — Fallout Coin

assets/fx/caesar/fallout-coin/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cali — Neutron Kickstart

assets/fx/cali/neutron-kickstart/object.png. Transparent PNG at full resolution, pointing right, fitted inside 136×136 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cali — Surf's Up

assets/fx/cali/surf-s-up/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cali — Stunt Double

assets/fx/cali/stunt-double/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cali — Prospecting Probe

assets/fx/cali/prospecting-probe/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 200×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/cali/prospecting-probe/object.png is used instead when the three-part set is absent, fitted inside 200×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Ceres — Ferro Rod Sparks

assets/fx/ceres/ferro-rod-sparks/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 128×26 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/ceres/ferro-rod-sparks/object.png is used instead when the three-part set is absent, fitted inside 128×26 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 26 px tall

### Ceres — Ceria Polish

assets/fx/ceres/ceria-polish/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ceres_attack.png

### Ceres — Self-Cleaning

assets/fx/ceres/self-cleaning/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ceres — Dwarf Planet

assets/fx/ceres/dwarf-planet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 46×46 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cody — Quantum Dot

assets/fx/cody/quantum-dot/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cody — Battery Prod

assets/fx/cody/battery-prod/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/cody_attack.png

### Cody — Control Rod

assets/fx/cody/control-rod/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cody — Yellow Paint Bomb

assets/fx/cody/yellow-paint-bomb/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Collin — Gamma Knife

assets/fx/collin/gamma-knife/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 146×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/collin/gamma-knife/object.png is used instead when the three-part set is absent, fitted inside 146×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Collin — Kobold Strike

assets/fx/collin/kobold-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Collin — Superalloy Shell

assets/fx/collin/superalloy-shell/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Collin — Blue Glaze

assets/fx/collin/blue-glaze/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cooper — Electromagnet

assets/fx/cooper/electromagnet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 132×132 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Cooper — Live Wire

assets/fx/cooper/live-wire/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 116×28 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/cooper/live-wire/object.png is used instead when the three-part set is absent, fitted inside 116×28 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/cooper_attack.png

### Cooper — Grounding Rod

assets/fx/cooper/grounding-rod/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 96 px across

### Cooper — Verdigris Spray

assets/fx/cooper/verdigris-spray/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Copernicus — Heliocentric

assets/fx/copernicus/heliocentric/object.png. Transparent PNG at full resolution, pointing right, fitted inside 240×240 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Copernicus — Revolution

assets/fx/copernicus/revolution/object.png. Transparent PNG at full resolution, pointing right, fitted inside 156×156 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Copernicus — Evaporate

assets/fx/copernicus/evaporate/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Copernicus — Orrery Shot

assets/fx/copernicus/orrery-shot/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Curie — Double Nobel

assets/fx/curie/double-nobel/object.png. Transparent PNG at full resolution, pointing right, fitted inside 116×116 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

echoes 1 more times

### Curie — Pocket Vial

assets/fx/curie/pocket-vial/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/curie_attack.png

### Curie — Spectrometer Scan

assets/fx/curie/spectrometer-scan/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Curie — Pitchblende Toss

assets/fx/curie/pitchblende-toss/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 92 px across

### Dash — Triple Dash

assets/fx/dash/triple-dash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Dash — Blink Kick

assets/fx/dash/blink-kick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Dash — Afterimage Decay

assets/fx/dash/afterimage-decay/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Dash — Darmstadt Dart

assets/fx/dash/darmstadt-dart/object.png. Transparent PNG at full resolution, pointing right, fitted inside 12×12 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Dizzy — Hard to Get

assets/fx/dizzy/hard-to-get/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/dizzy_attack.png

### Dizzy — Dizzy Spin

assets/fx/dizzy/dizzy-spin/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/dizzy_attack.png

### Dizzy — Spin Deflect

assets/fx/dizzy/spin-deflect/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Dizzy — Vertigo Wave

assets/fx/dizzy/vertigo-wave/object.png. Transparent PNG at full resolution, pointing right, fitted inside 31×13 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Duke — Long Reign

assets/fx/duke/long-reign/object.png. Transparent PNG at full resolution, pointing right, fitted inside 124×124 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Duke — Ducal Cleave

assets/fx/duke/ducal-cleave/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×56 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/duke_attack.png

### Duke — Fission Split

assets/fx/duke/fission-split/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 140 px across

### Duke — Heavy Ion Bolt

assets/fx/duke/heavy-ion-bolt/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Einstein — Mass-Energy

assets/fx/einstein/mass-energy/object.png. Transparent PNG at full resolution, pointing right, fitted inside 148×148 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Einstein — Time Dilation

assets/fx/einstein/time-dilation/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/einstein_attack.png

### Einstein — Thought Experiment

assets/fx/einstein/thought-experiment/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Einstein — Fallout Rain

assets/fx/einstein/fallout-rain/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

rain of 5

### Erin — Undersea Cable

assets/fx/erin/undersea-cable/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 156×14 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/erin/undersea-cable/object.png is used instead when the three-part set is absent, fitted inside 156×14 px, pivot at the left center. No frame animation.

### Erin — Pink Glass Swipe

assets/fx/erin/pink-glass-swipe/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/erin_attack.png

### Erin — Signal Repeater

assets/fx/erin/signal-repeater/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Erin — Resurface Laser

assets/fx/erin/resurface-laser/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 136×12 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/erin/resurface-laser/object.png is used instead when the three-part set is absent, fitted inside 136×12 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 12 px tall

### Europa — Phosphor Bloom

assets/fx/europa/phosphor-bloom/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Europa — Counterfeit Check

assets/fx/europa/counterfeit-check/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/europa_attack.png

### Europa — Ice Moon Shell

assets/fx/europa/ice-moon-shell/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Europa — Banknote Star

assets/fx/europa/banknote-star/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fermi — Chicago Pile

assets/fx/fermi/chicago-pile/object.png. Transparent PNG at full resolution, pointing right, fitted inside 160×160 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fermi — Slow Neutron Punch

assets/fx/fermi/slow-neutron-punch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fermi — Exclusion Zone

assets/fx/fermi/exclusion-zone/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fermi — Fermi Paradox

assets/fx/fermi/fermi-paradox/object.png. Transparent PNG at full resolution, pointing right, fitted inside 920×920 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fey — Forge Hammer

assets/fx/fey/forge-hammer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 108×108 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fey — Cold Iron Cut

assets/fx/fey/cold-iron-cut/object.png. Transparent PNG at full resolution, pointing right, fitted inside 78×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/fey_attack.png

### Fey — Lodestone Guard

assets/fx/fey/lodestone-guard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Fey — Rust Bloom

assets/fx/fey/rust-bloom/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flo — Island of Stability

assets/fx/flo/island-of-stability/object.png. Transparent PNG at full resolution, pointing right, fitted inside 168×168 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flo — Riptide

assets/fx/flo/riptide/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flo — Identity Crisis

assets/fx/flo/identity-crisis/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Flo — Magic Number

assets/fx/flo/magic-number/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ford — Dense Nucleus

assets/fx/ford/dense-nucleus/object.png. Transparent PNG at full resolution, pointing right, fitted inside 78×52 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ford_attack.png

### Ford — Backscatter

assets/fx/ford/backscatter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ford_attack.png

### Ford — Gold Foil

assets/fx/ford/gold-foil/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ford — Transmute Ray

assets/fx/ford/transmute-ray/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 240×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/ford/transmute-ray/object.png is used instead when the three-part set is absent, fitted inside 240×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Frank — Beta Turn

assets/fx/frank/beta-turn/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Frank — Vanishing Jab

assets/fx/frank/vanishing-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×40 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/frank_attack.png

### Frank — Trace Amount

assets/fx/frank/trace-amount/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Frank — Alpha Flick

assets/fx/frank/alpha-flick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Gail — Superconductor Arc

assets/fx/gail/superconductor-arc/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Gail — Embrittle

assets/fx/gail/embrittle/object.png. Transparent PNG at full resolution, pointing right, fitted inside 62×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/gail_attack.png

### Gail — Body-Heat Melt

assets/fx/gail/body-heat-melt/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Gail — Blue LED

assets/fx/gail/blue-led/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 148×12 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/gail/blue-led/object.png is used instead when the three-part set is absent, fitted inside 148×12 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 12 px tall

### Gertrude — Mendeleev's Prediction

assets/fx/gertrude/mendeleev-s-prediction/object.png. Transparent PNG at full resolution, pointing right, fitted inside 92×92 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Gertrude — Point Contact

assets/fx/gertrude/point-contact/object.png. Transparent PNG at full resolution, pointing right, fitted inside 62×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/gertrude_attack.png

### Gertrude — Thermal Lens

assets/fx/gertrude/thermal-lens/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Gertrude — Crystal Radio Wave

assets/fx/gertrude/crystal-radio-wave/object.png. Transparent PNG at full resolution, pointing right, fitted inside 26×26 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Goldie — MRI Contrast

assets/fx/goldie/mri-contrast/object.png. Transparent PNG at full resolution, pointing right, fitted inside 156×156 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Goldie — Magnetocaloric Palm

assets/fx/goldie/magnetocaloric-palm/object.png. Transparent PNG at full resolution, pointing right, fitted inside 66×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/goldie_attack.png

### Goldie — Magnetic Chill

assets/fx/goldie/magnetic-chill/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Goldie — Room-Temp Magnet

assets/fx/goldie/room-temp-magnet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 88×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/goldie_attack.png

### Haley — Plasma Cutter

assets/fx/haley/plasma-cutter/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 132×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/haley/plasma-cutter/object.png is used instead when the three-part set is absent, fitted inside 132×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Haley — Carbide Kick

assets/fx/haley/carbide-kick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/haley_attack.png

### Haley — High-K Gate

assets/fx/haley/high-k-gate/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Haley — Neutron Sink

assets/fx/haley/neutron-sink/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hog — Puddle Rise

assets/fx/hog/puddle-rise/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×64 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/hog_attack.png

### Hog — Quicksilver Lash

assets/fx/hog/quicksilver-lash/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 124×28 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/hog/quicksilver-lash/object.png is used instead when the three-part set is absent, fitted inside 124×28 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/hog_attack.png

### Hog — Amalgamate

assets/fx/hog/amalgamate/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hog — Hatter's Fume

assets/fx/hog/hatter-s-fume/object.png. Transparent PNG at full resolution, pointing right, fitted inside 140×140 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Holly — Stone Breaker

assets/fx/holly/stone-breaker/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 136×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/holly/stone-breaker/object.png is used instead when the three-part set is absent, fitted inside 136×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Holly — Calibration Strike

assets/fx/holly/calibration-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/holly_attack.png

### Holly — Bend Don't Break

assets/fx/holly/bend-don-t-break/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Holly — Pole Piece

assets/fx/holly/pole-piece/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/holly_attack.png

### Hoss — Stampede

assets/fx/hoss/stampede/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hoss — Iron Hoof

assets/fx/hoss/iron-hoof/object.png. Transparent PNG at full resolution, pointing right, fitted inside 78×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 128 px across; art-src/imported/sheets/hoss_attack.png

### Hoss — Doubly Magic

assets/fx/hoss/doubly-magic/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Hoss — Lucky Horseshoe

assets/fx/hoss/lucky-horseshoe/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Indy — Invisible Film

assets/fx/indy/invisible-film/object.png. Transparent PNG at full resolution, pointing right, fitted inside 148×148 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Indy — Sticky Seal

assets/fx/indy/sticky-seal/object.png. Transparent PNG at full resolution, pointing right, fitted inside 66×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/indy_attack.png

### Indy — Putty Guard

assets/fx/indy/putty-guard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Indy — Solder Whip

assets/fx/indy/solder-whip/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 128×32 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/indy/solder-whip/object.png is used instead when the three-part set is absent, fitted inside 128×32 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/indy_attack.png

### Iona — Violet Vapor

assets/fx/iona/violet-vapor/object.png. Transparent PNG at full resolution, pointing right, fitted inside 52×52 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Iona — Tincture Swab

assets/fx/iona/tincture-swab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/iona_attack.png

### Iona — Iodide Shield

assets/fx/iona/iodide-shield/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Iona — Touch Powder

assets/fx/iona/touch-powder/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ira — Extinction Layer

assets/fx/ira/extinction-layer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 104×104 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ira — Spark Plug

assets/fx/ira/spark-plug/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ira_attack.png

### Ira — Prototype Kilogram

assets/fx/ira/prototype-kilogram/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ira — Iris Scatter

assets/fx/ira/iris-scatter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 20×20 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

fan of 4 elements

### Krypto — Excimer Laser

assets/fx/krypto/excimer-laser/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 108×12 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/krypto/excimer-laser/object.png is used instead when the three-part set is absent, fitted inside 108×12 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 12 px tall

### Krypto — Super Pounce

assets/fx/krypto/super-pounce/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Krypto — Flash Tube Counter

assets/fx/krypto/flash-tube-counter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Krypto — Meter Line

assets/fx/krypto/meter-line/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lana — Regenerative Charge

assets/fx/lana/regenerative-charge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lana — Hidden Strike

assets/fx/lana/hidden-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lana — Lens Bend

assets/fx/lana/lens-bend/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lana — Cracking Catalyst

assets/fx/lana/cracking-catalyst/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/lana_attack.png

### Lars — Cyclotron Beam

assets/fx/lars/cyclotron-beam/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 220×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/lars/cyclotron-beam/object.png is used instead when the three-part set is absent, fitted inside 220×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Lars — Spiral Fist

assets/fx/lars/spiral-fist/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/lars_attack.png

### Lars — Dee Plates

assets/fx/lars/dee-plates/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lars — Atom Smasher

assets/fx/lars/atom-smasher/object.png. Transparent PNG at full resolution, pointing right, fitted inside 26×26 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Liv — 192 Beams

assets/fx/liv/192-beams/object.png. Transparent PNG at full resolution, pointing right, fitted inside 184×184 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Liv — Chalcogen Hook

assets/fx/liv/chalcogen-hook/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 78×48 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/liv/chalcogen-hook/object.png is used instead when the three-part set is absent, fitted inside 78×48 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/liv_attack.png

### Liv — Hohlraum

assets/fx/liv/hohlraum/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Liv — Last Instant

assets/fx/liv/last-instant/object.png. Transparent PNG at full resolution, pointing right, fitted inside 17×17 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lucy — City of Light

assets/fx/lucy/city-of-light/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lucy — Final Lanthanide

assets/fx/lucy/final-lanthanide/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/lucy_attack.png

### Lucy — Scintillator

assets/fx/lucy/scintillator/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Lucy — Annihilation Pair

assets/fx/lucy/annihilation-pair/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

fires both directions

### Mac — Decay Cascade

assets/fx/mac/decay-cascade/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mac — Red Hammer

assets/fx/mac/red-hammer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 88×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/mac_attack.png

### Mac — Nesting Doll

assets/fx/mac/nesting-doll/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mac — Short Fuse

assets/fx/mac/short-fuse/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mae — Liquid Drop Split

assets/fx/mae/liquid-drop-split/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

fires both directions

### Mae — Overlooked

assets/fx/mae/overlooked/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/mae_attack.png

### Mae — Border Slip

assets/fx/mae/border-slip/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mae — Neutron Splitter

assets/fx/mae/neutron-splitter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 20×20 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Manny — Permanganate Splash

assets/fx/manny/permanganate-splash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Manny — Rock Crusher

assets/fx/manny/rock-crusher/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/manny_attack.png

### Manny — Work Hardening

assets/fx/manny/work-hardening/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Manny — Dry Cell Lob

assets/fx/manny/dry-cell-lob/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mendel — Dream of the Table

assets/fx/mendel/dream-of-the-table/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mendel — One Atom at a Time

assets/fx/mendel/one-atom-at-a-time/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/mendel_attack.png

### Mendel — Empty Square

assets/fx/mendel/empty-square/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Mendel — Group Drop

assets/fx/mendel/group-drop/object.png. Transparent PNG at full resolution, pointing right, fitted inside 46×46 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Molly — Red-Hot Rod

assets/fx/molly/red-hot-rod/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 140×18 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/molly/red-hot-rod/object.png is used instead when the three-part set is absent, fitted inside 140×18 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 18 px tall

### Molly — Grease Slide

assets/fx/molly/grease-slide/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Molly — Dry Lube

assets/fx/molly/dry-lube/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Molly — Nitrogenase

assets/fx/molly/nitrogenase/object.png. Transparent PNG at full resolution, pointing right, fitted inside 112×112 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nadia — Magnet Pull

assets/fx/nadia/magnet-pull/object.png. Transparent PNG at full resolution, pointing right, fitted inside 140×140 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nadia — Bass Drop Punch

assets/fx/nadia/bass-drop-punch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/nadia_attack.png

### Nadia — Polarity Flip

assets/fx/nadia/polarity-flip/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nadia — Rotor Throw

assets/fx/nadia/rotor-throw/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Neptune — Tidal Surge

assets/fx/neptune/tidal-surge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Neptune — Trident Thrust

assets/fx/neptune/trident-thrust/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/neptune_attack.png

### Neptune — Far Orbit

assets/fx/neptune/far-orbit/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Neptune — Breeder Seed

assets/fx/neptune/breeder-seed/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nick — Memory Snap

assets/fx/nick/memory-snap/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nick — Nickel and Dime

assets/fx/nick/nickel-and-dime/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/nick_attack.png

### Nick — Electroplate

assets/fx/nick/electroplate/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Nick — Meteorite Drop

assets/fx/nick/meteorite-drop/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Niko — Rising Sun

assets/fx/niko/rising-sun/object.png. Transparent PNG at full resolution, pointing right, fitted inside 160×160 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Niko — Three-Atom Combo

assets/fx/niko/three-atom-combo/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/niko_attack.png

### Niko — Nine-Year Wait

assets/fx/niko/nine-year-wait/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Niko — Zinc Ion Beam

assets/fx/niko/zinc-ion-beam/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 250×18 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/niko/zinc-ion-beam/object.png is used instead when the three-part set is absent, fitted inside 250×18 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 18 px tall

### Niobe — Particle Ring

assets/fx/niobe/particle-ring/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 200×18 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/niobe/particle-ring/object.png is used instead when the three-part set is absent, fitted inside 200×18 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 18 px tall

### Niobe — Anodized Edge

assets/fx/niobe/anodized-edge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/niobe_attack.png

### Niobe — Weeping Stone

assets/fx/niobe/weeping-stone/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Niobe — Magnet Quench

assets/fx/niobe/magnet-quench/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Noble — Dynamite Stick

assets/fx/noble/dynamite-stick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 120×120 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Noble — Medal Swing

assets/fx/noble/medal-swing/object.png. Transparent PNG at full resolution, pointing right, fitted inside 92×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/noble_attack.png

### Noble — Peace Prize

assets/fx/noble/peace-prize/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Noble — Blasting Cap

assets/fx/noble/blasting-cap/object.png. Transparent PNG at full resolution, pointing right, fitted inside 20×20 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ogden — End of the Table

assets/fx/ogden/end-of-the-table/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ogden — Light-Speed Jab

assets/fx/ogden/light-speed-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ogden_attack.png

### Ogden — Broken Noble

assets/fx/ogden/broken-noble/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ogden — Millisecond Beam

assets/fx/ogden/millisecond-beam/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 560×10 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/ogden/millisecond-beam/object.png is used instead when the three-part set is absent, fitted inside 560×10 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 10 px tall

### Oz — Densest Slam

assets/fx/oz/densest-slam/object.png. Transparent PNG at full resolution, pointing right, fitted inside 108×108 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Oz — Nib Stab

assets/fx/oz/nib-stab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 46×28 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/oz_attack.png

### Oz — Immovable Object

assets/fx/oz/immovable-object/object.png. Transparent PNG at full resolution, pointing right, fitted inside 95×95 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Oz — Tetroxide Puff

assets/fx/oz/tetroxide-puff/object.png. Transparent PNG at full resolution, pointing right, fitted inside 136×136 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pablo — Lead Balloon

assets/fx/pablo/lead-balloon/object.png. Transparent PNG at full resolution, pointing right, fitted inside 112×112 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pablo — Lead Pipe

assets/fx/pablo/lead-pipe/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/pablo_attack.png

### Pablo — Lead Apron

assets/fx/pablo/lead-apron/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pablo — Sinker Cast

assets/fx/pablo/sinker-cast/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pat — Proto Daughter

assets/fx/pat/proto-daughter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pat — Sediment Layer

assets/fx/pat/sediment-layer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/pat_attack.png

### Pat — Deep Time Rewind

assets/fx/pat/deep-time-rewind/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pat — Twin Hazard Bolt

assets/fx/pat/twin-hazard-bolt/object.png. Transparent PNG at full resolution, pointing right, fitted inside 26×26 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Paula — Cold Fusion

assets/fx/paula/cold-fusion/object.png. Transparent PNG at full resolution, pointing right, fitted inside 136×136 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Paula — White Gold Jab

assets/fx/paula/white-gold-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 66×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/paula_attack.png

### Paula — Hydrogen Sponge

assets/fx/paula/hydrogen-sponge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Paula — Fuel Cell Bolt

assets/fx/paula/fuel-cell-bolt/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Percy — Frozen Light

assets/fx/percy/frozen-light/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 220×18 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/percy/frozen-light/object.png is used instead when the three-part set is absent, fitted inside 220×18 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 18 px tall

### Percy — Green Twin Strike

assets/fx/percy/green-twin-strike/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/percy_attack.png

### Percy — Welder's Goggles

assets/fx/percy/welder-s-goggles/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Percy — Green Glass Shard

assets/fx/percy/green-glass-shard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pit — Catalyst Ignition

assets/fx/pit/catalyst-ignition/object.png. Transparent PNG at full resolution, pointing right, fitted inside 176×176 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pit — Record Scratch

assets/fx/pit/record-scratch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 78×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/pit_attack.png

### Pit — Cisplatin Clamp

assets/fx/pit/cisplatin-clamp/object.png. Transparent PNG at full resolution, pointing right, fitted inside 84×84 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pit — Flame Test

assets/fx/pit/flame-test/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pluto — Critical Mass

assets/fx/pluto/critical-mass/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pluto — Decay-Heat Palm

assets/fx/pluto/decay-heat-palm/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/pluto_attack.png

### Pluto — Demoted

assets/fx/pluto/demoted/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Pluto — Deep Space Probe

assets/fx/pluto/deep-space-probe/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Polonius — Blue Glow Burst

assets/fx/polonius/blue-glow-burst/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Polonius — Rapier Thrust

assets/fx/polonius/rapier-thrust/object.png. Transparent PNG at full resolution, pointing right, fitted inside 92×24 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Polonius — Behind the Arras

assets/fx/polonius/behind-the-arras/object.png. Transparent PNG at full resolution, pointing right, fitted inside 18×100 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Polonius — Static Eliminator

assets/fx/polonius/static-eliminator/object.png. Transparent PNG at full resolution, pointing right, fitted inside 100×36 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Prometheus — Stolen Fire

assets/fx/prometheus/stolen-fire/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/prometheus_attack.png

### Prometheus — Torchbearer Swing

assets/fx/prometheus/torchbearer-swing/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/prometheus_attack.png

### Prometheus — Chained to the Rock

assets/fx/prometheus/chained-to-the-rock/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Prometheus — Beta Battery

assets/fx/prometheus/beta-battery/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 80 px across

### Ray — Radium Tonic

assets/fx/ray/radium-tonic/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ray — Alpha Uppercut

assets/fx/ray/alpha-uppercut/object.png. Transparent PNG at full resolution, pointing right, fitted inside 50×64 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/ray_attack.png

### Ray — Decay Halo

assets/fx/ray/decay-halo/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ray — Luminous Splash

assets/fx/ray/luminous-splash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Rex — High Octane

assets/fx/rex/high-octane/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Rex — King's Edge

assets/fx/rex/king-s-edge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/rex_attack.png

### Rex — Creep Resistance

assets/fx/rex/creep-resistance/object.png. Transparent PNG at full resolution, pointing right, fitted inside 87×87 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Rex — Thermocouple Lash

assets/fx/rex/thermocouple-lash/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 112×30 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/rex/thermocouple-lash/object.png is used instead when the three-part set is absent, fitted inside 112×30 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/rex_attack.png

### Rhoda — Catalytic Converter

assets/fx/rhoda/catalytic-converter/object.png. Transparent PNG at full resolution, pointing right, fitted inside 104×104 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Rhoda — Rose Thorn

assets/fx/rhoda/rose-thorn/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 68×48 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/rhoda/rose-thorn/object.png is used instead when the three-part set is absent, fitted inside 68×48 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/rhoda_attack.png

### Rhoda — Tarnish Guard

assets/fx/rhoda/tarnish-guard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Rhoda — High Beam

assets/fx/rhoda/high-beam/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 180×36 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/rhoda/high-beam/object.png is used instead when the three-part set is absent, fitted inside 180×36 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 36 px tall

### Roger — X-Ray Vision

assets/fx/roger/x-ray-vision/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Roger — Skeleton Flash

assets/fx/roger/skeleton-flash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/roger_attack.png

### Roger — Crookes Tube

assets/fx/roger/crookes-tube/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Roger — Penetrating Ray

assets/fx/roger/penetrating-ray/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 340×14 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/roger/penetrating-ray/object.png is used instead when the three-part set is absent, fitted inside 340×14 px, pivot at the left center. No frame animation.

### Ronan — Ground Seep

assets/fx/ronan/ground-seep/object.png. Transparent PNG at full resolution, pointing right, fitted inside 92×92 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ronan — Decay Daughters

assets/fx/ronan/decay-daughters/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 80 px across; art-src/imported/sheets/ronan_attack.png

### Ronan — Radon Spa

assets/fx/ronan/radon-spa/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 92 px across

### Ronan — Radon Creep

assets/fx/ronan/radon-creep/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ruben — Condensate Collapse

assets/fx/ruben/condensate-collapse/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ruben — Molten Palm

assets/fx/ruben/molten-palm/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 68 px across; art-src/imported/sheets/ruben_attack.png

### Ruben — Laser Cooling

assets/fx/ruben/laser-cooling/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ruben — Violet Ember

assets/fx/ruben/violet-ember/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ruth — Sunlight Dye

assets/fx/ruth/sunlight-dye/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 180×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/ruth/sunlight-dye/object.png is used instead when the three-part set is absent, fitted inside 180×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Ruth — Hardener Hook

assets/fx/ruth/hardener-hook/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 70×48 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/ruth/hardener-hook/object.png is used instead when the three-part set is absent, fitted inside 70×48 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/ruth_attack.png

### Ruth — Metathesis Swap

assets/fx/ruth/metathesis-swap/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Ruth — Grubbs Catalyst

assets/fx/ruth/grubbs-catalyst/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Saab — Printing Press

assets/fx/saab/printing-press/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/saab_attack.png

### Saab — Kohl Swipe

assets/fx/saab/kohl-swipe/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/saab_attack.png

### Saab — Flame Retardant

assets/fx/saab/flame-retardant/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Saab — Stibnite Needles

assets/fx/saab/stibnite-needles/object.png. Transparent PNG at full resolution, pointing right, fitted inside 15×15 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

fan of 4

### Sam — Heatproof Magnet

assets/fx/sam/heatproof-magnet/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sam — Samarskite Smash

assets/fx/sam/samarskite-smash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/sam_attack.png

### Sam — Mine Shaft Duck

assets/fx/sam/mine-shaft-duck/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sam — Pickaxe Toss

assets/fx/sam/pickaxe-toss/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sandy — Tin Cry

assets/fx/sandy/tin-cry/object.png. Transparent PNG at full resolution, pointing right, fitted inside 140×140 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sandy — Organ Pipe Swing

assets/fx/sandy/organ-pipe-swing/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/sandy_attack.png

### Sandy — Tin Pest

assets/fx/sandy/tin-pest/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sandy — Tin Can Kick

assets/fx/sandy/tin-can-kick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sarge — Sound Off

assets/fx/sarge/sound-off/object.png. Transparent PNG at full resolution, pointing right, fitted inside 96×96 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sarge — Six-Count Flurry

assets/fx/sarge/six-count-flurry/object.png. Transparent PNG at full resolution, pointing right, fitted inside 78×52 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/sarge_attack.png

### Sarge — Periodic Shield

assets/fx/sarge/periodic-shield/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sarge — Decay Mortar

assets/fx/sarge/decay-mortar/object.png. Transparent PNG at full resolution, pointing right, fitted inside 32×32 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Selena — Photoconductor

assets/fx/selena/photoconductor/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 210×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/selena/photoconductor/object.png is used instead when the three-part set is absent, fitted inside 210×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Selena — Crescent Kick

assets/fx/selena/crescent-kick/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/selena_attack.png

### Selena — Photocopy

assets/fx/selena/photocopy/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Selena — Moonbeam

assets/fx/selena/moonbeam/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 160×18 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/selena/moonbeam/object.png is used instead when the three-part set is absent, fitted inside 160×18 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 18 px tall

### Sterling — Bone Seeker

assets/fx/sterling/bone-seeker/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Sterling — Night-Glow Hook

assets/fx/sterling/night-glow-hook/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 74×48 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/sterling/night-glow-hook/object.png is used instead when the three-part set is absent, fitted inside 74×48 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/sterling_attack.png

### Sterling — Road Flare

assets/fx/sterling/road-flare/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 84 px across

### Sterling — Crimson Rocket

assets/fx/sterling/crimson-rocket/object.png. Transparent PNG at full resolution, pointing right, fitted inside 26×26 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Talia — Poisoner's Poison

assets/fx/talia/poisoner-s-poison/object.png. Transparent PNG at full resolution, pointing right, fitted inside 124×124 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Talia — Green Line Stab

assets/fx/talia/green-line-stab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 58×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/talia_attack.png

### Talia — Prussian Blue

assets/fx/talia/prussian-blue/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Talia — Pale Horse Dart

assets/fx/talia/pale-horse-dart/object.png. Transparent PNG at full resolution, pointing right, fitted inside 17×17 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tara — Capacitor Dump

assets/fx/tara/capacitor-dump/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 148×24 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/tara/capacitor-dump/object.png is used instead when the three-part set is absent, fitted inside 148×24 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 24 px tall

### Tara — Tantalizing Hook

assets/fx/tara/tantalizing-hook/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 92×42 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/tara/tantalizing-hook/object.png is used instead when the three-part set is absent, fitted inside 92×42 px, pivot at the left center. Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.

art-src/imported/sheets/tara_attack.png

### Tara — Tantalus Guard

assets/fx/tara/tantalus-guard/object.png. Transparent PNG at full resolution, pointing right, fitted inside 84×84 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tara — Implant Pin

assets/fx/tara/implant-pin/object.png. Transparent PNG at full resolution, pointing right, fitted inside 15×10 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tate — Self-Vaporize

assets/fx/tate/self-vaporize/object.png. Transparent PNG at full resolution, pointing right, fitted inside 156×156 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tate — Targeted Alpha

assets/fx/tate/targeted-alpha/object.png. Transparent PNG at full resolution, pointing right, fitted inside 52×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/tate_attack.png

### Tate — Never Seen

assets/fx/tate/never-seen/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tate — Unstable Bolt

assets/fx/tate/unstable-bolt/object.png. Transparent PNG at full resolution, pointing right, fitted inside 26×26 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Terra — Sonar Pulse

assets/fx/terra/sonar-pulse/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 520×16 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/terra/sonar-pulse/object.png is used instead when the three-part set is absent, fitted inside 520×16 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 16 px tall

### Terra — Flex Punch

assets/fx/terra/flex-punch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 76×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/terra_attack.png

### Terra — Floor Speaker

assets/fx/terra/floor-speaker/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Terra — Green Phosphor Bolt

assets/fx/terra/green-phosphor-bolt/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tess — Electron Hunger

assets/fx/tess/electron-hunger/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tess — Last Halogen

assets/fx/tess/last-halogen/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/tess_attack.png

### Tess — Smoky Haze

assets/fx/tess/smoky-haze/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 156 px across

### Tess — Six-Atom Spread

assets/fx/tess/six-atom-spread/object.png. Transparent PNG at full resolution, pointing right, fitted inside 15×15 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

fan of 6

### Tessa — Peltier Punch

assets/fx/tessa/peltier-punch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/tessa_attack.png

### Tessa — Garlic Breath

assets/fx/tessa/garlic-breath/object.png. Transparent PNG at full resolution, pointing right, fitted inside 72×46 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/tessa_attack.png

### Tessa — Phase Rewrite

assets/fx/tessa/phase-rewrite/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tessa — Tellus Tremor

assets/fx/tessa/tellus-tremor/object.png. Transparent PNG at full resolution, pointing right, fitted inside 41×41 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tex — Metastable Flash

assets/fx/tex/metastable-flash/object.png. Transparent PNG at full resolution, pointing right, fitted inside 128×128 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tex — Tracer Lasso

assets/fx/tex/tracer-lasso/object.png. Transparent PNG at full resolution, pointing right, fitted inside 104×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/tex_attack.png

### Tex — Quick Draw

assets/fx/tex/quick-draw/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Tex — Gamma Camera

assets/fx/tex/gamma-camera/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 210×28 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/tex/gamma-camera/object.png is used instead when the three-part set is absent, fitted inside 210×28 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 28 px tall

### Thor — Thunder Hammer

assets/fx/thor/thunder-hammer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 116×116 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Thor — Thunderclap

assets/fx/thor/thunderclap/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/thor_attack.png

### Thor — Breeder Blanket

assets/fx/thor/breeder-blanket/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Thor — Lantern Mantle

assets/fx/thor/lantern-mantle/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Thule — Ultima Thule

assets/fx/thule/ultima-thule/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Thule — Polar Night

assets/fx/thule/polar-night/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/thule_attack.png

### Thule — Aurora Veil

assets/fx/thule/aurora-veil/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Thule — Handheld X-Ray

assets/fx/thule/handheld-x-ray/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 150×32 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/thule/handheld-x-ray/object.png is used instead when the three-part set is absent, fitted inside 150×32 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 32 px tall

### Uri — Chain Reaction

assets/fx/uri/chain-reaction/object.png. Transparent PNG at full resolution, pointing right, fitted inside 144×144 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

echoes 2 more times

### Uri — Self-Sharpening Jab

assets/fx/uri/self-sharpening-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/uri_attack.png

### Uri — DU Plating

assets/fx/uri/du-plating/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Uri — Yellowcake Lob

assets/fx/uri/yellowcake-lob/object.png. Transparent PNG at full resolution, pointing right, fitted inside 35×35 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

also leaves a circle 104 px across

### Wolf — White-Hot Filament

assets/fx/wolf/white-hot-filament/object.png. Transparent PNG at full resolution, pointing right, fitted inside 112×112 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Wolf — Tin Eater

assets/fx/wolf/tin-eater/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Wolf — Unmeltable

assets/fx/wolf/unmeltable/object.png. Transparent PNG at full resolution, pointing right, fitted inside 91×91 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Wolf — Armor Piercer

assets/fx/wolf/armor-piercer/object.png. Transparent PNG at full resolution, pointing right, fitted inside 15×10 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Xander — Ion Thruster

assets/fx/xander/ion-thruster/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Xander — Arc Lamp Jab

assets/fx/xander/arc-lamp-jab/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/xander_attack.png

### Xander — Anesthesia

assets/fx/xander/anesthesia/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Xander — Xenon Strobe

assets/fx/xander/xenon-strobe/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 190×24 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/xander/xenon-strobe/object.png is used instead when the three-part set is absent, fitted inside 190×24 px, pivot at the left center. No frame animation.

the drawn bar is 14 px tall; the hit is 24 px tall

### Yara — Maglev Launch

assets/fx/yara/maglev-launch/object.png. Transparent PNG at full resolution, pointing right, fitted inside 80×80 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Yara — Garnet Cut

assets/fx/yara/garnet-cut/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/yara_attack.png

### Yara — Flux Pin

assets/fx/yara/flux-pin/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Yara — Ytterby Mine

assets/fx/yara/ytterby-mine/object.png. Transparent PNG at full resolution, pointing right, fitted inside 29×29 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Yvette — Lattice Clock

assets/fx/yvette/lattice-clock/object.png. Transparent PNG at full resolution, pointing right, fitted inside 100×100 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Yvette — Stress Gauge

assets/fx/yvette/stress-gauge/object.png. Transparent PNG at full resolution, pointing right, fitted inside 74×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/yvette_attack.png

### Yvette — Seismic Read

assets/fx/yvette/seismic-read/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Yvette — Fiber Laser

assets/fx/yvette/fiber-laser/cap-start.png, tile.png, and cap-end.png. Transparent PNGs at full resolution, pointing right. The tile repeats along the length and is fitted to 210×14 px. cap-start and tile pivot at the left center (0, 0.50). cap-end pivots at the right center (1, 0.50) so the tip meets the last tile. A single assets/fx/yvette/fiber-laser/object.png is used instead when the three-part set is absent, fitted inside 210×14 px, pivot at the left center. No frame animation.

### Zane — Hot-Dip Galvanize

assets/fx/zane/hot-dip-galvanize/object.png. Transparent PNG at full resolution, pointing right, fitted inside 112×112 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Zane — Brass Knuckles

assets/fx/zane/brass-knuckles/object.png. Transparent PNG at full resolution, pointing right, fitted inside 68×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/zane_attack.png

### Zane — Sacrificial Anode

assets/fx/zane/sacrificial-anode/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Zane — Fume Fever

assets/fx/zane/fume-fever/object.png. Transparent PNG at full resolution, pointing right, fitted inside 41×41 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Zora — Ceramic Blade

assets/fx/zora/ceramic-blade/object.png. Transparent PNG at full resolution, pointing right, fitted inside 64×46 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/zora_attack.png

### Zora — Cubic Cut

assets/fx/zora/cubic-cut/object.png. Transparent PNG at full resolution, pointing right, fitted inside 70×48 px, pivot at the left center (0, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

art-src/imported/sheets/zora_attack.png

### Zora — Zircaloy Cladding

assets/fx/zora/zircaloy-cladding/object.png. Transparent PNG at full resolution, pointing right, fitted inside 86×86 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.

### Zora — Counterfeit Gem

assets/fx/zora/counterfeit-gem/object.png. Transparent PNG at full resolution, pointing right, fitted inside 23×23 px, pivot at the center (0.50, 0.50). Optional frame-0.png through frame-7.png replace object.png and play at 8 fps. No tiling.
