import {
  ENGINE_CONFIG,
  type FrameState,
  type MinMax,
  type PriceSource,
  type SeriesData,
} from '@/lib/core';

/** Identity transform + clip to the price pane, in device pixels. */
export function clipPricePane(ctx: CanvasRenderingContext2D, f: FrameState): void {
  const p = f.layout.pricePane;
  const d = f.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(p.x * d, p.y * d, p.width * d, p.height * d);
  ctx.clip();
}

/** Odd device-pixel body width so bodies centre on their wick. */
export function bodyWidth(f: FrameState, ratio: number = ENGINE_CONFIG.candleBodyRatio): number {
  const w = Math.max(1, Math.floor(f.timeScale.barSpacing * f.dpr * ratio));
  return w % 2 === 0 && w > 2 ? w - 1 : w;
}

export function deviceX(f: FrameState, i: number): number {
  return Math.round(f.timeScale.indexToX(i) * f.dpr);
}

export function isLowDetail(f: FrameState): boolean {
  return f.timeScale.barSpacing < ENGINE_CONFIG.lodBarSpacing;
}

export function sourceValue(d: SeriesData, i: number, src: PriceSource): number {
  switch (src) {
    case 'open':
      return d.open[i]!;
    case 'high':
      return d.high[i]!;
    case 'low':
      return d.low[i]!;
    case 'hl2':
      return (d.high[i]! + d.low[i]!) / 2;
    case 'hlc3':
      return (d.high[i]! + d.low[i]! + d.close[i]!) / 3;
    case 'ohlc4':
      return (d.open[i]! + d.high[i]! + d.low[i]! + d.close[i]!) / 4;
    default:
      return d.close[i]!;
  }
}

/** Min/max of `src` over bars [from, to]. Line-type charts auto-scale on the plotted value. */
export function valueRange(d: SeriesData, from: number, to: number, src: PriceSource): MinMax | null {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(d.length - 1, Math.ceil(to));
  if (a > b) return null;
  let min = Infinity;
  let max = -Infinity;
  for (let i = a; i <= b; i++) {
    const v = sourceValue(d, i, src);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/** Up/down direction of a bar: against the previous close, or against its own open. */
export function isUp(d: SeriesData, i: number, onPrevClose: boolean): boolean {
  if (onPrevClose && i > 0) return d.close[i]! >= d.close[i - 1]!;
  return d.close[i]! >= d.open[i]!;
}

/** Visible bar range widened by one bar each side so lines run to the pane edges. */
export function lineRange(f: FrameState): { from: number; to: number } {
  return {
    from: Math.max(0, f.visible.from - 1),
    to: Math.min(f.series.length - 1, f.visible.to + 1),
  };
}

/** Css-pixel transform (for path-based renderers), keeping the active clip. */
export function cssTransform(ctx: CanvasRenderingContext2D, f: FrameState): void {
  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
}
