import 'server-only';
import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type {
  BattleMode,
  BattleSettings,
  BattleStatus,
  FinalResult,
  RankedFormat,
} from '@/lib/battles';
import type { BacktestSession, TradeAction } from '@/lib/backtest';
import { migrate } from './migrations';

export interface UserDoc {
  _id: ObjectId;
  phone: string;
  /** Public name on leaderboards and in battles (migration 002 backfills it). */
  displayName?: string;
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

export interface BattleActionDoc {
  /** Market time the action was taken at. */
  t: number;
  a: TradeAction;
  /** Wall-clock time it was received. */
  at: number;
}

export interface BattleParticipantDoc {
  userId: ObjectId;
  name: string;
  joinedAt: number;
  /** Market time the trader's account starts at (late joiners start mid-battle). */
  startT: number;
  /** Bid before `startT` (the account's starting point). */
  startBid: number;
  /** Ranked rating and games when the trader joined. */
  elo: number;
  games: number;
  actions: BattleActionDoc[];
  /** Market time the trader has replayed up to (each trader steps their own candles). */
  cursor?: number;
  /** Market time the trader left at (forfeit), or null. */
  leftT: number | null;
}

export interface BattleChatDoc {
  id: string;
  userId: ObjectId | null;
  name: string;
  text: string;
  at: number;
  system: boolean;
}

export interface BattleDoc {
  _id: ObjectId;
  /** Battle ID players type to join (unique). */
  code: string;
  mode: BattleMode;
  format: RankedFormat['id'] | null;
  /** Null for matchmade ranked battles (nobody hosts them). */
  hostId: ObjectId | null;
  settings: BattleSettings;
  /** The market drawn from the asset pool, and where in its history the battle starts. */
  symbol: string;
  marketStart: number;
  status: BattleStatus;
  createdAt: number;
  updatedAt: number;
  countdownEndsAt: number | null;
  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  endedAt: number | null;
  endReason: string | null;
  participants: BattleParticipantDoc[];
  chat: BattleChatDoc[];
  results: FinalResult[] | null;
  /** Optimistic-concurrency counter: every write checks and bumps it. */
  version: number;
}

/** Ranked rating and lifetime battle stats of a user. */
export interface BattleProfileDoc {
  /** The user's id. */
  _id: ObjectId;
  elo: number;
  peakElo: number;
  rankedGames: number;
  rankedWins: number;
  rankedLosses: number;
  battles: number;
  wins: number;
  podiums: number;
  /** Composite Score. */
  xp: number;
  winStreak: number;
  bestStreak: number;
  trades: number;
  winningTrades: number;
  /** Sum of every finished battle's return, percent (average = / battles). */
  returnSum: number;
  bestReturn: number | null;
  updatedAt: number;
}

/** One backtest session owned by a user. The account inside is the server's simulation. */
export interface BacktestSessionDoc {
  /** Client session id (`bt…`). */
  _id: string;
  userId: ObjectId;
  version: number;
  session: BacktestSession;
  /** Wall-clock time the replay page was visible. Kept beside `session` so a cursor save cannot wipe it. */
  practice?: { totalMs: number; days: Record<string, number> };
  updatedAt: Date;
}

/** A position open or close the server recorded. The chart shows the trade only after this exists. */
export interface PositionEventDoc {
  _id: string;
  userId: ObjectId;
  scope: 'backtest' | 'battle';
  scopeId: string;
  kind: 'open' | 'close';
  positionId: string;
  marketTime: number;
  price: number;
  volume: number;
  side: 'buy' | 'sell';
  reason: string | null;
  pnl: number | null;
  symbol: string;
  createdAt: Date;
}

/** Screenshot attached to a journal entry. */
export interface BacktestShotDoc {
  _id: string;
  userId: ObjectId;
  sessionId: string;
  data: string;
  updatedAt: Date;
}

/** A trader searching for a ranked match. */
export interface BattleQueueDoc {
  /** The user's id. */
  _id: ObjectId;
  format: RankedFormat['id'];
  elo: number;
  games: number;
  name: string;
  joinedAt: number;
  lastSeen: number;
  status: 'searching' | 'matching' | 'matched';
  battleId: ObjectId | null;
}

export interface Collections {
  db: Db;
  users: Collection<UserDoc>;
  otps: Collection<OtpDoc>;
  sessions: Collection<SessionDoc>;
  chartRecords: Collection<ChartRecordDoc>;
  battles: Collection<BattleDoc>;
  battleProfiles: Collection<BattleProfileDoc>;
  battleQueue: Collection<BattleQueueDoc>;
  backtestSessions: Collection<BacktestSessionDoc>;
  positionEvents: Collection<PositionEventDoc>;
  backtestShots: Collection<BacktestShotDoc>;
}

const globalForMongo = globalThis as unknown as {
  __mongo?: { client: Promise<MongoClient>; ready: Promise<Collections> };
};

async function init(clientPromise: Promise<MongoClient>): Promise<Collections> {
  const client = await clientPromise;
  const db: Db = client.db(process.env.MONGODB_DB ?? 'candelo');
  await migrate(db);
  return {
    db,
    users: db.collection<UserDoc>('users'),
    otps: db.collection<OtpDoc>('otp_codes'),
    sessions: db.collection<SessionDoc>('sessions'),
    chartRecords: db.collection<ChartRecordDoc>('chart_records'),
    battles: db.collection<BattleDoc>('battles'),
    battleProfiles: db.collection<BattleProfileDoc>('battle_profiles'),
    battleQueue: db.collection<BattleQueueDoc>('battle_queue'),
    backtestSessions: db.collection<BacktestSessionDoc>('backtest_sessions'),
    positionEvents: db.collection<PositionEventDoc>('position_events'),
    backtestShots: db.collection<BacktestShotDoc>('backtest_shots'),
  };
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
