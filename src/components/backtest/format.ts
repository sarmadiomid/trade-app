import { formatDuration, formatNumber } from '@/lib/core';

export const money = (v: number, decimals = 2): string =>
  `${v < 0 ? '−' : ''}$${formatNumber(Math.abs(v), decimals)}`;

export const signedMoney = (v: number): string =>
  `${v > 0.004 ? '+' : v < -0.004 ? '−' : ''}$${formatNumber(Math.abs(v), 2)}`;

export const pct = (v: number, decimals = 2): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(decimals)}%`;

export const plainPct = (ratio: number, decimals = 1): string =>
  `${(ratio * 100).toFixed(decimals)}%`;

export const lots = (v: number): string => v.toFixed(2);

export const num = (v: number | null | undefined, decimals = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(decimals);

export const pnlClass = (v: number): string =>
  v > 0.004 ? 'text-up' : v < -0.004 ? 'text-down' : 'text-muted';

const pad = (n: number) => n.toString().padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon 04 Mar 2024 13:45" in UTC. */
export function utcDateTime(t: number, withTime = true): string {
  const d = new Date(t);
  const date = `${DAYS[d.getUTCDay()]} ${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withTime ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date;
}

export function utcDate(t: number): string {
  const d = new Date(t);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** yyyy-mm-dd (UTC) for <input type="date">. */
export function toDateInput(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fromDateInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** yyyy-mm-ddThh:mm (UTC) for <input type="datetime-local"> holding UTC values. */
export function toDateTimeInput(t: number): string {
  const d = new Date(t);
  return `${toDateInput(t)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function fromDateTimeInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  return m
    ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
    : null;
}

export const duration = (ms: number): string => (ms > 0 ? formatDuration(ms) : '—');

export const MONTH_NAMES = MONTHS;
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const EXIT_REASON_LABEL: Readonly<Record<string, string>> = {
  tp: 'TP',
  sl: 'SL',
  manual: 'Manual',
  partial: 'Partial',
  'session-end': 'Session end',
  'stop-out': 'Stop out',
  'rule-breach': 'Rule breach',
};
