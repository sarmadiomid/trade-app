import type { BrickSource, Candle, FrameState, SeriesData, SeriesDefinition } from '@/lib/core';
import { clipPricePane, cssTransform } from '../shared/draw';
import { resolveBoxSize } from '../shared/box-size';

export interface PointFigureParams {
  readonly boxSize: number;
  readonly reversal: number;
  readonly source: BrickSource;
}

/**
 * Point & figure columns. Box k spans [k·box, (k+1)·box]. An X column grows while the price
 * fills new boxes upwards and reverses into an O column once the price falls `reversal` boxes
 * (and vice versa). Each column is one bar: X columns open at their bottom and close at their
 * top, O columns the other way round.
 */
export function pointFigure(d: SeriesData, p: PointFigureParams): Candle[] {
  const out: Candle[] = [];
  const n = d.length;
  const box = p.boxSize;
  if (n === 0 || !(box > 0)) return out;
  const rev = Math.max(1, Math.round(p.reversal));
  const topBox = (price: number) => Math.floor(price / box + 1e-9) - 1;
  const bottomBox = (price: number) => Math.ceil(price / box - 1e-9);
  const origin = Math.floor(d.close[0]! / box + 1e-9);
  let dir = 0;
  let lo = 0;
  let hi = 0;
  let cur: Candle | null = null;
  let pending = 0;
  const open = (time: number, up: boolean, from: number, to: number) => {
    dir = up ? 1 : -1;
    lo = from;
    hi = to;
    cur = { time, open: 0, high: 0, low: 0, close: 0, volume: 0 };
    out.push(cur);
  };
  for (let i = 0; i < n; i++) {
    const t = d.time[i]!;
    const high = p.source === 'hl' ? d.high[i]! : d.close[i]!;
    const low = p.source === 'hl' ? d.low[i]! : d.close[i]!;
    pending += d.volume[i]!;
    if (dir === 0) {
      if (topBox(high) >= origin) open(t, true, origin, topBox(high));
      else if (bottomBox(low) <= origin - 1) open(t, false, bottomBox(low), origin - 1);
    } else if (dir === 1) {
      if (topBox(high) > hi) hi = topBox(high);
      else if (bottomBox(low) <= hi - rev) open(t, false, bottomBox(low), hi - 1);
    } else if (bottomBox(low) < lo) lo = bottomBox(low);
    else if (topBox(high) >= lo + rev) open(t, true, lo + 1, topBox(high));
    const c = cur as Candle | null;
    if (c) {
      c.low = lo * box;
      c.high = (hi + 1) * box;
      c.open = dir === 1 ? c.low : c.high;
      c.close = dir === 1 ? c.high : c.low;
      c.volume += pending;
      pending = 0;
    }
  }
  return out;
}

/** X boxes for rising columns, O boxes for falling ones; solid columns when boxes get tiny. */
function renderPointFigure(ctx: CanvasRenderingContext2D, f: FrameState, box: number): void {
  const d = f.series;
  if (d.length === 0 || !(box > 0)) return;
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const c = f.theme.colors;
  const w = Math.max(1, f.timeScale.barSpacing * 0.9);
  const ref = d.close[Math.min(d.length - 1, Math.max(0, f.visible.to))]!;
  const boxPx = Math.abs(f.priceScale.priceToY(ref) - f.priceScale.priceToY(ref + box));
  const detailed = w >= 4 && boxPx >= 4;
  const pane = f.layout.pricePane;
  const xs = new Path2D();
  const os = new Path2D();
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const up = d.close[i]! >= d.open[i]!;
    const cx = f.timeScale.indexToX(i);
    const left = cx - w / 2;
    if (!detailed) {
      const top = f.priceScale.priceToY(d.high[i]!);
      const bottom = f.priceScale.priceToY(d.low[i]!);
      ctx.fillStyle = up ? c.upBody : c.downBody;
      ctx.fillRect(left, Math.min(top, bottom), w, Math.max(1, Math.abs(bottom - top)));
      continue;
    }
    const k0 = Math.round(d.low[i]! / box);
    const k1 = Math.round(d.high[i]! / box) - 1;
    const inset = Math.max(0.5, Math.min(w, boxPx) * 0.12);
    for (let k = k0; k <= k1; k++) {
      const yTop = f.priceScale.priceToY((k + 1) * box);
      const yBottom = f.priceScale.priceToY(k * box);
      const top = Math.min(yTop, yBottom);
      const bottom = Math.max(yTop, yBottom);
      if (bottom < pane.y || top > pane.y + pane.height) continue;
      if (up) {
        xs.moveTo(left + inset, top + inset);
        xs.lineTo(left + w - inset, bottom - inset);
        xs.moveTo(left + w - inset, top + inset);
        xs.lineTo(left + inset, bottom - inset);
      } else {
        const rx = Math.max(0.5, w / 2 - inset);
        const ry = Math.max(0.5, (bottom - top) / 2 - inset);
        os.moveTo(cx + rx, (top + bottom) / 2);
        os.ellipse(cx, (top + bottom) / 2, rx, ry, 0, 0, Math.PI * 2);
      }
    }
  }
  if (!detailed) return;
  const lw = Math.max(1, Math.min(2, Math.min(w, boxPx) / 8));
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.strokeStyle = c.upBody;
  ctx.stroke(xs);
  ctx.strokeStyle = c.downBody;
  ctx.stroke(os);
}

export const pointFigureSeries: SeriesDefinition = {
  id: 'point-figure',
  label: 'Point & figure',
  group: 'boxes',
  icon: 'M4 4l4 4M8 4l-4 4M4 10l4 4M8 10l-4 4M14 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0M14 14a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  transformOptions: ['pnfBoxMethod', 'pnfAtrLength', 'pnfBoxSize', 'pnfReversal', 'pnfSource'],
  transform: (source, { options: o, symbol }) => {
    const boxSize = resolveBoxSize(
      source,
      o.pnfBoxMethod,
      o.pnfAtrLength,
      o.pnfBoxSize,
      symbol.tickSize,
    );
    return {
      bars: pointFigure(source, { boxSize, reversal: o.pnfReversal, source: o.pnfSource }),
      boxSize,
    };
  },
  create: (ctx) => ({
    id: 'series.point-figure',
    zIndex: 10,
    render: (c, f) => renderPointFigure(c, f, ctx.boxSize()),
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
