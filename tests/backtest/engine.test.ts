import { describe, expect, it } from 'vitest';
import type { Candle } from '@/lib/core';
import {
  ExecutionEngine,
  equity,
  excursionR,
  lotsForRisk,
  normalizeLots,
  plannedRR,
  rMultiple,
  type AccountConfig,
} from '@/lib/backtest';

const T0 = Date.UTC(2024, 0, 2, 10, 0);
const MIN = 60_000;

function cfg(over: Partial<AccountConfig> = {}): AccountConfig {
  return {
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
    ...over,
  };
}

const bar = (i: number, open: number, high: number, low: number, close: number): Candle => ({
  time: T0 + i * MIN,
  open,
  high,
  low,
  close,
  volume: 1,
});

function engine(over: Partial<AccountConfig> = {}, bid = 2000) {
  const c = cfg(over);
  return new ExecutionEngine(c, ExecutionEngine.initialState(c, T0, bid));
}

describe('market orders and P&L', () => {
  it('fills buys at the Ask and sells at the Bid; floating P&L uses the exit side', () => {
    const e = engine({ spread: 0.2 });
    expect(
      e.apply({ type: 'market', id: 'a', side: 'buy', volume: 1, sl: null, tp: null }).ok,
    ).toBe(true);
    expect(
      e.apply({ type: 'market', id: 'b', side: 'sell', volume: 0.5, sl: null, tp: null }).ok,
    ).toBe(true);
    const [buy, sell] = e.state.positions;
    expect(buy!.entryPrice).toBe(2000.2);
    expect(sell!.entryPrice).toBe(2000);
    // At bid 2000: long loses the spread (0.2 × 100 oz), short loses its spread too.
    expect(e.equity).toBe(10_000 - 20 - 10);
    e.processBar(bar(0, 2000, 2010, 1999, 2010));
    // Long: (2010 − 2000.2) × 100 = 980. Short: (2000 − 2010.2) × 50 = −510.
    expect(equity(e.cfg, e.state)).toBe(10_000 + 980 - 510);
    expect(e.state.balance).toBe(10_000);
  });

  it('closes manually and in parts; the trade aggregates every exit', () => {
    const e = engine({ commissionPerLot: 3.5 });
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: 1990, tp: null });
    expect(e.state.balance).toBe(10_000 - 3.5);
    e.processBar(bar(0, 2000, 2005, 1999, 2004));
    expect(e.apply({ type: 'close', id: 'p', volume: 0.4 }).ok).toBe(true);
    expect(e.state.positions[0]!.volume).toBe(0.6);
    expect(e.state.balance).toBeCloseTo(10_000 - 3.5 + 160 - 1.4, 6);
    e.processBar(bar(1, 2004, 2010, 2003, 2010));
    e.apply({ type: 'close', id: 'p' });
    expect(e.state.positions).toHaveLength(0);
    const t = e.state.trades[0]!;
    expect(t.exits.map((x) => x.reason)).toEqual(['partial', 'manual']);
    expect(t.grossPnl).toBe(160 + 600);
    expect(t.commission).toBeCloseTo(3.5 + 1.4 + 2.1, 6);
    expect(t.netPnl).toBeCloseTo(760 - 7, 6);
    expect(t.closePrice).toBeCloseTo((2004 * 0.4 + 2010 * 0.6) / 1, 6);
    expect(e.state.balance).toBeCloseTo(10_000 + t.netPnl, 6);
    expect(rMultiple(e.cfg, t)).toBeCloseTo(753 / 1000, 6);
  });

  it('rejects invalid orders with a message', () => {
    const e = engine({ spread: 0.2 });
    const bad = [
      e.apply({ type: 'market', id: 'x', side: 'buy', volume: 0.001, sl: null, tp: null }),
      e.apply({ type: 'market', id: 'x', side: 'buy', volume: 1, sl: 2001, tp: null }),
      e.apply({ type: 'market', id: 'x', side: 'sell', volume: 1, sl: null, tp: 2001 }),
      e.apply({
        type: 'pending',
        id: 'x',
        side: 'buy',
        kind: 'limit',
        price: 2001,
        volume: 1,
        sl: null,
        tp: null,
      }),
      e.apply({
        type: 'pending',
        id: 'x',
        side: 'sell',
        kind: 'stop',
        price: 2001,
        volume: 1,
        sl: null,
        tp: null,
      }),
      e.apply({
        type: 'pending',
        id: 'x',
        side: 'buy',
        kind: 'stop',
        price: 2010,
        volume: 1,
        sl: 2011,
        tp: null,
      }),
    ];
    for (const r of bad) expect(r.ok).toBe(false);
    expect(bad[3]).toMatchObject({ error: expect.stringContaining('پایین‌تر از Ask فعلی') });
    expect(e.state.positions).toHaveLength(0);
    expect(e.state.orders).toHaveLength(0);
  });
});

describe('pending orders', () => {
  it('fills a Buy Limit when the Ask touches it, at the limit price', () => {
    const e = engine({ spread: 0.2 });
    e.apply({
      type: 'pending',
      id: 'l',
      side: 'buy',
      kind: 'limit',
      price: 1995,
      volume: 1,
      sl: null,
      tp: null,
    });
    e.processBar(bar(0, 2000, 2001, 1995.1, 1996)); // Ask low = 1995.3: not filled
    expect(e.state.orders).toHaveLength(1);
    e.processBar(bar(1, 1996, 1997, 1994.8, 1995.5)); // Ask low = 1995.0
    expect(e.state.positions[0]).toMatchObject({
      entryPrice: 1995,
      entryKind: 'limit',
      entryTime: T0 + MIN,
    });
  });

  it('fills a limit at the better open on a gap, a stop at the worse open (slippage)', () => {
    const e = engine();
    e.apply({
      type: 'pending',
      id: 'l',
      side: 'buy',
      kind: 'limit',
      price: 1990,
      volume: 1,
      sl: null,
      tp: null,
    });
    e.apply({
      type: 'pending',
      id: 's',
      side: 'sell',
      kind: 'stop',
      price: 1995,
      volume: 1,
      sl: null,
      tp: null,
    });
    e.processBar(bar(0, 1985, 1986, 1984, 1985)); // gap down from 2000 to 1985
    const byId = Object.fromEntries(e.state.positions.map((p) => [p.id, p.entryPrice]));
    expect(byId).toEqual({ l: 1985, s: 1985 });
  });

  it('chains a limit fill and its take profit inside one minute (path O→L→H→C)', () => {
    const e = engine();
    e.apply({
      type: 'pending',
      id: 'l',
      side: 'buy',
      kind: 'limit',
      price: 1995,
      volume: 1,
      sl: 1990,
      tp: 2004,
    });
    e.processBar(bar(0, 2000, 2005, 1994, 2003)); // bullish: low first, then high
    expect(e.state.positions).toHaveLength(0);
    const t = e.state.trades[0]!;
    expect(t).toMatchObject({ entryPrice: 1995, closePrice: 2004, closeReason: 'tp', netPnl: 900 });
  });

  it('modifies and cancels pending orders', () => {
    const e = engine();
    e.apply({
      type: 'pending',
      id: 'l',
      side: 'buy',
      kind: 'limit',
      price: 1990,
      volume: 1,
      sl: null,
      tp: null,
    });
    expect(e.apply({ type: 'modify-order', id: 'l', price: 2001 }).ok).toBe(false);
    expect(e.apply({ type: 'modify-order', id: 'l', price: 1980, volume: 2, sl: 1970 }).ok).toBe(
      true,
    );
    expect(e.state.orders[0]).toMatchObject({ price: 1980, volume: 2, sl: 1970 });
    expect(e.apply({ type: 'cancel-order', id: 'l' }).ok).toBe(true);
    expect(e.state.orders).toHaveLength(0);
  });
});

describe('stop loss and take profit', () => {
  it('triggers a long SL on the Bid and a short SL on the Ask', () => {
    const e = engine({ spread: 0.5 });
    e.apply({ type: 'market', id: 'L', side: 'buy', volume: 1, sl: 1995, tp: null });
    e.apply({ type: 'market', id: 'S', side: 'sell', volume: 1, sl: 2004, tp: null });
    e.processBar(bar(0, 2000, 2003.6, 1999, 2003)); // Ask high 2004.1 ≥ 2004 → short SL
    expect(e.state.trades.map((t) => [t.id, t.closeReason, t.closePrice])).toEqual([
      ['S', 'sl', 2004],
    ]);
    e.processBar(bar(1, 2003, 2003, 1995, 1996)); // Bid low 1995 → long SL
    expect(e.state.trades.map((t) => t.id)).toEqual(['S', 'L']);
    expect(e.state.trades[1]!.netPnl).toBe((1995 - 2000.5) * 100);
  });

  it('decides SL vs TP inside one minute from the candle direction', () => {
    const bull = engine();
    bull.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: 1995, tp: 2005 });
    bull.processBar(bar(0, 2000, 2006, 1994, 2003)); // O→L→H: stop first
    expect(bull.state.trades[0]!.closeReason).toBe('sl');
    const bear = engine();
    bear.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: 1995, tp: 2005 });
    bear.processBar(bar(0, 2000, 2006, 1994, 1997)); // O→H→L: target first
    expect(bear.state.trades[0]!.closeReason).toBe('tp');
  });

  it('fills a stop loss at the open when the market gaps through it', () => {
    const e = engine();
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: 1995, tp: null });
    e.processBar(bar(0, 1990, 1992, 1989, 1991));
    expect(e.state.trades[0]).toMatchObject({ closePrice: 1990, closeReason: 'sl', netPnl: -1000 });
  });

  it('moves SL with auto break even, then exits flat; BE button needs price beyond entry', () => {
    const e = engine();
    e.apply({
      type: 'market',
      id: 'p',
      side: 'buy',
      volume: 1,
      sl: 1990,
      tp: null,
      autoBE: { mode: 'rr', value: 1 },
    });
    expect(e.apply({ type: 'break-even', id: 'p' }).ok).toBe(false);
    e.processBar(bar(0, 2000, 2010.5, 1999, 2008)); // +1R reached
    expect(e.state.positions[0]).toMatchObject({ sl: 2000, breakEven: true });
    e.processBar(bar(1, 2008, 2008, 1999, 1999.5));
    expect(e.state.trades[0]).toMatchObject({ closeReason: 'sl', closePrice: 2000, netPnl: 0 });

    const f = engine();
    f.apply({ type: 'market', id: 'q', side: 'sell', volume: 1, sl: 2010, tp: null });
    f.processBar(bar(0, 2000, 2001, 1990, 1992));
    expect(f.apply({ type: 'break-even', id: 'q' }).ok).toBe(true);
    expect(f.state.positions[0]!.sl).toBe(2000);
  });

  it('modifies SL/TP of an open position and validates the sides', () => {
    const e = engine();
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: null, tp: null });
    expect(e.apply({ type: 'modify-position', id: 'p', sl: 2001 }).ok).toBe(false);
    expect(e.apply({ type: 'modify-position', id: 'p', sl: 1990, tp: 2020 }).ok).toBe(true);
    expect(e.state.positions[0]).toMatchObject({ sl: 1990, tp: 2020, initialSl: null });
    expect(e.apply({ type: 'modify-position', id: 'p', tp: null }).ok).toBe(true);
    expect(e.state.positions[0]!.tp).toBeNull();
  });

  it('tracks MAE / MFE in R and the planned R:R', () => {
    const e = engine();
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: 1990, tp: 2020 });
    e.processBar(bar(0, 2000, 2002, 1996, 2001));
    e.processBar(bar(1, 2001, 2012, 2000, 2011));
    const p = e.state.positions[0]!;
    expect(excursionR(p)).toEqual({ mae: 0.4, mfe: 1.2 });
    expect(plannedRR(p)).toBe(2);
  });
});

describe('account floors', () => {
  it('stops out at zero equity at the exact price', () => {
    const e = engine({ startingBalance: 1000 });
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: null, tp: null });
    e.processBar(bar(0, 2000, 2001, 1980, 1985));
    expect(e.state.status).toBe('stopped-out');
    expect(e.state.trades[0]).toMatchObject({ closePrice: 1990, closeReason: 'stop-out' });
    expect(e.state.balance).toBe(0);
    expect(
      e.apply({ type: 'market', id: 'q', side: 'buy', volume: 1, sl: null, tp: null }).ok,
    ).toBe(false);
  });

  it('fails a prop session on the max daily loss, measured from the day start', () => {
    const e = engine({
      propRules: { profitTargetPct: 10, maxDailyLossPct: 5, maxTotalLossPct: 10 },
    });
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: null, tp: null });
    e.processBar(bar(0, 2000, 2001, 1996, 1997)); // −400, still fine
    expect(e.state.status).toBe('active');
    e.processBar(bar(1, 1997, 1998, 1990, 1991)); // −500 limit at 1995
    expect(e.state).toMatchObject({ status: 'failed', failReason: 'Max daily loss (5%)' });
    expect(e.state.trades[0]!.closePrice).toBe(1995);
  });

  it('marks the profit target as reached once flat above it', () => {
    const e = engine({
      propRules: { profitTargetPct: 5, maxDailyLossPct: 5, maxTotalLossPct: 10 },
    });
    e.apply({ type: 'market', id: 'p', side: 'buy', volume: 1, sl: null, tp: 2006 });
    const events = e.processBar(bar(0, 2000, 2007, 1999, 2006));
    expect(events.map((x) => x.type)).toContain('target-reached');
    expect(e.state.targetReachedAt).not.toBeNull();
  });

  it('closes everything at the session end', () => {
    const e = engine();
    e.apply({ type: 'market', id: 'p', side: 'sell', volume: 1, sl: null, tp: null });
    e.apply({
      type: 'pending',
      id: 'o',
      side: 'buy',
      kind: 'limit',
      price: 1900,
      volume: 1,
      sl: null,
      tp: null,
    });
    e.processBar(bar(0, 2000, 2000, 1990, 1990));
    e.endSession();
    expect(e.state).toMatchObject({ status: 'ended', orders: [], positions: [] });
    expect(e.state.trades[0]).toMatchObject({ closeReason: 'session-end', netPnl: 1000 });
  });
});

describe('sizing helpers', () => {
  it('normalises lots and sizes by risk', () => {
    const c = cfg();
    expect(normalizeLots(c, 0.129)).toBe(0.12);
    expect(normalizeLots(c, 0.005)).toBe(0);
    expect(normalizeLots(c, 500)).toBe(100);
    // Risk $100 with a $5 stop on 100 oz contracts → 0.2 lots.
    expect(lotsForRisk(c, 100, 5)).toBe(0.2);
  });

  it('is deterministic: replaying the same bars and actions gives the same state', () => {
    const run = () => {
      const e = engine({ spread: 0.3, commissionPerLot: 2 });
      e.apply({
        type: 'pending',
        id: 'a',
        side: 'sell',
        kind: 'limit',
        price: 2003,
        volume: 0.7,
        sl: 2010,
        tp: 1990,
      });
      for (let i = 0; i < 30; i++) {
        const o = 2000 + Math.sin(i) * 4;
        e.processBar(bar(i, o, o + 2, o - 2, o + Math.cos(i)));
      }
      return JSON.stringify(e.state);
    };
    expect(run()).toBe(run());
  });
});
