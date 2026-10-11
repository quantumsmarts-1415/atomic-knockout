// Standing rule for bot rounds and tournament matches: play a full round
// on the normal stock and percent rules. The round ends when those rules
// leave one fighter, which takes at least one knockout. A clock must not
// name the winner.

/** Stocks in a normal round. */
export const MATCH_STOCKS = 3;

/** A match clock never ends a bot round or a tournament match. */
export function clockEndsRound() {
  return false;
}

/**
 * A scored round finished under the stock rules: three stocks, at least
 * one knockout, and one fighter still in.
 */
export function isFullRound(report, stocks = MATCH_STOCKS) {
  if (stocks !== MATCH_STOCKS) return false;
  const kos = report?.kos?.length ?? 0;
  if (kos < 1) return false;
  const up = (report?.fighters ?? []).filter((f) => (f.stocks ?? 0) > 0);
  return up.length === 1;
}
