import type {
  BattleClock,
  BattleMode,
  BattleSettings,
  BattleStatus,
  FinalResult,
  ParticipantStatus,
  Standing,
} from './types';
import type { RankedFormat } from './settings';

/** Shapes the battle API returns (server → browser). */

export interface ChatMessage {
  readonly id: string;
  readonly userId: string | null;
  readonly name: string;
  readonly text: string;
  readonly at: number;
  readonly system: boolean;
}

export interface BattleView {
  readonly id: string;
  readonly code: string;
  readonly mode: BattleMode;
  readonly format: RankedFormat['id'] | null;
  readonly status: BattleStatus;
  readonly settings: BattleSettings;
  /** The market, revealed once the countdown starts (null in the lobby). */
  readonly symbol: string | null;
  readonly clock: BattleClock;
  readonly countdownEndsAt: number | null;
  /** Server wall clock when the view was built (clients correct their clock with it). */
  readonly serverNow: number;
  /** The viewer's own replay cursor (each trader steps through the candles themselves). */
  readonly cursor: number;
  readonly host: { readonly id: string; readonly name: string } | null;
  readonly isHost: boolean;
  /** Leaderboard order. */
  readonly standings: readonly Standing[];
  readonly me: {
    readonly startT: number;
    readonly startBid: number;
    /** The viewer's own trade actions (backtest TradeActions, logged with their market time). */
    readonly actions: ReadonlyArray<{ readonly t: number; readonly a: unknown }>;
    readonly status: ParticipantStatus;
  } | null;
  readonly chat: readonly ChatMessage[];
  readonly results: readonly FinalResult[] | null;
  readonly endReason: string | null;
  /** Why the viewer can't join, or null when they can (or already did). */
  readonly joinBlocked: string | null;
  readonly createdAt: number;
}

export interface BattleSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly mode: BattleMode;
  readonly format: RankedFormat['id'] | null;
  readonly status: BattleStatus;
  readonly winCondition: BattleSettings['winCondition'];
  readonly startingBalance: number;
  readonly assets: readonly string[];
  readonly durationMin: number;
  readonly profitTargetPct: number | null;
  readonly visibility: BattleSettings['visibility'];
  readonly allowLateJoin: boolean;
  readonly hostName: string | null;
  readonly participants: number;
  readonly maxParticipants: number;
  readonly participantNames: readonly string[];
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly endsAt: number | null;
  readonly joined: boolean;
  /** The viewer's final place and return (completed battles they played). */
  readonly myPlace: number | null;
  readonly myReturn: number | null;
  readonly myEloChange: number | null;
  readonly winnerName: string | null;
}

export interface BattleProfile {
  readonly userId: string;
  readonly name: string;
  readonly elo: number;
  readonly peakElo: number;
  readonly rankedGames: number;
  readonly rankedWins: number;
  readonly rankedLosses: number;
  readonly battles: number;
  readonly wins: number;
  readonly podiums: number;
  readonly xp: number;
  readonly winStreak: number;
  readonly bestStreak: number;
  readonly trades: number;
  readonly winningTrades: number;
  readonly avgReturn: number | null;
  readonly bestReturn: number | null;
  /** Place on the global Elo leaderboard (null before the first ranked battle). */
  readonly globalRank: number | null;
}

export interface LeaderboardEntry {
  readonly place: number;
  readonly userId: string;
  readonly name: string;
  readonly elo: number;
  readonly rankedGames: number;
  readonly rankedWins: number;
  readonly xp: number;
  readonly isMe: boolean;
}

export type QueueStatus =
  | { readonly status: 'idle' }
  | {
      readonly status: 'searching';
      readonly format: RankedFormat['id'];
      readonly since: number;
      readonly range: number;
      readonly searching: number;
    }
  | { readonly status: 'matched'; readonly battleId: string };
