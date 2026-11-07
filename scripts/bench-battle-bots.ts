/**
 * Per-poll server cost of bots in a live battle (npm run bench:bots).
 *
 * Scenario (same as the measurement of the previous implementation in docs/BATTLE-BOTS.md):
 * a 15-minute battle at 30×, one real trader whose cursor advances every second (the browser
 * reports it), k bots, one standings poll per second for the whole battle.
 */
import { ObjectId } from 'mongodb';
import { DEFAULT_SETTINGS, sortStandings } from '../src/lib/battles';
import { worldSlot } from '../src/lib/app/battle/bots/world';
import {
  botCacheStats,
  botStanding,
  materializeWorld,
  pumpBattle,
} from '../src/server/battles/bot-room';
import { battleMarket } from '../src/server/battles/market';
import { simulateParticipant } from '../src/server/battles/simulate';
import type { BattleDoc } from '../src/server/db';
import { botParticipant } from '../src/server/battles/bot-room';

const ctx = { market: battleMarket, busy: new Set<number>() };

function battle(bots: number): BattleDoc {
  const settings = {
    ...DEFAULT_SETTINGS,
    name: 'bench',
    assets: ['XAUUSD'],
    durationMin: 15,
    speed: 30,
    maxParticipants: 20,
  };
  const symbol = 'XAUUSD';
  const marketStart = battleMarket.pickStart(symbol, settings);
  const startedAt = 1_800_000_000_000;
  const base = { symbol, marketStart };
  const human = {
    userId: new ObjectId(),
    name: 'me',
    joinedAt: 0,
    startT: marketStart,
    startBid: battleMarket.bidBefore(symbol, marketStart),
    elo: 1000,
    games: 0,
    actions: [],
    cursor: marketStart,
    leftT: null,
  };
  return {
    _id: new ObjectId(),
    code: 'BENCH1',
    mode: 'casual',
    format: null,
    hostId: human.userId,
    bots: {
      origin: 'fill',
      seed: 1,
      tilt: 0,
      events: [],
      late: [],
      chat: [],
      startAt: null,
      endChat: false,
    },
    settings,
    symbol,
    marketStart,
    status: 'live',
    createdAt: 0,
    updatedAt: 0,
    countdownEndsAt: null,
    startedAt,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    endReason: null,
    participants: [
      human,
      ...Array.from({ length: bots }, (_, i) =>
        botParticipant(i * 7 + 3, base, 0, 0, battleMarket),
      ),
    ],
    chat: [],
    results: null,
    version: 0,
  };
}

function run(k: number) {
  let b = battle(k);
  const t0 = performance.now();
  const up = pumpBattle(b, b.startedAt!, ctx); // one-time plan of every bot
  b = { ...b, ...(up!.$set as object) } as BattleDoc;
  const planMs = performance.now() - t0;
  const polls = 15 * 60;
  let pumpMs = 0;
  let standMs = 0;
  let writes = 0;
  const heap0 = process.memoryUsage().heapUsed;
  for (let s = 1; s <= polls; s++) {
    const now = b.startedAt! + s * 1000;
    // The human's cursor report (a version bump): their account is re-simulated once.
    const h = b.participants[0]!;
    b = {
      ...b,
      version: b.version + 1,
      participants: [{ ...h, cursor: b.marketStart + s * 30_000 }, ...b.participants.slice(1)],
    };
    const a = performance.now();
    const u = pumpBattle(b, now, ctx);
    if (u) {
      writes += 1;
      b = { ...b, ...(u.$set as object) } as BattleDoc;
    }
    const m = performance.now();
    const me = b.participants[0]!;
    const humans = [simulateParticipant(b, me, me.cursor!).standing];
    const bots = b.participants.slice(1).map((p) => botStanding(b, p, now, battleMarket));
    sortStandings([...humans, ...bots]);
    standMs += performance.now() - m;
    pumpMs += m - a;
  }
  return {
    impl: 'new',
    bots: k,
    polls,
    msPerPoll: +((pumpMs + standMs) / polls).toFixed(3),
    pumpMsPerPoll: +(pumpMs / polls).toFixed(3),
    standingsMsPerPoll: +(standMs / polls).toFixed(3),
    botStandingUs: k ? +(((standMs / polls) * 1000) / (k + 1)).toFixed(1) : 0,
    planMsOnce: +planMs.toFixed(1),
    dbWritesPerBattle: writes,
    heapDeltaMB: +((process.memoryUsage().heapUsed - heap0) / 1e6).toFixed(1),
    botTrades: b.participants.slice(1).reduce((n, p) => n + p.actions.length, 0),
    caches: botCacheStats(),
  };
}

function world() {
  const t0 = performance.now();
  let made = 0;
  const now = 1_800_000_000_000;
  for (let slot = Math.floor(now / 30_000) - 150; slot <= Math.floor(now / 30_000); slot++) {
    if (materializeWorld(worldSlot(slot), now, { ...ctx, presence: 1 })) made += 1;
  }
  return {
    world: 'backlog of 150 slots (75 min)',
    materialized: made,
    ms: +(performance.now() - t0).toFixed(1),
  };
}

// Warm up the market caches so the numbers are steady-state.
run(1);
for (const k of [1, 5, 19]) console.log(JSON.stringify(run(k)));
console.log(JSON.stringify(world()));
