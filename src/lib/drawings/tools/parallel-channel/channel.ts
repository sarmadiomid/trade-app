import { distanceToSegment, extendSegment, withOpacity, type Point } from '@/lib/core';
import {
  BaseDrawing,
  fromPixel,
  pointInPolygon,
  strokeSegment,
  type AnchorHandle,
  type ChartPoint,
  type DrawingContext,
  type Modifiers,
} from '../../framework';
import type { ParallelChannelStyle } from './style';

interface ChannelGeometry {
  /** Base line A→B. */
  readonly a: Point;
  readonly b: Point;
  /** Parallel line C→D. */
  readonly c: Point;
  readonly d: Point;
}

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/**
 * Stored points: A, B (base line) and C — the start of the parallel line, at A's time.
 * The parallel line is the base line offset by C − A in pixels.
 * Handles: 0=A, 1=B, 2=C, 3=D (parallel end), 4/5 = middles of the base / parallel line.
 */
export class ParallelChannel extends BaseDrawing<ParallelChannelStyle> {
  private geometry(dc: DrawingContext): ChannelGeometry | null {
    const [a, b, c] = this.pixels(dc);
    if (!a || !b) return null;
    const off = c ? { x: c.x - a.x, y: c.y - a.y } : { x: 0, y: 0 };
    return { a, b, c: c ?? a, d: { x: b.x + off.x, y: b.y + off.y } };
  }

  private extended(dc: DrawingContext, p: Point, q: Point): [Point, Point] {
    return extendSegment(p, q, dc.pane, this.style.extendLeft, this.style.extendRight);
  }

  override getAnchors(dc: DrawingContext): AnchorHandle[] {
    const g = this.geometry(dc);
    if (!g) return [];
    if (this.points.length < 3)
      return [
        { index: 0, x: g.a.x, y: g.a.y, cursor: 'move' },
        { index: 1, x: g.b.x, y: g.b.y, cursor: 'move' },
      ];
    const m1 = mid(g.a, g.b);
    const m2 = mid(g.c, g.d);
    return [
      { index: 0, x: g.a.x, y: g.a.y, cursor: 'move' },
      { index: 1, x: g.b.x, y: g.b.y, cursor: 'move' },
      { index: 2, x: g.c.x, y: g.c.y, cursor: 'move' },
      { index: 3, x: g.d.x, y: g.d.y, cursor: 'move' },
      { index: 4, x: m1.x, y: m1.y, cursor: 'ns-resize' },
      { index: 5, x: m2.x, y: m2.y, cursor: 'ns-resize' },
    ];
  }

  override moveAnchor(index: number, p: ChartPoint, dc: DrawingContext, _mods: Modifiers): void {
    const [A, B, C] = this.points;
    if (!A || !B) return;
    if (!C) {
      if (index === 0) this.points = [p, B];
      else if (index === 1) this.points = [A, p];
      return;
    }
    const c = dc.coords;
    const y = (q: ChartPoint) => c.priceToY(q.price);
    const at = (time: number, py: number): ChartPoint => ({ time, price: c.yToPrice(py) });
    const offset = y(C) - y(A);
    const py = c.priceToY(p.price);
    switch (index) {
      case 0:
        this.points = [p, B, at(p.time, py + offset)];
        return;
      case 1:
        this.points = [A, p, C];
        return;
      case 2:
        this.points = [{ time: p.time, price: A.price }, B, { time: p.time, price: p.price }];
        return;
      case 3: {
        const nb = { time: p.time, price: B.price };
        this.points = [A, nb, at(A.time, y(A) + (py - y(nb)))];
        return;
      }
      case 4: {
        const dy = py - (y(A) + y(B)) / 2;
        this.points = [at(A.time, y(A) + dy), at(B.time, y(B) + dy), C];
        return;
      }
      case 5: {
        const dy = py - ((y(A) + y(B)) / 2 + offset);
        this.points = [A, B, at(A.time, y(C) + dy)];
        return;
      }
    }
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const g = this.geometry(dc);
    if (!g) return;
    const s = this.style;
    const stroke = { color: s.color, width: s.lineWidth, style: s.lineStyle, opacity: s.opacity };
    const [ea, eb] = this.extended(dc, g.a, g.b);
    if (this.points.length < 3) {
      strokeSegment(ctx, ea, eb, stroke);
      return;
    }
    const [ec, ed] = this.extended(dc, g.c, g.d);
    if (s.fillEnabled) {
      ctx.fillStyle = withOpacity(s.fillColor, s.fillOpacity);
      ctx.beginPath();
      ctx.moveTo(ea.x, ea.y);
      ctx.lineTo(eb.x, eb.y);
      ctx.lineTo(ed.x, ed.y);
      ctx.lineTo(ec.x, ec.y);
      ctx.closePath();
      ctx.fill();
    }
    if (s.showMiddleLine) {
      strokeSegment(ctx, mid(ea, ec), mid(eb, ed), {
        color: s.middleColor,
        width: s.middleWidth,
        style: s.middleStyle,
        opacity: s.middleOpacity,
      });
    }
    strokeSegment(ctx, ea, eb, stroke);
    strokeSegment(ctx, ec, ed, stroke);
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const g = this.geometry(dc);
    if (!g) return false;
    const at = { x, y };
    const t = tol + this.style.lineWidth / 2;
    const [ea, eb] = this.extended(dc, g.a, g.b);
    if (distanceToSegment(at, ea, eb) <= t) return true;
    if (this.points.length < 3) return false;
    const [ec, ed] = this.extended(dc, g.c, g.d);
    if (distanceToSegment(at, ec, ed) <= t) return true;
    if (this.style.showMiddleLine && distanceToSegment(at, mid(ea, ec), mid(eb, ed)) <= t)
      return true;
    return this.style.fillEnabled && pointInPolygon(x, y, [ea, eb, ed, ec]);
  }

  override bounds(dc: DrawingContext) {
    if (this.style.extendLeft || this.style.extendRight) return null;
    const g = this.geometry(dc);
    if (!g) return null;
    const xs = [g.a.x, g.b.x, g.c.x, g.d.x];
    const ys = [g.a.y, g.b.y, g.c.y, g.d.y];
    const pad = 24;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y };
  }

  override priceRange(): { min: number; max: number } | null {
    const [A, B, C] = this.points;
    if (!A || !B) return null;
    const prices = [A.price, B.price];
    if (C) prices.push(C.price, B.price + (C.price - A.price));
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }
}

/** Third placement click sets only the channel width: C sits at A's time, offset like the click. */
export function channelPoints(points: readonly ChartPoint[], dc: DrawingContext): ChartPoint[] {
  const [A, B, P] = points;
  if (!A || !B || !P) return [...points];
  const c = dc.coords;
  const ax = c.timeToX(A.time);
  const ay = c.priceToY(A.price);
  const bx = c.timeToX(B.time);
  const by = c.priceToY(B.price);
  const px = c.timeToX(P.time);
  const lineY = bx === ax ? ay : ay + ((by - ay) * (px - ax)) / (bx - ax);
  const cy = ay + (c.priceToY(P.price) - lineY);
  const C = fromPixel(ax, cy, dc, false);
  return [A, B, { time: A.time, price: C.price }];
}
