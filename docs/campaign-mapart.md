# Campaign map art

Ten terrain/building tiles for the campaign grid map live in `assets/campaign/tiles/*.jpg`
(512 px, what the game loads): plain, forest, mountain, water, wall, fort, village, throne, road, floor.

## Current set: Gemini
The tiles are Gemini renders (2048 px originals kept on the box under `art-src/campaign/gemini/*.png`,
not committed because they are ~59 MB; 1024 px JPG copies of the untouched renders are committed in
`art-src/campaign/gemini-1024/`). The runtime tiles are those renders downscaled to 512 px.
Plain, forest, mountain, floor and water were made seamless (half-tile offset cross-blend) so repeated
tiles do not show seams; the road is seamless along its length only (the scene rotates it to follow
the road, see `drawMap` in `CampaignBattleScene.js`). Fort, village, throne and wall are single
"building" tiles and are left as rendered.

## Earlier set
The first placeholder set (box image generator, glowing teal style) is kept in `art-src/campaign/full/`.

To replace a tile, drop a square JPG with the same name into `assets/campaign/tiles/`. No code change needed.
