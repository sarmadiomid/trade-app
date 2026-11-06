import 'server-only';
import { randomInt } from 'node:crypto';
import { ObjectId, type UpdateFilter } from 'mongodb';
import {
  COUNTDOWN_MS,
  DEFAULT_SETTINGS,
  MAX_ACTIONS,
  MAX_CHAT,
  SEED_LOBBY_PRESETS,
  SEED_LOBBY_TARGET,
  battleCode,
  botSkill,
  marketCursor,
  marketEnd,
  normalizeSettings,
  planBotTrades,
  randomBotName,
  type BattleClock,
} from '@/lib/battles';
import { MINUTE_MS } from '@/lib/core';
import type { TradeAction } from '@/lib/backtest';
import { collections, type BattleActionDoc, type BattleDoc, type BattleParticipantDoc } from '../db';
import { battleMinutes, battleSpec, bidBefore, pickMarketStart, randomUnit } from './market';
import { validateAction } from './simulate';
import type { Player } from './service';

export interface BotPlayer extends Player {
  readonly isBot: true;
  readonly elo: number;
  readonly games: number;
}

/** Sparring opponent near the human's Elo, with a normal-looking display name. */
export function makeBotPlayer(humanElo: number, range = 150): BotPlayer {
  const span = Math.min(range, 120);
  const jitter = randomInt(-span, span + 1);
  return {
    _id: new ObjectId(),
    name: randomBotName(randomInt(0, 1_000_000_000)),
    isBot: true,
    elo: Math.max(100, humanElo + jitter),
    games: 25,
  };
}

export const isBotParticipant = (p: BattleParticipantDoc) => Boolean(p.isBot);

/** Seed derived from the battle + bot ids so the plan is stable across ticks. */
export function botPlanSeed(battleId: ObjectId, botId: ObjectId): number {
  const a = battleId.toString().slice(-8);
  const b = botId.toString().slice(-8);
  return (parseInt(a, 16) ^ parseInt(b, 16)) >>> 0;
}

/**
 * Advances every live bot to the battle clock (or the farthest human cursor) and appends
 * planned trades. Returns a Mongo update, or null when nothing changed.
 */
export function botTickUpdate(
  b: BattleDoc,
  now: number,
  clock: BattleClock,
): UpdateFilter<BattleDoc> | null {
  if (b.status !== 'live') return null;
  const bots = b.participants
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isBotParticipant(p) && p.leftT === null);
  if (bots.length === 0) return null;

  const end = marketEnd(clock);
  const clockCursor = Math.min(end, Math.max(b.marketStart, marketCursor(clock, now)));
  let humanMax = b.marketStart;
  for (const p of b.participants) {
    if (isBotParticipant(p)) continue;
    const c = Math.min(end, Math.max(p.startT, p.cursor ?? p.startT));
    if (c > humanMax) humanMax = c;
  }
  const until = Math.min(end, Math.max(clockCursor, humanMax));

  const $set: Record<string, unknown> = {};
  const $push: Record<string, unknown> = {};
  let changed = false;

  for (const { p, i } of bots) {
    const cur = Math.min(end, Math.max(p.startT, p.cursor ?? p.startT));
    if (until <= cur) continue;

    const spec = battleSpec(b.symbol);
    const minutes = battleMinutes(b.symbol, b.marketStart, end).filter((bar) => bar.time >= p.startT);
    const plan = planBotTrades({
      bars: minutes,
      startT: p.startT,
      endT: end,
      pipSize: spec.pipSize,
      lotMin: spec.lotMin,
      seed: botPlanSeed(b._id, p.userId),
      skill: botSkill(p.elo),
    });

    const lastT = p.actions[p.actions.length - 1]?.t ?? p.startT - MINUTE_MS;
    const fresh: BattleActionDoc[] = [];
    let working: BattleParticipantDoc = p;
    for (const step of plan) {
      if (step.t <= lastT || step.t > until) continue;
      if (working.actions.length + fresh.length >= MAX_ACTIONS) break;
      const action = step.a as TradeAction;
      const error = validateAction(b, working, step.t, action);
      if (error) continue;
      const doc: BattleActionDoc = { t: step.t, a: action, at: now };
      fresh.push(doc);
      working = {
        ...working,
        actions: [...working.actions, doc],
        cursor: step.t,
      };
    }

    if (until > cur) {
      $set[`participants.${i}.cursor`] = until;
      changed = true;
    }
    if (fresh.length > 0) {
      $push[`participants.${i}.actions`] = { $each: fresh };
      changed = true;
    }
  }

  if (!changed) return null;
  return {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($push).length ? { $push } : {}),
  } as UpdateFilter<BattleDoc>;
}

function systemMessage(text: string, at: number) {
  return {
    id: new ObjectId().toHexString(),
    userId: null as ObjectId | null,
    name: 'System',
    text,
    at,
    system: true as const,
  };
}

async function uniqueCode(): Promise<string> {
  const { battles } = await collections();
  for (;;) {
    const code = battleCode(randomUnit);
    if (!(await battles.findOne({ code }, { projection: { _id: 1 } }))) return code;
  }
}

/** Public standby lobby hosted by a bot — shows up in browse for cold-start. */
export async function createSeededLobby(presetIndex: number): Promise<BattleDoc> {
  const preset = SEED_LOBBY_PRESETS[presetIndex % SEED_LOBBY_PRESETS.length]!;
  const host = makeBotPlayer(980 + randomInt(0, 140));
  const settings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    name: preset.name,
    assets: [...preset.assets],
    durationMin: preset.durationMin,
    speed: preset.speed,
    winCondition: preset.winCondition,
    profitTargetPct: preset.profitTargetPct,
    maxDrawdownPct: preset.maxDrawdownPct,
    maxDailyDrawdownPct: 5,
    maxParticipants: 2,
    visibility: 'public',
    allowLateJoin: false,
    startingBalance: 100_000,
  });
  const symbol = settings.assets[0]!;
  const marketStart = pickMarketStart(symbol, settings);
  const now = Date.now();
  const participant: BattleParticipantDoc = {
    userId: host._id,
    name: host.name,
    joinedAt: now,
    startT: marketStart,
    startBid: bidBefore(symbol, marketStart),
    elo: host.elo,
    games: host.games,
    actions: [],
    cursor: marketStart,
    leftT: null,
    isBot: true,
  };
  const doc: BattleDoc = {
    _id: new ObjectId(),
    code: await uniqueCode(),
    mode: 'casual',
    format: null,
    hostId: host._id,
    seeded: true,
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
    participants: [participant],
    chat: [systemMessage(`${host.name} created the battle`, now)],
    results: null,
    version: 0,
  };
  const { battles } = await collections();
  await battles.insertOne(doc);
  return doc;
}

/** Keep ~SEED_LOBBY_TARGET public bot-hosted lobbies waiting in browse. */
export async function ensureSeededLobbies(): Promise<void> {
  const { battles } = await collections();
  const open = await battles.countDocuments({
    seeded: true,
    status: 'standby',
    'settings.visibility': 'public',
  });
  const need = Math.max(0, SEED_LOBBY_TARGET - open);
  for (let i = 0; i < need; i++) await createSeededLobby(open + i);
}

/**
 * When a human joins a bot-hosted standby lobby, start the countdown so they do not wait
 * for a host click that will never come.
 */
export function botHostAutoStart(
  b: BattleDoc,
  now: number,
): UpdateFilter<BattleDoc> | null {
  if (b.status !== 'standby' || !b.hostId) return null;
  const host = b.participants.find((p) => p.userId.equals(b.hostId!));
  if (!host || !isBotParticipant(host)) return null;
  const hasHuman = b.participants.some((p) => !isBotParticipant(p) && p.leftT === null);
  if (!hasHuman) return null;
  return {
    $set: { status: 'countdown', countdownEndsAt: now + COUNTDOWN_MS },
    $push: {
      chat: {
        $each: [systemMessage(`${host.name} started the countdown`, now)],
        $slice: -MAX_CHAT,
      },
    },
  };
}
