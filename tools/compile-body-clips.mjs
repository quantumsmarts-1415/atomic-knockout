// Rebuild src/data/bodyClipSources.js from art-src/imported/body/<id>/<slug>.json.
// Each slug is the move name (moveSlug). The runtime maps it onto the moveset.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

function footRowOf(json) {
  if (Number.isFinite(json.foot_row)) return json.foot_row;
  // Approved sheets written up from repo_clip_entry store a sole fraction.
  if (Number.isFinite(json.footY) && json.frameH > 0) {
    return Math.round(json.footY * json.frameH) - 1;
  }
  return null;
}

function strikeList(json) {
  if (Array.isArray(json.strike_frames) && json.strike_frames.length) return [...json.strike_frames];
  const active = json.phases?.active;
  if (Array.isArray(active) && active.length >= 2 && active[1] >= active[0]) {
    const frames = [];
    for (let i = active[0]; i <= active[1]; i++) frames.push(i);
    return frames;
  }
  if (Number.isFinite(json.releaseFrame)) return [json.releaseFrame];
  return [];
}

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
    const strikes = strikeList(json);
    const hands = [];
    for (let i = 0; i < json.count; i++) {
      const strike = json.strike_hand_xy?.[String(i)];
      const front = json.frames?.[i]?.front_hand_xy;
      // Older approved sheets store the palm on anchors.fist.
      let xy = strike || front || json.anchors?.fist?.[i];
      // A cut-off prop (Turbine Gust) leaves the old tip outside the cell.
      // The reach point is the palm that is still in the picture.
      if (!inCell(xy)) {
        const reach = json.strike_reach_xy?.[String(i)];
        if (inCell(reach)) xy = reach;
      }
      if (!xy) throw new Error(`${id} ${file} frame ${i} has no hand`);
      hands.push([Math.round(xy[0]), Math.round(xy[1])]);
    }
    const footRow = footRowOf(json);
    if (footRow == null) throw new Error(`${id} ${file} has no foot row`);
    if (!strikes.length) throw new Error(`${id} ${file} has no strike frames`);
    const record = {
      frameW: json.frameW,
      frameH: json.frameH,
      count: json.count,
      fps: json.fps,
      footRow,
      visibleH: json.visibleH,
      strikes,
      hands,
    };
    // A charge loops its gather. A hop inside that range (Quantum Leap)
    // plays once on release instead of bouncing for the whole hold.
    const first = Math.min(...strikes);
    const ground = footRow;
    let end = 0;
    let sawFoot = false;
    for (let i = 0; i < first; i++) {
      const foot = json.frames?.[i]?.foot;
      if (foot == null || ground - foot > 40) break;
      sawFoot = true;
      end = i;
    }
    if (sawFoot && first > 0 && end < first - 1) record.gather = [0, end];
    // Afterimage Decay hops back and finishes in the guard. The sheet never
    // returns to the start stance, so the defense fades into idle.
    // Atom Smasher holds the follow-through and has no recovery pose.
    if (json.move === 'afterimage-decay' || json.move === 'atom-smasher') record.blendIdle = true;
    // The lunge is in the cell. A code slide would skate the sole.
    if (json.move === 'kobold-strike') record.noSlide = true;
    // Idle faces left. These sheets strike to the right, same as Bord's walk,
    // so the clip must not inherit that flip. A redo that faces left drops this.
    if (id === 'bord' || id === 'titan') record.sheetFacing = 1;
    // Allen's idle and these sheets both face left. Pin it so a right-facing
    // redo is the thing that removes the flag.
    if (id === 'allen') record.sheetFacing = -1;
    // Natalie's idle faces left. Every approved sheet strikes to the right.
    if (id === 'natalie') record.sheetFacing = 1;
    // Nitra's idle faces left, and the redrawn trio does too. Gust strikes right.
    if (id === 'nitra') record.sheetFacing = json.move === 'gust' ? 1 : -1;
    // Scarlett's idle faces left. These sheets strike to the right.
    if (id === 'scarlett') record.sheetFacing = 1;
    // Saab faces right. Toxic Dust Cloud is the one sheet drawn facing left.
    if (id === 'saab' && json.move === 'toxic-dust-cloud') record.sheetFacing = -1;
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
