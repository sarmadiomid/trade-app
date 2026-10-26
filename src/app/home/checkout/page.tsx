import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckoutView } from '@/components/billing/CheckoutView';
import { billingCycleOf, checkoutPath, isPaidPlan } from '@/components/billing/plans';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'تسویه حساب | Candelo' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const query = await searchParams;
  const requested = query.plan ?? '';
  const planId = isPaidPlan(requested) ? requested : null;
  if (!planId) redirect('/home/settings?tab=subscription');
  const cycle = billingCycleOf(query.cycle);
  const user = await requireUser(checkoutPath(planId, cycle));
  return (
    <CheckoutView
      user={{ id: user.id, name: user.name, phone: user.phone }}
      planId={planId}
      cycle={cycle}
    />
  );
}
