import { DAY_MS, type TimeframeId } from '@/lib/core';
import {
  equity,
  floatingPnl,
  pips,
  sessionEnd,
  type AccountConfig,
  type AccountStatus,
  type BacktestSession,
  type PendingOrder,
  type Position,
  type ScalperSettings,
  type SessionSettings,
  type Trade,
} from '@/lib/backtest';

export interface PositionView extends Position {
  readonly floating: number;
  readonly pips: number;
  readonly current: number;
}

export interface PropProgress {
  readonly profit: number;
  readonly profitTarget: number;
  readonly dailyLoss: number;
  readonly dailyLimit: number;
  readonly totalLoss: number;
  readonly totalLimit: number;
}

/** Low-frequency view of the session for React (the chart reads the engine directly). */
export interface BacktestSnapshot {
  readonly id: string;
  readonly settings: SessionSettings;
  readonly cursor: number;
  readonly start: number;
  readonly end: number;
  readonly progress: number;
  readonly daysLeft: number;
  readonly playing: boolean;
  readonly loading: boolean;
  readonly tickerValue: TimeframeId;
  readonly frequency: number;
  readonly status: AccountStatus;
  readonly failReason: string | null;
  readonly targetReached: boolean;
  readonly balance: number;
  readonly equity: number;
  readonly floating: number;
  readonly realized: number;
  readonly bid: number;
  readonly ask: number;
  readonly spread: number;
  readonly positions: readonly PositionView[];
  readonly orders: readonly PendingOrder[];
  readonly trades: readonly Trade[];
  readonly winRate: number;
  readonly quickVolume: number;
  readonly scalper: ScalperSettings;
  readonly prop: PropProgress | null;
}

export function buildSnapshot(
  s: BacktestSession,
  cfg: AccountConfig,
  flags: { playing: boolean; loading: boolean },
): BacktestSnapshot {
  const a = s.account;
  const start = s.settings.startDate;
  const end = sessionEnd(s.settings);
  const eq = equity(cfg, a);
  const positions = a.positions.map((p) => {
    const current = p.side === 'buy' ? a.bid : a.bid + cfg.spread;
    return {
      ...p,
      floating: floatingPnl(cfg, p, a.bid),
      current,
      pips: pips(cfg, p.side, p.entryPrice, current),
    };
  });
  const wins = a.trades.filter((t) => t.netPnl > 0.004).length;
  const r = cfg.propRules;
  return {
    id: s.id,
    settings: s.settings,
    cursor: s.cursor,
    start,
    end,
    progress: Math.max(0, Math.min(1, (s.cursor - start) / (end - start))),
    daysLeft: Math.max(0, Math.ceil((end - s.cursor) / DAY_MS)),
    playing: flags.playing,
    loading: flags.loading,
    tickerValue: s.prefs.tickerValue,
    frequency: s.prefs.frequency,
    status: a.status,
    failReason: a.failReason,
    targetReached: a.targetReachedAt !== null,
    balance: a.balance,
    equity: eq,
    floating: eq - a.balance,
    realized: a.balance - cfg.startingBalance,
    bid: a.bid,
    ask: a.bid + cfg.spread,
    spread: cfg.spread,
    positions,
    orders: a.orders.map((o) => ({ ...o })),
    trades: a.trades,
    winRate: a.trades.length ? wins / a.trades.length : 0,
    quickVolume: s.quickVolume,
    scalper: s.scalper,
    prop: r
      ? {
          profit: a.balance - cfg.startingBalance,
          profitTarget: (cfg.startingBalance * r.profitTargetPct) / 100,
          dailyLoss: Math.max(0, a.dayStartBalance - eq),
          dailyLimit: (cfg.startingBalance * r.maxDailyLossPct) / 100,
          totalLoss: Math.max(0, cfg.startingBalance - eq),
          totalLimit: (cfg.startingBalance * r.maxTotalLossPct) / 100,
        }
      : null,
  };
}
