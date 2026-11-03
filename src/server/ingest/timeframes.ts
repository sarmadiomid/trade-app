import type { TimeframeId } from '@/lib/core';

/** Dukascopy timeframe strings accepted by getHistoricalRates. */
export type DukascopyTimeframe =
  | 'm1'
  | 'm5'
  | 'm15'
  | 'm30'
  | 'h1'
  | 'h4'
  | 'd1'
  | 'mn1';

export interface IngestTimeframe {
  readonly dukascopy: DukascopyTimeframe;
  readonly app: TimeframeId;
}

/**
 * Candle timeframes we download for every Dukascopy-managed symbol.
 * Finest first so a partial run still leaves 1m practice-ready.
 * App-only TFs (3m, 2h, 1W) stay aggregated on read from finer series.
 */
export const INGEST_TIMEFRAMES: readonly IngestTimeframe[] = [
  { dukascopy: 'm1', app: '1m' },
  { dukascopy: 'm5', app: '5m' },
  { dukascopy: 'm15', app: '15m' },
  { dukascopy: 'm30', app: '30m' },
  { dukascopy: 'h1', app: '1h' },
  { dukascopy: 'h4', app: '4h' },
  { dukascopy: 'd1', app: '1D' },
  { dukascopy: 'mn1', app: '1M' },
];
