import { DAY_MS, type SeriesData, type Timeframe } from '@/lib/core';

export interface Session {
  /** First and last bar index (inclusive). */
  readonly from: number;
  readonly to: number;
  /** Session start time (ms, UTC). */
  readonly start: number;
}

/**
 * Session of a bar: the UTC day on intraday charts, the month on daily charts and the year on
 * weekly/monthly ones (a profile needs several bars per session).
 */
function sessionKey(time: number, tf: Timeframe): number {
  if (!tf.dateOnly) return Math.floor(time / DAY_MS);
  const d = new Date(time);
  return tf.unit === 'day' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : d.getUTCFullYear();
}

function sessionStart(time: number, tf: Timeframe): number {
  if (!tf.dateOnly) return Math.floor(time / DAY_MS) * DAY_MS;
  const d = new Date(time);
  return tf.unit === 'day'
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    : Date.UTC(d.getUTCFullYear(), 0, 1);
}

/** Whole sessions touching bars [from, to]. */
export function sessionsInRange(d: SeriesData, from: number, to: number, tf: Timeframe): Session[] {
  const n = d.length;
  if (n === 0) return [];
  const t = d.time;
  let a = Math.max(0, Math.min(n - 1, from));
  let b = Math.max(0, Math.min(n - 1, to));
  const ka = sessionKey(t[a]!, tf);
  while (a > 0 && sessionKey(t[a - 1]!, tf) === ka) a--;
  const kb = sessionKey(t[b]!, tf);
  while (b < n - 1 && sessionKey(t[b + 1]!, tf) === kb) b++;
  const out: Session[] = [];
  let s = a;
  let key = sessionKey(t[a]!, tf);
  for (let i = a + 1; i <= b + 1; i++) {
    const k = i <= b ? sessionKey(t[i]!, tf) : NaN;
    if (k !== key) {
      out.push({ from: s, to: i - 1, start: sessionStart(t[s]!, tf) });
      s = i;
      key = k;
    }
  }
  return out;
}
