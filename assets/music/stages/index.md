# Smash Ring stage music (Hydra)

All tracks are seamless loops (reverb tails folded onto the start), original material from the repo numpy synth. Mastered to -19 LUFS integrated, TP ceiling -2 dBTP; values below are measured on the ENCODED files (ffmpeg ebur128, true peak). Prefer OGG for looping (MP3 adds ~40 ms encoder padding).

| Stage id | Name | Key | BPM | Loop | OGG LUFS / TP | MP3 LUFS / TP | Lead / bass / arp | Mood |
|---|---|---|---|---|---|---|---|---|
| `elemental-isle` | Elemental Isle | A major | 124 | 69.7s (36 bars) | -19.0 / -6.6 dBTP | -19.5 / -7.1 dBTP | steelpan / bass / marimba | Breezy, bright and optimistic: steel-pan hook over marimba arpeggios and shaker, an island-hop starter stage. |
| `twin-peaks` | Twin Peaks | B minor | 144 | 73.3s (44 bars) | -19.1 / -7.7 dBTP | -19.6 / -7.9 dBTP | horn+flute / bass / pluck | Mysterious-heroic dusk duel: horn and flute answer each other from the left and right peaks over a driving rock beat. |
| `the-core` | The Core | Bb minor | 118 | 73.2s (36 bars) | -19.0 / -5.9 dBTP | -19.5 / -5.5 dBTP | buzz / reese / fmep | Heavy reactor groove: pulsing reese bass, half-time backbeat, metallic clanks and a buzzing square lead; menacing but playful. |
| `crystal-spire` | Crystal Spire | Eb lydian | 150 | 70.4s (44 bars) | -19.2 / -5.1 dBTP | -19.7 / -6.4 dBTP | supersaw / pbass / glass | Shimmering and soaring: fast glassy arpeggios and a supersaw lead climbing the spire, bright lydian colour over a four-on-the-floor beat. |
| `hydrogen-breakout` | Hydrogen Breakout | F# minor | 164 | 64.4s (44 bars) | -19.1 / -6.8 dBTP | -19.6 / -7.8 dBTP | synthlead / pbass / pluck | Tense lab-escape chase: breakbeat 2-step, fast pulse-bass, urgent saw lead and alarm-bell blips under dark strings. |
| `silicon-foundry` | Silicon Foundry | G# minor | 108 | 80.0s (36 bars) | -19.1 / -6.6 dBTP | -19.5 / -7.7 dBTP | grit / distbass / marimba | Mechanical factory stomp: machine-like distorted bass and gritty lead, clanking anvils and heavy brass hits on the cargo lift. |
| `brimstone-caldera` | Brimstone Caldera | Eb phrygian | 136 | 77.7s (44 bars) | -19.2 / -6.6 dBTP | -19.6 / -7.2 dBTP | lowbrass / dist2 / spicc | Volcanic and epic: war-drum taiko, crushing low brass and choir hits in dark phrygian; hot but cartoonish, not scary. |
| `neon-nexus` | Neon Nexus | F# major | 112 | 77.1s (36 bars) | -19.1 / -5.1 dBTP | -19.6 / -5.5 dBTP | fmep / acid / pluck | Rainy neon-city synthwave: gated snare, acid bass, plucked 8th arps and an electric-piano lead, glossy and a little nostalgic. |
| `holdout-keep` | Holdout Keep | Bb major | 138 | 76.5s (44 bars) | -19.1 / -6.6 dBTP | -19.6 / -6.2 dBTP | trumpet / bass / spicc | Heroic castle-rampart anthem at sunset: trumpet fanfare, galloping staccato strings, war drums and choir swells; triumphant last stand. |
| `carbon-skyhook` | Carbon Skyhook | B major | 172 | 61.4s (44 bars) | -19.2 / -6.2 dBTP | -19.7 / -7.1 dBTP | lead / pbass / pluck | Soaring orbital-climb trance: gated supersaw offbeat chords, plucked 16th arps, chip-pulse lead with choir and bell doubles; fast and uplifting. |

Files: `<stage-id>.ogg` and `<stage-id>.mp3` in this folder. Scripts: `engine.py`, `specs.py`, `run_compose.py`, `master_and_index.py` (WAV intermediates in `wav/`).
