import type { FrameState, SeriesDefinition } from '@/lib/core';
import { bodyWidth, clipPricePane, deviceX } from '../shared/draw';

/** A box from low to high per bar, with the high and low printed above and below when room allows. */
function renderHighLow(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  const { dpr, options: o } = f;
  const toY = (p: number) => Math.round(f.priceScale.priceToY(p) * dpr);
  const w = bodyWidth(f);
  const half = Math.floor(w / 2);
  const border = o.hlShowBorders && w > 2;
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const x = deviceX(f, i);
    const top = toY(d.high[i]!);
    const h = Math.max(1, toY(d.low[i]!) - top);
    if (border) {
      ctx.fillStyle = o.hlBorderColor;
      ctx.fillRect(x - half, top, w, h);
      if (o.hlShowBody && h > 2) {
        ctx.fillStyle = o.hlBodyColor;
        ctx.fillRect(x - half + 1, top + 1, w - 2, h - 2);
      } else if (h > 2) {
        ctx.clearRect(x - half + 1, top + 1, w - 2, h - 2);
      }
    } else if (o.hlShowBody || o.hlShowBorders) {
      ctx.fillStyle = o.hlShowBody ? o.hlBodyColor : o.hlBorderColor;
      ctx.fillRect(x - half, top, w, h);
    }
  }
  if (!o.hlShowLabels) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = f.font;
  const sample = f.formatPrice(d.high[d.length - 1]!);
  if (ctx.measureText(sample).width + 4 > f.timeScale.barSpacing) return;
  ctx.fillStyle = o.hlLabelsColor;
  ctx.textAlign = 'center';
  for (let i = f.visible.from; i <= f.visible.to; i++) {
    const x = f.timeScale.indexToX(i);
    ctx.textBaseline = 'bottom';
    ctx.fillText(f.formatPrice(d.high[i]!), x, f.priceScale.priceToY(d.high[i]!) - 3);
    ctx.textBaseline = 'top';
    ctx.fillText(f.formatPrice(d.low[i]!), x, f.priceScale.priceToY(d.low[i]!) + 3);
  }
}

export const highLowSeries: SeriesDefinition = {
  id: 'high-low',
  label: 'High-low',
  group: 'columns',
  icon: 'M5 5h4v14H5zM15 8h4v8h-4zM7 3v1M7 20v1M17 6v1M17 17v1',
  create: (ctx) => ({
    id: 'series.high-low',
    zIndex: 10,
    render: renderHighLow,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
    lastValueColor: () => ctx.options().hlBodyColor,
  }),
};
