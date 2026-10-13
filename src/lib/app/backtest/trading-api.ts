import {
  ask,
  dir,
  lotsForRisk,
  normalizeLots,
  roundPrice,
  type AutoBreakEven,
  type PendingKind,
  type ScalperSettings,
  type Side,
  type TradeLine,
} from '@/lib/backtest';
import type { BacktestController } from './backtest-controller';

export interface OrderTicket {
  readonly side: Side;
  readonly type: 'market' | PendingKind;
  /** Entry price for limit / stop orders. */
  readonly price?: number;
  readonly volume: number;
  readonly sl: number | null;
  readonly tp: number | null;
  readonly autoBE?: AutoBreakEven | null;
}

export interface RightClickOrder {
  readonly label: string;
  readonly side: Side;
  readonly kind: PendingKind;
  readonly price: number;
}

/** Trader-facing operations, expressed as engine actions (logged for rewind). */
export class TradingApi {
  constructor(private readonly c: BacktestController) {}

  private get cfg() {
    return this.c.cfg;
  }

  /** Current Bid / Ask. */
  quotes(): { bid: number; ask: number } {
    const bid = this.c.account.bid;
    return { bid, ask: ask(this.cfg, bid) };
  }

  /** Quick Buy/Sell at market with the panel quantity and Scalper Mode presets. */
  quick(side: Side): string | null {
    let volume = normalizeLots(this.cfg, this.c.session.quickVolume);
    if (volume <= 0) {
      volume = this.cfg.lotMin;
      this.c.notice('info', `Quantity is 0: using the minimum of ${this.cfg.lotMin} lots`);
    }
    const entry = side === 'buy' ? this.quotes().ask : this.quotes().bid;
    const levels = this.scalperLevels(side, entry, this.c.session.scalper);
    return this.place({ side, type: 'market', volume, ...levels });
  }

  /** SL/TP prices from Scalper Mode distances (pips, ticks or % of the entry). */
  scalperLevels(side: Side, entry: number, s: ScalperSettings) {
    if (!s.enabled) return { sl: null, tp: null, autoBE: null };
    const unit =
      s.unit === 'pips' ? this.cfg.pipSize : s.unit === 'ticks' ? this.cfg.tickSize : entry / 100;
    const d = dir(side);
    const at = (dist: number | null, sign: number) =>
      dist === null || !(dist > 0) ? null : roundPrice(this.cfg, entry + sign * d * dist * unit);
    const sl = at(s.sl, -1);
    return { sl, tp: at(s.tp, 1), autoBE: sl === null ? null : s.autoBE };
  }

  place(t: OrderTicket): string | null {
    const id = this.c.newId();
    if (t.type === 'market')
      return this.c.act({
        type: 'market',
        id,
        side: t.side,
        volume: t.volume,
        sl: t.sl,
        tp: t.tp,
        autoBE: t.autoBE ?? null,
      });
    return this.c.act({
      type: 'pending',
      id,
      side: t.side,
      kind: t.type,
      price: t.price ?? NaN,
      volume: t.volume,
      sl: t.sl,
      tp: t.tp,
      autoBE: t.autoBE ?? null,
    });
  }

  close(id: string, volume?: number): string | null {
    return this.c.act(volume === undefined ? { type: 'close', id } : { type: 'close', id, volume });
  }

  cancel(id: string): string | null {
    return this.c.act({ type: 'cancel-order', id });
  }

  breakEven(id: string): string | null {
    return this.c.act({ type: 'break-even', id });
  }

  closeAll(): string | null {
    return this.c.act({ type: 'close-all' });
  }

  cancelAll(): string | null {
    return this.c.act({ type: 'cancel-all' });
  }

  modifyPosition(
    id: string,
    patch: { sl?: number | null; tp?: number | null; autoBE?: AutoBreakEven | null },
  ) {
    return this.c.act({ type: 'modify-position', id, ...patch });
  }

  modifyOrder(
    id: string,
    patch: { price?: number; volume?: number; sl?: number | null; tp?: number | null },
  ) {
    return this.c.act({ type: 'modify-order', id, ...patch });
  }

  /** A trade line was dragged (or its ✕ pressed: price null). */
  commitLine(line: Pick<TradeLine, 'owner' | 'ownerId' | 'kind'>, price: number | null): void {
    const { owner, ownerId, kind } = line;
    if (owner === 'position') {
      if (kind === 'sl') this.modifyPosition(ownerId, { sl: price });
      if (kind === 'tp') this.modifyPosition(ownerId, { tp: price });
      return;
    }
    const o = this.c.account.orders.find((q) => q.id === ownerId);
    if (!o) return;
    if (kind === 'order' && price !== null) {
      const delta = price - o.price;
      if (Math.abs(delta) < 1e-9) return;
      this.modifyOrder(ownerId, {
        price,
        sl: o.sl === null ? null : roundPrice(this.cfg, o.sl + delta),
        tp: o.tp === null ? null : roundPrice(this.cfg, o.tp + delta),
      });
    }
    if (kind === 'sl') this.modifyOrder(ownerId, { sl: price });
    if (kind === 'tp') this.modifyOrder(ownerId, { tp: price });
  }

  /** Right-click orders at `price`: limits on the favourable side, stops on the other. */
  rightClickOrders(price: number): RightClickOrder[] {
    const p = roundPrice(this.cfg, price);
    const { bid, ask: a } = this.quotes();
    const out: RightClickOrder[] = [];
    if (p < a) out.push({ label: 'Buy Limit', side: 'buy', kind: 'limit', price: p });
    if (p > a) out.push({ label: 'Buy Stop', side: 'buy', kind: 'stop', price: p });
    if (p > bid) out.push({ label: 'Sell Limit', side: 'sell', kind: 'limit', price: p });
    if (p < bid) out.push({ label: 'Sell Stop', side: 'sell', kind: 'stop', price: p });
    return out;
  }

  /** Lots for a risk in money with a stop `stopDistance` away. */
  lotsForRisk(riskMoney: number, stopDistance: number): number {
    return lotsForRisk(this.cfg, riskMoney, stopDistance);
  }
}
