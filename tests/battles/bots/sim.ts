/** Shared harness: plays bots through battles on the real seeded market and broker. */
import { battleAccountConfig } from '@/lib/app/battle/battle-config';
import { planBot, type BotPlan } from '@/lib/app/battle/bots/planner';
import { moodOf, personaOf, type Persona } from '@/lib/app/battle/bots/persona';
import { botRng, seedOf } from '@/lib/app/battle/bots/rng';
import { presetSettings } from '@/lib/app/battle/bots/world';
import { drawIdentities } from '@/lib/app/battle/bots/identity';
import { ExecutionEngine, resimulate, equity, type AccountConfig } from '@/lib/backtest';
import { marketEnd, marketSpanMs, type BattleSettings } from '@/lib/battles';
import { DAY_MS, HOUR_MS, MINUTE_MS, type Candle } from '@/lib/core';
import { MockMarketProvider, instrumentSpec } from '@/lib/data';

export const provider = new MockMarketProvider();

export function bidBefore(symbol: string, t: number): number {
  const res = provider.generate({ symbol, timeframe: '1m', endTime: t - 1, limit: 1 });
  return res.bars[0]?.close ?? 0;
}

/** A weekday start whose replay fits before the Friday close (like pickMarketStart). */
export function marketStartFor(symbol: string, settings: BattleSettings, seed: number): number {
  const r = botRng(seed);
  const range = provider.dataRange(symbol);
  const span = marketSpanMs(settings);
  const firstMonday = (t: number) => {
    const d = Math.floor(t / DAY_MS) * DAY_MS;
    return d + ((8 - new Date(d).getUTCDay()) % 7) * DAY_MS;
  };
  const first = firstMonday(range.start + 30 * DAY_MS);
  const weeks = Math.floor((range.end - 7 * DAY_MS - first) / (7 * DAY_MS));
  const monday = first + r.int(0, weeks - 1) * 7 * DAY_MS;
  const earliest = monday + HOUR_MS;
  const latest = monday + 4 * DAY_MS + 20 * HOUR_MS - span;
  const slots = Math.max(1, Math.floor((latest - earliest) / (15 * MINUTE_MS)));
  return earliest + r.int(0, slots - 1) * 15 * MINUTE_MS;
}

export interface SimBattle {
  readonly settings: BattleSettings;
  readonly symbol: string;
  readonly marketStart: number;
  readonly end: number;
  readonly cfg: AccountConfig;
  readonly bars: Candle[];
  readonly history: Candle[];
  readonly startBid: number;
}

export function simBattle(seed: number, patch: Partial<BattleSettings> = {}): SimBattle {
  const r = botRng(seedOf(seed, 'battle'));
  const settings = { ...presetSettings(r).settings, ...patch };
  const symbol = settings.assets[r.int(0, settings.assets.length - 1)]!;
  const marketStart = marketStartFor(symbol, settings, seedOf(seed, 'start'));
  const end = marketEnd({ ...settings, marketStart });
  const spec = instrumentSpec(symbol)!;
  const cfg = battleAccountConfig(settings, symbol, spec, 0);
  return {
    settings,
    symbol,
    marketStart,
    end,
    cfg,
    bars: provider.minuteBars(symbol, marketStart, end),
    history: provider.minuteBars(symbol, marketStart - 2 * DAY_MS, marketStart),
    startBid: bidBefore(symbol, marketStart),
  };
}

export interface SimResult {
  readonly persona: Persona;
  readonly plan: BotPlan;
  readonly returnPct: number;
  readonly trades: number;
  readonly wins: number;
  readonly status: 'active' | 'disqualified' | 'left' | 'target';
  readonly targetAt: number | null;
}

/** Plays `persona` through `b` and returns its final result from the canonical re-simulation. */
export function playBot(b: SimBattle, persona: Persona, seed: number): SimResult {
  const plan = planBot({
    cfg: b.cfg,
    rules: b.settings,
    history: b.history,
    bars: b.bars,
    startT: b.marketStart,
    startBid: b.startBid,
    end: b.end,
    persona,
    seed,
  });
  const initial = ExecutionEngine.initialState(b.cfg, b.marketStart, b.startBid);
  const stop = Math.min(plan.leaveT ?? Infinity, b.end);
  const eng = resimulate(b.cfg, initial, plan.actions, b.bars, stop);
  const failed = eng.state.status === 'failed' || eng.state.status === 'stopped-out';
  if (eng.state.status === 'active') eng.endSession();
  const s = eng.state;
  const eq = s.status === 'active' ? equity(b.cfg, s) : s.balance;
  return {
    persona,
    plan,
    returnPct: ((eq - b.cfg.startingBalance) / b.cfg.startingBalance) * 100,
    trades: s.trades.length,
    wins: s.trades.filter((t) => t.netPnl > 0).length,
    status: failed
      ? 'disqualified'
      : plan.leaveT !== null
        ? 'left'
        : b.settings.winCondition === 'profit-target' && s.targetReachedAt !== null
          ? 'target'
          : 'active',
    targetAt: s.targetReachedAt,
  };
}

/** A whole field: `n` distinct bots in one battle. */
export function playField(b: SimBattle, n: number, seed: number, tilt = 0): SimResult[] {
  return drawIdentities(seedOf(seed, 'field'), n, new Set(), tilt).map((id) =>
    playBot(b, moodOf(personaOf(id.index), seed), seedOf(seed, id.index)),
  );
}

export const quantile = (xs: readonly number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]!;
};
