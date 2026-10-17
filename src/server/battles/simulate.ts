import 'server-only';
import {
  ExecutionEngine,
  equity,
  resimulate,
  type AccountState,
  type TradeAction,
} from '@/lib/backtest';
import { marketEnd, type ParticipantStatus, type Standing } from '@/lib/battles';
import type { BattleDoc, BattleParticipantDoc } from '../db';
import { battleConfig, battleMinutes } from './market';

export interface Simulated {
  readonly standing: Standing;
  readonly account: AccountState;
}

/**
 * One trader's account at market time `until`, re-simulated from their logged actions over the
 * battle's 1-minute bars (the same deterministic engine the browser runs). When `final` is set,
 * whatever is still open is closed at the last price.
 */
export function simulateParticipant(
  battle: BattleDoc,
  p: BattleParticipantDoc,
  until: number,
  final = false,
): Simulated {
  const cfg = battleConfig(battle.settings, battle.symbol);
  const end = marketEnd({ ...battle.settings, marketStart: battle.marketStart });
  const stop = Math.min(until, p.leftT ?? Infinity, end);
  const minutes = battleMinutes(battle.symbol, battle.marketStart, end).filter(
    (b) => b.time >= p.startT,
  );
  const initial = ExecutionEngine.initialState(cfg, p.startT, p.startBid);
  const engine =
    stop <= p.startT
      ? new ExecutionEngine(cfg, initial)
      : resimulate(cfg, initial, p.actions, minutes, stop);
  if ((final || p.leftT !== null) && engine.state.status === 'active') engine.endSession();
  const s = engine.state;
  let status: ParticipantStatus = 'active';
  let reason: string | null = null;
  if (s.status === 'failed' || s.status === 'stopped-out') {
    status = 'disqualified';
    reason = s.failReason ?? 'Stopped out';
  } else if (p.leftT !== null && p.leftT <= until) {
    status = 'left';
    reason = 'Left the battle';
  } else if (battle.settings.winCondition === 'profit-target' && s.targetReachedAt !== null) {
    status = 'target';
  }
  const eq = s.status === 'active' ? equity(cfg, s) : s.balance;
  return {
    account: s,
    standing: {
      userId: p.userId.toHexString(),
      name: p.name,
      elo: p.elo,
      status,
      balance: round2(s.balance),
      equity: round2(eq),
      returnPct: ((eq - cfg.startingBalance) / cfg.startingBalance) * 100,
      openPositions: s.positions.length,
      trades: s.trades.length,
      wins: s.trades.filter((t) => t.netPnl > 0).length,
      targetAt: battle.settings.winCondition === 'profit-target' ? s.targetReachedAt : null,
      reason,
    },
  };
}

/**
 * Checks a new action like the broker would at market time `at` (after everything the trader
 * did before it). Returns the broker's error, or null when it is accepted.
 */
export function validateAction(
  battle: BattleDoc,
  p: BattleParticipantDoc,
  at: number,
  action: TradeAction,
): string | null {
  const cfg = battleConfig(battle.settings, battle.symbol);
  const end = marketEnd({ ...battle.settings, marketStart: battle.marketStart });
  const minutes = battleMinutes(battle.symbol, battle.marketStart, end).filter(
    (b) => b.time >= p.startT,
  );
  const engine = resimulate(
    cfg,
    ExecutionEngine.initialState(cfg, p.startT, p.startBid),
    p.actions,
    minutes,
    Math.max(at, p.startT),
  );
  const res = engine.apply(action);
  return res.ok ? null : res.error;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
