import { DAY_MS, bucketStart } from '@/lib/core';
import { initialRisk } from '../execution/math';
import type { AccountConfig, Trade } from '../execution/types';
import { byClose, drawdownOf, outcomeOf } from './stats';

/** Aggregate of a group of trades (a weekday, an hour, a calendar day...). */
export interface Bucket {
  readonly key: number;
  readonly trades: number;
  readonly wins: number;
  readonly losses: number;
  readonly breakeven: number;
  readonly pnl: number;
  /** Σ R over trades with an initial stop. */
  readonly r: number;
  readonly winRate: number;
}

function group(
  cfg: AccountConfig,
  trades: readonly Trade[],
  keyOf: (t: Trade) => number,
): Map<number, Bucket> {
  const acc = new Map<
    number,
    { trades: number; wins: number; losses: number; pnl: number; r: number }
  >();
  for (const t of trades) {
    const k = keyOf(t);
    const b = acc.get(k) ?? { trades: 0, wins: 0, losses: 0, pnl: 0, r: 0 };
    const o = outcomeOf(t);
    b.trades += 1;
    if (o === 'win') b.wins += 1;
    if (o === 'loss') b.losses += 1;
    b.pnl += t.netPnl;
    const risk = initialRisk(cfg, t);
    if (risk !== null) b.r += t.netPnl / risk;
    acc.set(k, b);
  }
  const out = new Map<number, Bucket>();
  for (const [key, b] of acc)
    out.set(key, {
      key,
      ...b,
      breakeven: b.trades - b.wins - b.losses,
      winRate: b.trades ? b.wins / b.trades : 0,
    });
  return out;
}

const utcHour = (t: number) => new Date(t).getUTCHours();
const utcWeekday = (t: number) => new Date(t).getUTCDay();

/** Trading sessions by UTC hour of entry (see docs/backtest-spec.md §8.4). */
export const TRADING_SESSIONS = [
  { id: 'asia', label: 'Asia', from: 0, to: 8 },
  { id: 'london', label: 'London', from: 8, to: 13 },
  { id: 'new-york', label: 'New York', from: 13, to: 21 },
  { id: 'off', label: 'Off-session', from: 21, to: 24 },
] as const;
export type TradingSessionId = (typeof TRADING_SESSIONS)[number]['id'];

export function tradingSessionOf(time: number): TradingSessionId {
  const h = utcHour(time);
  return TRADING_SESSIONS.find((s) => h >= s.from && h < s.to)!.id;
}

/** Monday-first weekday buckets (0 = Monday … 6 = Sunday), by entry time. */
export function byWeekday(cfg: AccountConfig, trades: readonly Trade[]): Bucket[] {
  const m = group(cfg, trades, (t) => (utcWeekday(t.entryTime) + 6) % 7);
  return [0, 1, 2, 3, 4].map((k) => m.get(k) ?? empty(k));
}

/** Hour-of-entry buckets 0–23 (UTC). */
export function byHour(cfg: AccountConfig, trades: readonly Trade[]): Bucket[] {
  const m = group(cfg, trades, (t) => utcHour(t.entryTime));
  return Array.from({ length: 24 }, (_, h) => m.get(h) ?? empty(h));
}

export function bySession(cfg: AccountConfig, trades: readonly Trade[]): Bucket[] {
  const m = group(cfg, trades, (t) =>
    TRADING_SESSIONS.findIndex((s) => s.id === tradingSessionOf(t.entryTime)),
  );
  return TRADING_SESSIONS.map((_, i) => m.get(i) ?? empty(i));
}

export function bySide(
  cfg: AccountConfig,
  trades: readonly Trade[],
): { buy: Bucket; sell: Bucket } {
  const m = group(cfg, trades, (t) => (t.side === 'buy' ? 0 : 1));
  return { buy: m.get(0) ?? empty(0), sell: m.get(1) ?? empty(1) };
}

/** Calendar days (UTC midnight → bucket) by close time, for the P&L calendar. */
export function byDay(cfg: AccountConfig, trades: readonly Trade[]): Map<number, Bucket> {
  return group(cfg, trades, (t) => Math.floor(t.closeTime / DAY_MS) * DAY_MS);
}

export interface PeriodAverages {
  readonly periods: number;
  readonly avgGain: number;
  readonly avgLoss: number;
  readonly avgNet: number;
  readonly best: number;
  readonly worst: number;
}

/** Average gain / loss per active day, week or month (FX Replay's session stats). */
export function periodAverages(
  cfg: AccountConfig,
  trades: readonly Trade[],
  period: 'day' | 'week' | 'month',
): PeriodAverages {
  const tf = period === 'day' ? '1D' : period === 'week' ? '1W' : '1M';
  const m = group(cfg, trades, (t) => bucketStart(t.closeTime, tf));
  const pnls = [...m.values()].map((b) => b.pnl);
  const gains = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    periods: pnls.length,
    avgGain: avg(gains),
    avgLoss: avg(losses),
    avgNet: avg(pnls),
    best: pnls.length ? Math.max(...pnls) : 0,
    worst: pnls.length ? Math.min(...pnls) : 0,
  };
}

export interface EquityPoint {
  readonly time: number;
  readonly balance: number;
  /** Drawdown from the running peak (≤ 0). */
  readonly drawdown: number;
  readonly tradeId: string | null;
}

/** Balance after each closed trade, starting at the starting balance. */
export function equityCurve(
  cfg: AccountConfig,
  trades: readonly Trade[],
  start: number,
): EquityPoint[] {
  const out: EquityPoint[] = [
    { time: start, balance: cfg.startingBalance, drawdown: 0, tradeId: null },
  ];
  let bal = cfg.startingBalance;
  let peak = bal;
  for (const t of byClose(trades)) {
    bal += t.netPnl;
    peak = Math.max(peak, bal);
    out.push({ time: t.closeTime, balance: bal, drawdown: bal - peak, tradeId: t.id });
  }
  return out;
}

export { drawdownOf };

export interface HistogramBin {
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

/** Equal-width histogram (for P&L and R distributions). */
export function histogram(values: readonly number[], bins = 12): HistogramBin[] {
  if (values.length === 0) return [];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const w = (hi - lo) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({
    from: lo + i * w,
    to: lo + (i + 1) * w,
    count: 0,
  }));
  for (const v of values) out[Math.min(bins - 1, Math.floor((v - lo) / w))]!.count += 1;
  return out;
}

const empty = (key: number): Bucket => ({
  key,
  trades: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  pnl: 0,
  r: 0,
  winRate: 0,
});
