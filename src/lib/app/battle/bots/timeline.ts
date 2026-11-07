import type { Candle } from '@/lib/core';
import {
  ExecutionEngine,
  equity,
  type AccountConfig,
  type AccountState,
  type LoggedAction,
} from '@/lib/backtest';

/** A trader's standing at one replay cursor (what the leaderboard shows). */
export interface TimelinePoint {
  readonly status: 'active' | 'target' | 'disqualified' | 'left';
  readonly balance: number;
  readonly equity: number;
  readonly openPositions: number;
  readonly trades: number;
  readonly wins: number;
  readonly targetAt: number | null;
  readonly reason: string | null;
}

/**
 * Every standing a bot will have during the battle, computed in one pass over its (fixed)
 * action log. It mirrors `resimulate` step by step: snapshot 2i+1 is the account at cursor
 * `bars[i].time` (bars before it processed, actions at it applied), snapshot 2i+2 the account
 * just after bar i. A lookup is a binary search, so a bot's live standing costs nothing.
 */
export class Timeline {
  private readonly times: Float64Array;
  private readonly bal: Float64Array;
  private readonly eq: Float64Array;
  private readonly open: Uint16Array;
  private readonly trades: Uint16Array;
  private readonly wins: Uint16Array;
  private failK = Infinity;
  private failReason: string | null = null;
  private targetK = Infinity;
  private targetAt: number | null = null;
  private leftPoint: TimelinePoint | null = null;
  private readonly startT: number;

  constructor(
    cfg: AccountConfig,
    initial: AccountState,
    actions: readonly LoggedAction[],
    bars: readonly Candle[],
    readonly end: number,
    readonly leaveT: number | null,
    private readonly profitTarget: boolean,
  ) {
    this.startT = initial.time;
    const n = bars.length;
    const size = 2 * n + 1;
    this.times = new Float64Array(n);
    this.bal = new Float64Array(size);
    this.eq = new Float64Array(size);
    this.open = new Uint16Array(size);
    this.trades = new Uint16Array(size);
    this.wins = new Uint16Array(size);
    for (let i = 0; i < n; i++) this.times[i] = bars[i]!.time;

    const engine = new ExecutionEngine(cfg, structuredClone(initial));
    const s = engine.state;
    let a = 0;
    let wins = 0;
    let counted = 0;
    const snap = (k: number) => {
      for (; counted < s.trades.length; counted++) if (s.trades[counted]!.netPnl > 0) wins++;
      this.bal[k] = s.balance;
      this.eq[k] = s.status === 'active' ? equity(cfg, s) : s.balance;
      this.open[k] = s.positions.length;
      this.trades[k] = s.trades.length;
      this.wins[k] = wins;
      if (s.status !== 'active' && s.status !== 'ended' && this.failK === Infinity) {
        this.failK = k;
        this.failReason = s.failReason ?? 'Stopped out';
      }
      if (s.targetReachedAt !== null && this.targetK === Infinity) {
        this.targetK = k;
        this.targetAt = s.targetReachedAt;
      }
    };
    const applyUpTo = (t: number) => {
      while (a < actions.length && actions[a]!.t <= t) {
        s.time = Math.max(s.time, actions[a]!.t);
        engine.apply(actions[a]!.a);
        a += 1;
      }
    };
    snap(0);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const bar = bars[i]!;
      if (bar.time >= end) break;
      if (leaveT !== null && bar.time >= leaveT) {
        // The trader leaves at this cursor: whatever is open is closed at the last price.
        s.time = Math.max(s.time, leaveT);
        applyUpTo(leaveT);
        snap(2 * i + 1);
        engine.endSession();
        this.leftPoint = this.point(false, true, s, wins + newWins(s, counted));
        k = 2 * i + 1;
        break;
      }
      applyUpTo(bar.time);
      snap(2 * i + 1);
      engine.processBar(bar);
      snap(2 * i + 2);
      k = 2 * i + 2;
      if (s.status !== 'active') break;
    }
    for (let j = k + 1; j < size; j++) {
      this.bal[j] = this.bal[k]!;
      this.eq[j] = this.eq[k]!;
      this.open[j] = this.open[k]!;
      this.trades[j] = this.trades[k]!;
      this.wins[j] = this.wins[k]!;
    }
  }

  private point(failed: boolean, left: boolean, s: AccountState, wins: number): TimelinePoint {
    return {
      status: failed ? 'disqualified' : left ? 'left' : 'active',
      balance: round2(s.balance),
      equity: round2(s.balance),
      openPositions: 0,
      trades: s.trades.length,
      wins,
      targetAt: this.profitTarget ? s.targetReachedAt : null,
      reason: failed ? (s.failReason ?? 'Stopped out') : left ? 'Left the battle' : null,
    };
  }

  /** The standing at replay cursor `cursor` (market time). */
  at(cursor: number): TimelinePoint {
    const c = Math.min(cursor, this.end);
    if (this.leftPoint && this.leaveT !== null && c >= this.leaveT) return this.leftPoint;
    const t = this.times;
    // Like the server's simulation: at (or before) the account's start nothing is applied yet.
    if (c <= this.startT) return this.pointAt(0);
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (t[mid]! < c) lo = mid + 1;
      else hi = mid;
    }
    return this.pointAt(lo < t.length && t[lo] === c ? 2 * lo + 1 : lo === 0 ? 0 : 2 * lo);
  }

  private pointAt(k: number): TimelinePoint {
    const failed = k >= this.failK;
    const target = !failed && this.profitTarget && k >= this.targetK;
    return {
      status: failed ? 'disqualified' : target ? 'target' : 'active',
      balance: round2(this.bal[k]!),
      equity: round2(this.eq[k]!),
      openPositions: this.open[k]!,
      trades: this.trades[k]!,
      wins: this.wins[k]!,
      targetAt: this.profitTarget && k >= this.targetK ? this.targetAt : null,
      reason: failed ? this.failReason : null,
    };
  }

  /** Approximate heap footprint (bytes), for cache accounting. */
  get bytes(): number {
    return this.times.byteLength + this.bal.byteLength * 2 + this.open.byteLength * 3 + 256;
  }
}

function newWins(s: AccountState, counted: number): number {
  let w = 0;
  for (let i = counted; i < s.trades.length; i++) if (s.trades[i]!.netPnl > 0) w++;
  return w;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
