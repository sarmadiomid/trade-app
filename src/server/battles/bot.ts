import 'server-only';
import { ObjectId, type UpdateFilter } from 'mongodb';
import {
  BOT_NAME,
  MAX_ACTIONS,
  botSkill,
  marketCursor,
  marketEnd,
  planBotTrades,
  type BattleClock,
} from '@/lib/battles';
import { MINUTE_MS } from '@/lib/core';
import type { TradeAction } from '@/lib/backtest';
import type { BattleActionDoc, BattleDoc, BattleParticipantDoc } from '../db';
import { battleMinutes, battleSpec } from './market';
import { validateAction } from './simulate';
import type { Player } from './service';

export interface BotPlayer extends Player {
  readonly isBot: true;
  readonly elo: number;
  readonly games: number;
}

/** A labeled sparring opponent near the human's Elo. */
export function makeBotPlayer(humanElo: number, range = 150): BotPlayer {
  const jitter = Math.round((Math.random() * 2 - 1) * Math.min(range, 120));
  return {
    _id: new ObjectId(),
    name: BOT_NAME,
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
