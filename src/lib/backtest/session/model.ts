import { DAY_MS, type InstrumentSpec, type TimeframeId } from '@/lib/core';
import { ExecutionEngine } from '../execution/engine';
import type {
  AccountConfig,
  AccountState,
  AutoBreakEven,
  PropRules,
  TradeAction,
} from '../execution/types';

export type SessionType = 'backtesting' | 'prop';
export type SessionStatus = 'in-progress' | 'completed' | 'failed';

export interface SessionSettings {
  readonly name: string;
  readonly description: string;
  readonly strategyTag: string;
  readonly type: SessionType;
  readonly symbol: string;
  readonly startingBalance: number;
  /** UTC midnight of the first day. */
  readonly startDate: number;
  /** UTC midnight of the last day (inclusive). */
  readonly endDate: number;
  readonly spreadEnabled: boolean;
  /** Price units (XAUUSD 0.20 = 2 pips). */
  readonly spread: number;
  readonly commissionEnabled: boolean;
  /** Per lot per side. */
  readonly commissionPerLot: number;
  readonly propRules: PropRules | null;
}

/** Price Skipper and chart preferences of a session. */
export interface ReplayPrefs {
  readonly tickerValue: TimeframeId;
  readonly frequency: number;
}

/** Scalper Mode: preset protection for Quick Buy/Sell trades. */
export interface ScalperSettings {
  readonly enabled: boolean;
  readonly unit: 'pips' | 'ticks' | 'percent';
  readonly sl: number | null;
  readonly tp: number | null;
  readonly autoBE: AutoBreakEven | null;
}

export interface JournalEntry {
  readonly notes: string;
  readonly tags: readonly string[];
  /** 1–5, or null. */
  readonly confidence: number | null;
  /** Ids of screenshots saved through the repository. */
  readonly screenshots: readonly string[];
}

export interface LoggedAction {
  /** Replay time the action was taken at. */
  readonly t: number;
  readonly a: TradeAction;
}

export interface BacktestSession {
  readonly id: string;
  readonly createdAt: number;
  updatedAt: number;
  settings: SessionSettings;
  prefs: ReplayPrefs;
  scalper: ScalperSettings;
  /** Quantity of the Quick Buy/Sell panel (lots). */
  quickVolume: number;
  /** Replay time: everything before it is revealed. */
  cursor: number;
  /** Every trader action, in order (re-simulated on rewind). */
  actions: LoggedAction[];
  /** Account at `cursor` (so reopening needs no re-simulation). */
  account: AccountState;
  /** Bid before the session start (the re-simulation starting point). */
  readonly initialBid: number;
  journal: Record<string, JournalEntry>;
  /** Next id for orders / positions. */
  nextId: number;
}

/** Light view for the sessions list. */
export interface SessionSummary {
  readonly id: string;
  readonly name: string;
  readonly type: SessionType;
  readonly symbol: string;
  readonly startDate: number;
  readonly endDate: number;
  readonly cursor: number;
  readonly startingBalance: number;
  readonly balance: number;
  readonly trades: number;
  readonly status: SessionStatus;
  readonly strategyTag: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export const TICKER_VALUES: readonly TimeframeId[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];
/** Candles per second. */
export const FREQUENCIES: readonly number[] = [0.5, 1, 2, 3, 5, 10, 20, 30, 60];

export const DEFAULT_PREFS: ReplayPrefs = { tickerValue: '1m', frequency: 1 };
export const DEFAULT_SCALPER: ScalperSettings = {
  enabled: false,
  unit: 'pips',
  sl: 50,
  tp: 100,
  autoBE: null,
};
export const DEFAULT_PROP_RULES: PropRules = {
  profitTargetPct: 10,
  maxDailyLossPct: 5,
  maxTotalLossPct: 10,
};
export const EMPTY_JOURNAL_ENTRY: JournalEntry = {
  notes: '',
  tags: [],
  confidence: null,
  screenshots: [],
};

/** Exclusive end of the replay range. */
export const sessionEnd = (s: SessionSettings): number => s.endDate + DAY_MS;

export function accountConfig(s: SessionSettings, spec: InstrumentSpec): AccountConfig {
  return {
    contractSize: spec.contractSize,
    tickSize: spec.tickSize,
    pipSize: spec.pipSize,
    lotMin: spec.lotMin,
    lotStep: spec.lotStep,
    lotMax: spec.lotMax,
    spread: s.spreadEnabled ? s.spread : 0,
    commissionPerLot: s.commissionEnabled ? s.commissionPerLot : 0,
    startingBalance: s.startingBalance,
    propRules: s.type === 'prop' ? s.propRules : null,
  };
}

export function sessionStatus(s: BacktestSession): SessionStatus {
  if (s.account.status === 'failed' || s.account.status === 'stopped-out') return 'failed';
  if (s.account.status === 'ended') return 'completed';
  return 'in-progress';
}

export function summarize(s: BacktestSession): SessionSummary {
  return {
    id: s.id,
    name: s.settings.name,
    type: s.settings.type,
    symbol: s.settings.symbol,
    startDate: s.settings.startDate,
    endDate: s.settings.endDate,
    cursor: s.cursor,
    startingBalance: s.settings.startingBalance,
    balance: s.account.balance,
    trades: s.account.trades.length,
    status: sessionStatus(s),
    strategyTag: s.settings.strategyTag,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export interface NewSessionInput {
  readonly id: string;
  readonly now: number;
  readonly settings: SessionSettings;
  /** Last Bid before the session start. */
  readonly initialBid: number;
  readonly spec: InstrumentSpec;
}

export function createSession(input: NewSessionInput): BacktestSession {
  const { settings, spec } = input;
  const cfg = accountConfig(settings, spec);
  return {
    id: input.id,
    createdAt: input.now,
    updatedAt: input.now,
    settings,
    prefs: DEFAULT_PREFS,
    scalper: DEFAULT_SCALPER,
    quickVolume: Math.max(spec.lotMin, 1),
    cursor: settings.startDate,
    actions: [],
    account: ExecutionEngine.initialState(cfg, settings.startDate, input.initialBid),
    initialBid: input.initialBid,
    journal: {},
    nextId: 1,
  };
}

/** Problems with a session's settings, or null. */
export function validateSettings(
  s: SessionSettings,
  range: { start: number; end: number },
): string | null {
  if (!s.name.trim()) return 'نام جلسه را وارد کنید';
  if (s.name.length > 60) return 'نام جلسه حداکثر ۶۰ نویسه است';
  if (!(s.startingBalance > 0)) return 'موجودی باید بیشتر از صفر باشد';
  if (s.startDate < range.start) return 'تاریخ شروع قبل از دادهٔ موجود است';
  if (sessionEnd(s) > range.end) return 'تاریخ پایان بعد از دادهٔ موجود است';
  if (s.endDate < s.startDate) return 'تاریخ پایان باید همان روز شروع یا بعد از آن باشد';
  if (s.spreadEnabled && !(s.spread >= 0)) return 'اسپرد نمی‌تواند منفی باشد';
  if (s.commissionEnabled && !(s.commissionPerLot >= 0)) return 'کارمزد نمی‌تواند منفی باشد';
  if (s.type === 'prop') {
    const r = s.propRules;
    if (!r) return 'قوانین پراپ لازم است';
    for (const v of [r.profitTargetPct, r.maxDailyLossPct, r.maxTotalLossPct])
      if (!(v > 0 && v < 100)) return 'قوانین پراپ باید درصدی بین ۰ و ۱۰۰ باشند';
  }
  return null;
}
