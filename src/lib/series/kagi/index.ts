import type { Candle, FrameState, KagiMethod, SeriesData, SeriesDefinition } from '@/lib/core';
import { clipPricePane, cssTransform } from '../shared/draw';
import { resolveBoxSize, roundToTick } from '../shared/box-size';

export interface KagiParams {
  readonly method: KagiMethod;
  /** Absolute reversal amount (atr / traditional). */
  readonly reversal: number;
  /** Reversal as a percentage of the price (percentage method). */
  readonly percent: number;
}

/**
 * Kagi on closes: a line extends while the price keeps going its way and turns into a new
 * line once the price reverses by the reversal amount. Each line is one bar: open = where it
 * started, close = where it currently ends.
 */
export function kagi(d: SeriesData, p: KagiParams): Candle[] {
  const out: Candle[] = [];
  const n = d.length;
  if (n === 0) return out;
  const start = d.close[0]!;
  const amount = (ref: number) =>
    p.method === 'percentage' ? (Math.abs(ref) * p.percent) / 100 : p.reversal;
  let cur: Candle | null = null;
  let dir = 0;
  let pending = 0;
  for (let i = 0; i < n; i++) {
    const c = d.close[i]!;
    const t = d.time[i]!;
    pending += d.volume[i]!;
    if (!cur) {
      if (Math.abs(c - start) >= amount(start) && c !== start) {
        cur = { time: t, open: start, close: c, high: 0, low: 0, volume: 0 };
        out.push(cur);
        dir = c > start ? 1 : -1;
      }
    } else if (dir === 1 ? c > cur.close : c < cur.close) {
      cur.close = c;
    } else if (Math.abs(cur.close - c) >= amount(cur.close) && c !== cur.close) {
      cur = { time: t, open: cur.close, close: c, high: 0, low: 0, volume: 0 };
      out.push(cur);
      dir = -dir;
    }
    if (cur) {
      cur.volume += pending;
      pending = 0;
    }
  }
  for (const b of out) {
    b.high = Math.max(b.open, b.close);
    b.low = Math.min(b.open, b.close);
  }
  return out;
}

/**
 * Kagi lines: vertical line per bar, joined by horizontal shoulders/waists. A line turns
 * thick (yang) when it rises above the previous shoulder and thin (yin) when it falls below
 * the previous waist.
 */
function renderKagi(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  const n = d.length;
  if (n === 0) return;
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const yang = new Path2D();
  const yin = new Path2D();
  const x = (k: number) => f.timeScale.indexToX(k);
  const y = (p: number) => f.priceScale.priceToY(p);
  const from = Math.max(0, f.visible.from - 1);
  const to = Math.min(n - 1, f.visible.to + 1);
  let isYang = d.close[0]! > d.open[0]!;
  let shoulder = -Infinity;
  let waist = Infinity;
  const seg = (path: Path2D, x0: number, y0: number, x1: number, y1: number) => {
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
  };
  for (let k = 0; k <= to; k++) {
    const a = d.open[k]!;
    const b = d.close[k]!;
    const up = b > a;
    const draw = k >= from;
    const xk = x(k);
    if (draw && k > 0) seg(isYang ? yang : yin, x(k - 1), y(a), xk, y(a));
    let mid: number | null = null;
    if (up && !isYang && b > shoulder && Number.isFinite(shoulder)) mid = shoulder;
    if (!up && isYang && b < waist && Number.isFinite(waist)) mid = waist;
    if (mid === null) {
      if (draw) seg(isYang ? yang : yin, xk, y(a), xk, y(b));
    } else {
      if (draw) seg(isYang ? yang : yin, xk, y(a), xk, y(mid));
      isYang = !isYang;
      if (draw) seg(isYang ? yang : yin, xk, y(mid), xk, y(b));
    }
    if (up) shoulder = b;
    else waist = b;
  }
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.setLineDash([]);
  ctx.strokeStyle = o.kagiYinColor;
  ctx.lineWidth = 1;
  ctx.stroke(yin);
  ctx.strokeStyle = o.kagiYangColor;
  ctx.lineWidth = 2;
  ctx.stroke(yang);
}

export const kagiSeries: SeriesDefinition = {
  id: 'kagi',
  label: 'Kagi',
  group: 'derived',
  icon: 'M4 20V10h5v6h4V4h5v12',
  transformOptions: ['kagiMethod', 'kagiAtrLength', 'kagiReversal', 'kagiPercent'],
  transform: (source, { options: o, symbol }) => {
    const reversal =
      o.kagiMethod === 'atr'
        ? resolveBoxSize(source, 'atr', o.kagiAtrLength, 0, symbol.tickSize)
        : roundToTick(o.kagiReversal, symbol.tickSize);
    return {
      bars: kagi(source, { method: o.kagiMethod, reversal, percent: o.kagiPercent }),
      boxSize: reversal,
    };
  },
  create: (ctx) => ({
    id: 'series.kagi',
    zIndex: 10,
    render: renderKagi,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
    lastValueColor: (d, o) =>
      d.close[d.length - 1]! >= d.open[d.length - 1]! ? o.kagiYangColor : o.kagiYinColor,
  }),
};
