// Which melee attacks can actually touch which fighters, from both sides.
// Run the full roster with `node tools/hit-reach.mjs`.
import { CHARACTERS } from '../data/characters.js';
import { strikeHits, maskBook, hurtAabb } from './masks.js';

const MOVE_KEYS = ['basicDirectional', 'basicCharge', 'specialDirectional', 'specialDefense'];

export function meleeMoves(def) {
  const out = [];
  for (const key of MOVE_KEYS) {
    const move = def?.moves?.[key];
    if (!move?.name) continue;
    const kind = move.kind;
    if (kind === 'projectile' || kind === 'burst' || kind === 'beam' || kind === 'zone' || kind === 'grab') continue;
    if (kind === 'shield' || kind === 'block' || kind === 'wall' || kind === 'buff') continue;
    if (kind !== 'dash' && kind !== 'melee' && move.damage == null && move.damage2 == null && move.rangeW == null) continue;
    out.push({ key, move });
  }
  return out;
}

function stub(id, x, facing) {
  const def = CHARACTERS[id];
  return {
    charDef: def,
    x,
    y: 400,
    facing,
    alive: true,
    visible: true,
    state: 'idle',
    grounded: true,
    bodyW: def?.art?.bodyW || 48,
    bodyH: def?.art?.height || 120,
    rig: { baseScale: 1, _pose: { rot: 0, sx: 1, sy: 1, x: 0, y: 0 } },
    scene: { simNow: 500 },
    input: {},
  };
}

function arm(attacker, move, clip, frame) {
  const startup = move.startupF ?? 3;
  const active = Math.max(2, move.activeF ?? 4);
  attacker.state = 'attack';
  attacker.frameData = { startup, active, recovery: move.endlagF ?? 8 };
  attacker.attackFrame = startup + Math.floor(active / 2);
  attacker.activeHit = { from: 0, until: 1e9, move };
  attacker.scene.simNow = 500;
  if (clip != null) {
    attacker.rig.maskClip = clip;
    attacker.rig.maskFrame = frame;
  }
}

function strikeClip(id, moveKey) {
  const book = maskBook(id);
  const prefer = moveKey.startsWith('special') ? 'special' : 'attack';
  const frames = book?.strike?.[prefer];
  if (frames?.some((mask) => mask?.n >= 3)) return prefer;
  if (book?.strike?.attack?.some((mask) => mask?.n >= 3)) return 'attack';
  return null;
}

/** Sheet frames whose ink sticks out past the idle body. Those are the swing. */
function contactFrames(id, clip) {
  const book = maskBook(id);
  const idle = book?.clips?.idle?.[0];
  const frames = book?.strike?.[clip] || [];
  const left = idle?.minX ?? -40;
  const right = idle?.maxX ?? 40;
  const out = [];
  frames.forEach((mask, frame) => {
    if (!mask?.n || mask.n < 3) return;
    if (mask.maxX > right + 4 || mask.minX < left - 4) out.push(frame);
  });
  return out;
}

/** True when `moveKey` overlaps the defender at this center gap. side +1 puts the attacker on the left. */
export function connectsAt(attackerId, defenderId, moveKey, gap, side) {
  const move = CHARACTERS[attackerId]?.moves?.[moveKey];
  if (!move) return false;
  const attacker = stub(attackerId, 0, side);
  const defender = stub(defenderId, side * gap, -side);
  const clip = strikeClip(attackerId, moveKey);
  const frames = clip ? contactFrames(attackerId, clip) : [];
  if (!frames.length) {
    arm(attacker, move);
    return strikeHits(attacker, defender);
  }
  for (const frame of frames) {
    arm(attacker, move, clip, frame);
    if (strikeHits(attacker, defender)) return true;
  }
  return false;
}

export function idleHalfWidth(id) {
  const idle = maskBook(id)?.clips?.idle?.[0];
  if (!idle?.n) return null;
  return {
    left: -idle.minX,
    right: idle.maxX,
    mid: (idle.minX + idle.maxX) / 2,
  };
}

/**
 * Every melee of every attacker against every defender, both facings.
 * `gaps` are center-to-center distances. A move is `never` when no gap
 * connects, and `one-side` when one facing connects and the other does not.
 */
export function sweepHitReach({
  attackers = Object.keys(CHARACTERS),
  defenders = Object.keys(CHARACTERS),
  gaps = [8, 16, 24, 36, 48, 64, 84, 108, 136, 168],
} = {}) {
  const issues = [];
  let checked = 0;
  for (const aid of attackers) {
    for (const { key, move } of meleeMoves(CHARACTERS[aid])) {
      for (const did of defenders) {
        if (did === aid) continue;
        const leftHits = [];
        const rightHits = [];
        for (const gap of gaps) {
          if (connectsAt(aid, did, key, gap, 1)) leftHits.push(gap);
          if (connectsAt(aid, did, key, gap, -1)) rightHits.push(gap);
          checked += 1;
        }
        if (!leftHits.length && !rightHits.length) {
          issues.push({ kind: 'never', attacker: aid, defender: did, move: move.name, key });
        } else if (!leftHits.length || !rightHits.length) {
          issues.push({
            kind: 'one-side', attacker: aid, defender: did, move: move.name, key, leftHits, rightHits,
          });
        }
      }
    }
  }
  return { issues, checked };
}

export function hurtWidth(id) {
  const fighter = stub(id, 0, 1);
  return hurtAabb(fighter);
}
