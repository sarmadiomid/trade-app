import { EPS, ask, normalizeLots } from './math';
import type { AccountConfig, AutoBreakEven, PendingKind, Side } from './types';

const fmt = (cfg: AccountConfig, v: number) =>
  v.toFixed(Math.max(0, -Math.floor(Math.log10(cfg.tickSize) + EPS)));

export function checkVolume(cfg: AccountConfig, volume: number): string | null {
  const v = normalizeLots(cfg, volume);
  if (v <= 0) return `حجم باید حداقل ${cfg.lotMin} لات باشد`;
  if (volume > cfg.lotMax + EPS) return `حجم باید حداکثر ${cfg.lotMax} لات باشد`;
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
    if (!(sl > 0)) return 'حد ضرر باید قیمتی مثبت باشد';
    if (side === 'buy' && sl >= ref - EPS)
      return `حد ضرر خرید باید پایین‌تر از ${label} فعلی باشد (${fmt(cfg, ref)})`;
    if (side === 'sell' && sl <= ref + EPS)
      return `حد ضرر فروش باید بالاتر از ${label} فعلی باشد (${fmt(cfg, ref)})`;
  }
  if (tp !== null) {
    if (!(tp > 0)) return 'حد سود باید قیمتی مثبت باشد';
    if (side === 'buy' && tp <= ref + EPS)
      return `حد سود خرید باید بالاتر از ${label} فعلی باشد (${fmt(cfg, ref)})`;
    if (side === 'sell' && tp >= ref - EPS)
      return `حد سود فروش باید پایین‌تر از ${label} فعلی باشد (${fmt(cfg, ref)})`;
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
  if (!(price > 0)) return 'قیمت سفارش باید مثبت باشد';
  const a = ask(cfg, bid);
  const name = `${side === 'buy' ? 'خرید' : 'فروش'} ${kind === 'limit' ? 'لیمیت' : 'استاپ'}`;
  if (side === 'buy' && kind === 'limit' && price >= a - EPS)
    return `قیمت ${name} باید پایین‌تر از Ask فعلی باشد (${fmt(cfg, a)})`;
  if (side === 'buy' && kind === 'stop' && price <= a + EPS)
    return `قیمت ${name} باید بالاتر از Ask فعلی باشد (${fmt(cfg, a)})`;
  if (side === 'sell' && kind === 'limit' && price <= bid + EPS)
    return `قیمت ${name} باید بالاتر از Bid فعلی باشد (${fmt(cfg, bid)})`;
  if (side === 'sell' && kind === 'stop' && price >= bid - EPS)
    return `قیمت ${name} باید پایین‌تر از Bid فعلی باشد (${fmt(cfg, bid)})`;
  if (sl !== null && (side === 'buy' ? sl >= price - EPS : sl <= price + EPS))
    return `حد ضرر باید ${side === 'buy' ? 'پایین‌تر' : 'بالاتر'} از قیمت سفارش باشد`;
  if (tp !== null && (side === 'buy' ? tp <= price + EPS : tp >= price - EPS))
    return `حد سود باید ${side === 'buy' ? 'بالاتر' : 'پایین‌تر'} از قیمت سفارش باشد`;
  return null;
}

export function checkAutoBE(autoBE: AutoBreakEven | null, sl: number | null): string | null {
  if (!autoBE) return null;
  if (sl === null) return 'سربه‌سر خودکار بدون حد ضرر ممکن نیست';
  if (!(autoBE.value > 0)) return 'فاصله سربه‌سر خودکار باید مثبت باشد';
  return null;
}
