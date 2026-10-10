import { writeFileSync, mkdirSync } from 'node:fs';
import { ROSTER } from '../src/data/characters.js';
import { classifyRoster } from '../src/data/attackFx.js';

const rows = classifyRoster(ROSTER);
const by = (key) => {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] || 0) + 1;
  return counts;
};
const types = by('objectType');
const families = by('family');
const scores = by('score');
const drawn = by('drawn');

const worst = [...rows].sort((a, b) => (a.score - b.score) || (b.width * b.height - a.width * a.height) || a.fighterId.localeCompare(b.fighterId) || a.move.localeCompare(b.move));
const worst30 = worst.slice(0, 30);

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const headers = [
  'fighter_id', 'fighter', 'slot', 'move', 'object_type', 'drawn', 'drawn_detail',
  'width_px', 'height_px', 'rotation', 'animation', 'score', 'folder', 'spec', 'notes', 'family',
];
const csv = [headers.join(',')].concat(rows.map((row) => [
  row.fighterId, row.fighter, row.slot, row.move, row.objectType, row.drawn, row.drawnDetail,
  row.width, row.height, row.rotation, row.animation, row.score, row.folder, row.spec, row.notes, row.family,
].map(csvCell).join(','))).join('\n') + '\n';

function countLine(map) {
  return Object.entries(map).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => `${name}: ${n}`).join(', ');
}

const lines = [];
lines.push('# Attack effect inventory');
lines.push('');
lines.push('Every move on the 118-fighter roster puts something on screen besides the idle body. This list is that something: the shot, the throw, the beam, the extender, the burst, the slash, or the shield.');
lines.push('');
lines.push(`There are **${rows.length}** effects. Scores were given by looking at a capture of each drawing family. Moves that share a family are the same picture in a different color or size, so they share that score.`);
lines.push('');
lines.push('## Counts');
lines.push('');
lines.push(`- By type: ${countLine(types)}`);
lines.push(`- By how they are drawn: ${countLine(drawn)}`);
lines.push(`- By score: ${countLine(scores)}`);
lines.push(`- By family: ${countLine(families)}`);
lines.push('');
lines.push('## Scores');
lines.push('');
lines.push('- **1** — a placeholder. A star, a flat bar, a circle, or a puff of the same sparks, with nothing of the named object in it.');
lines.push('- **2** — still code, but the shape is recognizable: a spear point, a balloon, a wind chevron, a gust of streaks, or a slash stroke.');
lines.push('- **3** — the swing is carried by the fighter’s attack sheet, which is real sprite art, with a code slash still drawn on top.');
lines.push('- **4** — a dedicated effect image that reads as the object.');
lines.push('- **5** — a dedicated animated effect image.');
lines.push('');
lines.push('Nothing in the game is a 4 or a 5 yet. Those scores are what a dropped-in PNG is for.');
lines.push('');
lines.push('## Drop-in art');
lines.push('');
lines.push('Put a transparent PNG in the folder named in the spec. The game picks it up on the next match and stops drawing the code version for that move. The hit shape becomes the alpha of the image, packed on a 5 pixel grid, the same grid the body masks use. Pixels with alpha at or below 50% are empty. No file in the folder means the old drawing and the old hit stay.');
lines.push('');
lines.push('Beams and extenders prefer three files: `cap-start.png`, `tile.png`, and `cap-end.png`. The tile repeats along the length. A lone `object.png` is used when those three are absent. Every other type uses `object.png`. `frame-0.png` through `frame-7.png` replace the still image and play at 8 frames a second.');
lines.push('');
lines.push('Art points right. A projectile or a burst pivots at its center. A slash or an extender pivots at the left center, which stays on the hand while the image aims outward. Beam caps pivot at the seam: start and tile on the left center, end cap on the right center.');
lines.push('');
lines.push('The folder list is served at `/fx-index`. The loader only fetches files that are actually there.');
lines.push('');
lines.push('## Worst 30');
lines.push('');
lines.push('These are the lowest scores, and among the placeholders the largest on screen. The contact sheet is `docs/attack-fx-worst30.png`.');
lines.push('');
lines.push('| # | Fighter | Move | Type | On screen | Score |');
lines.push('| --- | --- | --- | --- | --- | --- |');
worst30.forEach((row, i) => {
  lines.push(`| ${i + 1} | ${row.fighter} | ${row.move} | ${row.objectType} | ${row.width}×${row.height} | ${row.score} |`);
});
lines.push('');
lines.push('## Every effect');
lines.push('');
lines.push('| Fighter | Move | Type | Drawn | Size | Rotation | Animation | Score |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const row of rows) {
  const drawnText = `${row.drawn}: ${row.drawnDetail}`;
  lines.push(`| ${row.fighter} | ${row.move} | ${row.objectType} | ${drawnText} | ${row.width}×${row.height} | ${row.rotation} | ${row.animation} | ${row.score} |`);
}
lines.push('');
lines.push('## Replacement spec');
lines.push('');
for (const row of rows) {
  lines.push(`### ${row.fighter} — ${row.move}`);
  lines.push('');
  lines.push(row.spec);
  if (row.notes) lines.push('');
  if (row.notes) lines.push(row.notes);
  lines.push('');
}

mkdirSync('docs', { recursive: true });
writeFileSync('docs/attack-fx-inventory.md', lines.join('\n'));
writeFileSync('docs/attack-fx-inventory.csv', csv);
writeFileSync('/tmp/fx-worst.json', JSON.stringify(worst30, null, 2));
console.log('effects', rows.length);
console.log('types', types);
console.log('scores', scores);
console.log('drawn', drawn);
console.log('worst', worst30.map((row) => `${row.score} ${row.fighterId} ${row.move} ${row.width}x${row.height} ${row.family}`).join('\n'));
