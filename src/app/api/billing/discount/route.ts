import type { NextRequest } from 'next/server';
import { discountRejectionMessage } from '@/lib/app';
import { isPaidPlan } from '@/components/billing/plans';
import { quoteDiscountCode } from '@/server/discounts';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

/** Quotes a discount for the signed-in buyer. Does not consume the code. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await readJson(req, 1024)) as {
      code?: unknown;
      plan?: unknown;
      cycle?: unknown;
    } | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'درخواست نامعتبر است' }, 400);
    }
    if (typeof body.code !== 'string' || !body.code.trim()) {
      return json({ error: discountRejectionMessage('empty') }, 400);
    }
    const plan = typeof body.plan === 'string' && isPaidPlan(body.plan) ? body.plan : null;
    if (!plan) return json({ error: 'طرح نامعتبر است' }, 400);
    if (body.cycle !== 'month' && body.cycle !== 'year') {
      return json({ error: 'دورهٔ پرداخت نامعتبر است' }, 400);
    }
    const result = await quoteDiscountCode({
      userId: user._id,
      code: body.code,
      planId: plan,
      cycle: body.cycle,
    });
    if (!result.ok) return json({ error: result.error }, 400);
    return json(result.quote);
  } catch (e) {
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    if (e instanceof SyntaxError) return json({ error: 'درخواست نامعتبر است' }, 400);
    console.error('[billing/discount]', e);
    return json({ error: 'اعمال کد تخفیف انجام نشد' }, 500);
  }
}
