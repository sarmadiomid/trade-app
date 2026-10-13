import { MINUTE_MS, createRng, hashString, type TradingHours } from '@/lib/core';
import { gaussian, normalSource, type DailyPath } from './daily-path';
import type { MockModel } from './models';

/** One trading day of 1-minute bars in columns. */
export interface DayBars {
  readonly length: number;
  readonly time: Float64Array;
  readonly open: Float64Array;
  readonly high: Float64Array;
  readonly low: Float64Array;
  readonly close: Float64Array;
  readonly volume: Float64Array;
}

const MINUTES_PER_DAY = 24 * 60;

/** Relative activity per UTC hour: quiet Asia, London open, New York open and overlap. */
const HOURLY_ACTIVITY = [
  0.75, 0.6, 0.55, 0.55, 0.5, 0.55, 0.7, 1.15, 1.25, 1.05, 0.95, 0.9, 1.05, 1.7, 1.65, 1.45, 1.15,
  0.9, 0.8, 0.7, 0.6, 0.45, 0.4, 0.55,
];

/** Volatility multiplier for the minutes after a news release. */
const NEWS_DECAY = Array.from({ length: 12 }, (_, dt) => 1 + 9 * Math.exp(-dt / 3));

const minuteCache = new WeakMap<TradingHours, Map<number, readonly number[]>>();

/** Minutes of the UTC day `weekday` the market is open, ascending (memoised). */
export function openMinutes(weekday: number, hours: TradingHours): readonly number[] {
  let byDay = minuteCache.get(hours);
  if (!byDay) minuteCache.set(hours, (byDay = new Map()));
  let list = byDay.get(weekday);
  if (!list) byDay.set(weekday, (list = computeOpenMinutes(weekday, hours)));
  return list;
}

function computeOpenMinutes(weekday: number, hours: TradingHours): number[] {
  const from = weekday === hours.weekOpen.day ? hours.weekOpen.minute : 0;
  const to = weekday === hours.weekClose.day ? hours.weekClose.minute : MINUTES_PER_DAY;
  const out: number[] = [];
  const brk = hours.dailyBreak;
  for (let m = from; m < to; m++) if (!brk || m < brk.from || m >= brk.to) out.push(m);
  return out;
}

/**
 * Generates day `index` of the path: minute log returns with an intraday activity profile,
 * volatility clustering in 15-minute blocks and occasional news spikes, bridged so the day opens
 * at the previous close (plus a weekend gap on the first day of the week) and closes exactly at
 * the path's close. Pure function of (model, index).
 */
export function generateDay(
  model: MockModel,
  path: DailyPath,
  index: number,
  hours: TradingHours,
): DayBars {
  const dayStart = path.days[index]!;
  const weekday = new Date(dayStart).getUTCDay();
  const minutes = openMinutes(weekday, hours);
  const n = minutes.length;
  const rng = createRng((hashString(model.symbol) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const inv = Math.round(1 / model.tickSize);
  const round = (v: number) => Math.round(v * inv) / inv;
  const prevClose = index > 0 ? path.closes[index - 1]! : path.closes[0]!;
  const gap = weekday === hours.weekOpen.day && index > 0 ? Math.exp(gaussian(rng) * 0.0018) : 1;
  const open = round(prevClose * gap);
  const close = path.closes[index]!;
  const normal = normalSource(rng);

  // Per-minute variance weights.
  const weights = new Float64Array(n);
  const newsMinutes: number[] = [];
  if (rng.next() < 0.35) newsMinutes.push(12 * 60 + 30); // US data 08:30 ET
  if (rng.next() < 0.2) newsMinutes.push(14 * 60);
  if (rng.next() < 0.08) newsMinutes.push(18 * 60); // FOMC-style
  let block = 1;
  let total = 0;
  for (let k = 0; k < n; k++) {
    const m = minutes[k]!;
    if (m % 15 === 0) block = Math.exp(normal() * 0.35);
    let w = HOURLY_ACTIVITY[Math.floor(m / 60)]! * block;
    for (let j = 0; j < newsMinutes.length; j++) {
      const dt = m - newsMinutes[j]!;
      if (dt >= 0 && dt < NEWS_DECAY.length) w *= NEWS_DECAY[dt]!;
    }
    weights[k] = w;
    total += w;
  }

  // Random walk, then a variance-weighted bridge to the target close.
  const sigma = path.vols[index]!;
  const steps = new Float64Array(n);
  const minuteSigma = new Float64Array(n);
  let x = 0;
  for (let k = 0; k < n; k++) {
    const s = sigma * Math.sqrt(weights[k]! / total);
    minuteSigma[k] = s;
    const z = normal() * (rng.next() < 0.01 ? 3 : 1);
    x += s * z;
    steps[k] = x;
  }
  const target = Math.log(close / open);
  const drift = x - target;
  const out = alloc(n);
  let cum = 0;
  let prev = open;
  for (let k = 0; k < n; k++) {
    cum += weights[k]!;
    const level = steps[k]! - (cum / total) * drift;
    const c = k === n - 1 ? close : round(open * Math.exp(level));
    const o = prev;
    // Wicks: right-skewed, mean ≈ 0.6σ of the minute; linearised (σ ≪ 1).
    const wick = minuteSigma[k]! * 1.8;
    const u1 = rng.next();
    const u2 = rng.next();
    const hi = Math.max(o, c) * (1 + u1 * u1 * wick);
    const lo = Math.min(o, c) * (1 - u2 * u2 * wick);
    out.time[k] = dayStart + minutes[k]! * MINUTE_MS;
    out.open[k] = o;
    out.close[k] = c;
    out.high[k] = Math.max(round(hi), o, c);
    out.low[k] = Math.min(round(lo), o, c);
    out.volume[k] = Math.max(1, Math.round(weights[k]! * 60 * (0.6 + 0.8 * u1 * u2)));
    prev = c;
  }
  return out;
}

function alloc(n: number): DayBars {
  return {
    length: n,
    time: new Float64Array(n),
    open: new Float64Array(n),
    high: new Float64Array(n),
    low: new Float64Array(n),
    close: new Float64Array(n),
    volume: new Float64Array(n),
  };
}
