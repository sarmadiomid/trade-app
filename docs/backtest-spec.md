# Backtest module — FX Replay behaviour spec

This document describes what `/backtest` replicates from FX Replay (fxreplay.com), how each
feature behaves, and where we had to decide something FX Replay does not document. It is the
contract the implementation and tests follow.

> **Research method and limits.** The sandbox's network policy blocks direct access to
> `fxreplay.com`, `support.fxreplay.com` and YouTube (HTTP 403 on CONNECT). The research was
> therefore done through web search, which returns excerpts of FX Replay's help-center articles,
> blog posts and third-party reviews. Each fact below is tagged:
>
> - **[FXR]** — stated in an FX Replay help-center article or FX Replay blog post (see Sources).
> - **[3P]** — from a third-party review or walkthrough of FX Replay.
> - **[DEC]** — not documented anywhere we could reach; we chose what a professional trader would
>   expect. These are the places to compare against the live product first.

---

## 1. Concepts and terminology

| Term (FX Replay wording)                    | Meaning                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Session**                                 | One backtest: a name, assets, a starting balance and a date range. All trades, drawings and stats belong to it. [FXR]                                                                                                                            |
| **Backtesting session / Prop Firm Session** | The two session types offered when creating a session. A Prop Firm Session adds rules (profit target, max daily loss, max total loss). [FXR]                                                                                                     |
| **Price Skipper**                           | The bar under the chart holding the replay controls: Replay button, bar-by-bar rewind, Play/Pause, next candle, frequency and ticker value. [FXR]                                                                                                |
| **Emit Next Candle**                        | Advance the replay by one step. [FXR]                                                                                                                                                                                                            |
| **Ticker value**                            | The step size of the Price Skipper (e.g. 1m, 15m, 1h). Each "next candle" (and each rewind click) moves time by one candle of this timeframe, independently of the chart's timeframe. [FXR] ("If set to 1h, each click rewinds one hour candle") |
| **Frequency**                               | Playback speed: how often a candle is emitted while playing. [FXR] (Alt+2 / Alt+3 decrease / increase it)                                                                                                                                        |
| **Quick Buy/Sell panel**                    | The always-visible Sell / quantity / Buy widget on the chart. Its quantity is used by right-click orders too. [FXR]                                                                                                                              |
| **New Order**                               | The full order ticket (market, limit, stop; SL/TP). [FXR] (Alt + `,`)                                                                                                                                                                            |
| **Scalper Mode**                            | Predefined SL, TP and Auto Break Even applied to every Quick Buy/Sell trade. [FXR]                                                                                                                                                               |
| **Journal**                                 | Every trade is logged automatically; notes, tags and screenshots can be added at any time, even after the session ended. [FXR]                                                                                                                   |
| **Analytics / Session stats**               | Dashboard of metrics and charts for the session. [FXR]                                                                                                                                                                                           |
| **Countdown**                               | Yellow countdown in the session view: how many days are left in the session's range. [FXR]                                                                                                                                                       |

---

## 2. Sessions

### 2.1 Sessions page (`/backtest`)

- Lists every session as a card: name, type badge (Backtesting / Prop Firm), asset, date range,
  replay progress (current replay date and a progress bar through the range), starting balance,
  current balance and P&L (absolute and %), number of trades, status (In progress / Completed /
  Failed for prop sessions). [DEC — FXR documents that the Sessions page shows each session's
  equity curve, PnL, trade outcomes and journal access; the card layout is ours]
- Actions per card: **Open** (continue replaying), **Analytics**, **Journal**, and a menu with
  **Session settings**, **Duplicate**, **Delete** (with confirmation). [DEC]
- **+ New session** opens the creation dialog.

### 2.2 Create session dialog

Field order follows FX Replay's flow (type → name → assets → balance → dates → costs/rules):

| Field                       | Default                                                     | Rules                                                                                                                       |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Session type                | Backtesting                                                 | Backtesting \| Prop Firm Session [FXR]                                                                                      |
| Session name                | "XAUUSD backtest"                                           | required, ≤ 60 chars                                                                                                        |
| Description / strategy tag  | empty                                                       | optional [FXR: session settings has rename, strategy tag, description]                                                      |
| Asset                       | XAUUSD                                                      | from the symbol catalogue (only Gold for now)                                                                               |
| Account balance             | 100,000 USD                                                 | > 0 [DEC: FX Replay's default could not be confirmed; 100k matches the common prop-firm account size]                       |
| Start date                  | 1 Jan 2024                                                  | within the data range; must leave at least one trading day before the end                                                   |
| End date                    | start + 1 month                                             | after start; within the data range                                                                                          |
| Spread                      | off; when on, symbol default (XAUUSD 0.20 USD = 2 pips)     | FX Replay: "enable/create spreads and commissions" in session settings [FXR]                                                |
| Commission                  | off; when on, symbol default (XAUUSD 0 USD/lot/side)        | per lot per side [DEC: FXR mentions flat-per-trade or percentage; per-lot is the standard way gold commissions are charged] |
| Prop rules (Prop Firm only) | Profit target 10 %, Max daily loss 5 %, Max total loss 10 % | percentages of the starting balance [FXR: the three rules]                                                                  |

Dates are calendar dates in **UTC**. The session replays from `start 00:00 UTC` to
`end 24:00 UTC` (the end date is inclusive). [DEC]

Plan limits (Beginner: 1 month, Intermediate: 6 months, Pro: unlimited) [FXR] are not enforced
— there are no plans here.

### 2.3 Session settings (right side of the session view)

Rename, description, strategy tag, spread and commission on/off and values, prop rules. Changing
the **starting balance or the date range** after trades exist is not allowed (it would make the
journal inconsistent); FX Replay allows editing them [FXR], so the dialog offers **Duplicate with
new settings** instead. [DEC — deviation, see §11]

### 2.4 Opening a session

- The chart opens on the session asset at the timeframe last used in that session (first open:
  15m) [DEC], with the cursor at the saved replay time (first open: the session start).
- **History before the start date is visible** so the trader has context to analyse — FX Replay
  shows prior price action. Nothing at or after the replay cursor exists anywhere: candles, the
  auto-scaled price range, the last-price line, indicators/derived chart types, the crosshair
  legend, the time axis and the trading engine only ever see data before the cursor. The forming
  candle of the chart timeframe is built from 1-minute data up to the cursor. A vertical marker
  shows the session start. [FXR: "all future candles are hidden"; marker is DEC]
- Everything persists automatically: replay time, ticker value, frequency, chart timeframe and
  type, drawings (per session), open positions, pending orders, journal, account. Reopening
  restores the exact state.
- Go To Date only lets you _view_ a day and never moves the session start; candle-by-candle replay
  only works from the session's start date. [FXR] We implement **Go to** as a forward jump (see
  §3.4) because skipping ahead while keeping positions managed is what traders use it for.

---

## 3. Replay (Price Skipper)

### 3.1 Layout (left → right, bottom bar under the chart)

`[⟲ Rewind] [▶/❚❚ Play/Pause] [▶| Next candle] [Ticker value ▾] [Frequency ▾] [Go to…] ·
current replay date & time (UTC) · N days left` [FXR: Rewind sits left of Play/Pause in the
Price Skipper bar]

### 3.2 Next candle (Ctrl+Space)

- Moves the cursor forward by one **ticker value** candle, aligned to that timeframe's bucket
  boundaries: from 10:07 with ticker 15m the next step ends at 10:15, then 10:30, ... [DEC:
  alignment is what keeps the chart's forming candle and the skipper in sync]
- Weekend and daily-break gaps are skipped: a step always reveals at least one 1-minute bar; if the
  next bucket has no data (market closed) the step continues to the next bucket that has data.
- Every 1-minute bar inside the step is processed by the execution engine in order, so pending
  orders, SL and TP trigger at the right minute even when skipping 4 hours or a day.
- When the chart timeframe is higher than the ticker value, the chart's current candle forms
  progressively (open fixed, high/low/close updating). When it is lower, a single step adds
  several completed chart candles.
- Pressing it while playing pauses playback and steps once (FX Replay behaves like TradingView
  here). [DEC]

### 3.3 Play / Pause (Alt+1) and Frequency (Alt+2 / Alt+3)

- Play emits one ticker-value candle per tick. Frequency options (candles per second):
  `0.5, 1, 2, 3, 5, 10, 20, 30, 60`; default 1. Alt+2 moves one option slower, Alt+3 faster.
  [FXR for the hotkeys; values DEC]
- Changing the frequency while playing takes effect immediately without a pause.
- Playback pauses automatically when: the session end is reached, a prop rule is breached, the
  account is stopped out, a dialog that needs input opens (order ticket stays non-modal and does
  not pause), or the trader rewinds. [DEC]
- At max frequency with a 1D ticker value the engine processes ~86k one-minute bars per second;
  only the final state of each tick is rendered (one chart update per tick, not per minute).

### 3.4 Ticker value (Alt+4 / Alt+5)

Options `1m, 5m, 15m, 30m, 1h, 4h, 1D`; default 1m [DEC]. Alt+4 = smaller, Alt+5 = larger. [FXR]
Independent of the chart timeframe.

### 3.5 Bar-by-bar rewind

- Moves the cursor back one ticker-value candle (aligned), never before the session start. [FXR]
- Rewinding is a real "undo of time": trades opened, orders placed or positions closed after the
  new cursor are removed and the account is recomputed (the session keeps an action log and
  re-simulates it over the 1-minute data — deterministic). If the rewind would remove trades, a
  confirmation lists how many. [DEC — FX Replay does not document how rewind interacts with
  trades; anything else leaves the journal inconsistent with the chart]
- Actions taken exactly at the rewind target time are kept: stepping back one candle to where a
  trade was placed keeps that trade. [DEC]
- Right-click on a candle → **Replay to this point** rewinds to the close of that candle. [FXR]

### 3.6 Go to (date & time)

Jumps forward to a date/time (UTC) inside the range, processing every minute in between
(fills, SL/TP), like pressing Next candle very fast. Earlier times are refused (use rewind).
[DEC — see §2.4]

### 3.7 Changing the chart timeframe

Allowed at any time (toolbar, or type `5`, `1h`, `D` + Enter, as on the existing chart). Replay
time is kept; the new timeframe's completed candles come from history and the forming candle is
rebuilt from 1-minute data up to the cursor. Drawings keep their time/price anchors.

### 3.8 Session end

When the cursor reaches the end of the range: playback stops, open positions are closed at the
last price (exit reason **Session end**) and pending orders are cancelled, the session is marked
**Completed**, and the **Session completed** dialog offers _View analytics_ (the dashboard) or
_Stay on chart_. Next candle / Play / Go to are disabled; rewind still works and reopens the
session. [FXR: playback cannot continue past the end date; closing positions is DEC]

---

## 4. Orders and execution

### 4.1 Prices

- Chart candles are **Bid** prices. Ask = Bid + spread (session spread, 0 when disabled).
- Buy market orders fill at Ask, sell market orders at Bid, at the last revealed minute's close.
- Long positions are valued and closed at Bid; short positions at Ask. [FXR: "FX Replay tracks
  every order... using historical bid/ask data"]

### 4.2 Order types

| Type              | Placed    | Triggers when | Fills at                                                            |
| ----------------- | --------- | ------------- | ------------------------------------------------------------------- |
| Market Buy / Sell | now       | —             | Ask / Bid                                                           |
| Buy Limit         | below Ask | Ask ≤ price   | price (or the open, if the market gaps through it — a better price) |
| Sell Limit        | above Bid | Bid ≥ price   | price (or better on a gap)                                          |
| Buy Stop          | above Ask | Ask ≥ price   | price (or the gap open — worse, slippage)                           |
| Sell Stop         | below Bid | Bid ≤ price   | price (or the gap open)                                             |

[FXR: market, limit and stop order types and hotkeys; right-click picks Buy/Sell side from the
price's position relative to the market. Gap handling DEC]

- Validation: a limit/stop on the wrong side of the market is rejected with a message
  ("Buy Limit price must be below the current Ask"). SL must be on the losing side of the entry,
  TP on the winning side.
- Volume in **lots**: XAUUSD min 0.01, step 0.01, max 100 (symbol metadata). A quantity of 0 in
  the Quick panel defaults to the minimum with a tooltip (FX Replay defaults to 1). [FXR, adapted]
- Pending orders carry SL/TP, which apply to the position they open.
- Orders can be modified (price, volume, SL, TP — dialog or by dragging their line) and cancelled.

### 4.3 Position management

- **Close** (full, at market) — ✕ on the position line or the row.
- **Partial close**: close a volume (or 25/50/75 %) at market. The remainder stays open with the
  same entry, SL and TP. A partial is recorded as an exit of the same trade; the journal row shows
  the total. [DEC: one trade with several exits, how professional journals count it]
- **Break even**: move SL to the entry price (button) [FXR: BE exists in Scalper Mode].
- **Auto Break Even**: once price has moved a distance (pips) or an R multiple in favour, SL moves
  to entry automatically. Requires an SL. [FXR]
- **Modify SL/TP**: drag the orange (SL) / green (TP) line; P&L, distance and % update live while
  dragging [FXR]. Ghost "SL"/"TP" handles appear on a position without one; dragging a ghost
  creates the level. [FXR: "Ghost lines appear only if no SL/TP is already set"]
- **Close all** and **Cancel all** in the trading panel.
- **Reverse** is not offered (not documented by FX Replay).
- Netting is off: each fill is its own position (hedging allowed). [DEC]

### 4.4 Intrabar resolution (SL and TP in the same candle)

The engine always processes **1-minute bars** regardless of chart timeframe or ticker value.
Within one minute the price path is assumed to be:

- bullish or flat minute (`close ≥ open`): Open → Low → High → Close
- bearish minute: Open → High → Low → Close

Triggers are processed in the order the path crosses them, including chains inside the same
minute: a Buy Limit filled on the way down can then hit its TP on the way up. If both SL and TP of
a position lie inside one minute, the path decides which is first. [DEC — the standard OHLC
heuristic; FX Replay uses tick data we don't have]

### 4.5 P&L and account

For a position of `v` lots, contract size `C` (XAUUSD 100 oz), direction `d = +1` long / `−1`
short, quote currency = account currency (USD):

- Floating P&L = `d · (exit_price_now − entry) · v · C` where `exit_price_now` is Bid for longs,
  Ask for shorts.
- Realized P&L of a (partial) close = same with the fill price, minus commission.
- Commission = `commission_per_lot_per_side · v`, charged on entry and on each exit.
- Pips = price difference / pip size (XAUUSD pip = 0.10).
- **Balance** = starting balance + realized P&L (net of commission).
- **Equity** = balance + floating P&L of open positions.
- Both update on every revealed minute. Account % = P&L / starting balance.
- **Stop out**: if equity ≤ 0 every position is closed and the session stops. [DEC]
- No margin/leverage model (FX Replay does not surface one). [DEC]

### 4.6 Risk sizing in the order ticket

Quantity can be entered as **Lots**, **Risk %** (of current balance) or **Risk $**. With an SL,
lots = risk$ / (|entry − SL| · C), floored to the lot step and clamped to min/max. The ticket shows
the resulting risk and reward in $ and the planned R:R. [3P/DEC]

### 4.7 Prop Firm Session rules

- Profit target % (of starting balance), Max daily loss % (per UTC day, measured on equity
  against the day's starting balance), Max total loss % (equity vs starting balance).
- The **Prop Firm Rules** panel (Tab, or the button in the trading panel) shows each rule's
  progress with pass/fail. [FXR]
- Breaching a loss rule closes everything, stops the session and marks it **Failed**; reaching the
  profit target with no open position marks it **Passed** (replay may continue). [DEC]

---

## 5. On-chart trading UI

- **Quick Buy/Sell panel** (top-left of the chart): `SELL <bid>` · quantity · `BUY <ask>`, spread
  shown between. Clicking sells/buys at market with Scalper Mode SL/TP if active. [FXR]
- **Scalper Mode** button next to it: SL and TP toggles with a distance in pips, ticks or %, Auto
  BE by pips or R:R; Save turns the icon blue. Only distances, not prices. [FXR]
- **Position lines**: entry line in the side colour with a label `BUY 0.50 · +$1,234.00 ✕`;
  SL line orange with `SL · −$500.00 (−0.50%)`; TP line green with the projected profit. Lines and
  labels follow the price axis; labels sit at the right of the plot. [FXR colours]
- **Pending order lines**: dashed, label `BUY LIMIT 0.50 @ 2,031.40 ✕`, draggable to change the
  price.
- **Right-click on the chart** → `Buy Limit 0.50 @ 2,030.10` or `Sell Stop ...` depending on
  whether the clicked price is below or above the market, plus **Replay to this point** when a
  candle is under the pointer. Quantity comes from the Quick panel. [FXR]
- Drag gestures commit on release; Esc during a drag cancels it.

---

## 6. Trading panel (bottom)

Tabs: **Positions (n)**, **Orders (n)**, **History (n)**; on the right the account summary:
Balance · Equity · Floating P&L · Realized P&L · Win rate. [DEC layout; FXR terminology]

- Positions columns: Symbol, Side, Volume, Entry, Current, SL, TP, Pips, P&L, Opened, actions
  (BE, Partial, Edit, ✕).
- Orders columns: Symbol, Type, Volume, Price, SL, TP, Placed, actions (Edit, ✕).
- History columns: #, Side, Volume, Entry time, Entry, Exit time, Exit, SL, TP, Pips, Commission,
  P&L, R, Exit reason (TP / SL / Manual / Partial / Session end / Stop out / Rule breach).

---

## 7. Journal

Every closed trade is written to the session journal automatically; open trades appear as "Open".
[FXR]

- Per trade: entry/exit, P&L, duration, instrument, size, screenshots, notes and tags. [FXR]
- Extra fields: confidence (1–5) [FXR mentions "confidence level" as a filter], MAE/MFE in R.
- **Screenshot**: "Add screenshot" captures the current chart; screenshots are stored with the
  trade.
- Search box over notes, tags and phrases; filter by tag, side, outcome (win / loss / break-even),
  weekday and trading session (Asia / London / New York). [FXR]
- Journaling works even after the session ended. [FXR]

---

## 8. Analytics dashboard

Shown at the session end and any time from the session view or the sessions page. All figures use
closed trades (partials are aggregated into their trade). Win = net P&L > 0, loss < 0,
break-even = 0.

### 8.1 KPIs (FX Replay "Analytic Metrics Defined" + "Session Stats Overview")

| Metric                         | Definition                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Net P&L, Return %              | Σ net P&L; / starting balance                                                           |
| Total trades                   | count; with Long / Short split [FXR]                                                    |
| Winners / Losers / Break-even  | counts [FXR]                                                                            |
| Win rate                       | winners / total [FXR]                                                                   |
| Long win rate / Short win rate | per side [FXR "whether buys or sells perform better"]                                   |
| Gross profit / Gross loss      | Σ wins / Σ                                                                              | losses   |                              |
| Profit factor                  | gross profit / gross loss (∞ shown as "—" when no losses) [FXR]                         |
| Average win / Average loss     | mean of winners / losers [FXR]                                                          |
| Best win / Worst loss          | largest $ and % of balance at entry [FXR]                                               |
| Average RR                     | mean planned R:R `                                                                      | TP−entry | /                            | entry−SL | ` over trades that had both SL and TP [FXR] |
| Max RR                         | highest planned R:R of a single trade [FXR]                                             |
| Ideal RR                       | the TP R-multiple that would have maximised total R (from the RR simulator) [FXR]       |
| Average realized R             | mean of P&L / initial risk over trades with an SL                                       |
| Expectancy                     | win rate · avg win − loss rate · avg                                                    | loss     | ($ per trade) and in R [FXR] |
| Max drawdown                   | largest peak-to-trough decline of the closed-trade balance curve, $ and % of peak [FXR] |
| Average drawdown               | mean depth of drawdown episodes                                                         |
| Max consecutive wins / losses  | streaks [FXR]                                                                           |
| Average trade duration         | overall, winners, losers                                                                |
| Total commission               | Σ commission                                                                            |
| Recovery factor                | net P&L / max drawdown $                                                                |
| Sharpe (per trade)             | mean R / std R (trades with SL)                                                         |

### 8.2 Drawdown analytics (in R, winning trades only) [FXR]

Max / min / average of how far price went against each **winning** trade before it closed,
expressed in R (MAE / initial risk). "0.29 R means price retraced 29% of your initial risk before
hitting take profit."

### 8.3 RR simulator [FXR]

Takes the real trades (with an SL) and re-runs each one over the 1-minute data from its entry with
the same SL and a TP at `x · R` for `x ∈ {0.5, 1, 1.5, … 10}`, until SL, TP or session end. Shows,
per x: win rate, total R, profit factor, expectancy and average drawdown. The best x is the Ideal
RR.

### 8.4 Charts

- Equity curve (balance after each trade, and equity sampled per day) with drawdown underneath.
- P&L calendar: month grid, each day coloured by net P&L, showing trades, win %, R and breakeven
  days; switch month/year. [FXR]
- Performance per day of week (ranked) and per hour of entry (UTC). [FXR]
- Performance per trading session — Asia 00:00–08:00, London 08:00–13:00, New York 13:00–21:00
  UTC (entry time). [DEC: FX Replay has a help article on session hours; we could not read the
  exact hours]
- Average gains/losses by month, week and day. [FXR]
- Long vs short comparison; P&L distribution histogram; R-multiple distribution; duration vs P&L.
- Filters (side, tag, trading session) apply to the whole dashboard. [FXR "filter-aware"]

---

## 9. Hotkeys [FXR "Available hotkeys for FX Replay"]

| Action                 | Keys                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Emit next candle       | Ctrl + Space                                                                           |
| Play / Pause           | Alt + 1                                                                                |
| Frequency down / up    | Alt + 2 / Alt + 3                                                                      |
| Ticker value down / up | Alt + 4 / Alt + 5                                                                      |
| New order (ticket)     | Alt + ,                                                                                |
| New limit order        | Alt + B                                                                                |
| New stop order         | Alt + N                                                                                |
| New market order       | Alt + M                                                                                |
| Rewind one candle      | Alt + Z [DEC — FX Replay says rewind is keystroke-based but we could not read the key] |
| Prop Firm Rules panel  | Tab [FXR]                                                                              |
| Shortcut list          | Ctrl + Alt + H (Ctrl + Shift + H also) [FXR]                                           |

On macOS `Option` replaces `Alt`. In the backtest view these take priority over the chart's own
shortcuts (e.g. Alt+M is "magnet" on the plain chart). All other chart shortcuts keep working.

---

## 10. Data and symbols

- Symbol metadata (`BacktestSymbolSpec`): tick size, pip size, contract size, price precision,
  lot min/step/max, default spread, default commission, quote currency, trading hours. Adding a
  symbol = one catalogue entry plus data.
- XAUUSD: tick 0.01, pip 0.10, contract 100 oz, lots 0.01–100 step 0.01, default spread 0.20 USD,
  commission 0, USD.
- Mock data: deterministic (seeded) 1-minute XAUUSD bars from 2019-01-01 to 2025-12-31, trading
  Monday 00:00 → Friday 21:00 UTC with a daily break 21:00–22:00 UTC. Daily closes follow a
  random walk bridged through approximate real yearly levels (~1,280 in 2019 to ~3,000+ in
  2025); intraday volatility follows the Asia/London/New York rhythm with clustering. Every
  timeframe above 1m is aggregated from the 1-minute bars.

---

## 10a. Implementation notes (decisions made while building)

- Right-click orders use the Quick panel quantity and no SL/TP (add them by dragging the ghost
  handles); **New order at this price…** opens the ticket prefilled.
- A prop rule breach or stop out closes positions at the exact price where equity reaches the
  limit (equity is linear in the Bid, so the level is solved for), or at the open after a gap.
- The max daily loss is measured on equity against the balance at 00:00 UTC.
- Pressing Next candle while a step is still loading queues the press instead of dropping it.
- The countdown shows calendar days left (`ceil`), the progress bar the share of the range
  replayed.

## 11. Deliberate deviations from FX Replay (and why)

1. **Single asset per session** (FX Replay allows several). Only XAUUSD has data; the model keeps
   `symbol` per trade so multi-asset can be added.
2. **No editing of balance/date range after trades exist** — offered as _Duplicate_ instead, so
   the journal and stats can never disagree with the settings.
3. **Rewind removes later trades** (FX Replay does not document this) — keeps chart, journal and
   account consistent.
4. **Go to is forward-only and processes trades** — FX Replay's Go To Date is view-only.
5. **Intrabar path heuristic on 1-minute data** instead of tick data.
6. **UTC everywhere**; FX Replay lets you pick a time zone. Daily candles start at 00:00 UTC.
7. **No plans / plan limits, no battles, no multi-chart layouts, no economic calendar, no AI
   features, no live trading.**
8. **No margin / leverage**; stop-out at zero equity.

## Sources

- [Available hotkeys for FX Replay](https://support.fxreplay.com/articles/available-hotkeys-for-fx-replay)
- [How to Use Bar-by-Bar Rewind](https://support.fxreplay.com/articles/how-to-use-bar-by-bar-rewind)
- [How to Use Bar Replay / Right-Click Replay](https://support.fxreplay.com/articles/how-to-use-bar-replay---right-click-replay)
- [Go To Date Feature](https://support.fxreplay.com/articles/go-to-date-feature)
- [I am unable to play out my session](https://support.fxreplay.com/articles/i-am-unable-to-play-out-my-session)
- [General Session Basics](https://support.fxreplay.com/articles/general-session-basics)
- [Session Stats Overview](https://support.fxreplay.com/articles/session-stats-overview)
- [Analytic Metrics Defined](https://support.fxreplay.com/articles/analytic-metrics-defined)
- [Charts & Visual Performance Metrics](https://support.fxreplay.com/articles/charts-visual-performance-metrics)
- [How to Use Drawdown Analytics](https://support.fxreplay.com/articles/how-to-use-drawdown-analytics)
- [How to Use the RR Simulator](https://support.fxreplay.com/articles/how-to-use-the-rr-simulator)
- [How to Place Trades with Right-Click Order Execution](https://support.fxreplay.com/articles/how-to-place-trades-with-right-click-order-execution)
- [How to Drag and Place Stop Loss & Take Profit on the Chart](https://support.fxreplay.com/articles/how-to-drag-and-place-stop-loss-take-profit-on-the-chart)
- [How to Use Scalper Mode](https://support.fxreplay.com/articles/how-to-use-scalper-mode-for-faster-trade-execution)
- [Placing Buy and Sell Orders on FX Replay](https://support.fxreplay.com/articles/placing-buy-and-sell-orders-on-fx-replay)
- [Prop Firm Simulator](https://support.fxreplay.com/articles/prop-firm-simulator)
- [Tracking Your Trades with the Journal Feature](https://support.fxreplay.com/articles/tracking-your-trades-with-the-journal-feature)
- [Trades and Logging](https://support.fxreplay.com/articles/trades-and-logging)
- [Why FX Replay Is Built for Real Backtesting](https://www.fxreplay.com/blogs/why-fx-replay-is-built-for-real-backtesting-not-just-replays)
- [8 New Game-Changing Features Inside FX Replay](https://fxreplay.com/learn/eight-new-game-changing-features-inside-fx-replay)
- [What Are the Differences Between FX Replay Plans](https://support.fxreplay.com/articles/what-are-the-differences-between-fx-replay-plans-and-their-pricing)
- [FX Replay App (App Store)](https://apps.apple.com/us/app/fx-replay/id6798304311)
- [LuxAlgo — FX Replay overview](https://www.luxalgo.com/blog/fx-replay-backtesting-platform-overview/) (3P)
- [TradesPad — FX Replay review](https://tradespad.com/blog/fxreplay-review) (3P)
