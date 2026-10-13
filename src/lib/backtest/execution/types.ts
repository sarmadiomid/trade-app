/** Plain-data model of the simulated account. Everything here is JSON-serialisable. */

export type Side = 'buy' | 'sell';
export type PendingKind = 'limit' | 'stop';
export type EntryKind = 'market' | PendingKind;

export type ExitReason =
  'tp' | 'sl' | 'manual' | 'partial' | 'session-end' | 'stop-out' | 'rule-breach';

/** Move SL to entry once price has moved `value` pips, or `value` × initial risk, in favour. */
export interface AutoBreakEven {
  readonly mode: 'pips' | 'rr';
  readonly value: number;
}

/** What the engine needs to know about the instrument and the account's costs. */
export interface AccountConfig {
  readonly contractSize: number;
  readonly tickSize: number;
  readonly pipSize: number;
  readonly lotMin: number;
  readonly lotStep: number;
  readonly lotMax: number;
  /** Ask − Bid in price units (0 = no spread). */
  readonly spread: number;
  /** Commission per lot per side, account currency. */
  readonly commissionPerLot: number;
  readonly startingBalance: number;
  readonly propRules: PropRules | null;
}

export interface PropRules {
  /** Percent of the starting balance. */
  readonly profitTargetPct: number;
  readonly maxDailyLossPct: number;
  readonly maxTotalLossPct: number;
}

export interface PendingOrder {
  readonly id: string;
  readonly side: Side;
  readonly kind: PendingKind;
  price: number;
  volume: number;
  sl: number | null;
  tp: number | null;
  autoBE: AutoBreakEven | null;
  readonly placedAt: number;
}

export interface Exit {
  readonly time: number;
  readonly price: number;
  readonly volume: number;
  /** Gross P&L of this exit (before commission). */
  readonly pnl: number;
  readonly commission: number;
  readonly reason: ExitReason;
}

export interface Position {
  readonly id: string;
  readonly side: Side;
  readonly entryKind: EntryKind;
  readonly entryPrice: number;
  readonly entryTime: number;
  readonly initialVolume: number;
  /** Remaining open volume. */
  volume: number;
  sl: number | null;
  tp: number | null;
  readonly initialSl: number | null;
  readonly initialTp: number | null;
  autoBE: AutoBreakEven | null;
  /** True once auto break-even (or the BE button) moved the stop to entry. */
  breakEven: boolean;
  /** Commission paid so far (entry + exits). */
  commission: number;
  exits: Exit[];
  /** Worst / best exit-side price seen while open (for MAE / MFE). */
  worstPrice: number;
  bestPrice: number;
}

/** A fully closed position, as written to the journal. */
export interface Trade extends Position {
  readonly closeTime: number;
  /** Volume-weighted exit price. */
  readonly closePrice: number;
  readonly grossPnl: number;
  readonly netPnl: number;
  readonly closeReason: ExitReason;
}

export type AccountStatus = 'active' | 'ended' | 'stopped-out' | 'failed';

export interface AccountState {
  balance: number;
  positions: Position[];
  orders: PendingOrder[];
  trades: Trade[];
  /** Time just after the last processed minute (the replay cursor). */
  time: number;
  /** Last Bid (close of the last processed minute). */
  bid: number;
  status: AccountStatus;
  /** UTC day (ms) whose start balance `dayStartBalance` is. */
  day: number;
  dayStartBalance: number;
  /** Set once a prop session's profit target is reached with nothing open. */
  targetReachedAt: number | null;
  failReason: string | null;
}

/** Everything the trader can do; logged with the replay time so a session can be re-simulated. */
export type TradeAction =
  | {
      readonly type: 'market';
      readonly id: string;
      readonly side: Side;
      readonly volume: number;
      readonly sl: number | null;
      readonly tp: number | null;
      readonly autoBE?: AutoBreakEven | null;
    }
  | {
      readonly type: 'pending';
      readonly id: string;
      readonly side: Side;
      readonly kind: PendingKind;
      readonly price: number;
      readonly volume: number;
      readonly sl: number | null;
      readonly tp: number | null;
      readonly autoBE?: AutoBreakEven | null;
    }
  | {
      readonly type: 'modify-order';
      readonly id: string;
      readonly price?: number;
      readonly volume?: number;
      readonly sl?: number | null;
      readonly tp?: number | null;
    }
  | { readonly type: 'cancel-order'; readonly id: string }
  | {
      readonly type: 'modify-position';
      readonly id: string;
      readonly sl?: number | null;
      readonly tp?: number | null;
      readonly autoBE?: AutoBreakEven | null;
    }
  | { readonly type: 'close'; readonly id: string; readonly volume?: number }
  | { readonly type: 'break-even'; readonly id: string }
  | { readonly type: 'close-all' }
  | { readonly type: 'cancel-all' };

export type ExecEvent =
  | { readonly type: 'filled'; readonly position: Position; readonly from: EntryKind }
  | { readonly type: 'placed'; readonly order: PendingOrder }
  | { readonly type: 'cancelled'; readonly id: string }
  | { readonly type: 'modified'; readonly id: string }
  | {
      readonly type: 'exit';
      readonly positionId: string;
      readonly exit: Exit;
      readonly closed: Trade | null;
    }
  | { readonly type: 'break-even'; readonly positionId: string }
  | { readonly type: 'stopped'; readonly status: AccountStatus; readonly reason: string }
  | { readonly type: 'target-reached' };

export type ActionResult =
  | { readonly ok: true; readonly events: readonly ExecEvent[] }
  | { readonly ok: false; readonly error: string };
