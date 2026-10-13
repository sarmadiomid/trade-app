import { bucketStart, type Candle, type SeriesData, type TimeframeId } from '@/lib/core';

/**
 * Merges newly revealed 1-minute bars into the chart's series of timeframe `tf`: the forming
 * candle grows, completed buckets are appended. Minutes are aggregated locally first so the
 * series emits one change per chart candle, not per minute.
 */
export function revealMinutes(series: SeriesData, tf: TimeframeId, minutes: readonly Candle[]) {
  if (minutes.length === 0) return;
  const lastIndex = series.lastIndex;
  let acc: Candle | null = lastIndex >= 0 ? series.bar(lastIndex) : null;
  const out: Candle[] = [];
  for (const m of minutes) {
    const bucket = tf === '1m' ? m.time : bucketStart(m.time, tf);
    if (acc && bucket < acc.time) continue; // already shown
    if (acc && acc.time === bucket) {
      if (tf === '1m') continue;
      if (m.high > acc.high) acc.high = m.high;
      if (m.low < acc.low) acc.low = m.low;
      acc.close = m.close;
      acc.volume += m.volume;
      if (out[out.length - 1] !== acc) out.push(acc);
    } else {
      acc = { ...m, time: bucket };
      out.push(acc);
    }
  }
  for (const b of out) series.upsertLast(b);
}

/**
 * Rebuilds the last candle of the series from scratch out of `minutes` (all minutes of its
 * bucket up to the cursor), then appends what follows. Used after a reload to make sure the
 * forming candle matches the cursor exactly.
 */
export function resyncForming(series: SeriesData, tf: TimeframeId, minutes: readonly Candle[]) {
  const last = series.lastIndex;
  if (last < 0) return revealMinutes(series, tf, minutes);
  const start = series.time[last]!;
  const own = minutes.filter((m) => m.time >= start);
  if (own.length === 0) return;
  const first = own[0]!;
  if (bucketStart(first.time, tf) !== start) return revealMinutes(series, tf, own);
  series.upsertLast({ ...first, time: start });
  revealMinutes(series, tf, own.slice(1));
}
