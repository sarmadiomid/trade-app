import { DAY_MS, type Candle } from '@/lib/core';
import { applyAction } from './actions';
import { EPS, ask, commission, dir, equity, exitPrice, normalizeLots, pnl, round2 } from './math';
import type {
  AccountConfig,
  AccountState,
  ActionResult,
  ExecEvent,
  ExitReason,
  PendingOrder,
  Position,
  TradeAction,
  Trade,
} from './types';

interface Trigger {
  /** Bid level at which it fires. */
  readonly level: number;
  /** True when it fires as the Bid rises through `level`. */
  readonly up: boolean;
  /** Tie-break at equal levels: lower first (exits before break-even before entries). */
  readonly rank: number;
  fire(fillBid: number, gap: boolean, time: number): void;
}

const MINUTE_MS = 60_000;
const MAX_TRIGGERS_PER_SEGMENT = 10_000;

/**
 * The simulated broker: fills orders, triggers SL/TP, keeps balance and equity. Pure and
 * deterministic — it only ever sees the 1-minute bars it is given, in order, and the actions
 * applied between them. Mutates its plain-data state in place for speed; `state` can be cloned
 * (structuredClone) for snapshots.
 */
export class ExecutionEngine {
  private events: ExecEvent[] = [];

  constructor(
    readonly cfg: AccountConfig,
    readonly state: AccountState,
  ) {}

  /** A fresh account at replay time `time` with the market at `bid`. */
  static initialState(cfg: AccountConfig, time: number, bid: number): AccountState {
    return {
      balance: cfg.startingBalance,
      positions: [],
      orders: [],
      trades: [],
      time,
      bid,
      status: 'active',
      day: Math.floor(time / DAY_MS) * DAY_MS,
      dayStartBalance: cfg.startingBalance,
      targetReachedAt: null,
      failReason: null,
    };
  }

  get equity(): number {
    return equity(this.cfg, this.state);
  }

  get ask(): number {
    return ask(this.cfg, this.state.bid);
  }

  /** Applies a trader action at the current replay time and price. */
  apply(action: TradeAction): ActionResult {
    if (this.state.status !== 'active') return { ok: false, error: 'This session has ended' };
    this.events = [];
    const error = applyAction(this, action);
    if (error) return { ok: false, error };
    this.checkFloorNow(this.state.time);
    return { ok: true, events: this.flush() };
  }

  /** Processes the next 1-minute bar (Bid prices). */
  processBar(bar: Candle): readonly ExecEvent[] {
    const s = this.state;
    if (s.status !== 'active') return [];
    this.events = [];
    const day = Math.floor(bar.time / DAY_MS) * DAY_MS;
    if (day !== s.day) {
      s.day = day;
      s.dayStartBalance = s.balance;
    }
    if (s.positions.length > 0 || s.orders.length > 0) {
      const bullish = bar.close >= bar.open;
      const path = bullish
        ? [bar.open, bar.low, bar.high, bar.close]
        : [bar.open, bar.high, bar.low, bar.close];
      this.walk(s.bid, path[0]!, true, bar.time);
      for (let i = 1; i < path.length && s.status === 'active'; i++)
        this.walk(path[i - 1]!, path[i]!, false, bar.time);
    }
    s.bid = bar.close;
    s.time = bar.time + MINUTE_MS;
    return this.flush();
  }

  /** Session end: closes everything at the last price and stops the account. */
  endSession(reason: ExitReason = 'session-end', status: AccountState['status'] = 'ended') {
    const s = this.state;
    if (s.status !== 'active') return [];
    this.events = [];
    this.liquidate(s.bid, s.time, reason);
    s.status = status;
    this.events.push({ type: 'stopped', status, reason: 'Session end' });
    return this.flush();
  }

  // ---- used by actions.ts ------------------------------------------------------------------

  emit(e: ExecEvent): void {
    this.events.push(e);
  }

  openPosition(
    o: Pick<PendingOrder, 'id' | 'side' | 'volume' | 'sl' | 'tp' | 'autoBE'>,
    price: number,
    time: number,
    kind: Position['entryKind'],
  ): Position {
    const c = commission(this.cfg, o.volume);
    const p: Position = {
      id: o.id,
      side: o.side,
      entryKind: kind,
      entryPrice: price,
      entryTime: time,
      initialVolume: o.volume,
      volume: o.volume,
      sl: o.sl,
      tp: o.tp,
      initialSl: o.sl,
      initialTp: o.tp,
      autoBE: o.autoBE,
      breakEven: false,
      commission: c,
      exits: [],
      worstPrice: price,
      bestPrice: price,
    };
    this.state.balance = round2(this.state.balance - c);
    this.state.positions.push(p);
    this.events.push({ type: 'filled', position: p, from: kind });
    return p;
  }

  exitPosition(p: Position, volume: number, price: number, time: number, reason: ExitReason) {
    const s = this.state;
    const v = Math.min(volume, p.volume);
    const gross = pnl(this.cfg, p.side, p.entryPrice, price, v);
    const c = commission(this.cfg, v);
    s.balance = round2(s.balance + gross - c);
    p.commission = round2(p.commission + c);
    p.volume = normalizeLots(this.cfg, p.volume - v + EPS);
    const ex = { time, price, volume: v, pnl: gross, commission: c, reason };
    p.exits.push(ex);
    let closed: Trade | null = null;
    if (p.volume <= EPS) {
      s.positions = s.positions.filter((q) => q !== p);
      closed = toTrade(p);
      s.trades.push(closed);
    }
    this.events.push({ type: 'exit', positionId: p.id, exit: ex, closed });
    this.checkTarget(time);
  }

  // ---- intrabar walk -------------------------------------------------------------------------

  /** Moves the Bid from `from` to `to`, firing every trigger crossed, in crossing order. */
  private walk(from: number, to: number, gap: boolean, time: number): void {
    const s = this.state;
    if (Math.abs(to - from) < EPS) {
      this.touch(to);
      return;
    }
    const up = to > from;
    let cur = from;
    for (let n = 0; n < MAX_TRIGGERS_PER_SEGMENT && s.status === 'active'; n++) {
      let best: Trigger | null = null;
      for (const t of this.triggers()) {
        if (t.up !== up) continue;
        const inRange = up
          ? t.level > cur + EPS && t.level <= to + EPS
          : t.level < cur - EPS && t.level >= to - EPS;
        if (!inRange) continue;
        if (
          !best ||
          (up ? t.level < best.level - EPS : t.level > best.level + EPS) ||
          (Math.abs(t.level - best.level) <= EPS && t.rank < best.rank)
        )
          best = t;
      }
      if (!best) break;
      this.touch(best.level);
      best.fire(gap ? to : best.level, gap, time);
      cur = best.level;
    }
    this.touch(to);
  }

  /** Updates MAE / MFE of the open positions with the Bid at `bid`. */
  private touch(bid: number): void {
    for (const p of this.state.positions) {
      const px = exitPrice(this.cfg, p.side, bid);
      const d = dir(p.side);
      if (d * (px - p.worstPrice) < 0) p.worstPrice = px;
      if (d * (px - p.bestPrice) > 0) p.bestPrice = px;
    }
  }

  private triggers(): Trigger[] {
    const { cfg, state: s } = this;
    const sp = cfg.spread;
    const out: Trigger[] = [];
    for (const o of s.orders) {
      const buy = o.side === 'buy';
      // Buy orders trigger on the Ask (= Bid + spread), sell orders on the Bid.
      const level = buy ? o.price - sp : o.price;
      const up = (o.kind === 'stop') === buy;
      out.push({
        level,
        up,
        rank: 3,
        fire: (fillBid, gap, time) => {
          s.orders = s.orders.filter((q) => q !== o);
          const price = gap ? (buy ? ask(cfg, fillBid) : fillBid) : o.price;
          this.openPosition(o, price, time, o.kind);
        },
      });
    }
    for (const p of s.positions) {
      const buy = p.side === 'buy';
      const shift = buy ? 0 : sp;
      const exitAt = (fillBid: number, gap: boolean, level: number) =>
        gap ? exitPrice(cfg, p.side, fillBid) : level;
      if (p.sl !== null) {
        const sl = p.sl;
        out.push({
          level: sl - shift,
          up: !buy,
          rank: 0,
          fire: (b, gap, time) => this.exitPosition(p, p.volume, exitAt(b, gap, sl), time, 'sl'),
        });
      }
      if (p.tp !== null) {
        const tp = p.tp;
        out.push({
          level: tp - shift,
          up: buy,
          rank: 1,
          fire: (b, gap, time) => this.exitPosition(p, p.volume, exitAt(b, gap, tp), time, 'tp'),
        });
      }
      const be = this.breakEvenLevel(p);
      if (be !== null) {
        out.push({
          level: be - shift,
          up: buy,
          rank: 2,
          fire: () => {
            p.sl = p.entryPrice;
            p.breakEven = true;
            this.events.push({ type: 'break-even', positionId: p.id });
          },
        });
      }
    }
    const floor = this.equityFloor();
    if (floor) out.push(floor);
    return out;
  }

  private breakEvenLevel(p: Position): number | null {
    if (!p.autoBE || p.breakEven || p.sl === null) return null;
    const d = dir(p.side);
    if (d * (p.sl - p.entryPrice) >= -EPS) return null; // already at or beyond entry
    const dist =
      p.autoBE.mode === 'pips'
        ? p.autoBE.value * this.cfg.pipSize
        : p.initialSl === null
          ? null
          : p.autoBE.value * Math.abs(p.entryPrice - p.initialSl);
    return dist === null ? null : p.entryPrice + d * dist;
  }

  // ---- account floors (stop out, prop rules) -------------------------------------------------

  /** The highest equity level that stops the account, with its consequence. */
  private floorLevel(): { value: number; status: 'stopped-out' | 'failed'; reason: string } {
    const { cfg, state: s } = this;
    let f = { value: 0, status: 'stopped-out' as 'stopped-out' | 'failed', reason: 'Stop out' };
    const r = cfg.propRules;
    if (r) {
      const total = cfg.startingBalance * (1 - r.maxTotalLossPct / 100);
      const daily = s.dayStartBalance - (cfg.startingBalance * r.maxDailyLossPct) / 100;
      if (total > f.value)
        f = { value: total, status: 'failed', reason: `Max total loss (${r.maxTotalLossPct}%)` };
      if (daily > f.value)
        f = { value: daily, status: 'failed', reason: `Max daily loss (${r.maxDailyLossPct}%)` };
    }
    return f;
  }

  /** Equity is linear in the Bid; solve for the Bid at which it reaches the floor. */
  private equityFloor(): Trigger | null {
    const { cfg, state: s } = this;
    if (s.positions.length === 0) return null;
    let m = 0;
    let k = s.balance;
    for (const p of s.positions) {
      const q = dir(p.side) * p.volume * cfg.contractSize;
      m += q;
      k += q * ((p.side === 'sell' ? cfg.spread : 0) - p.entryPrice);
    }
    if (Math.abs(m) < EPS) return null;
    const floor = this.floorLevel();
    return {
      level: (floor.value - k) / m,
      up: m < 0,
      rank: -1,
      fire: (fillBid, _gap, time) => this.breach(fillBid, time, floor),
    };
  }

  private checkFloorNow(time: number): void {
    const floor = this.floorLevel();
    if (this.state.positions.length > 0 && this.equity <= floor.value + EPS)
      this.breach(this.state.bid, time, floor);
  }

  private breach(bid: number, time: number, floor: ReturnType<ExecutionEngine['floorLevel']>) {
    const reason: ExitReason = floor.status === 'failed' ? 'rule-breach' : 'stop-out';
    this.liquidate(bid, time, reason);
    this.state.status = floor.status;
    this.state.failReason = floor.reason;
    this.events.push({ type: 'stopped', status: floor.status, reason: floor.reason });
  }

  private liquidate(bid: number, time: number, reason: ExitReason): void {
    const s = this.state;
    for (const p of [...s.positions])
      this.exitPosition(p, p.volume, exitPrice(this.cfg, p.side, bid), time, reason);
    for (const o of s.orders) this.events.push({ type: 'cancelled', id: o.id });
    s.orders = [];
  }

  private checkTarget(time: number): void {
    const { cfg, state: s } = this;
    const r = cfg.propRules;
    if (!r || s.targetReachedAt !== null || s.positions.length > 0) return;
    if (s.balance >= cfg.startingBalance * (1 + r.profitTargetPct / 100) - EPS) {
      s.targetReachedAt = time;
      this.events.push({ type: 'target-reached' });
    }
  }

  private flush(): ExecEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

export function toTrade(p: Position): Trade {
  const vol = p.exits.reduce((a, e) => a + e.volume, 0);
  const gross = round2(p.exits.reduce((a, e) => a + e.pnl, 0));
  const last = p.exits[p.exits.length - 1]!;
  return {
    ...p,
    exits: [...p.exits],
    volume: 0,
    closeTime: last.time,
    closePrice: vol > 0 ? p.exits.reduce((a, e) => a + e.price * e.volume, 0) / vol : last.price,
    grossPnl: gross,
    netPnl: round2(gross - p.commission),
    closeReason: last.reason,
  };
}
