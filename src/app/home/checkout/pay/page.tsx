import type { Metadata } from 'next';
import { PaymentGatewayPending } from '@/components/billing/CheckoutView';
import { billingCycleOf, isPaidPlan, paymentGatewayPath } from '@/components/billing/plans';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'درگاه پرداخت | Candelo' };

/** Placeholder only. The bank gateway is intentionally not implemented. */
export default async function PaymentGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const query = await searchParams;
  const requested = query.plan ?? '';
  const planId = isPaidPlan(requested) ? requested : null;
  const cycle = billingCycleOf(query.cycle);
  const next = planId ? paymentGatewayPath(planId, cycle) : '/home/checkout/pay';
  const user = await requireUser(next);
  return (
    <PaymentGatewayPending
      user={{ id: user.id, name: user.name, phone: user.phone }}
      planId={planId}
      cycle={cycle}
    />
  );
}
