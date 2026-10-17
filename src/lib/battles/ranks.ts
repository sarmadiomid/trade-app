/** Elo every trader starts ranked play with. */
export const START_ELO = 1000;

export interface RankTier {
  readonly id: string;
  readonly name: string;
  /** Lowest Elo of the tier. */
  readonly min: number;
  readonly color: string;
}

/** The eight ranks from Rookie to Master. */
export const RANKS: readonly RankTier[] = [
  { id: 'rookie', name: 'Rookie', min: 0, color: '#8f98ab' },
  { id: 'bronze', name: 'Bronze', min: 1100, color: '#c8814f' },
  { id: 'silver', name: 'Silver', min: 1250, color: '#c3ccd9' },
  { id: 'gold', name: 'Gold', min: 1400, color: '#f2c14e' },
  { id: 'platinum', name: 'Platinum', min: 1550, color: '#45d6c4' },
  { id: 'diamond', name: 'Diamond', min: 1700, color: '#62a4ff' },
  { id: 'elite', name: 'Elite', min: 1850, color: '#b07cff' },
  { id: 'master', name: 'Master', min: 2000, color: '#ff5c7a' },
];

export function rankFor(elo: number): RankTier {
  let tier = RANKS[0]!;
  for (const r of RANKS) if (elo >= r.min) tier = r;
  return tier;
}

/** Progress (0–1) from the current tier to the next one, and the next tier (null at Master). */
export function rankProgress(elo: number): {
  readonly next: RankTier | null;
  readonly progress: number;
} {
  const i = RANKS.indexOf(rankFor(elo));
  const next = RANKS[i + 1] ?? null;
  if (!next) return { next: null, progress: 1 };
  const from = i === 0 ? Math.min(elo, START_ELO - 100) : RANKS[i]!.min;
  return { next, progress: Math.max(0, Math.min(1, (elo - from) / (next.min - from))) };
}
