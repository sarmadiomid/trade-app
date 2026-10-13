# Backtest module (`/backtest`)

An FX Replay-style backtesting simulator built on the existing chart. The behaviour it follows
is specified in [backtest-spec.md](backtest-spec.md); this document covers how it is built and
how to extend it.

## Routes

| Route                      | What it is                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `/backtest`                | Sessions page: cards, **New session**, duplicate, delete                           |
| `/backtest/[id]`           | The session: chart + Price Skipper + Quick Buy/Sell + order ticket + trading panel |
| `/backtest/[id]/journal`   | Trade journal: notes, tags, confidence, screenshots, filters                       |
| `/backtest/[id]/analytics` | Statistics dashboard and RR simulator                                              |

All four are client-only (canvas, IndexedDB). They need no login; sessions are stored in the
browser until a server repository is plugged in (below).

## Layers

```
src/lib/core        InstrumentSpec contract, SeriesData.upsertMany, Registry.registerFirst,
                    setDisplayUtc
src/lib/data        INSTRUMENTS (contract specs) · mock/ seeded 1-minute XAUUSD generator ·
                    MockMarketProvider (DataProvider; every timeframe aggregated from 1m)
src/lib/backtest    pure domain module (core only):
  execution/          ExecutionEngine, actions, validation, P&L math  ← unit-tested
  analytics/          stats, breakdowns, equity curve, RR simulator   ← unit-tested
  session/            BacktestSession model, zod schema, BacktestRepository port +
                      StorageBacktestRepository (versioned envelope)
  replay/             skipper stepping, MinuteBuffer, CursorGatedProvider, re-simulation,
                      revealing minutes on the chart
  chart/              TradeOverlay: trade lines, drag to modify, session start marker
src/lib/app/backtest BacktestController (replay loop, trading API, rewind, go to, autosave,
                    snapshots), BacktestRuntime (wires a session into a ChartApp),
                    backtest services (composition), FX Replay hotkeys
src/components/backtest  React views; they read snapshots and call the controller
```

`eslint-rules/layer-boundaries.mjs` enforces that `backtest` imports only `core`, and the
determinism rule (no `Date.now()` / `Math.random()`) applies to it like the other domain modules.

### How a session runs

1. `BacktestRuntime.wrapDeps` builds the `ChartApp` with a **`CursorGatedProvider`** around the
   market provider and a per-session `NamespacedStorage` (drawings and the chart timeframe are
   per session; themes and chart settings are shared with `/chart`).
2. Whatever the chart loads (any timeframe, older history pages, derived chart types) goes
   through the gated provider: bars are clipped to the replay cursor and the bucket containing
   the cursor is rebuilt from 1-minute data. Future data cannot reach the chart, auto-scale,
   indicators or the legend.
3. `BacktestController.next()` / the play timer move the cursor by one **ticker value** bucket.
   Every 1-minute bar in the step goes through `ExecutionEngine.processBar` (fills, SL/TP, auto
   BE, stop out, prop rules), then the step's minutes are merged into the chart's last candles
   with one `upsertMany`.
4. Every trader action is applied to the engine and appended to `session.actions` with the
   replay time. Rewind re-simulates the session from its start (`resimulate`) up to the target,
   keeping only actions taken at or before it — deterministic, so the state is exactly what it
   was.
5. Changes are autosaved (debounced) through the `BacktestRepository`; the account snapshot is
   stored with the session, so reopening needs no re-simulation.

## Plugging in a real database or API

Two ports, both injected in one place (`createBacktestServices` in
`src/lib/app/backtest/backtest-runtime.ts`). No UI or engine code changes.

### Persistence: `BacktestRepository`

```ts
interface BacktestRepository {
  list(): Promise<SessionSummary[]>;
  load(id: string): Promise<BacktestSession | null>;
  save(session: BacktestSession): Promise<void>;
  remove(id: string): Promise<void>;
  saveScreenshot(id: string, dataUrl: string): Promise<void>;
  loadScreenshot(id: string): Promise<string | null>;
  removeScreenshot(id: string): Promise<void>;
}
```

- **Quickest path (same database the app already uses):** `StorageBacktestRepository` works over
  any `StorageAdapter`. Pass the app's `RemoteStorage` (MongoDB through `/api/chart-records`,
  see `UserChart.tsx`) instead of `pickStorage()` in `browserBacktestServices()`, and sessions
  are stored per user on the server.
- **Dedicated API / tables:** implement `BacktestRepository` against your endpoints, e.g.
  `GET /api/backtest/sessions` → summaries, `GET/PUT/DELETE /api/backtest/sessions/:id` →
  the session JSON, and store screenshots in object storage. Validate what comes back with
  `parseSession` (zod) and keep the `{ kind, schemaVersion, data }` envelope
  (`readSessionEnvelope`) so `MIGRATIONS` in `session/repository.ts` can upgrade old records.
  A relational schema would naturally split `sessions` (settings, prefs, cursor, account
  snapshot), `session_actions` (append-only log) and `journal_entries` / `screenshots`.

### Market data: `DataProvider`

The backtest uses the regular `DataProvider` port (`core/contracts/data-provider.ts`):
`fetchBars({ symbol, timeframe, startTime?, endTime?, limit })`.

- It must serve **`timeframe: '1m'` with `startTime`/`endTime`** — the engine is driven by
  1-minute bars (paged in 20,000-bar requests).
- Other timeframes are only used for the chart's history. Serve them from your store, or
  aggregate them from 1-minute data as `MockMarketProvider` does.
- Implement `getSymbolInfo(symbol)` to return an `InstrumentSpec`, and a `dataRange(symbol)`
  method (used to validate session dates; see `BacktestServices`).
- Swap `market` in `createBacktestServices`. `CursorGatedProvider` wraps whatever you provide.

### Adding a symbol

1. Add an `InstrumentSpec` to `src/lib/data/instruments.ts` (tick and pip size, contract size,
   lot min/step/max, default spread and commission, trading hours).
2. Give it data: a real provider, or a `MockModel` in `src/lib/data/mock/models.ts` (price
   anchors, daily volatility, seed).
3. It appears in the Create session dialog. P&L, sizing and validation all derive from the spec.

## Tests

```bash
npx vitest run tests/backtest tests/data/mock-market.test.ts
```

- `engine.test.ts` — fills, Bid/Ask spread, gaps, SL vs TP in the same minute, limit-then-TP
  chains, partial closes, commission, auto/manual break even, stop out, prop rules, determinism.
- `analytics.test.ts` — every KPI formula, breakdowns, calendar, drawdown, histogram, RR simulator.
- `controller.test.ts` — on a headless `ChartApp`: no future data on any timeframe while stepping
  and after a timeframe switch, ticker alignment, fills while skipping, rewind (needs confirmation,
  undoes trades and their journal), rewind equals live state, persistence round trip, session end.
- `minute-buffer.test.ts`, `mock-market.test.ts` — data window and the seeded generator.

Browser end-to-end runs (Playwright against `next dev`) covered: create → step → quick buy →
order ticket → play at 30/s → timeframe switch → hotkeys → close → go to end → completed dialog →
analytics → journal (notes, tags) → reopen restores the state; a prop session failing at the max
daily loss; right-click orders; and frame timing at 60 candles/s for 1m, 15m and 1D ticker values
(worst frame 17–33 ms, about 60 candles/s).
