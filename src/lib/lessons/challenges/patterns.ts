import { firstGreaterOrEqual, lastLessOrEqual, type SeriesData } from '@/lib/core';
import type { CandleRuleId, TimeRange } from './types';

interface Bar {
  readonly o: number;
  readonly h: number;
  readonly l: number;
  readonly c: number;
}

const bar = (d: SeriesData, i: number): Bar => ({
  o: d.open[i]!,
  h: d.high[i]!,
  l: d.low[i]!,
  c: d.close[i]!,
});

const range = (b: Bar) => b.h - b.l;
const body = (b: Bar) => Math.abs(b.c - b.o);
const upperWick = (b: Bar) => b.h - Math.max(b.o, b.c);
const lowerWick = (b: Bar) => Math.min(b.o, b.c) - b.l;

export interface CandleRule {
  readonly id: CandleRuleId;
  readonly label: string;
  /** Whether bar `i` matches (`i - 1` exists for rules that need the previous bar). */
  test(d: SeriesData, i: number): boolean;
}

export const CANDLE_RULES: readonly CandleRule[] = [
  {
    id: 'doji',
    label: 'Doji (body ≤ 10% of range)',
    test: (d, i) => {
      const b = bar(d, i);
      return range(b) > 0 && body(b) <= 0.1 * range(b);
    },
  },
  {
    id: 'hammer',
    label: 'Hammer',
    test: (d, i) => {
      const b = bar(d, i);
      const r = range(b);
      return r > 0 && body(b) <= 0.35 * r && lowerWick(b) >= 0.55 * r && upperWick(b) <= 0.15 * r;
    },
  },
  {
    id: 'shooting-star',
    label: 'Shooting star',
    test: (d, i) => {
      const b = bar(d, i);
      const r = range(b);
      return r > 0 && body(b) <= 0.35 * r && upperWick(b) >= 0.55 * r && lowerWick(b) <= 0.15 * r;
    },
  },
  {
    id: 'bullish-engulfing',
    label: 'Bullish engulfing',
    test: (d, i) => {
      if (i < 1) return false;
      const p = bar(d, i - 1);
      const b = bar(d, i);
      return p.c < p.o && b.c > b.o && b.o <= p.c && b.c >= p.o && body(b) > body(p);
    },
  },
  {
    id: 'bearish-engulfing',
    label: 'Bearish engulfing',
    test: (d, i) => {
      if (i < 1) return false;
      const p = bar(d, i - 1);
      const b = bar(d, i);
      return p.c > p.o && b.c < b.o && b.o >= p.c && b.c <= p.o && body(b) > body(p);
    },
  },
  {
    id: 'inside-bar',
    label: 'Inside bar',
    test: (d, i) => {
      if (i < 1) return false;
      const p = bar(d, i - 1);
      const b = bar(d, i);
      return b.h < p.h && b.l > p.l;
    },
  },
  { id: 'bullish', label: 'Bullish candles', test: (d, i) => d.close[i]! > d.open[i]! },
  { id: 'bearish', label: 'Bearish candles', test: (d, i) => d.close[i]! < d.open[i]! },
];

export function candleRule(id: CandleRuleId): CandleRule | undefined {
  return CANDLE_RULES.find((r) => r.id === id);
}

/** Bar index range [from, to] covered by `region` (the whole series when null). */
export function regionIndices(d: SeriesData, region: TimeRange | null): [number, number] {
  if (!region) return [0, d.length - 1];
  return [
    firstGreaterOrEqual(d.time, d.length, region.from),
    lastLessOrEqual(d.time, d.length, region.to),
  ];
}

/** Times of the bars in `region` that match `rule`. */
export function detectCandles(
  d: SeriesData,
  rule: CandleRuleId,
  region: TimeRange | null,
): number[] {
  const r = candleRule(rule);
  if (!r) return [];
  const [from, to] = regionIndices(d, region);
  const out: number[] = [];
  for (let i = Math.max(0, from); i <= to; i++) if (r.test(d, i)) out.push(d.time[i]!);
  return out;
}
