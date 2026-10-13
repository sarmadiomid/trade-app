import type { FrameState, Series, SeriesContext, SeriesDefinition } from '@/lib/core';
import { clipPricePane, cssTransform, lineRange, sourceValue, valueRange } from '../shared/draw';

export interface LinePoint {
  readonly x: number;
  readonly y: number;
}

/** Css-pixel points of the source value over the visible bars (plus one bar each side). */
export function linePoints(f: FrameState, value: (i: number) => number): LinePoint[] {
  const { from, to } = lineRange(f);
  const out: LinePoint[] = [];
  for (let i = from; i <= to; i++)
    out.push({ x: f.timeScale.indexToX(i), y: f.priceScale.priceToY(value(i)) });
  return out;
}

/** Adds the polyline to the current path; `step` goes horizontal first, then vertical. */
export function tracePoints(
  ctx: CanvasRenderingContext2D,
  pts: readonly LinePoint[],
  step = false,
  move = true,
): void {
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k]!;
    if (k === 0) {
      if (move) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    } else if (step) {
      ctx.lineTo(p.x, pts[k - 1]!.y);
      ctx.lineTo(p.x, p.y);
    } else ctx.lineTo(p.x, p.y);
  }
}

export function strokePoints(
  ctx: CanvasRenderingContext2D,
  pts: readonly LinePoint[],
  color: string,
  width: number,
  step = false,
): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  tracePoints(ctx, pts, step);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = step ? 'miter' : 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  ctx.stroke();
}

/** Line-type charts scale on, and label, the plotted source value. */
export function sourceValueSeries(
  ctx: SeriesContext,
  id: string,
  render: (c: CanvasRenderingContext2D, f: FrameState) => void,
  color: (c: SeriesContext) => string | null,
): Series {
  return {
    id,
    zIndex: 10,
    render,
    priceRange: (from, to) => valueRange(ctx.data(), from, to, ctx.options().lineSource),
    lastValueColor: () => color(ctx),
  };
}

function renderLine(step: boolean) {
  return (ctx: CanvasRenderingContext2D, f: FrameState) => {
    const d = f.series;
    if (d.length === 0) return;
    clipPricePane(ctx, f);
    cssTransform(ctx, f);
    const src = f.options.lineSource;
    const pts = linePoints(f, (i) => sourceValue(d, i, src));
    strokePoints(ctx, pts, f.options.lineColor, f.options.lineWidth, step);
  };
}

export const lineSeries: SeriesDefinition = {
  id: 'line',
  label: 'Line',
  group: 'line',
  icon: 'M3 17l5-6 4 3 4-7 5 5',
  create: (ctx) =>
    sourceValueSeries(ctx, 'series.line', renderLine(false), (c) => c.options().lineColor),
};

export const stepLineSeries: SeriesDefinition = {
  id: 'step-line',
  label: 'Step line',
  group: 'line',
  icon: 'M3 18h4v-6h5v3h4V7h5',
  create: (ctx) =>
    sourceValueSeries(ctx, 'series.step-line', renderLine(true), (c) => c.options().lineColor),
};
