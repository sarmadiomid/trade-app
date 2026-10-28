import type { NextRequest } from 'next/server';
import { entitlements } from '@/lib/app';
import { usageOf } from '@/server/billing';
import { isAdminPhone } from '@/server/admin-http';
import { json, requestUser } from '@/server/http';

/** The signed-in user, their plan and the quotas that plan is counting. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const usage = await usageOf(user._id);
    const rules = entitlements(user.plan);
    return json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      plan: user.plan,
      admin: isAdminPhone(user.phone),
      usage: {
        sessions: usage.sessions,
        sessionLimit: rules.backtestSessions,
        battles: usage.battles,
        battleLimit: rules.battles,
        strategyTags: usage.strategyTags,
        strategyTagLimit: rules.strategyTags,
      },
    });
  } catch (e) {
    console.error('[me]', e);
    return json({ error: 'Server error' }, 500);
  }
}
