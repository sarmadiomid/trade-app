import { rectContains, withOpacity, type Rect } from '@/lib/core';
import { BaseDrawing, strokeSegment, type DrawingContext } from '../../framework';
import { computeVolumeProfile, type VolumeProfile } from './profile-math';
import type { VolumeProfileStyle } from './style';

const ROW_GAP_PX = 1;

/** Two anchors set the bar range; the histogram is computed from the chart's own data. */
export class FixedRangeVolumeProfile extends BaseDrawing<VolumeProfileStyle> {
  profile(dc: DrawingContext): VolumeProfile | null {
    const [p1, p2] = this.points;
    if (!p1 || !p2) return null;
    const i1 = Math.round(dc.coords.timeToIndex(p1.time));
    const i2 = Math.round(dc.coords.timeToIndex(p2.time));
    return computeVolumeProfile(dc.data, i1, i2, this.style.rows, this.style.valueAreaPercent);
  }

  private box(dc: DrawingContext, profile: VolumeProfile | null): Rect | null {
    const [a, b] = this.pixels(dc);
    if (!a || !b) return null;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    const yTop = profile ? dc.coords.priceToY(profile.high) : Math.min(a.y, b.y);
    const yBottom = profile ? dc.coords.priceToY(profile.low) : Math.max(a.y, b.y);
    const y = Math.min(yTop, yBottom);
    return { x: x1, y, width: x2 - x1, height: Math.abs(yBottom - yTop) };
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const s = this.style;
    const profile = this.profile(dc);
    const box = this.box(dc, profile);
    if (!box) return;
    if (s.showBackground) {
      ctx.fillStyle = withOpacity(s.backgroundColor, s.backgroundOpacity);
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }
    if (!profile || profile.maxTotal <= 0) return;
    this.renderRows(ctx, dc, box, profile);
    const rowY = (price: number) => dc.coords.priceToY(price);
    const right = s.extendPoc
      ? Math.max(box.x + box.width, dc.pane.x + dc.pane.width)
      : box.x + box.width;
    if (s.showValueArea) {
      const yH = rowY(profile.low + (profile.vaHigh + 1) * profile.step);
      const yL = rowY(profile.low + profile.vaLow * profile.step);
      strokeSegment(ctx, { x: box.x, y: yH }, { x: box.x + box.width, y: yH }, {
        color: s.vahColor,
        width: s.vahWidth,
        style: s.vahStyle,
        opacity: s.vahOpacity,
      });
      strokeSegment(ctx, { x: box.x, y: yL }, { x: box.x + box.width, y: yL }, {
        color: s.valColor,
        width: s.valWidth,
        style: s.valStyle,
        opacity: s.valOpacity,
      });
    }
    if (s.showPoc) {
      const y = rowY(profile.low + (profile.poc + 0.5) * profile.step);
      strokeSegment(ctx, { x: box.x, y }, { x: right, y }, {
        color: s.pocColor,
        width: s.pocWidth,
        style: s.pocStyle,
        opacity: s.pocOpacity,
      });
    }
  }

  private renderRows(
    ctx: CanvasRenderingContext2D,
    dc: DrawingContext,
    box: Rect,
    p: VolumeProfile,
  ): void {
    const s = this.style;
    const maxW = (box.width * s.widthPercent) / 100;
    const fromRight = s.placement === 'right';
    const maxDelta =
      s.volumeMode === 'delta'
        ? Math.max(...p.up.map((u, r) => Math.abs(u - p.down[r]!)), 0)
        : p.maxTotal;
    if (maxDelta <= 0) return;
    const bar = (x: number, w: number, y: number, h: number, color: string, opacity: number) => {
      if (w <= 0) return;
      ctx.fillStyle = withOpacity(color, opacity);
      ctx.fillRect(fromRight ? box.x + box.width - x - w : box.x + x, y, w, h);
    };
    for (let r = 0; r < p.up.length; r++) {
      const yA = dc.coords.priceToY(p.low + r * p.step);
      const yB = dc.coords.priceToY(p.low + (r + 1) * p.step);
      let y = Math.min(yA, yB);
      let h = Math.abs(yA - yB);
      if (h > ROW_GAP_PX * 3) {
        y += ROW_GAP_PX / 2;
        h -= ROW_GAP_PX;
      }
      const inVA = r >= p.vaLow && r <= p.vaHigh;
      const upC = inVA ? s.vaUpColor : s.upColor;
      const upO = inVA ? s.vaUpOpacity : s.upOpacity;
      const dnC = inVA ? s.vaDownColor : s.downColor;
      const dnO = inVA ? s.vaDownOpacity : s.downOpacity;
      const up = p.up[r]!;
      const down = p.down[r]!;
      if (s.volumeMode === 'updown') {
        const wUp = (up / maxDelta) * maxW;
        const wDown = (down / maxDelta) * maxW;
        bar(0, wUp, y, h, upC, upO);
        bar(wUp, wDown, y, h, dnC, dnO);
      } else if (s.volumeMode === 'total') {
        bar(0, ((up + down) / maxDelta) * maxW, y, h, upC, upO);
      } else {
        const d = up - down;
        bar(0, (Math.abs(d) / maxDelta) * maxW, y, h, d >= 0 ? upC : dnC, d >= 0 ? upO : dnO);
      }
    }
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tol: number): boolean {
    const box = this.box(dc, this.profile(dc));
    if (!box) return false;
    return rectContains(
      { x: box.x - tol, y: box.y - tol, width: box.width + tol * 2, height: box.height + tol * 2 },
      x,
      y,
    );
  }

  override bounds(dc: DrawingContext): Rect | null {
    if (this.style.extendPoc) return null;
    const box = this.box(dc, this.profile(dc));
    if (!box) return null;
    const pts = this.pixels(dc);
    const ys = [box.y, box.y + box.height, ...pts.map((p) => p.y)];
    const top = Math.min(...ys) - 24;
    return {
      x: box.x - 24,
      y: top,
      width: box.width + 48,
      height: Math.max(...ys) + 24 - top,
    };
  }

  override priceRange(): null {
    return null;
  }
}
