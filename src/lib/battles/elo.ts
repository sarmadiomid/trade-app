/** A ranked participant: current rating and ranked games played before this one. */
export interface EloPlayer {
  readonly id: string;
  readonly rating: number;
  readonly games: number;
}

/** Expected score of a player rated `a` against one rated `b`. */
export const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

/** K-factor: provisional players (fewer than 10 ranked games) move faster. */
export const kFactor = (games: number) => (games < 10 ? 48 : 32);

/**
 * Multiplayer Elo: every pair of players is scored as a game (better place = 1, same place =
 * ½), each with K / (n − 1) so a free-for-all moves ratings as much as one duel. `place` is
 * 1-based and may contain ties.
 */
export function eloChanges(
  players: readonly EloPlayer[],
  place: ReadonlyMap<string, number>,
): Map<string, number> {
  const n = players.length;
  const out = new Map<string, number>();
  for (const p of players) out.set(p.id, 0);
  if (n < 2) return out;
  for (const a of players) {
    let sum = 0;
    for (const b of players) {
      if (a === b) continue;
      const pa = place.get(a.id)!;
      const pb = place.get(b.id)!;
      const score = pa < pb ? 1 : pa === pb ? 0.5 : 0;
      sum += score - expectedScore(a.rating, b.rating);
    }
    out.set(a.id, Math.round((kFactor(a.games) / (n - 1)) * sum));
  }
  return out;
}
