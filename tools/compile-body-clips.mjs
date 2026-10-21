// Rebuild src/data/bodyClipSources.js from art-src/imported/body/<id>/<slug>.json.
// Each slug is the move name (moveSlug). The runtime maps it onto the moveset.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = 'art-src/imported/body';
const packs = {};
for (const id of readdirSync(root).sort()) {
  const dir = path.join(root, id);
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    continue;
  }
  const moves = {};
  for (const file of files.sort()) {
    const json = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    const hands = [];
    for (let i = 0; i < json.count; i++) {
      const strike = json.strike_hand_xy?.[String(i)];
      const front = json.frames?.[i]?.front_hand_xy;
      const xy = strike || front;
      if (!xy) throw new Error(`${id} ${file} frame ${i} has no hand`);
      hands.push([Math.round(xy[0]), Math.round(xy[1])]);
    }
    const record = {
      frameW: json.frameW,
      frameH: json.frameH,
      count: json.count,
      fps: json.fps,
      footRow: json.foot_row,
      visibleH: json.visibleH,
      strikes: [...json.strike_frames],
      hands,
    };
    // A charge loops its gather. A hop inside that range (Quantum Leap)
    // plays once on release instead of bouncing for the whole hold.
    const first = Math.min(...json.strike_frames);
    const ground = json.foot_row;
    let end = 0;
    for (let i = 0; i < first; i++) {
      const foot = json.frames?.[i]?.foot;
      if (foot == null || ground - foot > 40) break;
      end = i;
    }
    if (first > 0 && end < first - 1) record.gather = [0, end];
    moves[json.move] = record;
  }
  if (Object.keys(moves).length) packs[id] = moves;
}

const body = `// Compiled from art-src/imported/body/<fighter>/<slug>.json.
// Regenerate with: node tools/compile-body-clips.mjs
export const BODY_SOURCES = ${JSON.stringify(packs, null, 2)};
`;
writeFileSync('src/data/bodyClipSources.js', body);
console.log(`wrote ${Object.keys(packs).length} fighters`);
