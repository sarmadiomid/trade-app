import 'server-only';
import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';

export interface UserDoc {
  _id: ObjectId;
  phone: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface OtpDoc {
  /** Normalised phone number. */
  _id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  sentAt: Date;
  /** Start of the current rate-limit window and the codes sent in it. */
  windowStart: Date;
  sendCount: number;
}

export interface SessionDoc {
  /** SHA-256 of the session token; the raw token only lives in the cookie. */
  _id: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

/** One persisted chart record (drawings of a symbol, themes, settings, templates, …). */
export interface ChartRecordDoc {
  userId: ObjectId;
  key: string;
  value: unknown;
  updatedAt: Date;
}

interface Collections {
  users: Collection<UserDoc>;
  otps: Collection<OtpDoc>;
  sessions: Collection<SessionDoc>;
  chartRecords: Collection<ChartRecordDoc>;
}

const globalForMongo = globalThis as unknown as {
  __mongo?: { client: Promise<MongoClient>; ready: Promise<Collections> };
};

async function init(clientPromise: Promise<MongoClient>): Promise<Collections> {
  const client = await clientPromise;
  const db: Db = client.db(process.env.MONGODB_DB ?? 'tradingchart');
  const c: Collections = {
    users: db.collection<UserDoc>('users'),
    otps: db.collection<OtpDoc>('otp_codes'),
    sessions: db.collection<SessionDoc>('sessions'),
    chartRecords: db.collection<ChartRecordDoc>('chart_records'),
  };
  await Promise.all([
    c.users.createIndex({ phone: 1 }, { unique: true }),
    c.otps.createIndex({ windowStart: 1 }, { expireAfterSeconds: 24 * 3600 }),
    c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.sessions.createIndex({ userId: 1 }),
    c.chartRecords.createIndex({ userId: 1, key: 1 }, { unique: true }),
  ]);
  return c;
}

/** Shared connection (cached on globalThis so dev hot reloads don't open new pools). */
export function collections(): Promise<Collections> {
  if (!globalForMongo.__mongo) {
    const client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017', {
      serverSelectionTimeoutMS: 5000,
    }).connect();
    const ready = init(client);
    globalForMongo.__mongo = { client, ready };
    ready.catch(() => {
      delete globalForMongo.__mongo;
    });
  }
  return globalForMongo.__mongo.ready;
}
