import { distanceToSegment, withOpacity, type Rect } from '@/lib/core';
import { BaseDrawing, setStroke, strokeSegment, type DrawingContext } from '../../framework';
import { FIB_LEVELS, levelKeys, type FibRetracementStyle } from './style';

const LABEL_GAP = 4;

export interface FibLevel {
  readonly value: number;
  readonly color: string;
  readonly price: number;
}

function formatLevel(v: number, format: 'values' | 'percent'): string {
  if (format === 'percent') return `${Number((v * 100).toFixed(2))}%`;
  return String(Number(v.toFixed(4)));
}

/** Two anchors (start → end). Level 0 sits at the end point, level 1 at the start (unless reversed). */
export class FibRetracement extends BaseDrawing<FibRetracementStyle> {
  levels(): FibLevel[] {
    const [p1, p2] = this.points;
    if (!p1 || !p2) return [];
    const s = this.style;
    const [from, to] = s.reverse ? [p2, p1] : [p1, p2];
    const out: FibLevel[] = [];
    FIB_LEVELS.forEach((_, i) => {
      const k = levelKeys(i);
      if (!s[k.on]) return;
      const value = Number(s[k.value]);
      if (!Number.isFinite(value)) return;
      out.push({
        value,
        color: String(s[k.color]),
        price: to.price + (from.price - to.price) * value,
      });
    });
    return out.sort((a, b) => a.value - b.value);
  }

  private span(dc: DrawingContext): { x1: number; x2: number } | null {
    const [a, b] = this.pixels(dc);
    if (!a || !b) return null;
    let x1 = Math.min(a.x, b.x);
    let x2 = Math.max(a.x, b.x);
    if (this.style.extendLeft) x1 = Math.min(x1, dc.pane.x);
    if (this.style.extendRight) x2 = Math.max(x2, dc.pane.x + dc.pane.width);
    return { x1, x2 };
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const [a, b] = this.pixels(dc);
    if (!a || !b) return;
    const s = this.style;
    const span = this.span(dc)!;
    const levels = this.levels();
    const ys = levels.map((l) => dc.coords.priceToY(l.price));
    const width = span.x2 - span.x1;
    if (s.fillEnabled) {
      for (let i = 1; i < levels.length; i++) {
        ctx.fillStyle = withOpacity(levels[i]!.color, s.fillOpacity);
        const y1 = Math.min(ys[i - 1]!, ys[i]!);
        ctx.fillRect(span.x1, y1, width, Math.abs(ys[i]! - ys[i - 1]!));
      }
    }
    levels.forEach((l, i) => {
      setStroke(ctx, { color: l.color, width: s.levelsWidth, style: s.levelsStyle });
      ctx.beginPath();
      ctx.moveTo(span.x1, ys[i]!);
      ctx.lineTo(span.x2, ys[i]!);
      ctx.stroke();
    });
    if (s.showTrendLine) {
      strokeSegment(ctx, a, b, {
        color: s.trendColor,
        width: s.trendWidth,
        style: s.trendStyle,
        opacity: s.trendOpacity,
      });
    }
    if (s.showPrices || s.showLevels) this.renderLabels(ctx, dc, levels, ys, span);
  }

  private renderLabels(
    ctx: CanvasRenderingContext2D,
    dc: DrawingContext,
    levels: readonly FibLevel[],
    ys: readonly number[],
    span: { x1: number; x2: number },
  ): void {
    const s = this.style;
    const pane = dc.pane;
    ctx.setLineDash([]);
    ctx.font = `${s.fontSize}px Inter, system-ui, sans-serif`;
    let x: number;
    let align: CanvasTextAlign;
    if (s.labelsHAlign === 'left') {
      // Outside, left of the levels; inside the pane edge when extended left.
      [x, align] = s.extendLeft ? [pane.x + LABEL_GAP, 'left'] : [span.x1 - LABEL_GAP, 'right'];
    } else if (s.labelsHAlign === 'right') {
      [x, align] = s.extendRight
        ? [pane.x + pane.width - LABEL_GAP, 'right']
        : [span.x2 + LABEL_GAP, 'left'];
    } else {
      [x, align] = [(span.x1 + span.x2) / 2, 'center'];
    }
    ctx.textAlign = align;
    ctx.textBaseline =
      s.labelsVAlign === 'top' ? 'bottom' : s.labelsVAlign === 'bottom' ? 'top' : 'middle';
    const dy = s.labelsVAlign === 'top' ? -2 : s.labelsVAlign === 'bottom' ? 2 : 0;
    levels.forEach((l, i) => {
      const lvl = s.showLevels ? formatLevel(l.value, s.levelsFormat) : '';
      const price = s.showPrices ? dc.formatPrice(l.price) : '';
      const text = lvl && price ? `${lvl}(${price})` : lvl || price;
      ctx.fillStyle = l.color;
      ctx.fillText(text, x, ys[i]! + dy);
    });
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const [a, b] = this.pixels(dc);
    if (!a || !b) return false;
    const span = this.span(dc)!;
    const t = tol + this.style.levelsWidth / 2;
    if (x >= span.x1 - tol && x <= span.x2 + tol) {
      for (const l of this.levels()) {
        if (Math.abs(y - dc.coords.priceToY(l.price)) <= t) return true;
      }
    }
    return this.style.showTrendLine && distanceToSegment({ x, y }, a, b) <= tol;
  }

  override bounds(dc: DrawingContext): Rect | null {
    if (this.style.extendLeft || this.style.extendRight) return null;
    const span = this.span(dc);
    if (!span) return null;
    const ys = [
      ...this.levels().map((l) => dc.coords.priceToY(l.price)),
      ...this.pixels(dc).map((p) => p.y),
    ];
    const labelPad = 160;
    const top = Math.min(...ys) - 24;
    const bottom = Math.max(...ys) + 24;
    return {
      x: span.x1 - labelPad,
      y: top,
      width: span.x2 - span.x1 + labelPad * 2,
      height: bottom - top,
    };
  }
}
