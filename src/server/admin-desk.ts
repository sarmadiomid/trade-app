import 'server-only';
import { ObjectId } from 'mongodb';
import { PLAN_IDS, normalizePlan, type PlanId } from '@/lib/app/billing/entitlements';
import { parseDiscountCatalog } from '@/lib/app/billing/discount';
import { setUserPlan } from './billing';
import { collections } from './db';

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
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
  ] = await Promise.all([
    users.countDocuments(),
    supportTickets.countDocuments({ status: 'open' }),
    battles.countDocuments({ status: { $in: ['standby', 'countdown', 'live', 'paused'] } }),
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
          traders: { $size: '$participants' },
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

function isPlan(value: unknown): value is PlanId {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
