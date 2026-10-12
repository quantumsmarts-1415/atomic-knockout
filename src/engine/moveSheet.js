// Playback and anchor placement for authored per-move body sheets.
// One scale and one foot line per clip. Feet anchors place effects. They
// do not move the body onto the floor.

import { MOVE_SHEETS } from '../data/moveSheets.js';

const ORDERS = {
  melee: ['fist', 'tip'],
  shot: ['tip', 'fist'],
  ground: ['feet', 'tip'],
  roll: ['feet', 'tip'],
};

export function sheetMeta(id, clip) {
  return MOVE_SHEETS[id]?.[clip] || null;
}

export function clipNameForMove(id, moveKey) {
  const row = MOVE_SHEETS[id];
  if (!row || !moveKey) return null;
  const name = moveKey === 'basicCharge' ? 'charge'
    : moveKey === 'specialDirectional' ? 'special'
    : moveKey === 'specialDefense' ? 'defense'
    : moveKey === 'basicDirectional' ? 'attack'
    : null;
  return name && row[name] ? name : null;
}

/** Clip to show for this state, when that move has an authored sheet. */
export function authoredClipName(id, state, moveKey) {
  if (state === 'charging') return clipNameForMove(id, 'basicCharge');
  if (state === 'defending') return clipNameForMove(id, 'specialDefense');
  if (state === 'attack') return clipNameForMove(id, moveKey);
  return null;
}

/** Sheet pixel to world pixel. artFacing -1 is the rig's flipX. */
export function frameToWorld(anchor, frameW, frameH, footY, scale, artFacing, facing, originX, originY) {
  const localX = ((artFacing ?? 1) === -1 ? -1 : 1) * (anchor[0] - frameW / 2) * scale;
  const localY = (anchor[1] - footY * frameH) * scale;
  return { x: originX + (facing || 1) * localX, y: originY + localY };
}

function loopIndex(range, animT, fps) {
  const a = range[0] | 0;
  const b = range[1] | 0;
  const n = Math.max(1, b - a + 1);
  const i = Math.floor(Math.max(0, animT || 0) * (fps > 0 ? fps : 18)) % n;
  return a + i;
}

function sample(range, t) {
  if (!range) return 0;
  const a = range[0] | 0;
  const b = range[1] | 0;
  if (b <= a) return a;
  const u = Math.max(0, Math.min(1, Number(t) || 0));
  if (u >= 1) return b;
  return a + Math.floor(u * (b - a + 1));
}

function playback(meta, comboStep) {
  if (meta.combo && comboStep > 0) {
    return meta.combo[Math.min(meta.combo.length, comboStep) - 1];
  }
  return meta;
}

/**
 * Frame of an authored sheet. Charging loops the gather. An attack maps
 * windup across startup, the active range across the hit window, and
 * recovery across endlag. A null recovery holds the last active frame.
 */
export function sheetFrameIndex(meta, opts = {}) {
  if (!meta) return 0;
  const count = meta.count || 12;
  const state = opts.state;
  if (state === 'charging' || (state === 'defending' && meta.gather)) {
    return loopIndex(meta.loop || meta.windup || [0, count - 1], opts.animT, meta.fps);
  }
  const phases = playback(meta, opts.comboStep | 0);
  const fd = opts.fd;
  if (!fd || (phases.windup == null && phases.active == null)) {
    const vis = Math.max(1, fd?.visible || count);
    const t = Math.min(0.999999, Math.max(0, (opts.attackFrame || 0) / vis));
    return Math.min(count - 1, Math.floor(t * count));
  }
  const f = Math.max(0, opts.attackFrame || 0);
  const startup = Math.max(1, fd.startup ?? 1);
  const active = Math.max(1, fd.active ?? 1);
  if (f < startup) return sample(phases.windup || phases.active || [0, 0], f / startup);
  if (f < startup + active) return sample(phases.active || phases.windup || [0, 0], (f - startup) / active);
  if (!phases.recovery) {
    const act = phases.active || [count - 1, count - 1];
    return act[1];
  }
  const rec = Math.max(1, fd.recovery || 1);
  return sample(phases.recovery, (f - startup - active) / rec);
}

function layoutOf(art, clipName) {
  const sheets = art?.sheets || {};
  const def = sheets.clips?.[clipName] || {};
  const frameW = def.frameW ?? sheets.frameW;
  const frameH = def.frameH ?? sheets.frameH;
  const footY = def.footY ?? sheets.footY ?? 1;
  const visibleH = def.bodyH ?? def.visibleH ?? sheets.bodyH ?? sheets.visibleH ?? frameH;
  let scale = def.displayScale;
  if (!(scale > 0)) {
    if (def.bodyH == null && def.visibleH == null && sheets.displayScale > 0) scale = sheets.displayScale;
    else scale = (art?.height || 160) / visibleH;
  }
  return { frameW, frameH, footY, scale };
}

function anchorAt(meta, frame, kind) {
  const anchors = meta?.anchors;
  if (!anchors) return null;
  const i = Math.max(0, frame | 0);
  for (const name of (ORDERS[kind] || ORDERS.melee)) {
    const p = anchors[name]?.[i];
    if (p && p.length >= 2) return p;
  }
  return null;
}

function worldAt(fighter, clipName, meta, frame, kind) {
  const anchor = anchorAt(meta, frame, kind);
  const art = fighter?.charDef?.art;
  if (!anchor || !art?.sheets) return null;
  const lay = layoutOf(art, clipName);
  if (!(lay.frameW > 0) || !(lay.frameH > 0) || !(lay.scale > 0)) return null;
  const sheetFacing = art.sheets.clips?.[clipName]?.sheetFacing ?? art.facing ?? 1;
  return frameToWorld(
    anchor, lay.frameW, lay.frameH, lay.footY, lay.scale,
    sheetFacing, fighter.facing || 1, fighter.x || 0, fighter.y || 0,
  );
}

/** Fist, tip, or foot of the frame currently on screen. */
export function sheetFxPoint(fighter, kind = 'melee') {
  const clip = fighter?.rig?.sheetClip;
  const meta = sheetMeta(fighter?.charDef?.id, clip);
  if (!meta) return null;
  return worldAt(fighter, clip, meta, fighter.rig?.sheetFrame || 0, kind);
}

/** Allen's whip sheet already draws the cable, so the separate whip art stays off. */
export function sheetDrawsWeapon(fighter) {
  return fighter?.charDef?.id === 'allen'
    && !!fighter?.rig?._authoredSheet
    && fighter?.rig?.sheetClip === 'attack';
}

/** Tip or foot of the sheet's release frame, for a shot that leaves the hand. */
export function sheetReleasePoint(fighter, kind = 'shot') {
  const id = fighter?.charDef?.id;
  const clip = clipNameForMove(id, fighter?.currentMoveKey || fighter?.rig?.moveKey);
  const meta = sheetMeta(id, clip);
  if (!meta || meta.release == null) return null;
  return worldAt(fighter, clip, meta, meta.release, kind);
}
