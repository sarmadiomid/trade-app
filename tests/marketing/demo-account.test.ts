import { describe, expect, it } from 'vitest';
import type { Candle } from '@/lib/core';
import { instrumentSpec } from '@/lib/data';
import { DemoAccount, levelCross, movePath } from '@/components/marketing/demo-account';

const spec = instrumentSpec('XAUUSD')!;

function bar(over: Partial<Candle> = {}): Candle {
  return { time: 1_000, open: 2300, high: 2300, low: 2300, close: 2300, volume: 1, ...over };
}

describe('movePath', () => {
  const prev = { time: 1_000, high: 2302, low: 2298, close: 2300 };

  it('follows a new bar from open through the wick to the close', () => {
    const next = bar({ time: 2_000, open: 2301, high: 2310, low: 2295, close: 2308 });
    expect(movePath(prev, next)).toEqual([2301, 2295, 2310, 2308]);
  });

  it('on the same bar, only reports a low that is newer than the one already seen', () => {
    expect(movePath(prev, bar({ low: 2290, close: 2296 }))).toEqual([2290, 2296]);
    expect(movePath(prev, bar({ close: 2304 }))).toEqual([2304]);
  });
});

describe('levelCross', () => {
  it('picks the level reached first', () => {
    expect(
      levelCross(100, 110, [
        { kind: 'tp', price: 108 },
        { kind: 'sl', price: 104 },
      ]),
    ).toEqual({ kind: 'sl', price: 104 });
    expect(levelCross(100, 100, [{ kind: 'sl', price: 100 }])).toBeNull();
  });
});

describe('DemoAccount', () => {
  it('opens a buy at the ask and marks the open profit as price rises', () => {
    const account = new DemoAccount(spec);
    account.onBar(bar());
    expect(account.market('buy')).toBeNull();
    const position = account.engine.state.positions[0]!;
    expect(position.side).toBe('buy');
    expect(position.entryPrice).toBeCloseTo(2300.2);
    expect(position.volume).toBeCloseTo(0.1);

    account.onBar(bar({ high: 2310, close: 2310 }));
    expect(account.snapshot.positions[0]!.pnl).toBeCloseTo(98);
    expect(account.snapshot.equity).toBeCloseTo(10_098);
  });

  it('does not stop out on a wick that printed before the click', () => {
    const account = new DemoAccount(spec);
    account.onBar(bar({ low: 2280, close: 2300 }));
    account.market('buy');
    const id = account.engine.state.positions[0]!.id;
    account.commit({ owner: 'position', ownerId: id, kind: 'sl' }, 2290);
    account.onBar(bar({ low: 2280, close: 2296 }));
    expect(account.engine.state.positions).toHaveLength(1);
  });

  it('closes at the stop when price trades through it, and at the target on a new bar', () => {
    const account = new DemoAccount(spec);
    account.onBar(bar());
    account.market('sell');
    const id = account.engine.state.positions[0]!.id;
    expect(account.engine.state.positions[0]!.entryPrice).toBeCloseTo(2300);
    account.commit({ owner: 'position', ownerId: id, kind: 'tp' }, 2290);

    account.onBar(bar({ time: 2_000, open: 2300, high: 2301, low: 2288, close: 2292 }));
    expect(account.engine.state.positions).toHaveLength(0);
    expect(account.engine.state.trades[0]!.closeReason).toBe('tp');
    expect(account.engine.state.trades[0]!.closePrice).toBeCloseTo(2290);
    expect(account.snapshot.balance).toBeCloseTo(10_100);
  });

  it('closes from the ticket and rejects a volume below the minimum', () => {
    const account = new DemoAccount(spec);
    expect(account.market('buy')).toMatch(/آماده نیست/);
    account.onBar(bar());
    account.market('buy');
    const id = account.engine.state.positions[0]!.id;
    expect(account.close(id)).toBeNull();
    expect(account.engine.state.positions).toHaveLength(0);

    account.setVolume(0);
    expect(account.market('buy')).toMatch(/حداقل/);
    expect(account.engine.state.positions).toHaveLength(0);
  });
});
