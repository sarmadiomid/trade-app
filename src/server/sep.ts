import 'server-only';
import {
  isSepTerminalId,
  parseSepToken,
  parseSepVerify,
  sepCellNumber,
  sepSendTokenUrl,
  SEP_REVERSE_URL,
  SEP_TOKEN_URL,
  SEP_VERIFY_URL,
  tomanToRial,
  type SepFail,
  type SepTokenOk,
  type SepVerifyOk,
} from '@/lib/app/billing/gateway';

export { sepCellNumber };

export type SepRequestResult = (SepTokenOk & { readonly url: string }) | SepFail;

export type SepVerifyResult =
  | (SepVerifyOk & { readonly amountMismatch: false })
  | (SepFail & { readonly retry: boolean; readonly amountMismatch?: false })
  | {
      readonly ok: false;
      readonly retry: false;
      readonly amountMismatch: true;
      readonly code: number | null;
      readonly message: string;
      readonly refNum: string;
    };

/** Terminal id from the Saman (SEP) merchant panel. */
export function sepTerminalId(): string | null {
  const value = process.env.SEP_TERMINAL_ID?.trim() ?? '';
  return isSepTerminalId(value) ? value : null;
}

/**
 * Requests a payment token. `amount` is toman in our ledger and is sent to SEP as rials.
 * CellNumber is the 10-digit national mobile form SEP expects (no leading 0).
 */
export async function requestSepPayment(input: {
  readonly amount: number;
  readonly resNum: string;
  readonly callbackUrl: string;
  readonly mobile: string | null;
}): Promise<SepRequestResult> {
  const terminalId = sepTerminalId();
  if (!terminalId) {
    return { ok: false, code: null, message: 'شناسه ترمینال سپ تنظیم نشده است' };
  }
  const cell = sepCellNumber(input.mobile);
  let body: unknown;
  try {
    body = await postJson(SEP_TOKEN_URL, {
      action: 'token',
      TerminalId: terminalId,
      Amount: tomanToRial(input.amount),
      ResNum: input.resNum,
      RedirectUrl: input.callbackUrl,
      ...(cell ? { CellNumber: cell } : {}),
      TokenExpiryInMin: 20,
    });
  } catch (error) {
    console.error('[sep] token request failed', error);
    return { ok: false, code: null, message: 'اتصال به درگاه سپ انجام نشد' };
  }
  const parsed = parseSepToken(body);
  if (!parsed.ok) {
    console.error('[sep] token rejected', parsed.code);
    return parsed;
  }
  const url = sepSendTokenUrl(parsed.token);
  if (!url) return { ok: false, code: null, message: 'اتصال به درگاه سپ انجام نشد' };
  return { ...parsed, url };
}

/**
 * Confirms a finished SEP charge. Amount is compared in rials.
 * A network failure sets `retry` so the order stays pending for another return.
 */
export async function verifySepPayment(input: {
  readonly amount: number;
  readonly refNum: string;
}): Promise<SepVerifyResult> {
  const terminalId = sepTerminalId();
  if (!terminalId) {
    return {
      ok: false,
      retry: false,
      code: null,
      message: 'شناسه ترمینال سپ تنظیم نشده است',
    };
  }
  let body: unknown;
  try {
    body = await postJson(SEP_VERIFY_URL, {
      RefNum: input.refNum,
      TerminalNumber: Number(terminalId),
    });
  } catch (error) {
    console.error('[sep] verify failed', error);
    return { ok: false, retry: true, code: null, message: 'تأیید پرداخت سپ انجام نشد' };
  }
  const parsed = parseSepVerify(body);
  if (!parsed.ok) return { ...parsed, retry: parsed.code === null };

  const expected = tomanToRial(input.amount);
  if (parsed.originalAmount !== expected && parsed.affectiveAmount !== expected) {
    console.error('[sep] amount mismatch', {
      expected,
      original: parsed.originalAmount,
      affective: parsed.affectiveAmount,
    });
    await reverseSepPayment(input.refNum).catch((error) => {
      console.error('[sep] reverse after mismatch failed', error);
    });
    return {
      ok: false,
      retry: false,
      amountMismatch: true,
      code: null,
      message: 'مبلغ تأیید شده با مبلغ سفارش یکی نیست',
      refNum: parsed.refNum || input.refNum,
    };
  }
  return { ...parsed, refNum: parsed.refNum || input.refNum, amountMismatch: false };
}

/** Asks SEP to refund a verified charge (within ~50 minutes of the original txn). */
export async function reverseSepPayment(refNum: string): Promise<boolean> {
  const terminalId = sepTerminalId();
  if (!terminalId) return false;
  try {
    const body = await postJson(SEP_REVERSE_URL, {
      RefNum: refNum,
      TerminalNumber: Number(terminalId),
    });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    const record = body as Record<string, unknown>;
    return record.Success === true || Number(record.ResultCode) === 0;
  } catch (error) {
    console.error('[sep] reverse failed', error);
    return false;
  }
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
    throw new Error(`SEP returned HTTP ${res.status}`);
  }
}
