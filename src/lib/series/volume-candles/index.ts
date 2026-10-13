import type { FrameState, SeriesDefinition } from '@/lib/core';
import { renderCandles } from '../candlestick/candlestick-renderer';
import { bodyWidth, clipPricePane, deviceX, isLowDetail } from '../shared/draw';

/** Candles whose body width follows volume: the visible bar with the most volume is full width. */
function renderVolumeCandles(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  if (isLowDetail(f) || f.volumeMax <= 0) {
    renderCandles(ctx, f);
    return;
  }
  clipPricePane(ctx, f);
  const { dpr, options: o } = f;
  const c = f.theme.colors;
  const toY = (p: number) => Math.round(f.priceScale.priceToY(p) * dpr);
  const full = bodyWidth(f, 0.9);
  const line = Math.max(1, Math.floor(dpr));
  const lineHalf = Math.floor(line / 2);
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const open = d.open[i]!;
    const close = d.close[i]!;
    const up = close >= open;
    let w = Math.max(1, Math.round(full * Math.min(1, d.volume[i]! / f.volumeMax)));
    if (w % 2 === 0 && w > 2) w -= 1;
    const half = Math.floor(w / 2);
    const x = deviceX(f, i);
    if (o.showWicks) {
      ctx.fillStyle = up ? c.upWick : c.downWick;
      const yh = toY(d.high[i]!);
      ctx.fillRect(x - lineHalf, yh, line, Math.max(1, toY(d.low[i]!) - yh));
    }
    const top = Math.min(toY(open), toY(close));
    const h = Math.max(1, Math.abs(toY(close) - toY(open)));
    if (o.showBorders && w > 2 && h > 2) {
      ctx.fillStyle = up ? c.upBorder : c.downBorder;
      ctx.fillRect(x - half, top, w, h);
      if (o.showBody) {
        ctx.fillStyle = up ? c.upBody : c.downBody;
        ctx.fillRect(x - half + 1, top + 1, w - 2, h - 2);
      }
    } else if (o.showBody || o.showBorders) {
      ctx.fillStyle = up ? c.upBody : c.downBody;
      ctx.fillRect(x - half, top, w, h);
    }
  }
}

export const volumeCandlesSeries: SeriesDefinition = {
  id: 'volume-candles',
  label: 'Volume candles',
  group: 'ohlc',
  icon: 'M6 3v4M6 17v4M17 5v3M17 16v3M3 7h6v10H3zM15 8h4v8h-4z',
  create: (ctx) => ({
    id: 'series.volume-candles',
    zIndex: 10,
    render: renderVolumeCandles,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
