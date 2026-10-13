import { EPS, ask, normalizeLots } from './math';
import type { AccountConfig, AutoBreakEven, PendingKind, Side } from './types';

const fmt = (cfg: AccountConfig, v: number) =>
  v.toFixed(Math.max(0, -Math.floor(Math.log10(cfg.tickSize) + EPS)));

export function checkVolume(cfg: AccountConfig, volume: number): string | null {
  const v = normalizeLots(cfg, volume);
  if (v <= 0) return `Volume must be at least ${cfg.lotMin} lots`;
  if (volume > cfg.lotMax + EPS) return `Volume must be at most ${cfg.lotMax} lots`;
  return null;
}

/**
 * SL/TP of an open (or about to open) position. They must be on the losing / winning side of the
 * current exit price, otherwise they would trigger instantly.
 */
export function checkProtection(
  cfg: AccountConfig,
  side: Side,
  bid: number,
  sl: number | null,
  tp: number | null,
): string | null {
  const ref = side === 'buy' ? bid : ask(cfg, bid);
  const label = side === 'buy' ? 'Bid' : 'Ask';
  if (sl !== null) {
    if (!(sl > 0)) return 'Stop loss must be a positive price';
    if (side === 'buy' && sl >= ref - EPS)
      return `Stop loss must be below the current ${label} (${fmt(cfg, ref)})`;
    if (side === 'sell' && sl <= ref + EPS)
      return `Stop loss must be above the current ${label} (${fmt(cfg, ref)})`;
  }
  if (tp !== null) {
    if (!(tp > 0)) return 'Take profit must be a positive price';
    if (side === 'buy' && tp <= ref + EPS)
      return `Take profit must be above the current ${label} (${fmt(cfg, ref)})`;
    if (side === 'sell' && tp >= ref - EPS)
      return `Take profit must be below the current ${label} (${fmt(cfg, ref)})`;
  }
  return null;
}

/** Entry price of a pending order relative to the market, and its SL/TP relative to the entry. */
export function checkPending(
  cfg: AccountConfig,
  side: Side,
  kind: PendingKind,
  price: number,
  bid: number,
  sl: number | null,
  tp: number | null,
): string | null {
  if (!(price > 0)) return 'Order price must be a positive price';
  const a = ask(cfg, bid);
  const name = `${side === 'buy' ? 'Buy' : 'Sell'} ${kind === 'limit' ? 'Limit' : 'Stop'}`;
  if (side === 'buy' && kind === 'limit' && price >= a - EPS)
    return `${name} price must be below the current Ask (${fmt(cfg, a)})`;
  if (side === 'buy' && kind === 'stop' && price <= a + EPS)
    return `${name} price must be above the current Ask (${fmt(cfg, a)})`;
  if (side === 'sell' && kind === 'limit' && price <= bid + EPS)
    return `${name} price must be above the current Bid (${fmt(cfg, bid)})`;
  if (side === 'sell' && kind === 'stop' && price >= bid - EPS)
    return `${name} price must be below the current Bid (${fmt(cfg, bid)})`;
  if (sl !== null && (side === 'buy' ? sl >= price - EPS : sl <= price + EPS))
    return `Stop loss must be ${side === 'buy' ? 'below' : 'above'} the order price`;
  if (tp !== null && (side === 'buy' ? tp <= price + EPS : tp >= price - EPS))
    return `Take profit must be ${side === 'buy' ? 'above' : 'below'} the order price`;
  return null;
}

export function checkAutoBE(autoBE: AutoBreakEven | null, sl: number | null): string | null {
  if (!autoBE) return null;
  if (sl === null) return 'Auto break even needs a stop loss';
  if (!(autoBE.value > 0)) return 'Auto break even distance must be positive';
  return null;
}
