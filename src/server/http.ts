import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, userFromToken } from './auth';

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Rejects cross-site mutations (the session cookie is SameSite=Lax; this is defence in depth). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  // Fail closed when Origin is absent so non-browser clients cannot skip the check.
  if (!origin) return false;
  try {
    // Compare to Host only — never trust client-controlled X-Forwarded-Host here.
    const host = (req.headers.get('host') ?? '').split(',')[0]?.trim() ?? '';
    return Boolean(host) && new URL(origin).host === host;
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

/**
 * Absolute origin for the bank return URL.
 * Production requires APP_URL so clients cannot steer callback/redirect via forwarded headers.
 */
export function publicOrigin(req: NextRequest): string | null {
  const fromEnv = originOf(process.env.APP_URL);
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') return null;
  // Local/dev only: Host header (never X-Forwarded-Host).
  const host = (req.headers.get('host') ?? '').split(',')[0]?.trim();
  if (!host) return null;
  const proto =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return originOf(`${proto}://${host}`);
}

function originOf(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
