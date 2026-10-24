import type { AccountState, Exit, Side } from '../execution/types';

/** One open or close, derived from the broker's account so the database matches the fill. */
export interface PositionRecord {
  readonly kind: 'open' | 'close';
  readonly positionId: string;
  readonly marketTime: number;
  readonly price: number;
  readonly volume: number;
  readonly side: Side;
  readonly reason: string | null;
  readonly pnl: number | null;
}

interface FillSource {
  readonly id: string;
  readonly side: Side;
  readonly entryPrice: number;
  readonly entryTime: number;
  readonly initialVolume: number;
  readonly exits: readonly Exit[];
}

/**
 * Every position the account has opened, and every exit (partial or final).
 * Rebuilt from the simulated account, so a client cannot invent a fill.
 */
export function recordsFromAccount(account: AccountState): PositionRecord[] {
  const out: PositionRecord[] = [];
  const take = (p: FillSource) => {
    out.push({
      kind: 'open',
      positionId: p.id,
      marketTime: p.entryTime,
      price: p.entryPrice,
      volume: p.initialVolume,
      side: p.side,
      reason: null,
      pnl: null,
    });
    for (const e of p.exits)
      out.push({
        kind: 'close',
        positionId: p.id,
        marketTime: e.time,
        price: e.price,
        volume: e.volume,
        side: p.side,
        reason: e.reason,
        pnl: e.pnl,
      });
  };
  for (const t of account.trades) take(t);
  for (const p of account.positions) take(p);
  return out;
}
