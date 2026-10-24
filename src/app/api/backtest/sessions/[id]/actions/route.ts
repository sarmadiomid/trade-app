import type { NextRequest } from 'next/server';
import { BacktestError, confirmAction } from '@/server/backtest/service';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Stores one open, close or order change. The chart applies it only after this returns. */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    const body = (await readJson(req, 64 * 1024)) as { t?: unknown; action?: unknown };
    await confirmAction(user._id, id, body?.t, body?.action);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BacktestError) return json({ error: e.message }, e.status);
    console.error('[backtest] action failed', e);
    return json({ error: 'Server error' }, 500);
  }
}
