import { describe, expect, it } from 'vitest';
import { firstProtection, hydrateInitialLevels, type BacktestSession } from '@/lib/backtest';

function bareSession(over: Partial<BacktestSession['account']> & { actions: BacktestSession['actions'] }): BacktestSession {
  return {
    id: 's',
    createdAt: 0,
    updatedAt: 0,
    settings: {
      name: 't',
      description: '',
      strategyTag: '',
      type: 'backtesting',
      symbol: 'XAUUSD',
      startingBalance: 10_000,
      startDate: 0,
      endDate: 86_400_000,
      spreadEnabled: false,
      spread: 0,
      commissionEnabled: false,
      commissionPerLot: 0,
      propRules: null,
    },
    prefs: { tickerValue: '1m', frequency: 1 },
    scalper: { enabled: false, unit: 'pips', sl: null, tp: null, autoBE: null },
    quickVolume: 1,
    cursor: 0,
    actions: over.actions,
    account: {
      balance: 10_000,
      positions: over.positions ?? [],
      orders: [],
      trades: over.trades ?? [],
      time: 0,
      bid: 2000,
      status: 'active',
      day: 0,
      dayStartBalance: 10_000,
      targetReachedAt: null,
      failReason: null,
    },
    initialBid: 2000,
    journal: {},
    nextId: 1,
  };
}

describe('hydrateInitialLevels', () => {
  it('recovers first SL/TP from modify-position when open had none', () => {
    const trade = {
      id: '1',
      side: 'buy' as const,
      entryKind: 'market' as const,
      entryPrice: 2000,
      entryTime: 0,
      initialVolume: 1,
      volume: 0,
      sl: 1985,
      tp: 2030,
      initialSl: null,
      initialTp: null,
      autoBE: null,
      breakEven: false,
      commission: 0,
      exits: [],
      worstPrice: 1990,
      bestPrice: 2010,
      closeTime: 60_000,
      closePrice: 2010,
      grossPnl: 1000,
      netPnl: 1000,
      closeReason: 'manual' as const,
    };
    const session = bareSession({
      trades: [trade],
      actions: [
        { t: 0, a: { type: 'market', id: '1', side: 'buy', volume: 1, sl: null, tp: null } },
        { t: 1, a: { type: 'modify-position', id: '1', sl: 1990, tp: 2020 } },
        { t: 2, a: { type: 'modify-position', id: '1', sl: 1985, tp: 2030 } },
      ],
    });
    hydrateInitialLevels(session);
    expect(session.account.trades[0]).toMatchObject({ initialSl: 1990, initialTp: 2020 });
  });

  it('keeps open-time levels as the first protection', () => {
    const map = firstProtection([
      { t: 0, a: { type: 'market', id: '1', side: 'buy', volume: 1, sl: 1990, tp: 2020 } },
      { t: 1, a: { type: 'modify-position', id: '1', sl: 1980, tp: 2040 } },
    ]);
    expect(map.get('1')).toEqual({ sl: 1990, tp: 2020 });
  });
});
