// Pure helpers for the batch-3 kits. Fighter and BattleScene read flags;
// the numbers stay in src/data/batch3.js.

/** True when a release lands inside the tick window. Tick 0 (the press) does not count. */
export function clockPerfect(heldMs, window) {
  const period = window?.period ?? 1000;
  const slack = window?.slack ?? 100;
  if (!(period > 0) || !(heldMs >= 0)) return false;
  const n = Math.round(heldMs / period);
  if (n < 1) return false;
  return Math.abs(heldMs - n * period) <= slack;
}

/** base × (1 + target% / 100), capped. */
export function percentScaleMult(percent, spec) {
  const cap = spec?.cap ?? 2.5;
  const mult = 1 + Math.max(0, percent ?? 0) / 100;
  return Math.min(cap, mult);
}

/**
 * Cold Fusion roll. `roll` is in [0, 1).
 * Under partialAfterMs: always fizzle. Full charge uses fullOdds.
 * A shorter hold uses partialOdds and partialScale.
 */
export function gambleFizzle(heldMs, maxMs, spec, roll) {
  const partialAt = spec?.partialAfterMs ?? 500;
  const full = maxMs > 0 && heldMs >= maxMs - 0.5;
  if (!(heldMs >= partialAt)) return { fizzle: true, scale: 0 };
  const odds = full ? (spec?.fullOdds ?? 0.5) : (spec?.partialOdds ?? 0.25);
  if (roll < odds) return { fizzle: false, scale: full ? 1 : (spec?.partialScale ?? 0.6) };
  return { fizzle: true, scale: 0 };
}

/** Forward fan. `deg` is the full angle. Index 0 is the top ray. */
export function fanVelocity(speed, index, count, deg) {
  const t = count <= 1 ? 0 : (index / (count - 1) - 0.5);
  const ang = t * ((deg ?? 0) * Math.PI / 180);
  const v = speed ?? 0;
  return { vx: Math.cos(ang) * v, vy: Math.sin(ang) * v };
}

/** Unit aim from the held stick. Neutral keeps the facing. */
export function glideAim(input, facing) {
  let x = 0;
  let y = 0;
  if (input?.left) x -= 1;
  if (input?.right) x += 1;
  if (input?.jump) y -= 1;
  if (input?.down) y += 1;
  if (x === 0 && y === 0) x = facing || 1;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** Up-left, up-right, left, right. */
export const MINE_SHARDS = [
  { x: -0.7071, y: -0.7071 },
  { x: 0.7071, y: -0.7071 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export function inPinZone(defender, px, py, pin) {
  if (!pin || !defender) return false;
  if (typeof pin === 'number') {
    const cy = defender.y - (defender.bodyH ?? 80) * 0.5;
    return Math.hypot((defender.x ?? 0) - px, cy - py) <= pin;
  }
  const facing = defender.facing || 1;
  const dx = (px - defender.x) * facing;
  const dy = Math.abs(py - (defender.y - (defender.bodyH ?? 80) * 0.45));
  return dx >= -(pin.behind ?? 0) && dx <= (pin.front ?? 160) && dy <= (pin.tall ?? 120);
}

/** Nearest living opponent in front, within range. Untargetable fighters are skipped. */
export function nearestInFront(owner, fighters, range) {
  if (!owner) return null;
  const facing = owner.facing || 1;
  let best = null;
  let bestD = range ?? 0;
  for (const f of fighters ?? []) {
    if (!f || f === owner || !f.alive || f.state === 'ko' || f.state === 'dead') continue;
    if (f.state === 'defending' && f.defenseMove?.untargetable) continue;
    const dx = (f.x - owner.x) * facing;
    if (dx < 0) continue;
    const d = Math.hypot(f.x - owner.x, f.y - owner.y);
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export function scaleTaken(move, table) {
  if (!move || !table) return move;
  const next = { ...move };
  const apply = (type, key) => {
    if (!type || next[key] == null) return;
    const mul = table[type];
    if (mul == null) return;
    next[key] = next[key] * mul;
  };
  apply(next.type, 'damage');
  apply(next.type2, 'damage2');
  apply(next.type3, 'damage3');
  return next;
}
