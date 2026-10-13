import { firstGreaterOrEqual, type Candle } from '@/lib/core';

/** Loads 1-minute bars with `from <= time < to`, ascending. */
export type MinuteLoader = (from: number, to: number) => Promise<Candle[]>;

/**
 * A contiguous window of 1-minute bars [from, to) around the replay cursor. Loading is async
 * (any provider), reading is synchronous so stepping never awaits while the window covers it.
 */
export class MinuteBuffer {
  private bars: Candle[] = [];
  private times = new Float64Array(0);
  private from = 0;
  private to = 0;
  private pending: Promise<void> | null = null;

  constructor(private readonly load: MinuteLoader) {}

  get start(): number {
    return this.from;
  }

  get end(): number {
    return this.to;
  }

  covers(from: number, to: number): boolean {
    return from >= this.from && to <= this.to && this.to > this.from;
  }

  /** Makes the window cover [from, to) (extends it, or reloads when disjoint). */
  async ensure(from: number, to: number): Promise<void> {
    while (this.pending) await this.pending;
    if (this.covers(from, to)) return;
    const run = async () => {
      if (this.to > this.from && from >= this.from && from <= this.to) {
        const more = await this.load(this.to, to);
        this.set([...this.bars, ...more], this.from, Math.max(this.to, to));
      } else if (this.to > this.from && to <= this.to && to >= this.from) {
        const older = await this.load(from, this.from);
        this.set([...older, ...this.bars], from, this.to);
      } else {
        this.set(await this.load(from, to), from, to);
      }
    };
    this.pending = run().finally(() => (this.pending = null));
    await this.pending;
  }

  /** Bars with `from <= time < to` (must be covered). */
  slice(from: number, to: number): Candle[] {
    const i = firstGreaterOrEqual(this.times, this.bars.length, from);
    const j = firstGreaterOrEqual(this.times, this.bars.length, to);
    return this.bars.slice(i, j);
  }

  /** Close of the last bar before `time`, if buffered. */
  lastBefore(time: number): Candle | null {
    const i = firstGreaterOrEqual(this.times, this.bars.length, time) - 1;
    return i >= 0 ? this.bars[i]! : null;
  }

  /** Drops bars before `time` to bound memory. */
  trimBefore(time: number): void {
    if (time <= this.from) return;
    const i = firstGreaterOrEqual(this.times, this.bars.length, time);
    if (i > 0) this.set(this.bars.slice(i), time, this.to);
  }

  private set(bars: Candle[], from: number, to: number): void {
    this.bars = bars;
    this.times = Float64Array.from(bars, (b) => b.time);
    this.from = from;
    this.to = to;
  }
}
