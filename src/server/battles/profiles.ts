import 'server-only';
import type { ObjectId } from 'mongodb';
import { START_ELO, type BattleProfile, type LeaderboardEntry } from '@/lib/battles';
import { collections, type BattleProfileDoc } from '../db';
import { defaultDisplayName } from '../migrations';

const fresh = (id: ObjectId): BattleProfileDoc => ({
  _id: id,
  elo: START_ELO,
  peakElo: START_ELO,
  rankedGames: 0,
  rankedWins: 0,
  rankedLosses: 0,
  battles: 0,
  wins: 0,
  podiums: 0,
  xp: 0,
  winStreak: 0,
  bestStreak: 0,
  trades: 0,
  winningTrades: 0,
  returnSum: 0,
  bestReturn: null,
  updatedAt: 0,
});

/** The user's battle profile, created with the starting Elo on first use. */
export async function ensureProfile(userId: ObjectId): Promise<BattleProfileDoc> {
  const { battleProfiles } = await collections();
  const doc = await battleProfiles.findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: fresh(userId) },
    { upsert: true, returnDocument: 'after' },
  );
  return doc ?? fresh(userId);
}

export async function profileView(userId: ObjectId, name: string): Promise<BattleProfile> {
  const { battleProfiles } = await collections();
  const p = await ensureProfile(userId);
  const globalRank =
    p.rankedGames > 0
      ? (await battleProfiles.countDocuments({ rankedGames: { $gt: 0 }, elo: { $gt: p.elo } })) + 1
      : null;
  return {
    userId: userId.toHexString(),
    name,
    elo: p.elo,
    peakElo: p.peakElo,
    rankedGames: p.rankedGames,
    rankedWins: p.rankedWins,
    rankedLosses: p.rankedLosses,
    battles: p.battles,
    wins: p.wins,
    podiums: p.podiums,
    xp: p.xp,
    winStreak: p.winStreak,
    bestStreak: p.bestStreak,
    trades: p.trades,
    winningTrades: p.winningTrades,
    avgReturn: p.battles > 0 ? p.returnSum / p.battles : null,
    bestReturn: p.bestReturn,
    globalRank,
  };
}

/** Global Elo leaderboard (traders with at least one ranked battle). */
export async function leaderboard(
  me: ObjectId,
  sort: 'elo' | 'xp',
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const { battleProfiles, users } = await collections();
  const filter = sort === 'elo' ? { rankedGames: { $gt: 0 } } : { battles: { $gt: 0 } };
  const top = await battleProfiles
    .find(filter)
    .sort(sort === 'elo' ? { elo: -1, rankedWins: -1, _id: 1 } : { xp: -1, _id: 1 })
    .limit(limit)
    .toArray();
  const names = new Map(
    (
      await users
        .find({ _id: { $in: top.map((p) => p._id) } }, { projection: { phone: 1, displayName: 1 } })
        .toArray()
    ).map((u) => [u._id.toHexString(), u.displayName ?? defaultDisplayName(u.phone)]),
  );
  return top.map((p, i) => ({
    place: i + 1,
    userId: p._id.toHexString(),
    name: names.get(p._id.toHexString()) ?? 'Trader',
    elo: p.elo,
    rankedGames: p.rankedGames,
    rankedWins: p.rankedWins,
    xp: p.xp,
    isMe: p._id.equals(me),
  }));
}

const NAME_RE = /^[\p{L}\p{N} _.\-]{3,20}$/u;

/** Changes the user's public name. Returns an error message or null. */
export async function setDisplayName(userId: ObjectId, raw: unknown): Promise<string | null> {
  if (typeof raw !== 'string') return 'Invalid name';
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!NAME_RE.test(name)) return 'Use 3–20 letters, digits, spaces, _ . or -';
  const { users } = await collections();
  await users.updateOne({ _id: userId }, { $set: { displayName: name } });
  return null;
}
