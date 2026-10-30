import type { NextRequest } from 'next/server';
import { normalizeIranianMobile } from '@/auth/phone';
import { requestOtp } from '@/server/auth';
import { json, readJson, sameOrigin } from '@/server/http';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  let body: unknown;
  try {
    body = await readJson(req, 1024);
  } catch {
    return json({ error: 'درخواست نامعتبر است.' }, 400);
  }
  const raw = (body as { phone?: unknown } | null)?.phone;
  const phone = typeof raw === 'string' ? normalizeIranianMobile(raw) : null;
  if (!phone) return json({ error: 'شماره موبایل معتبر نیست.' }, 400);
  try {
    const forwarded = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
    const clientKey = forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
    const res = await requestOtp(phone, clientKey);
    if (!res.ok) return json({ error: res.error, retryIn: res.retryIn }, res.status);
    return json({ ok: true, phone, resendIn: res.resendIn, devCode: res.devCode });
  } catch (e) {
    console.error('[auth] otp request failed', e);
    return json({ error: 'خطای سرور. دوباره تلاش کنید.' }, 500);
  }
}
