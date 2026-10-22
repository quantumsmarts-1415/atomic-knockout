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
    const inCell = (xy) => Array.isArray(xy) && xy.length >= 2
      && xy[0] >= 0 && xy[0] < json.frameW && xy[1] >= 0 && xy[1] < json.frameH;
    const hands = [];
    for (let i = 0; i < json.count; i++) {
      const strike = json.strike_hand_xy?.[String(i)];
      const front = json.frames?.[i]?.front_hand_xy;
      // A cut-off prop (Turbine Gust) leaves the old tip outside the cell.
      // The reach point is the palm that is still in the picture.
      let xy = strike || front;
      if (!inCell(xy)) {
        const reach = json.strike_reach_xy?.[String(i)];
        if (inCell(reach)) xy = reach;
      }
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
    // Afterimage Decay hops back and finishes in the guard. The sheet never
    // returns to the start stance, so the defense fades into idle.
    // Atom Smasher holds the follow-through and has no recovery pose.
    if (json.move === 'afterimage-decay' || json.move === 'atom-smasher') record.blendIdle = true;
    // The lunge is in the cell. A code slide would skate the sole.
    if (json.move === 'kobold-strike') record.noSlide = true;
    // Idle faces left. These sheets strike to the right, same as Bord's walk,
    // so the clip must not inherit that flip. A redo that faces left drops this.
    if (id === 'bord' || id === 'titan') record.sheetFacing = 1;
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
