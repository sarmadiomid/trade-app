import type { Candle } from '@/lib/core';

const MINUTE_MS = 60_000;

/** Wilder-style running average with a warm-up. */
class Running {
  value: number | null = null;
  private n = 0;
  constructor(private readonly period: number) {}
  push(v: number): void {
    this.n += 1;
    if (this.value === null) this.value = v;
    else if (this.n <= this.period) this.value += (v - this.value) / this.n;
    else this.value += (v - this.value) / this.period;
  }
  get ready(): boolean {
    return this.n >= this.period;
  }
}

class Ema {
  value: number | null = null;
  private n = 0;
  private readonly k: number;
  constructor(private readonly period: number) {
    this.k = 2 / (period + 1);
  }
  push(v: number): void {
    this.n += 1;
    this.value = this.value === null ? v : this.value + this.k * (v - this.value);
  }
  get ready(): boolean {
    return this.n >= this.period;
  }
}

/** One closed bar of the trader's chart timeframe and the indicators as of its close. */
export interface ChartView {
  readonly close: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly emaFast: number;
  readonly emaSlow: number;
  /** EMA fast/slow of the previous closed bar (for crosses). */
  readonly prevFast: number;
  readonly prevSlow: number;
  readonly atr: number;
  readonly rsi: number;
  /** Highest high / lowest low of the 20 closed bars before this one. */
  readonly donHigh: number;
  readonly donLow: number;
}

/**
 * Indicators a trader reads off their chart, fed one revealed 1-minute bar at a time (never a
 * bar the trader hasn't seen). The chart timeframe's bars are built from the minutes; a bar
 * only counts once it has closed, like a trader waiting for the candle close.
 */
export class Indicators {
  /** Last revealed 1-minute bar and the 1-minute ATR. */
  last: Candle | null = null;
  readonly atr1 = new Running(14);
  /** Set when the chart bar just closed with the last minute pushed. */
  closedNow = false;
  view: ChartView | null = null;

  private readonly tfMs: number;
  private bucket = -1;
  private cur: { open: number; high: number; low: number; close: number } | null = null;
  private readonly fast = new Ema(9);
  private readonly slow = new Ema(21);
  private readonly atr = new Running(14);
  private readonly gain = new Running(14);
  private readonly loss = new Running(14);
  private prevClose: number | null = null;
  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  private bars = 0;

  constructor(tfMin: number) {
    this.tfMs = tfMin * MINUTE_MS;
  }

  push(bar: Candle): void {
    const prev1 = this.last;
    this.atr1.push(
      prev1 ? Math.max(bar.high, prev1.close) - Math.min(bar.low, prev1.close) : bar.high - bar.low,
    );
    this.last = bar;
    this.closedNow = false;
    const b = Math.floor(bar.time / this.tfMs);
    if (b !== this.bucket && this.cur) this.closeBar();
    if (b !== this.bucket) {
      this.bucket = b;
      this.cur = { open: bar.open, high: bar.high, low: bar.low, close: bar.close };
    } else if (this.cur) {
      this.cur.high = Math.max(this.cur.high, bar.high);
      this.cur.low = Math.min(this.cur.low, bar.low);
      this.cur.close = bar.close;
    }
    // The chart bar closes with its last minute (the next minute starts a new bucket).
    if (Math.floor((bar.time + MINUTE_MS) / this.tfMs) !== b) {
      this.closeBar();
      this.bucket = b;
    }
  }

  private closeBar(): void {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    const pf = this.fast.value ?? c.close;
    const ps = this.slow.value ?? c.close;
    const tr =
      this.prevClose === null
        ? c.high - c.low
        : Math.max(c.high, this.prevClose) - Math.min(c.low, this.prevClose);
    this.atr.push(tr);
    if (this.prevClose !== null) {
      const d = c.close - this.prevClose;
      this.gain.push(Math.max(0, d));
      this.loss.push(Math.max(0, -d));
    }
    this.fast.push(c.close);
    this.slow.push(c.close);
    const donHigh = this.highs.length ? Math.max(...this.highs) : c.high;
    const donLow = this.lows.length ? Math.min(...this.lows) : c.low;
    this.highs.push(c.high);
    this.lows.push(c.low);
    if (this.highs.length > 20) {
      this.highs.shift();
      this.lows.shift();
    }
    this.prevClose = c.close;
    this.bars += 1;
    const g = this.gain.value ?? 0;
    const l = this.loss.value ?? 0;
    const rsi = g + l <= 0 ? 50 : (100 * g) / (g + l);
    if (this.bars >= 22 && this.atr.ready) {
      this.view = {
        ...c,
        emaFast: this.fast.value!,
        emaSlow: this.slow.value!,
        prevFast: pf,
        prevSlow: ps,
        atr: this.atr.value!,
        rsi,
        donHigh,
        donLow,
      };
      this.closedNow = true;
    }
  }

  get ready(): boolean {
    return this.view !== null && this.atr1.ready;
  }
}
