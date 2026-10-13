import type { AccountConfig, AccountState, Position, Side, Trade } from './types';

export const EPS = 1e-9;

/** +1 for buys, −1 for sells. */
export const dir = (side: Side): number => (side === 'buy' ? 1 : -1);

const decimals = (step: number): number => {
  const s = step.toString();
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

/** Rounds to a multiple of `step` without binary noise (0.1 + 0.2 → 0.3). */
export function roundToStep(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(decimals(step)));
}

export const roundPrice = (cfg: AccountConfig, price: number): number =>
  roundToStep(price, cfg.tickSize);

/** Floors to the lot step and clamps to the instrument limits (0 when below the minimum). */
export function normalizeLots(cfg: AccountConfig, lots: number): number {
  if (!Number.isFinite(lots) || lots <= 0) return 0;
  const floored = Math.floor(lots / cfg.lotStep + EPS) * cfg.lotStep;
  const v = roundToStep(Math.min(cfg.lotMax, floored), cfg.lotStep);
  return v + EPS < cfg.lotMin ? 0 : v;
}

export const ask = (cfg: AccountConfig, bid: number): number => roundPrice(cfg, bid + cfg.spread);

/** Price a position of `side` exits at, given the Bid. */
export const exitPrice = (cfg: AccountConfig, side: Side, bid: number): number =>
  side === 'buy' ? bid : ask(cfg, bid);

/** Price a new position of `side` enters at, given the Bid. */
export const entryPrice = (cfg: AccountConfig, side: Side, bid: number): number =>
  side === 'buy' ? ask(cfg, bid) : bid;

/** Gross P&L of `volume` lots moved from `entry` to `exit`. */
export function pnl(cfg: AccountConfig, side: Side, entry: number, exit: number, volume: number) {
  return round2(dir(side) * (exit - entry) * volume * cfg.contractSize);
}

/** Signed distance in pips (positive = in favour). */
export const pips = (cfg: AccountConfig, side: Side, entry: number, price: number): number =>
  (dir(side) * (price - entry)) / cfg.pipSize;

export const commission = (cfg: AccountConfig, volume: number): number =>
  round2(cfg.commissionPerLot * volume);

export const round2 = (v: number): number => Math.round(v * 100) / 100;

export function floatingPnl(cfg: AccountConfig, p: Position, bid: number): number {
  return pnl(cfg, p.side, p.entryPrice, exitPrice(cfg, p.side, bid), p.volume);
}

export function equity(cfg: AccountConfig, s: AccountState, bid = s.bid): number {
  let e = s.balance;
  for (const p of s.positions) e += floatingPnl(cfg, p, bid);
  return round2(e);
}

/** Money at risk if the initial stop is hit (null without a stop). */
export function initialRisk(cfg: AccountConfig, p: Position): number | null {
  if (p.initialSl === null) return null;
  const r = Math.abs(p.entryPrice - p.initialSl) * p.initialVolume * cfg.contractSize;
  return r > EPS ? r : null;
}

/** Planned reward:risk of the initial SL/TP (null unless both were set). */
export function plannedRR(p: Position): number | null {
  if (p.initialSl === null || p.initialTp === null) return null;
  const risk = Math.abs(p.entryPrice - p.initialSl);
  return risk > EPS ? Math.abs(p.initialTp - p.entryPrice) / risk : null;
}

/** Realized R multiple (net P&L / initial risk). */
export function rMultiple(cfg: AccountConfig, t: Trade): number | null {
  const risk = initialRisk(cfg, t);
  return risk === null ? null : t.netPnl / risk;
}

/** Lots that risk `riskMoney` with a stop `stopDistance` away (price units). */
export function lotsForRisk(cfg: AccountConfig, riskMoney: number, stopDistance: number): number {
  if (!(stopDistance > EPS) || !(riskMoney > 0)) return 0;
  return normalizeLots(cfg, riskMoney / (stopDistance * cfg.contractSize));
}

/** MAE / MFE of a position in R (null without an initial stop). */
export function excursionR(p: Position): { mae: number; mfe: number } | null {
  if (p.initialSl === null) return null;
  const risk = Math.abs(p.entryPrice - p.initialSl);
  if (!(risk > EPS)) return null;
  const d = dir(p.side);
  return {
    mae: Math.max(0, (d * (p.entryPrice - p.worstPrice)) / risk),
    mfe: Math.max(0, (d * (p.bestPrice - p.entryPrice)) / risk),
  };
}
