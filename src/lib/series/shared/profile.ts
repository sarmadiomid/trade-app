import { niceStep, type SeriesData } from '@/lib/core';
import { roundToTick } from './box-size';

/** Row index of a price on an absolute grid of `step`-high rows (row r covers [r·step, (r+1)·step)). */
export function rowOf(price: number, step: number): number {
  return Math.floor(price / step + 1e-9);
}

/**
 * Automatic row height: a nice, tick-aligned step so that an average bar over the last
 * `sample` bars spans about `rowsPerBar` rows.
 */
export function autoRowSize(
  d: SeriesData,
  ticksPerRow: number,
  tickSize: number,
  rowsPerBar: number,
  sample = 100,
): number {
  if (ticksPerRow > 0 && tickSize > 0) return ticksPerRow * tickSize;
  const n = d.length;
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, n - sample); i < n; i++) {
    sum += d.high[i]! - d.low[i]!;
    count++;
  }
  const avg = count > 0 ? sum / count : 0;
  const fallback = n > 0 ? Math.abs(d.close[n - 1]!) * 0.001 : 1;
  return roundToTick(niceStep((avg > 0 ? avg : fallback) / rowsPerBar), tickSize);
}

export interface BarFootprint {
  /** Lowest row index. */
  readonly row0: number;
  readonly buy: Float64Array;
  readonly sell: Float64Array;
}

/**
 * Splits a bar's volume into price rows and buy/sell sides by walking the intrabar path
 * open → low → high → close (bullish) or open → high → low → close (bearish): volume is spread
 * evenly along the path, rising legs count as buying, falling legs as selling.
 */
export function barFootprint(d: SeriesData, i: number, step: number): BarFootprint {
  const o = d.open[i]!;
  const h = d.high[i]!;
  const l = d.low[i]!;
  const c = d.close[i]!;
  const vol = d.volume[i]!;
  const row0 = rowOf(l, step);
  const rows = Math.max(1, rowOf(h, step) - row0 + 1);
  const buy = new Float64Array(rows);
  const sell = new Float64Array(rows);
  const path = c >= o ? [o, l, h, c] : [o, h, l, c];
  let length = 0;
  for (let k = 1; k < path.length; k++) length += Math.abs(path[k]! - path[k - 1]!);
  if (!(vol > 0)) return { row0, buy, sell };
  if (length <= 0) {
    const r = Math.min(rows - 1, Math.max(0, rowOf(c, step) - row0));
    buy[r] = vol / 2;
    sell[r] = vol / 2;
    return { row0, buy, sell };
  }
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]!;
    const b = path[k]!;
    if (a === b) continue;
    const side = b > a ? buy : sell;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const r0 = Math.max(0, rowOf(lo, step) - row0);
    const r1 = Math.min(rows - 1, rowOf(hi, step) - row0);
    for (let r = r0; r <= r1; r++) {
      const rowLo = (row0 + r) * step;
      const overlap = Math.min(hi, rowLo + step) - Math.max(lo, rowLo);
      if (overlap > 0) side[r]! += (vol * overlap) / length;
    }
  }
  return { row0, buy, sell };
}

/**
 * Value area: grows from the point of control towards the larger neighbour until it holds
 * `percent` of the total. Returns inclusive row indices into `totals`.
 */
export function valueArea(
  totals: ArrayLike<number>,
  percent: number,
): { poc: number; low: number; high: number } {
  const n = totals.length;
  let poc = 0;
  let sum = 0;
  for (let r = 0; r < n; r++) {
    sum += totals[r]!;
    if (totals[r]! > totals[poc]!) poc = r;
  }
  let low = poc;
  let high = poc;
  let inside = n > 0 ? totals[poc]! : 0;
  const target = (sum * percent) / 100;
  while (inside < target && (low > 0 || high < n - 1)) {
    const below = low > 0 ? totals[low - 1]! : -1;
    const above = high < n - 1 ? totals[high + 1]! : -1;
    if (above >= below) inside += totals[++high]!;
    else inside += totals[--low]!;
  }
  return { poc, low, high };
}
