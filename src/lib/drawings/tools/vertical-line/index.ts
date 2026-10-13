import { z } from 'zod';
import type { Point } from '@/lib/core';
import {
  BaseDrawing,
  DEFAULT_FONT_FAMILY,
  V_ALIGN_OPTIONS,
  drawTextAlongSegment,
  lineFields,
  strokeSegment,
  textFields,
  textFont,
  zColor,
  zFontFamily,
  zFontSize,
  zLineStyle,
  zLineWidth,
  zOpacity,
  zVAlign,
  type AxisLabels,
  type DrawingContext,
  type DrawingToolDefinition,
} from '../../framework';

const TEXT_INSET = 6;

const verticalLineStyleSchema = z.object({
  color: zColor,
  opacity: zOpacity,
  lineWidth: zLineWidth,
  lineStyle: zLineStyle,
  showTime: z.boolean(),
  text: z.string().max(2000),
  textColor: zColor,
  fontSize: zFontSize,
  fontFamily: zFontFamily,
  bold: z.boolean(),
  italic: z.boolean(),
  textOrientation: z.enum(['vertical', 'horizontal']),
  textVAlign: zVAlign,
});

type VerticalLineStyle = z.infer<typeof verticalLineStyleSchema>;

/** One anchor at a time; a line through the full pane height. */
class VerticalLine extends BaseDrawing<VerticalLineStyle> {
  private x(dc: DrawingContext): number | null {
    const [a] = this.pixels(dc);
    return a ? a.x : null;
  }

  protected renderShape(ctx: CanvasRenderingContext2D, dc: DrawingContext): void {
    const x = this.x(dc);
    if (x === null) return;
    const s = this.style;
    const top = { x, y: dc.pane.y };
    const bottom = { x, y: dc.pane.y + dc.pane.height };
    strokeSegment(ctx, top, bottom, {
      color: s.color,
      width: s.lineWidth,
      style: s.lineStyle,
      opacity: s.opacity,
    });
    if (s.text.trim()) this.renderText(ctx, x, top, bottom);
  }

  private renderText(ctx: CanvasRenderingContext2D, x: number, top: Point, bottom: Point): void {
    const s = this.style;
    const t = {
      text: s.text,
      color: s.textColor,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      bold: s.bold,
      italic: s.italic,
    };
    if (s.textOrientation === 'vertical') {
      // Bottom → top so the text reads upwards, on the right of the line.
      drawTextAlongSegment(ctx, bottom, top, {
        ...t,
        align: s.textVAlign === 'top' ? 'right' : s.textVAlign === 'bottom' ? 'left' : 'center',
        position: 'bottom',
        inset: TEXT_INSET,
      });
      return;
    }
    const lines = s.text.split('\n');
    const lh = s.fontSize * 1.25;
    const h = lines.length * lh;
    const y0 =
      s.textVAlign === 'top'
        ? top.y + TEXT_INSET
        : s.textVAlign === 'bottom'
          ? bottom.y - TEXT_INSET - h
          : (top.y + bottom.y - h) / 2;
    ctx.save();
    ctx.font = textFont(t);
    ctx.fillStyle = s.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + TEXT_INSET, y0 + i * lh));
    ctx.restore();
  }

  protected hitBody(x: number, _y: number, dc: DrawingContext, tolerance: number): boolean {
    const lx = this.x(dc);
    return lx !== null && Math.abs(x - lx) <= tolerance + this.style.lineWidth / 2;
  }

  axisLabels(): AxisLabels | null {
    const p = this.points[0];
    if (!p || !this.style.showTime) return null;
    return { times: [{ time: p.time, color: this.style.color }] };
  }

  override bounds(): null {
    return null;
  }

  override priceRange(): null {
    return null;
  }
}

export const verticalLineTool: DrawingToolDefinition<VerticalLineStyle> = {
  id: 'vertical-line',
  label: 'Vertical Line',
  icon: 'M12 3v18M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  group: 'lines',
  placement: { kind: 'single' },
  defaults: {
    color: '#2962ff',
    opacity: 1,
    lineWidth: 1,
    lineStyle: 'solid',
    showTime: true,
    text: '',
    textColor: '#2962ff',
    fontSize: 14,
    fontFamily: DEFAULT_FONT_FAMILY,
    bold: false,
    italic: false,
    textOrientation: 'vertical',
    textVAlign: 'top',
  },
  styleSchema: verticalLineStyleSchema,
  themeDefaults: { color: 'drawingLine', textColor: 'drawingLine' },
  toolbar: ['color', 'lineWidth', 'lineStyle'],
  pointLabels: ['Time'],
  coordinateFields: [['time']],
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
              { kind: 'boolean', key: 'showTime', label: 'Time label' },
            ],
          },
        ],
      },
      {
        id: 'text',
        label: 'Text',
        groups: [
          {
            id: 'text',
            fields: [
              ...textFields(),
              {
                kind: 'select',
                key: 'textOrientation',
                label: 'Orientation',
                options: [
                  { value: 'vertical', label: 'Vertical' },
                  { value: 'horizontal', label: 'Horizontal' },
                ],
              },
              { kind: 'select', key: 'textVAlign', label: 'Position', options: V_ALIGN_OPTIONS },
            ],
          },
        ],
      },
    ],
  },
  create: (init) => new VerticalLine('vertical-line', init),
};
