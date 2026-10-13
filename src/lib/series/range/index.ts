import type { Candle, SeriesData, SeriesDefinition } from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';
import { resolveBoxSize } from '../shared/box-size';

/**
 * Range bars: every bar spans exactly `range` from low to high and closes at one extreme; the
 * next bar opens at that close. Source bars are walked along open → low → high → close
 * (bullish) or open → high → low → close (bearish). The last, still forming bar is included.
 */
export function rangeBars(d: SeriesData, range: number): Candle[] {
  const out: Candle[] = [];
  const n = d.length;
  if (n === 0 || !(range > 0)) return out;
  const eps = range * 1e-9;
  let cur: Candle = {
    time: d.time[0]!,
    open: d.open[0]!,
    high: d.open[0]!,
    low: d.open[0]!,
    close: d.open[0]!,
    volume: 0,
  };
  const close = (at: number, time: number) => {
    cur.close = at;
    cur.high = Math.max(cur.high, at);
    cur.low = Math.min(cur.low, at);
    out.push(cur);
    cur = { time, open: at, high: at, low: at, close: at, volume: 0 };
  };
  for (let i = 0; i < n; i++) {
    const t = d.time[i]!;
    const o = d.open[i]!;
    const h = d.high[i]!;
    const l = d.low[i]!;
    const c = d.close[i]!;
    const first = out.length;
    const path = c >= o ? [o, l, h, c] : [o, h, l, c];
    for (const price of path) {
      for (;;) {
        if (price >= cur.low + range - eps) close(cur.low + range, t);
        else if (price <= cur.high - range + eps) close(cur.high - range, t);
        else {
          cur.high = Math.max(cur.high, price);
          cur.low = Math.min(cur.low, price);
          cur.close = price;
          break;
        }
      }
    }
    const made = out.length - first;
    const share = d.volume[i]! / (made + 1);
    for (let j = first; j < out.length; j++) out[j]!.volume += share;
    cur.volume += share;
  }
  out.push(cur);
  return out;
}

export const rangeSeries: SeriesDefinition = {
  id: 'range',
  label: 'Range',
  group: 'boxes',
  icon: 'M6 4v16M4 8h2M6 16h2M12 8v12M10 12h2M12 18h2M18 4v12M16 6h2M18 14h2',
  transformOptions: ['rangeMethod', 'rangeAtrLength', 'rangeValue'],
  transform: (source, { options: o, symbol }) => {
    const boxSize = resolveBoxSize(
      source,
      o.rangeMethod,
      o.rangeAtrLength,
      o.rangeValue,
      symbol.tickSize,
    );
    return { bars: rangeBars(source, boxSize), boxSize };
  },
  create: (ctx) => ({
    id: 'series.range',
    zIndex: 10,
    render: renderCandles,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
