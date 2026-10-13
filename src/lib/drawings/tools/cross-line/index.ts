import { z } from 'zod';
import {
  BaseDrawing,
  lineFields,
  setStroke,
  zColor,
  zLineStyle,
  zLineWidth,
  zOpacity,
  type AxisLabels,
  type DrawingContext,
  type DrawingToolDefinition,
} from '../../framework';

const crossLineStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  showPrice: z.boolean(),
  showTime: z.boolean(),
});

type CrossLineStyle = z.infer<typeof crossLineStyleSchema>;

/** One anchor; a horizontal and a vertical line through it across the whole pane. */
class CrossLine extends BaseDrawing<CrossLineStyle> {
  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const [a] = this.pixels(dc);
    if (!a) return;
    const s = this.style;
    const p = dc.pane;
    setStroke(ctx, { color: s.color, width: s.lineWidth, style: s.lineStyle, opacity: s.opacity });
    ctx.beginPath();
    ctx.moveTo(p.x, a.y);
    ctx.lineTo(p.x + p.width, a.y);
    ctx.moveTo(a.x, p.y);
    ctx.lineTo(a.x, p.y + p.height);
    ctx.stroke();
  }

  protected hitBody(x: number, y: number, dc: DrawingContext, tolerance: number): boolean {
    const [a] = this.pixels(dc);
    if (!a) return false;
    const t = tolerance + this.style.lineWidth / 2;
    return Math.abs(y - a.y) <= t || Math.abs(x - a.x) <= t;
  }

  axisLabels(): AxisLabels | null {
    const p = this.points[0];
    if (!p) return null;
    const color = this.style.color;
    return {
      prices: this.style.showPrice ? [{ price: p.price, color }] : [],
      times: this.style.showTime ? [{ time: p.time, color }] : [],
    };
  }

  override bounds(): null {
    return null;
  }

  override priceRange(): null {
    return null;
  }
}

export const crossLineTool: DrawingToolDefinition<CrossLineStyle> = {
  id: 'cross-line',
  label: 'Cross Line',
  icon: 'M3 12h18M12 3v18',
  shortcut: 'Alt+C',
  group: 'lines',
  placement: { kind: 'single' },
  defaults: {
    color: '#2962ff',
    opacity: 1,
    lineWidth: 1,
    lineStyle: 'solid',
    showPrice: true,
    showTime: true,
  },
  styleSchema: crossLineStyleSchema,
  themeDefaults: { color: 'drawingLine' },
  toolbar: ['color', 'lineWidth', 'lineStyle'],
  pointLabels: ['Point'],
  settings: {
    tabs: [
      {
        id: 'style',
        label: 'Style',
        groups: [
          {
            id: 'line',
            fields: [
              ...lineFields({
                color: 'color',
                opacity: 'opacity',
                width: 'lineWidth',
                style: 'lineStyle',
              }),
              { kind: 'boolean', key: 'showPrice', label: 'Price label' },
              { kind: 'boolean', key: 'showTime', label: 'Time label' },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new CrossLine('cross-line', init),
};
