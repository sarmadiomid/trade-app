import type { SessionSummary, SessionType } from '@/lib/backtest';
import { faDigits, gregorianToJalali, JALALI_MONTHS } from '@/lib/locale/jalali';

/** Tehran is UTC+3:30 and has no daylight saving. */
export const TEHRAN_MS = 3.5 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type KindFilter = 'all' | SessionType;
export type RangeFilter = 'all' | '30d' | '90d';

export interface MonthPoint {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

export interface TradePoint {
  readonly sessionId: string;
  readonly symbol: string;
  readonly side: 'buy' | 'sell';
  readonly win: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tehran civil date as `YYYY-MM-DD`. */
export function tehranDayKey(ts: number): string {
  const d = new Date(ts + TEHRAN_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Jalali month of a wall-clock instant, in Tehran. */
export function monthOfInstant(ts: number): { key: string; label: string } {
  const d = new Date(ts + TEHRAN_MS);
  const j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return {
    key: `${j.jy}-${pad(j.jm)}`,
    label: `${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`,
  };
}

function monthOfDayKey(day: string): { key: string; label: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const j = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
  return {
    key: `${j.jy}-${pad(j.jm)}`,
    label: `${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`,
  };
}

/** UTC instant of Tehran midnight on a `YYYY-MM-DD` key. */
function tehranMidnight(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - TEHRAN_MS;
}

export function inRange(ts: number, range: RangeFilter, now: number): boolean {
  if (range === 'all') return true;
  const window = (range === '30d' ? 30 : 90) * DAY_MS;
  return ts >= now - window;
}

export function selectSessions(
  sessions: readonly SessionSummary[],
  kind: KindFilter,
  range: RangeFilter,
  now: number,
): SessionSummary[] {
  return sessions.filter((s) => {
    if (kind !== 'all' && s.type !== kind) return false;
    return inRange(s.updatedAt, range, now);
  });
}

/** Market time the replay cursor has revealed. */
export function replayedMs(s: SessionSummary): number {
  return Math.max(0, s.cursor - s.startDate);
}

/** Inclusive length of the replay window, in days. */
export function sessionSpanDays(s: SessionSummary): number {
  return Math.max(1, Math.round((s.endDate - s.startDate) / DAY_MS) + 1);
}

/** Whole days of the window still ahead of the cursor. */
export function remainingDays(s: SessionSummary): number {
  const end = s.endDate + DAY_MS;
  return Math.max(0, Math.ceil((end - Math.min(s.cursor, end)) / DAY_MS));
}

/** Ceiling that lands axis ticks on 1 / 2 / 2.5 / 5 / 10 × 10ⁿ. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const padded = value * 1.12;
  const exp = 10 ** Math.floor(Math.log10(padded));
  const f = padded / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}

export function axisTicks(max: number, steps: number): number[] {
  return Array.from({ length: steps + 1 }, (_, i) => (max * i) / steps);
}

/**
 * Wall-clock hours the replay page was open, from Tehran day buckets.
 * `days` values are milliseconds.
 */
export function bucketHours(
  days: Readonly<Record<string, number>>,
  range: RangeFilter,
  now: number,
): { totalMs: number; months: MonthPoint[] } {
  const totals = new Map<string, MonthPoint>();
  let totalMs = 0;
  for (const [day, ms] of Object.entries(days)) {
    if (!(ms > 0)) continue;
    const start = tehranMidnight(day);
    if (start === null || !inRange(start + 12 * HOUR_MS, range, now)) continue;
    const month = monthOfDayKey(day);
    if (!month) continue;
    totalMs += ms;
    const prev = totals.get(month.key);
    totals.set(month.key, {
      key: month.key,
      label: month.label,
      value: (prev?.value ?? 0) + ms / HOUR_MS,
    });
  }
  return {
    totalMs,
    months: [...totals.values()].sort((a, b) => (a.key < b.key ? -1 : 1)),
  };
}

/**
 * Win rate (0–100) of closed trades, grouped by the Tehran month the session
 * was last worked on. Trade close times are market time, so they are not the axis.
 */
export function winRateByActivityMonth(
  rows: readonly { updatedAt: number; wins: number; trades: number }[],
): MonthPoint[] {
  const groups = new Map<string, { label: string; wins: number; trades: number }>();
  for (const row of rows) {
    if (row.trades <= 0) continue;
    const month = monthOfInstant(row.updatedAt);
    const prev = groups.get(month.key);
    groups.set(month.key, {
      label: month.label,
      wins: (prev?.wins ?? 0) + row.wins,
      trades: (prev?.trades ?? 0) + row.trades,
    });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, g]) => ({
      key,
      label: g.label,
      value: (g.wins / g.trades) * 100,
    }));
}

export function symbolCounts(
  rows: readonly { symbol: string; count: number }[],
): { symbol: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.count <= 0) continue;
    map.set(row.symbol, (map.get(row.symbol) ?? 0) + row.count);
  }
  return [...map.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count || (a.symbol < b.symbol ? -1 : 1));
}
