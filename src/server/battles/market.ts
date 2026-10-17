import 'server-only';
import { randomInt } from 'node:crypto';
import { DAY_MS, HOUR_MS, MINUTE_MS, type Candle, type InstrumentSpec } from '@/lib/core';
import type { AccountConfig } from '@/lib/backtest';
import { battleAccountConfig } from '@/lib/app/battle/battle-config';
import { MockMarketProvider, instrumentSpec } from '@/lib/data';
import { marketSpanMs, type BattleSettings } from '@/lib/battles';

/**
 * Market data of battles. The same seeded data the browser uses, so the server's simulation of
 * every trader's account matches what each trader sees on their own chart exactly.
 */
const globalForMarket = globalThis as unknown as {
  __battleMarket?: { provider: MockMarketProvider; minutes: Map<string, Candle[]> };
};

function store() {
  globalForMarket.__battleMarket ??= { provider: new MockMarketProvider(), minutes: new Map() };
  return globalForMarket.__battleMarket;
}

export function battleSpec(symbol: string): InstrumentSpec {
  return instrumentSpec(symbol) ?? store().provider.getSymbolInfo(symbol);
}

/** Account rules of a battle: its balance, the instrument's costs and the drawdown limits. */
export function battleConfig(settings: BattleSettings, symbol: string): AccountConfig {
  return battleAccountConfig(settings, symbol, battleSpec(symbol), 0);
}

const MAX_CACHED = 64;

/** Every 1-minute bar of a battle's replay window (cached; the data is deterministic). */
export function battleMinutes(symbol: string, from: number, to: number): Candle[] {
  const key = `${symbol}:${from}:${to}`;
  const { minutes, provider } = store();
  let bars = minutes.get(key);
  if (!bars) {
    bars = provider.minuteBars(symbol, from, to);
    minutes.set(key, bars);
    if (minutes.size > MAX_CACHED) minutes.delete(minutes.keys().next().value!);
  }
  return bars;
}

/** Close of the last 1-minute bar before `t` (the Bid an account starting at `t` sees). */
export function bidBefore(symbol: string, t: number): number {
  const res = store().provider.generate({ symbol, timeframe: '1m', endTime: t - 1, limit: 1 });
  const bar = res.bars[0];
  if (bar) return bar.close;
  const next = store().provider.generate({ symbol, timeframe: '1m', startTime: t, limit: 1 });
  return next.bars[0]?.open ?? 0;
}

/**
 * A random point in the instrument's history to replay: a week day morning far enough from the
 * weekly close that the whole battle fits before it. Players never know the date in advance.
 */
export function pickMarketStart(symbol: string, settings: BattleSettings): number {
  const range = store().provider.dataRange(symbol);
  const span = marketSpanMs(settings);
  const firstMonday = (t: number) => {
    const d = Math.floor(t / DAY_MS) * DAY_MS;
    const wd = new Date(d).getUTCDay();
    return d + ((8 - wd) % 7) * DAY_MS;
  };
  // Leave a month of history before the start for the chart, and room for the battle after it.
  const first = firstMonday(range.start + 30 * DAY_MS);
  const weeks = Math.floor((range.end - 7 * DAY_MS - first) / (7 * DAY_MS));
  const monday = first + randomInt(0, Math.max(1, weeks)) * 7 * DAY_MS;
  const earliest = monday + HOUR_MS;
  const latest = monday + 4 * DAY_MS + 20 * HOUR_MS - span;
  const slots = Math.max(1, Math.floor((latest - earliest) / (15 * MINUTE_MS)));
  return earliest + randomInt(0, slots) * 15 * MINUTE_MS;
}

/** A random element (crypto RNG). */
export const pick = <T>(list: readonly T[]): T => list[randomInt(0, list.length)]!;

export const randomUnit = () => randomInt(0, 2 ** 31) / 2 ** 31;
