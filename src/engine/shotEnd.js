// How a projectile treats a fighter or a solid.
// `onHit` is already the status packet (root, burn, mute), so the fate flag
// is `shotEnd`: 'despawn' | 'stick' | 'linger' | 'pierce'.
//
// despawn — a free shot ends on a body or a wall. explodeOnly bursts there.
// stick   — attaches and stays. Walls do not pop it.
// pierce  — keeps flying through bodies and walls.
// linger  — a placed hazard (seed, puddle, patch). Walls do not pop it.
//           A flying seed still ends if it strikes a body before it plants,
//           and a carrier that drops a zone still ends on a body. The zone
//           or the planted body is what stays.

export const SHOT_ENDS = ['despawn', 'stick', 'linger', 'pierce'];

export function shotEndOf(move) {
  if (SHOT_ENDS.includes(move?.shotEnd)) return move.shotEnd;
  if (move?.pierce) return 'pierce';
  if (move?.stick) return 'stick';
  if (move?.hatch || move?.dropZone) return 'linger';
  return 'despawn';
}

/** True when a body impact should remove the projectile itself. */
export function shotRemovedOnFighter(move) {
  const end = shotEndOf(move);
  if (end === 'pierce' || end === 'stick') return false;
  if (end === 'linger') {
    // The staying part is the plant or the dropped zone. The carrier still
    // ends on a body, which is what those moves already did.
    if (move?.hatch || move?.dropZone || move?.explodeOnly) return true;
    return false;
  }
  return true;
}

/** True when a wall (not the floor) should pop this shot. */
export function shotStoppedBySolid(move) {
  const end = shotEndOf(move);
  if (end !== 'despawn') return false;
  // These already own their travel: bounce, return, or a ghost fuse.
  if (move?.can || move?.returns || move?.stageBounce || move?.ricochet || move?._ghost) return false;
  return true;
}

/** Ground slabs are the floor these shots ride or land on, not a wall. */
export function shotIgnoresGround(move) {
  return !!(move?.roll || move?.floor || move?.ground || move?.landBurst || move?.hatch || move?.can);
}
