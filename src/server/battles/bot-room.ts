/**
 * Bots inside one battle: their seats, derived replay cursors, O(1) live standings, the lobby
 * schedule pump and their (one-time) trading plans. Pure apart from the injected market, so the
 * whole flow is unit-testable without a database. See docs/BATTLE-BOTS.md.
 */
import { randomUUID } from 'node:crypto';
import { ObjectId, type UpdateFilter } from 'mongodb';
import { ExecutionEngine, type AccountConfig } from '@/lib/backtest';
import {
  COUNTDOWN_MS,
  MAX_ACTIONS,
  MAX_CHAT,
  START_ELO,
  battleCode,
  elapsedMs,
  durationMs,
  marketCursor,
  marketEnd,
  type BattleClock,
  type BattleSettings,
  type RankedFormat,
  type Standing,
} from '@/lib/battles';
import { DAY_MS, MINUTE_MS, type Candle } from '@/lib/core';
import { eventLine, line } from '@/lib/app/battle/bots/chat';
import { botIdHex, botIdentity, botIndexOf, drawIdentities } from '@/lib/app/battle/bots/identity';
import { hostReaction, lateJoins, planLobby } from '@/lib/app/battle/bots/lobby';
import { candlesAt, elapsedForCandle, paceSchedule } from '@/lib/app/battle/bots/pace';
import { moodOf, personaOf, type Persona } from '@/lib/app/battle/bots/persona';
import { planBot } from '@/lib/app/battle/bots/planner';
import { botRng, clamp, seedOf } from '@/lib/app/battle/bots/rng';
import { Timeline } from '@/lib/app/battle/bots/timeline';
import { activityAt, type WorldBattleSpec } from '@/lib/app/battle/bots/world';
import type {
  BattleActionDoc,
  BattleBotsDoc,
  BattleChatDoc,
  BattleDoc,
  BattleParticipantDoc,
  BotLobbyEventDoc,
} from '../db';

/** Market access the bots need (the server passes the seeded battle market). */
export interface BattleMarket {
  minutes(symbol: string, from: number, to: number): Candle[];
  bidBefore(symbol: string, t: number): number;
  config(settings: BattleSettings, symbol: string): AccountConfig;
  pickStart(symbol: string, settings: BattleSettings): number;
}

export const ACTIVE_STATUSES = ['standby', 'countdown', 'live', 'paused'] as const;

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

export const isBot = (p: BattleParticipantDoc) => Boolean(p.isBot);
export const hasHuman = (b: Pick<BattleDoc, 'participants'>) =>
  b.participants.some((p) => !p.isBot);
/** Seats in use: a bot that forfeited frees its seat (a real user may take it). */
export const seatsTaken = (b: Pick<BattleDoc, 'participants'>) =>
  b.participants.filter((p) => !(p.isBot && p.leftT !== null)).length;

const endOf = (b: BattleDoc) => marketEnd(clockOf(b));

export function systemMessage(text: string, at: number): BattleChatDoc {
  return { id: randomUUID(), userId: null, name: 'System', text, at, system: true };
}

function botMessage(index: number, text: string, at: number): BattleChatDoc {
  const id = botIdentity(index);
  return { id: randomUUID(), userId: new ObjectId(id.id), name: id.name, text, at, system: false };
}

/** The trader `index` is today, in battle `b` (persona + a per-battle mood). */
export const battlePersona = (b: Pick<BattleDoc, '_id'>, index: number): Persona =>
  moodOf(personaOf(index), seedOf(b._id.toHexString()));

export function botParticipant(
  index: number,
  b: Pick<BattleDoc, 'symbol' | 'marketStart'>,
  joinedAt: number,
  joinElapsed: number,
  market: BattleMarket,
): BattleParticipantDoc {
  const id = botIdentity(index);
  return {
    userId: new ObjectId(id.id),
    name: id.name,
    joinedAt,
    startT: b.marketStart,
    startBid: market.bidBefore(b.symbol, b.marketStart),
    // Bots never play ranked, so they show what any trader without ranked games shows.
    elo: START_ELO,
    games: 0,
    actions: [],
    cursor: b.marketStart,
    leftT: null,
    isBot: true,
    bot: { index, joinElapsed, planned: false, leaveT: null },
  };
}

/** Pool indices of the bots seated in `b`. */
export const botIndices = (b: Pick<BattleDoc, 'participants'>) =>
  new Set(b.participants.flatMap((p) => (p.bot ? [p.bot.index] : [])));

// ---- caches ---------------------------------------------------------------------------------

class Lru<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly max: number) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V): void {
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
  get size(): number {
    return this.map.size;
  }
}

const g = globalThis as unknown as {
  __botCaches?: { pace: Lru<Uint16Array>; timeline: Lru<Timeline>; times: Lru<Float64Array> };
};
function caches() {
  g.__botCaches ??= { pace: new Lru(4000), timeline: new Lru(2000), times: new Lru(256) };
  return g.__botCaches;
}

/** Sizes of the in-memory bot caches (benchmarks, admin). */
export const botCacheStats = () => {
  const c = caches();
  return { pace: c.pace.size, timelines: c.timeline.size, barSeries: c.times.size };
};

function seatBars(b: BattleDoc, p: BattleParticipantDoc, market: BattleMarket): Candle[] {
  const all = market.minutes(b.symbol, b.marketStart, endOf(b));
  return p.startT <= b.marketStart ? all : all.filter((x) => x.time >= p.startT);
}

function barTimes(b: BattleDoc, p: BattleParticipantDoc, market: BattleMarket): Float64Array {
  const key = `${b.symbol}:${b.marketStart}:${endOf(b)}:${p.startT}`;
  const c = caches();
  let t = c.times.get(key);
  if (!t) {
    const bars = seatBars(b, p, market);
    t = new Float64Array(bars.length);
    for (let i = 0; i < bars.length; i++) t[i] = bars[i]!.time;
    c.times.set(key, t);
  }
  return t;
}

const lowerBound = (xs: ArrayLike<number>, v: number) => {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

function paceOf(b: BattleDoc, p: BattleParticipantDoc, market: BattleMarket): Uint16Array {
  const bot = p.bot!;
  const key = `${b._id.toHexString()}:${b.symbol}:${b.marketStart}:${bot.index}:${b.startedAt}:${bot.joinElapsed}:${p.actions.length}`;
  const c = caches();
  let s = c.pace.get(key);
  if (!s) {
    const times = barTimes(b, p, market);
    s = paceSchedule({
      persona: battlePersona(b, bot.index),
      seed: seedOf(b._id.toHexString(), bot.index, b.startedAt ?? 0, bot.joinElapsed, 'pace'),
      durationMs: durationMs(clockOf(b)),
      speed: b.settings.speed,
      barTimes: times,
      marketStart: b.marketStart,
      joinElapsedMs: bot.joinElapsed,
      actionCandles: p.actions.map((a) => lowerBound(times, a.t)),
    });
    c.pace.set(key, s);
  }
  return s;
}

/**
 * Market time a participant has replayed up to. Humans report theirs; a bot's is derived from
 * battle time and its pace, so it is never written to the database.
 */
export function seatCursor(
  b: BattleDoc,
  p: BattleParticipantDoc,
  now: number,
  market: BattleMarket,
): number {
  const end = endOf(b);
  if (!p.isBot) return Math.min(end, Math.max(p.startT, p.cursor ?? p.startT));
  if (b.startedAt === null) return p.startT;
  if (!p.bot) return Math.min(end, Math.max(p.startT, marketCursor(clockOf(b), now)));
  const times = barTimes(b, p, market);
  const n = candlesAt(paceOf(b, p, market), elapsedMs(clockOf(b), now));
  const cursor = n < times.length ? times[n]! : end;
  return Math.min(end, Math.max(p.startT, cursor));
}

function timelineOf(b: BattleDoc, p: BattleParticipantDoc, market: BattleMarket): Timeline {
  const leaveT = p.leftT ?? p.bot?.leaveT ?? null;
  const key = `${b._id.toHexString()}:${b.symbol}:${b.marketStart}:${p.userId.toHexString()}:${b.startedAt}:${p.actions.length}:${p.actions[p.actions.length - 1]?.t ?? 0}:${leaveT}`;
  const c = caches();
  let tl = c.timeline.get(key);
  if (!tl) {
    const cfg = market.config(b.settings, b.symbol);
    tl = new Timeline(
      cfg,
      ExecutionEngine.initialState(cfg, p.startT, p.startBid),
      p.actions,
      seatBars(b, p, market),
      endOf(b),
      leaveT,
      b.settings.winCondition === 'profit-target',
    );
    c.timeline.set(key, tl);
  }
  return tl;
}

/** A bot's live standing at its own cursor (a lookup in its precomputed timeline). */
export function botStanding(
  b: BattleDoc,
  p: BattleParticipantDoc,
  now: number,
  market: BattleMarket,
): Standing {
  const cfg = market.config(b.settings, b.symbol);
  const pt = timelineOf(b, p, market).at(seatCursor(b, p, now, market));
  return {
    userId: p.userId.toHexString(),
    name: p.name,
    elo: p.elo,
    status: pt.status,
    balance: pt.balance,
    equity: pt.equity,
    returnPct: ((pt.equity - cfg.startingBalance) / cfg.startingBalance) * 100,
    openPositions: pt.openPositions,
    trades: pt.trades,
    wins: pt.wins,
    targetAt: pt.targetAt,
    reason: pt.reason,
    isBot: true,
  };
}

// ---- plans ----------------------------------------------------------------------------------

/**
 * A bot's whole trading log for this run of the battle, computed once on the real broker
 * (every action accepted at its market time), plus what it will say about it and when.
 */
export function planSeat(
  b: BattleDoc,
  p: BattleParticipantDoc,
  market: BattleMarket,
): { actions: BattleActionDoc[]; leaveT: number | null; chat: BattleBotsDoc['chat'] } {
  const index = p.bot!.index;
  const persona = battlePersona(b, index);
  const cfg = market.config(b.settings, b.symbol);
  const plan = planBot({
    cfg,
    rules: b.settings,
    history: market.minutes(b.symbol, p.startT - 2 * DAY_MS, p.startT),
    bars: seatBars(b, p, market),
    startT: p.startT,
    startBid: p.startBid,
    end: endOf(b),
    persona,
    seed: seedOf(b._id.toHexString(), index, b.startedAt ?? 0, 'plan'),
    maxActions: MAX_ACTIONS,
  });
  const at = b.startedAt ?? 0;
  const actions = plan.actions.map((x) => ({ t: x.t, a: x.a, at }));
  const planned = { ...p, actions };
  const pace = paceOf(b, planned, market);
  const times = barTimes(b, p, market);
  const r = botRng(seedOf(b._id.toHexString(), index, 'chat'));
  const chat: BattleBotsDoc['chat'] = [];
  for (const ev of plan.events) {
    if (ev.kind === 'entry') continue;
    const text = eventLine(r, persona, ev.kind);
    if (!text) continue;
    const seen = elapsedForCandle(pace, lowerBound(times, ev.t));
    if (seen === null) continue;
    chat.push({ atElapsed: seen + Math.round(r.range(2, 9) * 1000), index, text });
  }
  return { actions, leaveT: plan.leaveT, chat };
}

// ---- the pump -------------------------------------------------------------------------------

export interface PumpContext {
  readonly market: BattleMarket;
  /** Bot identities seated in other running battles (a trader can't be in two at once). */
  readonly busy: ReadonlySet<number>;
}

/** True when the pump has a due join that needs the busy set. */
export function pumpNeedsBusy(b: BattleDoc, now: number): boolean {
  const m = b.bots;
  if (!m) return false;
  if (b.status === 'standby' && m.events.some((e) => e.kind === 'join' && e.at <= now)) return true;
  if (b.status === 'live' && m.late.length > 0)
    return m.late[0]!.atElapsed <= elapsedMs(clockOf(b), now);
  return false;
}

/**
 * Applies every bot event that is due at `now`: lobby joins and leaves, chat, a bot host's start
 * or close, late joins, the one-time trading plans (once a real user is in the battle), and
 * forfeits whose market time a bot has reached. Returns the update, or null when nothing is due.
 * Writes happen only on these discrete events, never per poll.
 */
export function pumpBattle(
  b: BattleDoc,
  now: number,
  ctx: PumpContext,
): UpdateFilter<BattleDoc> | null {
  const meta = b.bots;
  if (!meta) return null;
  const parts = [...b.participants];
  const chat: BattleChatDoc[] = [];
  const next: BattleBotsDoc = { ...meta };
  let changed = false;
  let partsChanged = false;
  let status: Partial<BattleDoc> = {};
  const present = (index: number) =>
    parts.find((p) => p.bot?.index === index && p.leftT === null) ?? null;
  const hostIsBot = () => (b.hostId ? botIndexOf(b.hostId.toHexString()) !== null : false);
  const humanIn = () => parts.some((p) => !p.isBot);

  // Wall-clock events.
  const due = meta.events.filter((e) => e.at <= now);
  if (due.length > 0) {
    next.events = meta.events.filter((e) => e.at > now);
    changed = true;
  }
  let st = b.status;
  for (const e of due) {
    switch (e.kind) {
      case 'join': {
        if (st !== 'standby') break;
        if (parts.length >= b.settings.maxParticipants) break;
        if (ctx.busy.has(e.index) || parts.some((p) => p.bot?.index === e.index)) break;
        parts.push(botParticipant(e.index, b, e.at, 0, ctx.market));
        partsChanged = true;
        chat.push(systemMessage(`${botIdentity(e.index).name} joined`, e.at));
        break;
      }
      case 'leave': {
        if (st !== 'standby') break;
        const k = parts.findIndex((p) => p.bot?.index === e.index);
        if (k < 0 || (b.hostId && parts[k]!.userId.equals(b.hostId))) break;
        const [gone] = parts.splice(k, 1);
        partsChanged = true;
        chat.push(systemMessage(`${gone!.name} left`, e.at));
        break;
      }
      case 'chat': {
        if (!present(e.index)) break;
        chat.push(botMessage(e.index, e.text, e.at));
        break;
      }
      case 'start': {
        if (st !== 'standby' || !hostIsBot()) break;
        st = 'countdown';
        status = { status: 'countdown', countdownEndsAt: e.at + COUNTDOWN_MS };
        const host = parts.find((p) => b.hostId && p.userId.equals(b.hostId));
        chat.push(systemMessage(`${host?.name ?? 'Host'} started the countdown`, e.at));
        next.startAt = null;
        break;
      }
      case 'cancel': {
        // A host never closes a lobby a real user is waiting in.
        if (st !== 'standby' || humanIn()) break;
        st = 'cancelled';
        status = { status: 'cancelled', endReason: 'Closed by the host' };
        chat.push(systemMessage('The host closed the battle', e.at));
        break;
      }
    }
  }
  // A bot host starts soon after a real user joined.
  if (st === 'standby' && meta.startAt !== null && meta.startAt <= now && hostIsBot()) {
    st = 'countdown';
    status = { status: 'countdown', countdownEndsAt: meta.startAt + COUNTDOWN_MS };
    const host = parts.find((p) => b.hostId && p.userId.equals(b.hostId));
    chat.push(systemMessage(`${host?.name ?? 'Host'} started the countdown`, meta.startAt));
    next.startAt = null;
    changed = true;
  }

  if ((st === 'live' || st === 'paused') && b.startedAt !== null) {
    const elapsed = elapsedMs(clockOf(b), now);
    // Late arrivals.
    if (st === 'live' && meta.late.length > 0 && meta.late[0]!.atElapsed <= elapsed) {
      const rest: BattleBotsDoc['late'] = [];
      for (const l of meta.late) {
        if (l.atElapsed > elapsed) {
          rest.push(l);
          continue;
        }
        if (!b.settings.allowLateJoin) continue;
        if (seatsTaken({ participants: parts }) >= b.settings.maxParticipants) continue;
        if (ctx.busy.has(l.index) || parts.some((p) => p.bot?.index === l.index)) continue;
        parts.push(botParticipant(l.index, b, now, l.atElapsed, ctx.market));
        partsChanged = true;
        chat.push(systemMessage(`${botIdentity(l.index).name} joined`, now));
      }
      next.late = rest;
      changed = true;
    }
    // Plans: only once a real user is in the battle (bot-only battles never simulate anything).
    if (humanIn()) {
      const chats = [...next.chat];
      for (let k = 0; k < parts.length; k++) {
        const p = parts[k]!;
        if (!p.bot || p.bot.planned) continue;
        const plan = planSeat(b, p, ctx.market);
        parts[k] = {
          ...p,
          actions: plan.actions,
          bot: { ...p.bot, planned: true, leaveT: plan.leaveT },
        };
        chats.push(...plan.chat);
        partsChanged = true;
      }
      if (partsChanged) {
        next.chat = chats.sort((x, y) => x.atElapsed - y.atElapsed);
        changed = true;
      }
    }
    // Chat whose battle time has come.
    if (next.chat.length > 0 && next.chat[0]!.atElapsed <= elapsed) {
      const keep: BattleBotsDoc['chat'] = [];
      for (const c of next.chat) {
        if (c.atElapsed > elapsed) keep.push(c);
        else if (parts.some((p) => p.bot?.index === c.index))
          chat.push(botMessage(c.index, c.text, now));
      }
      next.chat = keep;
      changed = true;
    }
    // Forfeits the bots' replay has reached.
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k]!;
      if (!p.bot?.planned || p.bot.leaveT === null || p.leftT !== null) continue;
      if (seatCursor(b, p, now, ctx.market) < p.bot.leaveT) continue;
      parts[k] = { ...p, leftT: p.bot.leaveT };
      partsChanged = true;
      chat.push(systemMessage(`${p.name} left`, now));
    }
  }

  // After the battle: a gg or two from the traders still around.
  if (st === 'completed' && !meta.endChat && humanIn()) {
    next.endChat = true;
    changed = true;
    const r = botRng(seedOf(meta.seed, b._id.toHexString(), 'end'));
    const events: BotLobbyEventDoc[] = [...next.events];
    let said = 0;
    for (const p of parts) {
      if (!p.bot || p.leftT !== null || said >= 2) continue;
      if (!r.chance(battlePersona(b, p.bot.index).chattiness * 0.8)) continue;
      said += 1;
      events.push({
        kind: 'chat',
        at: now + Math.round(r.range(3, 20) * 1000),
        index: p.bot.index,
        text: line(r, 'end'),
      });
    }
    next.events = events.sort((x, y) => x.at - y.at);
  }

  if (!changed && !partsChanged && chat.length === 0 && Object.keys(status).length === 0)
    return null;
  const $set: Record<string, unknown> = { bots: next, ...status };
  if (partsChanged) $set.participants = parts;
  const update: UpdateFilter<BattleDoc> = { $set: $set as Partial<BattleDoc> };
  if (chat.length > 0)
    update.$push = { chat: { $each: chat.sort((x, y) => x.at - y.at), $slice: -MAX_CHAT } };
  return update;
}

// ---- real users take priority ---------------------------------------------------------------

/**
 * Makes room for a real user in a full battle: in the lobby the most recent bot (never the host)
 * leaves; in a running battle one bot forfeits at its current cursor. Returns the new
 * participants and the system message, or null when there is no bot to move.
 */
export function evictBotFor(
  b: BattleDoc,
  now: number,
  market: BattleMarket,
): { participants: BattleParticipantDoc[]; message: BattleChatDoc } | null {
  const parts = [...b.participants];
  const isHost = (p: BattleParticipantDoc) => Boolean(b.hostId && p.userId.equals(b.hostId));
  if (b.status === 'standby' || b.status === 'countdown') {
    let k = -1;
    for (let i = parts.length - 1; i >= 0; i--)
      if (parts[i]!.isBot && !isHost(parts[i]!)) {
        k = i;
        break;
      }
    if (k < 0) return null;
    const [gone] = parts.splice(k, 1);
    return { participants: parts, message: systemMessage(`${gone!.name} left`, now) };
  }
  const k = parts.findIndex((p) => p.isBot && p.leftT === null && !isHost(p));
  if (k < 0) return null;
  const p = parts[k]!;
  const at = seatCursor(b, p, now, market);
  parts[k] = { ...p, leftT: at, ...(p.bot ? { bot: { ...p.bot, leaveT: at } } : {}) };
  return { participants: parts, message: systemMessage(`${p.name} left`, now) };
}

/** Bot reactions to a real user joining: a bot host starts soon, someone may say hi. */
export function onHumanJoined(
  meta: BattleBotsDoc,
  b: BattleDoc,
  now: number,
  full: boolean,
): BattleBotsDoc {
  const r = botRng(seedOf(meta.seed, now, 'human-join'));
  const hostBot = b.hostId ? botIndexOf(b.hostId.toHexString()) : null;
  const next: BattleBotsDoc = {
    ...meta,
    // A host never closes a lobby with a real user waiting.
    events: meta.events.filter((e) => e.kind !== 'cancel'),
  };
  if (hostBot !== null && b.status === 'standby') {
    const when = full
      ? hostReaction(r, now, b.settings.maxParticipants, b.settings.maxParticipants)
      : hostReaction(r, now, seatsTaken(b), b.settings.maxParticipants);
    next.startAt = meta.startAt === null ? when : Math.min(meta.startAt, when);
  }
  const bots = b.participants.filter((p) => p.bot && p.leftT === null);
  if (bots.length > 0 && r.chance(0.3)) {
    const who = r.pick(bots).bot!.index;
    if (r.chance(battlePersona(b, who).chattiness * 1.5 + 0.1))
      next.events = [
        ...next.events,
        {
          kind: 'chat' as const,
          at: now + Math.round(r.range(3, 12) * 1000),
          index: who,
          text: line(r, 'reply'),
        },
      ].sort((x, y) => x.at - y.at);
  }
  return next;
}

/** A greeting from a real user may get one greeting back. */
export function onHumanChat(meta: BattleBotsDoc, b: BattleDoc, now: number): BattleBotsDoc | null {
  const r = botRng(seedOf(meta.seed, now, 'reply'));
  if (meta.events.some((e) => e.kind === 'chat' && e.at > now && e.at < now + 15_000)) return null;
  const bots = b.participants.filter((p) => p.bot && p.leftT === null);
  if (bots.length === 0 || !r.chance(0.45)) return null;
  const who = r.pick(bots).bot!.index;
  return {
    ...meta,
    events: [
      ...meta.events,
      {
        kind: 'chat' as const,
        at: now + Math.round(r.range(3, 12) * 1000),
        index: who,
        text: line(r, 'reply'),
      },
    ].sort((x, y) => x.at - y.at),
  };
}

// ---- new bot activity -----------------------------------------------------------------------

/** Field lean for a real user, from how much they have played (newcomers meet a softer field). */
export const tiltFor = (battlesPlayed: number) =>
  clamp((Math.log1p(Math.max(0, battlesPlayed)) - 1.6) / 3, -0.4, 0.45);

/** Bots that will join a public battle a real user just created. */
export function fillMeta(input: {
  readonly battleId: ObjectId;
  readonly createdAt: number;
  readonly settings: BattleSettings;
  readonly presence: number;
  readonly busy: ReadonlySet<number>;
  readonly tilt: number;
}): BattleBotsDoc | null {
  if (input.settings.visibility !== 'public' || input.presence <= 0) return null;
  const seed = seedOf(input.battleId.toHexString(), 'fill');
  const lobby = planLobby({
    seed,
    createdAt: input.createdAt,
    maxParticipants: input.settings.maxParticipants,
    hostIndex: null,
    seated: 1,
    appeal: 1,
    activity: Math.max(0.35, activityAt(input.createdAt)),
    presence: input.presence,
    allowLateJoin: input.settings.allowLateJoin,
    durationMs: input.settings.durationMin * MINUTE_MS,
    exclude: input.busy,
    tilt: input.tilt,
  });
  const r = botRng(seedOf(seed, 'late'));
  const late = input.settings.allowLateJoin
    ? lateJoins(
        r,
        { durationMs: input.settings.durationMin * MINUTE_MS },
        drawIdentities(seedOf(seed, 'late-pool'), 3, input.busy, input.tilt),
        r.chance(0.5 * input.presence) ? 1 : 0,
      )
    : [];
  // Poisson fills can come up empty on an unlucky seed; a public lobby with presence always
  // gets at least one companion (first arrival usually 15–90 s — see docs/BATTLE-BOTS.md).
  let events = lobby.events.filter(
    (e) => e.kind !== 'start' && e.kind !== 'cancel',
  ) as BotLobbyEventDoc[];
  if (!events.some((e) => e.kind === 'join')) {
    const who = drawIdentities(seedOf(seed, 'fill-min'), 1, input.busy, input.tilt)[0];
    if (who) {
      const at = input.createdAt + Math.round(botRng(seedOf(seed, 'fill-min-at')).range(15, 90) * 1000);
      events = [{ kind: 'join' as const, at, index: who.index }, ...events].sort((a, b) => a.at - b.at);
    }
  }
  return {
    origin: 'fill',
    seed,
    tilt: input.tilt,
    events,
    late,
    chat: [],
    startAt: null,
    endChat: false,
  };
}

/**
 * A bot-hosted public battle from the world schedule, materialised as it is at `now`: created
 * a while ago, with the traders who joined since, already counting down or running when its
 * host has started it. Null when it would already be over.
 */
export function materializeWorld(
  spec: WorldBattleSpec,
  now: number,
  ctx: {
    readonly market: BattleMarket;
    readonly busy: ReadonlySet<number>;
    readonly presence: number;
  },
): BattleDoc | null {
  const r = botRng(seedOf(spec.seed, 'materialize'));
  const host = drawIdentities(seedOf(spec.seed, 'host'), 1, ctx.busy)[0];
  if (!host) return null;
  const settings = spec.settings;
  const duration = settings.durationMin * MINUTE_MS;
  const lobby = planLobby({
    seed: spec.seed,
    createdAt: spec.createdAt,
    maxParticipants: settings.maxParticipants,
    hostIndex: host.index,
    seated: 1,
    appeal: spec.appeal,
    activity: activityAt(spec.createdAt),
    presence: Math.max(0.3, ctx.presence),
    allowLateJoin: settings.allowLateJoin,
    durationMs: duration,
    exclude: new Set([...ctx.busy, host.index]),
    tilt: 0,
  });
  const startedAt = lobby.startAt !== null ? lobby.startAt + COUNTDOWN_MS : null;
  const over =
    lobby.cancelAt !== null ? lobby.cancelAt : startedAt !== null ? startedAt + duration : Infinity;
  if (over <= now) return null;

  const symbol = r.pick(settings.assets);
  const marketStart = ctx.market.pickStart(symbol, settings);
  const base = { symbol, marketStart };
  const chat: BattleChatDoc[] = [systemMessage(`${host.name} created the battle`, spec.createdAt)];
  const parts: BattleParticipantDoc[] = [
    botParticipant(host.index, base, spec.createdAt, 0, ctx.market),
  ];
  const future: BotLobbyEventDoc[] = [];
  let status: BattleDoc['status'] = 'standby';
  let countdownEndsAt: number | null = null;
  for (const e of lobby.events) {
    if (e.at > now) {
      future.push(e as BotLobbyEventDoc);
      continue;
    }
    if (e.kind === 'join') {
      parts.push(botParticipant(e.index, base, e.at, 0, ctx.market));
      chat.push(systemMessage(`${botIdentity(e.index).name} joined`, e.at));
    } else if (e.kind === 'leave') {
      const k = parts.findIndex((p) => p.bot?.index === e.index);
      if (k > 0) {
        parts.splice(k, 1);
        chat.push(systemMessage(`${botIdentity(e.index).name} left`, e.at));
      }
    } else if (e.kind === 'chat') {
      if (parts.some((p) => p.bot?.index === e.index)) chat.push(botMessage(e.index, e.text, e.at));
    } else if (e.kind === 'start') {
      status = 'countdown';
      countdownEndsAt = e.at + COUNTDOWN_MS;
      chat.push(systemMessage(`${host.name} started the countdown`, e.at));
    }
  }
  let live = false;
  if (countdownEndsAt !== null && countdownEndsAt <= now) {
    status = 'live';
    live = true;
    chat.push(systemMessage('The battle has started', countdownEndsAt));
  }
  const late: BattleBotsDoc['late'] = [];
  for (const l of lobby.late) {
    if (live && countdownEndsAt! + l.atElapsed <= now) {
      if (parts.length >= settings.maxParticipants || parts.some((p) => p.bot?.index === l.index))
        continue;
      const at = countdownEndsAt! + l.atElapsed;
      parts.push(botParticipant(l.index, base, at, l.atElapsed, ctx.market));
      chat.push(systemMessage(`${botIdentity(l.index).name} joined`, at));
    } else late.push(l);
  }
  const id = new ObjectId(spec.id);
  return {
    _id: id,
    code: battleCode(() => r.next()),
    mode: 'casual',
    format: null,
    hostId: parts[0]!.userId,
    bots: {
      origin: 'world',
      seed: spec.seed,
      tilt: 0,
      events: future,
      late,
      chat: [],
      startAt: null,
      endChat: false,
    },
    settings,
    symbol,
    marketStart,
    status,
    createdAt: spec.createdAt,
    updatedAt: now,
    countdownEndsAt,
    startedAt: live ? countdownEndsAt : null,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    endReason: null,
    participants: parts,
    chat: chat.sort((x, y) => x.at - y.at).slice(-MAX_CHAT),
    results: null,
    version: 0,
  };
}

/**
 * An unrated duel against a trader looking for a casual 1v1, offered when ranked matchmaking
 * finds nobody. Same rules as the ranked format; never touches Elo.
 */
export function duelBattle(input: {
  readonly id: ObjectId;
  readonly code: string;
  readonly format: RankedFormat;
  readonly human: BattleParticipantDoc;
  readonly now: number;
  readonly busy: ReadonlySet<number>;
  readonly tilt: number;
  readonly market: BattleMarket;
  readonly symbol: string;
  readonly marketStart: number;
}): BattleDoc | null {
  const seed = seedOf(input.id.toHexString(), 'duel');
  const who = drawIdentities(seed, 1, input.busy, input.tilt)[0];
  if (!who) return null;
  const base = { symbol: input.symbol, marketStart: input.marketStart };
  const bot = botParticipant(who.index, base, input.now, 0, input.market);
  const settings: BattleSettings = {
    ...input.format.settings,
    name: input.format.settings.winCondition === 'profit-target' ? 'اسپرینت آزاد' : 'دوئل آزاد',
    visibility: 'private',
    allowLateJoin: false,
  };
  return {
    _id: input.id,
    code: input.code,
    mode: 'casual',
    format: null,
    hostId: null,
    bots: {
      origin: 'duel',
      seed,
      tilt: input.tilt,
      events: [],
      late: [],
      chat: [],
      startAt: null,
      endChat: false,
    },
    settings,
    symbol: input.symbol,
    marketStart: input.marketStart,
    status: 'countdown',
    createdAt: input.now,
    updatedAt: input.now,
    countdownEndsAt: input.now + COUNTDOWN_MS + 5_000,
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    endReason: null,
    participants: [bot, input.human],
    chat: [systemMessage(`Match found: ${bot.name} vs ${input.human.name}`, input.now)],
    results: null,
    version: 0,
  };
}

/** Index of a bot id (for code that only has the ObjectId). */
export const botIndexOfId = (id: ObjectId) => botIndexOf(id.toHexString());

export { botIdHex };
