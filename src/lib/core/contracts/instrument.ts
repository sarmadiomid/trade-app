import type { SymbolInfo } from './symbol';

/** Weekly trading schedule in UTC minutes. */
export interface TradingHours {
  /** UTC weekday the trading week opens (0 = Sunday) and the minute of that day it opens. */
  readonly weekOpen: { readonly day: number; readonly minute: number };
  /** UTC weekday and minute the trading week closes. */
  readonly weekClose: { readonly day: number; readonly minute: number };
  /** Daily maintenance break [from, to) in minutes of the UTC day, or null. */
  readonly dailyBreak: { readonly from: number; readonly to: number } | null;
}

/**
 * Contract specification of a tradable instrument (what the execution engine needs). Extends
 * the display metadata with sizing and cost data, so adding a symbol is one catalogue entry.
 */
export interface InstrumentSpec extends SymbolInfo {
  /** Price distance traders call one pip (XAUUSD: 0.10). */
  readonly pipSize: number;
  /** Units per 1.00 lot (XAUUSD: 100 oz). */
  readonly contractSize: number;
  readonly lotMin: number;
  readonly lotStep: number;
  readonly lotMax: number;
  /** Typical spread in price units, used when a session enables spreads. */
  readonly defaultSpread: number;
  /** Commission per lot per side in the quote currency, used when a session enables it. */
  readonly defaultCommissionPerLot: number;
  readonly tradingHours: TradingHours;
}
