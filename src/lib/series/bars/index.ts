import type { FrameState, SeriesDefinition } from '@/lib/core';
import { bodyWidth, clipPricePane, deviceX, isUp } from '../shared/draw';

/** OHLC bars: high–low stem, open tick to the left, close tick to the right. */
function renderBars(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  const { options: o, dpr } = f;
  const toY = (p: number) => Math.round(f.priceScale.priceToY(p) * dpr);
  const body = bodyWidth(f);
  const thick = o.barsThin
    ? Math.max(1, Math.floor(dpr))
    : Math.max(1, Math.floor(dpr), Math.round(f.timeScale.barSpacing * dpr * 0.12));
  const tick = Math.max(0, Math.floor(body / 2));
  const lead = Math.floor(thick / 2);
  for (const up of [true, false]) {
    ctx.fillStyle = up ? f.theme.colors.upBody : f.theme.colors.downBody;
    ctx.beginPath();
    for (let i = f.visible.from; i <= f.visible.to; i++) {
      if (isUp(d, i, o.barsColorOnPrevClose) !== up) continue;
      const x = deviceX(f, i);
      const yh = toY(d.high[i]!);
      const yl = toY(d.low[i]!);
      ctx.rect(x - lead, yh, thick, Math.max(1, yl - yh));
      if (tick < 1) continue;
      const yc = toY(d.close[i]!);
      ctx.rect(x - lead + thick, yc - lead, tick, thick);
      if (!o.barsHlc) {
        const yo = toY(d.open[i]!);
        ctx.rect(x - lead - tick, yo - lead, tick, thick);
      }
    }
    ctx.fill();
  }
}

export const barsSeries: SeriesDefinition = {
  id: 'bars',
  label: 'Bars',
  group: 'ohlc',
  icon: 'M7 3v18M4 7h3M7 15h3M17 3v18M14 9h3M17 17h3',
  create: (ctx) => ({
    id: 'series.bars',
    zIndex: 10,
    render: renderBars,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
  }),
};
