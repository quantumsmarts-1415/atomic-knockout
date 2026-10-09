# Combat balance

Stats are modifiers on one shared base. A modifier of **0 means no change**.
Every constant lives in `TUNING` inside `src/data/balance.js`. Raw element
numbers live in `src/data/elements.js`. Derived profiles are attached to each
character as `combat` when the roster loads, and they replace the old
hand-tuned speed, jump, weight and gravity. Extra air jumps stay a
per-character choice.

Damage types are **kinetic**, **heat**, **electrical**, **chemical** and
**radiation**. A move may deal more than one. Older moves that still say
`physical` are treated as kinetic.

## Formulas

### Density position `t`

Density drives radiation defense, run speed, jump speed, gravity and weight
(how far a fighter flies when launched). Gases and solids sit on different
stretches of a log scale so metals are not crushed into one clump by hydrogen.

- Missing or non-positive density → `t` is null and every density modifier is 0.
- Gases (`density < 0.02 g/cm³`): `t` runs from 0 at 0.00008 g/cm³ to 0.25 at 0.02.
- Solids: `t` runs from 0.30 at 0.4 g/cm³ to 1 at 22.6 g/cm³ (osmium).

```
t_gas   = clamp(log10(d / 0.00008) / log10(0.02 / 0.00008), 0, 1) * 0.25
t_solid = 0.30 + clamp(log10(d / 0.4) / log10(22.6 / 0.4), 0, 1) * 0.70
```

### Movement

`t = 0` is the lightest gas, `t = 1` is osmium-dense, `t = 0.5` is the base.

```
speed        = clamp(310 * (1 + 0.36 * (1 - 2t)), 175, 460)
jumpVelocity = clamp(680 * (1 + 0.28 * (1 - 2t)), 460, 940)
weight       = clamp(1   * (1 + 0.38 * (2t - 1)), 0.58, 1.48)
gravityScale = clamp(0.76 + t * (1.14 - 0.76), 0.70, 1.20)
```

Knockback speed is `(baseKnockback + percent * growth) / weight * 0.72`, so a
heavier fighter flies less far. A blast that includes its owner deals 75% of
that damage and 40% of that knockback. An explicit self-cost (Supernova)
keeps full damage and does not launch her. Jump height is `jumpVelocity² / (2 * 1500 * gravityScale)`.

### Kinetic

Mohs hardness is kinetic **attack**. Tensile strength (MPa) is kinetic **defense**.
Gases, liquids and missing numbers are 0.

```
kineticAtk = 0                         if Mohs <= 0
           = (Mohs / 10) * 0.50        otherwise     # diamond = +50%
kineticDef = 0                         if MPa <= 0
           = log10(1 + MPa) / log10(1 + 1200) * 0.42
dealt      = base * (1 + attacker.kineticAtk) * (1 - defender.kineticDef)
```

Ranges in the doc (titanium 246–370 MPa, aluminum 40–50 MPa) use the midpoint.

### Heat

Boiling point (K) is heat defense. Cold attacks are heat damage. Missing
boiling point → modifier 0. Values below 500 K lower the defense (more heat
damage gets through); values above raise it.

```
heatDef = clamp((log10(boiling) - log10(500)) / 2.2, -0.32, +0.42)
dealt   = base * (1 - heatDef)
```

### Electrical

Conductivity is both attack and defense.

Attack (0 conductivity → no bonus):

```
elecAtk = log10(1 + conductivity) / log10(1 + 63) * 0.40
dealt   = base * (1 + elecAtk)
```

Defense is a bell on `log10(conductivity)`, centered at 0.45 (~2.8 MS/m)
with sigma 0.95. The peak takes the **most** electrical damage. Both tails
take less. An explicit 0 (insulator or gas) uses a floor of `1e-5` so it
sits on the low tail. A null / unpublished conductivity is modifier 0
(`elecTaken = 1`, `elecAtk = 0`).

```
bell       = exp(-0.5 * ((log10(c) - 0.45) / 0.95)²)
elecTaken  = clamp(1 - 0.28 + (0.28 + 0.20) * bell, 0.55, 1.35)
dealt      = base * elecTaken
```

| conductivity (MS/m) | electrical damage taken |
| --- | --- |
| 0 (insulator) | 0.72× |
| 0.1 | 0.87× |
| 1 | 1.15× |
| 3 (peak) | 1.20× |
| 14 | 1.09× |
| 38 (aluminum) | 0.96× |
| 59 (copper) | 0.90× |

### Radiation

```
radDef = 0            if density is missing
       = t * 0.38     otherwise
dealt  = base * (1 - radDef)
```

### Chemical

Scaled by the electronegativity gap. A gap of 0 is modifier 0 (full base
damage). Noble gases (Helen, Neo, Aaron) take **no** chemical damage. If
either electronegativity is missing, the modifier is 0.

```
dealt = 0                                              if defender is a noble gas
      = base                                           if either EN is missing
      = base * clamp(1 + 0.16 * |EN_a - EN_d|, 0, 1.85)
```

Fluorine (3.98) into sodium (0.93) is about 1.49×. The same element into
itself is 1×.

### Safety clamps

Incoming multipliers other than a noble's chemical immunity are clamped to
`[0.22, 1.75]` so a future element cannot become immune or be deleted by a
tap. Movement clamps are listed above.

## Roster table

Modifiers are fractions: `0.30` kinetic attack means +30% kinetic damage
dealt. Heat defense `-0.32` means that fighter takes 32% more heat damage.
`elec taken` is the multiplier on incoming electrical damage (1.20 = +20%).

| Fighter | Element | Density | t | Speed | Jump | Weight | Gravity | Kin atk | Kin def | Heat def | Elec atk | Elec taken | Rad def | EN | Noble |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Hydra | Hydrogen | 0.0000899 | 0.01 | 420 | 868 | 0.62 | 0.76 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.00 | 2.20 | |
| Helen | Helium | 0.0001786 | 0.04 | 413 | 857 | 0.65 | 0.77 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.01 | — | yes |
| Lillie | Lithium | 0.534 | 0.35 | 343 | 737 | 0.89 | 0.89 | 0.03 | 0.05 | 0.23 | 0.24 | 1.12 | 0.13 | 0.98 | |
| Ben | Beryllium | 1.845 | 0.57 | 295 | 655 | 1.05 | 0.97 | 0.28 | 0.36 | 0.34 | 0.31 | 1.01 | 0.21 | 1.57 | |
| Bord | Boron | 2.46 | 0.62 | 284 | 636 | 1.09 | 0.99 | 0.47 | 0.00 | 0.42 | 0.00 | 0.72 | 0.23 | 2.04 | |
| Carter | Carbon | 2.266 | 0.60 | 287 | 642 | 1.08 | 0.99 | 0.50 | 0.16 | 0.41 | 0.01 | 0.87 | 0.23 | 2.55 | |
| Nitra | Nitrogen | 0.0012506 | 0.12 | 394 | 823 | 0.71 | 0.81 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.05 | 3.04 | |
| Oxana | Oxygen | 0.001429 | 0.13 | 392 | 821 | 0.72 | 0.81 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.05 | 3.44 | |
| Flora | Fluorine | 0.001696 | 0.14 | 391 | 818 | 0.73 | 0.81 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.05 | 3.98 | |
| Neo | Neon | 0.0009002 | 0.11 | 397 | 829 | 0.70 | 0.80 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.04 | — | yes |
| Natalie | Sodium | 0.969 | 0.45 | 320 | 698 | 0.96 | 0.93 | 0.03 | 0.00 | 0.17 | 0.30 | 1.03 | 0.17 | 0.93 | |
| Maggie | Magnesium | 1.737 | 0.55 | 298 | 659 | 1.04 | 0.97 | 0.13 | 0.31 | 0.20 | 0.31 | 1.02 | 0.21 | 1.31 | |
| Allen | Aluminum | 2.699 | 0.63 | 281 | 630 | 1.10 | 1.00 | 0.14 | 0.23 | 0.34 | 0.35 | 0.96 | 0.24 | 1.61 | |
| Silas | Silicon | 2.329 | 0.61 | 286 | 640 | 1.08 | 0.99 | 0.33 | 0.30 | 0.39 | 0.00 | 0.72 | 0.23 | 1.90 | |
| Phillip | Phosphorus | 1.823 | 0.56 | 296 | 656 | 1.05 | 0.97 | 0.00 | 0.00 | 0.02 | 0.00 | 0.72 | 0.21 | 2.19 | |
| Sully | Sulfur | 2.07 | 0.59 | 291 | 648 | 1.06 | 0.98 | 0.10 | 0.00 | 0.07 | 0.00 | 0.72 | 0.22 | 2.58 | |
| Chloe | Chlorine | 0.0032 | 0.17 | 384 | 807 | 0.75 | 0.82 | 0.00 | 0.00 | -0.15 | 0.00 | 0.72 | 0.06 | 3.16 | |
| Aaron | Argon | 0.001784 | 0.14 | 390 | 817 | 0.73 | 0.81 | 0.00 | 0.00 | -0.32 | 0.00 | 0.72 | 0.05 | — | yes |
| Kyle | Potassium | 0.859 | 0.43 | 325 | 706 | 0.95 | 0.92 | 0.02 | 0.00 | 0.14 | 0.26 | 1.09 | 0.16 | 0.82 | |
| Cal | Calcium | 1.526 | 0.53 | 303 | 668 | 1.02 | 0.96 | 0.09 | 0.28 | 0.25 | 0.33 | 0.99 | 0.20 | 1.00 | |
| Scarlett | Scandium | 2.989 | 0.65 | 277 | 623 | 1.11 | 1.01 | 0.00 | 0.31 | 0.36 | 0.10 | 1.19 | 0.25 | 1.36 | |
| Titan | Titanium | 4.502 | 0.72 | 261 | 596 | 1.17 | 1.03 | 0.30 | 0.34 | 0.39 | 0.12 | 1.20 | 0.27 | 1.54 | |
| Van | Vanadium | 6.099 | 0.77 | 249 | 576 | 1.21 | 1.05 | 0.35 | 0.40 | 0.39 | 0.17 | 1.18 | 0.29 | 1.63 | |
| Chroma | Chromium | 7.192 | 0.80 | 243 | 565 | 1.23 | 1.06 | 0.42 | 0.37 | 0.35 | 0.21 | 1.15 | 0.30 | 1.66 | |

Carbon's kinetic attack uses diamond (Mohs 10). His density, tensile strength
and conductivity use graphite, which is the form the doc lists beside diamond.
Silicon's listed bulk tensile strength (170 MPa) is what the profile uses;
the flawless-crystal figure (5,000–9,000 MPa) would pin his kinetic defense
to the cap and is not the number the doc gives as the working value.

## What to turn

- Too much flight on light gases: lower `speedSpan` / `jumpSpan` or raise `weightSpan`.
- Metals feel the same: widen `solidDensityLo` / `solidDensityHi` or the spans.
- Electrical peak in the wrong place: move `elecMidLog` (it is a log10 of MS/m).
- Chemical matchups too swingy: lower `chemPerEn`.
