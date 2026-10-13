import {
  DAY_MS,
  EventBus,
  TIMEFRAMES,
  bucketStart,
  type Candle,
  type Clock,
  type DataProvider,
  type InstrumentSpec,
  type Timer,
  type TimeframeId,
} from '@/lib/core';
import {
  ExecutionEngine,
  FREQUENCIES,
  MinuteBuffer,
  TICKER_VALUES,
  TradeOverlay,
  accountConfig,
  floatingPnl,
  nextStepEnd,
  previousStepStart,
  resimulate,
  revealMinutes,
  resyncForming,
  sessionEnd,
  stepOption,
  type AccountConfig,
  type AccountStatus,
  type BacktestRepository,
  type BacktestSession,
  type ExecEvent,
  type JournalEntry,
  type TradeAction,
} from '@/lib/backtest';
import type { ChartApp } from '../chart-app';
import { describeEvent } from './notices';
import { buildSnapshot, type BacktestSnapshot } from './snapshot';
import { TradingApi } from './trading-api';

/** UI requests coming from hotkeys or the chart (the React layer opens panels for them). */
export type BacktestCommand =
  | { readonly type: 'order-ticket'; readonly orderType: 'market' | 'limit' | 'stop' | null }
  | { readonly type: 'prop-rules' }
  | { readonly type: 'shortcuts' }
  | { readonly type: 'confirm-rewind'; readonly time: number; readonly check: RewindCheck }
  | {
      readonly type: 'chart-menu';
      readonly clientX: number;
      readonly clientY: number;
      readonly time: number;
      readonly price: number;
    };

export interface BacktestEventMap {
  snapshot: BacktestSnapshot;
  command: BacktestCommand;
  notice: { readonly level: 'info' | 'success' | 'error'; readonly text: string };
  ended: { readonly status: AccountStatus; readonly reason: string };
}

export interface BacktestControllerDeps {
  readonly session: BacktestSession;
  readonly spec: InstrumentSpec;
  /** Ungated market data (1-minute bars for the engine). */
  readonly market: DataProvider;
  readonly repo: BacktestRepository;
  readonly clock: Clock;
  readonly timer: Timer;
  /** Shared with the cursor-gated chart provider. */
  readonly cursorRef: { value: number };
}

const MINUTE_MS = 60_000;
const MINUTE_PAGE = 20_000;
const SAVE_DEBOUNCE_MS = 800;
const SNAPSHOT_MS = 60;
/** A jump longer than this reloads the chart instead of revealing minute by minute. */
const RELOAD_JUMP_MS = 2 * DAY_MS;
const AHEAD_MIN_MS = 2 * DAY_MS;
const AHEAD_MAX_MS = 14 * DAY_MS;
/** Largest read-ahead extension per step. */
const PREFETCH_CHUNK_MS = 3 * DAY_MS;

/**
 * Runs one backtest session on top of a ChartApp: the Price Skipper (step, play, frequency,
 * ticker value, rewind, go to), the execution engine fed with every 1-minute bar, the chart's
 * forming candle, autosave and low-frequency snapshots for the UI.
 */
export class BacktestController {
  readonly events = new EventBus<BacktestEventMap>();
  readonly cfg: AccountConfig;
  readonly trading: TradingApi;
  readonly overlay: TradeOverlay;
  private engine: ExecutionEngine;
  private readonly buffer: MinuteBuffer;
  private interval: number | null = null;
  private busy = false;
  private queuedSteps = 0;
  private loading = false;
  private saveTimer: number | null = null;
  private snapTimer: number | null = null;
  private readonly disposers: Array<() => void> = [];
  private destroyed = false;
  /** Set by the UI while a dialog is open: hotkeys are ignored. */
  inputBlocked = false;

  constructor(
    readonly app: ChartApp,
    private readonly deps: BacktestControllerDeps,
  ) {
    const s = deps.session;
    this.cfg = accountConfig(s.settings, deps.spec);
    this.engine = new ExecutionEngine(this.cfg, s.account);
    this.buffer = new MinuteBuffer((from, to) => this.loadMinutes(from, to));
    this.trading = new TradingApi(this);
    this.overlay = new TradeOverlay(app.engine, {
      cfg: this.cfg,
      account: () => this.engine.state,
      floating: (p) => floatingPnl(this.cfg, p, this.engine.state.bid),
      precision: () => deps.spec.pricePrecision,
      sessionStart: () => s.settings.startDate,
      commit: (line, price) => this.trading.commitLine(line, price),
      close: (line) =>
        line.owner === 'position'
          ? this.trading.close(line.ownerId)
          : this.trading.cancel(line.ownerId),
    });
    this.disposers.push(
      this.overlay.attach(),
      app.events.on('market:source', () => void this.resyncChart()),
    );
  }

  get session(): BacktestSession {
    return this.deps.session;
  }

  get spec(): InstrumentSpec {
    return this.deps.spec;
  }

  get account() {
    return this.engine.state;
  }

  get cursor(): number {
    return this.session.cursor;
  }

  get playing(): boolean {
    return this.interval !== null;
  }

  get ended(): boolean {
    return this.engine.state.status !== 'active';
  }

  get end(): number {
    return sessionEnd(this.session.settings);
  }

  async start(): Promise<void> {
    await this.ensureAround(this.cursor);
    this.emitSnapshot();
  }

  snapshot(): BacktestSnapshot {
    return buildSnapshot(this.session, this.cfg, { playing: this.playing, loading: this.loading });
  }

  // ---- Price Skipper -------------------------------------------------------------------------

  /** Emit next candle (pauses playback). Presses made during a step are queued, not lost. */
  async next(): Promise<void> {
    this.pause();
    if (this.busy) {
      this.queuedSteps += 1;
      return;
    }
    await this.stepOnce();
    while (this.queuedSteps > 0 && !this.ended && !this.playing) {
      this.queuedSteps -= 1;
      await this.stepOnce();
    }
    this.queuedSteps = 0;
  }

  play(): void {
    if (this.playing || this.ended || this.cursor >= this.end) return;
    this.startTimer();
    this.emitSnapshot();
  }

  pause(): void {
    if (this.interval === null) return;
    this.deps.timer.clearInterval(this.interval);
    this.interval = null;
    this.emitSnapshot();
  }

  togglePlay(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  setFrequency(frequency: number): void {
    this.session.prefs = { ...this.session.prefs, frequency };
    if (this.playing) this.startTimer();
    this.changed();
  }

  shiftFrequency(delta: number): void {
    this.setFrequency(stepOption(FREQUENCIES, this.session.prefs.frequency, delta));
  }

  setTickerValue(tickerValue: TimeframeId): void {
    this.session.prefs = { ...this.session.prefs, tickerValue };
    this.changed();
  }

  shiftTickerValue(delta: number): void {
    this.setTickerValue(stepOption(TICKER_VALUES, this.session.prefs.tickerValue, delta));
  }

  /** Bar-by-bar rewind: one ticker-value candle back. */
  rewind(force = false): Promise<RewindCheck> {
    const t = Math.max(
      this.session.settings.startDate,
      previousStepStart(this.cursor, this.session.prefs.tickerValue),
    );
    return this.rewindTo(t, force);
  }

  command(c: BacktestCommand): void {
    this.events.emit('command', c);
  }

  /** Rewind from a hotkey or button: asks for confirmation when trades would be undone. */
  async requestRewind(): Promise<void> {
    const t = Math.max(
      this.session.settings.startDate,
      previousStepStart(this.cursor, this.session.prefs.tickerValue),
    );
    const check = await this.rewindTo(t);
    if (!check.ok) this.command({ type: 'confirm-rewind', time: t, check });
  }

  /** Trades and orders that rewinding to `time` would undo. */
  rewindImpact(time: number): RewindCheck {
    const removed = this.session.actions.filter(
      (x) => x.t > time && (x.a.type === 'market' || x.a.type === 'pending'),
    ).length;
    const reopened = this.engine.state.trades.filter((t) => t.closeTime >= time).length;
    return { ok: removed === 0 && reopened === 0, removed, reopened };
  }

  /** Rewinds to `time` (re-simulates the session up to it). */
  async rewindTo(time: number, force = false): Promise<RewindCheck> {
    const s = this.session;
    const t = Math.max(s.settings.startDate, Math.min(time, this.cursor));
    if (t >= this.cursor) return { ok: true, removed: 0, reopened: 0 };
    const impact = this.rewindImpact(t);
    if (!impact.ok && !force) return impact;
    this.pause();
    await this.withLoading(async () => {
      const minutes = await this.loadMinutes(s.settings.startDate, t);
      const kept = s.actions.filter((x) => x.t <= t);
      const initial = ExecutionEngine.initialState(this.cfg, s.settings.startDate, s.initialBid);
      this.engine = resimulate(this.cfg, initial, kept, minutes, t);
      s.actions = kept;
      s.account = this.engine.state;
      const ids = new Set(s.account.trades.map((x) => x.id));
      for (const id of Object.keys(s.journal)) if (!ids.has(id)) delete s.journal[id];
      this.setCursor(t);
      await this.reloadChart();
    });
    this.changed();
    return { ok: true, removed: impact.removed, reopened: impact.reopened };
  }

  /** "Replay to this point": rewind to the close of the candle starting at `barTime`. */
  replayToBar(barTime: number, force = false): Promise<RewindCheck> {
    const tf = this.app.timeframe;
    const close = bucketStart(barTime, tf) + TIMEFRAMES[tf].ms;
    return this.rewindTo(Math.min(close, this.cursor), force);
  }

  /** Go to: forward jump to `time`, processing every minute in between. */
  async goTo(time: number): Promise<string | null> {
    const target = Math.min(time, this.end);
    if (target <= this.cursor) return 'Go to only moves forward. Use rewind to go back.';
    if (this.ended) return 'This session has ended';
    this.pause();
    const from = this.cursor;
    await this.withLoading(async () => {
      while (this.cursor < target && !this.ended) {
        const chunkEnd = Math.min(target, this.cursor + 7 * DAY_MS);
        await this.buffer.ensure(this.cursor, chunkEnd);
        const reveal = target - from <= RELOAD_JUMP_MS;
        this.advanceTo(chunkEnd, reveal);
      }
      if (target - from > RELOAD_JUMP_MS) await this.reloadChart();
    });
    this.afterStep();
    return null;
  }

  // ---- trading (used by TradingApi) ------------------------------------------------------------

  newId(): string {
    const id = String(this.session.nextId);
    this.session.nextId += 1;
    return id;
  }

  /** Applies and logs an action. Returns an error message or null. */
  act(action: TradeAction): string | null {
    const res = this.engine.apply(action);
    if (!res.ok) {
      this.notice('error', res.error);
      return res.error;
    }
    this.session.actions.push({ t: this.cursor, a: action });
    this.handleEvents(res.events);
    this.overlay.invalidate();
    this.changed();
    return null;
  }

  notice(level: BacktestEventMap['notice']['level'], text: string): void {
    this.events.emit('notice', { level, text });
  }

  setQuickVolume(volume: number): void {
    this.session.quickVolume = volume;
    this.changed();
  }

  setScalper(scalper: BacktestSession['scalper']): void {
    this.session.scalper = scalper;
    this.changed();
  }

  updateJournal(tradeId: string, patch: Partial<JournalEntry>): void {
    const prev = this.session.journal[tradeId] ?? {
      notes: '',
      tags: [],
      confidence: null,
      screenshots: [],
    };
    this.session.journal[tradeId] = { ...prev, ...patch };
    this.changed();
  }

  async addScreenshot(tradeId: string, dataUrl: string): Promise<void> {
    const id = `${this.session.id}-${tradeId}-${this.deps.clock.now()}`;
    await this.deps.repo.saveScreenshot(id, dataUrl);
    const prev = this.session.journal[tradeId];
    this.updateJournal(tradeId, { screenshots: [...(prev?.screenshots ?? []), id] });
  }

  updateSettings(patch: Partial<BacktestSession['settings']>): void {
    this.session.settings = { ...this.session.settings, ...patch };
    this.changed();
  }

  // ---- stepping internals ----------------------------------------------------------------------

  private async stepOnce(): Promise<void> {
    if (this.busy || this.ended) return;
    if (this.cursor >= this.end) return this.finish();
    this.busy = true;
    try {
      const ticker = this.session.prefs.tickerValue;
      let target = Math.min(this.end, nextStepEnd(this.cursor, ticker));
      for (let guard = 0; guard < 10_000; guard++) {
        // Only what this step needs is awaited; read-ahead happens in small chunks below.
        if (!this.buffer.covers(this.cursor, target))
          await this.buffer.ensure(this.cursor, Math.min(this.end, target + PREFETCH_CHUNK_MS));
        if (this.buffer.slice(this.cursor, target).length > 0 || target >= this.end) break;
        this.setCursor(target); // market closed: skip the empty step
        target = Math.min(this.end, nextStepEnd(this.cursor, ticker));
      }
      this.advanceTo(target, true);
      this.afterStep();
      this.readAhead(ticker);
    } finally {
      this.busy = false;
    }
  }

  /**
   * Keeps enough 1-minute data buffered for the next few seconds of playback, extending the
   * window by at most PREFETCH_CHUNK_MS per step so loading never blocks one frame for long.
   */
  private readAhead(ticker: TimeframeId): void {
    // About one second of playback ahead (at least two days), at most two weeks.
    const want = Math.min(
      AHEAD_MAX_MS,
      Math.max(AHEAD_MIN_MS, TIMEFRAMES[ticker].ms * this.session.prefs.frequency),
    );
    const end = Math.min(this.end, this.cursor + want);
    if (this.buffer.end >= end) return;
    void this.buffer.ensure(this.cursor, Math.min(end, this.buffer.end + PREFETCH_CHUNK_MS));
  }

  /** Processes the buffered minutes up to `target` (must be covered). */
  private advanceTo(target: number, reveal: boolean): void {
    const minutes = this.buffer.slice(this.cursor, target);
    const processed: Candle[] = [];
    let stopAt: number | null = null;
    for (const m of minutes) {
      this.handleEvents(this.engine.processBar(m));
      processed.push(m);
      if (this.ended) {
        stopAt = m.time + MINUTE_MS;
        break;
      }
    }
    this.setCursor(stopAt ?? target);
    this.engine.state.time = Math.max(this.engine.state.time, this.cursor);
    if (reveal) revealMinutes(this.app.market.data, this.app.timeframe, processed);
  }

  private afterStep(): void {
    if (this.cursor >= this.end && !this.ended) this.finish();
    const tf = this.app.timeframe;
    this.buffer.trimBefore(Math.min(bucketStart(this.cursor - 1, tf), this.cursor - DAY_MS));
    this.overlay.invalidate();
    this.changed();
  }

  private finish(): void {
    this.pause();
    if (!this.ended) this.handleEvents(this.engine.endSession());
    this.changed();
  }

  private handleEvents(events: readonly ExecEvent[]): void {
    for (const e of events) {
      const n = describeEvent(e, this.deps.spec.pricePrecision);
      if (n) this.notice(n.level, n.text);
      if (e.type === 'stopped') {
        this.pause();
        this.events.emit('ended', { status: e.status, reason: e.reason });
      }
    }
  }

  private startTimer(): void {
    if (this.interval !== null) this.deps.timer.clearInterval(this.interval);
    this.interval = this.deps.timer.setInterval(
      () => void this.stepOnce(),
      1000 / this.session.prefs.frequency,
    );
  }

  private setCursor(t: number): void {
    this.session.cursor = t;
    this.deps.cursorRef.value = t;
  }

  // ---- chart ----------------------------------------------------------------------------------

  /** After the chart (re)loaded through the gated provider: rebuild its forming candle. */
  private async resyncChart(): Promise<void> {
    const tf = this.app.timeframe;
    const from = bucketStart(this.cursor - 1, tf);
    await this.buffer.ensure(Math.min(from, this.buffer.start || from), this.cursor);
    const series = this.app.market.data;
    resyncForming(series, tf, this.buffer.slice(from, this.cursor));
    this.overlay.invalidate();
  }

  private async reloadChart(): Promise<void> {
    await this.ensureAround(this.cursor);
    await this.app.market.load(this.session.settings.symbol, this.app.timeframe, {
      resetView: false,
    });
    this.app.engine.scrollToLatest(false);
  }

  private async ensureAround(t: number): Promise<void> {
    const tf = this.app.timeframe;
    const from = Math.min(bucketStart(t - 1, tf), t - DAY_MS);
    await this.buffer.ensure(from, Math.min(this.end, t + AHEAD_MIN_MS));
  }

  private async loadMinutes(from: number, to: number): Promise<Candle[]> {
    const out: Candle[] = [];
    let start = from;
    for (;;) {
      const res = await this.deps.market.fetchBars({
        symbol: this.session.settings.symbol,
        timeframe: '1m',
        startTime: start,
        endTime: to - 1,
        limit: MINUTE_PAGE,
      });
      out.push(...res.bars);
      const last = res.bars[res.bars.length - 1];
      if (!last || res.bars.length < MINUTE_PAGE) return out;
      start = last.time + MINUTE_MS;
    }
  }

  private async withLoading(fn: () => Promise<void>): Promise<void> {
    this.loading = true;
    this.emitSnapshot();
    try {
      await fn();
    } finally {
      this.loading = false;
    }
  }

  // ---- persistence and snapshots -------------------------------------------------------------

  /** Something changed: autosave (debounced) and refresh the UI snapshot (throttled). */
  changed(): void {
    this.session.account = this.engine.state;
    this.session.updatedAt = this.deps.clock.now();
    if (this.saveTimer === null)
      this.saveTimer = this.deps.timer.setTimeout(() => {
        this.saveTimer = null;
        void this.save();
      }, SAVE_DEBOUNCE_MS);
    if (this.snapTimer === null)
      this.snapTimer = this.deps.timer.setTimeout(() => {
        this.snapTimer = null;
        this.emitSnapshot();
      }, SNAPSHOT_MS);
  }

  emitSnapshot(): void {
    if (!this.destroyed) this.events.emit('snapshot', this.snapshot());
  }

  async save(): Promise<void> {
    this.session.account = this.engine.state;
    await this.deps.repo.save(this.session);
  }

  /** Saves now (page hide / unmount). */
  flush(): void {
    if (this.saveTimer !== null) this.deps.timer.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    void this.save();
  }

  destroy(): void {
    this.pause();
    this.flush();
    this.destroyed = true;
    if (this.snapTimer !== null) this.deps.timer.clearTimeout(this.snapTimer);
    for (const d of this.disposers.splice(0)) d();
    this.events.clear();
  }
}

export interface RewindCheck {
  /** False when the rewind needs confirmation (it would undo trades). */
  readonly ok: boolean;
  readonly removed: number;
  readonly reopened: number;
}
