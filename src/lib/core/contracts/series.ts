import type { Candle } from '../data/candle';
import type { MinMax, RangeMinMax } from '../data/range-min-max';
import type { SeriesData } from '../data/series-data';
import type { ChartOptions } from '../model/chart-options';
import type { LayerRenderer } from '../render/frame';
import type { Timeframe } from '../time/timeframes';
import type { SymbolInfo } from './symbol';
import type { Theme } from './theme';

/** A price series (chart type). */
export interface Series extends LayerRenderer {
  /** Price extent over bar indices [from, to] for auto-scale. */
  priceRange(from: number, to: number): MinMax | null;
  /** Colour of the last-price line and label; null falls back to the last bar's direction. */
  lastValueColor?(data: SeriesData, options: ChartOptions, theme: Theme): string | null;
  dispose?(): void;
}

export interface SeriesContext {
  readonly data: () => SeriesData;
  readonly minMax: () => RangeMinMax;
  readonly options: () => ChartOptions;
  /** Box size reported by the last transform run (0 when none). */
  readonly boxSize: () => number;
}

export interface SeriesTransformContext {
  readonly options: ChartOptions;
  readonly symbol: SymbolInfo;
  readonly timeframe: Timeframe;
}

export interface DerivedBars {
  readonly bars: readonly Candle[];
  /** Price step the transform worked with (Renko brick, P&F box, …). */
  readonly boxSize?: number;
}

export interface SeriesDefinition {
  readonly id: string;
  readonly label: string;
  /** SVG path data (24×24 viewBox). */
  readonly icon: string;
  /** Menu section; definitions sharing a group are listed together. */
  readonly group?: string;
  /** Bar spacing (css px) the chart zooms in to, if narrower, when switching to this type. */
  readonly minBarSpacing?: number;
  /**
   * Derives the displayed bars from the source bars (Heikin Ashi, Renko, …). When absent the
   * source bars are displayed as they are.
   */
  transform?(source: SeriesData, ctx: SeriesTransformContext): DerivedBars;
  /** Options the transform reads; changing one of them re-runs it. */
  readonly transformOptions?: readonly (keyof ChartOptions)[];
  create(ctx: SeriesContext): Series;
}
