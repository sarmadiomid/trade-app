import {
  ENGINE_CONFIG,
  contrastText,
  drawLabel,
  formatDateTime,
  rectsIntersect,
  type FrameState,
  type LayerRenderer,
} from '@/lib/core';
import type { DrawingManager } from './drawing-manager';
import type { DrawingInteraction } from './interaction/drawing-interaction';
import type { Drawing, DrawingContext } from './types';

const { radius: HANDLE_R } = ENGINE_CONFIG.handles;

function contextFromFrame(f: FrameState, m: DrawingManager): DrawingContext {
  return {
    coords: f.coords,
    data: f.series,
    symbol: f.symbol,
    timeframe: f.timeframe,
    theme: f.theme,
    pane: f.layout.pricePane,
    dpr: f.dpr,
    formatPrice: f.formatPrice,
    measureText: (t, font) => m.engine.measureText(t, font),
  };
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  dc: DrawingContext,
  activeAnchor: number | null,
  faint: boolean,
): void {
  const c = dc.theme.colors;
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;
  for (const a of d.getAnchors(dc)) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.index === activeAnchor ? HANDLE_R + 1 : HANDLE_R, 0, Math.PI * 2);
    ctx.globalAlpha = faint ? 0.6 : 1;
    ctx.fillStyle = a.index === activeAnchor ? c.selection : c.drawingHandle;
    ctx.fill();
    ctx.strokeStyle = c.selection;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Renders every visible drawing (culled), the placement preview and selection handles. */
export function createDrawingsRenderer(
  m: DrawingManager,
  interaction: DrawingInteraction,
): LayerRenderer {
  return {
    id: 'drawings',
    zIndex: 0,
    render(ctx, f) {
      const preview = m.placementPreview;
      if (m.modes.hideAll && !preview) return;
      const dc = contextFromFrame(f, m);
      const pane = f.layout.pricePane;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.x, pane.y, pane.width, pane.height);
      ctx.clip();
      const selected = m.selected;
      const hover = interaction.hover;
      if (!m.modes.hideAll) {
        for (const d of m.store.all()) {
          if (d.hidden) continue;
          const b = d.bounds(dc);
          if (b && !rectsIntersect(b, pane)) continue;
          ctx.save();
          d.render(ctx, dc, {
            hovered: hover.id === d.id,
            selected: selected === d,
            placing: false,
          });
          ctx.restore();
        }
      }
      if (preview) {
        ctx.save();
        preview.render(ctx, dc, { hovered: false, selected: true, placing: true });
        ctx.restore();
        drawHandles(ctx, preview, dc, null, false);
      }
      if (selected && !selected.hidden && !m.modes.hideAll) {
        drawHandles(ctx, selected, dc, hover.id === selected.id ? hover.anchor : null, false);
      } else if (hover.id && !m.modes.hideAll) {
        const d = m.store.get(hover.id);
        if (d && !d.hidden) drawHandles(ctx, d, dc, hover.anchor, true);
      }
      ctx.restore();
    },
  };
}

/** Price / time axis labels of drawings that expose them (horizontal / vertical lines…). */
export function createDrawingAxisLabelsRenderer(m: DrawingManager): LayerRenderer {
  return {
    id: 'drawings.axis-labels',
    zIndex: 50,
    render(ctx, f) {
      const preview = m.placementPreview;
      if (m.modes.hideAll && !preview) return;
      const dc = contextFromFrame(f, m);
      const { priceAxis, timeAxis, pricePane } = f.layout;
      const list: Drawing[] = m.modes.hideAll ? [] : m.store.all().filter((d) => !d.hidden);
      if (preview) list.push(preview);
      for (const d of list) {
        const labels = d.axisLabels?.(dc);
        if (!labels) continue;
        for (const p of labels.prices ?? []) {
          const y = f.coords.priceToY(p.price);
          if (!Number.isFinite(y) || y < pricePane.y || y > pricePane.y + pricePane.height)
            continue;
          drawLabel(ctx, f.formatPrice(p.price), priceAxis.x + 1, y, {
            bg: p.color,
            fg: contrastText(p.color),
            font: f.font,
          });
        }
        for (const t of labels.times ?? []) {
          const x = f.coords.timeToX(t.time);
          if (!Number.isFinite(x) || x < timeAxis.x || x > timeAxis.x + timeAxis.width) continue;
          const text = formatDateTime(t.time, f.timeframe.dateOnly, !f.timeframe.dateOnly);
          ctx.font = f.font;
          const w = ctx.measureText(text).width + 16;
          const cx = Math.max(w / 2, Math.min(timeAxis.width - w / 2, x));
          drawLabel(ctx, text, cx, timeAxis.y + timeAxis.height / 2, {
            bg: t.color,
            fg: contrastText(t.color),
            font: f.font,
            align: 'center',
            height: timeAxis.height - 6,
          });
        }
      }
    },
  };
}
