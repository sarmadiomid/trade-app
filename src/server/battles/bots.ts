import 'server-only';
import { randomInt } from 'node:crypto';
import type { ObjectId } from 'mongodb';
import { xpFor, type FinalResult } from '@/lib/battles';
import {
  DEFAULT_BOT_CONFIG,
  botConfigFromEnv,
  botPresence,
  normalizeBotConfig,
  type BotConfig,
} from '@/lib/app/battle/bots/config';
import { botIndexOf } from '@/lib/app/battle/bots/identity';
import {
  WORLD_SLOT_MS,
  activityAt,
  extraBattle,
  openLobbyFloor,
  slotChance,
  slotOf,
  worldSlot,
} from '@/lib/app/battle/bots/world';
import { collections, type BattleBotsDoc, type BattleDoc } from '../db';
import { ACTIVE_STATUSES, fillMeta, materializeWorld } from './bot-room';
import { battleMarket } from './market';

/**
 * Server side of the bots: operator config (env + admin override), measured real activity
 * (which phases bots out), the world schedule tick and housekeeping. See docs/BATTLE-BOTS.md.
 */

const CONFIG_TTL_MS = 15_000;
const ACTIVITY_TTL_MS = 30_000;
const TICK_MS = 5_000;
/** A world battle never lives longer than its lobby (≤ 30 min) plus the longest battle. */
const WORLD_HORIZON_MS = 75 * 60_000;
const CLEANUP_MS = 60_000;
const BOT_ONLY_KEEP_MS = 15 * 60_000;

const g = globalThis as unknown as {
  __bots?: {
    config: { at: number; value: BotConfig } | null;
    humans: { at: number; value: number } | null;
    lastTick: number;
    lastCleanup: number;
  };
};
const state = () => (g.__bots ??= { config: null, humans: null, lastTick: 0, lastCleanup: 0 });

/** Effective config: environment defaults, overridden by the admin setting. */
export async function botConfig(): Promise<BotConfig> {
  const s = state();
  const now = Date.now();
  if (s.config && now - s.config.at < CONFIG_TTL_MS) return s.config.value;
  const env = botConfigFromEnv(process.env);
  let value = env;
  try {
    const { battleWorld } = await collections();
    const doc = await battleWorld.findOne({ _id: 'config' });
    if (doc?.config) value = normalizeBotConfig(doc.config as Partial<BotConfig>, env);
  } catch {
    value = env;
  }
  s.config = { at: now, value };
  return value;
}

export async function setBotConfig(patch: unknown): Promise<BotConfig> {
  const env = botConfigFromEnv(process.env);
  const current = await botConfig();
  const next = normalizeBotConfig(
    { ...current, ...(patch && typeof patch === 'object' ? (patch as Partial<BotConfig>) : {}) },
    env,
  );
  const { battleWorld } = await collections();
  await battleWorld.updateOne(
    { _id: 'config' },
    { $set: { config: { ...next }, updatedAt: Date.now() } },
    { upsert: true },
  );
  state().config = { at: Date.now(), value: next };
  return next;
}

/** Real traders active right now: in a battle that is open or running, or searching ranked. */
export async function humanActivity(): Promise<number> {
  const s = state();
  const now = Date.now();
  if (s.humans && now - s.humans.at < ACTIVITY_TTL_MS) return s.humans.value;
  const { battles, battleQueue } = await collections();
  const [rows, searching] = await Promise.all([
    battles
      .aggregate<{ n: number }>([
        { $match: { status: { $in: [...ACTIVE_STATUSES] } } },
        { $unwind: '$participants' },
        { $match: { 'participants.isBot': { $ne: true }, 'participants.leftT': null } },
        { $group: { _id: '$participants.userId' } },
        { $count: 'n' },
      ])
      .toArray(),
    battleQueue.countDocuments({ status: 'searching', lastSeen: { $gt: now - 15_000 } }),
  ]);
  const value = (rows[0]?.n ?? 0) + searching;
  s.humans = { at: now, value };
  return value;
}

/** Forget the cached activity (a real user just joined or finished). */
export const noteHumanActivity = () => {
  state().humans = null;
};

/** 0–1 bot presence wanted right now (config × phase-out by real activity). */
export async function presenceNow(): Promise<number> {
  const config = await botConfig();
  if (!config.enabled) return 0;
  return botPresence(config, await humanActivity());
}

/** Bot identities seated in running battles other than `except`. */
export async function busyBots(except?: ObjectId): Promise<Set<number>> {
  const { battles } = await collections();
  const ids = await battles.distinct('participants.userId', {
    status: { $in: [...ACTIVE_STATUSES] },
    'participants.isBot': true,
    ...(except ? { _id: { $ne: except } } : {}),
  });
  const out = new Set<number>();
  for (const id of ids as ObjectId[]) {
    const i = botIndexOf(id.toHexString());
    if (i !== null) out.add(i);
  }
  return out;
}

/** Bots for a public battle a real user created (null: none wanted). */
export async function fillFor(doc: BattleDoc, tilt: number): Promise<BattleBotsDoc | null> {
  if (doc.settings.visibility !== 'public') return null;
  const config = await botConfig();
  if (!config.enabled || !config.fill) return null;
  const presence = botPresence(config, await humanActivity());
  if (presence <= 0) return null;
  return fillMeta({
    battleId: doc._id,
    createdAt: doc.createdAt,
    settings: doc.settings,
    presence,
    busy: await busyBots(),
    tilt,
  });
}

/** XP a bot shows on the results screen (never stored anywhere but the battle's results). */
export function botXp(r: FinalResult, participants: number): number {
  return xpFor({
    place: r.place,
    participants,
    status: r.status,
    profitableTrades: r.wins,
    winStreak: 0,
  });
}

/**
 * Advances the world schedule: opens the bot-hosted public battles whose slots have come up
 * since the last tick (throttled; idempotent across instances). After an idle period the
 * backlog window is evaluated at once, so the first visitor finds battles that have been
 * filling and running for a while, not a burst of brand-new lobbies.
 */
export async function worldTick(now = Date.now()): Promise<number> {
  const s = state();
  if (now - s.lastTick < TICK_MS) return 0;
  s.lastTick = now;
  const config = await botConfig();
  const { battleWorld, battles } = await collections();
  await cleanup(now);
  if (!config.enabled || !config.world) return 0;
  // Claim the window (one instance at a time).
  const doc = await battleWorld.findOne({ _id: 'world' });
  const cursor = doc?.cursor ?? 0;
  if (now - cursor < TICK_MS) return 0;
  const claimed = await battleWorld
    .updateOne(
      { _id: 'world', ...(doc ? { cursor } : {}) },
      { $set: { cursor: now, updatedAt: now } },
      { upsert: !doc },
    )
    .catch(() => null);
  if (!claimed || (claimed.matchedCount === 0 && claimed.upsertedCount === 0)) return 0;

  const presence = botPresence(config, await humanActivity());
  if (presence <= 0) return 0;
  const from = Math.max(cursor, now - WORLD_HORIZON_MS);
  let opened = 0;
  let busy: Set<number> | null = null;
  for (let slot = slotOf(from) + 1; slot <= slotOf(now); slot++) {
    const spec = worldSlot(slot);
    if (spec.createdAt > now || spec.createdAt <= from) continue;
    if (spec.roll >= slotChance(activityAt(spec.createdAt), presence)) continue;
    busy ??= await busyBots();
    const battle = materializeWorld(spec, now, { market: battleMarket, busy, presence });
    if (!battle) continue;
    try {
      await battles.insertOne(battle);
      opened += 1;
      for (const p of battle.participants) if (p.bot) busy.add(p.bot.index);
    } catch {
      // Another instance opened it (same _id), or its code collided: skip the slot.
    }
  }
  // Keep a joinable lobby around at normal hours (a new lobby appears, like a host creating one).
  const floor = openLobbyFloor(activityAt(now), presence);
  if (floor > 0) {
    const open = await battles.countDocuments({
      'bots.origin': 'world',
      status: 'standby',
      createdAt: { $gt: now - 30 * 60_000 },
    });
    for (let k = open; k < floor; k++) {
      busy ??= await busyBots();
      for (let attempt = 0; attempt < 6; attempt++) {
        const spec = extraBattle(randomInt(0, 2 ** 31), now - randomInt(5_000, 70_000));
        const battle = materializeWorld(spec, now, { market: battleMarket, busy, presence });
        if (!battle || battle.status !== 'standby') continue;
        try {
          await battles.insertOne(battle);
          opened += 1;
          for (const p of battle.participants) if (p.bot) busy.add(p.bot.index);
        } catch {
          // Code collision: try another.
          continue;
        }
        break;
      }
    }
  }
  return opened;
}

/** Bot-only battles that are over are deleted (nobody real ever saw their results). */
async function cleanup(now: number): Promise<void> {
  const s = state();
  if (now - s.lastCleanup < CLEANUP_MS) return;
  s.lastCleanup = now;
  const { battles } = await collections();
  await battles.deleteMany({
    'bots.origin': { $in: ['world', 'fill'] },
    status: { $in: ['completed', 'cancelled'] },
    updatedAt: { $lt: now - BOT_ONLY_KEEP_MS },
    participants: { $not: { $elemMatch: { isBot: { $ne: true } } } },
  });
}

/** What the admin sees: the effective config, the env defaults and live numbers. */
export async function botStatus() {
  const [config, humans] = await Promise.all([botConfig(), humanActivity()]);
  const { battles } = await collections();
  const active = await battles
    .aggregate<{ _id: null; world: number; botSeats: number; mixed: number }>([
      { $match: { status: { $in: [...ACTIVE_STATUSES] }, bots: { $exists: true } } },
      {
        $project: {
          world: { $cond: [{ $eq: ['$bots.origin', 'world'] }, 1, 0] },
          botSeats: {
            $size: {
              $filter: {
                input: '$participants',
                cond: { $and: [{ $eq: ['$$this.isBot', true] }, { $eq: ['$$this.leftT', null] }] },
              },
            },
          },
          mixed: {
            $cond: [
              {
                $gt: [
                  {
                    $size: {
                      $filter: { input: '$participants', cond: { $ne: ['$$this.isBot', true] } },
                    },
                  },
                  0,
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          world: { $sum: '$world' },
          botSeats: { $sum: '$botSeats' },
          mixed: { $sum: '$mixed' },
        },
      },
    ])
    .toArray();
  return {
    config,
    defaults: botConfigFromEnv(process.env),
    builtin: DEFAULT_BOT_CONFIG,
    humans,
    presence: botPresence(config, humans),
    activity: activityAt(Date.now()),
    worldBattles: active[0]?.world ?? 0,
    botSeats: active[0]?.botSeats ?? 0,
    mixedBattles: active[0]?.mixed ?? 0,
    slotMs: WORLD_SLOT_MS,
  };
}
