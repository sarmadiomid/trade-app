import type { InstrumentSpec } from '@/lib/core';
import {
  CursorGatedProvider,
  ExecutionEngine,
  DEFAULT_PREFS,
  DEFAULT_SCALPER,
  type BacktestRepository,
  type BacktestSession,
  type LoggedAction,
} from '@/lib/backtest';
import type { BattleSettings } from '@/lib/battles';
import { NamespacedStorage } from '@/lib/storage';
import type { ChartApp, ChartAppOptions } from '../chart-app';
import type { AppDependencies } from '../composition';
import { BacktestController } from '../backtest/backtest-controller';
import { SHARED_KEYS, type BacktestServices } from '../backtest/backtest-runtime';
import { backtestShortcuts } from '../backtest/backtest-shortcuts';
import { battleAccountConfig, battleSessionSettings } from './battle-config';

/** The trader's seat in a battle, as the server describes it. */
export interface BattleSeat {
  readonly battleId: string;
  readonly settings: BattleSettings;
  readonly symbol: string;
  readonly marketStart: number;
  /** Market time the trader's account starts at, and the Bid before it. */
  readonly startT: number;
  readonly startBid: number;
  readonly actions: readonly LoggedAction[];
}

/** Hotkeys that make sense in a battle: order entry only (the battle clock drives the replay). */
const BATTLE_HOTKEYS = new Set([
  'backtest-new-order',
  'backtest-new-limit',
  'backtest-new-stop',
  'backtest-new-market',
  'backtest-shortcut-list',
]);

/** Battles are recorded by the server; nothing is stored in the browser. */
const NO_REPO: BacktestRepository = {
  list: async () => [],
  load: async () => null,
  save: async () => {},
  remove: async () => {},
  saveScreenshot: async () => {},
  loadScreenshot: async () => null,
  removeScreenshot: async () => {},
};

/**
 * Wiring of one battle seat on the chart: the trader's account runs in the browser on the same
 * engine and data the server re-simulates, the chart only ever shows candles up to the battle
 * cursor, and every action is reported through `onAction`.
 */
export class BattleRuntime {
  readonly cursorRef: { value: number };
  readonly session: BacktestSession;
  readonly spec: InstrumentSpec;
  private controllerRef: BacktestController | null = null;

  constructor(
    readonly seat: BattleSeat,
    private readonly services: BacktestServices,
  ) {
    this.spec = services.spec(seat.symbol);
    const settings = battleSessionSettings(seat.settings, seat.symbol, this.spec, seat.marketStart);
    const cfg = battleAccountConfig(seat.settings, seat.symbol, this.spec, seat.marketStart);
    this.session = {
      id: `battle-${seat.battleId}`,
      createdAt: 0,
      updatedAt: 0,
      settings,
      prefs: DEFAULT_PREFS,
      scalper: DEFAULT_SCALPER,
      quickVolume: Math.max(this.spec.lotMin, 1),
      cursor: seat.startT,
      actions: [...seat.actions],
      account: ExecutionEngine.initialState(cfg, seat.startT, seat.startBid),
      initialBid: seat.startBid,
      journal: {},
      nextId: 1,
    };
    this.cursorRef = { value: seat.startT };
  }

  get controller(): BacktestController | null {
    return this.controllerRef;
  }

  wrapDeps(deps: AppDependencies): AppDependencies {
    return {
      ...deps,
      provider: new CursorGatedProvider(
        this.services.market,
        () => this.cursorRef.value,
        this.spec,
      ),
      storage: new NamespacedStorage(deps.storage, `battle:${this.seat.battleId}:`, SHARED_KEYS),
    };
  }

  appOptions(): ChartAppOptions {
    return {
      symbol: this.seat.symbol,
      timeframe: '1m',
      shortcuts: backtestShortcuts(() => this.controllerRef).filter((s) =>
        BATTLE_HOTKEYS.has(s.id),
      ),
    };
  }

  /** Starts the account and brings it to the battle's current cursor. */
  attach(app: ChartApp, cursor: number, onAction: (a: LoggedAction) => void): BacktestController {
    const c = new BacktestController(app, {
      session: this.session,
      spec: this.spec,
      market: this.services.market,
      repo: NO_REPO,
      clock: app.deps.clock,
      timer: app.deps.runtime.timer,
      cursorRef: this.cursorRef,
      onAction,
    });
    this.controllerRef = c;
    void c.start().then(() => c.restore(this.seat.startT, Math.max(this.seat.startT, cursor)));
    return c;
  }

  detach(): void {
    this.controllerRef?.destroy();
    this.controllerRef = null;
  }
}
