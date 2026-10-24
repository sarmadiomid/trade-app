import { describe, expect, it } from 'vitest';
import { ExecutionEngine, type AccountState, type LoggedAction } from '@/lib/backtest';
import { recordsFromAccount } from '@/lib/backtest/session/positions';
import { planReplay } from '@/lib/backtest/session/reconcile';

const cfg = {
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

function account(): AccountState {
  return ExecutionEngine.initialState(cfg, 0, 100);
}

describe('position ledger', () => {
  it('records an open when a market order fills and a close when it is closed', () => {
    const engine = new ExecutionEngine(cfg, account());
    expect(engine.apply({ type: 'market', id: '1', side: 'buy', volume: 1, sl: null, tp: null }).ok).toBe(
      true,
    );
    expect(recordsFromAccount(engine.state).map((r) => r.kind)).toEqual(['open']);
    expect(engine.apply({ type: 'close', id: '1' }).ok).toBe(true);
    const records = recordsFromAccount(engine.state);
    expect(records.map((r) => r.kind)).toEqual(['open', 'close']);
    expect(records[1]).toMatchObject({ positionId: '1', reason: 'manual' });
    expect(engine.state.positions).toHaveLength(0);
  });
});

describe('session replay plan', () => {
  const stored = {
    cursor: 30,
    actions: [
      { t: 10, a: { type: 'close-all' } },
      { t: 20, a: { type: 'cancel-all' } },
    ] as LoggedAction[],
  };

  it('keeps a cursor-only move as an advance and a rewind as a full replay', () => {
    expect(planReplay(stored, stored.actions, 40)).toEqual({ kind: 'advance' });
    expect(planReplay(stored, [stored.actions[0]!], 15)).toEqual({ kind: 'replay' });
    expect(planReplay(stored, stored.actions, 30)).toEqual({ kind: 'meta' });
  });

  it('rejects an edited action', () => {
    const edited = [stored.actions[0]!, { t: 20, a: { type: 'close-all' as const } }];
    expect(planReplay(stored, edited, 30)).toEqual({ error: 'سابقهٔ معاملات قابل تغییر نیست' });
  });
});
