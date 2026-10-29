import 'server-only';
import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type { PlanId } from '@/lib/app/billing/entitlements';
import type {
  BattleMode,
  BattleSettings,
  BattleStatus,
  FinalResult,
  RankedFormat,
} from '@/lib/battles';
import type { BacktestSession, TradeAction } from '@/lib/backtest';
import type { AssetClass, HourPreset } from '@/lib/data';
import type { TimeframeId } from '@/lib/core';
import type { PaymentGatewayId, PaymentStatus } from '@/lib/app/billing/gateway';
import type {
  SupportAttachment,
  SupportRole,
  SupportStatus,
  SupportSubjectId,
} from '@/lib/support/catalog';
import { migrate } from './migrations';

export interface UserDoc {
  _id: ObjectId;
  phone: string;
  /** Public name on leaderboards and in battles (migration 002 backfills it). */
  displayName?: string;
  /** Missing means Beginner (migration 005 backfills it). */
  plan?: PlanId;
  /** Backtest sessions this account has created. Released when a session is deleted. */
  usageSessions?: number;
  /** Battles this account has joined. Released only when they leave before the start. */
  usageBattles?: number;
  /** Distinct non-empty strategy tags currently used by this account's sessions. */
  strategyTags?: string[];
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

/** A checkout discount. `_id` is the normalized code. */
export interface DiscountCodeDoc {
  _id: string;
  kind: 'percent' | 'fixed';
  /** Percent (1–100) or toman off. */
  value: number;
  /** Empty means every paid plan. */
  plans?: Array<'mid' | 'pro'>;
  /** Empty means every billing cycle. */
  cycles?: Array<'month' | 'year'>;
  active?: boolean;
  expiresAt?: Date | null;
  /** Null means unlimited. */
  maxUses?: number | null;
  used?: number;
  /** Null means a buyer can redeem it any number of times. */
  perUser?: number | null;
  label?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** One checkout sent to a bank, or a zero-total order that skipped the bank. */
export interface PaymentDoc {
  _id: ObjectId;
  userId: ObjectId;
  gateway: PaymentGatewayId;
  planId: 'mid' | 'pro';
  cycle: 'month' | 'year';
  /** Empty when the buyer did not use a code. */
  code: string;
  subtotal: number;
  discount: number;
  /** Toman charged. Zero means the bank was not called. */
  amount: number;
  currency: 'IRT';
  /** Zarinpal authority, or `free-…` when nothing was charged. */
  authority: string;
  status: PaymentStatus;
  refId: string | null;
  cardPan: string | null;
  fee: number | null;
  failureMessage: string | null;
  discountError: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

/** One successful payment that consumed a discount code. */
export interface DiscountRedemptionDoc {
  _id: string;
  code: string;
  userId: ObjectId;
  planId: 'mid' | 'pro';
  cycle: 'month' | 'year';
  subtotal: number;
  discount: number;
  total: number;
  createdAt: Date;
}

/** A support request owned by one user. Replies live in `support_messages`. */
export interface SupportTicketDoc {
  _id: ObjectId;
  /** Public ticket number, shown as #۱۲. */
  number: number;
  userId: ObjectId;
  userName: string;
  subject: SupportSubjectId;
  title: string;
  /** Set when the subject is a custom-symbol request. */
  symbol: string;
  status: SupportStatus;
  createdAt: Date;
  updatedAt: Date;
  preview: string;
  lastRole: SupportRole;
  /** Support replies the user has not opened yet. */
  unread: number;
}

/** One message in a support ticket, from the user or from Candelo support. */
export interface SupportMessageDoc {
  _id: ObjectId;
  ticketId: ObjectId;
  userId: ObjectId;
  role: SupportRole;
  name: string;
  body: string;
  createdAt: Date;
  /** Missing on messages written before attachments existed. */
  attachments?: SupportAttachment[];
}

/** Binary attached to one support message. The message itself only keeps the metadata. */
export interface SupportFileDoc {
  _id: ObjectId;
  ticketId: ObjectId;
  messageId: ObjectId;
  userId: ObjectId;
  name: string;
  type: string;
  size: number;
  image: boolean;
  data: Buffer;
  createdAt: Date;
}

/** A symbol added from the admin panel. Built-in symbols are not stored here. */
export interface InstrumentDoc {
  /** Uppercase symbol. */
  _id: string;
  description: string;
  baseCurrency: string;
  quoteCurrency: string;
  assetClass: AssetClass;
  hours: HourPreset;
  tickSize: number;
  pipSize: number;
  contractSize: number;
  lotMin: number;
  lotStep: number;
  lotMax: number;
  defaultSpread: number;
  defaultCommissionPerLot: number;
  active: boolean;
  /** Timeframe of the stored candles, or null when none have been imported. */
  timeframe: TimeframeId | null;
  barCount: number;
  /** First bar open time, or null. */
  dataStart: number | null;
  /** Exclusive end of the practice range (day after the last bar), or null. */
  dataEnd: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One UTC month of candles for an admin symbol. `bars` rows are time, open, high, low, close, volume. */
export interface MarketChunkDoc {
  _id: string;
  symbol: string;
  timeframe: TimeframeId;
  /** UTC month start, ms. */
  month: number;
  count: number;
  start: number;
  end: number;
  bars: number[][];
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
  discountCodes: Collection<DiscountCodeDoc>;
  discountRedemptions: Collection<DiscountRedemptionDoc>;
  payments: Collection<PaymentDoc>;
  supportTickets: Collection<SupportTicketDoc>;
  supportMessages: Collection<SupportMessageDoc>;
  supportFiles: Collection<SupportFileDoc>;
  instruments: Collection<InstrumentDoc>;
  marketChunks: Collection<MarketChunkDoc>;
}

/**
 * Bump when `Collections` gains a field. Dev hot reload keeps the previous promise on
 * globalThis, and that object would not have the new collections.
 */
const COLLECTIONS_VERSION = 3;

const globalForMongo = globalThis as unknown as {
  __mongo?: { version: number; client: Promise<MongoClient>; ready: Promise<Collections> };
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
    discountCodes: db.collection<DiscountCodeDoc>('discount_codes'),
    discountRedemptions: db.collection<DiscountRedemptionDoc>('discount_redemptions'),
    payments: db.collection<PaymentDoc>('payments'),
    supportTickets: db.collection<SupportTicketDoc>('support_tickets'),
    supportMessages: db.collection<SupportMessageDoc>('support_messages'),
    supportFiles: db.collection<SupportFileDoc>('support_files'),
    instruments: db.collection<InstrumentDoc>('instruments'),
    marketChunks: db.collection<MarketChunkDoc>('market_chunks'),
  };
}

/** Shared connection (cached on globalThis so dev hot reloads don't open new pools). */
export function collections(): Promise<Collections> {
  const cached = globalForMongo.__mongo;
  if (cached?.version === COLLECTIONS_VERSION) return cached.ready;
  const client =
    cached?.client ??
    new MongoClient(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017', {
      serverSelectionTimeoutMS: 5000,
    }).connect();
  const ready = init(client);
  const next = { version: COLLECTIONS_VERSION, client, ready };
  globalForMongo.__mongo = next;
  ready.catch(() => {
    if (globalForMongo.__mongo === next) delete globalForMongo.__mongo;
  });
  return ready;
}
