import type { NextRequest } from 'next/server';
import { normalizePlan, PLAN_IDS, type PlanId } from '@/lib/app';
import { setUserPlan } from '@/server/billing';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

/** Switches the signed-in user to the free plan. Paid plans start only after a verified payment. */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await readJson(req, 1024)) as { plan?: unknown };
    if (!PLAN_IDS.includes(body?.plan as PlanId)) return json({ error: 'طرح نامعتبر است' }, 400);
    const plan = normalizePlan(body.plan);
    if (plan !== 'beginner') {
      return json({ error: 'طرح پولی از صفحه تسویه حساب فعال می‌شود' }, 400);
    }
    await setUserPlan(user._id, plan);
    return json({ plan });
  } catch (e) {
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    console.error('[account/plan]', e);
    return json({ error: 'تغییر طرح انجام نشد' }, 500);
  }
}
