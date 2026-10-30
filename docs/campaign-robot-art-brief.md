# Robot art brief (Gemini): ONE robot body for every enemy in the Silas campaign

## Why one body
In the campaign story ("The Static Collars"), Silas's AI, the Overseer, enslaves the elements and puts each one inside a robot.
Every enemy robot is the SAME shape. The game colours it per element at runtime (a multiply tint, one colour per element), and the
robot fights with that element's real moves. So we need exactly **one robot base**, drawn in a neutral, tintable way, and animated once.
Frames made for this body are reused for ~20 different elements, and the Overseer boss is the same body scaled up 1.5x.

## What to deliver (all files into `assets/campaign/robot/`)
Every sheet is one horizontal strip, left to right, one cell per frame, **768 x 768 px per cell**, transparent background (PNG).
The robot faces **RIGHT** in every frame. Feet on the same line in every cell: 98% of the cell height from the top (y = 753 of 768).
The robot is about **700 px tall** (head to feet) inside the cell, so it fills the cell vertically with a small margin. Keep it centred in x.
Do not let anything touch the cell edge, and do not let the body drift between frames except for the intended movement.

| File | Frames | Size of the PNG | Plays | Notes |
|------|--------|-----------------|-------|-------|
| `robot_idle.png`   | 8  | 6144 x 768 | loop, 8 fps  | Standing guard: small chest/shoulder breathing, a slow glow pulse in the core. Frame 1 = frame 8 loop-wise. |
| `robot_walk.png`   | 12 | 9216 x 768 | loop, 10 fps | Heavy but quick march, full leg cycle, arms swing a little. In place (no travel across the cell). |
| `robot_attack.png` | 8  | 6144 x 768 | once, 14 fps | One generic attack: wind-up (frames 1-3), thrust/cast with both arms forward (4-5), follow-through and recover (6-8). The game draws each element's real move effect (fire, ice, lightning...) on top, so the pose must read for BOTH a melee strike and a cast. |
| `robot_hit.png`    | 4  | 3072 x 768 | once, 12 fps | Flinch: lean back, panels rattle, recover. |
| `robot-cut.png`    | 1  | 768 x 768    | still        | A single clean cut-out of the idle pose (used for portraits, loading and fallback). |

If a strip comes out at a different cell size, tell us the size, the foot line and the height of the robot: the game takes those three numbers
(`frameW/frameH`, `footY`, `visibleH` in `src/campaign/robots.js`). The numbers above are what the code expects today.

## What the robot looks like
- A friendly-but-menacing **humanoid industrial robot**, about hero-sized, on two legs, two arms. Built for a bright, family-friendly game:
  no blood, no gore, no weapons that look like real guns, nothing scary for children. Think "a stern factory worker robot".
- Modest and neutral: a fully armoured, plated body with a smooth faceplate. **No human face, no skin, no hair, no clothing.** A single
  curved visor or a row of round "eyes" for a face. A short **collar ring around the neck** (the glowing "Static Collar"), as a story element.
- Same render style as the fighter roster so it sits beside them on the map: clean, slightly stylised 3D-render look (soft rim light,
  crisp outline-free edges), not photoreal, not flat pixel art.
- Silhouette must be readable at about 48 px tall on the map: wide shoulder plates, a clear head, chunky boots, an obvious chest core.
- Simple shapes: few panels (shoulders, chest, forearms, shins, helmet) so animation frames stay consistent from frame to frame.

## Colours: this is the important part (it must be tintable)
The game multiplies the whole sprite by the element's colour (e.g. orange for Sodium-Bot, deep blue for Nitrogen-Bot). Multiply keeps
darks dark and turns light greys into the element colour. So:
1. **Armour panels: a light, neutral, cool grey (about #D8DCE2), almost white, with soft shading.** No hue at all. These become the element colour.
2. **Joints, undersuit, cables, soles: dark charcoal (about #2A2F38).** These stay dark under any tint.
3. **Glowing parts (visor, chest core, collar ring): near-white (about #F4F8FF).** They become a bright version of the element colour.
4. **No other colours anywhere**: no red, no logos, no coloured stripes, no text. Pure greys plus white glow.
5. Light and shadow stay as grey shading on the panels (that is what gives the tinted robot its volume).

## Prompt for Gemini (image generation), base pose
> A single full-body humanoid industrial robot, standing, facing right, three-quarter view, in the style of a polished stylised 3D game
> character render. Smooth light-grey armour plates (neutral cool grey, nearly white, no colour tint) on shoulders, chest, forearms and shins;
> dark charcoal joints, cables and boots; a smooth faceplate with one horizontal glowing white visor; a thin glowing white collar ring at the
> neck and a round glowing white core in the chest. Friendly family-friendly design, fully armoured, no human face, no skin, no clothing, no
> weapons, no text, no logos, no other colours. Soft studio rim lighting. Plain flat solid magenta (#FF00FF) background. Whole robot visible,
> head to feet, feet touching an imaginary ground line near the bottom, about 90% of the image height. Square 1:1 image.

Then, keeping the SAME robot (upload the base image as the reference every time), ask for the animation frames:
- "Same robot, same camera, same scale and foot position, standing idle, breathing pose B" (repeat for 8 frames).
- "Same robot, walk cycle frame N of 12, facing right, feet on the same ground line".
- "Same robot, attack frame N of 8: wind-up / thrust both arms forward / recover".
- "Same robot, hit reaction frame N of 4: flinching backward".
Keep the magenta background in every frame so it can be keyed out, then assemble the strips and cut the background to transparent.
After the first image, check the grey is truly neutral (no blue/yellow cast), because any cast gets multiplied into every element's colour.

## How it plugs in (nothing else to change)
1. Put the 5 files above into `assets/campaign/robot/`.
2. In `src/campaign/robots.js` set `ROBOT_ART_READY = true` (and adjust `footY/visibleH/displayScale` there only if the delivered sheets differ).
3. The tint is applied in the scene to the idle, walk, attack and hit sprites and survives hit-flashes. Colours are the fighters' own palette
   colours (`CHARACTERS[id].palettes[0].body`), so there is nothing to author per element.

## Until then
Robots wear a clearly marked placeholder: Silas's existing sheets, flat-tinted (so they look like dark, element-coloured Silas clones). This is
only so the campaign is playable and testable now. It is not meant to ship.
