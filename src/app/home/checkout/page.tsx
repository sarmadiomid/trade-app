import type { Metadata } from 'next';
import { ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';
import type { DiscountQuote } from '@/lib/app';
import { CheckoutView } from '@/components/billing/CheckoutView';
import {
  billingCycleOf,
  checkoutPath,
  discountCodeQuery,
  isPaidPlan,
} from '@/components/billing/plans';
import { quoteDiscountCode } from '@/server/discounts';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'تسویه حساب | Candelo' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string; code?: string }>;
}) {
  const query = await searchParams;
  const requested = query.plan ?? '';
  const planId = isPaidPlan(requested) ? requested : null;
  if (!planId) redirect('/home/settings?tab=subscription');
  const cycle = billingCycleOf(query.cycle);
  const code = discountCodeQuery(query.code);
  const user = await requireUser(checkoutPath(planId, cycle, code));
  let initialQuote: DiscountQuote | null = null;
  let initialError: string | null = null;
  if (code) {
    try {
      const result = await quoteDiscountCode({
        userId: new ObjectId(user.id),
        code,
        planId,
        cycle,
      });
      if (result.ok) initialQuote = result.quote;
      else initialError = result.error;
    } catch (error) {
      console.error('[checkout]', error);
      initialError = 'اعمال کد تخفیف انجام نشد';
    }
  }
  return (
    <CheckoutView
      user={{ id: user.id, name: user.name, phone: user.phone }}
      planId={planId}
      cycle={cycle}
      initialCode={code}
      initialQuote={initialQuote}
      initialError={initialError}
    />
  );
}
