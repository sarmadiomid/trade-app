import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, userFromToken } from './auth';

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Rejects cross-site mutations (the session cookie is SameSite=Lax; this is defence in depth). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
  } catch {
    return false;
  }
}

export async function readJson(req: NextRequest, maxBytes: number): Promise<unknown> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new RangeError('Payload too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new RangeError('Payload too large');
  return JSON.parse(text) as unknown;
}

export const requestUser = (req: NextRequest) =>
  userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
