// One shared hop for the whole roster. Heavy (slow or dense) fighters get a
// single jump. Light fighters get that jump plus one air jump. Edit
// JUMP_CLASS_OVERRIDES to pin a fighter without touching the formula.
//
// Height is the full-hop apex in pixels. Distance is how far a jump travels
// while a direction is held, before gravity scale is folded into jumpSpeed.

export const JUMP_HEIGHT = 140;
export const JUMP_DISTANCE = 240;
export const JUMP_GRAVITY = 1500;

/** id -> 'heavy' | 'light'. Heavy is 1 jump total, light is 2. */
export const JUMP_CLASS_OVERRIDES = {};

export function jumpClassOf(def) {
  const over = JUMP_CLASS_OVERRIDES[def?.id];
  if (over === 'heavy' || over === 'light') return over;
  const speed = def?.stats?.speed ?? def?.combat?.speed ?? 310;
  const weight = def?.stats?.weight ?? def?.combat?.weight ?? 1;
  if (weight >= 1.05 || speed <= 285) return 'heavy';
  return 'light';
}

export function applyJumpProfile(def) {
  if (!def?.stats) return def;
  const g = JUMP_GRAVITY * (def.stats.gravityScale || 1);
  const v = Math.sqrt(2 * g * JUMP_HEIGHT);
  const airTime = (2 * v) / g;
  def.stats.jumpVelocity = v;
  def.stats.jumpSpeed = JUMP_DISTANCE / airTime;
  def.stats.jumps = jumpClassOf(def) === 'heavy' ? 1 : 2;
  def.stats.airJumps = def.stats.jumps - 1;
  if (def.combat) {
    def.combat.jumpVelocity = v;
    def.combat.jumpSpeed = def.stats.jumpSpeed;
  }
  return def;
}

export function jumpRoster(characters) {
  const heavy = [];
  const light = [];
  for (const def of Object.values(characters)) {
    if (!def?.stats) continue;
    const row = {
      id: def.id,
      name: def.name,
      speed: Math.round(def.stats.speed),
      weight: Math.round(def.stats.weight * 100) / 100,
      jumps: def.stats.jumps,
    };
    (def.stats.airJumps > 0 ? light : heavy).push(row);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  heavy.sort(byName);
  light.sort(byName);
  return { heavy, light };
}
