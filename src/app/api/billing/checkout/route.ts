import type { NextRequest } from 'next/server';
import { isPaymentGateway, isPaymentRedirect } from '@/lib/app';
import { discountCodeQuery, isPaidPlan } from '@/components/billing/plans';
import { json, publicOrigin, readJson, requestUser, sameOrigin } from '@/server/http';
import { startCheckout } from '@/server/payments';

export const dynamic = 'force-dynamic';

/** Starts a Zarinpal payment for the signed-in buyer. The amount is priced here, not taken from the client. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await readJson(req, 2048)) as {
      plan?: unknown;
      cycle?: unknown;
      code?: unknown;
      gateway?: unknown;
    } | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'درخواست نامعتبر است' }, 400);
    }
    const plan = typeof body.plan === 'string' && isPaidPlan(body.plan) ? body.plan : null;
    if (!plan) return json({ error: 'طرح نامعتبر است' }, 400);
    if (body.cycle !== 'month' && body.cycle !== 'year') {
      return json({ error: 'دورهٔ پرداخت نامعتبر است' }, 400);
    }
    const gateway =
      typeof body.gateway === 'string' && isPaymentGateway(body.gateway) ? body.gateway : null;
    if (!gateway) return json({ error: 'روش پرداخت نامعتبر است' }, 400);
    const origin = publicOrigin(req);
    if (!origin) return json({ error: 'نشانی بازگشت پرداخت مشخص نیست' }, 500);

    const result = await startCheckout({
      userId: user._id,
      phone: user.phone,
      planId: plan,
      cycle: body.cycle,
      code: typeof body.code === 'string' ? discountCodeQuery(body.code) : '',
      gateway,
      origin,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    if (!isPaymentRedirect(result.url)) {
      console.error('[billing/checkout] refused redirect');
      return json({ error: 'اتصال به درگاه انجام نشد' }, 502);
    }
    return json({ url: result.url });
  } catch (e) {
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    if (e instanceof SyntaxError) return json({ error: 'درخواست نامعتبر است' }, 400);
    console.error('[billing/checkout]', e);
    return json({ error: 'اتصال به درگاه انجام نشد' }, 500);
  }
}
