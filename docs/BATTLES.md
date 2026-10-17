# Battles (`/battle`)

Trading competitions modelled on FX Replay's **FXR Battles**: every trader in a battle gets the
same historical market, revealed candle by candle on a shared clock, with a simulated account.
The best return (or the first to the profit target) wins. Ranked battles come from matchmaking
and move the trader's Elo; custom battles are casual.

## What it is modelled on

FX Replay's site and help center could not be opened from the build environment (the network
policy blocks `fxreplay.com`), so screenshots were not available. The behaviour follows what
their public pages say, as quoted by search results: the Battles help center articles
(_General Overview_, _Battle Creation & Hosting_, _Battle Types & Objectives_, _Battle Flow &
Controls_, _Rules & Mechanics_, _Navigation & Participation_), the launch post _Introducing FX
Replay Battles_, _What Are FX Replay Battles?_, _FX Replay Battles Leaderboard: More Than Just
a High Score_, the _FXR Battles has been fully reimagined_ update and the July 2025 press
release. Where they are silent, the choice made here is listed under **Decisions**.

| FXR Battles (documented)                                                                                                              | Here                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Battles page in the main navigation: public battles, joined battles, global leaderboard                                               | `/battle`: Play · Browse · My Battles · Leaderboard tabs, profile card                                     |
| **New Battle** with creation steps for rules, balance, assets, limits                                                                 | Four-step dialog: type → market & account → rules → review                                                 |
| Starting balance, up to 5 assets, duration 1–99 min, profit target, max drawdown, max daily drawdown, max participants, win condition | All of them (and replay speed, late entries)                                                               |
| Time Trial (best result when time runs out) and Profit Target (first to target)                                                       | `time-trial` / `profit-target`; a Profit Target battle that runs out of time falls back to the best return |
| Public battles anyone can join; private ones need an invite or the battle ID                                                          | Visibility; 6-character battle ID, invite link, "Join by ID" box                                           |
| Standby (lobby) → countdown at the top → In Progress → finished                                                                       | `standby → countdown (10 s) → live ⇄ paused → completed`                                                   |
| Joining an In Progress battle if it allows new entries                                                                                | "Allow late entries": late joiners start at the current candle                                             |
| Host can pause, stop (end early) and restart; restart resets progress                                                                 | Admin tab: Pause / Resume, Restart (resets every account), End battle now; Close lobby                     |
| Breaking a rule (e.g. max drawdown) disqualifies                                                                                      | Drawdown limits are broker rules: breaching one closes everything and disqualifies                         |
| Live leaderboard during the battle: button at the bottom or hold **Tab**                                                              | Sidebar leaderboard, HUD button, hold **Tab** for the overlay                                              |
| Sidebar with chat, admin functions and leaderboards                                                                                   | Sidebar tabs: Leaderboard · Chat · Rules · Admin (host)                                                    |
| Results finalised when the timer ends or a target is met; podium / leaderboard                                                        | Results screen: podium, your place / return / Elo change / XP, final standings                             |
| Casual (no ranking) and Ranked (Elo, eight ranks Rookie → Master)                                                                     | Custom battles are casual; Ranked Duel and Ranked Sprint use matchmaking                                   |
| Elo updates after each ranked battle; beating stronger traders earns more                                                             | Multiplayer Elo with K = 48 (first 10 games) / 32                                                          |
| Composite Score ("trader XP") for taking part, milestones and streaks                                                                 | XP per battle, levels; separate leaderboard sort                                                           |
| Profile: Elo rank and tier, stats (avg RR, win rate), battle history                                                                  | Profile card (Elo, peak, tier progress, win rates, streaks, returns), My Battles                           |
| Simulated accounts on historical data, no real money                                                                                  | Seeded historical-style 1-minute data, simulated broker                                                    |

## Flow

1. **Play** tab: _Find match_ on Ranked Duel (1v1 · 10 min · Time Trial) or Ranked Sprint (1v1 ·
   5 min · first to +2%). The queue pairs traders whose Elo is within ±150, widening by 50 every
   5 s. When a match is found both traders are sent to the battle and a 15-second countdown runs.
2. **New Battle** creates a custom battle and opens its lobby. Share the battle ID or the invite
   link; public battles also appear in **Browse**.
3. The host presses **Start battle**: a 10-second countdown, then the market (drawn from the
   asset pool) is revealed and the shared clock starts. At 30× one 1-minute candle closes every
   2 s.
4. Trade with Quick Buy/Sell, the order ticket (market / limit / stop, SL/TP, risk sizing),
   right-click orders, drag-to-modify lines, partial close and break even, exactly as in a
   backtest session. The live leaderboard ranks everyone by return on equity.
5. The battle ends when the timer runs out, when someone closes at the profit target, when every
   trader is out, or when the host ends it. Trading locks, open trades close at the last price,
   and the results screen shows the podium, Elo changes (ranked) and Composite Score.

## Architecture

```
src/lib/battles        pure rules (core only): BattleSettings + validation, the battle clock
                       (marketCursor), Elo, ranks, standings order, XP, API view types
src/lib/app/battle     BattleRuntime: a battle seat on the chart (cursor-gated data, the
                       backtest controller following the battle clock), battle → broker config
src/server/battles     service (lifecycle, controls, actions, chat), simulate (accounts),
                       market (seeded data, start picking), queue (matchmaking), profiles
                       (Elo, stats, leaderboard), views (API shapes), http (route plumbing)
src/app/api/battles    REST endpoints (below)
src/components/battles hub, New Battle dialog, room/ (lobby, arena, sidebar, results)
```

### One engine, two places

Each trader's account runs in their browser on the backtest `ExecutionEngine`, driven by the
battle clock (`BacktestController.follow`). Every action is sent to the server with the market
time it was taken at. The server stores the action log and re-simulates each account from it
over the same seeded 1-minute bars (`resimulate`), so standings, disqualifications and results
are computed by the server and cannot be forged by a client. Both sides build the account rules
from `battleSessionSettings`, and a unit test checks that a re-simulated log equals trading step
by step.

The server accepts an action only while the battle is live, at a market time within a few
candles of its own cursor, after the trader's previous action, and only if the broker accepts it
at that moment. A rejected action makes the browser resync its account from the server's log.

### Clock

The clock only counts the battle's time limit. Each trader steps through the candles themselves
with the Price Skipper (play / pause, next candle, ticker value, frequency; forward only, no
rewind), up to the market's last candle (`marketStart + duration × speed`). The browser reports
its position (`POST /api/battles/:id/cursor`) and every action moves it too; standings are
computed at each trader's own position. The battle
start is a random weekday morning in the instrument's history, early enough that the whole
replay (`duration × speed`, at most one trading week) never crosses a weekend.

### No background worker

Time-driven transitions (countdown → live, timer expiry, profit target, everyone out) are
applied on read by `refresh()`; every write uses optimistic concurrency (`version`), and the
request whose completion write wins records Elo and stats exactly once. Live standings are
memoised per battle version and cursor.

## API

| Method & path                        | Body / query                | Does                                             |
| ------------------------------------ | --------------------------- | ------------------------------------------------ |
| `GET /api/battles`                   | `?tab=browse` · `?tab=mine` | Public lobbies / battles in progress, or yours   |
| `POST /api/battles`                  | `{ settings }`              | Creates a custom battle → `{ id, code }`         |
| `GET /api/battles/:id`               |                             | The battle as you see it (polled ~1/s)           |
| `POST /api/battles/:id/join`         | `{ code? }`                 | Joins (code required for private battles)        |
| `POST /api/battles/join-code`        | `{ code }`                  | Finds a battle by ID and joins it → `{ id }`     |
| `POST /api/battles/:id/leave`        |                             | Leaves the lobby, or forfeits a running battle   |
| `POST /api/battles/:id/control`      | `{ op }`                    | Host: start, pause, resume, restart, end, cancel |
| `POST /api/battles/:id/actions`      | `{ t, action }`             | A trade action at market time `t`                |
| `POST /api/battles/:id/chat`         | `{ text }`                  | Chat message                                     |
| `GET/POST/DELETE /api/battles/queue` | `{ format }` · `?ack=1`     | Ranked matchmaking: poll, join, leave            |
| `GET /api/battles/leaderboard`       | `?sort=elo` · `?sort=xp`    | Global leaderboard                               |
| `GET/PATCH /api/battles/profile`     | `{ name }`                  | Your profile and active battle; rename           |

All routes need a signed-in user; writes are same-origin only.

## Database

MongoDB, with versioned migrations in `src/server/migrations.ts` (applied automatically on the
first connection, recorded in `migrations`, guarded by a lock):

- `001-core-indexes`: the indexes that used to be created inline.
- `002-user-display-names`: `users.displayName` ("Trader 1234"), shown on leaderboards.
- `003-battles`: indexes for `battles`, `battle_profiles` and `battle_queue` (stale queue
  entries expire after 10 minutes).

| Collection        | Holds                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `battles`         | settings, market, status and clock, participants with their action logs, chat, final results, `version` |
| `battle_profiles` | Elo, peak, ranked W/L, battles, wins, podiums, Composite Score, streaks, trade and return stats         |
| `battle_queue`    | ranked searchers: format, Elo, wait start, heartbeat, match                                             |

## Decisions

- **Ranks**: Rookie < 1100 ≤ Bronze < 1250 ≤ Silver < 1400 ≤ Gold < 1550 ≤ Platinum < 1700 ≤
  Diamond < 1850 ≤ Elite < 2000 ≤ Master. Everyone starts at 1000 Elo (Rookie). FX Replay
  documents eight ranks from Rookie to Master but not the names in between or the thresholds.
- **Elo**: every pair of players counts as a game (better place = 1, tie = ½), each weighted
  K / (n − 1). Leaving ranks you below the traders still in; disqualification ranks you last.
- **Composite Score**: +100 per finished battle, +50 for a win, +25 for a podium (4+ traders),
  +5 per winning trade (max 10), +50 for a win on a 3+ streak; 25 if disqualified, 0 if you left.
  Levels need 300, 400, 500… XP.
- **Assets**: the battle's market is drawn at random from its pool when it is created and
  revealed at the countdown, so nobody can study it in advance. Five instruments are available:
  XAUUSD, EURUSD, GBPUSD, AUDUSD, NAS100 (seeded data).
- **Profit target** counts closed balance (open trades must be closed), like a prop-firm target.
- **Max drawdown** is measured from the starting balance; the daily limit from the day's
  starting balance, both as a percent of the starting balance.
- **Ranked formats** have fixed rules so ratings are comparable. Custom battles never touch Elo.
- **Transport** is polling (about once a second), which works on any host without websockets.

## Tests

```bash
npx vitest run tests/battles
```

Settings validation, the clock (speed, pauses, end), Elo (duels, upsets, ties, free-for-all),
ranks, standings order and ties, Composite Score and levels, and server/browser agreement on an
account. Browser end-to-end runs (Playwright against `next dev`, two or three signed-in users)
covered: create → lobby → join from Browse and by battle ID → chat → start → countdown → trade
→ hold Tab → results; ranked matchmaking → countdown → trade → Elo change → leaderboard; pause
(timer frozen) / resume / restart / end; late join on a phone; disqualification on max drawdown.
