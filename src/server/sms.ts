import 'server-only';

export interface SmsResult {
  readonly ok: boolean;
  /** Set when no SMS provider is configured outside production: the code is shown in the UI. */
  readonly devCode?: string;
}

/**
 * Sends the login code. With KAVENEGAR_API_KEY + KAVENEGAR_TEMPLATE it uses Kavenegar's
 * verify/lookup API; without them (development only) the code is logged and returned.
 */
export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  if (process.env.NODE_ENV !== 'production') console.log(`[otp] ${phone}: ${code}`);
  const apiKey = process.env.KAVENEGAR_API_KEY;
  const template = process.env.KAVENEGAR_TEMPLATE;
  if (apiKey && template) {
    const url = new URL(
      `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`,
    );
    url.searchParams.set('receptor', phone);
    url.searchParams.set('token', code);
    url.searchParams.set('template', template);
    try {
      const res = await fetch(url, { method: 'POST', cache: 'no-store' });
      if (!res.ok) console.error('[sms] Kavenegar error', res.status, await res.text());
      return { ok: res.ok };
    } catch (e) {
      console.error('[sms] Kavenegar request failed', e);
      return { ok: false };
    }
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[sms] No SMS provider configured (KAVENEGAR_API_KEY / KAVENEGAR_TEMPLATE)');
    return { ok: false };
  }
  return { ok: true, devCode: code };
}
