import 'server-only';
import type { ObjectId } from 'mongodb';
import {
  battleDenial,
  entitlements,
  limitMessage,
  normalizePlan,
  requiresPlan,
  type PlanId,
} from '@/lib/app/billing/entitlements';
import { collections } from './db';

export class PlanDenied extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
  }
}

export async function planOf(userId: ObjectId): Promise<PlanId> {
  const { users } = await collections();
  const user = await users.findOne({ _id: userId }, { projection: { plan: 1 } });
  return normalizePlan(user?.plan);
}

export async function setUserPlan(userId: ObjectId, plan: PlanId): Promise<void> {
  const { users } = await collections();
  await users.updateOne({ _id: userId }, { $set: { plan } });
}

export async function usageOf(
  userId: ObjectId,
): Promise<{ sessions: number; battles: number; strategyTags: number }> {
  const { users } = await collections();
  const user = await users.findOne(
    { _id: userId },
    { projection: { usageSessions: 1, usageBattles: 1, strategyTags: 1 } },
  );
  return {
    sessions: user?.usageSessions ?? 0,
    battles: user?.usageBattles ?? 0,
    strategyTags: user?.strategyTags?.length ?? 0,
  };
}

async function takeQuota(
  userId: ObjectId,
  field: 'usageSessions' | 'usageBattles',
  limit: number | null,
  denial: string,
): Promise<void> {
  const { users } = await collections();
  if (limit === null) {
    await users.updateOne({ _id: userId }, { $inc: { [field]: 1 } });
    return;
  }
  const updated = await users.findOneAndUpdate(
    { _id: userId, $expr: { $lt: [{ $ifNull: [`$${field}`, 0] }, limit] } },
    { $inc: { [field]: 1 } },
  );
  if (!updated) throw new PlanDenied(denial);
}

async function releaseQuota(userId: ObjectId, field: 'usageSessions' | 'usageBattles'): Promise<void> {
  const { users } = await collections();
  await users.updateOne({ _id: userId, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
}

export async function takeSessionSlot(userId: ObjectId): Promise<void> {
  const plan = await planOf(userId);
  const limit = entitlements(plan).backtestSessions;
  await takeQuota(
    userId,
    'usageSessions',
    limit,
    limit === null ? '' : limitMessage('جلسات بک‌تست', plan, limit),
  );
}

export const releaseSessionSlot = (userId: ObjectId) => releaseQuota(userId, 'usageSessions');

export async function takeBattleSlot(userId: ObjectId, kind: 'join' | 'ranked'): Promise<void> {
  const plan = await planOf(userId);
  const rules = entitlements(plan);
  if (kind === 'ranked' && !rules.ranked) throw new PlanDenied(requiresPlan('نبرد رتبه‌ای', 'mid'));
  await takeQuota(
    userId,
    'usageBattles',
    rules.battles,
    rules.battles === null ? '' : limitMessage('شرکت در نبرد', plan, rules.battles),
  );
}

export const releaseBattleSlot = (userId: ObjectId) => releaseQuota(userId, 'usageBattles');

export async function assertBattleChat(userId: ObjectId): Promise<void> {
  const plan = await planOf(userId);
  const denial = battleDenial(plan, 'chat', 0);
  if (denial) throw new PlanDenied(denial);
}

/** Reserves a distinct strategy tag. Empty tags are always allowed. */
export async function claimStrategyTag(userId: ObjectId, tag: string): Promise<void> {
  const clean = tag.trim();
  if (!clean) return;
  const plan = await planOf(userId);
  const limit = entitlements(plan).strategyTags;
  if (limit === 0) throw new PlanDenied(requiresPlan('برچسب استراتژی', 'mid'));
  const { users } = await collections();
  if (limit === null) {
    await users.updateOne({ _id: userId }, { $addToSet: { strategyTags: clean } });
    return;
  }
  const updated = await users.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $or: [
          { $in: [clean, { $ifNull: ['$strategyTags', []] }] },
          { $lt: [{ $size: { $ifNull: ['$strategyTags', []] } }, limit] },
        ],
      },
    },
    { $addToSet: { strategyTags: clean } },
  );
  if (!updated) throw new PlanDenied(limitMessage('برچسب استراتژی', plan, limit));
}

export async function syncStrategyTags(userId: ObjectId): Promise<void> {
  const { users, backtestSessions } = await collections();
  const raw = await backtestSessions.distinct('session.settings.strategyTag', { userId });
  const strategyTags = [
    ...new Set(
      raw
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => tag.length > 0),
    ),
  ];
  await users.updateOne({ _id: userId }, { $set: { strategyTags } });
}

export async function resetPracticeUsage(userId: ObjectId): Promise<void> {
  const { users } = await collections();
  await users.updateOne({ _id: userId }, { $set: { usageSessions: 0, strategyTags: [] } });
}
