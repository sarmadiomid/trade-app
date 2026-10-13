import type { Point } from '@/lib/core';
import {
  BaseDrawing,
  drawTextAlongSegment,
  strokeSegment,
  type AxisLabels,
  type DrawingContext,
  type DrawingInit,
} from '../../framework';
import type { HorizontalLineStyle } from './style';

const TEXT_INSET = 4;

/**
 * One anchor at a price. `ray` = from the anchor to the right edge (Horizontal Ray),
 * otherwise across the whole pane (Horizontal Line).
 */
export class HorizontalLine extends BaseDrawing<HorizontalLineStyle> {
  constructor(
    type: string,
    init: DrawingInit<HorizontalLineStyle>,
    private readonly ray: boolean,
  ) {
    super(type, init);
  }

  private segment(dc: DrawingContext): [Point, Point] | null {
    const [a] = this.pixels(dc);
    if (!a) return null;
    const right = dc.pane.x + dc.pane.width;
    return [{ x: this.ray ? a.x : dc.pane.x, y: a.y }, { x: Math.max(right, a.x), y: a.y }];
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const seg = this.segment(dc);
    if (!seg) return;
    const s = this.style;
    strokeSegment(ctx, seg[0], seg[1], {
      color: s.color,
      width: s.lineWidth,
      style: s.lineStyle,
      opacity: s.opacity,
    });
    if (s.text.trim()) {
      drawTextAlongSegment(ctx, seg[0], seg[1], {
        text: s.text,
        color: s.textColor,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        bold: s.bold,
        italic: s.italic,
        align: s.textAlign,
        position: s.textPosition,
        inset: TEXT_INSET,
      });
    }
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tolerance: number): boolean {
    const seg = this.segment(dc);
    if (!seg) return false;
    if (x < seg[0].x - tolerance) return false;
    return Math.abs(y - seg[0].y) <= tolerance + this.style.lineWidth / 2;
  }

  axisLabels(): AxisLabels | null {
    const p = this.points[0];
    if (!p || !this.style.showPrice) return null;
    return { prices: [{ price: p.price, color: this.style.color }] };
  }

  override bounds(): null {
    return null;
  }

  override priceRange(): null {
    return null;
  }
}
