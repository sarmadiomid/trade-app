import 'server-only';
import { ObjectId } from 'mongodb';
import { rankedFormat, type QueueStatus, type RankedFormat } from '@/lib/battles';
import { collections, type BattleQueueDoc } from '../db';
import { ensureProfile } from './profiles';
import { BattleError, createRankedBattle, type Player } from './service';

/** A searcher who hasn't polled for this long is considered gone. */
const ALIVE_MS = 12_000;
const BASE_RANGE = 150;
const RANGE_STEP = 50;
const RANGE_STEP_MS = 5_000;
const MAX_RANGE = 2000;

/** Elo window a searcher accepts after waiting `waited` ms: it widens every 5 seconds. */
export const searchRange = (waited: number) =>
  Math.min(MAX_RANGE, BASE_RANGE + Math.floor(waited / RANGE_STEP_MS) * RANGE_STEP);

async function status(doc: BattleQueueDoc | null, now: number): Promise<QueueStatus> {
  if (!doc) return { status: 'idle' };
  if (doc.status === 'matched' && doc.battleId)
    return { status: 'matched', battleId: doc.battleId.toHexString() };
  const { battleQueue } = await collections();
  const searching = await battleQueue.countDocuments({
    format: doc.format,
    status: { $ne: 'matched' },
    lastSeen: { $gt: now - ALIVE_MS },
  });
  return {
    status: 'searching',
    format: doc.format,
    since: doc.joinedAt,
    range: searchRange(now - doc.joinedAt),
    searching,
  };
}

/** Starts (or keeps) searching for a ranked match. */
export async function joinQueue(user: Player, formatId: unknown): Promise<QueueStatus> {
  const format = typeof formatId === 'string' ? rankedFormat(formatId) : null;
  if (!format) throw new BattleError('Unknown ranked format');
  const { battleQueue } = await collections();
  const profile = await ensureProfile(user._id);
  const now = Date.now();
  const existing = await battleQueue.findOne({ _id: user._id });
  if (existing?.status === 'matched') return status(existing, now);
  await battleQueue.updateOne(
    { _id: user._id },
    {
      $set: {
        format: format.id,
        elo: profile.elo,
        games: profile.rankedGames,
        name: user.name,
        lastSeen: now,
        status: 'searching',
        battleId: null,
      },
      $setOnInsert: { joinedAt: now },
    },
    { upsert: true },
  );
  if (existing && existing.format !== format.id)
    await battleQueue.updateOne({ _id: user._id }, { $set: { joinedAt: now } });
  return pollQueue(user);
}

/** Keeps the search alive and tries to pair the user with a waiting opponent. */
export async function pollQueue(user: Player): Promise<QueueStatus> {
  const { battleQueue } = await collections();
  const now = Date.now();
  const me = await battleQueue.findOneAndUpdate(
    { _id: user._id },
    { $set: { lastSeen: now } },
    { returnDocument: 'after' },
  );
  if (!me || me.status === 'matched') return status(me, now);
  // Lock ourselves so two searchers never pick each other at the same time.
  const locked = await battleQueue.findOneAndUpdate(
    { _id: user._id, status: 'searching' },
    { $set: { status: 'matching' } },
    { returnDocument: 'after' },
  );
  if (!locked) return status(await battleQueue.findOne({ _id: user._id }), now);
  const range = searchRange(now - me.joinedAt);
  const battleId = new ObjectId();
  const opponent = await battleQueue.findOneAndUpdate(
    {
      _id: { $ne: user._id },
      format: me.format,
      status: 'searching',
      lastSeen: { $gt: now - ALIVE_MS },
      elo: { $gte: me.elo - range, $lte: me.elo + range },
    },
    { $set: { status: 'matched', battleId } },
    { sort: { joinedAt: 1 }, returnDocument: 'after' },
  );
  if (!opponent) {
    await battleQueue.updateOne(
      { _id: user._id, status: 'matching' },
      { $set: { status: 'searching' } },
    );
    return status(await battleQueue.findOne({ _id: user._id }), now);
  }
  const format = rankedFormat(me.format) as RankedFormat;
  await createRankedBattle(battleId, format, [
    { _id: opponent._id, name: opponent.name },
    { _id: user._id, name: user.name },
  ]);
  await battleQueue.updateOne({ _id: user._id }, { $set: { status: 'matched', battleId } });
  return { status: 'matched', battleId: battleId.toHexString() };
}

export async function queueStatus(user: Player): Promise<QueueStatus> {
  const { battleQueue } = await collections();
  return status(await battleQueue.findOne({ _id: user._id }), Date.now());
}

/** Stops searching. A match that was already found is returned instead. */
export async function leaveQueue(user: Player): Promise<QueueStatus> {
  const { battleQueue } = await collections();
  const doc = await battleQueue.findOne({ _id: user._id });
  if (doc?.status === 'matched') return status(doc, Date.now());
  await battleQueue.deleteOne({ _id: user._id, status: { $ne: 'matched' } });
  return { status: 'idle' };
}

/** Forget a match once the player has been sent to it. */
export async function clearMatched(user: Player): Promise<void> {
  const { battleQueue } = await collections();
  await battleQueue.deleteOne({ _id: user._id, status: 'matched' });
}
