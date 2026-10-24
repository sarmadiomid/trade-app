import {
  applyLineStyle,
  drawLabel,
  fontString,
  hLine,
  vLine,
  type ChartEngine,
  type ChartPointerEvent,
  type FrameState,
  type InteractionHandler,
  type LabelBox,
  type LayerRenderer,
} from '@/lib/core';
import { roundPrice } from '../execution/math';
import type { AccountConfig, AccountState, Position } from '../execution/types';
import { buildTradeLines, type DragOverride, type TradeLine } from './overlay-model';

export interface TradeOverlayHost {
  readonly cfg: AccountConfig;
  account(): AccountState;
  floating(p: Position): number;
  precision(): number;
  /** Session start (vertical marker), or null. */
  sessionStart(): number | null;
  /** A dragged level was released at `price` (null = the level's ✕ removed it). */
  commit(line: Pick<TradeLine, 'owner' | 'ownerId' | 'kind'>, price: number | null): void;
  /** ✕ on an entry / order line. */
  close(line: Pick<TradeLine, 'owner' | 'ownerId'>): void;
}

type HitKind = 'close' | 'ghost-sl' | 'ghost-tp' | 'label';
interface Hit {
  readonly kind: HitKind;
  readonly line: TradeLine;
  readonly box: LabelBox;
}

const LINE_TOLERANCE_PX = 4;
const FONT = fontString(11);
const MARKER_COLOR = '#787b86';

/**
 * Draws positions, pending orders and their SL/TP as lines with live P&L labels, and lets the
 * trader drag levels, create SL/TP from ghost handles and close from the label's ✕.
 */
export class TradeOverlay {
  readonly renderer: LayerRenderer;
  readonly handler: InteractionHandler;
  private hits: Hit[] = [];
  private lines: Array<{ line: TradeLine; y: number }> = [];
  private drag: { line: Pick<TradeLine, 'owner' | 'ownerId' | 'kind'>; price: number } | null =
    null;
  private hover: string | null = null;

  constructor(
    private readonly engine: ChartEngine,
    private readonly host: TradeOverlayHost,
  ) {
    this.renderer = { id: 'backtest.trades', zIndex: 60, render: (ctx, f) => this.render(ctx, f) };
    this.handler = {
      id: 'backtest.trades',
      priority: 80,
      onHover: (e) => this.onHover(e),
      onPointerDown: (e) => this.onDown(e),
      onPointerMove: (e) => this.onMove(e),
      onPointerUp: () => this.onUp(),
      onCancel: () => this.cancel(),
      onPointerLeave: () => this.setHover(null),
    };
  }

  attach(): () => void {
    const offs = [
      this.engine.addRenderer('overlay', this.renderer),
      this.engine.addInteractionHandler(this.handler),
    ];
    return () => offs.forEach((off) => off());
  }

  get dragging(): boolean {
    return this.drag !== null;
  }

  invalidate(): void {
    this.engine.invalidate('overlay');
  }

  // ---- rendering ---------------------------------------------------------------------------

  private render(ctx: CanvasRenderingContext2D, f: FrameState): void {
    const pane = f.layout.pricePane;
    const precision = this.host.precision();
    const drag: DragOverride | null = this.drag
      ? { ownerId: this.drag.line.ownerId, kind: this.drag.line.kind, price: this.drag.price }
      : null;
    const lines = buildTradeLines(
      this.host.cfg,
      this.host.account(),
      (p) => this.host.floating(p),
      precision,
      drag,
    );
    this.hits = [];
    this.lines = [];
    ctx.save();
    this.renderStartMarker(ctx, f);
    for (const line of lines) {
      const y = f.priceScale.priceToY(line.price);
      if (!Number.isFinite(y) || y < pane.y - 1 || y > pane.y + pane.height + 1) continue;
      this.lines.push({ line, y });
      const hot = this.hover === line.key || drag?.ownerId === line.ownerId;
      applyLineStyle(ctx, line.color, hot ? 2 : 1, line.dashed ? 'dashed' : 'solid');
      hLine(ctx, y, pane.x, pane.x + pane.width, f.dpr, hot ? 2 : 1);
      ctx.setLineDash([]);
      this.renderLabel(ctx, f, line, y);
      drawLabel(ctx, line.price.toFixed(precision), f.layout.priceAxis.x + 2, y, {
        bg: line.color,
        fg: '#ffffff',
        font: FONT,
      });
    }
    ctx.restore();
  }

  private renderLabel(ctx: CanvasRenderingContext2D, f: FrameState, line: TradeLine, y: number) {
    const right = f.layout.pricePane.x + f.layout.pricePane.width - 6;
    const opts = { font: FONT, align: 'right' as const, height: 20 };
    let x = right;
    if (line.closable) {
      const box = drawLabel(ctx, '✕', x, y, { ...opts, bg: line.color, fg: '#ffffff', padX: 6 });
      this.hits.push({ kind: 'close', line, box });
      x = box.x - 1;
    }
    const box = drawLabel(ctx, line.text, x, y, { ...opts, bg: '#ffffff', fg: line.color });
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1);
    this.hits.push({ kind: 'label', line, box });
    x = box.x - 4;
    for (const g of [...line.ghosts].reverse()) {
      const color = g === 'sl' ? '#ff9800' : '#3dcea0';
      const gb = drawLabel(ctx, g.toUpperCase(), x, y, { ...opts, bg: color, fg: '#ffffff' });
      this.hits.push({ kind: g === 'sl' ? 'ghost-sl' : 'ghost-tp', line, box: gb });
      x = gb.x - 3;
    }
  }

  private renderStartMarker(ctx: CanvasRenderingContext2D, f: FrameState): void {
    const start = this.host.sessionStart();
    if (start === null) return;
    const x = f.coords.timeToX(start);
    const plot = f.layout.plot;
    if (!Number.isFinite(x) || x < plot.x || x > plot.x + plot.width) return;
    applyLineStyle(ctx, MARKER_COLOR, 1, 'dashed');
    vLine(ctx, x, plot.y, plot.y + plot.height, f.dpr);
    ctx.setLineDash([]);
    drawLabel(ctx, 'Session start', x + 4, plot.y + plot.height - 14, {
      bg: MARKER_COLOR,
      fg: '#ffffff',
      font: FONT,
    });
  }

  // ---- interaction ---------------------------------------------------------------------------

  private hitAt(x: number, y: number): Hit | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i]!;
      const b = h.box;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return h;
    }
    return null;
  }

  private lineAt(y: number): TradeLine | null {
    let best: { line: TradeLine; d: number } | null = null;
    for (const { line, y: ly } of this.lines) {
      const d = Math.abs(ly - y);
      if (line.draggable && d <= LINE_TOLERANCE_PX && (!best || d < best.d)) best = { line, d };
    }
    return best?.line ?? null;
  }

  private onHover(e: ChartPointerEvent): string | null {
    const hit = this.hitAt(e.x, e.y);
    if (hit) {
      this.setHover(hit.line.key);
      if (hit.kind === 'label') return hit.line.draggable ? 'ns-resize' : 'default';
      return 'pointer';
    }
    const line = this.lineAt(e.y);
    this.setHover(line?.key ?? null);
    return line ? 'ns-resize' : null;
  }

  private onDown(e: ChartPointerEvent): boolean {
    if (e.button !== 0) return false;
    const hit = this.hitAt(e.x, e.y);
    if (hit?.kind === 'close') {
      const l = hit.line;
      if (l.kind === 'sl' || l.kind === 'tp') this.host.commit(l, null);
      else this.host.close(l);
      return true;
    }
    if (hit?.kind === 'ghost-sl' || hit?.kind === 'ghost-tp') {
      const kind = hit.kind === 'ghost-sl' ? 'sl' : 'tp';
      this.drag = {
        line: { owner: hit.line.owner, ownerId: hit.line.ownerId, kind },
        price: this.snap(e.price),
      };
      this.invalidate();
      return true;
    }
    const line = hit?.kind === 'label' && hit.line.draggable ? hit.line : this.lineAt(e.y);
    if (!line) return hit !== null; // swallow clicks on non-draggable labels
    this.drag = { line, price: line.price };
    this.invalidate();
    return true;
  }

  private onMove(e: ChartPointerEvent): void {
    if (!this.drag) return;
    this.drag = { ...this.drag, price: this.snap(e.price) };
    this.invalidate();
  }

  private onUp(): void {
    const d = this.drag;
    this.drag = null;
    if (d) this.host.commit(d.line, d.price);
    this.invalidate();
  }

  private cancel(): void {
    this.drag = null;
    this.invalidate();
  }

  private snap(price: number): number {
    return roundPrice(this.host.cfg, price);
  }

  private setHover(key: string | null): void {
    if (key === this.hover) return;
    this.hover = key;
    this.invalidate();
  }
}
