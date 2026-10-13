# ADR 0009 — Backtesting as a pure domain module on 1-minute data

**Status:** accepted

## Decision

- `src/lib/backtest` is a domain module like `replay`: it depends on core only and holds the
  execution engine, analytics, session model and the replay mechanics. The app layer
  (`lib/app/backtest`) composes it with a regular `ChartApp`, so every chart feature (timeframes,
  chart types, drawings, themes) works in a session unchanged.
- The execution engine is driven by **1-minute bars only**, whatever the chart timeframe or the
  Price Skipper's ticker value. Intrabar order is the OHLC path heuristic (O→L→H→C for bullish
  minutes, O→H→L→C otherwise).
- The chart never receives future data: it loads through `CursorGatedProvider`, which clips to
  the cursor and rebuilds the forming candle from 1-minute bars.
- A session stores an append-only action log next to the account snapshot. Rewind re-simulates
  from the start; the engine is deterministic, so this reproduces the exact state.
- Persistence goes through the `BacktestRepository` port; market data through the existing
  `DataProvider` port.

## Consequences

- SL and TP inside the same minute are resolved by a heuristic, not tick data.
- Rewinding a long session costs one re-simulation (hundreds of thousands of 1-minute bars run
  in tens of milliseconds).
- A real database or API replaces the IndexedDB repository or the mock provider in
  `createBacktestServices` without touching UI or engine code.
