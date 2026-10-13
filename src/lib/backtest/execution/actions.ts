import type { ExecutionEngine } from './engine';
import { EPS, dir, entryPrice, exitPrice, normalizeLots, roundPrice } from './math';
import type { PendingOrder, TradeAction } from './types';
import { checkAutoBE, checkPending, checkProtection, checkVolume } from './validate';

const roundOrNull = (e: ExecutionEngine, v: number | null | undefined) =>
  v === null || v === undefined ? null : roundPrice(e.cfg, v);

/** Applies one trader action. Returns an error message, or null on success. */
export function applyAction(e: ExecutionEngine, a: TradeAction): string | null {
  const { cfg, state: s } = e;
  switch (a.type) {
    case 'market': {
      const sl = roundOrNull(e, a.sl);
      const tp = roundOrNull(e, a.tp);
      const err =
        checkVolume(cfg, a.volume) ??
        checkProtection(cfg, a.side, s.bid, sl, tp) ??
        checkAutoBE(a.autoBE ?? null, sl);
      if (err) return err;
      if (s.positions.some((p) => p.id === a.id) || s.orders.some((o) => o.id === a.id))
        return 'Duplicate id';
      e.openPosition(
        {
          id: a.id,
          side: a.side,
          volume: normalizeLots(cfg, a.volume),
          sl,
          tp,
          autoBE: a.autoBE ?? null,
        },
        entryPrice(cfg, a.side, s.bid),
        s.time,
        'market',
      );
      return null;
    }
    case 'pending': {
      const price = roundPrice(cfg, a.price);
      const sl = roundOrNull(e, a.sl);
      const tp = roundOrNull(e, a.tp);
      const err =
        checkVolume(cfg, a.volume) ??
        checkPending(cfg, a.side, a.kind, price, s.bid, sl, tp) ??
        checkAutoBE(a.autoBE ?? null, sl);
      if (err) return err;
      const order: PendingOrder = {
        id: a.id,
        side: a.side,
        kind: a.kind,
        price,
        volume: normalizeLots(cfg, a.volume),
        sl,
        tp,
        autoBE: a.autoBE ?? null,
        placedAt: s.time,
      };
      s.orders.push(order);
      e.emit({ type: 'placed', order });
      return null;
    }
    case 'modify-order': {
      const o = s.orders.find((q) => q.id === a.id);
      if (!o) return 'Order not found';
      const price = a.price === undefined ? o.price : roundPrice(cfg, a.price);
      const volume = a.volume === undefined ? o.volume : a.volume;
      const sl = a.sl === undefined ? o.sl : roundOrNull(e, a.sl);
      const tp = a.tp === undefined ? o.tp : roundOrNull(e, a.tp);
      const err =
        checkVolume(cfg, volume) ??
        checkPending(cfg, o.side, o.kind, price, s.bid, sl, tp) ??
        checkAutoBE(o.autoBE, sl);
      if (err) return err;
      Object.assign(o, { price, volume: normalizeLots(cfg, volume), sl, tp });
      e.emit({ type: 'modified', id: o.id });
      return null;
    }
    case 'cancel-order': {
      const before = s.orders.length;
      s.orders = s.orders.filter((o) => o.id !== a.id);
      if (s.orders.length === before) return 'Order not found';
      e.emit({ type: 'cancelled', id: a.id });
      return null;
    }
    case 'modify-position': {
      const p = s.positions.find((q) => q.id === a.id);
      if (!p) return 'Position not found';
      const sl = a.sl === undefined ? p.sl : roundOrNull(e, a.sl);
      const tp = a.tp === undefined ? p.tp : roundOrNull(e, a.tp);
      const autoBE = a.autoBE === undefined ? p.autoBE : a.autoBE;
      const err = checkProtection(cfg, p.side, s.bid, sl, tp) ?? checkAutoBE(autoBE, sl);
      if (err) return err;
      p.sl = sl;
      p.tp = tp;
      p.autoBE = autoBE;
      if (sl === null || Math.abs(sl - p.entryPrice) > EPS) p.breakEven = false;
      e.emit({ type: 'modified', id: p.id });
      return null;
    }
    case 'break-even': {
      const p = s.positions.find((q) => q.id === a.id);
      if (!p) return 'Position not found';
      const px = exitPrice(cfg, p.side, s.bid);
      if (dir(p.side) * (px - p.entryPrice) <= EPS)
        return 'Price must be beyond the entry to move the stop to break even';
      p.sl = p.entryPrice;
      p.breakEven = true;
      e.emit({ type: 'break-even', positionId: p.id });
      return null;
    }
    case 'close': {
      const p = s.positions.find((q) => q.id === a.id);
      if (!p) return 'Position not found';
      const v =
        a.volume === undefined ? p.volume : normalizeLots(cfg, Math.min(a.volume, p.volume));
      if (v <= 0) return `Volume must be at least ${cfg.lotMin} lots`;
      const partial = v < p.volume - EPS;
      e.exitPosition(p, v, exitPrice(cfg, p.side, s.bid), s.time, partial ? 'partial' : 'manual');
      return null;
    }
    case 'close-all': {
      if (s.positions.length === 0) return 'No open positions';
      for (const p of [...s.positions])
        e.exitPosition(p, p.volume, exitPrice(cfg, p.side, s.bid), s.time, 'manual');
      return null;
    }
    case 'cancel-all': {
      if (s.orders.length === 0) return 'No pending orders';
      for (const o of s.orders) e.emit({ type: 'cancelled', id: o.id });
      s.orders = [];
      return null;
    }
  }
}
