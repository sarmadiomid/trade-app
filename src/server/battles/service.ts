import 'server-only';
import { randomUUID } from 'node:crypto';
import { ObjectId, type Filter, type UpdateFilter } from 'mongodb';
import { tradeActionSchema, type TradeAction } from '@/lib/backtest';
import {
  COUNTDOWN_MS,
  MAX_ACTIONS,
  MAX_CHAT,
  START_ELO,
  battleCode,
  eloChanges,
  elapsedMs,
  durationMs,
  marketEnd,
  normalizeSettings,
  placesOf,
  sortStandings,
  validateBattleSettings,
  xpFor,
  type BattleClock,
  type BattleSettings,
  type FinalResult,
  type RankedFormat,
  type Standing,
} from '@/lib/battles';
import { MINUTE_MS } from '@/lib/core';
import { collections, type BattleChatDoc, type BattleDoc, type BattleParticipantDoc } from '../db';
import { bidBefore, pick, pickMarketStart, randomUnit } from './market';
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

export interface Player {
  readonly _id: ObjectId;
  readonly name: string;
}

export const clockOf = (b: BattleDoc): BattleClock => ({
  status: b.status,
  startedAt: b.startedAt,
  pausedAt: b.pausedAt,
  pausedMs: b.pausedMs,
  endedAt: b.endedAt,
  marketStart: b.marketStart,
  speed: b.settings.speed,
  durationMin: b.settings.durationMin,
});

const endOf = (b: BattleDoc) => marketEnd(clockOf(b));

/** Market time a trader has replayed up to (they step through the candles themselves). */
export const cursorOf = (b: BattleDoc, p: BattleParticipantDoc) =>
  Math.min(endOf(b), Math.max(p.startT, p.cursor ?? p.startT));

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

async function uniqueCode(): Promise<string> {
  const { battles } = await collections();
  for (;;) {
    const code = battleCode(randomUnit);
    if (!(await battles.findOne({ code }, { projection: { _id: 1 } }))) return code;
  }
}

/** A host's custom (casual) battle, waiting in the lobby. */
export async function createBattle(host: Player, input: BattleSettings): Promise<BattleDoc> {
  const settings = normalizeSettings(input);
  const error = validateBattleSettings(settings);
  if (error) throw new BattleError(error);
  const { battles } = await collections();
  const now = Date.now();
  const symbol = pick(settings.assets);
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
  await battles.insertOne(doc);
  return doc;
}

/** A matchmade ranked battle; the countdown starts right away. */
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
  for (const p of players)
    participants.push(
      newParticipant(p, { symbol, marketStart }, marketStart, await ensureProfile(p._id), now),
    );
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
  await battles.insertOne(doc);
  return doc;
}

// ---- lifecycle ---------------------------------------------------------------------------

const standingsCache = new Map<string, Standing[]>();
const STANDINGS_CACHE_SIZE = 200;

/**
 * Every participant's live standing at their own replay cursor, in leaderboard order.
 * Memoised per battle version: every trader polls about once a second, and the result only
 * changes when someone steps their replay or acts (both bump the version).
 */
export function liveStandings(b: BattleDoc): Standing[] {
  const key = `${b._id.toHexString()}:${b.version}`;
  const cached = standingsCache.get(key);
  if (cached) return cached;
  const out = sortStandings(
    b.participants.map((p) => simulateParticipant(b, p, cursorOf(b, p)).standing),
  );
  standingsCache.set(key, out);
  if (standingsCache.size > STANDINGS_CACHE_SIZE)
    standingsCache.delete(standingsCache.keys().next().value!);
  return out;
}

/**
 * Applies time-driven transitions: the countdown ending, the timer running out, a profit target
 * being reached or every trader being out. Called on every read, so battles advance without a
 * background worker.
 */
export async function refresh(b: BattleDoc): Promise<BattleDoc> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const now = Date.now();
    const update = transition(b, now);
    if (!update) return b;
    const out = await commit(b, update.set);
    if (out) {
      if (update.completed) await recordResults(out);
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
  const standings = liveStandings(b);
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
    (p) => out(standingOf(standings, p)) || cursorOf(b, p) >= end,
  );
  if (done) return complete(b, 'Every trader reached the end of the market', now);
  return null;
}

const standingOf = (standings: readonly Standing[], p: BattleParticipantDoc) =>
  standings.find((s) => s.userId === p.userId.toHexString())!;

function complete(b: BattleDoc, reason: string, now: number) {
  const finals = sortStandings(
    b.participants.map((p) => simulateParticipant(b, p, cursorOf(b, p), true).standing),
  );
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
 * battles, Composite Score and lifetime stats for everyone.
 */
async function recordResults(b: BattleDoc): Promise<void> {
  const results = b.results;
  if (!results) return;
  const { battleProfiles, battles } = await collections();
  const profiles = new Map<string, Awaited<ReturnType<typeof ensureProfile>>>();
  for (const r of results) profiles.set(r.userId, await ensureProfile(new ObjectId(r.userId)));
  const ranked = b.mode === 'ranked';
  const deltas = ranked
    ? eloChanges(
        results.map((r) => ({
          id: r.userId,
          rating: profiles.get(r.userId)!.elo,
          games: profiles.get(r.userId)!.rankedGames,
        })),
        new Map(results.map((r) => [r.userId, r.place])),
      )
    : null;
  const n = results.length;
  const out: FinalResult[] = [];
  for (const r of results) {
    const prof = profiles.get(r.userId)!;
    const won = n > 1 && r.place === 1 && r.status !== 'disqualified' && r.status !== 'left';
    const streak = won ? prof.winStreak + 1 : 0;
    const xp = xpFor({
      place: r.place,
      participants: n,
      status: r.status,
      profitableTrades: r.wins,
      winStreak: streak,
    });
    const delta = deltas?.get(r.userId) ?? 0;
    const elo = prof.elo + delta;
    out.push({ ...r, xp, eloBefore: ranked ? prof.elo : null, eloAfter: ranked ? elo : null });
    await battleProfiles.updateOne(
      { _id: prof._id },
      {
        $inc: {
          battles: 1,
          wins: won ? 1 : 0,
          podiums: n >= 3 && r.place <= 3 ? 1 : 0,
          xp,
          trades: r.trades,
          winningTrades: r.wins,
          returnSum: r.returnPct,
          ...(ranked ? { rankedGames: 1, rankedWins: won ? 1 : 0, rankedLosses: won ? 0 : 1 } : {}),
        },
        $set: {
          winStreak: streak,
          bestStreak: Math.max(prof.bestStreak, streak),
          updatedAt: Date.now(),
          ...(ranked ? { elo, peakElo: Math.max(prof.peakElo, elo) } : {}),
          bestReturn:
            prof.bestReturn === null ? r.returnPct : Math.max(prof.bestReturn, r.returnPct),
        },
      },
    );
  }
  await battles.updateOne({ _id: b._id }, { $set: { results: out } });
}

// ---- participation -----------------------------------------------------------------------

const isIn = (b: BattleDoc, userId: ObjectId) =>
  b.participants.some((p) => p.userId.equals(userId));

/** Why `userId` can't join `b` (null when they can). */
export function joinBlocked(b: BattleDoc, userId: ObjectId): string | null {
  if (isIn(b, userId)) return null;
  if (b.mode === 'ranked') return 'Ranked battles are matchmade';
  if (b.status === 'completed' || b.status === 'cancelled') return 'This battle has ended';
  if (b.participants.length >= b.settings.maxParticipants) return 'This battle is full';
  if ((b.status === 'live' || b.status === 'paused') && !b.settings.allowLateJoin)
    return 'This battle does not accept late entries';
  return null;
}

export async function joinBattle(id: string, user: Player, code?: string): Promise<BattleDoc> {
  const target = await loadBattle(id);
  if (target.settings.visibility === 'private' && !isIn(target, user._id) && code !== target.code)
    throw new BattleError('This battle is private: join it with its battle ID', 403);
  const profile = await ensureProfile(user._id);
  return mutate(target._id, (b, now) => {
    if (isIn(b, user._id)) return null;
    const blocked = joinBlocked(b, user._id);
    if (blocked) throw new BattleError(blocked, 409);
    // Everyone replays the same market from its first candle, late joiners included.
    return {
      $push: {
        participants: newParticipant(user, b, b.marketStart, profile, now),
        chat: { $each: [systemMessage(`${user.name} joined`, now)], $slice: -MAX_CHAT },
      },
    };
  });
}

export async function findByCode(code: string): Promise<BattleDoc | null> {
  const { battles } = await collections();
  return battles.findOne({ code });
}

export async function leaveBattle(id: string, user: Player): Promise<BattleDoc> {
  const target = await loadBattle(id);
  return mutate(target._id, (b, now) => {
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
      return {
        $set: {
          participants: rest,
          ...(b.hostId?.equals(user._id) ? { hostId: rest[0]!.userId } : {}),
        },
        $push: { chat: msg },
      };
    }
    if (b.status === 'completed' || b.status === 'cancelled') return null;
    if (me.leftT !== null) return null;
    // Forfeit: the account is closed at the trader's market time and ranks below everyone trading.
    const i = b.participants.indexOf(me);
    return { $set: { [`participants.${i}.leftT`]: cursorOf(b, me) }, $push: { chat: msg } };
  });
}

export type ControlOp = 'start' | 'pause' | 'resume' | 'restart' | 'end' | 'cancel';

/** Host controls: start, pause / resume, restart (resets every account), end early, close. */
export async function controlBattle(id: string, user: Player, op: ControlOp): Promise<BattleDoc> {
  const target = await loadBattle(id);
  if (!target.hostId?.equals(user._id)) throw new BattleError('Only the host can do that', 403);
  return mutate(target._id, (b, now) => {
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
          }));
        return {
          $set: {
            participants,
            status: 'countdown',
            countdownEndsAt: now + COUNTDOWN_MS,
            startedAt: null,
            pausedAt: null,
            pausedMs: 0,
            endedAt: null,
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
  }).then(async (b) => (op === 'end' ? endEarly(b) : b));
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
  return mutate(target._id, (b, now) => {
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
}

/** The trader stepped their replay forward to market time `t`. */
export async function advanceCursor(id: string, user: Player, t: unknown): Promise<BattleDoc> {
  if (typeof t !== 'number' || !Number.isFinite(t)) throw new BattleError('Invalid time');
  const target = await loadBattle(id);
  return mutate(target._id, (b) => {
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
}

export async function postChat(id: string, user: Player, text: unknown): Promise<BattleDoc> {
  if (typeof text !== 'string') throw new BattleError('Invalid message');
  const body = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!body) throw new BattleError('Empty message');
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
    return { $push: { chat: { $each: [msg], $slice: -MAX_CHAT } } };
  });
}

export { START_ELO };
