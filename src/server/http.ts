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
    return (
      new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))
    );
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

/** Absolute origin for the bank return URL. APP_URL wins when it is set. */
export function publicOrigin(req: NextRequest): string | null {
  const fromEnv = originOf(process.env.APP_URL);
  if (fromEnv) return fromEnv;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim();
  if (!host) return null;
  const forwarded = (req.headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim();
  const proto =
    forwarded === 'http' || forwarded === 'https'
      ? forwarded
      : host.startsWith('localhost') || host.startsWith('127.0.0.1')
        ? 'http'
        : 'https';
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
