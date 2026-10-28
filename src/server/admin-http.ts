import 'server-only';
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';
import { normalizeIranianMobile } from '@/auth/phone';
import { json, readJson, requestUser, sameOrigin } from './http';
import type { SessionUser } from './auth';

export function isAdminPhone(phone: string): boolean {
  const normalized = normalizeIranianMobile(phone);
  if (!normalized) return false;
  return adminPhones().has(normalized);
}

function adminPhones(): Set<string> {
  const raw = process.env.ADMIN_PHONES ?? '';
  const phones = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const phone = normalizeIranianMobile(part);
    if (phone) phones.add(phone);
  }
  return phones;
}

type AdminUser = SessionUser & { readonly _id: ObjectId };

/** JSON admin routes. Non-admins get 403, anonymous callers get 401. */
export async function withAdmin(
  req: NextRequest,
  handler: (user: AdminUser, body: Record<string, unknown>) => Promise<unknown>,
  maxBytes = 64 * 1024,
): Promise<Response> {
  const write = req.method !== 'GET' && req.method !== 'HEAD';
  if (write && !sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'نشست شما تمام شده. دوباره وارد شوید.' }, 401);
    if (!isAdminPhone(user.phone)) return json({ error: 'به پنل مدیریت دسترسی ندارید.' }, 403);
    let body: Record<string, unknown> = {};
    if (write && Number(req.headers.get('content-length') ?? 0) > 0) {
      let parsed: unknown;
      try {
        parsed = await readJson(req, maxBytes);
      } catch (error) {
        if (error instanceof SyntaxError || error instanceof RangeError) {
          return json({ error: 'درخواست نامعتبر بود.' }, 400);
        }
        throw error;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return json({ error: 'درخواست نامعتبر بود.' }, 400);
      }
      body = parsed as Record<string, unknown>;
    }
    return json(await handler(user, body));
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    const message =
      error instanceof Error && status < 500 ? error.message : 'انجام نشد. دوباره تلاش کنید.';
    if (status >= 500) console.error('[admin]', error);
    return json({ error: message }, Number.isFinite(status) && status >= 400 ? status : 500);
  }
}
