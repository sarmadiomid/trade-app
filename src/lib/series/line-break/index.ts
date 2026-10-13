import type { Candle, FrameState, SeriesData, SeriesDefinition } from '@/lib/core';
import { bodyWidth, clipPricePane, deviceX } from '../shared/draw';
import { spreadVolume } from '../shared/box-size';

/**
 * N-line break on closes: a new line continues the trend when the close passes the last line;
 * a reversal line needs the close to break the extreme of the last `count` lines and starts
 * from the far end of the last line.
 */
export function lineBreak(d: SeriesData, count: number): Candle[] {
  const out: Candle[] = [];
  const n = d.length;
  if (n === 0) return out;
  const lines = Math.max(1, Math.round(count));
  const start = d.close[0]!;
  let volume = 0;
  const push = (time: number, open: number, close: number) =>
    out.push({
      time,
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
      volume: 0,
    });
  for (let i = 0; i < n; i++) {
    const c = d.close[i]!;
    const t = d.time[i]!;
    const first = out.length;
    volume += d.volume[i]!;
    const last = out[out.length - 1];
    if (!last) {
      if (c !== start) push(t, start, c);
    } else {
      const up = last.close > last.open;
      let hi = -Infinity;
      let lo = Infinity;
      for (let k = Math.max(0, out.length - lines); k < out.length; k++) {
        hi = Math.max(hi, out[k]!.high);
        lo = Math.min(lo, out[k]!.low);
      }
      if (up) {
        if (c > last.close) push(t, last.close, c);
        else if (c < lo) push(t, last.open, c);
      } else if (c < last.close) push(t, last.close, c);
      else if (c > hi) push(t, last.open, c);
    }
    if (out.length > first) {
      spreadVolume(out, first, volume);
      volume = 0;
    }
  }
  return out;
}

/** Line break boxes: like candle bodies without wicks, drawn edge to edge. */
function renderLineBreak(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  const { dpr, options: o } = f;
  const c = f.theme.colors;
  const toY = (p: number) => Math.round(f.priceScale.priceToY(p) * dpr);
  const w = bodyWidth(f);
  const half = Math.floor(w / 2);
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const up = d.close[i]! >= d.open[i]!;
    const x = deviceX(f, i);
    const top = Math.min(toY(d.open[i]!), toY(d.close[i]!));
    const h = Math.max(1, Math.abs(toY(d.close[i]!) - toY(d.open[i]!)));
    if (o.showBorders && w > 2 && h > 2) {
      ctx.fillStyle = up ? c.upBorder : c.downBorder;
      ctx.fillRect(x - half, top, w, h);
      ctx.fillStyle = up ? c.upBody : c.downBody;
      if (o.showBody) ctx.fillRect(x - half + 1, top + 1, w - 2, h - 2);
      else ctx.clearRect(x - half + 1, top + 1, w - 2, h - 2);
    } else {
      ctx.fillStyle = up ? c.upBody : c.downBody;
      ctx.fillRect(x - half, top, w, h);
    }
  }
}

export const lineBreakSeries: SeriesDefinition = {
  id: 'line-break',
  label: 'Line break',
  group: 'derived',
  icon: 'M4 14h4v6H4zM8 8h4v6H8zM12 4h4v4h-4zM16 8h4v8h-4z',
  transformOptions: ['lineBreakCount'],
  transform: (source, { options }) => ({ bars: lineBreak(source, options.lineBreakCount) }),
  create: (ctx) => ({
    id: 'series.line-break',
    zIndex: 10,
    render: renderLineBreak,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
