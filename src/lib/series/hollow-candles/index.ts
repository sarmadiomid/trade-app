import type { FrameState, SeriesDefinition } from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';
import { bodyWidth, clipPricePane, deviceX, isLowDetail } from '../shared/draw';

/**
 * Hollow candles: colour from close vs previous close (green rising, red falling), fill from
 * close vs open (hollow when close > open, filled otherwise). Wicks stop at the body.
 */
function renderHollowCandles(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  if (isLowDetail(f)) {
    renderCandles(ctx, f);
    return;
  }
  clipPricePane(ctx, f);
  const { dpr, options: o } = f;
  const c = f.theme.colors;
  const toY = (p: number) => Math.round(f.priceScale.priceToY(p) * dpr);
  const w = bodyWidth(f);
  const half = Math.floor(w / 2);
  const line = Math.max(1, Math.floor(dpr));
  const lineHalf = Math.floor(line / 2);
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const open = d.open[i]!;
    const close = d.close[i]!;
    const rising = i > 0 ? close >= d.close[i - 1]! : close >= open;
    const hollow = close > open;
    const x = deviceX(f, i);
    const yh = toY(d.high[i]!);
    const yl = toY(d.low[i]!);
    const top = Math.min(toY(open), toY(close));
    const bottom = Math.max(toY(open), toY(close));
    const h = Math.max(1, bottom - top);
    if (o.showWicks) {
      ctx.fillStyle = rising ? c.upWick : c.downWick;
      if (top > yh) ctx.fillRect(x - lineHalf, yh, line, top - yh);
      if (yl > top + h) ctx.fillRect(x - lineHalf, top + h, line, yl - top - h);
    }
    if (hollow) {
      ctx.fillStyle = rising ? c.upBorder : c.downBorder;
      if (w <= 2 * line || h <= 2 * line) {
        ctx.fillRect(x - half, top, w, h);
        continue;
      }
      ctx.fillRect(x - half, top, w, line);
      ctx.fillRect(x - half, top + h - line, w, line);
      ctx.fillRect(x - half, top, line, h);
      ctx.fillRect(x - half + w - line, top, line, h);
    } else {
      const fill = rising ? c.upBody : c.downBody;
      const border = rising ? c.upBorder : c.downBorder;
      if (o.showBorders && w > 2 && h > 2) {
        ctx.fillStyle = border;
        ctx.fillRect(x - half, top, w, h);
        if (o.showBody) {
          ctx.fillStyle = fill;
          ctx.fillRect(x - half + 1, top + 1, w - 2, h - 2);
        }
      } else {
        ctx.fillStyle = o.showBody ? fill : border;
        ctx.fillRect(x - half, top, w, h);
      }
    }
  }
}

export const hollowCandlesSeries: SeriesDefinition = {
  id: 'hollow-candles',
  label: 'Hollow candles',
  group: 'ohlc',
  icon: 'M7 3v3M7 17v4M17 3v6M17 16v5M5 6h4v11H5zM15 9h4v7h-4zM16.5 10v5M18 10v5',
  create: (ctx) => ({
    id: 'series.hollow-candles',
    zIndex: 10,
    render: renderHollowCandles,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
