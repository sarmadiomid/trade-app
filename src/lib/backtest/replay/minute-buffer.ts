import { firstGreaterOrEqual, type Candle } from '@/lib/core';

/** Loads 1-minute bars with `from <= time < to`, ascending. */
export type MinuteLoader = (from: number, to: number) => Promise<Candle[]>;

const MIN_CAPACITY = 4096;

/**
 * A contiguous window of 1-minute bars [from, to) around the replay cursor. Loading is async
 * (any provider), reading is synchronous so stepping never awaits while the window covers it.
 * Appends are amortised O(1) and trimming moves an offset (compacting occasionally), so a
 * window extended on every replay step never copies itself.
 */
export class MinuteBuffer {
  private bars: Candle[] = [];
  private times = new Float64Array(MIN_CAPACITY);
  /** Index of the first live bar in `bars` / `times`. */
  private head = 0;
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
      const live = this.to > this.from;
      if (live && from >= this.from && from <= this.to) {
        const more = await this.load(this.to, to);
        this.append(more, Math.max(this.to, to));
      } else if (live && to <= this.to && to >= this.from) {
        const older = await this.load(from, this.from);
        this.reset([...older, ...this.bars.slice(this.head)], from, this.to);
      } else {
        this.reset(await this.load(from, to), from, to);
      }
    };
    this.pending = run().finally(() => (this.pending = null));
    await this.pending;
  }

  /** Bars with `from <= time < to` (must be covered). */
  slice(from: number, to: number): Candle[] {
    const n = this.bars.length;
    const i = Math.max(this.head, firstGreaterOrEqual(this.times, n, from));
    const j = Math.max(i, firstGreaterOrEqual(this.times, n, to));
    return this.bars.slice(i, j);
  }

  /** The last bar before `time`, if buffered. */
  lastBefore(time: number): Candle | null {
    const i = firstGreaterOrEqual(this.times, this.bars.length, time) - 1;
    return i >= this.head ? this.bars[i]! : null;
  }

  /** Drops bars before `time` to bound memory. */
  trimBefore(time: number): void {
    if (time <= this.from) return;
    this.head = Math.max(this.head, firstGreaterOrEqual(this.times, this.bars.length, time));
    this.from = time;
    if (this.head > MIN_CAPACITY && this.head > this.bars.length / 2)
      this.reset(this.bars.slice(this.head), this.from, this.to);
  }

  private append(more: readonly Candle[], to: number): void {
    const n = this.bars.length;
    if (n + more.length > this.times.length) {
      const next = new Float64Array(Math.max(MIN_CAPACITY, (n + more.length) * 2));
      next.set(this.times.subarray(0, n));
      this.times = next;
    }
    for (let k = 0; k < more.length; k++) {
      this.bars.push(more[k]!);
      this.times[n + k] = more[k]!.time;
    }
    this.to = to;
  }

  private reset(bars: Candle[], from: number, to: number): void {
    this.bars = [];
    this.times = new Float64Array(Math.max(MIN_CAPACITY, bars.length * 2));
    this.head = 0;
    this.from = from;
    this.append(bars, to);
  }
}
