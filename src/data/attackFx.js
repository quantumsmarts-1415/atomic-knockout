// What each move puts on screen, and the file a replacement PNG must match.
// No art is loaded here. The loader in fxArt.js reads these sizes and pivots.

import { maskBook } from '../engine/masks.js';

export const SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];

const EXTEND_NAME = /\b(lash|whip|chains?|hook|lance|spear|thorn|cable|spikes?|tentacles?|tongue)\b/i;
const THROWN_NAME = /\b(toss|lob|throw|bomb)\b/i;

export function moveSlug(name) {
  return String(name || 'move').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function fxFolder(fighterId, moveName) {
  return `assets/fx/${fighterId}/${moveSlug(moveName)}`;
}

export function attackSheet(char) {
  const sheets = char?.art?.sheets;
  const clip = sheets?.clips?.attack;
  if (!clip?.count || !sheets?.dir) return null;
  return {
    path: `${sheets.dir}${char.id}_attack.png`,
    frames: clip.count,
    fps: clip.fps || 0,
    frameW: clip.frameW ?? sheets.frameW,
    frameH: clip.frameH ?? sheets.frameH,
  };
}

function hasStrike(id) {
  const frames = maskBook(id)?.strike?.attack || [];
  return frames.some((frame) => frame?.n >= 3);
}

export function objectTypeOf(move, slot) {
  const kind = move?.kind || 'melee';
  const name = move?.name || '';
  if (kind === 'projectile') {
    if (move.lob != null || move.fromAbove || move.ground || THROWN_NAME.test(name)) return 'thrown';
    return 'projectile';
  }
  if (kind === 'beam') return 'beam';
  if (kind === 'shield' || kind === 'wall' || kind === 'block' || kind === 'oxide' || kind === 'counter') return 'shield';
  if (slot === 'specialDefense') return 'shield';
  if (kind === 'burst' || kind === 'dive' || kind === 'zone' || kind === 'dash' || kind === 'buff' || kind === 'mine') return 'area or burst';
  if (EXTEND_NAME.test(name) || (move?.rangeW ?? 0) >= 110) return 'extend';
  return 'slash arc';
}

export function effectBox(char, move, objectType) {
  const bodyW = char?.art?.bodyW ?? 40;
  const bodyH = char?.art?.bodyH ?? 100;
  if (objectType === 'projectile' || objectType === 'thrown') {
    const r = move.projectileRadius ?? 12;
    if (move.visualShape === 'spearhead') return { w: round(r * 2.2), h: round(r * 1.4) };
    if (move.vfx === 'balloon') return { w: round(r * 1.7), h: round(r * 2.1) };
    if (move.vfx === 'gust') return { w: round(r * 2.2), h: round(r * 0.9) };
    return { w: round(r * 2.9), h: round(r * 2.9) };
  }
  if (objectType === 'beam') return { w: round(move.beamLen ?? 160), h: round(move.beamThick ?? 14) };
  if (objectType === 'shield') {
    if (move.kind === 'wall') return { w: 18, h: round(move.wallRangeH ?? 120) };
    const d = round(bodyW * 1.9);
    return { w: d, h: d };
  }
  if (objectType === 'area or burst') {
    const rad = move.radius ?? move.zone?.radius ?? (move.kind === 'dash' ? 40 : 48);
    return { w: round(rad * 2), h: round(rad * 2) };
  }
  return {
    w: round(move.rangeW ?? bodyW * 1.7),
    h: round(move.rangeH ?? bodyH * 0.42),
  };
}

function round(n) {
  return Math.round(n);
}

function drawKind(move, objectType, sheet, strike) {
  const vfx = move?.vfx || '';
  if (objectType === 'projectile' || objectType === 'thrown') {
    if (move.visualShape === 'spearhead') return { draw: 'code-drawn shape', detail: 'spearhead polygon', family: 'spear', score: 2 };
    if (vfx === 'balloon') return { draw: 'code-drawn shape', detail: 'ellipse with a highlight', family: 'balloon', score: 2 };
    if (vfx === 'gust') return { draw: 'code-drawn shape', detail: 'chevron stroke', family: 'wave', score: 2 };
    return { draw: 'code-drawn shape', detail: 'four-point star', family: 'star', score: 1 };
  }
  if (objectType === 'beam') return { draw: 'code-drawn shape', detail: 'flat rectangle', family: 'beam', score: 1 };
  if (objectType === 'shield') {
    if (move.kind === 'wall' || vfx === 'wall' || vfx === 'cement') {
      return { draw: 'code-drawn shape', detail: 'vertical rectangle', family: 'column', score: 1 };
    }
    if (vfx === 'shield' || vfx === 'bubble' || move.kind === 'shield' || move.kind === 'block' || move.kind === 'oxide') {
      return { draw: 'code-drawn shape', detail: 'translucent circle', family: 'bubble', score: 1 };
    }
    return { draw: 'code-drawn shape', detail: 'thin ring', family: 'ring', score: 1 };
  }
  if (objectType === 'area or burst') {
    if (move.kind === 'zone') {
      return { draw: 'code-drawn shape', detail: 'filled circle', family: 'zone', score: 1 };
    }
    if (vfx === 'supernova' || vfx === 'fire' || vfx === 'ice' || vfx === 'spark' || vfx === 'dash') {
      return { draw: 'procedural particles', detail: 'tinted star and streaks', family: 'particles', score: 1 };
    }
    if (vfx === 'mushroom') return { draw: 'code-drawn shape', detail: 'circle cap and rectangle stem', family: 'mushroom', score: 2 };
    if (vfx === 'gust') return { draw: 'code-drawn shape', detail: 'four short streaks', family: 'gust-lines', score: 2 };
    return { draw: 'procedural particles', detail: 'tinted star and streaks', family: 'particles', score: 1 };
  }
  if (sheet && strike) {
    return {
      draw: 'sprite art',
      detail: 'attack sheet plus a code-drawn slash stroke',
      family: objectType === 'extend' ? 'sheet-extend' : 'sheet-slash',
      score: 3,
    };
  }
  return { draw: 'code-drawn shape', detail: 'thick slash stroke', family: 'slash', score: 2 };
}

function motion(move, objectType, sheet) {
  if (objectType === 'projectile' || objectType === 'thrown') {
    const spin = move.visualShape === 'spearhead' ? 'rotated to face left or right' : 'no rotation';
    const travel = move.lob != null || move.fromAbove
      ? 'arcs through the air'
      : move.ground ? 'slides along the ground' : 'flies in a straight line';
    return { rotation: spin, animation: `${travel}, one still shape` };
  }
  if (objectType === 'beam') {
    return { rotation: 'aimed with facing, no spin', animation: 'appears for about 220 ms and fades' };
  }
  if (objectType === 'shield') {
    return { rotation: 'no rotation', animation: move.kind === 'wall' ? 'fades over about 360 ms' : 'fades over about 500 ms' };
  }
  if (objectType === 'area or burst') {
    if (move.kind === 'zone') return { rotation: 'no rotation', animation: `lingers about ${move.zone?.ms ?? 1600} ms` };
    return { rotation: 'streaks fly outward, no spin on the core', animation: 'fades over about 160–320 ms' };
  }
  const frames = sheet ? `${sheet.frames} body frames` : 'the idle body';
  return {
    rotation: 'the stroke sweeps from about -60° to +26°',
    animation: `${frames} during the swing; the stroke grows across the active frames`,
  };
}

function specFor(folder, objectType, box) {
  const boxText = `${box.w}×${box.h} px`;
  if (objectType === 'beam' || objectType === 'extend') {
    return [
      `${folder}/cap-start.png, tile.png, and cap-end.png.`,
      `Transparent PNGs at full resolution, pointing right.`,
      `The tile repeats along the length and is fitted to ${boxText}.`,
      `cap-start and tile pivot at the left center (0, 0.50).`,
      `cap-end pivots at the right center (1, 0.50) so the tip meets the last tile.`,
      `A single ${folder}/object.png is used instead when the three-part set is absent, fitted inside ${boxText}, pivot at the left center.`,
      objectType === 'extend' ? `Optional frame-0.png through frame-7.png, played at 8 fps while the swing is active.` : `No frame animation.`,
      `Optional fx.json with "blend": "add", a luminance "black" cutoff, and "scaleWith": "radius".`,
    ].join(' ');
  }
  const pivot = objectType === 'slash arc' ? 'left center (0, 0.50)' : 'center (0.50, 0.50)';
  return [
    `${folder}/object.png.`,
    `Transparent PNG at full resolution, pointing right, fitted inside ${boxText}, pivot at the ${pivot}.`,
    `Optional frame-0.png through frame-7.png replace object.png and play at 8 fps.`,
    `Optional fx.json. "blend": "add" uses additive blending for art painted on pure black.`,
    `Pixels at or below a luminance of 16, or "black": <number>, are transparent in the picture and in the hit mask.`,
    `"frames": N and "fps" read sheet.png. "cols" and "rows" slice a grid in row-major order; without them the sheet is one horizontal row.`,
    `"smokeFrom": N plays that frame and the ones after it with luminance alpha and a normal blend, so dark smoke stays visible.`,
    `"heightFrac" sizes the visible pixels against the fighter's on-screen height. "fit" is "width", "height", or "max".`,
    `"scaleWith": "radius" multiplies the sprite by the charged radius over the tap radius.`,
    `No tiling.`,
  ].join(' ');
}

export function classifyMove(char, slot, move) {
  const objectType = objectTypeOf(move, slot);
  const sheet = attackSheet(char);
  const strike = hasStrike(char?.id);
  const drawn = drawKind(move, objectType, sheet, strike);
  const box = effectBox(char, move, objectType);
  const moveName = move?.name || slot;
  const folder = fxFolder(char.id, moveName);
  const how = motion(move, objectType, objectType === 'slash arc' || objectType === 'extend' ? sheet : null);
  const notes = [];
  if (move.fan > 1) notes.push(`fan of ${move.fan}`);
  if (move.fanTypes?.length) notes.push(`fan of ${move.fanTypes.length} elements`);
  if (move.rain > 1) notes.push(`rain of ${move.rain}`);
  if (move.alsoBehind) notes.push('fires both directions');
  if (move.zone && objectType !== 'area or burst') notes.push(`also leaves a circle ${Math.round((move.zone.radius ?? 70) * 2)} px across`);
  if (move.chain?.count) notes.push(`echoes ${move.chain.count} more times`);
  if ((objectType === 'projectile' || objectType === 'thrown') && move.vfx === 'mushroom') {
    notes.push('the blast is a circle cap on a rectangle stem');
  }
  if (objectType === 'beam' && (move.beamThick ?? 14) !== 14) notes.push(`the drawn bar is 14 px tall; the hit is ${move.beamThick} px tall`);
  if (drawn.draw === 'sprite art' && sheet) notes.push(sheet.path);
  return {
    fighterId: char.id,
    fighter: char.name || char.id,
    slot,
    move: moveName,
    objectType,
    drawn: drawn.draw,
    drawnDetail: drawn.detail,
    family: drawn.family,
    sheetPath: drawn.draw === 'sprite art' && sheet ? sheet.path : '',
    width: box.w,
    height: box.h,
    rotation: how.rotation,
    animation: how.animation,
    score: drawn.score,
    folder,
    spec: specFor(folder, objectType, box),
    notes: notes.join('; '),
  };
}

export function classifyRoster(roster) {
  const rows = [];
  for (const char of roster) {
    for (const slot of SLOTS) {
      const move = char.moves?.[slot];
      if (!move) continue;
      rows.push(classifyMove(char, slot, move));
    }
  }
  return rows;
}
