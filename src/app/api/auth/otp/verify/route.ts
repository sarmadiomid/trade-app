import type { NextRequest } from 'next/server';
import { OTP_LENGTH, normalizeIranianMobile, toAsciiDigits } from '@/auth/phone';
import { SESSION_COOKIE, sessionCookieOptions, verifyOtp } from '@/server/auth';
import { json, readJson, sameOrigin } from '@/server/http';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  let body: { phone?: unknown; code?: unknown } | null;
  try {
    body = (await readJson(req, 1024)) as typeof body;
  } catch {
    return json({ error: 'درخواست نامعتبر است.' }, 400);
  }
  const phone = typeof body?.phone === 'string' ? normalizeIranianMobile(body.phone) : null;
  const code = typeof body?.code === 'string' ? toAsciiDigits(body.code).trim() : '';
  if (!phone) return json({ error: 'شماره موبایل معتبر نیست.' }, 400);
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code))
    return json({ error: `کد ${OTP_LENGTH} رقمی را کامل وارد کنید.` }, 400);
  try {
    const res = await verifyOtp(phone, code);
    if (!res.ok) return json({ error: res.error }, res.status);
    const out = json({ ok: true, user: res.user, isNew: res.isNew });
    out.cookies.set(SESSION_COOKIE, res.token, sessionCookieOptions);
    return out;
  } catch (e) {
    console.error('[auth] otp verify failed', e);
    return json({ error: 'خطای سرور. دوباره تلاش کنید.' }, 500);
  }
}
