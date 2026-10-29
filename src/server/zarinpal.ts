import 'server-only';
import {
  isZarinpalMerchantId,
  parseZarinpalRequest,
  parseZarinpalVerify,
  zarinpalRequestUrl,
  zarinpalStartPayUrl,
  zarinpalVerifyUrl,
  type ZarinpalFail,
  type ZarinpalMode,
  type ZarinpalRequestOk,
  type ZarinpalVerifyOk,
} from '@/lib/app/billing/gateway';

export type ZarinpalRequestResult = (ZarinpalRequestOk & { readonly url: string }) | ZarinpalFail;

export type ZarinpalVerifyResult = ZarinpalVerifyOk | (ZarinpalFail & { readonly retry: boolean });

/** Sandbox outside production, unless ZARINPAL_MODE is set to sandbox or live. */
export function zarinpalMode(): ZarinpalMode {
  const raw = process.env.ZARINPAL_MODE?.trim().toLowerCase();
  if (raw === 'sandbox' || raw === 'live') return raw;
  return process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
}

/**
 * Opens a Zarinpal payment. `amount` is toman and is sent with currency IRT, so
 * verify must send this same number back.
 */
export async function requestZarinpalPayment(input: {
  readonly amount: number;
  readonly description: string;
  readonly callbackUrl: string;
  readonly mobile: string | null;
  readonly orderId: string;
}): Promise<ZarinpalRequestResult> {
  const merchantId = merchant();
  if (!merchantId) {
    return { ok: false, code: null, message: 'شناسه پذیرنده زرین‌پال تنظیم نشده است' };
  }
  const mode = zarinpalMode();
  let body: unknown;
  try {
    body = await postJson(zarinpalRequestUrl(mode), {
      merchant_id: merchantId,
      amount: input.amount,
      currency: 'IRT',
      description: input.description,
      callback_url: input.callbackUrl,
      metadata: {
        ...(input.mobile ? { mobile: input.mobile } : {}),
        order_id: input.orderId,
      },
    });
  } catch (error) {
    console.error('[zarinpal] request failed', error);
    return { ok: false, code: null, message: 'اتصال به زرین‌پال انجام نشد' };
  }
  const parsed = parseZarinpalRequest(body);
  if (!parsed.ok) {
    console.error('[zarinpal] request rejected', parsed.code);
    return parsed;
  }
  const url = zarinpalStartPayUrl(mode, parsed.authority);
  if (!url) return { ok: false, code: null, message: 'اتصال به زرین‌پال انجام نشد' };
  return { ...parsed, url };
}

/** Confirms a payment the buyer finished. A network failure sets `retry` so the order stays pending. */
export async function verifyZarinpalPayment(input: {
  readonly amount: number;
  readonly authority: string;
}): Promise<ZarinpalVerifyResult> {
  const merchantId = merchant();
  if (!merchantId) {
    return {
      ok: false,
      retry: false,
      code: null,
      message: 'شناسه پذیرنده زرین‌پال تنظیم نشده است',
    };
  }
  let body: unknown;
  try {
    body = await postJson(zarinpalVerifyUrl(zarinpalMode()), {
      merchant_id: merchantId,
      amount: input.amount,
      authority: input.authority,
    });
  } catch (error) {
    console.error('[zarinpal] verify failed', error);
    return { ok: false, retry: true, code: null, message: 'تأیید پرداخت انجام نشد' };
  }
  const parsed = parseZarinpalVerify(body);
  if (parsed.ok) return parsed;
  return { ...parsed, retry: parsed.code === null };
}

function merchant(): string | null {
  const value = process.env.ZARINPAL_MERCHANT_ID?.trim() ?? '';
  return isZarinpalMerchantId(value) ? value : null;
}

async function postJson(url: string, payload: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Zarinpal returned HTTP ${res.status}`);
  }
}
