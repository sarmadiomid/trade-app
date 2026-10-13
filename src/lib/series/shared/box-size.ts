import type { BoxSizeMethod, SeriesData } from '@/lib/core';

/** Wilder's average true range at the last bar (SMA seed over the first `length` bars). */
export function averageTrueRange(d: SeriesData, length: number): number {
  const n = d.length;
  if (n === 0) return 0;
  const len = Math.max(1, Math.round(length));
  let sum = 0;
  let value = 0;
  for (let i = 0; i < n; i++) {
    const hl = d.high[i]! - d.low[i]!;
    const tr =
      i === 0
        ? hl
        : Math.max(hl, Math.abs(d.high[i]! - d.close[i - 1]!), Math.abs(d.low[i]! - d.close[i - 1]!));
    if (i < len) {
      sum += tr;
      value = sum / (i + 1);
    } else {
      value = (value * (len - 1) + tr) / len;
    }
  }
  return value;
}

/** Rounds a price step to the symbol's tick (at least one tick). */
export function roundToTick(step: number, tickSize: number): number {
  if (!(tickSize > 0)) return step;
  return Math.max(tickSize, Math.round(step / tickSize) * tickSize);
}

/** Box/brick/range size: ATR(length) at the last bar or a fixed value, rounded to tick size. */
export function resolveBoxSize(
  d: SeriesData,
  method: BoxSizeMethod,
  atrLength: number,
  fixed: number,
  tickSize: number,
): number {
  let size = method === 'atr' ? averageTrueRange(d, atrLength) : fixed;
  if (!(size > 0) || !Number.isFinite(size)) {
    const last = d.length > 0 ? Math.abs(d.close[d.length - 1]!) : 1;
    size = Math.max(last * 0.01, tickSize > 0 ? tickSize : 1e-8);
  }
  return roundToTick(size, tickSize);
}

/** Splits `total` evenly across bars [from, to) of `out`. */
export function spreadVolume(out: { volume: number }[], from: number, total: number): void {
  const k = out.length - from;
  if (k <= 0) return;
  const each = total / k;
  for (let j = from; j < out.length; j++) out[j]!.volume = each;
}
