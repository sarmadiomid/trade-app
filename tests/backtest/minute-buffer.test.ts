import { describe, expect, it } from 'vitest';
import type { Candle } from '@/lib/core';
import { MinuteBuffer } from '@/lib/backtest';

const M = 60_000;
const bar = (t: number): Candle => ({ time: t, open: 1, high: 1, low: 1, close: t / M, volume: 1 });
const loader = (calls: Array<[number, number]>) => async (from: number, to: number) => {
  calls.push([from, to]);
  const out: Candle[] = [];
  for (let t = Math.ceil(from / M) * M; t < to; t += M) out.push(bar(t));
  return out;
};

describe('MinuteBuffer', () => {
  it('extends forward, trims, and only loads what is missing', async () => {
    const calls: Array<[number, number]> = [];
    const b = new MinuteBuffer(loader(calls));
    await b.ensure(0, 100 * M);
    await b.ensure(10 * M, 50 * M);
    expect(calls).toEqual([[0, 100 * M]]);
    await b.ensure(90 * M, 20_000 * M);
    expect(calls.at(-1)).toEqual([100 * M, 20_000 * M]);
    expect(b.slice(99 * M, 102 * M).map((x) => x.time)).toEqual([99 * M, 100 * M, 101 * M]);
    b.trimBefore(15_000 * M);
    expect(b.start).toBe(15_000 * M);
    expect(b.slice(0, 15_002 * M).map((x) => x.time)).toEqual([15_000 * M, 15_001 * M]);
    expect(b.lastBefore(15_001 * M)!.time).toBe(15_000 * M);
    await b.ensure(14_000 * M, 15_500 * M); // reaches back before the window
    expect(b.slice(14_000 * M, 14_002 * M)).toHaveLength(2);
    await b.ensure(50_000 * M, 50_010 * M); // disjoint: reload
    expect(b.start).toBe(50_000 * M);
    expect(b.slice(50_000 * M, 50_010 * M)).toHaveLength(10);
  });
});
