import { describe, expect, it } from 'vitest';
import {
  parseCandleCsv,
  parseCandleFile,
  parseCandleJson,
  projectBars,
  sliceCandles,
  timeframeFromPath,
} from '@/lib/data';

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

  it('reads short JSON dump names as timeframes', () => {
    expect(timeframeFromPath('m1.json')).toBe('1m');
    expect(timeframeFromPath('EURUSD_m15.json')).toBe('15m');
    expect(timeframeFromPath('15m.json')).toBe('15m');
    expect(timeframeFromPath('15minute.json')).toBe('15m');
    expect(timeframeFromPath('m30.json')).toBe('30m');
    expect(timeframeFromPath('30m.json')).toBe('30m');
    expect(timeframeFromPath('h1.json')).toBe('1h');
    expect(timeframeFromPath('h4.json')).toBe('4h');
    expect(timeframeFromPath('d1.json')).toBe('1D');
    expect(timeframeFromPath('1d.json')).toBe('1D');
    expect(timeframeFromPath('daily.json')).toBe('1D');
  });

  it('reads a JSON array of candle objects', () => {
    const json = JSON.stringify([
      { time: 1_700_000_000_000, open: 1.1, high: 1.12, low: 1.09, close: 1.11, volume: 900 },
      { time: 1_700_000_060_000, open: 1.11, high: 1.13, low: 1.1, close: 1.12, volume: 1000 },
    ]);
    const parsed = parseCandleJson(json, '1m');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bars).toHaveLength(2);
    expect(parsed.bars[0]?.open).toBe(1.1);
    expect(parsed.bars[0]?.volume).toBe(900);
    expect(parsed.bars[1]?.close).toBe(1.12);
  });

  it('reads JSON tuple rows and second-based timestamps', () => {
    const json = JSON.stringify({
      bars: [[1_704_067_200, 1.1, 1.2, 1.0, 1.15, 8]],
    });
    const parsed = parseCandleJson(json, '1m');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bars[0]?.time).toBe(1_704_067_200_000);
    expect(parsed.bars[0]?.close).toBe(1.15);
  });

  it('routes .json paths through the JSON parser', () => {
    const json = JSON.stringify([
      { time: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 },
    ]);
    const parsed = parseCandleFile(json, '5m', 'm5.json');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bars).toHaveLength(1);
  });
});
