import type { NextRequest } from 'next/server';
import { BacktestError, loadSession, removeSession, saveSession } from '@/server/backtest/service';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

const MAX_SESSION = 4 * 1024 * 1024;

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    const session = await loadSession(user._id, id);
    if (!session) return json({ error: 'جلسه پیدا نشد' }, 404);
    return json({ session });
  } catch (e) {
    console.error('[backtest] load failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

/** Saves journal, cursor and replay progress. Trade actions go through `/actions`. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    const body = (await readJson(req, MAX_SESSION)) as { session?: unknown };
    const session = body?.session;
    if (!session || typeof session !== 'object' || (session as { id?: unknown }).id !== id)
      return json({ error: 'جلسه نامعتبر است' }, 400);
    await saveSession(user._id, session);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BacktestError) return json({ error: e.message }, e.status);
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    console.error('[backtest] save failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    await removeSession(user._id, id);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BacktestError) return json({ error: e.message }, e.status);
    console.error('[backtest] delete failed', e);
    return json({ error: 'Server error' }, 500);
  }
}
