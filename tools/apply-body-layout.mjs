// Write measured bodyH / footY / displayScale into characters.js.
// Idle values live on the sheet. Walk values live on the walk clip.
import { readFileSync, writeFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('/tmp/ak-body/report.json', 'utf8'));
let src = readFileSync('src/data/characters.js', 'utf8');

function scale(height, bodyH) {
  return Number((height / bodyH).toFixed(5));
}

for (const row of report) {
  const at = src.indexOf(`id: '${row.id}'`);
  if (at < 0) throw new Error(`missing ${row.id}`);
  const end = src.indexOf('\n  },\n', at);
  const blockEnd = end < 0 ? src.length : end;
  let block = src.slice(at, blockEnd);
  const displayScale = scale(row.height, row.bodyH);
  if (row.clip === 'idle') {
    const replaced = block.replace(
      /footY: [0-9.]+,\n(\s*)visibleH: [0-9]+,/,
      `footY: ${row.footY},\n$1visibleH: ${row.bodyH},\n$1bodyH: ${row.bodyH},\n$1displayScale: ${displayScale},`,
    );
    if (replaced === block) throw new Error(`idle layout not found for ${row.id}`);
    block = replaced;
  } else if (row.clip === 'walk') {
    const replaced = block.replace(
      /walk: \{([^}]*?)footY: [0-9.]+, visibleH: [0-9]+/,
      `walk: {$1footY: ${row.footY}, visibleH: ${row.bodyH}, bodyH: ${row.bodyH}, displayScale: ${displayScale}`,
    );
    if (replaced === block) throw new Error(`walk layout not found for ${row.id}`);
    block = replaced;
  } else {
    throw new Error(`unexpected clip ${row.clip}`);
  }
  src = src.slice(0, at) + block + src.slice(blockEnd);
}

writeFileSync('src/data/characters.js', src);
console.log('patched characters.js');
