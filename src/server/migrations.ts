import 'server-only';
import type { Db } from 'mongodb';

/**
 * Versioned database migrations. Each runs once, in order, and is recorded in the
 * `migrations` collection; they run automatically on the first connection (see db.ts), under
 * a lock so concurrent server instances don't run them twice. Never edit a migration that has
 * shipped: add a new one.
 */
export interface Migration {
  readonly id: string;
  readonly description: string;
  up(db: Db): Promise<void>;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: '001-core-indexes',
    description: 'Indexes of users, OTP codes, sessions and chart records',
    async up(db) {
      await Promise.all([
        db.collection('users').createIndex({ phone: 1 }, { unique: true }),
        db
          .collection('otp_codes')
          .createIndex({ windowStart: 1 }, { expireAfterSeconds: 24 * 3600 }),
        db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('sessions').createIndex({ userId: 1 }),
        db.collection('chart_records').createIndex({ userId: 1, key: 1 }, { unique: true }),
      ]);
    },
  },
  {
    id: '002-user-display-names',
    description: 'Public display name for every user (Trader + last four digits)',
    async up(db) {
      const users = db.collection<{ phone: string; displayName?: string }>('users');
      const cursor = users.find({ displayName: { $exists: false } }, { projection: { phone: 1 } });
      for await (const u of cursor)
        await users.updateOne(
          { _id: u._id },
          { $set: { displayName: defaultDisplayName(u.phone) } },
        );
    },
  },
  {
    id: '003-battles',
    description: 'Battles, battle profiles (Elo) and the ranked matchmaking queue',
    async up(db) {
      await Promise.all([
        db.collection('battles').createIndex({ code: 1 }, { unique: true }),
        db
          .collection('battles')
          .createIndex({ status: 1, 'settings.visibility': 1, createdAt: -1 }),
        db.collection('battles').createIndex({ 'participants.userId': 1, createdAt: -1 }),
        db.collection('battle_profiles').createIndex({ elo: -1 }),
        db.collection('battle_profiles').createIndex({ xp: -1 }),
        db.collection('battle_queue').createIndex({ format: 1, status: 1, elo: 1 }),
        db.collection('battle_queue').createIndex({ lastSeen: 1 }, { expireAfterSeconds: 600 }),
      ]);
    },
  },
  {
    id: '004-practice-ledger',
    description: 'Backtest sessions, position opens and closes, screenshots; logins last 48 hours',
    async up(db) {
      const ttl = 48 * 60 * 60 * 1000;
      await Promise.all([
        db.collection('backtest_sessions').createIndex({ userId: 1, updatedAt: -1 }),
        db.collection('position_events').createIndex({ userId: 1, scope: 1, scopeId: 1 }),
        db.collection('backtest_shots').createIndex({ userId: 1, sessionId: 1 }),
      ]);
      const sessions = db.collection<{ _id: string; createdAt: Date; expiresAt: Date }>('sessions');
      const cursor = sessions.find({});
      for await (const s of cursor) {
        const cap = new Date(new Date(s.createdAt).getTime() + ttl);
        if (s.expiresAt > cap) await sessions.updateOne({ _id: s._id }, { $set: { expiresAt: cap } });
      }
    },
  },
];

export const defaultDisplayName = (phone: string) => `Trader ${phone.slice(-4)}`;

const LOCK_ID = 'lock';
const LOCK_STALE_MS = 60_000;

/** Applies every pending migration. Safe to call on every start. */
export async function migrate(db: Db): Promise<string[]> {
  const applied = db.collection<{ _id: string; appliedAt: Date; description: string }>(
    'migrations',
  );
  const done = new Set(
    (await applied.find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id),
  );
  const pending = MIGRATIONS.filter((m) => !done.has(m.id));
  if (pending.length === 0) return [];

  const locks = db.collection<{ _id: string; at: Date }>('migration_lock');
  for (let tries = 0; ; tries++) {
    try {
      await locks.insertOne({ _id: LOCK_ID, at: new Date() });
      break;
    } catch {
      // Held by another instance: wait for it, or take over a lock left by a crashed one.
      await locks.deleteOne({ _id: LOCK_ID, at: { $lt: new Date(Date.now() - LOCK_STALE_MS) } });
      if (tries > 120) throw new Error('Timed out waiting for the migration lock');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const ran: string[] = [];
  try {
    for (const m of MIGRATIONS) {
      if (await applied.findOne({ _id: m.id })) continue;
      await m.up(db);
      await applied.insertOne({ _id: m.id, appliedAt: new Date(), description: m.description });
      ran.push(m.id);
      console.warn(`[db] migration ${m.id} applied`);
    }
  } finally {
    await locks.deleteOne({ _id: LOCK_ID });
  }
  return ran;
}
