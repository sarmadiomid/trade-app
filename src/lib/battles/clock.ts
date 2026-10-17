import { MINUTE_MS } from '@/lib/core';
import type { BattleClock } from './types';

export const durationMs = (c: Pick<BattleClock, 'durationMin'>) => c.durationMin * MINUTE_MS;

/** Wall-clock trading time elapsed (pauses excluded), clamped to the battle's duration. */
export function elapsedMs(c: BattleClock, now: number): number {
  if (c.startedAt === null) return 0;
  const until = c.endedAt ?? c.pausedAt ?? now;
  return Math.max(0, Math.min(durationMs(c), until - c.startedAt - c.pausedMs));
}

export const remainingMs = (c: BattleClock, now: number) => durationMs(c) - elapsedMs(c, now);

/**
 * The replay cursor: every 1-minute candle starting before it is revealed. It moves in whole
 * minutes so a candle is only shown once it has fully formed (no peeking inside a minute).
 */
export function marketCursor(c: BattleClock, now: number): number {
  const market = elapsedMs(c, now) * c.speed;
  return c.marketStart + Math.floor(market / MINUTE_MS + 1e-9) * MINUTE_MS;
}

/** Market time the battle ends at. */
export const marketEnd = (c: Pick<BattleClock, 'marketStart' | 'speed' | 'durationMin'>) =>
  c.marketStart + c.durationMin * c.speed * MINUTE_MS;

/** Real milliseconds until the next candle is revealed (for smooth client timers). */
export function msToNextCandle(c: BattleClock, now: number): number {
  const perCandle = MINUTE_MS / c.speed;
  const e = elapsedMs(c, now);
  return perCandle - (e % perCandle);
}

/** `mm:ss` (or `h:mm:ss`) of a duration in ms, rounded up to the second. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm.padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
