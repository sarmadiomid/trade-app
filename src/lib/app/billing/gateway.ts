/** Payment gateways at checkout. Pure: no network and no database. */

export const PAYMENT_GATEWAYS = ['zarinpal', 'sep'] as const;

export type PaymentGatewayId = (typeof PAYMENT_GATEWAYS)[number];

export type PaymentStatus = 'pending' | 'paid' | 'canceled' | 'failed';

/** Zarinpal rejects anything below this when the currency is toman (IRT). */
export const ZARINPAL_MIN_TOMAN = 1_000;

/** Same floor as Zarinpal; SEP is charged in rials (`amount * 10`). */
export const SEP_MIN_TOMAN = 1_000;

export const SEP_HOST = 'https://sep.shaparak.ir';
export const SEP_TOKEN_URL = `${SEP_HOST}/onlinepg/onlinepg`;
export const SEP_VERIFY_URL = `${SEP_HOST}/verifyTxnRandomSessionkey/ipg/VerifyTransaction`;
export const SEP_REVERSE_URL = `${SEP_HOST}/verifyTxnRandomSessionkey/ipg/ReverseTransaction`;

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

/** SEP terminal id from the Saman panel (digits only). */
export function isSepTerminalId(value: string): boolean {
  return /^\d{3,16}$/.test(value.trim());
}

/** Token SEP returns for OnlinePG redirect. */
export function isSepToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

/**
 * True when the callback Token is the same token we stored as `authority`.
 * An empty or foreign token must not settle a different ResNum with a reused RefNum.
 */
export function sepCallbackTokenMatches(authority: string, token: string): boolean {
  const expected = authority.trim();
  const got = token.trim();
  return isSepToken(expected) && isSepToken(got) && expected === got;
}

/** Digital receipt (RefNum) returned after a card charge. */
export function isSepRefNum(value: string): boolean {
  return value.length >= 1 && value.length <= 100 && !/[\s<>]/.test(value);
}

/** Merchant ResNum we send; we use the payment ObjectId hex. */
export function isSepResNum(value: string): boolean {
  return /^[a-f0-9]{24}$/.test(value);
}

/** Plans store toman; SEP Amount / verify amounts are rials. */
export function tomanToRial(toman: number): number {
  return toman * 10;
}

/** `0912…` → `912…` as in the SEP token sample. */
export function sepCellNumber(mobile: string | null): string | null {
  if (!mobile) return null;
  if (/^09\d{9}$/.test(mobile)) return mobile.slice(1);
  if (/^9\d{9}$/.test(mobile)) return mobile;
  return null;
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

/** GET redirect into SEP OnlinePG (doc §2.2). Null when the token is not safe in a query. */
export function sepSendTokenUrl(token: string): string | null {
  if (!isSepToken(token)) return null;
  return `${SEP_HOST}/OnlinePG/SendToken?token=${encodeURIComponent(token)}`;
}

/**
 * Where the browser may be sent. A free order stays on this site. A bank order
 * only leaves for Zarinpal StartPay or SEP SendToken.
 */
export function isPaymentRedirect(url: string): boolean {
  if (url.startsWith('/home/checkout/result?') && url.includes('payment=') && !url.includes('\\')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (
      (parsed.host === 'sandbox.zarinpal.com' || parsed.host === 'payment.zarinpal.com') &&
      /^\/pg\/StartPay\/[A-Za-z0-9]{10,64}$/.test(parsed.pathname)
    ) {
      return true;
    }
    if (
      parsed.host === 'sep.shaparak.ir' &&
      parsed.pathname === '/OnlinePG/SendToken' &&
      isSepToken(parsed.searchParams.get('token') ?? '')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export type CheckoutCharge =
  | { readonly ok: true; readonly kind: 'free' }
  | { readonly ok: true; readonly kind: 'zarinpal'; readonly amount: number }
  | { readonly ok: true; readonly kind: 'sep'; readonly amount: number }
  | { readonly ok: false; readonly error: string };

/** How `amount` toman is collected. Bank gateways keep the toman figure; SEP converts to rials at request time. */
export function checkoutCharge(gateway: PaymentGatewayId, amount: number): CheckoutCharge {
  if (!Number.isInteger(amount) || amount < 0)
    return { ok: false, error: 'مبلغ پرداخت نامعتبر است' };
  if (amount === 0) return { ok: true, kind: 'free' };
  if (gateway === 'sep') {
    if (amount < SEP_MIN_TOMAN) return { ok: false, error: 'حداقل مبلغ سپ ۱۰۰۰ تومان است' };
    return { ok: true, kind: 'sep', amount };
  }
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

const SEP_TOKEN_ERRORS: Readonly<Record<string, string>> = {
  '5': 'پارامترهای ارسالی نامعتبر است',
  '8': 'آدرس سرور پذیرنده نزد سپ ثبت نشده است',
  '10': 'توکن پرداخت یافت نشد',
  '11': 'این ترمینال فقط تراکنش توکنی می‌پذیرد',
  '12': 'شماره ترمینال سپ یافت نشد',
  '21': 'محدودیت‌های مدل چندحسابی رعایت نشده است',
};

const SEP_STATE_MESSAGES: Readonly<Record<string, string>> = {
  CanceledByUser: 'پرداخت توسط کاربر لغو شد',
  Failed: 'پرداخت انجام نشد',
  SessionIsNull: 'مهلت ورود اطلاعات کارت تمام شد',
  InvalidParameters: 'پارامترهای بازگشتی نامعتبر است',
  MerchantIpAddressIsInvalid: 'آدرس سرور پذیرنده نزد سپ نامعتبر است',
  TokenNotFound: 'توکن پرداخت یافت نشد',
  TokenRequired: 'تراکنش توکنی الزامی است',
  TerminalNotFound: 'شماره ترمینال سپ یافت نشد',
  MultisettlePolicyErrors: 'محدودیت‌های مدل چندحسابی رعایت نشده است',
};

const SEP_VERIFY_ERRORS: Readonly<Record<number, string>> = {
  [-2]: 'تراکنش نزد سپ یافت نشد',
  [-6]: 'مهلت تأیید تراکنش سپ تمام شده است',
  [-104]: 'شماره ترمینال سپ در سامانه موجود نیست',
  [-105]: 'ترمینال سپ غیرفعال است',
  [-106]: 'آدرس IP پذیرنده برای تأیید مجاز نیست',
  [5]: 'تراکنش قبلاً برگشت خورده است',
};

export function sepTokenErrorMessage(code: string | null, fallback: string): string {
  if (!code) return fallback;
  return SEP_TOKEN_ERRORS[code] ?? fallback;
}

export function sepStateMessage(state: string): string {
  const key = state.trim();
  if (key.toUpperCase() === 'OK') return 'پرداخت با موفقیت انجام شد';
  return SEP_STATE_MESSAGES[key] ?? 'پرداخت ناموفق بود';
}

export function sepVerifyErrorMessage(code: number | null, fallback: string): string {
  if (code === null) return fallback;
  return SEP_VERIFY_ERRORS[code] ?? fallback;
}

export interface SepTokenOk {
  readonly ok: true;
  readonly token: string;
}

export interface SepFail {
  readonly ok: false;
  readonly code: string | number | null;
  readonly message: string;
}

export interface SepVerifyOk {
  readonly ok: true;
  readonly refNum: string;
  readonly rrn: string | null;
  readonly cardPan: string | null;
  readonly originalAmount: number;
  readonly affectiveAmount: number;
  readonly duplicate: boolean;
}

/** Reads a token-request body. status 1 with a token is the only success. */
export function parseSepToken(body: unknown): SepTokenOk | SepFail {
  if (!isRecord(body)) {
    return { ok: false, code: null, message: 'اتصال به درگاه سپ انجام نشد' };
  }
  const status = numberOrNull(body.status);
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (status === 1 && isSepToken(token)) return { ok: true, token };
  const errorCode =
    typeof body.errorCode === 'string'
      ? body.errorCode.trim()
      : numberOrNull(body.errorCode) !== null
        ? String(numberOrNull(body.errorCode))
        : null;
  const desc = typeof body.errorDesc === 'string' ? body.errorDesc.trim() : '';
  return {
    ok: false,
    code: errorCode,
    message: desc || sepTokenErrorMessage(errorCode, 'اتصال به درگاه سپ انجام نشد'),
  };
}

/**
 * Reads a verify body. ResultCode 0 is the first successful verify.
 * ResultCode 2 means that same RefNum was already verified — callers must only
 * treat it as success for the order that already claimed that RefNum.
 */
export function parseSepVerify(body: unknown): SepVerifyOk | SepFail {
  if (!isRecord(body)) {
    return { ok: false, code: null, message: 'تأیید پرداخت سپ انجام نشد' };
  }
  const resultCode = numberOrNull(body.ResultCode);
  const success = body.Success === true;
  const detail = isRecord(body.TransactionDetail) ? body.TransactionDetail : null;
  const refNum = typeof detail?.RefNum === 'string' ? detail.RefNum.trim() : '';
  const originalAmount = numberOrNull(detail?.OrginalAmount);
  const affectiveAmount = numberOrNull(detail?.AffectiveAmount);
  const duplicate = resultCode === 2;
  const accepted = (success && resultCode === 0) || duplicate;
  if (accepted && isSepRefNum(refNum) && originalAmount !== null && affectiveAmount !== null) {
    return {
      ok: true,
      refNum,
      rrn: typeof detail?.RRN === 'string' && detail.RRN.trim() ? detail.RRN.trim() : null,
      cardPan: cardPanOf(detail?.MaskedPan),
      originalAmount,
      affectiveAmount,
      duplicate,
    };
  }
  return {
    ok: false,
    code: resultCode,
    message: sepVerifyErrorMessage(resultCode, 'تأیید پرداخت سپ انجام نشد'),
  };
}

/** Callback fields SEP posts (or GETs when GetMethod=true) after the buyer leaves OnlinePG. */
export interface SepReturnFields {
  readonly state: string;
  readonly status: string;
  readonly refNum: string;
  readonly resNum: string;
  readonly amount: string;
  readonly securePan: string;
  readonly traceNo: string;
  readonly rrn: string;
  readonly token: string;
}

export function parseSepReturn(source: URLSearchParams | Record<string, string>): SepReturnFields {
  const get = (key: string): string => {
    if (source instanceof URLSearchParams) return (source.get(key) ?? '').trim();
    return (source[key] ?? '').trim();
  };
  return {
    state: get('State'),
    status: get('Status'),
    refNum: get('RefNum'),
    resNum: get('ResNum'),
    amount: get('Amount'),
    securePan: get('SecurePan'),
    traceNo: get('TraceNo'),
    rrn: get('Rrn') || get('RRN'),
    token: get('Token'),
  };
}

/** True when the gateway reports a successful card charge (still must VerifyTransaction). */
export function isSepStateOk(state: string): boolean {
  return state.trim().toUpperCase() === 'OK';
}
