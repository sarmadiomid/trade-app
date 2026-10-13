import { areaSeries, baselineSeries, hlcAreaSeries } from './area';
import { barsSeries } from './bars';
import { candlestickSeries } from './candlestick';
import { columnsSeries } from './columns';
import { heikinAshiSeries } from './heikin-ashi';
import { highLowSeries } from './high-low';
import { hollowCandlesSeries } from './hollow-candles';
import { kagiSeries } from './kagi';
import { lineSeries, stepLineSeries } from './line';
import { lineBreakSeries } from './line-break';
import { pointFigureSeries } from './point-figure';
import { rangeSeries } from './range';
import { renkoSeries } from './renko';
import { seriesRegistry } from './registry';
import { sessionVolumeProfileSeries } from './session-volume-profile';
import { tpoSeries } from './tpo';
import { volumeCandlesSeries } from './volume-candles';
import { volumeFootprintSeries } from './volume-footprint';

/**
 * The single place where chart types are registered. Registration order is menu order;
 * consecutive definitions sharing a `group` form one menu section.
 */
for (const def of [
  barsSeries,
  candlestickSeries,
  hollowCandlesSeries,
  volumeCandlesSeries,
  lineSeries,
  stepLineSeries,
  areaSeries,
  hlcAreaSeries,
  baselineSeries,
  columnsSeries,
  highLowSeries,
  volumeFootprintSeries,
  tpoSeries,
  sessionVolumeProfileSeries,
  heikinAshiSeries,
  renkoSeries,
  lineBreakSeries,
  kagiSeries,
  pointFigureSeries,
  rangeSeries,
])
  seriesRegistry.register(def);

export const DEFAULT_SERIES_ID = candlestickSeries.id;
