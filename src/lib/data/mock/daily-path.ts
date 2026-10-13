import { DAY_MS, createRng, type Rng, type TradingHours } from '@/lib/core';
import type { MockModel } from './models';

/** Standard normal deviate (Marsaglia polar method; uses only rng.next()). */
export function gaussian(rng: Rng): number {
  for (;;) {
    const u = 2 * rng.next() - 1;
    const v = 2 * rng.next() - 1;
    const s = u * u + v * v;
    if (s > 0 && s < 1) return u * Math.sqrt((-2 * Math.log(s)) / s);
  }
}

/** Normal deviates in pairs (both values of each polar draw are used): half the cost. */
export function normalSource(rng: Rng): () => number {
  let spare = 0;
  let hasSpare = false;
  return () => {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }
    for (;;) {
      const u = 2 * rng.next() - 1;
      const v = 2 * rng.next() - 1;
      const s = u * u + v * v;
      if (s > 0 && s < 1) {
        const f = Math.sqrt((-2 * Math.log(s)) / s);
        spare = v * f;
        hasSpare = true;
        return u * f;
      }
    }
  };
}

/** Trading days of the model with their closing price and volatility. */
export interface DailyPath {
  /** UTC midnight of each trading day, ascending. */
  readonly days: Float64Array;
  readonly closes: Float64Array;
  /** Daily volatility (σ of the day's log return) the minute generator distributes. */
  readonly vols: Float64Array;
  /** Index of the trading day starting at `dayStart`, or -1. */
  indexOf(dayStart: number): number;
  /** Index of the first trading day at or after `time`'s UTC day. */
  firstAtOrAfter(time: number): number;
  /** Index of the last trading day at or before `time`'s UTC day. */
  lastAtOrBefore(time: number): number;
}

export function isTradingDay(dayStart: number, hours: TradingHours): boolean {
  const wd = new Date(dayStart).getUTCDay();
  const { weekOpen: o, weekClose: c } = hours;
  return o.day <= c.day ? wd >= o.day && wd <= c.day : wd >= o.day || wd <= c.day;
}

/**
 * Daily closes: a GARCH(1,1) random walk in log price, bridged through the model's anchors so
 * the path matches the intended levels exactly at each anchor date. Deterministic per seed.
 */
export function buildDailyPath(model: MockModel, hours: TradingHours): DailyPath {
  const dayList: number[] = [];
  for (let t = model.start; t < model.end; t += DAY_MS) if (isTradingDay(t, hours)) dayList.push(t);
  const n = dayList.length;
  const days = Float64Array.from(dayList);
  const rng = createRng(model.seed);
  const { alpha, beta } = model.garch;
  const longVar = model.dailyVol ** 2;
  const omega = longVar * (1 - alpha - beta);
  const walk = new Float64Array(n);
  const vols = new Float64Array(n);
  let variance = longVar;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const sigma = Math.sqrt(variance);
    // Fat tails: a few days a year move 3–4 sigma.
    const shock = gaussian(rng) * (rng.next() < 0.015 ? 2.8 : 1);
    const r = sigma * shock;
    walk[i] = (i === 0 ? 0 : prev) + r;
    vols[i] = sigma;
    prev = walk[i]!;
    variance = omega + alpha * r * r + beta * variance;
  }
  const logs = new Float64Array(n);
  const anchors = model.anchors.map(([t, p]) => [lowerBound(days, t), Math.log(p)] as const);
  for (let a = 0; a + 1 < anchors.length; a++) {
    const [i0, l0] = anchors[a]!;
    const [i1Raw, l1] = anchors[a + 1]!;
    const i1 = Math.min(i1Raw, n - 1);
    const span = Math.max(1, i1 - i0);
    const w0 = walk[i0]!;
    const w1 = walk[i1]!;
    for (let i = i0; i <= i1; i++) {
      const f = (i - i0) / span;
      logs[i] = walk[i]! - w0 - f * (w1 - w0) + l0 + f * (l1 - l0);
    }
  }
  const closes = new Float64Array(n);
  const inv = Math.round(1 / model.tickSize);
  for (let i = 0; i < n; i++) closes[i] = Math.round(Math.exp(logs[i]!) * inv) / inv;

  const indexOf = (dayStart: number): number => {
    const i = lowerBound(days, dayStart);
    return i < n && days[i] === dayStart ? i : -1;
  };
  const firstAtOrAfter = (time: number) => lowerBound(days, Math.floor(time / DAY_MS) * DAY_MS);
  const lastAtOrBefore = (time: number) =>
    lowerBound(days, Math.floor(time / DAY_MS) * DAY_MS + 1) - 1;
  return { days, closes, vols, indexOf, firstAtOrAfter, lastAtOrBefore };
}

/** First index with arr[i] >= v. */
function lowerBound(arr: Float64Array, v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
