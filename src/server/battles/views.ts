import 'server-only';
import type { ObjectId } from 'mongodb';
import { durationMs, type BattleSummary, type BattleView, type Standing } from '@/lib/battles';
import { collections, type BattleDoc } from '../db';
import { clockOf, cursorOf, joinBlocked, liveStandings, refresh } from './service';

/** What one viewer sees of a battle (only their own actions are included). */
export function battleView(b: BattleDoc, viewerId: ObjectId, now = Date.now()): BattleView {
  const me = b.participants.find((p) => p.userId.equals(viewerId)) ?? null;
  const member = me !== null;
  const host = member && b.hostId ? b.participants.find((p) => p.userId.equals(b.hostId!)) : null;
  let standings: readonly Standing[] = [];
  if (member) {
    if (b.status === 'completed' && b.results) standings = b.results;
    else standings = liveStandings(b);
  }
  const mine = standings.find((s) => s.userId === viewerId.toHexString());
  const privateBattle = b.settings.visibility === 'private';
  return {
    id: b._id.toHexString(),
    code: member || !privateBattle ? b.code : '',
    mode: b.mode,
    format: b.format,
    status: b.status,
    settings: b.settings,
    symbol: b.status === 'standby' ? null : b.symbol,
    clock: clockOf(b),
    countdownEndsAt: b.countdownEndsAt,
    serverNow: now,
    cursor: me ? cursorOf(b, me) : b.marketStart,
    host: host ? { id: host.userId.toHexString(), name: host.name } : null,
    isHost: Boolean(member && me?.leftT === null && b.hostId?.equals(viewerId)),
    standings,
    me: me
      ? {
          startT: me.startT,
          startBid: me.startBid,
          actions: me.actions.map((x) => ({ t: x.t, a: x.a })),
          status: mine?.status ?? 'active',
        }
      : null,
    chat: member
      ? b.chat.map((c) => ({
          id: c.id,
          userId: c.userId?.toHexString() ?? null,
          name: c.name,
          text: c.text,
          at: c.at,
          system: c.system,
        }))
      : [],
    results: member ? b.results : null,
    endReason: member ? b.endReason : null,
    joinBlocked: me ? null : joinBlocked(b, viewerId),
    createdAt: b.createdAt,
  };
}

export function battleSummary(b: BattleDoc, viewerId: ObjectId): BattleSummary {
  const s = b.settings;
  const host = b.hostId ? b.participants.find((p) => p.userId.equals(b.hostId!)) : null;
  const mine = b.results?.find((r) => r.userId === viewerId.toHexString()) ?? null;
  return {
    id: b._id.toHexString(),
    code: b.code,
    name: s.name,
    mode: b.mode,
    format: b.format,
    status: b.status,
    winCondition: s.winCondition,
    startingBalance: s.startingBalance,
    assets: s.assets,
    durationMin: s.durationMin,
    profitTargetPct: s.profitTargetPct,
    maxDrawdownPct: s.maxDrawdownPct,
    maxDailyDrawdownPct: s.maxDailyDrawdownPct,
    visibility: s.visibility,
    allowLateJoin: s.allowLateJoin,
    hostName: host?.name ?? null,
    participants: b.participants.length,
    maxParticipants: s.maxParticipants,
    participantNames: b.participants.map((p) => p.name),
    createdAt: b.createdAt,
    startedAt: b.startedAt,
    endsAt:
      b.startedAt !== null && b.status === 'live'
        ? b.startedAt + b.pausedMs + durationMs(clockOf(b))
        : null,
    joined: b.participants.some((p) => p.userId.equals(viewerId)),
    myPlace: mine?.place ?? null,
    myReturn: mine?.returnPct ?? null,
    myEloChange:
      mine && mine.eloAfter !== null && mine.eloBefore !== null
        ? mine.eloAfter - mine.eloBefore
        : null,
    winnerName: b.results?.[0]?.name ?? null,
  };
}

/** A battle whose countdown or timer has run out but that nobody has read since. */
function stale(b: BattleDoc, now: number): boolean {
  if (b.status === 'countdown') return b.countdownEndsAt !== null && now >= b.countdownEndsAt;
  if (b.status === 'live' || b.status === 'paused') {
    const c = clockOf(b);
    return now - (b.startedAt ?? now) - b.pausedMs >= durationMs(c) || b.status === 'live';
  }
  return false;
}

const LOBBY_MAX_AGE_MS = 24 * 3600_000;

/** Public battles that can still be joined or watched: in the lobby or in progress. */
export async function browseBattles(viewerId: ObjectId): Promise<BattleSummary[]> {
  const { battles } = await collections();
  const now = Date.now();
  const docs = await battles
    .find({
      'settings.visibility': 'public',
      status: { $in: ['standby', 'countdown', 'live', 'paused'] },
      createdAt: { $gt: now - LOBBY_MAX_AGE_MS },
    })
    .sort({ createdAt: -1 })
    .limit(60)
    .toArray();
  const out: BattleSummary[] = [];
  for (let b of docs) {
    if (stale(b, now)) b = await refresh(b);
    if (b.status === 'completed' || b.status === 'cancelled') continue;
    out.push(battleSummary(b, viewerId));
  }
  return out;
}

/** Battles the viewer created or joined, newest first. */
export async function myBattles(viewerId: ObjectId): Promise<BattleSummary[]> {
  const { battles } = await collections();
  const now = Date.now();
  const docs = await battles
    .find({ 'participants.userId': viewerId, status: { $ne: 'cancelled' } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  const out: BattleSummary[] = [];
  for (let b of docs) {
    if (stale(b, now)) b = await refresh(b);
    out.push(battleSummary(b, viewerId));
  }
  return out;
}

/** Battles currently in progress (any visibility) the viewer is part of. */
export async function activeBattleOf(viewerId: ObjectId): Promise<BattleSummary | null> {
  const list = await myBattles(viewerId);
  return list.find((b) => b.status !== 'completed' && b.status !== 'cancelled') ?? null;
}
