# Battle bots

Candelo launches with few users. An empty Battles lobby makes the platform look abandoned, and a
battle nobody else joins is not a competition. Bots solve that cold start. This note covers what
was wrong with the first implementation, what replaces it, and why.

## Findings (old implementation)

Measured on the seeded market with the old code (`planBotTrades` + `botTickUpdate`):

| Problem                              | Evidence                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P&L was always ≈ 0                   | Every bot traded the instrument's minimum lot (0.01) on a 100k account. Over 300 ranked duels the bot's final return stayed between −0.020% and +0.014%; 93% of bots ended within ±0.01%. A human sees an opponent stuck at `+0.00%` all battle.                                                                                          |
| It saw the next candle               | The SMA cross used the close of bar _i_, but the action was logged at bar _i_'s open time. The broker filled it at bar _i − 1_'s close, so the bot had one candle of look-ahead.                                                                                                                                                          |
| Same mechanical behaviour every time | One SMA(8/21) cross rule, fixed 12–26 pip stops, no sizing, no management, no emotions, never left, never chatted, never hesitated.                                                                                                                                                                                                       |
| Recognisable names                   | `Trader48219` (no space, five digits). Real default names are `Trader 1234` (a space and four digits), so bots stood out on every leaderboard.                                                                                                                                                                                            |
| Fake lobbies                         | Three fixed presets with the same names and 2 seats, all hosted by bots, created on demand with "created 0 s ago", never filling and never running. The countdown started the instant a human joined.                                                                                                                                     |
| Distorted Elo                        | Ranked duels against bots moved the human's Elo (at half K), and bots carried made-up Elo values that never appeared on the leaderboard.                                                                                                                                                                                                  |
| Results tell                         | Bots showed `+0` XP on the results screen next to humans' +100…+175.                                                                                                                                                                                                                                                                      |
| Cost                                 | Every poll wrote a document (bot cursor) and bumped the version, which invalidated the standings cache. As a result every poll re-simulated every account. Per poll, CPU was 0.8 ms (1 bot) and 4–5 ms (5–19 bots), plus one Mongo write per poll per battle. Writes also competed with human writes for the optimistic-concurrency lock. |

## Decisions

### Bots play by the human rules, on the same engine

A bot's account is a backtest `ExecutionEngine`, exactly like a human's. Every decision is a
regular `TradeAction` (market, pending, modify, close, partial close, break even) that the broker
must accept at that moment. The bot only sees candles that close before the moment it acts. The
action log is stored in `participants[].actions`, and standings and results come from the same
`simulateParticipant` → `resimulate` path as humans. A test re-simulates every planned log and
checks that it reproduces the planner's account to the cent. P&L therefore always comes from real
price movement under the battle's own spread, drawdown and target rules.

### Plan once, reveal by time (no per-poll work)

Bots never react to humans' trades (that would leak information both ways). Their trading is a
pure function of the market, the rules and their persona. So:

- A bot's whole log is computed **once**, when the battle is live and has a human in it. Battles
  with only bots never plan or simulate anything.
- Each bot steps through the replay at its own human-like pace (play bursts, thinking pauses, AFK
  stretches, late catch-up). Its **cursor is derived** from elapsed battle time (pauses excluded),
  so it is never written.
- Each bot's standing at every minute is precomputed in a compact typed-array timeline (LRU
  cache). A bot's live standing is an O(1) lookup. Human standings stay memoised per version.
- Writes happen only on discrete events: joins, leaves, start, chat, and the one-time plan.

### Personas

Every bot is one of 360 stable identities (a regular you meet again behaves the same way), drawn
with Zipf-like weights so a few are regulars and most appear rarely. A persona fixes:

- **Style:** trend/breakout, mean reversion, scalper, swing, impulsive (chases big candles),
  gut feeling, or cautious/idle.
- **Risk:** per-trade risk, typically 0.3–2.5%, with gamblers up to about 8%. Lots are rounded to
  human numbers (0.5, 1, 2, 5 …) unless the persona uses a risk calculator.
- **Discipline:** whether it uses a stop and a TP, the RR it aims for, break even at 1R, partial
  closes, cutting winners early (disposition effect), widening stops on losers, removing stops.
- **Temperament:** reaction delay, selectivity, cooldown, tilt (revenge sizing and overtrading
  after losses), going quiet after an early profit, rage-quitting after a big drawdown.
- **Competition sense:** locks in a lead late in a time trial, swings for the fences when behind,
  pushes for a profit target, and respects drawdown limits (or doesn't).
- **Pace and chat habits.**

Skill is a mix of these traits, not a hidden edge. The market has no exploitable signal, so
skilled bots lose less (fewer, better-sized trades, rarely disqualified), while beginners
overtrade, oversize and blow up. The field's spread comes out of behaviour, not out of
predetermined results. When filling a human's battle, the persona mix is tilted toward the human's
experience (battles played), so a newcomer meets a softer field and a regular meets a sharper one.

### The world (lobby ecology)

- **Deterministic schedule.** Public bot-hosted battles come from a seeded slot schedule over
  wall-clock time. The rate follows a Tehran-time diurnal curve: busy evenings, quiet nights,
  a livelier Friday. Settings: mostly gold, a random 20 or 30 day market window drawn from the
  last two years (replayed at 1440× so the real timer is 20 or 30 minutes), 6–10 seats, some
  duels, about a quarter Profit Target.
- **No backlog effect.** The first visitor after an idle period sees battles that were created
  minutes ago and are filling or already running, not a burst of brand-new lobbies. The world
  cursor is persisted, so a slot is decided once and battles never flicker in and out.
- **Always something to join.** At normal hours the tick keeps one open lobby (two at peak).
  If the schedule has none waiting, a new one appears, the way a host creates one. Before
  dawn the lobby may be genuinely quiet. Concurrent world battles are hard-capped at 10
  (`WORLD_MAX_ACTIVE`); the hub pumps due bot lobby events so hosts start or close on time.
- **Lobbies grow and drain.** Joins arrive as a Poisson process whose rate depends on the battle's
  appeal and the hour. Hosts start when enough traders are in (or after their patience runs out),
  sometimes close an empty lobby, and waiting traders sometimes leave. When a human joins a
  bot-hosted lobby, the host notices and starts within roughly 20–60 s.
- **Human-hosted battles.** Public battles hosted by humans get a trickle of bots (first arrival
  usually 15–90 s), never the last seat, with churn if the host waits long. Private battles never
  get bots: strangers cannot join them.

### Hard constraints

| Constraint                         | How                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real users take priority           | A human joining a full battle takes a bot's seat (the bot leaves the lobby, or forfeits mid-battle). Bots never take the last free seat of a human-hosted battle. Bot hosts start soon after a human joins. Ranked matchmaking is human-only.                                                                                                                                                                                                                    |
| Never distort Elo or rankings      | Bots are never in ranked battles, so Elo, ranked W/L, peak and global rank only ever come from human-vs-human play. Bots have no profiles, so they never appear on any leaderboard, and they show the start Elo (1000) like any trader without ranked games.                                                                                                                                                                                                     |
| Never distort users' stats         | XP placement bonuses are computed among humans only, so beating bots cannot inflate XP or the XP leaderboard. Wins and podiums against bots are shown in the user's totals (consistent with the results screen they saw) but are also stored in separate `vsBots` counters, so every human-only figure stays exact. Admin overview counts exclude bots.                                                                                                          |
| Identifiable in the data           | `participants[].isBot` + `participants[].bot` (pool identity, plan state), `battles.bots` (origin: world / fill / duel, schedule), `results[].isBot`, and the identity registry (`botIndexOf`). Bot ids are deliberately ordinary-looking ObjectIds (a 2025–26 timestamp + random bytes) because ids reach the browser: a recognisable prefix would be a tell for anyone opening devtools. The flags are stripped before standings and results leave the server. |
| Configurable and able to phase out | Env vars `BATTLE_BOTS` (on/off), `BATTLE_BOTS_LEVEL` (0–1) and `BATTLE_BOTS_PHASE_OUT` (concurrent humans at which bots are gone), overridable at runtime from the admin battles page. World rate and fill sizes shrink linearly as concurrent real traders grow, and reach zero at the phase-out level.                                                                                                                                                         |

### Ranked matchmaking

The queue only pairs humans. If nobody in range shows up within 40 s, the user is offered an
**unrated duel** with the same rules against a trader looking for a casual duel. It is labelled
unrated, never moves Elo, and searching continues if they decline.

## Trade-offs and limits

- **Leaderboard.** By the constraint above, bots cannot appear on the XP or Elo leaderboard. A user
  who searches the leaderboard for an opponent they met will not find them. A large identity pool
  and a low repeat rate keep this rare. A future "minimum battles" rule or a seasonal leaderboard
  would make the gap look natural.
- **Bots don't converse.** They greet, react to their own trades and say gg. Apart from answering a
  greeting, they never reply to what humans write, since a wrong reply is worse than silence.
- **Bots don't adapt to humans' trades,** by design (no information leak, deterministic).
  Late-game decisions use their own return and time left only.
- **Bot-only battles never simulate.** They end on time, and a Profit Target bot battle doesn't
  allow late entries, so a human can never join a battle that "should" already be over.

## Code

```
src/lib/app/battle/bots/   pure, deterministic bot core (no I/O)
  rng.ts                   seeded PRNG and hashing
  identity.ts              bot ids, the 360-identity pool, names
  persona.ts               traits from an identity, tilted by the field
  pace.ts                  replay cursor over battle time
  indicators.ts            incremental EMA / ATR / RSI / Donchian on revealed bars
  brain.ts                 one decision step on the live engine
  planner.ts               plans a full battle → action log + standing timeline
  timeline.ts              compact per-minute standings
  lobby.ts                 fill/start/leave schedules of a lobby
  world.ts                 diurnal world schedule and battle presets
  chat.ts                  sparse, persona-driven chat lines
  config.ts                presence level and phase-out
src/server/battles/bots.ts     the glue: pump, plans, world tick, eviction
```

`npm run bench:bots` measures per-poll and planning cost.

## Measurements

Same scenario before and after: a 15-minute battle at 30×, one real trader, one standings poll
per second for the whole battle (`npm run bench:bots`; the old numbers were measured on the old
code before it was removed).

| Bots in the battle | Old CPU / poll | New CPU / poll | Old DB writes / battle | New DB writes / battle |
| ------------------ | -------------- | -------------- | ---------------------- | ---------------------- |
| 1                  | 0.78 ms        | 0.026 ms       | 900 (one per poll)     | 0                      |
| 5                  | 4.04 ms        | 0.041 ms       | 900                    | 0                      |
| 19                 | 4.95 ms        | 0.094 ms       | 900                    | 4 (forfeits, chat)     |

Planning every bot of a battle costs 8–45 ms, once, when a real user is in the battle.
Materialising a 75-minute world backlog (150 slots) after an idle period costs about 80 ms.
A bot's live standing is a 4–12 µs lookup.

Lobby over a simulated week (Tehran time), from the schedule alone, before the open-lobby
floor: about 10–11 public battles visible at 21–22h (hard-capped at 10 concurrent world
battles; 2–3 of them waiting for players), 5–6 at noon, ~7 at midnight, under 1 at 04–05h.

Outcomes over 140 simulated battles with full fields (about 1,000 bots, `tests/battles/bots`):
median return ≈ 0%, p10 −3.6%, p90 +2.4%. The median bot makes 4 trades and 6–7% make none.
7% are disqualified, 4% forfeit, and 45% of trades win. The winner's median return is about +1.9%,
and someone reaches the profit target in about 60% of Profit Target battles. The old bots ended
93% of duels within ±0.01%.
`tests/battles/bots/*` covers decisions, fill, outcome distributions and engine agreement.
