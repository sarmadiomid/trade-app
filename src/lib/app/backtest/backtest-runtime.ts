import {
  DAY_MS,
  createIdGenerator,
  createRng,
  type InstrumentSpec,
  type StorageAdapter,
} from '@/lib/core';
import {
  CursorGatedProvider,
  StorageBacktestRepository,
  createSession,
  validateSettings,
  type BacktestRepository,
  type BacktestSession,
  type SessionSettings,
} from '@/lib/backtest';
import { MockMarketProvider, instrumentSpec, INSTRUMENTS } from '@/lib/data';
import { NamespacedStorage } from '@/lib/storage';
import type { ChartApp, ChartAppOptions } from '../chart-app';
import type { AppDependencies } from '../composition';
import { APP_CONFIG } from '../config';
import { systemClock } from '../browser-runtime';
import { pickStorage } from '../composition';
import { BacktestController } from './backtest-controller';
import { backtestShortcuts } from './backtest-shortcuts';

/** Chart records shared with the regular chart (everything else is per session). */
const SHARED_KEYS = [
  APP_CONFIG.storageKeys.themes,
  APP_CONFIG.storageKeys.chartSettings,
  APP_CONFIG.storageKeys.toolDefaults,
  APP_CONFIG.storageKeys.toolTemplates,
];

/** Market data and persistence of the backtest module. Swap implementations here. */
export interface BacktestServices {
  readonly market: MockMarketProvider;
  readonly repo: BacktestRepository;
  instruments(): readonly InstrumentSpec[];
  spec(symbol: string): InstrumentSpec;
  dataRange(symbol: string): { readonly start: number; readonly end: number };
  /** Validates and creates a session (initial Bid = last price before its start). */
  create(settings: SessionSettings): Promise<{ session: BacktestSession } | { error: string }>;
}

let market: MockMarketProvider | null = null;
let browserServices: BacktestServices | null = null;

/** Backtest services on the browser's persistent storage (one instance per page). */
export function browserBacktestServices(): BacktestServices {
  browserServices ??= createBacktestServices(pickStorage());
  return browserServices;
}

export function createBacktestServices(storage: StorageAdapter): BacktestServices {
  market ??= new MockMarketProvider();
  const m = market;
  const repo = new StorageBacktestRepository(storage);
  const spec = (symbol: string) => instrumentSpec(symbol) ?? m.getSymbolInfo(symbol);
  return {
    market: m,
    repo,
    instruments: () => INSTRUMENTS.filter((i) => m.searchSymbols(i.symbol).length > 0),
    spec,
    dataRange: (symbol) => m.dataRange(symbol),
    async create(settings) {
      const error = validateSettings(settings, m.dataRange(settings.symbol));
      if (error) return { error };
      const before = await m.fetchBars({
        symbol: settings.symbol,
        timeframe: '1m',
        endTime: settings.startDate - 1,
        limit: 1,
      });
      const first = await m.fetchBars({
        symbol: settings.symbol,
        timeframe: '1m',
        startTime: settings.startDate,
        endTime: settings.endDate + DAY_MS - 1,
        limit: 1,
      });
      if (first.bars.length === 0) return { error: 'There is no market data in this date range' };
      const initialBid = before.bars[0]?.close ?? first.bars[0]!.open;
      const now = systemClock.now();
      const id = createIdGenerator(createRng(now >>> 0), 'bt')();
      const session = createSession({ id, now, settings, initialBid, spec: spec(settings.symbol) });
      await repo.save(session);
      return { session };
    },
  };
}

/**
 * Wiring of one opened session: the chart is created through `wrapDeps` / `appOptions`
 * (cursor-gated data, per-session storage, FX Replay hotkeys) and `attach` starts the
 * controller once the ChartApp exists.
 */
export class BacktestRuntime {
  readonly cursorRef: { value: number };
  private controllerRef: BacktestController | null = null;

  constructor(
    readonly session: BacktestSession,
    private readonly services: BacktestServices,
  ) {
    this.cursorRef = { value: session.cursor };
  }

  get controller(): BacktestController | null {
    return this.controllerRef;
  }

  get spec(): InstrumentSpec {
    return this.services.spec(this.session.settings.symbol);
  }

  wrapDeps(deps: AppDependencies): AppDependencies {
    return {
      ...deps,
      provider: new CursorGatedProvider(
        this.services.market,
        () => this.cursorRef.value,
        this.spec,
      ),
      storage: new NamespacedStorage(deps.storage, `bt:${this.session.id}:`, SHARED_KEYS),
    };
  }

  appOptions(): ChartAppOptions {
    return {
      symbol: this.session.settings.symbol,
      timeframe: '15m',
      shortcuts: backtestShortcuts(() => this.controllerRef),
    };
  }

  attach(app: ChartApp): BacktestController {
    const c = new BacktestController(app, {
      session: this.session,
      spec: this.spec,
      market: this.services.market,
      repo: this.services.repo,
      clock: app.deps.clock,
      timer: app.deps.runtime.timer,
      cursorRef: this.cursorRef,
    });
    this.controllerRef = c;
    void c.start();
    return c;
  }

  detach(): void {
    this.controllerRef?.destroy();
    this.controllerRef = null;
  }
}
