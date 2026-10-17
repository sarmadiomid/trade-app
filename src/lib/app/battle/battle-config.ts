import { DAY_MS, type InstrumentSpec } from '@/lib/core';
import { accountConfig, type AccountConfig, type SessionSettings } from '@/lib/backtest';
import { marketSpanMs, type BattleSettings } from '@/lib/battles';

/**
 * A battle's account as backtest session settings: the battle's balance, the instrument's
 * default costs and its drawdown rules as prop-firm rules (breaking one disqualifies). Shared
 * by the server's simulation and the browser so both run the broker identically.
 */
export function battleSessionSettings(
  settings: BattleSettings,
  symbol: string,
  spec: InstrumentSpec,
  marketStart: number,
): SessionSettings {
  const day = (t: number) => Math.floor(t / DAY_MS) * DAY_MS;
  return {
    name: settings.name,
    description: '',
    strategyTag: '',
    type: 'prop',
    symbol,
    startingBalance: settings.startingBalance,
    startDate: day(marketStart),
    endDate: day(marketStart + marketSpanMs(settings)),
    spreadEnabled: true,
    spread: spec.defaultSpread,
    commissionEnabled: spec.defaultCommissionPerLot > 0,
    commissionPerLot: spec.defaultCommissionPerLot,
    propRules: {
      // "Not set" limits never trigger before the broker's own stop out.
      profitTargetPct: settings.profitTargetPct ?? 1e9,
      maxDailyLossPct: settings.maxDailyDrawdownPct ?? 100,
      maxTotalLossPct: settings.maxDrawdownPct ?? 100,
    },
  };
}

export function battleAccountConfig(
  settings: BattleSettings,
  symbol: string,
  spec: InstrumentSpec,
  marketStart: number,
): AccountConfig {
  return accountConfig(battleSessionSettings(settings, symbol, spec, marketStart), spec);
}
