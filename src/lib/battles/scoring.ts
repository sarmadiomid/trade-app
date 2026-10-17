import type { ParticipantStatus, Standing } from './types';

const STATUS_ORDER: Readonly<Record<ParticipantStatus, number>> = {
  target: 0,
  active: 1,
  left: 2,
  disqualified: 3,
};

/** Returns are compared to the cent (two decimals of a percent) so float noise never splits a tie. */
const returnKey = (s: Standing) => Math.round(s.returnPct * 100);

/**
 * Leaderboard order: traders who reached the profit target (earliest first), then everyone
 * still trading by return, then those who left, then the disqualified.
 */
export function compareStandings(a: Standing, b: Standing): number {
  const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (so !== 0) return so;
  if (a.status === 'target' && b.status === 'target') return (a.targetAt ?? 0) - (b.targetAt ?? 0);
  return returnKey(b) - returnKey(a);
}

export function sortStandings(list: readonly Standing[]): Standing[] {
  return [...list].sort(compareStandings);
}

/** 1-based places of a sorted list; equal entries share a place. */
export function placesOf(sorted: readonly Standing[]): Map<string, number> {
  const out = new Map<string, number>();
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    out.set(s.userId, prev && compareStandings(prev, s) === 0 ? out.get(prev.userId)! : i + 1);
  });
  return out;
}

export interface XpInput {
  readonly place: number;
  readonly participants: number;
  readonly status: ParticipantStatus;
  readonly profitableTrades: number;
  /** Win streak including this battle. */
  readonly winStreak: number;
}

/**
 * Composite Score (trader XP): earned for taking part win or lose, more for winning or
 * placing, profitable trades and win streaks. It never goes down.
 */
export function xpFor(i: XpInput): number {
  if (i.status === 'left') return 0;
  if (i.status === 'disqualified') return 25;
  let xp = 100;
  if (i.participants > 1 && i.place === 1) xp += 50;
  else if (i.participants >= 4 && i.place <= 3) xp += 25;
  xp += Math.min(10, i.profitableTrades) * 5;
  if (i.place === 1 && i.winStreak >= 3) xp += 50;
  return xp;
}

/** Level of a Composite Score: every level needs 100 XP more than the previous one. */
export function levelFor(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let need = 300;
  let rest = Math.max(0, xp);
  while (rest >= need) {
    rest -= need;
    level += 1;
    need += 100;
  }
  return { level, into: rest, needed: need };
}
