import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  billingCycleOf,
  checkoutPath,
  discountCodeQuery,
  isPaidPlan,
} from '@/components/billing/plans';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'درگاه پرداخت | Candelo' };

/** Old handoff address. Payment now starts from checkout, where the buyer picks a gateway. */
export default async function PaymentGatewayPage({
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
  const next = checkoutPath(planId, cycle, code);
  await requireUser(next);
  redirect(next);
}
