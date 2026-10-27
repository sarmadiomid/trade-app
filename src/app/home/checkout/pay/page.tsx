import type { Metadata } from 'next';
import { ObjectId } from 'mongodb';
import type { DiscountQuote } from '@/lib/app';
import { PaymentGatewayPending } from '@/components/billing/CheckoutView';
import {
  billingCycleOf,
  discountCodeQuery,
  isPaidPlan,
  paymentGatewayPath,
} from '@/components/billing/plans';
import { requireUser } from '@/server/guard';
import { quoteDiscountCode } from '@/server/discounts';

export const metadata: Metadata = { title: 'درگاه پرداخت | Candelo' };

/** Placeholder only. The bank gateway is intentionally not implemented. */
export default async function PaymentGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; code?: string }>;
}) {
  const query = await searchParams;
  const requested = query.plan ?? '';
  const planId = isPaidPlan(requested) ? requested : null;
  const cycle = billingCycleOf(query.cycle);
  const code = discountCodeQuery(query.code);
  const next = planId ? paymentGatewayPath(planId, cycle, code) : '/home/checkout/pay';
  const user = await requireUser(next);
  let quote: DiscountQuote | null = null;
  if (planId && code) {
    try {
      const result = await quoteDiscountCode({
        userId: new ObjectId(user.id),
        code,
        planId,
        cycle,
      });
      if (result.ok) quote = result.quote;
    } catch (error) {
      console.error('[checkout/pay]', error);
    }
  }
  return (
    <PaymentGatewayPending
      user={{ id: user.id, name: user.name, phone: user.phone }}
      planId={planId}
      cycle={cycle}
      quote={quote}
    />
  );
}
