import type { FrameState, SeriesDefinition } from '@/lib/core';
import { bodyWidth, clipPricePane, deviceX, isUp, valueRange } from '../shared/draw';

/** Columns rising from the bottom of the pane to the close. */
function renderColumns(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  const { dpr, options: o } = f;
  const pane = f.layout.pricePane;
  const bottom = Math.round((pane.y + pane.height) * dpr);
  const w = bodyWidth(f);
  const half = Math.floor(w / 2);
  for (const up of [true, false]) {
    ctx.fillStyle = up ? o.columnsUpColor : o.columnsDownColor;
    ctx.beginPath();
    for (let i = f.visible.from; i <= f.visible.to; i++) {
      if (isUp(d, i, o.columnsColorOnPrevClose) !== up) continue;
      const y = Math.round(f.priceScale.priceToY(d.close[i]!) * dpr);
      if (y >= bottom) continue;
      ctx.rect(deviceX(f, i) - half, y, w, bottom - y);
    }
    ctx.fill();
  }
}

export const columnsSeries: SeriesDefinition = {
  id: 'columns',
  label: 'Columns',
  group: 'columns',
  icon: 'M4 20V12M9 20V7M14 20v-9M19 20V4',
  create: (ctx) => ({
    id: 'series.columns',
    zIndex: 10,
    render: renderColumns,
    priceRange: (from, to) => valueRange(ctx.data(), from, to, 'close'),
    lastValueColor: (d, o) => {
      const i = d.length - 1;
      return isUp(d, i, o.columnsColorOnPrevClose) ? o.columnsUpColor : o.columnsDownColor;
    },
  }),
};
