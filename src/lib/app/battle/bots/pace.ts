import type { Persona } from './persona';
import { botRng } from './rng';

export interface PaceInput {
  readonly persona: Persona;
  readonly seed: number;
  /** Battle length (wall-clock, pauses excluded). */
  readonly durationMs: number;
  /** Market minutes per real minute. */
  readonly speed: number;
  /** Times of the battle's 1-minute bars (the candles a trader steps through). */
  readonly barTimes: ArrayLike<number>;
  readonly marketStart: number;
  /** Battle time the trader joined at (0 unless they joined late). */
  readonly joinElapsedMs: number;
  /** Candle indices the trader acts at (they pause to place orders). */
  readonly actionCandles: readonly number[];
}

/**
 * How far a trader has stepped through the replay, second by second of battle time. People do
 * not move at the clock's pace: they autoplay at their own speed, stop to think and to place
 * orders, look away, catch up when they notice the timer, and some never finish. The result is
 * the number of revealed candles at each second (monotonic, at most every candle).
 */
export function paceSchedule(input: PaceInput): Uint16Array {
  const { persona: p, barTimes } = input;
  const r = botRng(input.seed);
  const n = barTimes.length;
  const seconds = Math.max(1, Math.ceil(input.durationMs / 1000));
  const out = new Uint16Array(seconds + 1);
  const clockCandles = (sec: number) => {
    const t = input.marketStart + Math.floor((sec * input.speed) / 60) * 60_000;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (barTimes[mid]! < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const finisher = r.chance(0.9);
  const finishBy = seconds * r.range(0.82, 0.97);
  const acts = new Set(input.actionCandles);
  let x = 0;
  let pause = r.range(1, 4); // reading the chart before the first step
  const join = Math.floor(input.joinElapsedMs / 1000);
  let crossed = -1;
  for (let sec = 0; sec <= seconds; sec++) {
    if (sec < join) {
      out[sec] = 0;
      continue;
    }
    if (pause > 0) {
      pause -= 1;
    } else {
      let rate = p.stepRate * r.range(0.75, 1.25);
      const clock = clockCandles(sec);
      const behind = clock - x;
      if (behind > 8) rate *= 1 + Math.min(3, behind / 15);
      if (finisher && sec < finishBy) {
        const need = (n - x) / Math.max(1, finishBy - sec);
        if (need > rate) rate = need * 1.1;
      }
      x = Math.min(n, x + rate, clock * 2.2 + 6);
      // Placing an order takes a moment.
      const whole = Math.floor(x);
      for (let c = crossed + 1; c <= whole; c++) {
        if (acts.has(c)) {
          pause = Math.max(pause, r.range(2, 8));
          x = Math.min(x, c + 0.999);
          break;
        }
      }
      crossed = Math.max(crossed, Math.floor(x));
      if (pause <= 0) {
        const pauseRate = p.pace === 'stepper' ? 1 / 12 : 1 / 22;
        if (r.chance(pauseRate)) pause = r.exp(4);
        else if (r.chance(1 / 260)) pause = r.range(12, 45); // looked away
      }
    }
    out[sec] = Math.min(n, Math.floor(x));
  }
  return out;
}

/** Revealed candles at battle time `elapsedMs`. */
export function candlesAt(schedule: Uint16Array, elapsedMs: number): number {
  const i = Math.max(0, Math.min(schedule.length - 1, Math.floor(elapsedMs / 1000)));
  return schedule[i]!;
}

/** Battle time (ms) at which the trader first sees candle index `candle` revealed. */
export function elapsedForCandle(schedule: Uint16Array, candle: number): number | null {
  let lo = 0;
  let hi = schedule.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (schedule[mid]! < candle) lo = mid + 1;
    else hi = mid;
  }
  return lo < schedule.length ? lo * 1000 : null;
}
