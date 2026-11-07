import type { Candle } from '@/lib/core';
import {
  ExecutionEngine,
  dir,
  entryPrice,
  equity,
  exitPrice,
  normalizeLots,
  type AccountConfig,
  type LoggedAction,
  type Position,
  type Side,
  type TradeAction,
} from '@/lib/backtest';
import { Indicators } from './indicators';
import type { Persona } from './persona';
import { botRng, clamp, type BotRng } from './rng';

/** The parts of a battle's rules a trader plays around. */
export interface BattleRules {
  readonly winCondition: 'time-trial' | 'profit-target';
  readonly profitTargetPct: number | null;
  readonly maxDrawdownPct: number | null;
  readonly maxDailyDrawdownPct: number | null;
}

export interface PlanInput {
  readonly cfg: AccountConfig;
  readonly rules: BattleRules;
  /** Minutes before `startT` (what the trader's chart already shows). */
  readonly history: readonly Candle[];
  /** The battle's minutes from `startT` up to the end (exactly what the server re-simulates). */
  readonly bars: readonly Candle[];
  readonly startT: number;
  readonly startBid: number;
  /** Market time the battle ends at. */
  readonly end: number;
  readonly persona: Persona;
  readonly seed: number;
  /** Hard cap on logged actions (the server's MAX_ACTIONS). */
  readonly maxActions?: number;
}

/** Things a trader might say something about, at the market time they happened. */
export type PlanEventKind = 'stopped' | 'bigwin' | 'dq' | 'leave' | 'target' | 'entry';

export interface PlanEvent {
  readonly t: number;
  readonly kind: PlanEventKind;
}

export interface BotPlan {
  /** The trader's actions, each accepted by the broker at its market time. */
  readonly actions: readonly LoggedAction[];
  /** Market time the trader leaves the battle at (forfeit), or null. */
  readonly leaveT: number | null;
  readonly events: readonly PlanEvent[];
}

const MINUTE_MS = 60_000;

/** Lot sizes people actually type. */
const NICE_LOTS = [
  0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.2, 1.5, 2,
  2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 500,
];
/** Stop distances (in pips) people actually use. */
const NICE_PIPS = [
  2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100, 120, 150, 200, 250, 300,
  400, 500, 600, 800, 1000,
];

export function humanLots(cfg: AccountConfig, lots: number, exact: boolean): number {
  if (!(lots > 0)) return 0;
  if (exact) return normalizeLots(cfg, lots);
  let best = 0;
  for (const v of NICE_LOTS) if (v <= lots * 1.12 && v >= cfg.lotMin - 1e-9) best = v;
  return normalizeLots(cfg, best || cfg.lotMin);
}

export function humanStop(cfg: AccountConfig, distance: number, exact: boolean): number {
  if (exact) return distance;
  const pips = distance / cfg.pipSize;
  let best = NICE_PIPS[0]!;
  for (const p of NICE_PIPS) if (Math.abs(p - pips) < Math.abs(best - pips)) best = p;
  return best * cfg.pipSize;
}

interface PosMeta {
  readonly entryIdx: number;
  /** Price distance of 1R (the initial stop, or the distance the trader had in mind). */
  readonly risk: number;
  /** Losing distance (in R) at which a trader without a stop gives up. */
  readonly mental: number;
  readonly noTp: boolean;
  beTried: boolean;
  partialTried: boolean;
  widenTried: boolean;
}

interface OrderMeta {
  readonly placedIdx: number;
  readonly expire: number;
  readonly risk: number;
}

/**
 * Plays one trader through a battle on the real broker. Each minute it only sees candles that
 * have closed before that minute (the replay cursor), decides like the persona would, and
 * sends ordinary trade actions that the engine must accept. The resulting log re-simulates to
 * exactly the same account on the server (`resimulate`).
 */
export function planBot(input: PlanInput): BotPlan {
  return new Brain(input).run();
}

class Brain {
  private readonly r: BotRng;
  private readonly p: Persona;
  private readonly cfg: AccountConfig;
  private readonly engine: ExecutionEngine;
  private readonly ind: Indicators;
  private readonly log: LoggedAction[] = [];
  private readonly events: PlanEvent[] = [];
  private readonly pos = new Map<string, PosMeta>();
  private readonly ord = new Map<string, OrderMeta>();
  private readonly start: number;
  private readonly span: number;
  private readonly maxActions: number;

  private i = 0;
  private t = 0;
  private nextId = 1;
  private seenTrades = 0;
  private tilt = 0;
  private wins = 0;
  private losses = 0;
  private lastEntry = -1e9;
  private quiet = false;
  private afkUntil = -1;
  private quitDecided = false;
  private leaveAt: number | null = null;
  private leaveT: number | null = null;
  private lockDone = false;
  private swingDone = false;
  private flattenDone = false;
  private targetSaid = false;
  private pending: { side: Side; due: number; force: number } | null = null;
  private avgRisk = 0;

  constructor(private readonly input: PlanInput) {
    this.r = botRng(input.seed);
    this.p = input.persona;
    this.cfg = input.cfg;
    this.engine = new ExecutionEngine(
      input.cfg,
      ExecutionEngine.initialState(input.cfg, input.startT, input.startBid),
    );
    this.ind = new Indicators(this.p.tf);
    for (const b of input.history) this.ind.push(b);
    this.start = input.cfg.startingBalance;
    this.span = Math.max(MINUTE_MS, input.end - input.startT);
    this.maxActions = (input.maxActions ?? 2000) - 8;
  }

  run(): BotPlan {
    const { bars } = this.input;
    const s = this.engine.state;
    for (this.i = 0; this.i < bars.length; this.i++) {
      const bar = bars[this.i]!;
      if (bar.time >= this.input.end) break;
      this.t = bar.time;
      if (s.status === 'active') {
        // Mirrors resimulate: an action takes the replay time it was logged at.
        s.time = Math.max(s.time, this.t);
        this.step();
        if (this.leaveT !== null) break;
      }
      this.engine.processBar(bar);
      this.ind.push(bar);
      if (s.status !== 'active') {
        this.digestTrades();
        this.events.push({ t: bar.time + MINUTE_MS, kind: 'dq' });
        break;
      }
    }
    return { actions: this.log, leaveT: this.leaveT, events: this.events };
  }

  // ---- one minute -----------------------------------------------------------------------------

  private step(): void {
    this.tilt *= 0.993;
    this.digestTrades();
    if (this.leaveAt !== null && this.i >= this.leaveAt) {
      this.leaveT = this.t;
      this.events.push({ t: this.t, kind: 'leave' });
      return;
    }
    if (!this.ind.ready) return;
    if (this.afkUntil > this.i) return;
    if (this.r.chance(this.p.afkRate)) {
      this.afkUntil = this.i + this.r.int(3, 25);
      return;
    }
    const st = this.engine.state;
    const eq = equity(this.cfg, st);
    const ret = ((eq - this.start) / this.start) * 100;
    const left = (this.input.end - this.t) / this.span;

    this.checkQuit(eq);
    if (this.leaveAt !== null) return;
    if (this.profitTarget(eq)) return;
    this.lateGame(ret, left);

    if (this.r.chance(this.p.attention)) {
      for (const p of [...st.positions]) this.manage(p);
      this.manageOrders();
    }
    if (this.quiet || this.log.length >= this.maxActions) return;
    if (this.input.rules.winCondition === 'time-trial' && left < 0.025) return;

    if (this.pending && this.i >= this.pending.due) {
      const { side, force } = this.pending;
      this.pending = null;
      this.enter(side, force);
      return;
    }
    if (this.pending) return;
    const signal = this.signal() ?? this.boredom();
    if (!signal) return;
    const cooldown = this.p.cooldown * (1 - 0.7 * this.tilt);
    if (this.i - this.lastEntry < cooldown) return;
    const select = this.p.selectivity + (1 - this.p.selectivity) * this.tilt * 0.6;
    if (!this.r.chance(select)) return;
    // An open trade the other way: trend traders flip, others wait.
    const opposite = st.positions.filter((q) => q.side !== signal);
    if (opposite.length > 0) {
      if (this.p.style !== 'trend' && this.p.style !== 'swing' && this.p.style !== 'scalper')
        return;
      for (const q of opposite) this.act({ type: 'close', id: q.id });
    }
    if (st.positions.length + st.orders.length >= this.p.maxOpen) return;
    const [lo, hi] = this.p.reaction;
    const delay = this.r.int(lo, hi);
    if (delay === 0) this.enter(signal, 1);
    else this.pending = { side: signal, due: this.i + delay, force: 1 };
  }

  /** Reacts to trades that closed since the last minute (tilt, confidence, chat). */
  private digestTrades(): void {
    const trades = this.engine.state.trades;
    for (; this.seenTrades < trades.length; this.seenTrades++) {
      const tr = trades[this.seenTrades]!;
      const meta = this.pos.get(tr.id);
      this.pos.delete(tr.id);
      const riskMoney =
        meta && meta.risk > 0
          ? meta.risk * tr.initialVolume * this.cfg.contractSize
          : Math.max(1, this.avgRisk);
      const r = tr.netPnl / Math.max(1, riskMoney);
      if (tr.netPnl < 0) {
        this.losses += 1;
        this.wins = 0;
        this.tilt = Math.min(1, this.tilt + this.p.tiltGain * (0.25 + 0.35 * Math.min(2, -r)));
        if (tr.closeReason === 'sl' && r <= -0.6) {
          this.events.push({ t: this.t, kind: 'stopped' });
          // Revenge: straight back in.
          if (!this.quiet && this.r.chance(this.tilt * 0.45))
            this.pending = {
              side: this.r.chance(0.6) ? tr.side : tr.side === 'buy' ? 'sell' : 'buy',
              due: this.i + this.r.int(0, 2),
              force: 1 + this.tilt,
            };
        }
        if (this.losses >= 3 && this.r.chance(0.35 * this.p.skill)) this.quiet = true;
      } else {
        this.wins += 1;
        this.losses = 0;
        this.tilt *= 0.6;
        if (r >= 1.5) this.events.push({ t: this.t, kind: 'bigwin' });
        const ret = ((this.engine.state.balance - this.start) / this.start) * 100;
        if (
          this.input.rules.winCondition === 'time-trial' &&
          ret >= this.p.protectAtPct &&
          this.r.chance(0.35)
        )
          this.quiet = true;
      }
    }
  }

  private checkQuit(eq: number): void {
    if (this.quitDecided) return;
    const dd = ((this.start - eq) / this.start) * 100;
    if (dd < this.p.quitAtPct) return;
    this.quitDecided = true;
    if (this.r.chance(this.p.quitChance)) this.leaveAt = this.i + this.r.int(0, 6);
  }

  /** Profit Target: realise the target once open profit covers it. */
  private profitTarget(eq: number): boolean {
    const pt = this.input.rules.profitTargetPct;
    if (this.input.rules.winCondition !== 'profit-target' || pt === null) return false;
    const st = this.engine.state;
    if (st.targetReachedAt !== null) {
      if (!this.targetSaid) {
        this.targetSaid = true;
        this.events.push({ t: this.t, kind: 'target' });
      }
      return true;
    }
    const target = this.start * (1 + pt / 100);
    if (st.positions.length > 0 && eq >= target + this.start * 0.0002) {
      this.act({ type: 'close-all' });
      return true;
    }
    return false;
  }

  private lateGame(ret: number, left: number): void {
    if (this.input.rules.winCondition !== 'time-trial') return;
    const st = this.engine.state;
    if (left < 0.12 && !this.lockDone) {
      this.lockDone = true;
      if (ret >= Math.max(0.4, this.p.protectAtPct * 0.6) && this.r.chance(0.5)) {
        if (st.positions.length > 0) this.act({ type: 'close-all' });
        this.quiet = true;
        return;
      }
    }
    if (left < 0.12 && !this.swingDone && ret < -0.2 && !this.quiet) {
      this.swingDone = true;
      if (this.r.chance(this.p.catchUp) && st.positions.length === 0) {
        const v = this.ind.view;
        const side: Side = v && v.close >= v.open ? 'buy' : 'sell';
        this.pending = { side, due: this.i + this.r.int(0, 3), force: this.r.range(2, 4) };
      }
    }
    if (left < 0.03 && !this.flattenDone) {
      this.flattenDone = true;
      if (st.positions.length > 0 && this.r.chance(0.3)) this.act({ type: 'close-all' });
    }
  }

  // ---- signals --------------------------------------------------------------------------------

  private signal(): Side | null {
    const v = this.ind.view;
    const m = this.ind.last;
    const atr1 = this.ind.atr1.value ?? 0;
    if (!v || !m || !(atr1 > 0)) return null;
    const fresh = this.p.tf === 1 || this.ind.closedNow;
    switch (this.p.style) {
      case 'trend':
        if (!fresh) return null;
        if (v.close > v.donHigh && v.emaFast > v.emaSlow) return 'buy';
        if (v.close < v.donLow && v.emaFast < v.emaSlow) return 'sell';
        return null;
      case 'swing':
        if (!fresh) return null;
        if (v.prevFast <= v.prevSlow && v.emaFast > v.emaSlow) return 'buy';
        if (v.prevFast >= v.prevSlow && v.emaFast < v.emaSlow) return 'sell';
        return null;
      case 'reversion':
        if (!fresh) return null;
        if (v.rsi < 30 && v.close < v.emaSlow - 0.8 * v.atr) return 'buy';
        if (v.rsi > 70 && v.close > v.emaSlow + 0.8 * v.atr) return 'sell';
        return null;
      case 'scalper': {
        const body = m.close - m.open;
        if (Math.abs(body) < 0.55 * atr1) return null;
        const trend = v.emaFast - v.emaSlow;
        if (body > 0 && trend > 0) return 'buy';
        if (body < 0 && trend < 0) return 'sell';
        return null;
      }
      case 'impulsive': {
        if (m.high - m.low < 2.2 * atr1) return null;
        const up = m.close >= m.open;
        const chase = this.r.chance(0.7);
        return up === chase ? 'buy' : 'sell';
      }
      case 'gut':
      case 'idle': {
        if (!this.r.chance(1 / Math.max(4, this.p.cooldown * 0.5))) return null;
        const momentum = v.close - v.open;
        const follow = this.r.chance(0.6);
        if (Math.abs(momentum) < 1e-12) return this.r.chance(0.5) ? 'buy' : 'sell';
        return momentum > 0 === follow ? 'buy' : 'sell';
      }
    }
  }

  /**
   * Nobody joins a competition to watch: after a long stretch without a trade, most traders take
   * something (direction from the last candles).
   */
  private boredom(): Side | null {
    const st = this.engine.state;
    if (st.positions.length > 0 || st.orders.length > 0) return null;
    const wait = this.p.cooldown * 2.5 + 25;
    if (this.i - Math.max(this.lastEntry, 0) < wait) return null;
    if (!this.r.chance(this.p.style === 'idle' ? 0.004 : 0.03)) return null;
    const v = this.ind.view;
    if (!v) return null;
    return v.close >= v.open === this.r.chance(0.6) ? 'buy' : 'sell';
  }

  // ---- orders ---------------------------------------------------------------------------------

  private enter(side: Side, force: number): void {
    const st = this.engine.state;
    if (st.positions.length + st.orders.length >= Math.max(this.p.maxOpen, 1) && force <= 1) return;
    const v = this.ind.view;
    const atr1 = this.ind.atr1.value ?? 0;
    if (!v || !(atr1 > 0)) return;
    const cfg = this.cfg;
    const exact = this.p.riskCalc;
    const base = this.p.tf === 1 ? atr1 * 1.6 : v.atr;
    let stop = humanStop(cfg, Math.max(base * this.p.stopAtr, atr1 * 2, cfg.spread * 4), exact);
    // Nobody trades a stop tighter than a few pips.
    stop = Math.max(stop, cfg.spread * 3 + cfg.tickSize * 2, cfg.pipSize * 5);

    const eq = equity(cfg, st);
    let mult = (1 + this.tilt * (this.p.gambler ? 2 : 0.9)) * force;
    mult *= 1 + Math.min(3, this.wins) * 0.1; // hot hand
    if (this.input.rules.winCondition === 'profit-target') mult *= 1 + this.p.catchUp * 0.6;
    const riskMoney = st.balance * (this.p.riskPct / 100) * mult;
    let lots = riskMoney / (stop * cfg.contractSize);

    // Drawdown room: careful traders size so a stop never breaks the rules.
    const room = this.ruleRoom(eq);
    if (room !== null && this.r.chance(this.p.ddAware)) {
      if (room < riskMoney * 0.25) {
        this.quiet = this.r.chance(0.6) || this.quiet;
        return;
      }
      lots = Math.min(lots, (room * 0.6) / (stop * cfg.contractSize));
    }
    const lev = this.p.gambler ? 100 : this.p.skill > 0.5 ? 20 : 50;
    const price = st.bid;
    lots = Math.min(lots, (eq * lev) / Math.max(1e-9, price * cfg.contractSize));
    const volume = humanLots(cfg, lots, exact);
    if (volume <= 0) return;

    const useSl = this.r.chance(clamp(this.p.useSl - this.tilt * 0.2, 0.05, 1));
    const useTp = force <= 1.2 && this.r.chance(this.p.useTp);
    const rr = this.p.rr * this.r.range(0.85, 1.2);
    const mental = this.p.gambler ? this.r.range(4, 8) : this.r.range(1.4, 3.2);
    const pendingKind =
      force <= 1 && this.r.chance(this.p.pendingPref)
        ? this.p.style === 'reversion' || this.r.chance(0.5)
          ? 'limit'
          : 'stop'
        : null;

    const id = String(this.nextId++);
    const d = dir(side);
    if (pendingKind) {
      const ask = entryPrice(cfg, 'buy', st.bid);
      const ref = side === 'buy' ? ask : st.bid;
      const off = Math.max(atr1 * this.r.range(0.4, 1.2), cfg.tickSize * 5);
      const at = pendingKind === 'limit' ? ref - d * off : ref + d * off;
      const ok = this.act({
        type: 'pending',
        id,
        side,
        kind: pendingKind,
        price: at,
        volume,
        sl: useSl ? at - d * stop : null,
        tp: useTp ? at + d * stop * rr : null,
      });
      if (ok) {
        this.ord.set(id, { placedIdx: this.i, expire: this.r.int(8, 40), risk: stop });
        this.lastEntry = this.i;
        this.avgRisk = this.avgRisk * 0.7 + riskMoney * 0.3;
      }
      return;
    }
    const ref = entryPrice(cfg, side, st.bid);
    let ok = this.act({
      type: 'market',
      id,
      side,
      volume,
      sl: useSl ? ref - d * stop : null,
      tp: useTp ? ref + d * stop * rr : null,
    });
    // The broker refused the levels (too close to the price): go in without them.
    if (!ok) ok = this.act({ type: 'market', id, side, volume, sl: null, tp: null });
    if (!ok) return;
    this.pos.set(id, {
      entryIdx: this.i,
      risk: stop,
      mental,
      noTp: !useTp,
      beTried: false,
      partialTried: false,
      widenTried: false,
    });
    this.lastEntry = this.i;
    this.avgRisk = this.avgRisk * 0.7 + riskMoney * 0.3;
    this.events.push({ t: this.t, kind: 'entry' });
  }

  /** Money left before the tighter drawdown rule breaks (null without rules). */
  private ruleRoom(eq: number): number | null {
    const { maxDrawdownPct, maxDailyDrawdownPct } = this.input.rules;
    const st = this.engine.state;
    let room: number | null = null;
    if (maxDrawdownPct !== null) room = eq - this.start * (1 - maxDrawdownPct / 100);
    if (maxDailyDrawdownPct !== null) {
      const daily = eq - (st.dayStartBalance - (this.start * maxDailyDrawdownPct) / 100);
      room = room === null ? daily : Math.min(room, daily);
    }
    return room;
  }

  private manage(p: Position): void {
    const cfg = this.cfg;
    let meta = this.pos.get(p.id);
    if (!meta) {
      // A pending order that filled.
      const o = this.ord.get(p.id);
      this.ord.delete(p.id);
      meta = {
        entryIdx: this.i,
        risk: o?.risk ?? Math.abs(p.entryPrice - (p.sl ?? p.entryPrice)),
        mental: this.r.range(1.4, 3),
        noTp: p.tp === null,
        beTried: false,
        partialTried: false,
        widenTried: false,
      };
      this.pos.set(p.id, meta);
    }
    const risk = meta.risk > 0 ? meta.risk : Math.max(cfg.tickSize * 10, this.ind.atr1.value ?? 0);
    const px = exitPrice(cfg, p.side, this.engine.state.bid);
    const prog = (dir(p.side) * (px - p.entryPrice)) / risk;
    const held = this.i - meta.entryIdx;

    if (prog >= 1 && !meta.beTried) {
      meta.beTried = true;
      if (p.sl !== null && !p.breakEven && this.r.chance(this.p.beAt1R)) {
        this.act({ type: 'break-even', id: p.id });
      }
    }
    if (prog >= 1 && !meta.partialTried) {
      meta.partialTried = true;
      const half = normalizeLots(cfg, p.volume / 2);
      if (half > 0 && half < p.volume && this.r.chance(this.p.partialAt1R)) {
        if (this.act({ type: 'close', id: p.id, volume: half })) return;
      }
    }
    // Disposition effect: banks a small win too early.
    if (prog >= 0.25 && prog < this.p.rr - 0.2 && this.r.chance(this.p.cutWinners * 0.06)) {
      this.act({ type: 'close', id: p.id });
      return;
    }
    // Holding a loser: the stop gets moved away (or removed) as price nears it.
    if (p.sl !== null && prog <= -0.7 && !meta.widenTried) {
      meta.widenTried = true;
      if (this.r.chance(this.p.widenStops)) {
        const drop = this.p.gambler && this.r.chance(0.4);
        const sl = drop ? null : p.sl - dir(p.side) * risk * this.r.range(0.5, 1.2);
        if (this.act({ type: 'modify-position', id: p.id, sl })) return;
      }
    }
    // No stop: a mental stop, eventually.
    if (p.sl === null && prog <= -meta.mental) {
      this.act({ type: 'close', id: p.id });
      return;
    }
    // Panic exit on a loser.
    if (prog <= -0.5 && this.r.chance(0.02 * (1 - this.p.skill))) {
      this.act({ type: 'close', id: p.id });
      return;
    }
    // A trade going nowhere for too long.
    if (held >= this.p.patience && Math.abs(prog) < 0.35 && this.r.chance(0.08)) {
      this.act({ type: 'close', id: p.id });
      return;
    }
    // No TP: take it at some point.
    if (meta.noTp && prog >= this.p.rr * this.r.range(0.7, 1.4) && this.r.chance(0.25))
      this.act({ type: 'close', id: p.id });
  }

  private manageOrders(): void {
    for (const o of [...this.engine.state.orders]) {
      const meta = this.ord.get(o.id);
      if (!meta) continue;
      if (this.i - meta.placedIdx >= meta.expire && this.r.chance(0.15)) {
        if (this.act({ type: 'cancel-order', id: o.id })) this.ord.delete(o.id);
      }
    }
  }

  private act(a: TradeAction): boolean {
    if (this.log.length >= this.maxActions) return false;
    const res = this.engine.apply(a);
    if (!res.ok) return false;
    this.log.push({ t: this.t, a });
    return true;
  }
}
