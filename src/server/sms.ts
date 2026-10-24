import 'server-only';

export interface SmsResult {
  readonly ok: boolean;
  /** Set when Mediana is not configured outside production: the code is shown in the UI. */
  readonly devCode?: string;
}

interface MedianaOtpResponse {
  readonly meta?: { readonly code?: string; readonly errorMessage?: string | null };
  readonly data?: { readonly succeed?: boolean } | null;
}

const OTP_URL = 'https://api.mediana.ir/sms/v1/send/otp';

/**
 * Sends the login code through Mediana's OTP API (`POST /sms/v1/send/otp`).
 * Requires `MEDIANA_API_KEY` and an approved OTP pattern in `MEDIANA_PATTERN_CODE`.
 * Without them, development shows the code in the UI; production refuses to send.
 */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const apiKey = process.env.MEDIANA_API_KEY?.trim();
  const patternCode = process.env.MEDIANA_PATTERN_CODE?.trim();
  if (apiKey && patternCode) {
    try {
      const res = await fetch(OTP_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({ patternCode, recipient: phone, otpCode: code }),
      });
      const body = (await res.json().catch(() => null)) as MedianaOtpResponse | null;
      const ok = res.ok && body?.data?.succeed === true;
      if (!ok) {
        console.error(
          '[sms] Mediana OTP failed',
          res.status,
          body?.meta?.code ?? '',
          body?.meta?.errorMessage ?? '',
        );
      }
      return { ok };
    } catch (e) {
      console.error('[sms] Mediana request failed', e);
      return { ok: false };
    }
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[sms] Mediana is not configured (MEDIANA_API_KEY / MEDIANA_PATTERN_CODE)');
    return { ok: false };
  }
  console.warn(`[otp] ${phone}: ${code}`);
  return { ok: true, devCode: code };
}
