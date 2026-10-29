// Light fighters (weight <= 3.0 on the 1-10 core scale) throw their normal attack as a short string:
// `string: { hits, gap }` lands `hits` swings with only `gap` ms of recharge between them, and the last
// swing takes the move's full `cooldown` (1.0 s). Let the string lapse (more than STRING_WINDOW ms after
// a swing's recharge ends) and the next swing starts a new one.
export const STRING_WINDOW = 450;

/**
 * Advance a fighter's string state for a swing that starts at `time`.
 * `prev` is `{ name, n, until }` (or null). Returns the new state and the recharge (ms) after this swing.
 */
export function stringStep(prev, move, time) {
  const hits = Math.max(1, move.string?.hits ?? 1);
  const open = prev && prev.name === move.name && time <= prev.until;
  const n = open ? prev.n + 1 : 1;
  const last = n >= hits;
  const recharge = last ? move.cooldown : (move.string?.gap ?? move.cooldown);
  const until = time + (move.duration ?? 0) + recharge + STRING_WINDOW;
  return { state: { name: move.name, n: last ? 0 : n, until: last ? 0 : until }, recharge, n, last };
}
