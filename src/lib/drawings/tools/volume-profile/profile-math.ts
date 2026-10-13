import type { SeriesData } from '@/lib/core';

export interface VolumeProfile {
  readonly low: number;
  readonly high: number;
  /** Price height of one row. */
  readonly step: number;
  /** Per row, bottom → top. */
  readonly up: readonly number[];
  readonly down: readonly number[];
  readonly maxTotal: number;
  readonly totalVolume: number;
  /** Point of control: the row with the most volume. */
  readonly poc: number;
  /** Value area rows (inclusive). */
  readonly vaLow: number;
  readonly vaHigh: number;
}

/**
 * Volume-at-price over bars [from, to] (inclusive): each bar's volume is spread evenly over the
 * rows its high–low range covers and counted as up (close ≥ open) or down volume.
 */
export function computeVolumeProfile(
  data: SeriesData,
  from: number,
  to: number,
  rows: number,
  valueAreaPercent: number,
): VolumeProfile | null {
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(data.length - 1, Math.max(from, to));
  if (b < a || rows < 1) return null;
  let low = Infinity;
  let high = -Infinity;
  for (let i = a; i <= b; i++) {
    low = Math.min(low, data.low[i]!);
    high = Math.max(high, data.high[i]!);
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  if (high === low) high = low + Math.abs(low) * 1e-6 + 1e-9;
  const n = Math.max(1, Math.floor(rows));
  const step = (high - low) / n;
  const up = new Array<number>(n).fill(0);
  const down = new Array<number>(n).fill(0);
  for (let i = a; i <= b; i++) {
    const vol = data.volume[i]!;
    if (!(vol > 0)) continue;
    const lo = data.low[i]!;
    const hi = data.high[i]!;
    const target = data.close[i]! >= data.open[i]! ? up : down;
    const r0 = Math.min(n - 1, Math.max(0, Math.floor((lo - low) / step)));
    const r1 = Math.min(n - 1, Math.max(0, Math.floor((hi - low) / step)));
    if (hi <= lo || r0 === r1) {
      target[r0]! += vol;
      continue;
    }
    const range = hi - lo;
    for (let r = r0; r <= r1; r++) {
      const rowLo = low + r * step;
      const overlap = Math.min(hi, rowLo + step) - Math.max(lo, rowLo);
      if (overlap > 0) target[r]! += (vol * overlap) / range;
    }
  }
  let poc = 0;
  let maxTotal = 0;
  let totalVolume = 0;
  for (let r = 0; r < n; r++) {
    const t = up[r]! + down[r]!;
    totalVolume += t;
    if (t > maxTotal) {
      maxTotal = t;
      poc = r;
    }
  }
  let vaLow = poc;
  let vaHigh = poc;
  let inArea = maxTotal;
  const target = (totalVolume * valueAreaPercent) / 100;
  const total = (r: number) => up[r]! + down[r]!;
  while (inArea < target && (vaLow > 0 || vaHigh < n - 1)) {
    const below = vaLow > 0 ? total(vaLow - 1) : -1;
    const above = vaHigh < n - 1 ? total(vaHigh + 1) : -1;
    if (above >= below) inArea += total(++vaHigh);
    else inArea += total(--vaLow);
  }
  return { low, high, step, up, down, maxTotal, totalVolume, poc, vaLow, vaHigh };
}
