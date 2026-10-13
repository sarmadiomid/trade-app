import { describe, expect, it } from 'vitest';
import type { Candle } from '@/lib/core';
import {
  ExcursionScanner,
  byDay,
  byHour,
  bySession,
  byWeekday,
  computeStats,
  drawdownOf,
  equityCurve,
  histogram,
  idealRR,
  periodAverages,
  simulateRR,
  type AccountConfig,
  type Trade,
} from '@/lib/backtest';

const cfg: AccountConfig = {
  contractSize: 100,
  tickSize: 0.01,
  pipSize: 0.1,
  lotMin: 0.01,
  lotStep: 0.01,
  lotMax: 100,
  spread: 0,
  commissionPerLot: 0,
  startingBalance: 10_000,
  propRules: null,
};

const H = 3_600_000;
// Monday 2024-01-08 00:00 UTC
const MON = Date.UTC(2024, 0, 8);

let seq = 0;
function trade(p: {
  side?: 'buy' | 'sell';
  entry?: number;
  exit: number;
  sl?: number | null;
  tp?: number | null;
  at: number;
  hours?: number;
  volume?: number;
  worst?: number;
  best?: number;
}): Trade {
  const side = p.side ?? 'buy';
  const entry = p.entry ?? 2000;
  const volume = p.volume ?? 1;
  const d = side === 'buy' ? 1 : -1;
  const gross = Math.round(d * (p.exit - entry) * volume * 100 * 100) / 100;
  const sl = p.sl === undefined ? entry - d * 10 : p.sl;
  return {
    id: `t${++seq}`,
    side,
    entryKind: 'market',
    entryPrice: entry,
    entryTime: p.at,
    initialVolume: volume,
    volume: 0,
    sl,
    tp: p.tp ?? null,
    initialSl: sl,
    initialTp: p.tp ?? null,
    autoBE: null,
    breakEven: false,
    commission: 0,
    exits: [],
    worstPrice: p.worst ?? Math.min(entry, p.exit),
    bestPrice: p.best ?? Math.max(entry, p.exit),
    closeTime: p.at + (p.hours ?? 1) * H,
    closePrice: p.exit,
    grossPnl: gross,
    netPnl: gross,
    closeReason: 'manual',
  };
}

describe('computeStats', () => {
  // +2000 (2R), −1000 (−1R), −1000, +1500 (1.5R), 0 (breakeven), short +500
  const trades = [
    trade({ exit: 2020, tp: 2020, at: MON + 8 * H }),
    trade({ exit: 1990, tp: 2030, at: MON + 9 * H }),
    trade({ exit: 1990, at: MON + 24 * H + 14 * H }),
    trade({ exit: 2015, tp: 2015, at: MON + 48 * H + 13 * H, hours: 3 }),
    trade({ exit: 2000, at: MON + 72 * H + 2 * H }),
    trade({ side: 'sell', exit: 1995, sl: 2010, at: MON + 96 * H + 10 * H }),
  ];
  const s = computeStats(cfg, trades);

  it('counts outcomes and sides', () => {
    expect(s).toMatchObject({
      totalTrades: 6,
      winners: 3,
      losers: 2,
      breakeven: 1,
      longs: 5,
      shorts: 1,
    });
    expect(s.winRate).toBeCloseTo(0.5);
    expect(s.longWinRate).toBeCloseTo(2 / 5);
    expect(s.shortWinRate).toBe(1);
  });

  it('computes money metrics', () => {
    expect(s.netPnl).toBe(2000);
    expect(s.returnPct).toBeCloseTo(20);
    expect(s.grossProfit).toBe(4000);
    expect(s.grossLoss).toBe(2000);
    expect(s.profitFactor).toBeCloseTo(2);
    expect(s.avgWin).toBeCloseTo(4000 / 3);
    expect(s.avgLoss).toBe(-1000);
    expect(s.bestWin).toBe(2000);
    expect(s.bestWinPct).toBeCloseTo(20); // 2000 on a 10,000 balance
    expect(s.worstLoss).toBe(-1000);
    // Both losses are −1000; the first one came off a 12,000 balance.
    expect(s.worstLossPct).toBeCloseTo((-1000 / 12_000) * 100);
    // expectancy = 0.5 × 1333.33 − (2/6) × 1000
    expect(s.expectancy).toBeCloseTo(0.5 * (4000 / 3) - (2 / 6) * 1000);
  });

  it('computes R metrics', () => {
    // Planned RR over trades with SL and TP: 2, 3, 1.5
    expect(s.avgRR).toBeCloseTo((2 + 3 + 1.5) / 3);
    expect(s.maxRR).toBe(3);
    // Realized R: 2, −1, −1, 1.5, 0, 0.5 (short risked 1000, made 500)
    expect(s.totalR).toBeCloseTo(2);
    expect(s.avgR).toBeCloseTo(2 / 6);
  });

  it('computes drawdown, streaks and durations', () => {
    // Balance: 10000 → 12000 → 11000 → 10000 → 11500 → 11500 → 12000
    expect(s.drawdown.max).toBe(2000);
    expect(s.drawdown.maxPct).toBeCloseTo((2000 / 12000) * 100);
    expect(s.maxConsecutiveLosses).toBe(2);
    expect(s.maxConsecutiveWins).toBe(1);
    expect(s.avgDuration).toBeCloseTo(((1 + 1 + 1 + 3 + 1 + 1) / 6) * H);
    expect(s.recoveryFactor).toBeCloseTo(1);
  });

  it('measures how far winners went against the trade (drawdown in R)', () => {
    const w = [
      trade({ exit: 2020, worst: 1997, at: MON }),
      trade({ exit: 2020, worst: 1999, at: MON + H }),
      trade({ exit: 2020, worst: 2000, at: MON + 2 * H }),
    ];
    const r = computeStats(cfg, w).winnerDrawdownR!;
    expect(r.max).toBeCloseTo(0.3);
    expect(r.min).toBeCloseTo(0);
    expect(r.avg).toBeCloseTo(0.4 / 3);
  });

  it('handles no trades and no losses', () => {
    const e = computeStats(cfg, []);
    expect(e).toMatchObject({ totalTrades: 0, winRate: 0, profitFactor: null, avgR: null });
    expect(computeStats(cfg, [trade({ exit: 2010, at: MON })]).profitFactor).toBeNull();
  });
});

describe('breakdowns', () => {
  const trades = [
    trade({ exit: 2010, at: MON + 8 * H }), // Mon 08:00, London
    trade({ exit: 1990, at: MON + 24 * H + 14 * H }), // Tue 14:00, New York
    trade({ exit: 2005, at: MON + 24 * H + 3 * H }), // Tue 03:00, Asia
  ];

  it('groups by weekday, hour and trading session of the entry', () => {
    const wd = byWeekday(cfg, trades);
    expect(wd.map((b) => b.trades)).toEqual([1, 2, 0, 0, 0]);
    expect(wd[1]!.pnl).toBe(-500);
    expect(byHour(cfg, trades)[14]!.losses).toBe(1);
    expect(bySession(cfg, trades).map((b) => b.trades)).toEqual([1, 1, 1, 0]);
  });

  it('builds the P&L calendar and period averages from close times', () => {
    const days = byDay(cfg, trades);
    expect(days.get(MON)!.pnl).toBe(1000);
    expect(days.get(MON + 24 * H)!.pnl).toBe(-500);
    const avg = periodAverages(cfg, trades, 'day');
    expect(avg).toMatchObject({
      periods: 2,
      avgGain: 1000,
      avgLoss: -500,
      best: 1000,
      worst: -500,
    });
    expect(periodAverages(cfg, trades, 'week').periods).toBe(1);
  });

  it('builds the equity curve with drawdown', () => {
    const curve = equityCurve(cfg, trades, MON);
    expect(curve.map((p) => p.balance)).toEqual([10_000, 11_000, 11_500, 10_500]);
    expect(curve.at(-1)!.drawdown).toBe(-1000);
    expect(drawdownOf([100, 90, 120, 100, 130])).toMatchObject({
      max: 20,
      episodes: 2,
      average: 15,
    });
  });

  it('bins values into a histogram', () => {
    const h = histogram([1, 2, 3, 4, 10], 3);
    expect(h.map((b) => b.count)).toEqual([3, 1, 1]);
  });
});

describe('RR simulator', () => {
  const M = 60_000;
  const bars = (prices: number[][]): Candle[] =>
    prices.map(([o, h, l, c], i) => ({
      time: MON + i * M,
      open: o!,
      high: h!,
      low: l!,
      close: c!,
      volume: 1,
    }));

  it('replays the original stop and finds the best target', () => {
    // Long at 2000, SL 1990 (risk 10). Trade A runs to +2.5R then stops; B runs +1.2R then stops;
    // C stops immediately.
    const a = trade({ exit: 2020, at: MON });
    const b = trade({ exit: 2012, at: MON });
    const c = trade({ exit: 1990, at: MON });
    const scan = (t: Trade, path: number[][]) => {
      const s = new ExcursionScanner(t, 0);
      for (const bar of bars(path)) if (s.push(bar)) break;
      return s.result();
    };
    const ex = [
      scan(a, [
        [2000, 2025, 1997, 2024],
        [2024, 2024, 1985, 1986],
      ]),
      scan(b, [
        [2000, 2012, 1998, 2010],
        [2010, 2010, 1989, 1990],
      ]),
      scan(c, [[2000, 2001, 1989, 1990]]),
    ];
    expect(ex.map((e) => e.stopped)).toEqual([true, true, true]);
    const rows = simulateRR(ex, [1, 2, 3]);
    // 1R: +1 +1 −1 = 1; 2R: +2 −1 −1 = 0; 3R: −3
    expect(rows.map((r) => r.totalR)).toEqual([1, 0, -3]);
    expect(rows[0]!.winRate).toBeCloseTo(2 / 3);
    expect(rows[0]!.profitFactor).toBeCloseTo(2);
    expect(rows[1]!.avgDrawdownR).toBeCloseTo(0.3);
    expect(idealRR(rows)!.target).toBe(1);
  });

  it('marks trades still open when the data ends with their last R', () => {
    const t = trade({ exit: 2005, at: MON });
    const s = new ExcursionScanner(t, 0);
    for (const bar of bars([[2000, 2006, 1999, 2005]])) s.push(bar);
    const r = s.result();
    expect(r.stopped).toBe(false);
    expect(r.endR).toBeCloseTo(0.5);
    expect(simulateRR([r], [1])[0]!.totalR).toBeCloseTo(0.5);
  });
});
