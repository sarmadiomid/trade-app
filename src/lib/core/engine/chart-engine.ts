import type { Candle } from '../data/candle';
import type { Clock, FrameScheduler, Timer } from '../contracts/runtime';
import type { Series, SeriesDefinition } from '../contracts/series';
import type { SymbolInfo } from '../contracts/symbol';
import type { Theme } from '../contracts/theme';
import { RangeMinMax } from '../data/range-min-max';
import { SeriesData, type SeriesChange } from '../data/series-data';
import { EventBus } from '../events/event-bus';
import type { ChartEventMap, ViewportInfo } from '../events/chart-events';
import type { InteractionHandler } from '../interaction/types';
import { PointerRouter } from '../interaction/pointer-router';
import { DEFAULT_CHART_OPTIONS, type ChartOptions } from '../model/chart-options';
import type { ChartCoordinates } from '../model/coordinates';
import { computeLayout, type ChartLayout } from '../model/layout';
import { TimeIndex } from '../model/time-index';
import type { CrosshairState, FrameState, LayerRenderer } from '../render/frame';
import { LayerManager } from '../render/layer-manager';
import { ALL_LAYERS, LayerMask, type LayerId } from '../render/layers';
import { RenderLoop } from '../render/render-loop';
import { TimeWeights } from '../scales/time-ticks';
import { getTimeframe, type Timeframe, type TimeframeId } from '../time/timeframes';
import { DomHost } from './dom-host';
import { FrameBuilder, type PriceRangeContributor } from './frame-builder';
import { createNavigationTarget } from './navigation';
import { registerBuiltInRenderers } from './builtin-renderers';
import { ViewportController } from './viewport-controller';
import { ENGINE_CONFIG } from '../config';

export interface EngineRuntime {
  readonly frames: FrameScheduler;
  readonly timer: Timer;
  readonly clock: Clock;
  devicePixelRatio(): number;
}

export interface ChartEngineInit {
  readonly container: HTMLElement;
  readonly runtime: EngineRuntime;
  /** Series used when `options.chartType` cannot be resolved. */
  readonly series: SeriesDefinition;
  /** Resolves `options.chartType` to a series definition. Without it the chart type is fixed. */
  readonly resolveSeries?: (id: string) => SeriesDefinition | undefined;
  readonly theme: Theme;
  readonly symbol: SymbolInfo;
  readonly timeframe: TimeframeId;
  readonly options?: Partial<ChartOptions>;
}

/** Snaps the crosshair price (magnet). Returns null to keep the raw price. */
export type CrosshairSnapper = (barIndex: number, price: number, y: number) => number | null;

/**
 * Facade over the chart core. Owns data, viewport, layers and interaction; plugins extend it
 * through renderers, interaction handlers and price-range contributors.
 */
export class ChartEngine {
  readonly events = new EventBus<ChartEventMap>();
  readonly coords: ChartCoordinates;
  readonly viewport: ViewportController;
  private readonly host: DomHost;
  private readonly layers: LayerManager;
  private readonly loop: RenderLoop;
  private readonly router: PointerRouter;
  private readonly frames = new FrameBuilder();
  private readonly timeIndex: TimeIndex;
  private seriesDef: SeriesDefinition;
  private series: Series;
  private removeSeries: () => void = () => undefined;
  /** Bars as provided by setData. */
  private source = new SeriesData();
  /** Bars on screen: `source`, or bars derived from it by the series transform. */
  private data = this.source;
  private minMax = new RangeMinMax(this.data);
  private weights = new TimeWeights(this.data);
  private unsubscribeData: () => void = () => undefined;
  private unsubscribeSource: () => void = () => undefined;
  private boxSize = 0;
  private knownLength = 0;
  private options: ChartOptions;
  private theme: Theme;
  /** Painted instead of `theme` when set. `getTheme()` still returns the real theme. */
  private paintTheme: Theme | null = null;
  private symbol: SymbolInfo;
  private timeframe: Timeframe;
  private crosshair: CrosshairState | null = null;
  private handlerList: InteractionHandler[] = [];
  private contributors: PriceRangeContributor[] = [];
  private snapper: CrosshairSnapper | null = null;
  private layout: ChartLayout = computeLayout(0, 0, 0, null);
  private size = { width: 0, height: 0, dpr: 1 };
  private nearLeftEmitted = false;
  private lastFrame: FrameState | null = null;

  constructor(private readonly init: ChartEngineInit) {
    this.options = { ...DEFAULT_CHART_OPTIONS, ...init.options };
    this.theme = init.theme;
    this.symbol = init.symbol;
    this.timeframe = getTimeframe(init.timeframe);
    this.viewport = new ViewportController(init.runtime.clock);
    this.timeIndex = new TimeIndex(
      () => this.data,
      () => this.timeframe.ms,
    );
    this.coords = this.createCoordinates();
    this.host = new DomHost(init.container, (w, h) => this.resize(w, h));
    this.layers = new LayerManager(this.host.surfaces);
    this.loop = new RenderLoop(init.runtime.frames, (mask) => this.renderFrame(mask));
    this.seriesDef = init.resolveSeries?.(this.options.chartType) ?? init.series;
    this.options.chartType = this.seriesDef.id;
    this.series = this.createSeries(this.seriesDef);
    registerBuiltInRenderers(this.layers);
    this.removeSeries = this.layers.add('series', this.series);
    this.router = new PointerRouter(
      this.host.root,
      createNavigationTarget(this, this.host),
      init.runtime.timer,
    );
    this.applyOptions();
    this.setData(this.data, { resetView: true });
    const { width, height } = this.host.size;
    this.resize(width, height);
  }

  // ---- data -------------------------------------------------------------------------------

  /** Bars on screen (derived bars for Heikin Ashi, Renko, …). Drawings anchor to these. */
  get seriesData(): SeriesData {
    return this.data;
  }

  /** Bars as provided by setData, before any chart-type transform. */
  get sourceData(): SeriesData {
    return this.source;
  }

  setData(source: SeriesData, opts: { resetView?: boolean } = {}): void {
    this.unsubscribeSource();
    this.unsubscribeSource = () => undefined;
    this.source = source;
    let display = source;
    this.boxSize = 0;
    if (this.seriesDef.transform) {
      display = SeriesData.fromCandles(this.runTransform());
      this.unsubscribeSource = source.onChange((c) => this.refreshDerived(c));
    }
    this.attachDisplay(display, opts);
  }

  private attachDisplay(data: SeriesData, opts: { resetView?: boolean }): void {
    this.unsubscribeData();
    if (data !== this.data) {
      this.minMax.dispose();
      this.weights.dispose();
      this.data = data;
      this.minMax = new RangeMinMax(data);
      this.weights = new TimeWeights(data);
    }
    this.unsubscribeData = data.onChange((c) => this.onDataChange(c));
    this.knownLength = data.length;
    this.nearLeftEmitted = false;
    this.viewport.setDataLength(data.length);
    if (opts.resetView) {
      this.viewport.resetTime();
      this.viewport.price.autoScale = true;
      this.options.autoScale = true;
    }
    this.events.emit('data:changed', { length: data.length, reason: 'set' });
    this.viewportChanged();
  }

  private onDataChange(c: SeriesChange): void {
    const n = this.data.length;
    if (c.kind === 'prepend') {
      this.viewport.onPrepend(c.count);
      this.viewport.setDataLength(n);
      this.nearLeftEmitted = false;
    } else if (c.kind === 'update') {
      this.viewport.onAppend(this.knownLength, n, this.viewport.atLatest);
    } else {
      this.viewport.setDataLength(n);
    }
    this.knownLength = n;
    this.events.emit('data:changed', { length: n, reason: c.kind === 'reset' ? 'set' : c.kind });
    this.viewportChanged();
  }

  private runTransform(): readonly Candle[] {
    const out = this.seriesDef.transform!(this.source, {
      options: this.options,
      symbol: this.symbol,
      timeframe: this.timeframe,
    });
    this.boxSize = out.boxSize ?? 0;
    return out.bars;
  }

  /** Rebuilds the derived bars after `source` changed (null: options or symbol changed). */
  private refreshDerived(c: SeriesChange | null): void {
    if (!this.seriesDef.transform || this.data === this.source) return;
    const bars = this.runTransform();
    const old = this.data.length;
    let change: SeriesChange;
    if (c?.kind === 'prepend') {
      change = { kind: 'prepend', count: Math.max(0, bars.length - old) };
    } else if (c?.kind === 'update') {
      change = { kind: 'update', fromIndex: firstDifference(this.data, bars) };
    } else {
      change = { kind: 'reset' };
    }
    this.data.replace(bars, change);
  }

  private createSeries(def: SeriesDefinition): Series {
    return def.create({
      data: () => this.data,
      minMax: () => this.minMax,
      options: () => this.options,
      boxSize: () => this.boxSize,
    });
  }

  private switchSeries(def: SeriesDefinition): void {
    this.removeSeries();
    this.series.dispose?.();
    this.seriesDef = def;
    this.series = this.createSeries(def);
    this.removeSeries = this.layers.add('series', this.series);
    const before = this.data.length;
    this.setData(this.source, { resetView: false });
    if (this.data.length !== before) this.setData(this.source, { resetView: true });
    if (def.minBarSpacing && this.viewport.time.barSpacing < def.minBarSpacing) {
      this.viewport.time.barSpacing = def.minBarSpacing;
      this.viewportChanged();
    }
  }

  setSymbol(symbol: SymbolInfo): void {
    this.symbol = symbol;
    this.refreshDerived(null);
    this.invalidate(ALL_LAYERS);
  }

  getSymbol(): SymbolInfo {
    return this.symbol;
  }

  setTimeframe(id: TimeframeId): void {
    this.timeframe = getTimeframe(id);
    this.invalidate(ALL_LAYERS);
  }

  getTimeframe(): Timeframe {
    return this.timeframe;
  }

  // ---- options & theme --------------------------------------------------------------------

  getOptions(): Readonly<ChartOptions> {
    return this.options;
  }

  setOptions(patch: Partial<ChartOptions>): void {
    const prev = this.options;
    this.options = { ...this.options, ...patch };
    this.applyOptions();
    const def = this.init.resolveSeries?.(this.options.chartType) ?? this.seriesDef;
    this.options.chartType = def.id;
    if (def !== this.seriesDef) this.switchSeries(def);
    else if (def.transformOptions?.some((k) => prev[k] !== this.options[k]))
      this.setData(this.source, { resetView: true });
    this.events.emit('options:changed', this.options);
    this.invalidate(ALL_LAYERS);
  }

  private applyOptions(): void {
    const o = this.options;
    const price = this.viewport.price;
    price.setMode(o.scaleMode);
    price.inverted = o.invertScale;
    if (o.lockScale) o.autoScale = false;
    price.autoScale = o.autoScale;
    this.viewport.setLockRatio(o.lockScale);
    this.viewport.setRightMargin(o.rightMargin);
  }

  /** Called when a gesture changed auto-scale implicitly (price-axis drag). */
  syncAutoScaleOption(): void {
    if (this.options.autoScale !== this.viewport.price.autoScale) {
      this.options = { ...this.options, autoScale: this.viewport.price.autoScale };
      this.events.emit('options:changed', this.options);
    }
  }

  getTheme(): Theme {
    return this.theme;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.events.emit('theme:changed', theme);
    this.invalidate(ALL_LAYERS);
  }

  /**
   * Paints `theme` without changing the active theme. Null restores the active theme.
   * Used so lesson edit mode can tint the chart without recording that tint as state.
   */
  setPaintTheme(theme: Theme | null): void {
    if (theme === this.paintTheme) return;
    this.paintTheme = theme;
    this.invalidate(ALL_LAYERS);
  }

  // ---- viewport ---------------------------------------------------------------------------

  getViewport(): ViewportInfo {
    const { from, to } = this.viewport.time.visibleRange(this.data.length);
    return {
      from,
      to,
      barSpacing: this.viewport.time.barSpacing,
      rightIndex: this.viewport.time.rightIndex,
      atLatest: this.viewport.atLatest,
    };
  }

  viewportChanged(): void {
    this.events.emit('viewport:changed', this.getViewport());
    const left = this.viewport.time.leftIndex;
    if (
      !this.nearLeftEmitted &&
      this.data.length > 0 &&
      left < ENGINE_CONFIG.historyThresholdBars
    ) {
      this.nearLeftEmitted = true;
      this.events.emit('viewport:near-left-edge', { firstTime: this.data.time[0]! });
    }
    this.invalidate(ALL_LAYERS);
  }

  resetView(): void {
    this.viewport.resetTime();
    this.resetPriceScale();
  }

  resetPriceScale(): void {
    this.setOptions({ autoScale: true, lockScale: false });
    this.viewportChanged();
  }

  resetTimeScale(): void {
    this.viewport.resetTime();
    this.viewportChanged();
  }

  scrollToLatest(animated = true): void {
    this.viewport.scrollToLatest(animated);
    this.viewportChanged();
  }

  scrollBars(bars: number): void {
    this.viewport.scrollBars(bars);
    this.viewportChanged();
  }

  zoom(factor: number): void {
    const last = this.viewport.time.indexToX(this.data.lastIndex);
    const anchor = last >= 0 && last <= this.layout.plot.width ? last : this.layout.plot.width / 2;
    this.viewport.zoomTimeAt(anchor, factor);
    this.viewportChanged();
  }

  // ---- crosshair --------------------------------------------------------------------------

  setCrosshairSnapper(snapper: CrosshairSnapper | null): void {
    this.snapper = snapper;
  }

  setCrosshair(state: CrosshairState | null): void {
    this.crosshair = state;
    const n = this.data.length;
    this.events.emit(
      'crosshair:moved',
      state
        ? {
            ...state,
            barIndex: n === 0 ? -1 : Math.max(0, Math.min(n - 1, Math.round(state.index))),
          }
        : null,
    );
    this.invalidate(LayerMask.overlay);
  }

  getCrosshair(): CrosshairState | null {
    return this.crosshair;
  }

  get crosshairSnapper(): CrosshairSnapper | null {
    return this.snapper;
  }

  // ---- plugins ----------------------------------------------------------------------------

  addRenderer(layer: LayerId, renderer: LayerRenderer): () => void {
    const off = this.layers.add(layer, renderer);
    this.invalidate(LayerMask[layer]);
    return () => {
      off();
      this.invalidate(LayerMask[layer]);
    };
  }

  addInteractionHandler(handler: InteractionHandler): () => void {
    this.handlerList = [...this.handlerList, handler].sort((a, b) => b.priority - a.priority);
    return () => {
      this.handlerList = this.handlerList.filter((h) => h !== handler);
    };
  }

  get interactionHandlers(): readonly InteractionHandler[] {
    return this.handlerList;
  }

  addPriceRangeContributor(fn: PriceRangeContributor): () => void {
    this.contributors.push(fn);
    return () => {
      this.contributors = this.contributors.filter((c) => c !== fn);
    };
  }

  measureText(text: string, font: string): number {
    return this.host.measureText(text, font);
  }

  getLayout(): ChartLayout {
    return this.layout;
  }

  // ---- rendering --------------------------------------------------------------------------

  invalidate(mask: number | LayerId): void {
    this.loop.invalidate(typeof mask === 'number' ? mask : LayerMask[mask]);
  }

  private resize(width: number, height: number): void {
    const dpr = this.options.hiDpi ? Math.max(1, this.init.runtime.devicePixelRatio()) : 1;
    if (width === this.size.width && height === this.size.height && dpr === this.size.dpr) return;
    this.size = { width, height, dpr };
    this.layers.resize(width, height, dpr);
    this.events.emit('resize', { width, height });
    this.invalidate(ALL_LAYERS);
    this.loop.flush();
  }

  private renderFrame(mask: number): void {
    if (this.size.width <= 0 || this.size.height <= 0) return;
    const animating = this.viewport.step();
    // Crosshair-only frames (the high-frequency case) reuse the last frame's layout, scales
    // and ticks instead of re-running auto-scale and tick selection.
    if (mask === LayerMask.overlay && !animating && this.lastFrame) {
      this.lastFrame = { ...this.lastFrame, crosshair: this.crosshair };
      this.layers.render(mask, this.lastFrame);
      return;
    }
    let frame = this.buildFrame();
    if (frame.relayout) {
      frame = this.buildFrame();
      mask = ALL_LAYERS;
    }
    this.layout = frame.frame.layout;
    this.lastFrame = frame.frame;
    this.layers.render(animating ? ALL_LAYERS : mask, frame.frame);
    if (animating) this.viewportChanged();
  }

  private buildFrame(): { frame: FrameState; relayout: boolean } {
    return this.frames.build({
      ...this.size,
      data: this.data,
      minMax: this.minMax,
      weights: this.weights,
      series: this.series,
      viewport: this.viewport,
      coords: this.coords,
      options: this.options,
      theme: this.paintTheme ?? this.theme,
      symbol: this.symbol,
      timeframe: this.timeframe,
      crosshair: this.crosshair,
      contributors: this.contributors,
      measureText: this.host.measureText,
    });
  }

  private createCoordinates(): ChartCoordinates {
    const vp = this.viewport;
    const ti = this.timeIndex;
    const layout = () => this.layout;
    return {
      get barSpacing() {
        return vp.time.barSpacing;
      },
      get pricePane() {
        return layout().pricePane;
      },
      get plot() {
        return layout().plot;
      },
      timeToIndex: (t) => ti.timeToIndex(t),
      indexToTime: (i) => ti.indexToTime(i),
      indexToX: (i) => vp.time.indexToX(i),
      xToIndex: (x) => vp.time.xToIndex(x),
      timeToX: (t) => vp.time.indexToX(ti.timeToIndex(t)),
      xToTime: (x) => ti.indexToTime(vp.time.xToIndex(x)),
      priceToY: (p) => vp.price.priceToY(p),
      yToPrice: (y) => vp.price.yToPrice(y),
    };
  }

  destroy(): void {
    this.loop.destroy();
    this.router.destroy();
    this.unsubscribeData();
    this.unsubscribeSource();
    this.removeSeries();
    this.minMax.dispose();
    this.weights.dispose();
    this.series.dispose?.();
    this.layers.destroy();
    this.host.destroy();
    this.events.clear();
  }
}

/** First bar index where `data` and `bars` differ (the common length when one is a prefix). */
function firstDifference(data: SeriesData, bars: readonly Candle[]): number {
  const n = Math.min(data.length, bars.length);
  for (let i = 0; i < n; i++) {
    const b = bars[i]!;
    if (
      data.time[i] !== b.time ||
      data.open[i] !== b.open ||
      data.high[i] !== b.high ||
      data.low[i] !== b.low ||
      data.close[i] !== b.close ||
      data.volume[i] !== b.volume
    )
      return i;
  }
  return n;
}
