import { decimalsOf, type InstrumentSpec, type TradingHours } from '@/lib/core';

/** Spot metals / FX hours (UTC): Monday 00:00 → Friday 21:00, daily break 21:00–22:00. */
const METALS_HOURS: TradingHours = {
  weekOpen: { day: 1, minute: 0 },
  weekClose: { day: 5, minute: 21 * 60 },
  dailyBreak: { from: 21 * 60, to: 22 * 60 },
};

function spec(s: Omit<InstrumentSpec, 'pricePrecision' | 'qtyStep'>): InstrumentSpec {
  return { ...s, pricePrecision: decimalsOf(s.tickSize), qtyStep: s.lotStep };
}

/**
 * Contract specifications of the instruments that can be backtested. Adding a symbol is one
 * entry here plus a data source for it (see mock/models.ts for the synthetic one).
 */
export const INSTRUMENTS: readonly InstrumentSpec[] = [
  spec({
    symbol: 'XAUUSD',
    description: 'Gold Spot / U.S. Dollar',
    baseCurrency: 'XAU',
    quoteCurrency: 'USD',
    tickSize: 0.01,
    pipSize: 0.1,
    contractSize: 100,
    lotMin: 0.01,
    lotStep: 0.01,
    lotMax: 100,
    defaultSpread: 0.2,
    defaultCommissionPerLot: 0,
    tradingHours: METALS_HOURS,
  }),
];

export function instrumentSpec(symbol: string): InstrumentSpec | null {
  const upper = symbol.trim().toUpperCase();
  return INSTRUMENTS.find((i) => i.symbol === upper) ?? null;
}
