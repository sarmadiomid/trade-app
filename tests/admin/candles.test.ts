import { describe, expect, it } from 'vitest';
import { parseCandleCsv, projectBars, sliceCandles, timeframeFromPath } from '@/lib/data';

describe('candle csv', () => {
  it('reads a headered file and snaps bars onto the timeframe', () => {
    const csv = [
      'time,open,high,low,close,volume',
      '2024-01-02T10:00:30.000Z,1.10,1.12,1.09,1.11,10',
      '2024-01-02T10:01:00.000Z,1.11,1.13,1.10,1.12,12',
    ].join('\n');
    const parsed = parseCandleCsv(csv, '1m');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const first = parsed.bars[0];
    if (!first) throw new Error('missing bar');
    expect(parsed.bars).toHaveLength(2);
    expect(first.open).toBe(1.1);
    expect(first.time % 60_000).toBe(0);
  });

  it('rejects a candle whose high is below the close', () => {
    const csv = '1700000000000,1,1,1,2,0';
    const parsed = parseCandleCsv(csv, '1m');
    expect(parsed.ok).toBe(false);
  });

  it('keeps the latest bars when no start is given', () => {
    const bars = [0, 1, 2, 3, 4].map((i) => ({
      time: i * 60_000,
      open: i,
      high: i,
      low: i,
      close: i,
      volume: 1,
    }));
    const sliced = sliceCandles(bars, { endTime: 3 * 60_000, limit: 2 });
    expect(sliced.bars.map((bar) => bar.close)).toEqual([2, 3]);
    expect(sliced.hasMoreHistory).toBe(true);
  });

  it('aggregates one-minute bars into fifteen minutes', () => {
    const bars = Array.from({ length: 15 }, (_, i) => ({
      time: i * 60_000,
      open: i === 0 ? 10 : i,
      high: 20,
      low: 5,
      close: i,
      volume: 1,
    }));
    const projected = projectBars('1m', bars, { timeframe: '15m', limit: 5 });
    expect(projected.bars).toHaveLength(1);
    expect(projected.bars[0]?.open).toBe(10);
    expect(projected.bars[0]?.close).toBe(14);
    expect(projected.bars[0]?.volume).toBe(15);
  });

  it('reads a MetaStock prn date without a time column', () => {
    const prn = [
      '<DTYYYYMMDD>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>',
      '19711231,4313.380000,4314.050000,4312.685000,4313.370000,460',
    ].join('\n');
    const parsed = parseCandleCsv(prn, '1m');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const first = parsed.bars[0];
    if (!first) throw new Error('missing bar');
    expect(first.time).toBe(Date.UTC(1971, 11, 31));
    expect(first.open).toBeCloseTo(4313.38);
    expect(first.volume).toBe(460);
  });

  it('combines a packed date with a separate clock column', () => {
    const prn = [
      '<DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>',
      '20200102,093015,1.1,1.2,1.0,1.15,8',
    ].join('\n');
    const parsed = parseCandleCsv(prn, '1m');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bars[0]?.time).toBe(Date.UTC(2020, 0, 2, 9, 30, 0));
  });

  it('reads the timeframe from an advanced-get path', () => {
    expect(timeframeFromPath('advanced-get/1minute/XAU_USD-1minute.prn')).toBe('1m');
    expect(timeframeFromPath('advanced-get/5minute/XAU_USD-5minute.prn')).toBe('5m');
    expect(timeframeFromPath('advanced-get/15minute/XAU_USD-15minute.prn')).toBe('15m');
    expect(timeframeFromPath('advanced-get/30minute/XAU_USD-30minute.prn')).toBe('30m');
    expect(timeframeFromPath('advanced-get/60minute/XAU_USD-60minute.prn')).toBe('1h');
    expect(timeframeFromPath('advanced-get/240minute/XAU_USD-240minute.prn')).toBe('4h');
    expect(timeframeFromPath('notes/readme.txt')).toBeNull();
  });
});
