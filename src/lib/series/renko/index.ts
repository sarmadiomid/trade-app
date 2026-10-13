import type { BrickSource, Candle, SeriesData, SeriesDefinition } from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';
import { resolveBoxSize, spreadVolume } from '../shared/box-size';

export interface RenkoParams {
  readonly boxSize: number;
  readonly source: BrickSource;
  readonly wicks: boolean;
}

/**
 * Traditional Renko: a brick per `boxSize` move beyond the last brick; a reversal needs a
 * move of two bricks. Each brick takes the time of the bar that completed it. With wicks, a
 * brick's wick shows the furthest the price went against it before it formed.
 */
export function renko(d: SeriesData, p: RenkoParams): Candle[] {
  const out: Candle[] = [];
  const n = d.length;
  const box = p.boxSize;
  if (n === 0 || !(box > 0)) return out;
  let base = d.close[0]!;
  let dir = 0;
  let lowSince = base;
  let highSince = base;
  let volume = 0;
  const brick = (time: number, open: number, close: number) => {
    const up = close > open;
    out.push({
      time,
      open,
      close,
      high: up ? close : p.wicks ? Math.max(open, highSince) : open,
      low: up ? (p.wicks ? Math.min(open, lowSince) : open) : close,
      volume: 0,
    });
    lowSince = close;
    highSince = close;
  };
  const feed = (time: number, price: number) => {
    for (;;) {
      if (dir >= 0 && price >= base + box) {
        brick(time, base, base + box);
        base += box;
        dir = 1;
      } else if (dir <= 0 && price <= base - box) {
        brick(time, base, base - box);
        base -= box;
        dir = -1;
      } else if (dir === 1 && price <= base - 2 * box) {
        brick(time, base - box, base - 2 * box);
        base -= 2 * box;
        dir = -1;
      } else if (dir === -1 && price >= base + 2 * box) {
        brick(time, base + box, base + 2 * box);
        base += 2 * box;
        dir = 1;
      } else return;
    }
  };
  for (let i = 0; i < n; i++) {
    const t = d.time[i]!;
    const first = out.length;
    volume += d.volume[i]!;
    lowSince = Math.min(lowSince, d.low[i]!);
    highSince = Math.max(highSince, d.high[i]!);
    if (p.source === 'hl') {
      if (dir >= 0) {
        feed(t, d.high[i]!);
        feed(t, d.low[i]!);
      } else {
        feed(t, d.low[i]!);
        feed(t, d.high[i]!);
      }
    } else feed(t, d.close[i]!);
    if (out.length > first) {
      spreadVolume(out, first, volume);
      volume = 0;
    }
  }
  return out;
}

export const renkoSeries: SeriesDefinition = {
  id: 'renko',
  label: 'Renko',
  group: 'derived',
  icon: 'M3 17h4v4H3zM7 13h4v4H7zM11 9h4v4h-4zM15 13h4v4h-4z',
  transformOptions: [
    'renkoBoxMethod',
    'renkoAtrLength',
    'renkoBoxSize',
    'renkoSource',
    'renkoWicks',
  ],
  transform: (source, { options: o, symbol }) => {
    const boxSize = resolveBoxSize(
      source,
      o.renkoBoxMethod,
      o.renkoAtrLength,
      o.renkoBoxSize,
      symbol.tickSize,
    );
    return { bars: renko(source, { boxSize, source: o.renkoSource, wicks: o.renkoWicks }), boxSize };
  },
  create: (ctx) => ({
    id: 'series.renko',
    zIndex: 10,
    render: renderCandles,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
