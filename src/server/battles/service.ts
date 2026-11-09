import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { ObjectId, type Filter, type UpdateFilter } from 'mongodb';
import { isGreeting } from '@/lib/app/battle/bots/chat';
import { tradeActionSchema, type TradeAction } from '@/lib/backtest';
import { historyDenial } from '@/lib/app/billing/entitlements';
import { isAdminPhone } from '../admin-http';
import {
  PlanDenied,
  assertBattleChat,
  planOf,
  releaseBattleSlot,
  takeBattleSlot,
} from '../billing';
import {
  COUNTDOWN_MS,
  LOBBY_MAX_AGE_MS,
  MAX_ACTIONS,
  MAX_CHAT,
  START_ELO,
  battleCode,
  eloChanges,
  elapsedMs,
  durationMs,
  marketEnd,
  USER_SPAN_MARKET_DAYS,
  longSpanFromDays,
  normalizeSettings,
  placesOf,
  sortStandings,
  validateBattleSettings,
  xpFor,
  type BattleSettings,
  type FinalResult,
  type RankedFormat,
  type Standing,
} from '@/lib/battles';
import { DAY_MS, MINUTE_MS } from '@/lib/core';
import {
  deletePositionEvents,
  deleteScopeEvents,
  replacePositionEvents,
} from '../backtest/positions';
import { collections, type BattleChatDoc, type BattleDoc, type BattleParticipantDoc } from '../db';
import {
  botStanding,
  clockOf,
  evictBotFor,
  hasHuman,
  isBot,
  onHumanChat,
  onHumanJoined,
  pumpBattle,
  pumpNeedsBusy,
  seatCursor,
  seatsTaken,
  tiltFor,
} from './bot-room';
import { botXp, busyBots, fillFor, noteHumanActivity } from './bots';
import {
  battleDataRange,
  battleMarket,
  bidBefore,
  pick,
  pickMarketStart,
  randomUnit,
} from './market';
import { simulateParticipant, validateAction } from './simulate';
import { ensureProfile } from './profiles';

export class BattleError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** A signed-in user (bots are never Players: they only exist as battle seats). */
export interface Player {
  readonly _id: ObjectId;
  readonly name: string;
  /** Present on API-created battles; used for admin-only settings. */
  readonly phone?: string;
}

export { clockOf };

const endOf = (b: BattleDoc) => marketEnd(clockOf(b));

/**
 * Market time a trader has replayed up to (they step through the candles themselves). A bot's
 * cursor is derived from battle time and its pace.
 */
export const cursorOf = (b: BattleDoc, p: BattleParticipantDoc, now = Date.now()) =>
  seatCursor(b, p, now, battleMarket);

const floorMinute = (t: number) => Math.floor(t / MINUTE_MS) * MINUTE_MS;

const systemMessage = (text: string, at: number): BattleChatDoc => ({
  id: randomUUID(),
  userId: null,
  name: 'System',
  text,
  at,
  system: true,
});

export async function loadBattle(id: string): Promise<BattleDoc> {
  if (!ObjectId.isValid(id)) throw new BattleError('Battle not found', 404);
  const { battles } = await collections();
  const b = await battles.findOne({ _id: new ObjectId(id) });
  if (!b) throw new BattleError('Battle not found', 404);
  return b;
}

/**
 * Writes an update if nobody changed the battle since it was read (`version`); returns the new
 * document, or null when another request won the race (the caller reloads and retries).
 */
async function commit(b: BattleDoc, update: UpdateFilter<BattleDoc>): Promise<BattleDoc | null> {
  const { battles } = await collections();
  const set = { ...(update.$set ?? {}), updatedAt: Date.now() };
  return battles.findOneAndUpdate(
    { _id: b._id, version: b.version } as Filter<BattleDoc>,
    { ...update, $set: set, $inc: { ...(update.$inc ?? {}), version: 1 } },
    { returnDocument: 'after' },
  );
}

/** Runs `fn` on the latest battle until its write wins (optimistic concurrency). */
async function mutate(
  id: ObjectId,
  fn: (b: BattleDoc, now: number) => UpdateFilter<BattleDoc> | null,
): Promise<BattleDoc> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const fresh = await refresh(await loadBattle(id.toHexString()));
    const update = fn(fresh, Date.now());
    if (!update) return fresh;
    const out = await commit(fresh, update);
    if (out) return out;
  }
  throw new BattleError('The battle is busy, try again', 409);
}

function newParticipant(
  user: Player,
  b: Pick<BattleDoc, 'symbol' | 'marketStart'>,
  startT: number,
  profile: { elo: number; rankedGames: number },
  now: number,
): BattleParticipantDoc {
  return {
    userId: user._id,
    name: user.name,
    joinedAt: now,
    startT,
    startBid: bidBefore(b.symbol, startT),
    elo: profile.elo,
    games: profile.rankedGames,
    actions: [],
    cursor: startT,
    leftT: null,
  };
}

export async function uniqueCode(): Promise<string> {
  const { battles } = await collections();
  for (;;) {
    const code = battleCode(randomUnit);
    if (!(await battles.findOne({ code }, { projection: { _id: 1 } }))) return code;
  }
}

/** A host's custom (casual) battle, waiting in the lobby. */
export async function createBattle(host: Player, input: BattleSettings): Promise<BattleDoc> {
  const isAdmin = !!(host.phone && isAdminPhone(host.phone));
  // Normal hosts get a fixed 15-day random replay; only admins may pin a custom history window
  // or short-span duration/speed for time trials.
  const incoming = isAdmin
    ? input
    : {
        ...input,
        historyStart: null,
        historyEnd: null,
        ...(input.winCondition === 'time-trial' ? longSpanFromDays(USER_SPAN_MARKET_DAYS) : {}),
      };
  const settings = normalizeSettings(incoming);
  const error = validateBattleSettings(settings);
  if (error) throw new BattleError(error);
  const symbol = pick(settings.assets);
  const range = battleDataRange(symbol);
  const lastDay = range.end - DAY_MS;
  if (settings.historyStart !== null && settings.historyEnd !== null) {
    if (settings.historyStart < range.start || settings.historyEnd > lastDay)
      throw new BattleError('History range is outside available data');
    // Admins may pick any stored window; everyone else stays on their plan's history limit.
    if (!isAdmin) {
      const plan = await planOf(host._id);
      const denial = historyDenial(plan, settings.historyStart, range);
      if (denial) throw new PlanDenied(denial);
    }
  }
  const { battles } = await collections();
  const now = Date.now();
  const marketStart = pickMarketStart(symbol, settings);
  const profile = await ensureProfile(host._id);
  const doc: BattleDoc = {
    _id: new ObjectId(),
    code: await uniqueCode(),
    mode: 'casual',
    format: null,
    hostId: host._id,
    settings,
    symbol,
    marketStart,
    status: 'standby',
    createdAt: now,
    updatedAt: now,
    countdownEndsAt: null,
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    endReason: null,
    participants: [newParticipant(host, { symbol, marketStart }, marketStart, profile, now)],
    chat: [systemMessage(`${host.name} created the battle`, now)],
    results: null,
    version: 0,
  };
  // Public lobbies of real users get company; private ones never do (strangers can't join).
  const bots = await fillFor(doc, tiltFor(profile.battles));
  if (bots) doc.bots = bots;
  await takeBattleSlot(host._id, 'join');
  try {
    await battles.insertOne(doc);
  } catch (e) {
    await releaseBattleSlot(host._id);
    throw e;
  }
  return doc;
}

/** A matchmade ranked battle; the countdown starts right away. */
/** A matchmade ranked battle between real users (bots never play ranked: Elo stays real). */
export async function createRankedBattle(
  id: ObjectId,
  format: RankedFormat,
  players: readonly Player[],
): Promise<BattleDoc> {
  const { battles } = await collections();
  const now = Date.now();
  const settings = format.settings;
  const symbol = pick(settings.assets);
  const marketStart = pickMarketStart(symbol, settings);
  const participants: BattleParticipantDoc[] = [];
  for (const p of players) {
    const profile = await ensureProfile(p._id);
    participants.push(
      newParticipant(
        p,
        { symbol, marketStart },
        marketStart,
        {
          elo: profile.elo,
          rankedGames: profile.rankedGames,
        },
        now,
      ),
    );
  }
  const doc: BattleDoc = {
    _id: id,
    code: await uniqueCode(),
    mode: 'ranked',
    format: format.id,
    hostId: null,
    settings,
    symbol,
    marketStart,
    status: 'countdown',
    createdAt: now,
    updatedAt: now,
    countdownEndsAt: now + COUNTDOWN_MS + 5_000,
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    endReason: null,
    participants,
    chat: [systemMessage(`Match found: ${players.map((p) => p.name).join(' vs ')}`, now)],
    results: null,
    version: 0,
  };
  const taken: ObjectId[] = [];
  try {
    for (const p of players) {
      await takeBattleSlot(p._id, 'ranked');
      taken.push(p._id);
    }
    await battles.insertOne(doc);
  } catch (e) {
    await Promise.all(taken.map((uid) => releaseBattleSlot(uid)));
    throw e;
  }
  return doc;
}

// ---- lifecycle ---------------------------------------------------------------------------

const standingsCache = new Map<string, Standing[]>();
const STANDINGS_CACHE_SIZE = 200;

/** Real users' standings, memoised per battle version (they only change when someone acts). */
function humanStandings(b: BattleDoc): Standing[] {
  const key = `${b._id.toHexString()}:${b.version}`;
  const cached = standingsCache.get(key);
  if (cached) return cached;
  const out = b.participants
    .filter((p) => !isBot(p) || !p.bot)
    .map((p) => simulateParticipant(b, p, cursorOf(b, p)).standing);
  standingsCache.set(key, out);
  if (standingsCache.size > STANDINGS_CACHE_SIZE)
    standingsCache.delete(standingsCache.keys().next().value!);
  return out;
}

/**
 * Every participant's live standing at their own replay cursor, in leaderboard order. Real users
 * are re-simulated once per battle version; bots are a lookup in their precomputed timelines
 * at their derived cursor, so polling costs nothing per bot.
 */
export function liveStandings(b: BattleDoc, now = Date.now()): Standing[] {
  const humans = humanStandings(b);
  const bots = b.participants
    .filter((p) => isBot(p) && p.bot)
    .map((p) => botStanding(b, p, now, battleMarket));
  return sortStandings([...humans, ...bots]);
}

/**
 * Applies time-driven transitions: due bot events (lobby joins, a bot host's start, plans,
 * forfeits, chat), lobby expiry, the countdown ending, the timer running out, a profit target
 * being reached or every trader being out. Called on every read, so battles advance without a
 * background worker.
 */
export async function refresh(b: BattleDoc): Promise<BattleDoc> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now();
    if (b.bots) {
      const busy = pumpNeedsBusy(b, now) ? await busyBots(b._id) : new Set<number>();
      const botUpdate = pumpBattle(b, now, { market: battleMarket, busy });
      if (botUpdate) {
        const advanced = await commit(b, botUpdate);
        b = advanced ?? (await loadBattle(b._id.toHexString()));
        continue;
      }
    }
    const update = transition(b, now);
    if (!update) return b;
    const out = await commit(b, update.set);
    if (out) {
      if (update.completed) await recordResults(out);
      else if (out.status === 'cancelled')
        await Promise.all(
          out.participants.filter((p) => !isBot(p)).map((p) => releaseBattleSlot(p.userId)),
        );
      // A countdown that ended may be followed by an immediate completion check.
      b = out;
      continue;
    }
    b = await loadBattle(b._id.toHexString());
  }
  return b;
}

function transition(
  b: BattleDoc,
  now: number,
): { set: UpdateFilter<BattleDoc>; completed: boolean } | null {
  if (b.status === 'standby' && now - b.createdAt >= LOBBY_MAX_AGE_MS) {
    return {
      completed: false,
      set: {
        $set: { status: 'cancelled', endReason: 'Lobby expired' },
        $push: {
          chat: { $each: [systemMessage('Lobby expired', now)], $slice: -MAX_CHAT },
        },
      },
    };
  }
  if (b.status === 'countdown' && b.countdownEndsAt !== null && now >= b.countdownEndsAt) {
    return {
      completed: false,
      set: {
        $set: { status: 'live', startedAt: b.countdownEndsAt },
        $push: {
          chat: { $each: [systemMessage('The battle has started', now)], $slice: -MAX_CHAT },
        },
      },
    };
  }
  if (b.status !== 'live' && b.status !== 'paused') return null;
  const clock = clockOf(b);
  if (elapsedMs(clock, now) >= durationMs(clock)) return complete(b, 'Time is up', now);
  if (b.status === 'paused') return null;
  // Nobody real is watching a bot-only battle: it simply runs out its time (no simulation).
  if (!hasHuman(b)) return null;
  const standings = liveStandings(b, now);
  if (b.settings.winCondition === 'profit-target') {
    const hit = standings.filter((s) => s.status === 'target' && s.targetAt !== null);
    if (hit.length > 0) {
      const at = Math.min(...hit.map((s) => s.targetAt!));
      const winner = hit.find((s) => s.targetAt === at)!;
      return complete(b, `${winner.name} reached the profit target`, now);
    }
  }
  const out = (s: Standing) => s.status === 'disqualified' || s.status === 'left';
  if (standings.every(out)) return complete(b, 'Every trader is out', now);
  const end = endOf(b);
  const done = b.participants.every(
    (p) => out(standingOf(standings, p)) || cursorOf(b, p, now) >= end,
  );
  if (done) return complete(b, 'Every trader reached the end of the market', now);
  return null;
}

const standingOf = (standings: readonly Standing[], p: BattleParticipantDoc) =>
  standings.find((s) => s.userId === p.userId.toHexString())!;

/** A bot that has reached its planned forfeit counts as gone (even before the pump wrote it). */
function settled(b: BattleDoc, p: BattleParticipantDoc, now: number): BattleParticipantDoc {
  if (!p.bot || p.leftT !== null || p.bot.leaveT === null) return p;
  return cursorOf(b, p, now) >= p.bot.leaveT ? { ...p, leftT: p.bot.leaveT } : p;
}

function complete(b: BattleDoc, reason: string, now: number) {
  // Final accounts come from the same re-simulation for everyone, bots included.
  const finals = hasHuman(b)
    ? sortStandings(
        b.participants.map(
          (p) => simulateParticipant(b, settled(b, p, now), cursorOf(b, p, now), true).standing,
        ),
      )
    : [];
  const places = placesOf(finals);
  const results: FinalResult[] = finals.map((s) => ({
    ...s,
    place: places.get(s.userId)!,
    eloBefore: null,
    eloAfter: null,
    xp: 0,
  }));
  // The timer freezes where it was (at most at the battle's duration).
  const endedAt =
    b.startedAt === null
      ? now
      : Math.min(b.pausedAt ?? now, b.startedAt + b.pausedMs + durationMs(clockOf(b)));
  return {
    completed: true,
    set: {
      $set: {
        status: 'completed' as const,
        endedAt: Math.max(endedAt, b.startedAt ?? endedAt),
        pausedAt: null,
        endReason: reason,
        results,
      },
      $push: {
        chat: {
          $each: [systemMessage(`Battle over: ${reason}. Winner: ${finals[0]?.name ?? '—'}`, now)],
          $slice: -MAX_CHAT,
        },
      },
    },
  };
}

/**
 * After a battle completes (exactly once, by the request whose write won): Elo for ranked
 * battles, Composite Score and lifetime stats for real users.
 *
 * Bots never get a profile and never touch Elo (they are never in ranked battles; a legacy
 * ranked battle with a bot is recorded unrated). With bots in the field, XP placement bonuses
 * are earned among real users only, so beating bots can't inflate XP or its leaderboard; wins
 * and podiums count in the user's totals (matching the results screen) and again in
 * `vsBots`, so human-vs-human figures stay exact.
 */
async function recordResults(b: BattleDoc): Promise<void> {
  const results = b.results;
  if (!results) return;
  const { battleProfiles, battles } = await collections();
  const botIds = new Set(b.participants.filter(isBot).map((p) => p.userId.toHexString()));
  const withBots = botIds.size > 0;
  const profiles = new Map<string, Awaited<ReturnType<typeof ensureProfile>>>();
  for (const r of results) {
    if (botIds.has(r.userId)) continue;
    profiles.set(r.userId, await ensureProfile(new ObjectId(r.userId)));
  }
  const ranked = b.mode === 'ranked' && !withBots;
  const humans = results.filter((r) => !botIds.has(r.userId));
  const humanPlaces = new Map(
    humans.map((r) => [r.userId, 1 + humans.filter((o) => o.place < r.place).length]),
  );
  const deltas = ranked
    ? eloChanges(
        humans.map((r) => {
          const prof = profiles.get(r.userId)!;
          return { id: r.userId, rating: prof.elo, games: prof.rankedGames };
        }),
        new Map(humans.map((r) => [r.userId, r.place])),
      )
    : null;
  const n = results.length;
  const out: FinalResult[] = [];
  for (const r of results) {
    if (botIds.has(r.userId)) {
      out.push({ ...r, isBot: true, xp: botXp(r, n), eloBefore: null, eloAfter: null });
      continue;
    }
    const prof = profiles.get(r.userId)!;
    const won = n > 1 && r.place === 1 && r.status !== 'disqualified' && r.status !== 'left';
    const podium = n >= 3 && r.place <= 3;
    const streak = won ? prof.winStreak + 1 : 0;
    const hp = humanPlaces.get(r.userId) ?? r.place;
    const xp = xpFor({
      place: withBots ? hp : r.place,
      participants: withBots ? humans.length : n,
      status: r.status,
      profitableTrades: r.wins,
      winStreak: withBots && humans.length < 2 ? 0 : streak,
    });
    const delta = deltas?.get(r.userId) ?? 0;
    const elo = prof.elo + delta;
    out.push({
      ...r,
      isBot: false,
      xp,
      eloBefore: ranked ? prof.elo : null,
      eloAfter: ranked ? elo : null,
    });
    await battleProfiles.updateOne({ _id: prof._id }, [
      {
        $set: {
          battles: { $add: ['$battles', 1] },
          wins: { $add: ['$wins', won ? 1 : 0] },
          podiums: { $add: ['$podiums', podium ? 1 : 0] },
          xp: { $add: ['$xp', xp] },
          trades: { $add: ['$trades', r.trades] },
          winningTrades: { $add: ['$winningTrades', r.wins] },
          returnSum: { $add: ['$returnSum', r.returnPct] },
          winStreak: streak,
          bestStreak: { $max: ['$bestStreak', streak] },
          bestReturn: {
            $cond: [
              { $eq: [{ $ifNull: ['$bestReturn', null] }, null] },
              r.returnPct,
              { $max: ['$bestReturn', r.returnPct] },
            ],
          },
          updatedAt: Date.now(),
          ...(withBots
            ? {
                vsBots: {
                  battles: { $add: [{ $ifNull: ['$vsBots.battles', 0] }, 1] },
                  wins: { $add: [{ $ifNull: ['$vsBots.wins', 0] }, won ? 1 : 0] },
                  podiums: { $add: [{ $ifNull: ['$vsBots.podiums', 0] }, podium ? 1 : 0] },
                },
              }
            : {}),
          ...(ranked
            ? {
                elo: { $add: ['$elo', delta] },
                rankedGames: { $add: ['$rankedGames', 1] },
                rankedWins: { $add: ['$rankedWins', won ? 1 : 0] },
                rankedLosses: { $add: ['$rankedLosses', won ? 0 : 1] },
              }
            : {}),
        },
      },
      ...(ranked ? ([{ $set: { peakElo: { $max: ['$peakElo', '$elo'] } } }] as const) : []),
    ]);
  }
  await battles.updateOne({ _id: b._id }, { $set: { results: out } });
  await syncBattleAccounts(b, true);
  noteHumanActivity();
}

// ---- participation -----------------------------------------------------------------------

const isIn = (b: BattleDoc, userId: ObjectId) =>
  b.participants.some((p) => p.userId.equals(userId));

/** A bot whose seat a real user can take (never the host). */
const movableBot = (b: BattleDoc) =>
  b.participants.some(
    (p) => isBot(p) && p.leftT === null && !(b.hostId && p.userId.equals(b.hostId)),
  );

/** Why `userId` can't join `b` (null when they can). Real users always get a bot's seat. */
export function joinBlocked(b: BattleDoc, userId: ObjectId): string | null {
  if (isIn(b, userId)) return null;
  if (b.mode === 'ranked') return 'Ranked battles are matchmade';
  if (b.status === 'completed' || b.status === 'cancelled') return 'This battle has ended';
  if (seatsTaken(b) >= b.settings.maxParticipants && !movableBot(b)) return 'This battle is full';
  if ((b.status === 'live' || b.status === 'paused') && !b.settings.allowLateJoin)
    return 'This battle does not accept late entries';
  return null;
}

export async function joinBattle(id: string, user: Player, code?: string): Promise<BattleDoc> {
  const target = await loadBattle(id);
  if (target.settings.visibility === 'private' && !isIn(target, user._id) && code !== target.code)
    throw new BattleError('This battle is private: join it with its battle ID', 403);
  const profile = await ensureProfile(user._id);
  let reserved = false;
  let added = false;
  try {
    if (!isIn(target, user._id)) {
      await takeBattleSlot(user._id, 'join');
      reserved = true;
    }
    const saved = await mutate(target._id, (b, now) => {
      if (isIn(b, user._id)) return null;
      const blocked = joinBlocked(b, user._id);
      if (blocked) throw new BattleError(blocked, 409);
      added = true;
      // A real user takes priority: in a full battle a bot gives up its seat.
      const evicted =
        seatsTaken(b) >= b.settings.maxParticipants ? evictBotFor(b, now, battleMarket) : null;
      const chat = evicted ? [evicted.message] : [];
      chat.push(systemMessage(`${user.name} joined`, now));
      // Everyone replays the same market from its first candle, late joiners included.
      const me = newParticipant(user, b, b.marketStart, profile, now);
      const participants = [...(evicted?.participants ?? b.participants), me];
      const full = participants.length >= b.settings.maxParticipants;
      const bots = b.bots ? onHumanJoined(b.bots, { ...b, participants }, now, full) : null;
      return {
        $set: { participants, ...(bots ? { bots } : {}) },
        $push: { chat: { $each: chat, $slice: -MAX_CHAT } },
      };
    });
    if (reserved && !added) await releaseBattleSlot(user._id);
    noteHumanActivity();
    // Joining a running battle with bots: their plans are made now (one write).
    return saved.status === 'live' && saved.bots ? refresh(saved) : saved;
  } catch (e) {
    if (reserved) await releaseBattleSlot(user._id);
    if (e instanceof PlanDenied) throw new BattleError(e.message, e.status);
    throw e;
  }
}

export async function findByCode(code: string): Promise<BattleDoc | null> {
  const { battles } = await collections();
  return battles.findOne({ code });
}

export async function leaveBattle(id: string, user: Player): Promise<BattleDoc> {
  const target = await loadBattle(id);
  const after = await mutate(target._id, (b, now) => {
    const me = b.participants.find((p) => p.userId.equals(user._id));
    if (!me) throw new BattleError('You are not in this battle', 409);
    const msg = { $each: [systemMessage(`${user.name} left`, now)], $slice: -MAX_CHAT };
    if (b.status === 'standby' || b.status === 'countdown') {
      if (b.mode === 'ranked')
        throw new BattleError('A ranked match cannot be left before it starts', 409);
      const rest = b.participants.filter((p) => !p.userId.equals(user._id));
      if (rest.length === 0)
        return {
          $set: { status: 'cancelled', participants: rest, endReason: 'Everyone left' },
          $push: { chat: msg },
        };
      const nextHost = rest.find((p) => !isBot(p)) ?? rest[0]!;
      // Only bots left in a user's lobby: they drift away and the lobby closes.
      const bots =
        b.bots && !hasHuman({ participants: rest })
          ? {
              ...b.bots,
              events: [
                ...b.bots.events.filter((e) => e.kind === 'chat'),
                { kind: 'cancel' as const, at: now + randomInt(20_000, 90_000) },
              ],
            }
          : null;
      return {
        $set: {
          participants: rest,
          ...(b.hostId?.equals(user._id) ? { hostId: nextHost.userId } : {}),
          ...(bots ? { bots } : {}),
        },
        $push: { chat: msg },
      };
    }
    if (b.status === 'completed' || b.status === 'cancelled') return null;
    if (me.leftT !== null) return null;
    // Forfeit: the account is closed at the trader's market time and ranks below everyone trading.
    const i = b.participants.indexOf(me);
    const stillActive = b.participants.filter(
      (p) => p.leftT === null && !p.userId.equals(user._id),
    );
    const hostPatch = b.hostId?.equals(user._id)
      ? { hostId: (stillActive.find((p) => !isBot(p)) ?? stillActive[0])?.userId ?? null }
      : {};
    return {
      $set: { [`participants.${i}.leftT`]: cursorOf(b, me), ...hostPatch },
      $push: { chat: msg },
    };
  });
  if (after.participants.some((p) => p.userId.equals(user._id))) await syncTrader(after, user._id);
  else {
    await releaseBattleSlot(user._id);
    await deletePositionEvents(user._id, 'battle', after._id.toHexString());
  }
  return after;
}

export type ControlOp = 'start' | 'pause' | 'resume' | 'restart' | 'end' | 'cancel';

/** Host controls: start, pause / resume, restart (resets every account), end early, close. */
export async function controlBattle(id: string, user: Player, op: ControlOp): Promise<BattleDoc> {
  const target = await loadBattle(id);
  const seat = target.participants.find((p) => p.userId.equals(user._id));
  if (!target.hostId?.equals(user._id) || !seat || seat.leftT !== null) {
    throw new BattleError('Only the host can do that', 403);
  }
  const battle = await mutate(target._id, (b, now) => {
    const say = (text: string) => ({ $each: [systemMessage(text, now)], $slice: -MAX_CHAT });
    switch (op) {
      case 'start':
        if (b.status !== 'standby') throw new BattleError('The battle has already started', 409);
        return {
          $set: { status: 'countdown', countdownEndsAt: now + COUNTDOWN_MS },
          $push: { chat: say(`${user.name} started the countdown`) },
        };
      case 'pause':
        if (b.status !== 'live') throw new BattleError('The battle is not running', 409);
        return {
          $set: { status: 'paused', pausedAt: now },
          $push: { chat: say('The host paused the battle') },
        };
      case 'resume':
        if (b.status !== 'paused' || b.pausedAt === null)
          throw new BattleError('The battle is not paused', 409);
        return {
          $set: { status: 'live', pausedAt: null, pausedMs: b.pausedMs + (now - b.pausedAt) },
          $push: { chat: say('The host resumed the battle') },
        };
      case 'restart': {
        if (b.status === 'cancelled' || b.status === 'completed')
          throw new BattleError('This battle has ended', 409);
        // Same market, every account reset; late joiners now start with everyone else.
        const participants = b.participants
          .filter((p) => p.leftT === null)
          .map((p) => ({
            ...p,
            startT: b.marketStart,
            startBid: bidBefore(b.symbol, b.marketStart),
            actions: [],
            cursor: b.marketStart,
            ...(p.bot ? { bot: { ...p.bot, planned: false, leaveT: null, joinElapsed: 0 } } : {}),
          }));
        const bots = b.bots ? { ...b.bots, chat: [], late: [] } : null;
        return {
          $set: {
            participants,
            status: 'countdown',
            countdownEndsAt: now + COUNTDOWN_MS,
            startedAt: null,
            pausedAt: null,
            pausedMs: 0,
            endedAt: null,
            ...(bots ? { bots } : {}),
          },
          $push: { chat: say('The host restarted the battle') },
        };
      }
      case 'end':
        if (b.status !== 'live' && b.status !== 'paused')
          throw new BattleError('The battle is not running', 409);
        return null;
      case 'cancel':
        if (b.status !== 'standby' && b.status !== 'countdown')
          throw new BattleError('Only a battle that has not started can be closed', 409);
        return {
          $set: { status: 'cancelled', endReason: 'Closed by the host' },
          $push: { chat: say('The host closed the battle') },
        };
    }
  });
  if (op === 'restart') await deleteScopeEvents('battle', battle._id.toHexString());
  if (op === 'cancel' && battle.status === 'cancelled')
    await Promise.all(
      battle.participants.filter((p) => !isBot(p)).map((p) => releaseBattleSlot(p.userId)),
    );
  return op === 'end' ? endEarly(battle) : battle;
}

async function endEarly(b: BattleDoc): Promise<BattleDoc> {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (b.status !== 'live' && b.status !== 'paused') return b;
    const now = Date.now();
    const update = complete(b, 'Ended by the host', now);
    const out = await commit(b, update.set);
    if (out) {
      await recordResults(out);
      return loadBattle(out._id.toHexString());
    }
    b = await refresh(await loadBattle(b._id.toHexString()));
  }
  throw new BattleError('The battle is busy, try again', 409);
}

/**
 * A trade from a participant, taken at market time `t` of their own replay (which moves their
 * cursor there). The server re-simulates the account to validate it like the broker would.
 */
export async function submitAction(
  id: string,
  user: Player,
  t: unknown,
  raw: unknown,
): Promise<BattleDoc> {
  const parsed = tradeActionSchema.safeParse(raw);
  if (!parsed.success || typeof t !== 'number' || !Number.isFinite(t))
    throw new BattleError('Invalid action');
  const action = parsed.data as TradeAction;
  const target = await loadBattle(id);
  const saved = await mutate(target._id, (b, now) => {
    if (b.status === 'paused') throw new BattleError('The battle is paused', 409);
    if (b.status !== 'live') throw new BattleError('Trading is closed', 409);
    const i = b.participants.findIndex((p) => p.userId.equals(user._id));
    const me = b.participants[i];
    if (!me) throw new BattleError('You are not in this battle', 403);
    if (me.leftT !== null) throw new BattleError('You left this battle', 409);
    if (me.actions.length >= MAX_ACTIONS) throw new BattleError('Too many actions', 429);
    const cursor = cursorOf(b, me);
    const last = me.actions[me.actions.length - 1]?.t ?? me.startT;
    const at = floorMinute(t);
    if (at < cursor || at < last || at > endOf(b))
      throw new BattleError('Your chart is out of sync with the battle, reloading', 409);
    const error = validateAction(b, me, at, action);
    if (error) throw new BattleError(error, 422);
    return {
      $push: { [`participants.${i}.actions`]: { t: at, a: action, at: now } },
      $set: { [`participants.${i}.cursor`]: at },
    };
  });
  await syncTrader(saved, user._id);
  return saved;
}

/** The trader stepped their replay forward to market time `t`. */
export async function advanceCursor(id: string, user: Player, t: unknown): Promise<BattleDoc> {
  if (typeof t !== 'number' || !Number.isFinite(t)) throw new BattleError('Invalid time');
  const target = await loadBattle(id);
  const saved = await mutate(target._id, (b) => {
    if (b.status === 'paused') throw new BattleError('The battle is paused', 409);
    if (b.status !== 'live') throw new BattleError('Trading is closed', 409);
    const i = b.participants.findIndex((p) => p.userId.equals(user._id));
    const me = b.participants[i];
    if (!me) throw new BattleError('You are not in this battle', 403);
    if (me.leftT !== null) return null;
    const at = Math.min(endOf(b), floorMinute(t));
    if (at <= cursorOf(b, me)) return null;
    return { $set: { [`participants.${i}.cursor`]: at } };
  });
  await syncTrader(saved, user._id);
  return saved;
}

export async function postChat(id: string, user: Player, text: unknown): Promise<BattleDoc> {
  if (typeof text !== 'string') throw new BattleError('Invalid message');
  const body = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!body) throw new BattleError('Empty message');
  await assertBattleChat(user._id);
  const target = await loadBattle(id);
  return mutate(target._id, (b, now) => {
    if (!isIn(b, user._id)) throw new BattleError('Join the battle to chat', 403);
    const msg: BattleChatDoc = {
      id: randomUUID(),
      userId: user._id,
      name: user.name,
      text: body,
      at: now,
      system: false,
    };
    const bots = b.bots && isGreeting(body) ? onHumanChat(b.bots, b, now) : null;
    return {
      $push: { chat: { $each: [msg], $slice: -MAX_CHAT } },
      ...(bots ? { $set: { bots } } : {}),
    };
  });
}

/** Writes the trader's opens and closes from the server's simulation. */
async function syncTrader(b: BattleDoc, userId: ObjectId, final = false): Promise<void> {
  const p = b.participants.find((x) => x.userId.equals(userId));
  if (!p || isBot(p)) return;
  const done = final || b.status === 'completed' || p.leftT !== null;
  const sim = simulateParticipant(b, p, done ? endOf(b) : cursorOf(b, p), done);
  await replacePositionEvents(p.userId, 'battle', b._id.toHexString(), b.symbol, sim.account);
}

async function syncBattleAccounts(b: BattleDoc, final = false): Promise<void> {
  await Promise.all(
    b.participants.filter((p) => !isBot(p)).map((p) => syncTrader(b, p.userId, final)),
  );
}

export { START_ELO };
