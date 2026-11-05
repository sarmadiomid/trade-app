import 'server-only';
import { ObjectId } from 'mongodb';
import { PLAN_LABEL } from '@/lib/app/billing/entitlements';
import {
  checkoutCharge,
  isSepRefNum,
  isSepResNum,
  isSepStateOk,
  isZarinpalAuthority,
  parseSepReturn,
  paymentDescription,
  sepStateMessage,
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
import { requestSepPayment, verifySepPayment } from './sep';
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

export type GatewayReturn =
  | { readonly paymentId: string; readonly outcome: 'paid' | 'canceled' | 'failed' | 'error' }
  | { readonly paymentId: null; readonly outcome: 'missing' };

/** @deprecated Prefer GatewayReturn; kept for existing callback imports. */
export type ZarinpalReturn = GatewayReturn;

/**
 * Prices the order on the server and sends the buyer to the selected bank gateway.
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
  const callbackUrl = `${input.origin}/api/billing/callback`;
  const mobile = normalizeIranianMobile(input.phone);

  if (charge.kind === 'sep') {
    const requested = await requestSepPayment({
      amount: charge.amount,
      resNum: id.toHexString(),
      callbackUrl,
      mobile,
    });
    if (!requested.ok) {
      if (reserved) await releaseDiscountReserve(code);
      return { ok: false, status: 502, error: requested.message };
    }
    const stored = await storePendingPayment({
      id,
      userId: input.userId,
      gateway: 'sep',
      planId: input.planId,
      cycle: input.cycle,
      code,
      subtotal,
      discount,
      amount: charge.amount,
      authority: requested.token,
      fee: null,
      reserved,
    });
    if (!stored.ok) return stored;
    return { ok: true, url: requested.url };
  }

  const requested = await requestZarinpalPayment({
    amount: charge.amount,
    description: paymentDescription(PLAN_LABEL[input.planId], input.cycle),
    callbackUrl,
    mobile,
    orderId: id.toHexString(),
  });
  if (!requested.ok) {
    if (reserved) await releaseDiscountReserve(code);
    return { ok: false, status: 502, error: requested.message };
  }
  const stored = await storePendingPayment({
    id,
    userId: input.userId,
    gateway: 'zarinpal',
    planId: input.planId,
    cycle: input.cycle,
    code,
    subtotal,
    discount,
    amount: charge.amount,
    authority: requested.authority,
    fee: requested.fee,
    reserved,
  });
  if (!stored.ok) return stored;
  return { ok: true, url: requested.url };
}

type StorePending =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly error: string };

/**
 * Zarinpal sends the browser back with Authority and Status. Status OK is verified
 * against the amount we stored. The plan is granted once.
 */
export async function settleZarinpalReturn(input: {
  readonly authority: string;
  readonly status: string;
}): Promise<GatewayReturn> {
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

  return finalizePaidPayment(payment, {
    refId: verified.refId,
    cardPan: verified.cardPan,
    fee: verified.fee,
  });
}

/**
 * SEP posts (or GETs) State / RefNum / ResNum after OnlinePG. State OK still requires
 * VerifyTransaction, amount match, and a RefNum that was never spent on another order.
 */
export async function settleSepReturn(
  fields: ReturnType<typeof parseSepReturn>,
): Promise<GatewayReturn> {
  if (!isSepResNum(fields.resNum)) return { paymentId: null, outcome: 'missing' };
  const { payments } = await collections();
  const payment = await payments.findOne({ _id: new ObjectId(fields.resNum) });
  if (!payment || payment.gateway !== 'sep') return { paymentId: null, outcome: 'missing' };
  const paymentId = payment._id.toHexString();
  if (payment.status === 'paid') return { paymentId, outcome: 'paid' };

  if (!isSepStateOk(fields.state)) {
    const canceled = fields.state.trim() === 'CanceledByUser';
    if (payment.status === 'pending') {
      await payments.updateOne(
        { _id: payment._id, status: 'pending' },
        {
          $set: {
            status: canceled ? 'canceled' : 'failed',
            failureMessage: sepStateMessage(fields.state),
          },
        },
      );
      if (payment.code) await releaseDiscountReserve(payment.code);
    }
    if (payment.status === 'failed') return { paymentId, outcome: 'failed' };
    return { paymentId, outcome: canceled || payment.status === 'canceled' ? 'canceled' : 'failed' };
  }

  if (!isSepRefNum(fields.refNum)) {
    if (payment.status === 'pending') {
      await payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'failed', failureMessage: 'رسید دیجیتالی سپ نامعتبر است' } },
      );
      if (payment.code) await releaseDiscountReserve(payment.code);
    }
    return { paymentId, outcome: 'failed' };
  }

  const spent = await payments.findOne({
    refId: fields.refNum,
    status: 'paid',
    _id: { $ne: payment._id },
  });
  if (spent) {
    if (payment.status === 'pending') {
      await payments.updateOne(
        { _id: payment._id, status: 'pending' },
        { $set: { status: 'failed', failureMessage: 'رسید دیجیتالی قبلاً مصرف شده است' } },
      );
      if (payment.code) await releaseDiscountReserve(payment.code);
    }
    return { paymentId, outcome: 'failed' };
  }

  const verified = await verifySepPayment({
    amount: payment.amount,
    refNum: fields.refNum,
  });
  if (!verified.ok) {
    if (!verified.retry && payment.status === 'pending') {
      await payments.updateOne(
        { _id: payment._id, status: 'pending' },
        {
          $set: {
            status: 'failed',
            failureMessage: verified.message,
            ...(verified.amountMismatch ? { refId: verified.refNum } : {}),
          },
        },
      );
      if (payment.code) await releaseDiscountReserve(payment.code);
    }
    return { paymentId, outcome: verified.retry ? 'error' : 'failed' };
  }

  return finalizePaidPayment(payment, {
    refId: verified.refNum,
    cardPan: verified.cardPan ?? (fields.securePan || null),
    fee: payment.fee,
  });
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

async function finalizePaidPayment(
  payment: PaymentDoc,
  verified: {
    readonly refId: string;
    readonly cardPan: string | null;
    readonly fee: number | null;
  },
): Promise<GatewayReturn> {
  const paymentId = payment._id.toHexString();
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
  const { payments } = await collections();
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

async function storePendingPayment(input: {
  readonly id: ObjectId;
  readonly userId: ObjectId;
  readonly gateway: 'zarinpal' | 'sep';
  readonly planId: PaidPlanId;
  readonly cycle: BillingCycle;
  readonly code: string;
  readonly subtotal: number;
  readonly discount: number;
  readonly amount: number;
  readonly authority: string;
  readonly fee: number | null;
  readonly reserved: boolean;
}): Promise<StorePending> {
  const doc: PaymentDoc = {
    _id: input.id,
    userId: input.userId,
    gateway: input.gateway,
    planId: input.planId,
    cycle: input.cycle,
    code: input.code,
    subtotal: input.subtotal,
    discount: input.discount,
    amount: input.amount,
    currency: 'IRT',
    authority: input.authority,
    status: 'pending',
    refId: null,
    cardPan: null,
    fee: input.fee,
    failureMessage: null,
    discountError: null,
    createdAt: new Date(),
    paidAt: null,
  };
  try {
    const { payments } = await collections();
    await payments.insertOne(doc);
  } catch (error) {
    if (input.reserved) await releaseDiscountReserve(input.code);
    console.error('[billing] could not store payment authority', input.id.toHexString(), error);
    return { ok: false, status: 500, error: 'ثبت پرداخت انجام نشد' };
  }
  return { ok: true };
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
