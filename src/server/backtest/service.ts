import 'server-only';
import type { ObjectId } from 'mongodb';
import {
  cursorDenial,
  entitlements,
  journalDenial,
  limitMessage,
  sessionSettingsDenial,
} from '@/lib/app/billing/entitlements';
import { DAY_MS, type Candle } from '@/lib/core';
import { instrumentSpec } from '@/lib/data';
import {
  ExecutionEngine,
  accountConfig,
  createSession,
  parseSession,
  sessionEnd,
  summarize,
  tradeActionSchema,
  validateSettings,
  type AccountConfig,
  type AccountState,
  type BacktestSession,
  type LoggedAction,
  type SessionSettings,
  type SessionSummary,
  type TradeAction,
} from '@/lib/backtest';
import {
  MAX_PRACTICE_TICK_MS,
  sanitizePracticeImport,
  type PracticeLog,
} from '@/lib/backtest/session/practice';
import { planReplay } from '@/lib/backtest/session/reconcile';
import {
  PlanDenied,
  claimStrategyTag,
  planOf,
  releaseSessionSlot,
  syncStrategyTags,
  takeSessionSlot,
} from '../billing';
import { collections } from '../db';
import { practiceMarket } from './market';
import { deletePositionEvents, replacePositionEvents } from './positions';

export class BacktestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const ID_RE = /^bt[a-z0-9]{4,40}$/;
const SHOT_RE = /^bt[a-z0-9]{4,40}-[\w.-]{1,80}$/;
const MAX_SHOT = 1_500_000;

const endOf = (s: SessionSettings) => sessionEnd(s);

function nextIdAfter(actions: readonly LoggedAction[]): number {
  let max = 0;
  for (const { a } of actions)
    if ((a.type === 'market' || a.type === 'pending') && Number(a.id) > max) max = Number(a.id);
  return max + 1;
}

function specOf(symbol: string) {
  const spec = instrumentSpec(symbol);
  if (!spec) throw new BacktestError('نماد نامعتبر است');
  return spec;
}

function initialBid(symbol: string, settings: SessionSettings): number {
  const market = practiceMarket();
  const before = market.generate({
    symbol,
    timeframe: '1m',
    endTime: settings.startDate - 1,
    limit: 1,
  });
  const first = market.generate({
    symbol,
    timeframe: '1m',
    startTime: settings.startDate,
    endTime: settings.endDate + DAY_MS - 1,
    limit: 1,
  });
  const bid = before.bars[0]?.close ?? first.bars[0]?.open;
  if (bid === undefined) throw new BacktestError('در این بازه داده‌ای وجود ندارد');
  return bid;
}

/** Replays actions on the server's bars. A rejected action aborts the whole write. */
function replay(
  cfg: AccountConfig,
  initial: AccountState,
  actions: readonly LoggedAction[],
  minutes: readonly Candle[],
  until: number,
  end: number,
): ExecutionEngine {
  const engine = new ExecutionEngine(cfg, structuredClone(initial));
  let i = 0;
  const applyUpTo = (t: number) => {
    while (i < actions.length && actions[i]!.t <= t) {
      engine.state.time = Math.max(engine.state.time, actions[i]!.t);
      const res = engine.apply(actions[i]!.a);
      if (!res.ok) throw new BacktestError(res.error, 422);
      i += 1;
    }
  };
  for (const bar of minutes) {
    if (bar.time >= until) break;
    applyUpTo(bar.time);
    engine.processBar(bar);
    if (engine.state.status !== 'active') break;
  }
  if (engine.state.status === 'active') {
    engine.state.time = Math.max(engine.state.time, until);
    applyUpTo(until);
    if (until >= end) engine.endSession();
  }
  return engine;
}

function advance(
  cfg: AccountConfig,
  account: AccountState,
  minutes: readonly Candle[],
  until: number,
  end: number,
): ExecutionEngine {
  const engine = new ExecutionEngine(cfg, structuredClone(account));
  for (const bar of minutes) {
    if (bar.time >= until || engine.state.status !== 'active') break;
    engine.processBar(bar);
  }
  if (engine.state.status === 'active') {
    engine.state.time = Math.max(engine.state.time, until);
    if (until >= end) engine.endSession();
  }
  return engine;
}

const economics = (s: SessionSettings) =>
  JSON.stringify({
    type: s.type,
    symbol: s.symbol,
    startingBalance: s.startingBalance,
    startDate: s.startDate,
    endDate: s.endDate,
    spreadEnabled: s.spreadEnabled,
    spread: s.spread,
    commissionEnabled: s.commissionEnabled,
    commissionPerLot: s.commissionPerLot,
    propRules: s.propRules,
  });

function meta(stored: BacktestSession, proposed: BacktestSession): BacktestSession {
  const name = proposed.settings.name.trim();
  return {
    ...stored,
    updatedAt: Date.now(),
    settings: {
      ...stored.settings,
      name: name && name.length <= 60 ? name : stored.settings.name,
      description: proposed.settings.description,
      strategyTag: proposed.settings.strategyTag,
    },
    prefs: proposed.prefs,
    scalper: proposed.scalper,
    quickVolume: proposed.quickVolume,
    journal: proposed.journal,
  };
}

async function write(
  userId: ObjectId,
  id: string,
  version: number,
  session: BacktestSession,
): Promise<void> {
  const { backtestSessions } = await collections();
  const updated = await backtestSessions.findOneAndUpdate(
    { _id: id, userId, version },
    { $set: { session, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new BacktestError('جلسه هم‌زمان از جای دیگری ذخیره شد', 409);
  await replacePositionEvents(userId, 'backtest', id, session.settings.symbol, session.account);
}

function simulateTo(
  session: BacktestSession,
  actions: readonly LoggedAction[],
  cursor: number,
  kind: 'advance' | 'replay',
): BacktestSession {
  const spec = specOf(session.settings.symbol);
  const cfg = accountConfig(session.settings, spec);
  const end = endOf(session.settings);
  const market = practiceMarket();
  const engine =
    kind === 'advance'
      ? advance(
          cfg,
          session.account,
          market.minuteBars(session.settings.symbol, session.cursor, cursor),
          cursor,
          end,
        )
      : replay(
          cfg,
          ExecutionEngine.initialState(cfg, session.settings.startDate, session.initialBid),
          actions,
          market.minuteBars(session.settings.symbol, session.settings.startDate, cursor),
          cursor,
          end,
        );
  return {
    ...session,
    actions: [...actions],
    account: engine.state,
    cursor,
    nextId: Math.max(session.nextId, nextIdAfter(actions)),
    updatedAt: Date.now(),
  };
}

export async function listSessions(userId: ObjectId): Promise<SessionSummary[]> {
  const { backtestSessions } = await collections();
  const docs = await backtestSessions.find({ userId }).sort({ updatedAt: -1 }).toArray();
  return docs.map((d) => summarize(d.session));
}

export async function loadSession(userId: ObjectId, id: string): Promise<BacktestSession | null> {
  if (!ID_RE.test(id)) return null;
  const { backtestSessions } = await collections();
  const doc = await backtestSessions.findOne({ _id: id, userId });
  return doc?.session ?? null;
}

/** Inserts a new session or reconciles a saved one. The client's balance is never trusted. */
export async function saveSession(userId: ObjectId, raw: unknown): Promise<void> {
  const proposed = parseSession(raw);
  if (!proposed || !ID_RE.test(proposed.id)) throw new BacktestError('جلسه نامعتبر است');
  const spec = specOf(proposed.settings.symbol);
  const range = practiceMarket().dataRange(proposed.settings.symbol);
  const invalid = validateSettings(proposed.settings, range);
  if (invalid) throw new BacktestError(invalid);
  const cursor = Math.min(
    endOf(proposed.settings),
    Math.max(proposed.settings.startDate, proposed.cursor),
  );
  const { backtestSessions } = await collections();
  const doc = await backtestSessions.findOne({ _id: proposed.id });
  if (doc && !doc.userId.equals(userId)) throw new BacktestError('این جلسه متعلق به شما نیست', 403);
  const access = await planOf(userId);
  if (!doc) {
    const denied = sessionSettingsDenial(access, proposed.settings, range);
    if (denied) throw new BacktestError(denied, 403);
    const jumped = cursorDenial(
      access,
      proposed.settings.startDate,
      cursor,
      proposed.prefs.tickerValue,
    );
    if (jumped) throw new BacktestError(jumped, 403);
    const notes = journalDenial(access, {}, proposed.journal);
    if (notes) throw new BacktestError(notes, 403);
    const tag = proposed.settings.strategyTag.trim();
    if (tag) await claimTag(userId, tag);
    await reserveSession(userId, tag);
    const settings = proposed.settings;
    const fresh = createSession({
      id: proposed.id,
      now: Date.now(),
      settings,
      initialBid: initialBid(settings.symbol, settings),
      spec,
    });
    const session =
      proposed.actions.length === 0 && cursor === fresh.cursor
        ? meta(fresh, proposed)
        : simulateTo(meta(fresh, proposed), proposed.actions, cursor, 'replay');
    try {
      await backtestSessions.insertOne({
        _id: proposed.id,
        userId,
        version: 0,
        session,
        updatedAt: new Date(),
      });
    } catch {
      await releaseSessionSlot(userId);
      if (tag) await syncStrategyTags(userId);
      throw new BacktestError('جلسه هم‌زمان از جای دیگری ذخیره شد', 409);
    }
    if (tag) await syncStrategyTags(userId);
    await replacePositionEvents(
      userId,
      'backtest',
      proposed.id,
      session.settings.symbol,
      session.account,
    );
    return;
  }
  const jumped = cursorDenial(access, doc.session.cursor, cursor, doc.session.prefs.tickerValue);
  if (jumped) throw new BacktestError(jumped, 403);
  const notes = journalDenial(access, doc.session.journal, proposed.journal);
  if (notes) throw new BacktestError(notes, 403);
  if (economics(doc.session.settings) !== economics(proposed.settings))
    throw new BacktestError('تنظیمات مالی جلسه بعد از ساخت تغییر نمی‌کند', 409);
  const nextTag = proposed.settings.strategyTag.trim();
  const prevTag = doc.session.settings.strategyTag.trim();
  const tagChanged = nextTag !== prevTag;
  if (nextTag && tagChanged) await claimTag(userId, nextTag);
  const plan = planReplay(doc.session, proposed.actions, cursor);
  if ('error' in plan) {
    if (tagChanged) await syncStrategyTags(userId);
    throw new BacktestError(plan.error, 409);
  }
  const base = meta(doc.session, proposed);
  const session =
    plan.kind === 'meta' ? base : simulateTo(base, proposed.actions, cursor, plan.kind);
  try {
    await write(userId, proposed.id, doc.version, session);
  } catch (e) {
    if (tagChanged) await syncStrategyTags(userId);
    throw e;
  }
  if (tagChanged) await syncStrategyTags(userId);
}

async function claimTag(userId: ObjectId, tag: string): Promise<void> {
  try {
    await claimStrategyTag(userId, tag);
  } catch (e) {
    if (e instanceof PlanDenied) throw new BacktestError(e.message, e.status);
    throw e;
  }
}

async function reserveSession(userId: ObjectId, tag: string): Promise<void> {
  try {
    await takeSessionSlot(userId);
  } catch (e) {
    if (tag) await syncStrategyTags(userId);
    if (e instanceof PlanDenied) throw new BacktestError(e.message, e.status);
    throw e;
  }
}

/**
 * Stores one trader action, then returns. The chart applies the trade only after this resolves,
 * so a position cannot be open or closed on screen before the database has it.
 */
export async function confirmAction(
  userId: ObjectId,
  id: string,
  t: unknown,
  raw: unknown,
): Promise<void> {
  if (!ID_RE.test(id)) throw new BacktestError('جلسه پیدا نشد', 404);
  const parsed = tradeActionSchema.safeParse(raw);
  if (!parsed.success || typeof t !== 'number' || !Number.isFinite(t))
    throw new BacktestError('معامله نامعتبر است');
  const action = parsed.data as TradeAction;
  const { backtestSessions } = await collections();
  const doc = await backtestSessions.findOne({ _id: id, userId });
  if (!doc) throw new BacktestError('جلسه پیدا نشد', 404);
  const session = doc.session;
  const jumped = cursorDenial(await planOf(userId), session.cursor, t, session.prefs.tickerValue);
  if (jumped) throw new BacktestError(jumped, 403);
  const end = endOf(session.settings);
  if (t < session.cursor || t > end) throw new BacktestError('زمان معامله با نمودار یکی نیست', 409);
  const spec = specOf(session.settings.symbol);
  const cfg = accountConfig(session.settings, spec);
  const market = practiceMarket();
  const engine =
    t > session.cursor
      ? advance(
          cfg,
          session.account,
          market.minuteBars(session.settings.symbol, session.cursor, t),
          t,
          end,
        )
      : new ExecutionEngine(cfg, structuredClone(session.account));
  if (engine.state.status !== 'active') throw new BacktestError('این جلسه تمام شده است', 409);
  engine.state.time = Math.max(engine.state.time, t);
  const res = engine.apply(action);
  if (!res.ok) throw new BacktestError(res.error, 422);
  const actions = [...session.actions, { t, a: action }];
  const next: BacktestSession = {
    ...session,
    actions,
    account: engine.state,
    cursor: t,
    nextId: Math.max(session.nextId, nextIdAfter(actions)),
    updatedAt: Date.now(),
  };
  await write(userId, id, doc.version, next);
}

const TEHRAN_MS = 3.5 * 60 * 60 * 1000;

function tehranDay(ts: number): string {
  const d = new Date(ts + TEHRAN_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** Visible replay time for every session of this account. */
export async function listPractice(userId: ObjectId): Promise<Record<string, PracticeLog>> {
  const { backtestSessions } = await collections();
  const docs = await backtestSessions.find({ userId }, { projection: { practice: 1 } }).toArray();
  const out: Record<string, PracticeLog> = {};
  for (const doc of docs) {
    const practice = doc.practice;
    if (!practice || !(practice.totalMs > 0)) continue;
    const days: Record<string, number> = {};
    for (const [day, ms] of Object.entries(practice.days ?? {})) {
      if (typeof ms === 'number' && ms > 0) days[day] = ms;
    }
    out[doc._id] = { totalMs: practice.totalMs, days };
  }
  return out;
}

/** Adds a few seconds of visible replay time onto the account's session. */
export async function addPracticeTime(userId: ObjectId, id: unknown, ms: unknown): Promise<void> {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new BacktestError('جلسه پیدا نشد', 404);
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0 || ms > MAX_PRACTICE_TICK_MS)
    throw new BacktestError('زمان نامعتبر است');
  const rounded = Math.round(ms);
  const day = tehranDay(Date.now());
  const { backtestSessions } = await collections();
  const updated = await backtestSessions.updateOne(
    { _id: id, userId },
    { $inc: { 'practice.totalMs': rounded, [`practice.days.${day}`]: rounded } },
  );
  if (updated.matchedCount === 0) throw new BacktestError('جلسه پیدا نشد', 404);
}

/**
 * Copies time a browser already counted, once per session, and only while the account
 * still has none. Later ticks go through `addPracticeTime`.
 */
export async function importPractice(userId: ObjectId, raw: unknown): Promise<void> {
  const store = sanitizePracticeImport(raw);
  const { backtestSessions } = await collections();
  await Promise.all(
    Object.entries(store).map(([id, practice]) =>
      backtestSessions.updateOne(
        {
          _id: id,
          userId,
          $or: [{ 'practice.totalMs': { $exists: false } }, { 'practice.totalMs': 0 }],
        },
        { $set: { practice: { totalMs: practice.totalMs, days: { ...practice.days } } } },
      ),
    ),
  );
}

export async function removeSession(userId: ObjectId, id: string): Promise<void> {
  if (!ID_RE.test(id)) throw new BacktestError('جلسه پیدا نشد', 404);
  const { backtestSessions, backtestShots } = await collections();
  const res = await backtestSessions.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw new BacktestError('جلسه پیدا نشد', 404);
  await Promise.all([releaseSessionSlot(userId), syncStrategyTags(userId)]);
  await Promise.all([
    deletePositionEvents(userId, 'backtest', id),
    backtestShots.deleteMany({ userId, sessionId: id }),
  ]);
}

export async function saveShot(userId: ObjectId, id: string, dataUrl: unknown): Promise<void> {
  if (!SHOT_RE.test(id)) throw new BacktestError('شناسهٔ تصویر نامعتبر است');
  if (
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image/') ||
    dataUrl.length > MAX_SHOT
  )
    throw new BacktestError('تصویر نامعتبر است');
  const sessionId = id.split('-')[0]!;
  const { backtestShots, backtestSessions } = await collections();
  const owns = await backtestSessions.findOne(
    { _id: sessionId, userId },
    { projection: { _id: 1 } },
  );
  if (!owns) throw new BacktestError('جلسه پیدا نشد', 404);
  const access = await planOf(userId);
  const shotLimit = entitlements(access).journalShots;
  if (shotLimit !== null) {
    const existing = await backtestShots.findOne({ _id: id, userId }, { projection: { _id: 1 } });
    if (!existing) {
      const position = id.split('-')[1] ?? '';
      const prefix = `${sessionId}-${position}-`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const n = await backtestShots.countDocuments({
        userId,
        sessionId,
        _id: { $regex: `^${prefix}` },
      });
      if (n >= shotLimit)
        throw new BacktestError(limitMessage('عکس تحلیل', access, shotLimit), 403);
    }
  }
  await backtestShots.updateOne(
    { _id: id, userId },
    { $set: { data: dataUrl, sessionId, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function loadShot(userId: ObjectId, id: string): Promise<string | null> {
  if (!SHOT_RE.test(id)) return null;
  const { backtestShots } = await collections();
  const doc = await backtestShots.findOne({ _id: id, userId }, { projection: { data: 1 } });
  return doc?.data ?? null;
}

export async function removeShot(userId: ObjectId, id: string): Promise<void> {
  if (!SHOT_RE.test(id)) return;
  const { backtestShots } = await collections();
  await backtestShots.deleteOne({ _id: id, userId });
}
