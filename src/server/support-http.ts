import 'server-only';
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';
import type { SessionUser } from './auth';
import { SUPPORT_FILE_MAX_BYTES, SUPPORT_FILE_MAX_COUNT } from '@/lib/support/catalog';
import { json, readJson, requestUser, sameOrigin } from './http';
import { prepareSupportFiles, SupportError, type RawSupportFile } from './support';

type SupportUser = SessionUser & { readonly _id: ObjectId };

/**
 * Shared plumbing of the support API: same-origin writes, the signed-in user,
 * a JSON object body, and SupportError mapped to its status.
 */
export async function withSupport(
  req: NextRequest,
  handler: (user: SupportUser, body: Record<string, unknown>) => Promise<unknown>,
): Promise<Response> {
  const write = req.method !== 'GET';
  if (write && !sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: Record<string, unknown> = {};
    if (write && isMultipart(req)) {
      body = await readSupportForm(req);
    } else if (write && req.headers.get('content-length') !== '0') {
      let parsed: unknown;
      try {
        parsed = await readJson(req, 32 * 1024);
      } catch (error) {
        if (error instanceof SyntaxError || error instanceof RangeError) {
          return json({ error: 'Invalid JSON' }, 400);
        }
        throw error;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return json({ error: 'Invalid JSON' }, 400);
      }
      body = parsed as Record<string, unknown>;
    }
    return json(await handler(user, body));
  } catch (error) {
    if (error instanceof SupportError) return json({ error: error.message }, error.status);
    console.error('[support]', error);
    return json({ error: 'Server error' }, 500);
  }
}

function isMultipart(req: NextRequest): boolean {
  return (req.headers.get('content-type') ?? '').includes('multipart/form-data');
}

async function readSupportForm(req: NextRequest): Promise<Record<string, unknown>> {
  const length = Number(req.headers.get('content-length') ?? 0);
  const cap = SUPPORT_FILE_MAX_BYTES * SUPPORT_FILE_MAX_COUNT + 64 * 1024;
  if (length > cap) throw new SupportError('File too large', 400);
  const form = await req.formData();
  const raw: RawSupportFile[] = [];
  for (const entry of form.getAll('file')) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (raw.length >= SUPPORT_FILE_MAX_COUNT) throw new SupportError('Too many files', 400);
    if (entry.size > SUPPORT_FILE_MAX_BYTES) throw new SupportError('File too large', 400);
    raw.push({
      name: entry.name,
      type: entry.type,
      data: Buffer.from(await entry.arrayBuffer()),
    });
  }
  prepareSupportFiles(raw);
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  return {
    subject: text('subject'),
    title: text('title'),
    symbol: text('symbol'),
    body: text('body'),
    files: raw,
  };
}
