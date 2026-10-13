import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, revokeToken } from '@/server/auth';
import { json, sameOrigin } from '@/server/http';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    await revokeToken(req.cookies.get(SESSION_COOKIE)?.value);
  } catch (e) {
    console.error('[auth] logout failed', e);
  }
  const out = json({ ok: true });
  out.cookies.delete(SESSION_COOKIE);
  return out;
}
