# Animation art needed

## Drop-in move clips

The game loads an optional strip for any move without a code change. If the file or the manifest is missing, the fighter stays on the idle sheet (or the cutout) and the existing telegraph plays: a bob while charging, a squash while defending. The effects layer (`src/engine/MoveVfx.js`) is drawn on the scene, above the fighter, and stays on top of the strip.

Put files here:

```
public/assets/sprites/moves/<characterId>/manifest.json
public/assets/sprites/moves/<characterId>/<moveKey>.png
```

`characterId` is the roster id (`hydra`, `helen`, `lillie`, …). `moveKey` is one of:

| moveKey | Slot |
| --- | --- |
| `basicCharge` | hold normal, no direction |
| `basicDirectional` | normal + direction |
| `specialDefense` | hold special, no direction |
| `specialDirectional` | special + direction |

The strip is horizontal, left to right, one cell per frame. Frame count is 1–8 and comes from the manifest, not from the filename.

```json
{
  "moves": {
    "basicDirectional": { "frames": 3 }
  }
}
```

Cell size, `footY`, and `visibleH` default to that character's **idle** cell (not the walk cell). Override them on the manifest or on one move when a strip uses a different crop:

```json
{
  "cellW": 609,
  "cellH": 720,
  "footY": 0.9823,
  "visibleH": 668,
  "moves": {
    "basicCharge": { "frames": 8 },
    "specialDefense": { "frames": 4, "cellW": 609, "cellH": 720 }
  }
}
```

`footY` is a Phaser origin from 0 to 1, the same value as the idle clip. Feet sit on it. It is not a pixel row. `visibleH` is the head-to-feet body inside the cell, excluding hair and effects, the same convention as `bodyH` on the idle sheet. The fighter is scaled so that body matches `art.height` on every clip. `cellW` and `cellH` are the pixel size of one frame.

1 frame: the cell stays put and the body squashes, stretches, and lunges through anticipation, strike, and recovery. 2 frames: anticipation, then the strike, crossfaded. 3 frames: anticipation, strike, recovery, crossfaded, with the same squash and stretch. 4–8 frames: the strip is scrubbed across the move (`floor(t × count)`, last frame at the end). Defense loops. A charge scrub follows how full the charge is.

Every roster move needs its own sprite clip. The sheets on disk are idle loops, plus a walk cycle for Hydra, Helen, Lillie, Ben, Bord, Carter, Nitra, Flora, Neo, and Natalie. Walk is a locomotion cycle. It does not read as a dash, a punch, a cast, or a guard, so it is not reused for any move. Idle is not reused as an attack pose either.

Until a clip below exists, the fighter stays on the idle sheet. Charging adds a small vertical bob and defending braces the sprite inward without changing its height, so the state is visible. The move itself is drawn by the effects layer (`src/engine/MoveVfx.js`): typed color, windup, hit flash, and a shape for the kind of move (burst, beam, projectile, wall, shield). That placeholder is temporary. It is not a stand-in pose.

Generate each clip as a horizontal strip, **8 frames**, at the **idle cell size** listed for that character (not the walk cell, which is cropped differently). Play attack and special strips once, scrubbed across the move. Loop the defense and buff strips. Feet should sit on the same `footY` as that character's idle clip so the body does not pop when the clip changes.

Slots: Charge = hold normal. Normal = normal + direction. Defense = hold special. Special = special + direction.

## Hydra (Hydrogen) — idle 609×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Supernova | Charge | 8 | 609×720 | Arms thrown wide, head back, torso swelling with white-hot light, then a collapse as the blast leaves her. She is hurt by her own flash. |
| Flame Dash | Normal | 8 | 609×720 | Deep crouch into a full-body horizontal streak, fire trailing the feet, then a short skid. |
| Fire Wall | Defense | 8, loop | 609×720 | Feet planted, one palm thrust forward. A vertical slab of flame stands in front of her and she holds it. |
| Hydrogen Bomb | Special | 8 | 609×720 | Two-handed overhead throw of a small glowing core, full follow-through. The mushroom cloud is an effect, not part of the body. |

## Helen (Helium) — idle 446×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Balloon Bop | Charge | 8 | 446×720 | Both hands cupped at the mouth, cheeks puffed, blowing a swelling round bubble forward. |
| Noble Gust | Normal | 8 | 446×720 | A short one-arm sweep. Coat and hair snap back. Light, not a heavy punch. |
| Bubble Shield | Defense | 8, loop | 446×720 | Pulls a soap bubble closed around her whole body and floats inside it. |
| Air Wave | Special | 8 | 446×720 | Both palms shove a horizontal crescent of air. Wide stance, strong follow-through. |

## Lillie (Lithium) — idle 620×720

Her move names and numbers stay as they are in game. She still has no attack sheets.

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Volt Dash | Charge | 8 | 620×720 | Coils, then a low electric dash, sparks along the limbs, short recovery. |
| Spark Jab | Normal | 8 | 620×720 | A quick lead-hand jab with a small spark at the knuckle. Compact, not a haymaker. |
| Reactive Armor | Defense | 8 | 620×720 | Braces as a tarnish flash coats her, then a sharp retaliatory shove. One-shot, not a held wall. |
| Water Reaction | Special | 8 | 620×720 | Slams both hands down. A heat burst blooms around her feet. She stays at the center. |

## Ben (Beryllium) — idle 720×1280

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Resonant Strike | Charge | 8 | 720×1280 | Stands almost rigid, draws one fist back, then a stiff straight punch. A second smaller shock leaves the fist at full charge. |
| Precision Strike | Normal | 8 | 720×1280 | A measured thrust. The sweet spot is the extended tip of the fist, not a wild swing. |
| Rigid Stance | Defense | 8, loop | 720×1280 | Feet together, spine straight, forearms crossed. He barely flexes. Kinetic hits stop dead. |
| Gyro Disc | Special | 8 | 720×1280 | A flat underhand flick that launches a disc. The body stays balanced and upright. |

## Bord (Boron) — idle 639×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Heavy Ram | Charge | 8 | 639×720 | Shoulder drops, then a short armored charge. Weight stays low. Not a leap. |
| Crystal Smash | Normal | 8 | 639×720 | Two-handed overhead smash with the crystal maul, from a high windup to a ground impact. |
| Boron Carbide Wall | Defense | 8, loop | 639×720 | Locks into a wide braced wall, shield-first. Cracks can show across later loop frames. |
| Ground Shatter | Special | 8 | 639×720 | Stomps. The ground in front of him breaks in a ring. He stays planted. |

## Carter (Carbon) — idle 928×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Diamond Shard | Charge | 8 | 928×720 | Pinches a bright shard between two fingers and flicks it. The shard grows if the charge is held. |
| Diamond Cross | Normal | 8 | 928×720 | Two sharp diagonal slashes that cross in front of the chest. |
| Diamond Plating | Defense | 8, loop | 928×720 | Arms fold in. Faceted plates lock over the torso. He holds still. |
| Graphene Wave | Special | 8 | 928×720 | One arm sweeps flat. A thin electrical sheet peels off the hand and spreads. |

## Nitra (Nitrogen) — idle 915×703

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Nitrogen Rush | Charge | 8 | 915×703 | A cold forward rush, body low, frost peeling off the shoulders. |
| Frost Fang | Normal | 8 | 915×703 | A biting claw swipe across the body. Ice clings to the hand. |
| Inert Shield | Defense | 8, loop | 915×703 | Curls inside a pale glassy shell. One hit pops it. |
| Cryo Vortex | Special | 8 | 915×703 | Spins once, arms out, leaving a low sliding frost disc on the ground. |

## Oxana (Oxygen) — idle 664×719

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Bellows Breath | Charge | 8 | 664×719 | Inhales big, then exhales a focused gust from the mouth. Chest leads. |
| Vortex Kick | Normal | 8 | 664×719 | A spinning heel kick, one full rotation, landing on the standing foot. |
| Ozone Layer | Defense | 8, loop | 664×719 | Arms lift. A thin blue shell closes over her and she holds it. |
| Oxidation Burst | Special | 8 | 664×719 | Palms out, a rust-orange chemical flash expanding from the chest. |

## Flora (Fluorine) — idle 852×696

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Pale Yellow Jet | Charge | 8 | 852×696 | Leans in and fires a pale-yellow chemical jet from both hands. |
| Etching Jab | Normal | 8 | 852×696 | A short corrosive jab. The fingertip eats a small pit into the air in front of her. |
| Teflon Coat | Defense | 8, loop | 852×696 | Smooth pale coat slides over the body. She looks slick and ungrabbable, not armored. |
| Radical Cascade | Special | 8 | 852×696 | A snap of the wrist that throws one chemical burst, then two smaller ones chasing it. |

## Neo (Neon) — idle 511×705

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| High-Voltage Tube | Charge | 8 | 511×705 | Grips a tube in both hands. It flares from a short orange line into a long beam. |
| Staff Crack | Normal | 8 | 511×705 | A staff crack across the body, one sharp hit, electrical snap at the tip. |
| No Vacancy | Defense | 8, loop | 511×705 | Holds a lit "no vacancy" guard, one arm barring the front. The last frames should read as the sign going dark when the guard ends. |
| Neon Flash | Special | 8 | 511×705 | Throws both hands up. A blinding orange flare fills the space around him. |

## Natalie (Sodium) — idle 496×699

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Lake Drop | Charge | 8 | 496×699 | Rises onto the toes, then drops into a crouch as water and flame crash down on her own spot. |
| Flame Fist | Normal | 8 | 496×699 | A burning straight punch. The fist is the brightest part. |
| Oil Bath | Defense | 8, loop | 496×699 | Slicks her arms with oil and holds a low guard. The body should look slippery, not braced like a wall. |
| Brine Burst | Special | 8 | 496×699 | A violent two-handed detonation of boiling brine in front of her. Big knockback pose, feet sliding. |

## Maggie (Magnesium) — idle 728×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Unquenchable | Charge | 8, loop | 728×720 | Stands in a white-hot flare that will not go out. Arms slightly out, chin up, fire clinging to the body. |
| Flare Jab | Normal | 8 | 728×720 | A fast jab with a white flare at the knuckles. |
| Ribbon Guard | Defense | 8, loop | 728×720 | Crosses burning ribbons over the chest and holds them. A heat hit makes the ribbons snap outward. |
| Blinding Flare | Special | 8 | 728×720 | Covers her eyes with one arm and throws the other wide as a white flash pops. |

## Allen (Aluminum) — idle 922×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Thermite Burn | Charge | 8 | 922×720 | Aims one arm like a nozzle. A thick white-orange thermite beam leaves the palm. |
| Turbine Strike | Normal | 8 | 922×720 | Three fast spinning strikes, arms like turbine blades. The strip should read as a multi-hit, not one punch. |
| Oxide Skin | Defense | 8, loop | 922×720 | A dull oxide skin grows over the body. He holds still inside it. Chemical attacks fizzle on the skin. |
| Turbine Vortex | Special | 8 | 922×720 | Spins in place, pulling the air (and nearby fighters) inward. Feet stay down. |

## Silas (Silicon) — idle 720×1280

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Overclock | Charge | 8 | 720×1280 | Circuits along the arms light up in sequence. At the end he flinches from his own heat. The pose is a power-up, not an attack. |
| Crystal Blade | Normal | 8 | 720×1280 | A clean downward cut with a glassy blade grown from the forearm. |
| Silica Pane | Defense | 8, loop | 720×1280 | Holds a transparent pane in front of the torso like a window. Kinetic hits bounce off it. |
| Binary Surge | Special | 8 | 720×1280 | Two-beat cast: a first electrical pulse from the hand, then a second pulse if the first missed. |

## Phillip (Phosphorus) — idle 466×716

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Strike Anywhere | Charge | 8 | 466×716 | Strikes a match-tip finger forward. The flame pops in front of him, not on his body. |
| Glow Strike | Normal | 8 | 466×716 | A glowing punch. The struck spot should read as catching fire. |
| Red Phosphorus Form | Defense | 8, loop | 466×716 | Skin shifts to dull red and he tucks in. He looks stable, not burning. |
| Spontaneous Ignition | Special | 8 | 466×716 | Snaps alight and stamps a patch of fire onto the ground beside him. |

## Sully (Sulfur) — idle 603×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Black Powder | Charge | 8 | 603×720 | Packs a charge in one hand and shoves it forward. A powder blast goes off in front of the fist. |
| Brimstone Slam | Normal | 8 | 603×720 | A heavy two-handed downward slam. Rock and sulfur dust at the impact. |
| Vulcanized Rubber | Defense | 8, loop | 603×720 | Body goes rubbery and dark. A kinetic hit should read as bouncing off him, not sinking in. |
| Volcanic Eruption | Special | 8 | 603×720 | Chest erupts upward. Heat and chemical smoke billow out and up. |

## Chloe (Chlorine) — idle 401×703

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Bleach Out | Charge | 8 | 401×703 | Flicks a pale chemical shot from the fingertips. The follow-through is a wipe, like cleaning a stain off the air. |
| Toxic Jab | Normal | 8 | 401×703 | A mean short jab. A green wisp hangs off the knuckle. |
| Salt Bond | Defense | 8 | 401×703 | Catches an incoming hit and locks the attacker in place for a beat. A grab-and-hold, not a shield loop. |
| Gas Cloud | Special | 8 | 401×703 | Crouches and releases a low yellow-green cloud that sits on the ground. She steps back out of it. |

## Aaron (Argon) — idle 549×700

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Lazy Haymaker | Charge | 8 | 549×700 | A slow, heavy windup into one big looping punch. The windup should look lazy on purpose. |
| Inert Guard Strike | Normal | 8 | 549×700 | Strikes while the other arm stays glued to his cheek, guarding. Half attack, half cover. |
| Shield Gas | Defense | 8, loop | 549×700 | A clear gas shell closes around him. He looks bored inside it. |
| Noble Discharge | Special | 8 | 549×700 | A reluctant full-body electrical discharge, shoulders shrugged, then a bright snap. |

## Kyle (Potassium) — idle 551×710

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Action Potential | Charge | 8 | 551×710 | A nerve impulse runs from the shoulder to the pointing hand, then a fast shot leaves the finger. Early frames should look like a failed twitch if the charge is short. |
| Static Cross | Normal | 8 | 551×710 | Two quick crossing chops, static jumping between the hands. |
| Ion Channel | Defense | 8 | 551×710 | Opens a channel with both hands. An electrical or kinetic hit is caught and fired back. |
| Nerve Shock | Special | 8 | 551×710 | A short-range shock that locks the target's limbs. His own pose is a stiff outward jerk. |

## Cal (Calcium) — idle 428×698

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Calcify | Charge | 8, loop | 428×698 | Bone plates grow over the shoulders and chest. He sets his jaw. A buff pose, not a swing. |
| Bone Crush | Normal | 8 | 428×698 | A heavy downward crush with both fists. Extra force when it lands on someone who is guarding. |
| Quick-Set Cement | Defense | 8, loop | 428×698 | Stamps a wet cement wall up in front of him and holds the trowel hand out. Someone who touches it early sticks. |
| Marrow Burst | Special | 8 | 428×698 | Cracks his own guard open. Heat and chemical spray out in a short radius. |

## Scarlett (Scandium) — idle 726×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Afterburner | Charge | 8 | 726×720 | Wings tuck, then she rockets along the way she is facing. A jet trail stays behind the feet. |
| Wing Slash | Normal | 8 | 726×720 | One wing cuts a wide horizontal arc. The wing is the weapon, the arms stay in. |
| Folded Wings | Defense | 8, loop | 726×720 | Wings fold tight over the body like a shield. A perfectly timed catch turns a projectile back. |
| Aerial Dive | Special | 8 | 726×720 | A hop, wings open, then a steep dive with both feet aimed down. The landing is the hit. |

## Titan (Titanium) — idle 698×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Titanium Ram | Charge | 8 | 698×720 | Shoulder-first ram. Short, heavy, a little heat on the pauldron. |
| Lance Jab | Normal | 8 | 698×720 | A long one-handed lance thrust. The reach is the point: arm fully extended, body behind it. |
| Aerospace Plating | Defense | 8, loop | 698×720 | Plates lock. He does not slide when hit. Chemical splashes sheet off the chest. |
| Aero Lance | Special | 8 | 698×720 | Hurls a spearhead that keeps flying after the first hit. The throw is overhand and clean. |

## Van (Vanadium) — idle 1222×720

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Redox Flow | Charge | 8, loop | 1222×720 | Color runs through the body (green to violet) as he stores a charge. Hands open, no swing. |
| Alloy Fist | Normal | 8 | 1222×720 | A compact alloy punch that breaks a weak guard. The fist changes color on impact. |
| Four-State Guard | Defense | 8, loop | 1222×720 | Four-beat guard. Each pair of frames shifts color: blue, green, orange, gold. He does not leave the stance. |
| Prism Surge | Special | 8 | 1222×720 | Both hands drive an electrical prism burst forward. The body stays square. |

## Chroma (Chromium) — idle 883×707

| Move | Slot | Frames | Size | Pose |
| --- | --- | --- | --- | --- |
| Ruby Laser | Charge | 8 | 883×707 | Sights along one arm. A thin red beam extends farther the longer it is held. |
| Chrome Edge | Normal | 8 | 883×707 | A hard horizontal chop with a mirror-bright forearm. |
| Mirror Chrome | Defense | 8, loop | 883×707 | Turns side-on. The chrome chest becomes a mirror. Projectiles should read as bouncing off it. |
| Prismatic Shatter | Special | 8 | 883×707 | Slams the ground. A ring of chrome shards kicks outward and he stays in the crater pose. |
