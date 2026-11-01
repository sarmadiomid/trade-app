import type { LoggedAction, BacktestSession } from './model';

type Levels = { sl: number | null; tp: number | null };

/**
 * First SL/TP recorded per position id: from the open (or pending place), else the first
 * later modify that sets each side. Used to backfill `initialSl` / `initialTp` on sessions
 * saved before modify-position started capturing them.
 */
export function firstProtection(actions: readonly LoggedAction[]): Map<string, Levels> {
  const out = new Map<string, Levels>();
  const take = (id: string, sl: number | null | undefined, tp: number | null | undefined) => {
    const cur = out.get(id) ?? { sl: null, tp: null };
    out.set(id, {
      sl: cur.sl ?? (sl === undefined || sl === null ? null : sl),
      tp: cur.tp ?? (tp === undefined || tp === null ? null : tp),
    });
  };
  for (const { a } of actions) {
    if (a.type === 'market' || a.type === 'pending') take(a.id, a.sl, a.tp);
    else if (a.type === 'modify-order' || a.type === 'modify-position') take(a.id, a.sl, a.tp);
  }
  return out;
}

/** Fills missing `initialSl` / `initialTp` on open positions and closed trades from the action log. */
export function hydrateInitialLevels(session: BacktestSession): void {
  const first = firstProtection(session.actions);
  const patch = (p: { id: string; initialSl: number | null; initialTp: number | null }) => {
    const f = first.get(p.id);
    if (!f) return;
    if (p.initialSl === null && f.sl !== null) p.initialSl = f.sl;
    if (p.initialTp === null && f.tp !== null) p.initialTp = f.tp;
  };
  for (const p of session.account.positions) patch(p);
  for (const t of session.account.trades) patch(t);
}
