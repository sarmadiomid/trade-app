import type { Metadata } from 'next';
import { ObjectId } from 'mongodb';
import { PaymentResult } from '@/components/billing/PaymentResult';
import { requireUser } from '@/server/guard';
import { paymentReceipt } from '@/server/payments';

export const metadata: Metadata = { title: 'نتیجه پرداخت | Candelo' };

export default async function CheckoutResultPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; outcome?: string }>;
}) {
  const query = await searchParams;
  const paymentId = query.payment ?? '';
  const next = paymentId
    ? `/home/checkout/result?payment=${encodeURIComponent(paymentId)}`
    : '/home/checkout/result';
  const user = await requireUser(next);
  let receipt = null;
  try {
    receipt = paymentId ? await paymentReceipt(new ObjectId(user.id), paymentId) : null;
  } catch (error) {
    console.error('[checkout/result]', error);
    return (
      <PaymentResult
        user={{ id: user.id, name: user.name, phone: user.phone }}
        receipt={null}
        problem="error"
      />
    );
  }
  return (
    <PaymentResult
      user={{ id: user.id, name: user.name, phone: user.phone }}
      receipt={receipt}
      problem={receipt ? null : query.outcome === 'error' ? 'error' : 'missing'}
    />
  );
}
