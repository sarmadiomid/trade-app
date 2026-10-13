import { describe, expect, it } from 'vitest';
import { aggregate, bucketStart, DAY_MS } from '@/lib/core';
import { MockMarketProvider, instrumentSpec } from '@/lib/data';

const T = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);

describe('MockMarketProvider (XAUUSD)', () => {
  const p = new MockMarketProvider();

  it('is deterministic across instances', () => {
    const a = new MockMarketProvider().minuteBars('XAUUSD', T(2024, 3, 4), T(2024, 3, 5));
    const b = p.minuteBars('XAUUSD', T(2024, 3, 4), T(2024, 3, 5));
    expect(a).toEqual(b);
    expect(a.length).toBe(23 * 60);
  });

  it('produces valid OHLC on the tick grid with contiguous opens', () => {
    const bars = p.minuteBars('XAUUSD', T(2023, 6, 5), T(2023, 6, 10));
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i]!;
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      expect(Math.abs(b.close * 100 - Math.round(b.close * 100))).toBeLessThan(1e-6);
      if (i > 0 && b.time - bars[i - 1]!.time === 60_000) expect(b.open).toBe(bars[i - 1]!.close);
    }
  });

  it('respects trading hours: no weekend, daily break 21:00-22:00, Friday closes 21:00', () => {
    const bars = p.minuteBars('XAUUSD', T(2024, 3, 4), T(2024, 3, 11));
    for (const b of bars) {
      const d = new Date(b.time);
      const wd = d.getUTCDay();
      const m = d.getUTCHours() * 60 + d.getUTCMinutes();
      expect(wd).toBeGreaterThanOrEqual(1);
      expect(wd).toBeLessThanOrEqual(5);
      expect(m >= 21 * 60 && m < 22 * 60).toBe(false);
      if (wd === 5) expect(m).toBeLessThan(21 * 60);
    }
  });

  it('aggregates every timeframe from the 1-minute bars', async () => {
    const from = T(2024, 5, 6);
    const to = T(2024, 5, 11);
    const minutes = p.minuteBars('XAUUSD', from, to);
    for (const tf of ['5m', '15m', '1h', '4h', '1D'] as const) {
      const res = await p.fetchBars({
        symbol: 'XAUUSD',
        timeframe: tf,
        startTime: from,
        endTime: to - 1,
        limit: 10_000,
      });
      expect(res.bars).toEqual(aggregate(minutes, '1m', tf));
    }
  });

  it('pages backwards and forwards consistently', async () => {
    const end = T(2024, 9, 18, 13, 7);
    const last = await p.fetchBars({
      symbol: 'XAUUSD',
      timeframe: '15m',
      endTime: end,
      limit: 300,
    });
    expect(last.bars).toHaveLength(300);
    expect(last.bars.at(-1)!.time).toBe(bucketStart(end, '15m'));
    const older = await p.fetchBars({
      symbol: 'XAUUSD',
      timeframe: '15m',
      endTime: last.bars[0]!.time - 1,
      limit: 200,
    });
    const fwd = await p.fetchBars({
      symbol: 'XAUUSD',
      timeframe: '15m',
      startTime: older.bars[0]!.time,
      limit: 500,
    });
    expect(fwd.bars).toEqual([...older.bars, ...last.bars]);
  });

  it('covers several years at realistic gold levels', async () => {
    const w = await p.fetchBars({ symbol: 'XAUUSD', timeframe: '1W', limit: 1000 });
    expect(w.bars.length).toBeGreaterThan(300);
    expect(w.bars[0]!.open).toBeGreaterThan(1000);
    expect(w.bars[0]!.open).toBeLessThan(1600);
    const range = p.dataRange('XAUUSD');
    expect(range.end - range.start).toBeGreaterThan(5 * 365 * DAY_MS);
    const daily = await p.fetchBars({ symbol: 'XAUUSD', timeframe: '1D', limit: 2000 });
    const moves = daily.bars
      .slice(1)
      .map((b, i) => Math.abs(Math.log(b.close / daily.bars[i]!.close)));
    const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
    expect(mean).toBeGreaterThan(0.004);
    expect(mean).toBeLessThan(0.012);
  });

  it('exposes the contract specification', () => {
    const s = instrumentSpec('xauusd')!;
    expect(s).toMatchObject({ contractSize: 100, pipSize: 0.1, tickSize: 0.01, lotMin: 0.01 });
    expect(p.getSymbolInfo('XAUUSD').pricePrecision).toBe(2);
  });
});
