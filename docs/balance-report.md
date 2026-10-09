# Balance report

Headless CPU tournament on Elemental Isle. 24 fighters, every pair three times (828 duels) plus 16 three-player free-for-alls. 16 seconds, 3 stocks. Each match uses a fixed seed. Win rate is stocks, then lower percent, then higher damage dealt. Average KO time counts only KOs that happened. Damage dealt does not include self-hits.

The before column is the original element curves (Mohs max 0.50, tensile max 0.42, full knockback) after the fast sim was locked to the same 60 Hz step as real-time play. Earlier win rates, from when heavy fighters fell through the floor, are not used.

## What changed

- `knockbackScale` 0.72. Weight order is unchanged. Launches are shorter, so a light fighter is less likely to die at low percent.
- `selfDamageMult` 0.75 and `selfKnockbackScale` 0.40. A blast that includes its owner (Lake Drop) still hurts them, with a shorter launch. Supernova stays a full self-cost and does not launch Hydra.
- Move damage numbers were not edited. Gases still have no kinetic attack. Diamond is still the hardest kinetic attack. Chemical damage is still the electronegativity gap.

A follow-up that lowered Mohs, shortened hitstun, and cut returning projectiles made the spread wider (Flora fell out of the band, Ben rose), so those knobs were put back.

## 1v1 before

| Fighter | Win rate | Damage dealt | Damage taken | Avg KO time (ms) | Damage dealt by type |
| --- | ---: | ---: | ---: | ---: | --- |
| ben | 84.1% | 85 | 50 | 7680 | kinetic 85, heat 0, electrical 0, chemical 0, radiation 0 |
| titan | 81.2% | 81 | 55 | 7367 | kinetic 81, heat 0, electrical 0, chemical 0, radiation 0 |
| phillip | 72.5% | 60 | 63 | 8191 | kinetic 21, heat 39, electrical 0, chemical 0, radiation 0 |
| chroma | 69.6% | 80 | 54 | 7578 | kinetic 77, heat 3, electrical 0, chemical 0, radiation 0 |
| van | 69.6% | 77 | 64 | 7753 | kinetic 28, heat 0, electrical 49, chemical 0, radiation 0 |
| chloe | 65.2% | 70 | 39 | 8086 | kinetic 0, heat 0, electrical 0, chemical 70, radiation 0 |
| maggie | 65.2% | 74 | 55 | 7923 | kinetic 18, heat 55, electrical 0, chemical 0, radiation 0 |
| carter | 59.4% | 76 | 59 | 8037 | kinetic 42, heat 0, electrical 34, chemical 0, radiation 0 |
| hydra | 59.4% | 82 | 57 | 8431 | kinetic 16, heat 44, electrical 0, chemical 0, radiation 21 |
| silas | 59.4% | 66 | 56 | 8539 | kinetic 43, heat 0, electrical 23, chemical 0, radiation 0 |
| neo | 52.2% | 54 | 51 | 7690 | kinetic 14, heat 0, electrical 40, chemical 0, radiation 0 |
| flora | 49.3% | 78 | 55 | 8389 | kinetic 0, heat 0, electrical 0, chemical 77, radiation 0 |
| nitra | 47.8% | 62 | 43 | 7920 | kinetic 14, heat 48, electrical 0, chemical 0, radiation 0 |
| kyle | 46.4% | 74 | 66 | 6622 | kinetic 18, heat 0, electrical 56, chemical 0, radiation 0 |
| aaron | 42.0% | 40 | 55 | 7677 | kinetic 16, heat 0, electrical 23, chemical 0, radiation 0 |
| cal | 42.0% | 53 | 70 | 8203 | kinetic 32, heat 11, electrical 0, chemical 11, radiation 0 |
| bord | 36.2% | 63 | 87 | 7338 | kinetic 63, heat 0, electrical 0, chemical 0, radiation 0 |
| sully | 36.2% | 47 | 91 | 7383 | kinetic 14, heat 23, electrical 0, chemical 10, radiation 0 |
| lillie | 34.8% | 43 | 77 | 8067 | kinetic 15, heat 27, electrical 1, chemical 0, radiation 0 |
| allen | 33.3% | 38 | 75 | 7864 | kinetic 17, heat 2, electrical 18, chemical 0, radiation 0 |
| oxana | 33.3% | 42 | 63 | 7100 | kinetic 15, heat 12, electrical 0, chemical 14, radiation 0 |
| helen | 27.5% | 21 | 60 | 7005 | kinetic 21, heat 0, electrical 0, chemical 0, radiation 0 |
| natalie | 20.3% | 63 | 126 | 7360 | kinetic 30, heat 33, electrical 0, chemical 0, radiation 0 |
| scarlett | 13.0% | 26 | 45 | 7747 | kinetic 25, heat 0, electrical 0, chemical 0, radiation 0 |

## 1v1 after

| Fighter | Win rate | Damage dealt | Damage taken | Avg KO time (ms) | Damage dealt by type |
| --- | ---: | ---: | ---: | ---: | --- |
| chroma | 76.8% | 88 | 61 | 8049 | kinetic 83, heat 5, electrical 0, chemical 0, radiation 0 |
| van | 75.4% | 86 | 68 | 7686 | kinetic 32, heat 0, electrical 54, chemical 0, radiation 0 |
| ben | 73.9% | 87 | 59 | 8919 | kinetic 87, heat 0, electrical 0, chemical 0, radiation 0 |
| titan | 72.5% | 85 | 57 | 8497 | kinetic 84, heat 1, electrical 0, chemical 0, radiation 0 |
| maggie | 69.6% | 81 | 60 | 9075 | kinetic 19, heat 62, electrical 0, chemical 0, radiation 0 |
| silas | 66.7% | 72 | 64 | 10046 | kinetic 46, heat 0, electrical 26, chemical 0, radiation 0 |
| chloe | 65.2% | 81 | 37 | 8628 | kinetic 0, heat 0, electrical 0, chemical 81, radiation 0 |
| carter | 62.3% | 87 | 60 | 7938 | kinetic 51, heat 0, electrical 35, chemical 0, radiation 0 |
| phillip | 56.5% | 63 | 66 | 9849 | kinetic 22, heat 41, electrical 0, chemical 0, radiation 0 |
| natalie | 55.1% | 69 | 116 | 7110 | kinetic 33, heat 36, electrical 0, chemical 0, radiation 0 |
| hydra | 53.6% | 91 | 67 | 8469 | kinetic 20, heat 48, electrical 0, chemical 0, radiation 22 |
| kyle | 52.2% | 75 | 69 | 7839 | kinetic 18, heat 0, electrical 57, chemical 0, radiation 0 |
| flora | 50.7% | 86 | 66 | 9020 | kinetic 0, heat 1, electrical 0, chemical 85, radiation 0 |
| sully | 49.3% | 58 | 92 | 8560 | kinetic 18, heat 29, electrical 0, chemical 12, radiation 0 |
| allen | 43.5% | 44 | 84 | 7813 | kinetic 19, heat 5, electrical 20, chemical 0, radiation 0 |
| aaron | 39.1% | 44 | 65 | 9363 | kinetic 20, heat 0, electrical 24, chemical 0, radiation 0 |
| cal | 39.1% | 57 | 76 | 8508 | kinetic 35, heat 10, electrical 0, chemical 11, radiation 0 |
| neo | 37.7% | 58 | 59 | 7313 | kinetic 14, heat 0, electrical 44, chemical 0, radiation 0 |
| oxana | 34.8% | 45 | 76 | 8477 | kinetic 18, heat 13, electrical 0, chemical 14, radiation 0 |
| bord | 31.9% | 68 | 93 | 7999 | kinetic 68, heat 0, electrical 0, chemical 0, radiation 0 |
| helen | 29.0% | 23 | 62 | 7399 | kinetic 23, heat 0, electrical 0, chemical 0, radiation 0 |
| nitra | 27.5% | 60 | 50 | 8288 | kinetic 15, heat 46, electrical 0, chemical 0, radiation 0 |
| lillie | 26.1% | 44 | 83 | 7470 | kinetic 16, heat 27, electrical 1, chemical 0, radiation 0 |
| scarlett | 11.6% | 29 | 45 | 7925 | kinetic 29, heat 0, electrical 0, chemical 0, radiation 0 |

Natalie moved from 20.3% to 55.1% because her own blast no longer throws her off the stage at full force. Flora stays in the band (49.3% to 50.7%). Chroma was not weak once fighters stopped falling through the floor; she is one of the strongest kits.

Still outside 40–60% after the pass: chroma, van, ben, titan, maggie, silas, chloe, carter, aaron, cal, neo, oxana, bord, helen, nitra, lillie, scarlett.

Ben, Titan, Chroma, Van, Maggie, Silas, Chloe, and Carter win by landing more hits over the 16 seconds, not by a curve that can be flattened without erasing hardness, conductivity, or chemical gap. Helen deals about 23 damage a match, almost all short kinetic projectiles, so she loses the percent race even when she keeps her stocks. Scarlett deals about 29 and still loses most stocks at low percent; her dive leaves the stage, and that velocity is part of the move, not the weight formula. Closing that gap means changing those moves, which this pass does not do.

## Free-for-all before

Eight trios, two seatings each. Two matches is too small to tune from. Listed so the batch is on record.

| Fighter | Win rate | Damage dealt | Damage taken | Avg KO time (ms) | Damage dealt by type |
| --- | ---: | ---: | ---: | ---: | --- |
| ben | 100.0% | 128 | 78 | 11933 | kinetic 128, heat 0, electrical 0, chemical 0, radiation 0 |
| chloe | 100.0% | 108 | 30 | 11200 | kinetic 0, heat 0, electrical 0, chemical 108, radiation 0 |
| maggie | 100.0% | 61 | 96 | 3525 | kinetic 15, heat 47, electrical 0, chemical 0, radiation 0 |
| van | 100.0% | 172 | 74 | — | kinetic 43, heat 0, electrical 129, chemical 0, radiation 0 |
| allen | 50.0% | 69 | 73 | — | kinetic 16, heat 15, electrical 39, chemical 0, radiation 0 |
| helen | 50.0% | 34 | 82 | 7609 | kinetic 34, heat 0, electrical 0, chemical 0, radiation 0 |
| hydra | 50.0% | 127 | 51 | 6443 | kinetic 27, heat 67, electrical 0, chemical 0, radiation 34 |
| kyle | 50.0% | 88 | 57 | — | kinetic 16, heat 0, electrical 72, chemical 0, radiation 0 |
| nitra | 50.0% | 149 | 73 | 9617 | kinetic 36, heat 114, electrical 0, chemical 0, radiation 0 |
| oxana | 50.0% | 39 | 80 | 7229 | kinetic 7, heat 19, electrical 0, chemical 13, radiation 0 |
| phillip | 50.0% | 62 | 67 | — | kinetic 13, heat 50, electrical 0, chemical 0, radiation 0 |
| scarlett | 50.0% | 34 | 61 | 13842 | kinetic 31, heat 4, electrical 0, chemical 0, radiation 0 |
| aaron | 0.0% | 35 | 44 | — | kinetic 26, heat 0, electrical 9, chemical 0, radiation 0 |
| bord | 0.0% | 66 | 88 | 3992 | kinetic 66, heat 0, electrical 0, chemical 0, radiation 0 |
| cal | 0.0% | 73 | 77 | 4483 | kinetic 32, heat 19, electrical 0, chemical 22, radiation 0 |
| carter | 0.0% | 69 | 98 | — | kinetic 35, heat 0, electrical 33, chemical 0, radiation 0 |
| chroma | 0.0% | 91 | 117 | 10450 | kinetic 87, heat 4, electrical 0, chemical 0, radiation 0 |
| flora | 0.0% | 74 | 109 | 11433 | kinetic 0, heat 11, electrical 0, chemical 63, radiation 0 |
| lillie | 0.0% | 46 | 79 | — | kinetic 9, heat 37, electrical 0, chemical 0, radiation 0 |
| natalie | 0.0% | 61 | 115 | 8250 | kinetic 27, heat 34, electrical 0, chemical 0, radiation 0 |
| neo | 0.0% | 121 | 65 | 8833 | kinetic 26, heat 0, electrical 96, chemical 0, radiation 0 |
| silas | 0.0% | 75 | 71 | 9983 | kinetic 41, heat 0, electrical 34, chemical 0, radiation 0 |
| sully | 0.0% | 52 | 121 | 11183 | kinetic 13, heat 35, electrical 0, chemical 4, radiation 0 |
| titan | 0.0% | 65 | 137 | 9475 | kinetic 65, heat 0, electrical 0, chemical 0, radiation 0 |

## Free-for-all after

| Fighter | Win rate | Damage dealt | Damage taken | Avg KO time (ms) | Damage dealt by type |
| --- | ---: | ---: | ---: | ---: | --- |
| natalie | 100.0% | 105 | 92 | 10428 | kinetic 43, heat 62, electrical 0, chemical 0, radiation 0 |
| aaron | 50.0% | 52 | 70 | 11783 | kinetic 39, heat 0, electrical 13, chemical 0, radiation 0 |
| allen | 50.0% | 59 | 111 | 8142 | kinetic 3, heat 32, electrical 25, chemical 0, radiation 0 |
| ben | 50.0% | 171 | 112 | 5750 | kinetic 171, heat 0, electrical 0, chemical 0, radiation 0 |
| bord | 50.0% | 104 | 137 | 7200 | kinetic 104, heat 0, electrical 0, chemical 0, radiation 0 |
| cal | 50.0% | 81 | 74 | 7367 | kinetic 28, heat 25, electrical 0, chemical 28, radiation 0 |
| chroma | 50.0% | 71 | 122 | 5017 | kinetic 63, heat 9, electrical 0, chemical 0, radiation 0 |
| hydra | 50.0% | 136 | 85 | 9575 | kinetic 28, heat 75, electrical 0, chemical 0, radiation 34 |
| kyle | 50.0% | 140 | 98 | 8856 | kinetic 25, heat 0, electrical 115, chemical 0, radiation 0 |
| lillie | 50.0% | 62 | 63 | — | kinetic 19, heat 44, electrical 0, chemical 0, radiation 0 |
| nitra | 50.0% | 142 | 52 | 10233 | kinetic 28, heat 115, electrical 0, chemical 0, radiation 0 |
| oxana | 50.0% | 58 | 130 | 11042 | kinetic 26, heat 19, electrical 0, chemical 13, radiation 0 |
| silas | 50.0% | 83 | 59 | 13250 | kinetic 72, heat 0, electrical 12, chemical 0, radiation 0 |
| sully | 50.0% | 102 | 99 | 7742 | kinetic 38, heat 61, electrical 0, chemical 4, radiation 0 |
| titan | 50.0% | 148 | 74 | 9784 | kinetic 146, heat 2, electrical 0, chemical 0, radiation 0 |
| carter | 0.0% | 88 | 113 | — | kinetic 61, heat 0, electrical 27, chemical 0, radiation 0 |
| chloe | 0.0% | 73 | 58 | — | kinetic 0, heat 0, electrical 0, chemical 73, radiation 0 |
| flora | 0.0% | 100 | 118 | 6500 | kinetic 0, heat 11, electrical 0, chemical 89, radiation 0 |
| helen | 0.0% | 44 | 101 | 7017 | kinetic 44, heat 0, electrical 0, chemical 0, radiation 0 |
| maggie | 0.0% | 33 | 81 | — | kinetic 9, heat 25, electrical 0, chemical 0, radiation 0 |
| neo | 0.0% | 93 | 107 | 10367 | kinetic 20, heat 0, electrical 73, chemical 0, radiation 0 |
| phillip | 0.0% | 97 | 72 | — | kinetic 29, heat 69, electrical 0, chemical 0, radiation 0 |
| scarlett | 0.0% | 49 | 98 | 10634 | kinetic 45, heat 4, electrical 0, chemical 0, radiation 0 |
| van | 0.0% | 110 | 133 | — | kinetic 28, heat 0, electrical 82, chemical 0, radiation 0 |
