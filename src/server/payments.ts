import 'server-only';
import { ObjectId } from 'mongodb';
import { PLAN_LABEL } from '@/lib/app/billing/entitlements';
import {
  checkoutCharge,
  isZarinpalAuthority,
  paymentDescription,
  type PaymentGatewayId,
  type PaymentStatus,
} from '@/lib/app/billing/gateway';
import { normalizeIranianMobile } from '@/auth/phone';
import {
  checkoutResultPath,
  subscriptionAmount,
  type BillingCycle,
  type PaidPlanId,
} from '@/components/billing/plans';
import { setUserPlan, planOf } from './billing';
import { collections, type PaymentDoc } from './db';
import {
  commitDiscountRedemption,
  quoteDiscountCode,
  redeemDiscountCode,
  releaseDiscountReserve,
  reserveDiscountCode,
} from './discounts';
import { requestZarinpalPayment, verifyZarinpalPayment } from './zarinpal';

export type CheckoutStart =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly status: number; readonly error: string };

export interface PaymentReceipt {
  readonly id: string;
  readonly status: PaymentStatus;
  readonly gateway: PaymentGatewayId;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly amount: number;
  readonly refId: string | null;
  readonly cardPan: string | null;
  readonly failureMessage: string | null;
}

export type ZarinpalReturn =
  | { readonly paymentId: string; readonly outcome: 'paid' | 'canceled' | 'failed' | 'error' }
  | { readonly paymentId: null; readonly outcome: 'missing' };

/**
 * Prices the order on the server and sends the buyer to Zarinpal.
 * A zero total (a full discount) activates the plan without a bank call.
 */
export async function startCheckout(input: {
  readonly userId: ObjectId;
  readonly phone: string;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly code: string;
  readonly gateway: PaymentGatewayId;
  readonly origin: string;
}): Promise<CheckoutStart> {
  const current = await planOf(input.userId);
  if (current === input.planId) {
    return { ok: false, status: 400, error: 'این طرح همین حالا روی حساب شماست' };
  }

  let amount = subscriptionAmount(input.planId, input.cycle);
  let discount = 0;
  let code = '';
  let reserved = false;
  if (input.code) {
    const quoted = await quoteDiscountCode({
      userId: input.userId,
      code: input.code,
      planId: input.planId,
      cycle: input.cycle,
    });
    if (!quoted.ok) return { ok: false, status: 400, error: quoted.error };
    amount = quoted.quote.total;
    discount = quoted.quote.discount;
    code = quoted.quote.code;
  }

  const charge = checkoutCharge(input.gateway, amount);
  if (!charge.ok) return { ok: false, status: 400, error: charge.error };

  const subtotal = subscriptionAmount(input.planId, input.cycle);
  if (charge.kind === 'free') {
    try {
      const url = await fulfillFreeOrder({ ...input, code, subtotal, discount });
      return { ok: true, url };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ثبت سفارش انجام نشد';
      return { ok: false, status: 400, error: message };
    }
  }

  if (code) {
    const hold = await reserveDiscountCode({
      userId: input.userId,
      code,
      planId: input.planId,
      cycle: input.cycle,
    });
    if (!hold.ok) return { ok: false, status: 400, error: hold.error };
    reserved = true;
  }

  const id = new ObjectId();
  const requested = await requestZarinpalPayment({
    amount: charge.amount,
    description: paymentDescription(PLAN_LABEL[input.planId], input.cycle),
    callbackUrl: `${input.origin}/api/billing/callback`,
    mobile: normalizeIranianMobile(input.phone),
    orderId: id.toHexString(),
  });
  if (!requested.ok) {
    if (reserved) await releaseDiscountReserve(code);
    return { ok: false, status: 502, error: requested.message };
  }

  const now = new Date();
  const doc: PaymentDoc = {
    _id: id,
    userId: input.userId,
    gateway: 'zarinpal',
    planId: input.planId,
    cycle: input.cycle,
    code,
    subtotal,
    discount,
    amount: charge.amount,
    currency: 'IRT',
    authority: requested.authority,
    status: 'pending',
    refId: null,
    cardPan: null,
    fee: requested.fee,
    failureMessage: null,
    discountError: null,
    createdAt: now,
    paidAt: null,
  };
  try {
    const { payments } = await collections();
    await payments.insertOne(doc);
  } catch (error) {
    if (reserved) await releaseDiscountReserve(code);
    console.error('[billing] could not store Zarinpal authority', id.toHexString(), error);
    return { ok: false, status: 500, error: 'ثبت پرداخت انجام نشد' };
  }
  return { ok: true, url: requested.url };
}

/**
 * Zarinpal sends the browser back with Authority and Status. Status OK is verified
 * against the amount we stored. The plan is granted once.
 */
export async function settleZarinpalReturn(input: {
  readonly authority: string;
  readonly status: string;
}): Promise<ZarinpalReturn> {
  if (!isZarinpalAuthority(input.authority)) return { paymentId: null, outcome: 'missing' };
  const { payments } = await collections();
  const payment = await payments.findOne({ authority: input.authority });
  if (!payment || payment.gateway !== 'zarinpal') return { paymentId: null, outcome: 'missing' };
  const paymentId = payment._id.toHexString();
  if (payment.status === 'paid') return { paymentId, outcome: 'paid' };

  if (input.status.toUpperCase() !== 'OK') {
    if (payment.status === 'pending') {
      await payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'canceled', failureMessage: 'پرداخت لغو شد' } },
      );
      if (payment.code) await releaseDiscountReserve(payment.code);
    }
    return { paymentId, outcome: payment.status === 'failed' ? 'failed' : 'canceled' };
  }

  const verified = await verifyZarinpalPayment({
    amount: payment.amount,
    authority: payment.authority,
  });
  if (!verified.ok) {
    if (!verified.retry && payment.status === 'pending') {
      await payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'failed', failureMessage: verified.message } },
      );
      if (payment.code) await releaseDiscountReserve(payment.code);
    }
    return { paymentId, outcome: verified.retry ? 'error' : 'failed' };
  }

  let discountError: string | null = null;
  if (payment.code) {
    try {
      const committed = await commitDiscountRedemption({
        userId: payment.userId,
        code: payment.code,
        planId: payment.planId,
        cycle: payment.cycle,
      });
      if (!committed.ok) {
        console.error('[billing] discount after payment', committed.error);
        discountError = committed.error;
      }
    } catch (error) {
      console.error('[billing] discount after payment', error);
      discountError = 'ثبت کد تخفیف انجام نشد';
    }
  }

  await setUserPlan(payment.userId, payment.planId);
  await payments.updateOne(
    { _id: payment._id, status: { $in: ['pending', 'failed', 'canceled'] } },
    {
      $set: {
        status: 'paid',
        refId: verified.refId,
        cardPan: verified.cardPan,
        fee: verified.fee,
        paidAt: new Date(),
        failureMessage: null,
        ...(discountError ? { discountError } : {}),
      },
    },
  );
  return { paymentId, outcome: 'paid' };
}

/** The signed-in buyer's receipt. Another account's payment is hidden. */
export async function paymentReceipt(
  userId: ObjectId,
  paymentId: string,
): Promise<PaymentReceipt | null> {
  if (!/^[a-f0-9]{24}$/.test(paymentId)) return null;
  const { payments } = await collections();
  const doc = await payments.findOne({ _id: new ObjectId(paymentId), userId });
  if (!doc) return null;
  return {
    id: doc._id.toHexString(),
    status: doc.status,
    gateway: doc.gateway,
    planId: doc.planId,
    cycle: doc.cycle,
    amount: doc.amount,
    refId: doc.refId,
    cardPan: doc.cardPan,
    failureMessage: doc.failureMessage,
  };
}

async function fulfillFreeOrder(input: {
  readonly userId: ObjectId;
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly code: string;
  readonly subtotal: number;
  readonly discount: number;
  readonly gateway: PaymentGatewayId;
}): Promise<string> {
  const id = new ObjectId();
  const now = new Date();
  const doc: PaymentDoc = {
    _id: id,
    userId: input.userId,
    gateway: input.gateway,
    planId: input.planId,
    cycle: input.cycle,
    code: input.code,
    subtotal: input.subtotal,
    discount: input.discount,
    amount: 0,
    currency: 'IRT',
    authority: `free-${id.toHexString()}`,
    status: 'paid',
    refId: null,
    cardPan: null,
    fee: null,
    failureMessage: null,
    discountError: null,
    createdAt: now,
    paidAt: now,
  };
  if (input.code) {
    const redeemed = await redeemDiscountCode({
      userId: input.userId,
      code: input.code,
      planId: input.planId,
      cycle: input.cycle,
    });
    if (!redeemed.ok) {
      throw new Error(redeemed.error);
    }
  }
  await setUserPlan(input.userId, input.planId);
  const { payments } = await collections();
  await payments.insertOne(doc);
  return checkoutResultPath(id.toHexString());
}
