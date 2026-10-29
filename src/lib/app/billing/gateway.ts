/** Payment gateways at checkout. Pure: no network and no database. */

export const PAYMENT_GATEWAYS = ['zarinpal', 'sep'] as const;

export type PaymentGatewayId = (typeof PAYMENT_GATEWAYS)[number];

export type PaymentStatus = 'pending' | 'paid' | 'canceled' | 'failed';

/** Zarinpal rejects anything below this when the currency is toman (IRT). */
export const ZARINPAL_MIN_TOMAN = 1_000;

export type ZarinpalMode = 'sandbox' | 'live';

export function isPaymentGateway(value: string): value is PaymentGatewayId {
  return (PAYMENT_GATEWAYS as readonly string[]).includes(value);
}

/** 36-character terminal id from the Zarinpal panel. */
export function isZarinpalMerchantId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

/** Authority Zarinpal returns. Sandbox values start with S. */
export function isZarinpalAuthority(value: string): boolean {
  return /^[A-Za-z0-9]{10,64}$/.test(value);
}

export function zarinpalHost(mode: ZarinpalMode): string {
  return mode === 'sandbox' ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
}

export function zarinpalRequestUrl(mode: ZarinpalMode): string {
  return `${zarinpalHost(mode)}/pg/v4/payment/request.json`;
}

export function zarinpalVerifyUrl(mode: ZarinpalMode): string {
  return `${zarinpalHost(mode)}/pg/v4/payment/verify.json`;
}

/** Browser location after a successful payment request. Null when the authority is not safe to put in a path. */
export function zarinpalStartPayUrl(mode: ZarinpalMode, authority: string): string | null {
  if (!isZarinpalAuthority(authority)) return null;
  return `${zarinpalHost(mode)}/pg/StartPay/${authority}`;
}

/**
 * Where the browser may be sent. A free order stays on this site. A bank order
 * only leaves for the Zarinpal host that matches the request we just made.
 */
export function isPaymentRedirect(url: string): boolean {
  if (url.startsWith('/home/checkout/result?') && url.includes('payment=') && !url.includes('\\')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const hostOk = parsed.host === 'sandbox.zarinpal.com' || parsed.host === 'payment.zarinpal.com';
    return (
      parsed.protocol === 'https:' &&
      hostOk &&
      /^\/pg\/StartPay\/[A-Za-z0-9]{10,64}$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export type CheckoutCharge =
  | { readonly ok: true; readonly kind: 'free' }
  | { readonly ok: true; readonly kind: 'zarinpal'; readonly amount: number }
  | { readonly ok: false; readonly error: string };

/** How `amount` toman is collected. SEP is selected in the UI and rejected until that gateway exists. */
export function checkoutCharge(gateway: PaymentGatewayId, amount: number): CheckoutCharge {
  if (!Number.isInteger(amount) || amount < 0)
    return { ok: false, error: 'مبلغ پرداخت نامعتبر است' };
  if (gateway === 'sep') return { ok: false, error: 'درگاه سپ هنوز فعال نشده است' };
  if (amount === 0) return { ok: true, kind: 'free' };
  if (amount < ZARINPAL_MIN_TOMAN)
    return { ok: false, error: 'حداقل مبلغ زرین‌پال ۱۰۰۰ تومان است' };
  return { ok: true, kind: 'zarinpal', amount };
}

export function paymentDescription(planName: string, cycle: 'month' | 'year'): string {
  const period = cycle === 'year' ? 'سالانه' : 'ماهانه';
  return `خرید طرح ${planName} ${period}`.slice(0, 255);
}

const ZARINPAL_ERRORS: Readonly<Record<number, string>> = {
  [-9]: 'اطلاعات پرداخت ناقص است',
  [-10]: 'شناسه پذیرنده زرین‌پال معتبر نیست',
  [-11]: 'درگاه زرین‌پال فعال نیست',
  [-12]: 'تلاش بیش از حد. کمی بعد دوباره پرداخت کنید',
  [-15]: 'درگاه زرین‌پال تعلیق شده است',
  [-16]: 'سطح تأیید درگاه برای این پرداخت کافی نیست',
  [-30]: 'تسویه این درگاه هنوز فعال نشده است',
  [-50]: 'مبلغ تأیید پرداخت با مبلغ سفارش یکی نیست',
  [-51]: 'پرداخت ناموفق بود',
  [-54]: 'شناسه پرداخت نامعتبر است',
};

export function zarinpalErrorMessage(code: number | null, fallback: string): string {
  if (code === null) return fallback;
  return ZARINPAL_ERRORS[code] ?? fallback;
}

export interface ZarinpalRequestOk {
  readonly ok: true;
  readonly authority: string;
  readonly fee: number | null;
}

export interface ZarinpalFail {
  readonly ok: false;
  readonly code: number | null;
  readonly message: string;
}

export interface ZarinpalVerifyOk {
  readonly ok: true;
  readonly code: 100 | 101;
  readonly refId: string;
  readonly cardPan: string | null;
  readonly fee: number | null;
}

/** Reads a payment-request body. Code 100 with an authority is the only success. */
export function parseZarinpalRequest(body: unknown): ZarinpalRequestOk | ZarinpalFail {
  const data = dataRecord(body);
  const authority = typeof data?.authority === 'string' ? data.authority : '';
  const code = numberOrNull(data?.code);
  if (code === 100 && isZarinpalAuthority(authority)) {
    return { ok: true, authority, fee: feeOrNull(data?.fee) };
  }
  const error = errorOf(body);
  return {
    ok: false,
    code: error.code ?? code,
    message: zarinpalErrorMessage(error.code ?? code, 'اتصال به زرین‌پال انجام نشد'),
  };
}

/**
 * Reads a verify body. Code 100 is the first successful verify. Code 101 means
 * that same payment was already verified, so it is still a success.
 */
export function parseZarinpalVerify(body: unknown): ZarinpalVerifyOk | ZarinpalFail {
  const data = dataRecord(body);
  const code = numberOrNull(data?.code);
  const refId = refIdOf(data?.ref_id);
  if ((code === 100 || code === 101) && refId) {
    return {
      ok: true,
      code,
      refId,
      cardPan: cardPanOf(data?.card_pan),
      fee: feeOrNull(data?.fee),
    };
  }
  const error = errorOf(body);
  const resolved = error.code ?? code;
  return {
    ok: false,
    code: resolved,
    message: zarinpalErrorMessage(resolved, 'تأیید پرداخت انجام نشد'),
  };
}

function dataRecord(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  return isRecord(body.data) ? body.data : null;
}

function errorOf(body: unknown): { code: number | null } {
  if (!isRecord(body)) return { code: null };
  const errors = body.errors;
  if (Array.isArray(errors)) {
    const first = errors.find(isRecord);
    return { code: first ? numberOrNull(first.code) : null };
  }
  if (isRecord(errors)) return { code: numberOrNull(errors.code) };
  return { code: null };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function feeOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function refIdOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[0-9]{1,20}$/.test(value)) return value;
  return null;
}

function cardPanOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const pan = value.trim();
  if (!pan || pan.length > 32) return null;
  return pan;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
