import type { Candle, SeriesData, SeriesDefinition } from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';

/**
 * Heikin Ashi: close = (O+H+L+C)/4, open = midpoint of the previous HA body (first bar:
 * (O+C)/2), high/low widened to include the HA open and close. One bar per source bar.
 */
export function heikinAshi(d: SeriesData): Candle[] {
  const out: Candle[] = [];
  let prevOpen = 0;
  let prevClose = 0;
  for (let i = 0; i < d.length; i++) {
    const o = d.open[i]!;
    const h = d.high[i]!;
    const l = d.low[i]!;
    const c = d.close[i]!;
    const close = (o + h + l + c) / 4;
    const open = i === 0 ? (o + c) / 2 : (prevOpen + prevClose) / 2;
    out.push({
      time: d.time[i]!,
      open,
      high: Math.max(h, open, close),
      low: Math.min(l, open, close),
      close,
      volume: d.volume[i]!,
    });
    prevOpen = open;
    prevClose = close;
  }
  return out;
}

export const heikinAshiSeries: SeriesDefinition = {
  id: 'heikin-ashi',
  label: 'Heikin Ashi',
  group: 'derived',
  icon: 'M7 4v3M7 16v4M17 3v5M17 15v5M5 7h4v9H5zM15 8h4v7h-4z',
  transform: (source) => ({ bars: heikinAshi(source) }),
  create: (ctx) => ({
    id: 'series.heikin-ashi',
    zIndex: 10,
    render: renderCandles,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
