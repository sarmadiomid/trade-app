import { describe, expect, it } from 'vitest';
import { INGEST_TIMEFRAMES } from '@/server/ingest/timeframes';

describe('INGEST_TIMEFRAMES', () => {
  it('starts with 1m and covers mapped Dukascopy candle TFs', () => {
    expect(INGEST_TIMEFRAMES[0]).toEqual({ dukascopy: 'm1', app: '1m' });
    expect(INGEST_TIMEFRAMES.map((tf) => tf.app)).toEqual([
      '1m',
      '5m',
      '15m',
      '30m',
      '1h',
      '4h',
      '1D',
      '1M',
    ]);
  });

  it('does not include app-only or tick timeframes', () => {
    const apps = new Set(INGEST_TIMEFRAMES.map((tf) => tf.app));
    expect(apps.has('3m')).toBe(false);
    expect(apps.has('2h')).toBe(false);
    expect(apps.has('1W')).toBe(false);
  });
});
