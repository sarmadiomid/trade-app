import type { ChartApp } from '@/lib/app';
import {
  ExecutionEngine,
  TradeOverlay,
  ask,
  equity,
  floatingPnl,
  normalizeLots,
  round2,
  type AccountConfig,
  type Side,
  type TradeLine,
} from '@/lib/backtest';
import type { Candle, InstrumentSpec } from '@/lib/core';
import { instrumentSpec } from '@/lib/data';

const EPS = 1e-9;

export interface DemoPositionView {
  readonly id: string;
  readonly side: Side;
  readonly volume: number;
  readonly entry: number;
  readonly pnl: number;
}

export interface DemoView {
  readonly bid: number | null;
  readonly ask: number | null;
  readonly balance: number;
  readonly equity: number;
  readonly floating: number;
  readonly volume: number;
  readonly lotStep: number;
  readonly lotMin: number;
  readonly positions: readonly DemoPositionView[];
  readonly error: string | null;
  readonly ready: boolean;
}

interface SeenBar {
  time: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Price points the market printed since the previous chart update. A new bar contributes its
 * whole OHLC path. An update of the forming bar contributes only the new high, new low, and
 * close, so a wick that printed before the click cannot stop out the position.
 */
export function movePath(prev: SeenBar, bar: Candle): number[] {
  if (bar.time !== prev.time) {
    const up = bar.close >= bar.open;
    const path = up
      ? [bar.open, bar.low, bar.high, bar.close]
      : [bar.open, bar.high, bar.low, bar.close];
    return path.filter((p, i) => i === 0 || Math.abs(p - path[i - 1]!) > EPS);
  }
  const pts: number[] = [];
  const highUp = bar.high > prev.high + EPS;
  const lowDown = bar.low < prev.low - EPS;
  const up = bar.close >= prev.close;
  if (up) {
    if (lowDown) pts.push(bar.low);
    if (highUp) pts.push(bar.high);
  } else {
    if (highUp) pts.push(bar.high);
    if (lowDown) pts.push(bar.low);
  }
  if (pts.length === 0 || Math.abs(pts[pts.length - 1]! - bar.close) > EPS) pts.push(bar.close);
  return pts;
}

/** Nearest stop or target crossed while price moves from `from` to `to`. */
export function levelCross(
  from: number,
  to: number,
  levels: ReadonlyArray<{ kind: 'sl' | 'tp'; price: number }>,
): { kind: 'sl' | 'tp'; price: number } | null {
  if (!(Math.abs(to - from) > EPS)) return null;
  const up = to > from;
  let best: { kind: 'sl' | 'tp'; price: number } | null = null;
  for (const lv of levels) {
    const hit = up
      ? lv.price > from + EPS && lv.price <= to + EPS
      : lv.price < from - EPS && lv.price >= to - EPS;
    if (!hit) continue;
    if (!best || (up ? lv.price < best.price : lv.price > best.price)) best = lv;
  }
  return best;
}

function configFor(spec: InstrumentSpec): AccountConfig {
  return {
    contractSize: spec.contractSize,
    tickSize: spec.tickSize,
    pipSize: spec.pipSize,
    lotMin: spec.lotMin,
    lotStep: spec.lotStep,
    lotMax: spec.lotMax,
    spread: spec.defaultSpread,
    commissionPerLot: spec.defaultCommissionPerLot,
    startingBalance: 10_000,
    propRules: null,
  };
}

/**
 * In-memory practice account for the landing chart. Buy and sell open a market position at
 * the latest replay price; the position is drawn by {@link DemoBroker} and marked to the
 * forming candle as the replay plays.
 */
export class DemoAccount {
  readonly cfg: AccountConfig;
  readonly engine: ExecutionEngine;
  readonly precision: number;
  private volume: number;
  private error: string | null = null;
  private seen: SeenBar | null = null;
  private seq = 0;
  private view: DemoView;
  private readonly listeners = new Set<() => void>();

  constructor(spec: InstrumentSpec) {
    this.cfg = configFor(spec);
    this.precision = spec.pricePrecision;
    this.volume = Math.max(spec.lotMin, 0.1);
    this.engine = new ExecutionEngine(this.cfg, ExecutionEngine.initialState(this.cfg, 0, 0));
    this.view = this.build();
  }

  get snapshot(): DemoView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.min(this.cfg.lotMax, Math.max(0, volume));
    this.publish();
  }

  /** Latest chart bar, including the candle that is still forming. */
  onBar(bar: Candle): void {
    if (
      this.seen &&
      bar.time === this.seen.time &&
      bar.high === this.seen.high &&
      bar.low === this.seen.low &&
      bar.close === this.seen.close
    ) {
      return;
    }
    if (this.seen && this.engine.state.positions.length > 0) {
      let from = this.seen.close;
      for (const to of movePath(this.seen, bar)) {
        this.fire(from, to, bar.time);
        from = to;
      }
    }
    this.seen = { time: bar.time, high: bar.high, low: bar.low, close: bar.close };
    this.engine.state.bid = bar.close;
    this.engine.state.time = bar.time;
    this.publish();
  }

  /** Opens a market position. Returns an error message, or null. */
  market(side: Side): string | null {
    if (!this.seen) return this.fail('قیمت هنوز آماده نیست');
    const volume = normalizeLots(this.cfg, this.volume);
    if (volume <= 0) return this.fail(`حجم حداقل ${this.cfg.lotMin} لات است`);
    this.engine.state.bid = this.seen.close;
    this.engine.state.time = this.seen.time;
    const id = `demo-${++this.seq}`;
    const res = this.engine.apply({ type: 'market', id, side, volume, sl: null, tp: null });
    if (!res.ok) return this.fail(res.error);
    this.error = null;
    this.publish();
    return null;
  }

  close(id: string): string | null {
    const res = this.engine.apply({ type: 'close', id });
    if (!res.ok) return this.fail(res.error);
    this.error = null;
    this.publish();
    return null;
  }

  /** A chart line was dragged, or its ✕ removed the level (`price` null). */
  commit(line: Pick<TradeLine, 'owner' | 'ownerId' | 'kind'>, price: number | null): void {
    const { owner, ownerId, kind } = line;
    if (owner === 'position') {
      if (kind !== 'sl' && kind !== 'tp') return;
      const patch = kind === 'sl' ? { sl: price } : { tp: price };
      const res = this.engine.apply({ type: 'modify-position', id: ownerId, ...patch });
      this.error = res.ok ? null : res.error;
      this.publish();
      return;
    }
    if (kind === 'order' && price !== null) {
      const res = this.engine.apply({ type: 'modify-order', id: ownerId, price });
      this.error = res.ok ? null : res.error;
    } else if (kind === 'sl' || kind === 'tp') {
      const patch = kind === 'sl' ? { sl: price } : { tp: price };
      const res = this.engine.apply({ type: 'modify-order', id: ownerId, ...patch });
      this.error = res.ok ? null : res.error;
    } else return;
    this.publish();
  }

  closeLine(line: Pick<TradeLine, 'owner' | 'ownerId'>): void {
    if (line.owner === 'position') this.close(line.ownerId);
    else {
      const res = this.engine.apply({ type: 'cancel-order', id: line.ownerId });
      this.error = res.ok ? null : res.error;
      this.publish();
    }
  }

  private fire(from: number, to: number, time: number): void {
    for (const p of [...this.engine.state.positions]) {
      const levels: Array<{ kind: 'sl' | 'tp'; price: number }> = [];
      if (p.sl !== null) levels.push({ kind: 'sl', price: p.sl });
      if (p.tp !== null) levels.push({ kind: 'tp', price: p.tp });
      const hit = levelCross(from, to, levels);
      if (hit) this.engine.exitPosition(p, p.volume, hit.price, time, hit.kind);
    }
  }

  private fail(error: string): string {
    this.error = error;
    this.publish();
    return error;
  }

  private publish(): void {
    this.view = this.build();
    for (const listener of this.listeners) listener();
  }

  private build(): DemoView {
    const s = this.engine.state;
    const ready = this.seen !== null && s.bid > 0;
    let floating = 0;
    const positions: DemoPositionView[] = [];
    for (const p of s.positions) {
      const pnl = floatingPnl(this.cfg, p, s.bid);
      floating += pnl;
      positions.push({ id: p.id, side: p.side, volume: p.volume, entry: p.entryPrice, pnl });
    }
    return {
      bid: ready ? s.bid : null,
      ask: ready ? ask(this.cfg, s.bid) : null,
      balance: s.balance,
      equity: ready ? equity(this.cfg, s) : s.balance,
      floating: round2(floating),
      volume: this.volume,
      lotStep: this.cfg.lotStep,
      lotMin: this.cfg.lotMin,
      positions,
      error: this.error,
      ready,
    };
  }
}

/** Attaches a {@link DemoAccount} to the landing chart and draws its open positions. */
export class DemoBroker {
  readonly account: DemoAccount;
  private readonly detach: () => void;
  private readonly offData: () => void;
  private readonly offAccount: () => void;

  constructor(app: ChartApp, symbol: string) {
    const spec = instrumentSpec(symbol);
    if (!spec) throw new Error(`Unknown symbol ${symbol}`);
    this.account = new DemoAccount(spec);
    const overlay = new TradeOverlay(app.engine, {
      cfg: this.account.cfg,
      account: () => this.account.engine.state,
      floating: (p) => floatingPnl(this.account.cfg, p, this.account.engine.state.bid),
      precision: () => this.account.precision,
      sessionStart: () => null,
      commit: (line, price) => this.account.commit(line, price),
      close: (line) => this.account.closeLine(line),
    });
    this.detach = overlay.attach();
    this.offAccount = this.account.subscribe(() => overlay.invalidate());
    const pull = () => {
      const data = app.engine.seriesData;
      const bar = data.length > 0 ? data.bar(data.lastIndex) : null;
      if (bar) this.account.onBar(bar);
    };
    this.offData = app.engine.events.on('data:changed', pull);
    pull();
  }

  destroy(): void {
    this.offData();
    this.offAccount();
    this.detach();
  }
}
