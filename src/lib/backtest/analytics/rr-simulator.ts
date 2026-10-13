import type { Candle } from '@/lib/core';
import { EPS, dir } from '../execution/math';
import type { Trade } from '../execution/types';

/** Targets the RR simulator evaluates: 0.5R … 10R. */
export const RR_TARGETS: readonly number[] = Array.from({ length: 20 }, (_, i) => (i + 1) / 2);

/** What happened after a trade's entry with its original stop and no target, in R. */
export interface Excursion {
  readonly tradeId: string;
  /** Each time a new best excursion was reached: [mfeR, maeR so far]. */
  readonly checkpoints: ReadonlyArray<readonly [number, number]>;
  /** True if the original stop was hit before the data ran out. */
  readonly stopped: boolean;
  /** R at the last price seen when the data ran out without a stop. */
  readonly endR: number;
}

/**
 * Follows one trade's original stop over 1-minute bars from its entry (same intrabar path as
 * the execution engine) and records how far it went in favour before the stop. Feed bars with
 * `push` until it returns true (resolved) or the data ends.
 */
export class ExcursionScanner {
  private checkpoints: Array<[number, number]> = [];
  private mfe = 0;
  private mae = 0;
  private last = 0;
  private stopped = false;
  private readonly risk: number;
  private readonly d: number;

  constructor(
    private readonly trade: Trade,
    private readonly spread: number,
    private readonly maxTarget = RR_TARGETS[RR_TARGETS.length - 1]!,
  ) {
    this.risk = trade.initialSl === null ? 0 : Math.abs(trade.entryPrice - trade.initialSl);
    this.d = dir(trade.side);
  }

  get valid(): boolean {
    return this.risk > EPS;
  }

  /** Feeds the next 1-minute bar; returns true once the outcome is known for every target. */
  push(bar: Candle): boolean {
    if (!this.valid || this.done) return true;
    if (bar.time + 60_000 <= this.trade.entryTime) return false;
    const path =
      bar.close >= bar.open
        ? [bar.open, bar.low, bar.high, bar.close]
        : [bar.open, bar.high, bar.low, bar.close];
    for (const bid of path) {
      const px = this.trade.side === 'buy' ? bid : bid + this.spread;
      const r = (this.d * (px - this.trade.entryPrice)) / this.risk;
      this.last = r;
      if (-r > this.mae) this.mae = Math.min(1, -r);
      if (r <= -1 + EPS) {
        this.stopped = true;
        return true;
      }
      if (r > this.mfe + EPS) {
        this.mfe = r;
        this.checkpoints.push([r, this.mae]);
        if (r >= this.maxTarget) return true;
      }
    }
    return false;
  }

  private get done(): boolean {
    return this.stopped || this.mfe >= this.maxTarget;
  }

  result(): Excursion {
    return {
      tradeId: this.trade.id,
      checkpoints: this.checkpoints,
      stopped: this.stopped,
      endR: this.last,
    };
  }
}

export interface RRSimRow {
  readonly target: number;
  readonly trades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly totalR: number;
  readonly expectancyR: number;
  readonly profitFactor: number | null;
  /** Average adverse move (R) of the winners before reaching the target. */
  readonly avgDrawdownR: number;
}

/** Outcome of one trade with a take profit at `target` R. */
export function outcomeAt(e: Excursion, target: number): { r: number; mae: number | null } {
  const hit = e.checkpoints.find(([mfe]) => mfe >= target - EPS);
  if (hit) return { r: target, mae: hit[1] };
  return { r: e.stopped ? -1 : e.endR, mae: null };
}

export function simulateRR(excursions: readonly Excursion[], targets = RR_TARGETS): RRSimRow[] {
  return targets.map((target) => {
    let wins = 0;
    let losses = 0;
    let total = 0;
    let gp = 0;
    let gl = 0;
    let dd = 0;
    for (const e of excursions) {
      const o = outcomeAt(e, target);
      total += o.r;
      if (o.r > EPS) {
        wins += 1;
        gp += o.r;
        dd += o.mae ?? 0;
      } else if (o.r < -EPS) {
        losses += 1;
        gl -= o.r;
      }
    }
    const n = excursions.length;
    return {
      target,
      trades: n,
      wins,
      losses,
      winRate: n ? wins / n : 0,
      totalR: total,
      expectancyR: n ? total / n : 0,
      profitFactor: gl > EPS ? gp / gl : null,
      avgDrawdownR: wins ? dd / wins : 0,
    };
  });
}

/** The target with the highest total R (the lowest one on ties): FX Replay's "Ideal RR". */
export function idealRR(rows: readonly RRSimRow[]): RRSimRow | null {
  let best: RRSimRow | null = null;
  for (const r of rows) if (r.trades > 0 && (!best || r.totalR > best.totalR + EPS)) best = r;
  return best;
}
