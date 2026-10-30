/** Plain-data model of FXR-style trading battles. Everything here is JSON-serialisable. */

/** Ranked battles come from matchmaking and move Elo; casual (custom) battles never do. */
export type BattleMode = 'casual' | 'ranked';

/**
 * Time Trial: the highest return when the timer reaches zero wins.
 * Profit Target: the first trader to close their way to the target wins; if nobody reaches it
 * before the timer runs out, the highest return wins.
 */
export type WinCondition = 'time-trial' | 'profit-target';

export type Visibility = 'public' | 'private';

/**
 * standby: the lobby, waiting for the host · countdown: about to start · live / paused ·
 * completed: trading locked and results final · cancelled: the host closed the lobby.
 */
export type BattleStatus = 'standby' | 'countdown' | 'live' | 'paused' | 'completed' | 'cancelled';

/** target: reached the profit target · disqualified: broke a drawdown rule · left: forfeited. */
export type ParticipantStatus = 'active' | 'target' | 'disqualified' | 'left';

export interface BattleSettings {
  readonly name: string;
  readonly winCondition: WinCondition;
  readonly startingBalance: number;
  /** 1–5 symbols; the battle's market is drawn from this pool when the battle is created. */
  readonly assets: readonly string[];
  /**
   * Inclusive UTC midnight range the battle's market is drawn from.
   * `null` means the full stored history (ranked formats).
   */
  readonly historyStart: number | null;
  readonly historyEnd: number | null;
  /** Battle length on the clock, 1–99 minutes. */
  readonly durationMin: number;
  /** Market minutes replayed per real minute (30 = one 1-minute candle every 2 seconds). */
  readonly speed: number;
  /** Percent of the starting balance (required for Profit Target battles). */
  readonly profitTargetPct: number | null;
  /** Max drawdown from the starting balance, percent; breaking it disqualifies. */
  readonly maxDrawdownPct: number | null;
  /** Max loss within one market day, percent of the starting balance. */
  readonly maxDailyDrawdownPct: number | null;
  readonly maxParticipants: number;
  readonly visibility: Visibility;
  /** Traders may join while the battle is in progress. */
  readonly allowLateJoin: boolean;
}

/** Everything needed to know where a battle's market is at a given wall-clock time. */
export interface BattleClock {
  readonly status: BattleStatus;
  /** Wall-clock start of trading (end of the countdown). */
  readonly startedAt: number | null;
  readonly pausedAt: number | null;
  /** Total paused wall-clock time before `pausedAt`. */
  readonly pausedMs: number;
  readonly endedAt: number | null;
  /** First market minute of the battle (UTC ms). */
  readonly marketStart: number;
  readonly speed: number;
  readonly durationMin: number;
}

/** One trader's live result, as shown on the leaderboard. */
export interface Standing {
  readonly userId: string;
  readonly name: string;
  readonly elo: number;
  readonly status: ParticipantStatus;
  readonly balance: number;
  readonly equity: number;
  readonly returnPct: number;
  readonly openPositions: number;
  readonly trades: number;
  readonly wins: number;
  /** Market time the profit target was reached at. */
  readonly targetAt: number | null;
  readonly reason: string | null;
}

/** Final result of one participant (written when the battle completes). */
export interface FinalResult extends Standing {
  readonly place: number;
  readonly eloBefore: number | null;
  readonly eloAfter: number | null;
  readonly xp: number;
}
