# Campaign map art

Ten terrain/building tiles for the campaign grid map live in `assets/campaign/tiles/*.jpg`
(512 px, what the game loads). Full 1024 px originals are in `art-src/campaign/full/`.

Tiles: plain, forest, mountain, water, wall, fort, village, throne, road, floor.

Generated 2026-10-29 with the box's image generator (not Gemini web, which needs a signed-in
browser session). To replace any tile with a Gemini render, drop a square image with the same
file name into `assets/campaign/tiles/` (512 px, JPG). No code change needed.

Style anchor prompt (plain tile), reused as the reference image for every other tile:
"single square game map tile for a tactics RPG, top-down three-quarter view, hand-painted stylised look,
faint sci-fi atomic glow with cyan star-flowers, soft even lighting from the upper left, fills the whole
square edge to edge, no border, no text, no characters, tiles seamlessly."
Per tile: forest (dense teal/emerald trees), mountain (violet-grey peak, snow caps, cyan veins),
water (deep blue-teal ripples), wall (slate-blue crenellated fortress wall), fort (stone gatehouse tower,
pink banner), village (terracotta cottages, lantern), throne (golden throne, crimson carpet), road (dirt road,
left-to-right), floor (slate flagstones with cyan seams).
