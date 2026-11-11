import 'server-only';
import { ObjectId, type Filter } from 'mongodb';
import { PLAN_IDS, normalizePlan, type PlanId } from '@/lib/app/billing/entitlements';
import { parseDiscountCatalog } from '@/lib/app/billing/discount';
import type { PaymentStatus } from '@/lib/app/billing/gateway';
import { setUserPlan } from './billing';
import { collections, type PaymentDoc } from './db';

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Collected toman from successful checkouts, split by the paid plan. */
function revenueFrom(rows: ReadonlyArray<{ _id: string; amount: number; orders: number }>) {
  const plans = {
    mid: { amount: 0, orders: 0 },
    pro: { amount: 0, orders: 0 },
  };
  for (const row of rows) {
    if (row._id !== 'mid' && row._id !== 'pro') continue;
    plans[row._id] = { amount: row.amount || 0, orders: row.orders || 0 };
  }
  return {
    total: plans.mid.amount + plans.pro.amount,
    orders: plans.mid.orders + plans.pro.orders,
    plans,
  };
}

export async function adminOverview() {
  const {
    users,
    supportTickets,
    battles,
    backtestSessions,
    instruments,
    discountCodes,
    discountRedemptions,
    payments,
  } = await collections();
  const [
    userCount,
    openTickets,
    battleCount,
    sessionCount,
    symbolCount,
    plans,
    recentUsers,
    waiting,
    revenueRows,
  ] = await Promise.all([
    users.countDocuments(),
    supportTickets.countDocuments({ status: 'open' }),
    // Only battles with a real user in them (bot-only battles are not activity).
    battles.countDocuments({
      status: { $in: ['standby', 'countdown', 'live', 'paused'] },
      participants: { $elemMatch: { isBot: { $ne: true } } },
    }),
    backtestSessions.countDocuments(),
    instruments.countDocuments(),
    users
      .aggregate<{ _id: string; n: number }>([{ $group: { _id: '$plan', n: { $sum: 1 } } }])
      .toArray(),
    users
      .find({}, { projection: { phone: 1, displayName: 1, plan: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray(),
    supportTickets
      .find(
        { status: 'open' },
        { projection: { number: 1, title: 1, subject: 1, updatedAt: 1, userName: 1 } },
      )
      .sort({ updatedAt: -1 })
      .limit(6)
      .toArray(),
    payments
      .aggregate<{ _id: string; amount: number; orders: number }>([
        { $match: { status: 'paid' } },
        { $group: { _id: '$planId', amount: { $sum: '$amount' }, orders: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const planCounts = { beginner: 0, mid: 0, pro: 0 };
  for (const row of plans) {
    const plan = normalizePlan(row._id);
    planCounts[plan] += row.n;
  }
  return {
    userCount,
    openTickets,
    liveBattles: battleCount,
    sessionCount,
    symbolCount,
    plans: planCounts,
    revenue: revenueFrom(revenueRows),
    discounts: await discountCodes.countDocuments({ active: { $ne: false } }),
    redemptions: await discountRedemptions.countDocuments(),
    recentUsers: recentUsers.map((user) => ({
      id: user._id.toHexString(),
      name: user.displayName ?? '',
      phone: user.phone,
      plan: normalizePlan(user.plan),
      createdAt: user.createdAt.getTime(),
    })),
    waiting: waiting.map((ticket) => ({
      id: ticket._id.toHexString(),
      number: ticket.number,
      title: ticket.title,
      subject: ticket.subject,
      userName: ticket.userName,
      updatedAt: ticket.updatedAt.getTime(),
    })),
  };
}

export async function searchUsers(query: string) {
  const { users } = await collections();
  const q = query.trim();
  const filter = q
    ? {
        $or: [
          { phone: { $regex: escapeRegex(q) } },
          { displayName: { $regex: escapeRegex(q), $options: 'i' } },
        ],
      }
    : {};
  const rows = await users
    .find(filter, {
      projection: {
        phone: 1,
        displayName: 1,
        plan: 1,
        createdAt: 1,
        lastLoginAt: 1,
        usageSessions: 1,
        usageBattles: 1,
      },
    })
    .sort({ lastLoginAt: -1 })
    .limit(60)
    .toArray();
  return rows.map((user) => ({
    id: user._id.toHexString(),
    name: user.displayName ?? '',
    phone: user.phone,
    plan: normalizePlan(user.plan),
    createdAt: user.createdAt.getTime(),
    lastLoginAt: user.lastLoginAt.getTime(),
    sessions: user.usageSessions ?? 0,
    battles: user.usageBattles ?? 0,
  }));
}

export async function changeUserPlan(id: string, plan: unknown): Promise<void> {
  if (!ObjectId.isValid(id)) throw new AdminError('کاربر پیدا نشد', 404);
  if (!isPlan(plan)) throw new AdminError('طرح نامعتبر است');
  const { users } = await collections();
  const found = await users.findOne({ _id: new ObjectId(id) }, { projection: { _id: 1 } });
  if (!found) throw new AdminError('کاربر پیدا نشد', 404);
  await setUserPlan(found._id, plan);
}

export async function listDiscounts() {
  const { discountCodes } = await collections();
  const rows = await discountCodes.find({}).sort({ createdAt: -1 }).limit(100).toArray();
  return rows.map((row) => ({
    code: row._id,
    kind: row.kind,
    value: row.value,
    plans: row.plans ?? [],
    cycles: row.cycles ?? [],
    active: row.active !== false,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
    maxUses: row.maxUses ?? null,
    perUser: row.perUser ?? null,
    used: row.used ?? 0,
    label: row.label ?? '',
  }));
}

export async function saveDiscount(input: unknown): Promise<void> {
  const parsed = parseDiscountCatalog([input]);
  const code = parsed.codes[0];
  if (!code) throw new AdminError('کد تخفیف نامعتبر است');
  const { discountCodes } = await collections();
  const now = new Date();
  await discountCodes.updateOne(
    { _id: code.code },
    {
      $set: {
        kind: code.kind,
        value: code.value,
        plans: [...code.plans],
        cycles: [...code.cycles],
        active: code.active,
        expiresAt: code.expiresAt === null ? null : new Date(code.expiresAt),
        maxUses: code.maxUses,
        perUser: code.perUser,
        label: code.label,
        updatedAt: now,
      },
      $setOnInsert: { used: 0, createdAt: now },
    },
    { upsert: true },
  );
}

export async function setDiscountActive(code: string, active: boolean): Promise<void> {
  const { discountCodes } = await collections();
  const updated = await discountCodes.updateOne(
    { _id: code },
    { $set: { active, updatedAt: new Date() } },
  );
  if (updated.matchedCount === 0) throw new AdminError('این کد پیدا نشد', 404);
}

export async function listBattles() {
  const { battles } = await collections();
  const rows = await battles
    .aggregate<{
      code: string;
      symbol: string;
      status: string;
      mode: string;
      createdAt: number;
      traders: number;
      bots: number;
      origin: string | null;
    }>([
      { $sort: { createdAt: -1 } },
      { $limit: 40 },
      {
        $project: {
          _id: 0,
          code: 1,
          symbol: 1,
          status: 1,
          mode: 1,
          createdAt: 1,
          traders: {
            $size: {
              $filter: { input: '$participants', cond: { $ne: ['$$this.isBot', true] } },
            },
          },
          bots: {
            $size: {
              $filter: { input: '$participants', cond: { $eq: ['$$this.isBot', true] } },
            },
          },
          origin: { $ifNull: ['$bots.origin', null] },
        },
      },
    ])
    .toArray();
  return rows;
}

export async function listPracticeSessions() {
  const { backtestSessions, users } = await collections();
  const rows = await backtestSessions
    .find(
      {},
      {
        projection: {
          userId: 1,
          updatedAt: 1,
          'session.settings.symbol': 1,
          'session.settings.name': 1,
        },
      },
    )
    .sort({ updatedAt: -1 })
    .limit(40)
    .toArray();
  const ids = [...new Map(rows.map((row) => [row.userId.toHexString(), row.userId])).values()];
  const owners = await users
    .find({ _id: { $in: ids } }, { projection: { phone: 1, displayName: 1 } })
    .toArray();
  const byId = new Map(owners.map((owner) => [owner._id.toHexString(), owner]));
  return rows.map((row) => {
    const owner = byId.get(row.userId.toHexString());
    return {
      id: row._id,
      symbol: row.session.settings.symbol,
      name: row.session.settings.name,
      updatedAt: row.updatedAt.getTime(),
      phone: owner?.phone ?? '',
      userName: owner?.displayName ?? '',
    };
  });
}

const PLAN_RANK: Readonly<Record<PlanId, number>> = {
  beginner: 0,
  mid: 1,
  pro: 2,
};

const PAYMENT_STATUSES: ReadonlySet<string> = new Set(['pending', 'paid', 'canceled', 'failed']);

/** Checkout rows for the admin desk, with the buyer's current plan for mismatch checks. */
export async function listTransactions(input: {
  readonly q?: string;
  readonly status?: string;
  readonly mismatch?: boolean;
}) {
  const { payments, users } = await collections();
  const q = (input.q ?? '').trim();
  const mismatchOnly = Boolean(input.mismatch);
  const status =
    typeof input.status === 'string' && PAYMENT_STATUSES.has(input.status)
      ? (input.status as PaymentStatus)
      : null;

  const filter: Filter<PaymentDoc> = {};
  if (mismatchOnly) filter.status = 'paid';
  else if (status) filter.status = status;

  if (q) {
    const userMatches = await users
      .find(
        {
          $or: [
            { phone: { $regex: escapeRegex(q) } },
            { displayName: { $regex: escapeRegex(q), $options: 'i' } },
          ],
        },
        { projection: { _id: 1 } },
      )
      .limit(60)
      .toArray();
    const userIds = userMatches.map((user) => user._id);
    const or: Filter<PaymentDoc>[] = [
      { authority: { $regex: escapeRegex(q), $options: 'i' } },
      { refId: { $regex: escapeRegex(q), $options: 'i' } },
    ];
    if (ObjectId.isValid(q)) or.push({ _id: new ObjectId(q) });
    if (userIds.length > 0) or.push({ userId: { $in: userIds } });
    filter.$or = or;
  }

  // Over-fetch when filtering mismatches in memory so recent paid gaps still surface.
  const fetchLimit = mismatchOnly ? 300 : 100;
  const rows = await payments.find(filter).sort({ createdAt: -1 }).limit(fetchLimit).toArray();
  const ownerIds = [...new Map(rows.map((row) => [row.userId.toHexString(), row.userId])).values()];
  const owners = await users
    .find(
      { _id: { $in: ownerIds } },
      { projection: { phone: 1, displayName: 1, plan: 1 } },
    )
    .toArray();
  const byId = new Map(owners.map((owner) => [owner._id.toHexString(), owner]));

  const mapped = rows.map((row) => {
    const owner = byId.get(row.userId.toHexString());
    const userPlan = normalizePlan(owner?.plan);
    const paidPlan = row.planId;
    const mismatch =
      row.status === 'paid' && PLAN_RANK[userPlan] < PLAN_RANK[paidPlan];
    return {
      id: row._id.toHexString(),
      userId: row.userId.toHexString(),
      userName: owner?.displayName ?? '',
      phone: owner?.phone ?? '',
      userPlan,
      planId: paidPlan,
      cycle: row.cycle,
      gateway: row.gateway,
      status: row.status,
      amount: row.amount,
      subtotal: row.subtotal,
      discount: row.discount,
      code: row.code,
      authority: row.authority,
      refId: row.refId,
      cardPan: row.cardPan,
      failureMessage: row.failureMessage,
      discountError: row.discountError,
      createdAt: row.createdAt.getTime(),
      paidAt: row.paidAt ? row.paidAt.getTime() : null,
      mismatch,
    };
  });

  const transactions = mismatchOnly
    ? mapped.filter((row) => row.mismatch).slice(0, 100)
    : mapped.slice(0, 100);

  return {
    transactions,
    mismatchCount: mapped.filter((row) => row.mismatch).length,
  };
}

function isPlan(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
