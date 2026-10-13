import {
  EventBus,
  LayerMask,
  drawLabel,
  fontString,
  lastLessOrEqual,
  withOpacity,
  type ChartEngine,
  type ChartPointerEvent,
  type FrameState,
  type InteractionHandler,
  type LayerRenderer,
} from '@/lib/core';
import {
  EMPTY_MARKS,
  type ChallengeKind,
  type ChallengeMarks,
  type ChallengeResult,
  type ChartPoint,
  type ChartZone,
  type MarkStatus,
  type TimeRange,
} from '@/lib/lessons';

/**
 * 'input': the user edits marks. 'review': graded marks are shown (read-only).
 * 'solution': the answer key is shown (read-only).
 */
export type BoardMode = 'off' | 'input' | 'review' | 'solution';

/** 'marks' edits the answer marks; 'region' drags the challenge region (authoring). */
export type BoardTool = 'marks' | 'region';

export interface BoardConfig {
  readonly kind: ChallengeKind;
  readonly label: string;
  readonly region: TimeRange | null;
}

export interface BoardEventMap {
  /** Marks, region, mode or tool changed. */
  changed: Record<string, never>;
}

const CLICK_SLOP_PX = 4;
const POINT_HIT_PX = 10;
const SNAP_PX = 12;

const COLORS: Record<MarkStatus, string> = {
  hit: '#26a69a',
  extra: '#ef5350',
  miss: '#f5a623',
};

type Gesture =
  | {
      readonly kind: 'click-or-pan';
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      panning: boolean;
      down: ChartPointerEvent;
    }
  | { readonly kind: 'zone'; readonly start: ChartPointerEvent; current: ChartPointerEvent }
  | { readonly kind: 'region'; readonly start: ChartPointerEvent; current: ChartPointerEvent };

/**
 * Chart plugin that collects challenge answers (select candles, mark points, draw zones) and
 * paints marks, the region and graded feedback. Everything is stored as bar time and price.
 * Plain drags still pan the chart; zones are drawn by dragging.
 */
export class ChallengeBoard implements InteractionHandler {
  readonly id = 'challenge-board';
  /** Below drawing tools (50): an active drawing tool or a drawing hit still wins. */
  readonly priority = 40;
  readonly events = new EventBus<BoardEventMap>();
  private modeValue: BoardMode = 'off';
  private toolValue: BoardTool = 'marks';
  private config: BoardConfig = { kind: 'candles', label: '', region: null };
  private marksValue: ChallengeMarks = EMPTY_MARKS;
  private shown: ChallengeMarks = EMPTY_MARKS;
  private result: ChallengeResult | null = null;
  private gesture: Gesture | null = null;
  private hoverIndex: number | null = null;
  private readonly offs: Array<() => void>;

  constructor(private readonly engine: ChartEngine) {
    this.offs = [engine.addInteractionHandler(this), engine.addRenderer('drawings', this.renderer)];
  }

  get mode(): BoardMode {
    return this.modeValue;
  }

  get tool(): BoardTool {
    return this.toolValue;
  }

  get marks(): ChallengeMarks {
    return this.marksValue;
  }

  get region(): TimeRange | null {
    return this.config.region;
  }

  /** Starts collecting input for a challenge of `config`, beginning with `marks`. */
  start(config: BoardConfig, marks: ChallengeMarks = EMPTY_MARKS): void {
    this.config = config;
    this.marksValue = marks;
    this.result = null;
    this.toolValue = 'marks';
    this.gesture = null;
    this.modeValue = 'input';
    this.changed();
  }

  configure(patch: Partial<BoardConfig>): void {
    this.config = { ...this.config, ...patch };
    this.changed();
  }

  setMarks(marks: ChallengeMarks): void {
    this.marksValue = marks;
    this.changed();
  }

  setTool(tool: BoardTool): void {
    this.toolValue = tool;
    this.gesture = null;
    this.changed();
  }

  /** Back to editing the current marks (after review / solution). */
  edit(): void {
    this.modeValue = 'input';
    this.result = null;
    this.changed();
  }

  showResult(result: ChallengeResult): void {
    this.result = result;
    this.modeValue = 'review';
    this.changed();
  }

  showSolution(answer: ChallengeMarks): void {
    this.shown = answer;
    this.modeValue = 'solution';
    this.changed();
  }

  stop(): void {
    this.modeValue = 'off';
    this.marksValue = EMPTY_MARKS;
    this.result = null;
    this.gesture = null;
    this.hoverIndex = null;
    this.changed();
  }

  private changed(): void {
    this.engine.invalidate(LayerMask.drawings);
    this.events.emit('changed', {});
  }

  // ---- input ------------------------------------------------------------------------------

  private barIndexAt(e: ChartPointerEvent): number | null {
    const n = this.engine.seriesData.length;
    if (n === 0) return null;
    const i = Math.round(e.index);
    return i < 0 || i >= n ? null : i;
  }

  private barTime(i: number): number {
    return this.engine.seriesData.time[i]!;
  }

  private inRegion(time: number): boolean {
    const r = this.config.region;
    return !r || (time >= r.from && time <= r.to);
  }

  private clampIndex(index: number): number {
    const n = this.engine.seriesData.length;
    return Math.max(0, Math.min(n - 1, Math.round(index)));
  }

  onHover(e: ChartPointerEvent): string | null {
    if (this.modeValue !== 'input' || e.region !== 'price-pane') {
      this.setHover(null);
      return null;
    }
    if (this.toolValue === 'region') return 'col-resize';
    if (this.config.kind === 'candles') {
      const i = this.barIndexAt(e);
      this.setHover(i !== null && this.inRegion(this.barTime(i)) ? i : null);
      return i !== null ? 'pointer' : null;
    }
    return 'crosshair';
  }

  private setHover(i: number | null): void {
    if (i === this.hoverIndex) return;
    this.hoverIndex = i;
    this.engine.invalidate(LayerMask.drawings);
  }

  onPointerLeave(): void {
    this.setHover(null);
  }

  onPointerDown(e: ChartPointerEvent): boolean {
    if (this.modeValue !== 'input' || e.region !== 'price-pane' || e.button !== 0) return false;
    if (this.engine.seriesData.length === 0) return false;
    if (this.toolValue === 'region') {
      this.gesture = { kind: 'region', start: e, current: e };
      return true;
    }
    if (this.config.kind === 'zones' && this.zoneAt(e) === -1) {
      this.gesture = { kind: 'zone', start: e, current: e };
      return true;
    }
    this.gesture = {
      kind: 'click-or-pan',
      startX: e.x,
      startY: e.y,
      lastX: e.x,
      lastY: e.y,
      panning: false,
      down: e,
    };
    return true;
  }

  onPointerMove(e: ChartPointerEvent): void {
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'click-or-pan') {
      if (!g.panning && Math.hypot(e.x - g.startX, e.y - g.startY) > CLICK_SLOP_PX)
        g.panning = true;
      if (g.panning) {
        this.engine.viewport.panBy(e.x - g.lastX, e.y - g.lastY);
        this.engine.viewportChanged();
      }
      g.lastX = e.x;
      g.lastY = e.y;
      return;
    }
    g.current = e;
    this.engine.invalidate(LayerMask.drawings);
  }

  onPointerUp(e: ChartPointerEvent): void {
    const g = this.gesture;
    this.gesture = null;
    if (!g) return;
    if (g.kind === 'click-or-pan') {
      if (!g.panning) this.click(g.down);
      return;
    }
    g.current = e;
    if (g.kind === 'region') {
      const a = this.clampIndex(Math.min(g.start.index, e.index));
      const b = this.clampIndex(Math.max(g.start.index, e.index));
      this.config = { ...this.config, region: { from: this.barTime(a), to: this.barTime(b) } };
      this.toolValue = 'marks';
      this.changed();
      return;
    }
    const zone = this.zoneFrom(g.start, e);
    if (zone && Math.abs(e.y - g.start.y) >= CLICK_SLOP_PX) {
      this.marksValue = { ...this.marksValue, zones: [...this.marksValue.zones, zone] };
    }
    this.changed();
  }

  onCancel(): void {
    this.gesture = null;
    this.engine.invalidate(LayerMask.drawings);
  }

  private zoneFrom(a: ChartPointerEvent, b: ChartPointerEvent): ChartZone | null {
    const i0 = this.clampIndex(Math.min(a.index, b.index));
    const i1 = this.clampIndex(Math.max(a.index, b.index));
    const top = Math.max(a.price, b.price);
    const bottom = Math.min(a.price, b.price);
    if (!(top > bottom)) return null;
    return { from: this.barTime(i0), to: this.barTime(i1), top, bottom };
  }

  private zoneAt(e: ChartPointerEvent): number {
    const c = this.engine.coords;
    const zones = this.marksValue.zones;
    for (let k = zones.length - 1; k >= 0; k--) {
      const z = zones[k]!;
      const x0 = c.indexToX(c.timeToIndex(z.from)) - c.barSpacing / 2;
      const x1 = c.indexToX(c.timeToIndex(z.to)) + c.barSpacing / 2;
      const y0 = c.priceToY(z.top);
      const y1 = c.priceToY(z.bottom);
      if (e.x >= x0 && e.x <= x1 && e.y >= Math.min(y0, y1) && e.y <= Math.max(y0, y1)) return k;
    }
    return -1;
  }

  private click(e: ChartPointerEvent): void {
    const m = this.marksValue;
    if (this.config.kind === 'zones') {
      const k = this.zoneAt(e);
      if (k >= 0) this.marksValue = { ...m, zones: m.zones.filter((_, j) => j !== k) };
      this.changed();
      return;
    }
    const i = this.barIndexAt(e);
    if (i === null) return;
    const time = this.barTime(i);
    if (!this.inRegion(time)) return;
    if (this.config.kind === 'candles') {
      const has = m.candles.includes(time);
      const candles = has
        ? m.candles.filter((t) => t !== time)
        : [...m.candles, time].sort((a, b) => a - b);
      this.marksValue = { ...m, candles };
      this.changed();
      return;
    }
    const c = this.engine.coords;
    const near = m.points.findIndex(
      (p) => Math.hypot(c.timeToX(p.time) - e.x, c.priceToY(p.price) - e.y) <= POINT_HIT_PX,
    );
    if (near >= 0) {
      this.marksValue = { ...m, points: m.points.filter((_, j) => j !== near) };
    } else {
      this.marksValue = { ...m, points: [...m.points, { time, price: this.snapPrice(i, e) }] };
    }
    this.changed();
  }

  /** Snaps to the bar's high or low when the pointer is close to it. */
  private snapPrice(i: number, e: ChartPointerEvent): number {
    const d = this.engine.seriesData;
    const c = this.engine.coords;
    const hi = d.high[i]!;
    const lo = d.low[i]!;
    const dh = Math.abs(c.priceToY(hi) - e.y);
    const dl = Math.abs(c.priceToY(lo) - e.y);
    if (Math.min(dh, dl) <= SNAP_PX) return dh <= dl ? hi : lo;
    return e.price;
  }

  // ---- rendering --------------------------------------------------------------------------

  readonly renderer: LayerRenderer = {
    id: 'challenge-board',
    zIndex: 200,
    render: (ctx, f) => {
      if (this.modeValue === 'off') return;
      const pane = f.layout.pricePane;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.x, pane.y, pane.width, pane.height);
      ctx.clip();
      this.renderRegion(ctx, f);
      const accent = f.theme.colors.uiAccent;
      if (this.modeValue === 'review' && this.result) {
        const r = this.result;
        for (const g of r.candles)
          this.drawCandle(ctx, f, g.value, COLORS[g.status], g.status === 'miss');
        for (const g of r.zones)
          this.drawZone(ctx, f, g.value, COLORS[g.status], g.status === 'miss');
        for (const g of r.points)
          this.drawPoint(ctx, f, g.value, COLORS[g.status], g.status === 'miss');
      } else {
        const m = this.modeValue === 'solution' ? this.shown : this.marksValue;
        const color = this.modeValue === 'solution' ? COLORS.hit : accent;
        for (const t of m.candles) this.drawCandle(ctx, f, t, color, false);
        for (const z of m.zones) this.drawZone(ctx, f, z, color, false);
        for (const p of m.points) this.drawPoint(ctx, f, p, color, false);
      }
      if (this.modeValue === 'input') this.renderPreview(ctx, f, accent);
      ctx.restore();
    },
  };

  private renderRegion(ctx: CanvasRenderingContext2D, f: FrameState): void {
    const g = this.gesture;
    let region = this.config.region;
    if (g?.kind === 'region') {
      const a = this.clampIndex(Math.min(g.start.index, g.current.index));
      const b = this.clampIndex(Math.max(g.start.index, g.current.index));
      region = { from: this.barTime(a), to: this.barTime(b) };
    }
    if (!region) return;
    const pane = f.layout.pricePane;
    const half = f.timeScale.barSpacing / 2;
    const x0 = f.coords.timeToX(region.from) - half;
    const x1 = f.coords.timeToX(region.to) + half;
    ctx.fillStyle = withOpacity(f.theme.colors.background, 0.6);
    if (x0 > pane.x) ctx.fillRect(pane.x, pane.y, x0 - pane.x, pane.height);
    if (x1 < pane.x + pane.width) ctx.fillRect(x1, pane.y, pane.x + pane.width - x1, pane.height);
    ctx.strokeStyle = f.theme.colors.uiAccent;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x0, pane.y + 1, x1 - x0, pane.height - 2);
    ctx.setLineDash([]);
  }

  private renderPreview(ctx: CanvasRenderingContext2D, f: FrameState, accent: string): void {
    const g = this.gesture;
    if (g?.kind === 'zone') {
      const z = this.zoneFrom(g.start, g.current);
      if (z) this.drawZone(ctx, f, z, accent, true);
    }
    if (this.hoverIndex !== null && this.config.kind === 'candles' && this.toolValue === 'marks') {
      const t = this.engine.seriesData.time[this.hoverIndex];
      if (t !== undefined && !this.marksValue.candles.includes(t))
        this.drawCandle(ctx, f, t, withOpacity(accent, 0.5), true);
    }
  }

  private drawCandle(
    ctx: CanvasRenderingContext2D,
    f: FrameState,
    time: number,
    color: string,
    dashed: boolean,
  ): void {
    const d = f.series;
    const i = lastLessOrEqual(d.time, d.length, time);
    if (i < 0 || d.time[i] !== time) return;
    const x = f.timeScale.indexToX(i);
    const w = Math.max(6, f.timeScale.barSpacing * 0.9) + 4;
    const yTop = f.priceScale.priceToY(d.high[i]!) - 4;
    const yBot = f.priceScale.priceToY(d.low[i]!) + 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.strokeRect(x - w / 2, Math.min(yTop, yBot), w, Math.abs(yBot - yTop));
    ctx.setLineDash([]);
    if (!dashed) {
      ctx.fillStyle = withOpacity(color, 0.12);
      ctx.fillRect(x - w / 2, Math.min(yTop, yBot), w, Math.abs(yBot - yTop));
    }
  }

  private drawZone(
    ctx: CanvasRenderingContext2D,
    f: FrameState,
    z: ChartZone,
    color: string,
    dashed: boolean,
  ): void {
    const half = f.timeScale.barSpacing / 2;
    const x0 = f.coords.timeToX(z.from) - half;
    const x1 = f.coords.timeToX(z.to) + half;
    const y0 = f.priceScale.priceToY(z.top);
    const y1 = f.priceScale.priceToY(z.bottom);
    const top = Math.min(y0, y1);
    const h = Math.abs(y1 - y0);
    ctx.fillStyle = withOpacity(color, dashed ? 0.08 : 0.2);
    ctx.fillRect(x0, top, x1 - x0, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.strokeRect(x0, top, x1 - x0, h);
    ctx.setLineDash([]);
  }

  private drawPoint(
    ctx: CanvasRenderingContext2D,
    f: FrameState,
    p: ChartPoint,
    color: string,
    dashed: boolean,
  ): void {
    const x = f.coords.timeToX(p.time);
    const y = f.priceScale.priceToY(p.price);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    if (dashed) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const label = this.config.label.trim();
    if (label) {
      drawLabel(ctx, label, x, y - 18, {
        bg: color,
        fg: '#ffffff',
        font: fontString(11, undefined, true),
        align: 'center',
      });
    }
  }

  destroy(): void {
    for (const off of this.offs.splice(0)) off();
    this.events.clear();
  }
}
