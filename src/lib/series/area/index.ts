import type { FrameState, SeriesDefinition } from '@/lib/core';
import { clipPricePane, cssTransform, sourceValue } from '../shared/draw';
import { linePoints, sourceValueSeries, strokePoints, tracePoints, type LinePoint } from '../line';

function fillUnder(
  ctx: CanvasRenderingContext2D,
  pts: readonly LinePoint[],
  baseY: number,
  fill: CanvasGradient | string,
): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  tracePoints(ctx, pts);
  ctx.lineTo(pts[pts.length - 1]!.x, baseY);
  ctx.lineTo(pts[0]!.x, baseY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Fills the band between two polylines over the same bars. */
function fillBetween(
  ctx: CanvasRenderingContext2D,
  upper: readonly LinePoint[],
  lower: readonly LinePoint[],
  fill: string,
): void {
  if (upper.length === 0) return;
  ctx.beginPath();
  tracePoints(ctx, upper);
  tracePoints(ctx, [...lower].reverse(), false, false);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function gradient(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  c0: string,
  c1: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, Math.max(y0 + 1, y1));
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

function renderArea(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const pts = linePoints(f, (i) => sourceValue(d, i, o.lineSource));
  if (pts.length === 0) return;
  const pane = f.layout.pricePane;
  const bottom = pane.y + pane.height;
  let top = bottom;
  for (const p of pts) top = Math.min(top, p.y);
  fillUnder(ctx, pts, bottom, gradient(ctx, Math.max(pane.y, top), bottom, o.areaTopColor, o.areaBottomColor));
  strokePoints(ctx, pts, o.lineColor, o.lineWidth);
}

/** High and low lines with the bands to the close shaded (high side green, low side red). */
function renderHlcArea(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const d = f.series;
  if (d.length === 0) return;
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const hi = linePoints(f, (i) => d.high[i]!);
  const lo = linePoints(f, (i) => d.low[i]!);
  const cl = linePoints(f, (i) => d.close[i]!);
  fillBetween(ctx, hi, cl, o.hlcHighFill);
  fillBetween(ctx, cl, lo, o.hlcLowFill);
  strokePoints(ctx, hi, o.hlcHighColor, 1);
  strokePoints(ctx, lo, o.hlcLowColor, 1);
  strokePoints(ctx, cl, o.hlcCloseColor, 2);
}

/**
 * Baseline: the base level sits at `baselineLevel` % of the pane height (from the bottom).
 * Above it the line and gradient use the top colours, below it the bottom ones.
 */
function renderBaseline(ctx: CanvasRenderingContext2D, f: FrameState): number | null {
  const d = f.series;
  if (d.length === 0) return null;
  clipPricePane(ctx, f);
  cssTransform(ctx, f);
  const o = f.options;
  const pane = f.layout.pricePane;
  const bottom = pane.y + pane.height;
  const baseY = pane.y + (pane.height * (100 - o.baselineLevel)) / 100;
  const basePrice = f.priceScale.yToPrice(baseY);
  const pts = linePoints(f, (i) => sourceValue(d, i, o.lineSource));
  if (pts.length === 0) return basePrice;
  const halves: Array<[number, number, string, string, string]> = [
    [pane.y, baseY, o.baselineTopFill1, o.baselineTopFill2, o.baselineTopLine],
    [baseY, bottom, o.baselineBottomFill1, o.baselineBottomFill2, o.baselineBottomLine],
  ];
  for (const [y0, y1, c0, c1, line] of halves) {
    if (y1 <= y0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, y0, pane.width, y1 - y0);
    ctx.clip();
    fillUnder(ctx, pts, baseY, gradient(ctx, y0, y1, c0, c1));
    strokePoints(ctx, pts, line, o.lineWidth);
    ctx.restore();
  }
  return basePrice;
}

export const areaSeries: SeriesDefinition = {
  id: 'area',
  label: 'Area',
  group: 'area',
  icon: 'M3 17l5-6 4 3 4-7 5 5M3 17v4h18v-9',
  create: (ctx) => sourceValueSeries(ctx, 'series.area', renderArea, (c) => c.options().lineColor),
};

export const hlcAreaSeries: SeriesDefinition = {
  id: 'hlc-area',
  label: 'HLC area',
  group: 'area',
  icon: 'M3 9l5-4 5 3 8-4M3 19l5-4 5 3 8-5M3 14l5-4 5 3 8-4',
  create: (ctx) => ({
    id: 'series.hlc-area',
    zIndex: 10,
    render: renderHlcArea,
    priceRange: (from, to) => ctx.minMax().priceRange(from, to),
    lastValueColor: () => ctx.options().hlcCloseColor,
  }),
};

export const baselineSeries: SeriesDefinition = {
  id: 'baseline',
  label: 'Baseline',
  group: 'area',
  icon: 'M3 12h18M3 15l4-6 4 4 3-6 3 9 4-4',
  create: (ctx) => {
    let basePrice: number | null = null;
    return sourceValueSeries(
      ctx,
      'series.baseline',
      (c, f) => {
        basePrice = renderBaseline(c, f);
      },
      (c) => {
        const d = c.data();
        const o = c.options();
        if (basePrice === null || d.length === 0) return null;
        const above = sourceValue(d, d.length - 1, o.lineSource) >= basePrice;
        return above ? o.baselineTopLine : o.baselineBottomLine;
      },
    );
  },
};
