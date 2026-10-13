import { bucketStart, nextBucketStart, type TimeframeId } from '@/lib/core';

/**
 * End of the next Price Skipper step from `cursor` (exclusive replay time): the next bucket
 * boundary of `ticker` strictly after the cursor, so steps stay aligned to the ticker
 * timeframe (10:07 + 15m → 10:15, then 10:30…).
 */
export function nextStepEnd(cursor: number, ticker: TimeframeId): number {
  return nextBucketStart(bucketStart(cursor, ticker), ticker);
}

/** Start of the previous step: the last bucket boundary strictly before the cursor. */
export function previousStepStart(cursor: number, ticker: TimeframeId): number {
  return bucketStart(cursor - 1, ticker);
}

/** Moves one option along a list, clamped at both ends. */
export function stepOption<T>(options: readonly T[], current: T, delta: number): T {
  const i = options.indexOf(current);
  const j = Math.max(0, Math.min(options.length - 1, (i < 0 ? 0 : i) + delta));
  return options[j]!;
}
