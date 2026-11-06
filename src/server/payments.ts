import 'server-only';
import { ObjectId } from 'mongodb';
import { PLAN_LABEL } from '@/lib/app/billing/entitlements';
import {
  checkoutCharge,
  isSepRefNum,
  isSepResNum,
  isSepStateOk,
  isZarinpalAuthority,
  paymentDescription,
  sepCallbackTokenMatches,
  sepStateMessage,
  type PaymentGatewayId,
  type PaymentStatus,
  type SepReturnFields,
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
  if (payment.status === 'paid') {
    await repairPaidEntitlement(payment);
    return { paymentId, outcome: 'paid' };
  }

  if (input.status.toUpperCase() !== 'OK') {
    if (payment.status === 'pending') {
      await markPaymentTerminal(payment, 'canceled', 'پرداخت لغو شد');
    }
    return { paymentId, outcome: payment.status === 'failed' ? 'failed' : 'canceled' };
  }

  const verified = await verifyZarinpalPayment({
    amount: payment.amount,
    authority: payment.authority,
  });
  if (!verified.ok) {
    if (!verified.retry && payment.status === 'pending') {
      await markPaymentTerminal(payment, 'failed', verified.message);
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
 * the payment token, an exclusive RefNum claim, VerifyTransaction, and amount match.
 */
export async function settleSepReturn(fields: SepReturnFields): Promise<GatewayReturn> {
  if (!isSepResNum(fields.resNum)) return { paymentId: null, outcome: 'missing' };
  const { payments } = await collections();
  const payment = await payments.findOne({ _id: new ObjectId(fields.resNum) });
  if (!payment || payment.gateway !== 'sep') return { paymentId: null, outcome: 'missing' };
  const paymentId = payment._id.toHexString();
  if (payment.status === 'paid') {
    await repairPaidEntitlement(payment);
    return { paymentId, outcome: 'paid' };
  }

  if (!isSepStateOk(fields.state)) {
    const canceled = fields.state.trim() === 'CanceledByUser';
    if (payment.status === 'pending') {
      await markPaymentTerminal(
        payment,
        canceled ? 'canceled' : 'failed',
        sepStateMessage(fields.state),
      );
    }
    if (payment.status === 'failed') return { paymentId, outcome: 'failed' };
    return { paymentId, outcome: canceled || payment.status === 'canceled' ? 'canceled' : 'failed' };
  }

  // Bind the return to the token we stored for this order so a RefNum cannot be
  // attached to a different pending ResNum of the same amount.
  if (!sepCallbackTokenMatches(payment.authority, fields.token)) {
    if (payment.status === 'pending') {
      await markPaymentTerminal(payment, 'failed', 'توکن بازگشت سپ با سفارش یکی نیست');
    }
    return { paymentId, outcome: 'failed' };
  }

  if (!isSepRefNum(fields.refNum)) {
    if (payment.status === 'pending') {
      await markPaymentTerminal(payment, 'failed', 'رسید دیجیتالی سپ نامعتبر است');
    }
    return { paymentId, outcome: 'failed' };
  }

  // Claim RefNum on this pending row before verify. The partial unique index on
  // refId makes cross-order reuse fail even when two callbacks race.
  const reserved = await claimSepRefNum(payment, fields.refNum);
  if (reserved.status === 'paid') {
    await repairPaidEntitlement(reserved.payment);
    return { paymentId, outcome: 'paid' };
  }
  if (reserved.status === 'rejected') return { paymentId, outcome: 'failed' };
  const reservedPayment = reserved.payment;

  const verified = await verifySepPayment({
    amount: reservedPayment.amount,
    refNum: fields.refNum,
  });
  if (!verified.ok) {
    if (!verified.retry) {
      await markPaymentTerminal(reservedPayment, 'failed', verified.message, {
        // Keep the RefNum on mismatch so another order cannot adopt it.
        keepRefId: true,
      });
    }
    return { paymentId, outcome: verified.retry ? 'error' : 'failed' };
  }

  // ResultCode 2: SEP already verified this RefNum. Only the order that claimed
  // it may proceed; a foreign pending row never receives this claim.
  if (verified.duplicate && reservedPayment.refId !== verified.refNum) {
    await markPaymentTerminal(reservedPayment, 'failed', 'رسید دیجیتالی قبلاً مصرف شده است', {
      keepRefId: true,
    });
    return { paymentId, outcome: 'failed' };
  }

  return finalizePaidPayment(reservedPayment, {
    refId: verified.refNum,
    cardPan: verified.cardPan ?? (fields.securePan || null),
    fee: reservedPayment.fee,
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

/**
 * Marks the payment paid and stores the gateway receipt first. Only the winner of
 * that claim grants the plan, so a concurrent callback cannot double-fulfill.
 */
async function finalizePaidPayment(
  payment: PaymentDoc,
  verified: {
    readonly refId: string;
    readonly cardPan: string | null;
    readonly fee: number | null;
  },
): Promise<GatewayReturn> {
  const paymentId = payment._id.toHexString();
  const { payments } = await collections();

  let claimed: PaymentDoc | null = null;
  try {
    claimed = await payments.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: ['pending', 'failed', 'canceled'] },
      },
      {
        $set: {
          status: 'paid',
          refId: verified.refId,
          cardPan: verified.cardPan,
          fee: verified.fee,
          paidAt: new Date(),
          failureMessage: null,
          discountError: null,
        },
      },
      { returnDocument: 'after' },
    );
  } catch (error) {
    if (isDuplicateKey(error)) {
      await markPaymentTerminal(payment, 'failed', 'رسید دیجیتالی قبلاً مصرف شده است', {
        keepRefId: payment.refId === verified.refId,
      });
      return { paymentId, outcome: 'failed' };
    }
    throw error;
  }

  if (!claimed) {
    const current = await payments.findOne({ _id: payment._id });
    if (current?.status === 'paid') {
      await repairPaidEntitlement(current);
      return { paymentId, outcome: 'paid' };
    }
    return { paymentId, outcome: 'error' };
  }

  let discountError: string | null = null;
  if (claimed.code) {
    try {
      const committed = await commitDiscountRedemption({
        userId: claimed.userId,
        code: claimed.code,
        planId: claimed.planId,
        cycle: claimed.cycle,
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

  await setUserPlan(claimed.userId, claimed.planId);
  if (discountError) {
    await payments.updateOne({ _id: claimed._id, status: 'paid' }, { $set: { discountError } });
  }
  return { paymentId, outcome: 'paid' };
}

type SepRefClaim =
  | { readonly status: 'reserved'; readonly payment: PaymentDoc }
  | { readonly status: 'paid'; readonly payment: PaymentDoc }
  | { readonly status: 'rejected' };

/**
 * Exclusive RefNum reservation on a pending SEP row. Fails when another payment
 * already holds the receipt (unique index) or this row is no longer pending.
 */
async function claimSepRefNum(payment: PaymentDoc, refNum: string): Promise<SepRefClaim> {
  const { payments } = await collections();
  if (payment.refId && payment.refId !== refNum) {
    await markPaymentTerminal(payment, 'failed', 'رسید دیجیتالی سپ با سفارش یکی نیست', {
      keepRefId: true,
    });
    return { status: 'rejected' };
  }

  try {
    const reserved = await payments.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'pending',
        $or: [{ refId: null }, { refId: refNum }],
      },
      { $set: { refId: refNum } },
      { returnDocument: 'after' },
    );
    if (reserved) return { status: 'reserved', payment: reserved };

    const current = await payments.findOne({ _id: payment._id });
    if (current?.status === 'paid') return { status: 'paid', payment: current };

    await markPaymentTerminal(payment, 'failed', 'رسید دیجیتالی قبلاً مصرف شده است');
    return { status: 'rejected' };
  } catch (error) {
    if (isDuplicateKey(error)) {
      await markPaymentTerminal(payment, 'failed', 'رسید دیجیتالی قبلاً مصرف شده است');
      return { status: 'rejected' };
    }
    throw error;
  }
}

async function markPaymentTerminal(
  payment: PaymentDoc,
  status: 'canceled' | 'failed',
  failureMessage: string,
  options: { readonly refId?: string; readonly keepRefId?: boolean } = {},
): Promise<void> {
  const { payments } = await collections();
  const $set: {
    status: 'canceled' | 'failed';
    failureMessage: string;
    refId?: string | null;
  } = { status, failureMessage };
  if (options.refId) $set.refId = options.refId;
  else if (!options.keepRefId && payment.status === 'pending' && payment.refId) {
    // Drop a reservation that did not finish so a later retry can reclaim, unless
    // the caller asked to keep it (amount mismatch / foreign duplicate).
    $set.refId = null;
  }
  const updated = await payments.updateOne(
    { _id: payment._id, status: { $in: ['pending', 'failed', 'canceled'] } },
    { $set },
  );
  if (updated.modifiedCount > 0 && payment.code && payment.status === 'pending') {
    await releaseDiscountReserve(payment.code);
  }
}

/** Idempotent repair when the paid row was claimed but plan grant crashed. */
async function repairPaidEntitlement(payment: PaymentDoc): Promise<void> {
  await setUserPlan(payment.userId, payment.planId);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
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
