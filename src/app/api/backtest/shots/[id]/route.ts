import type { NextRequest } from 'next/server';
import { BacktestError, loadShot, removeShot, saveShot } from '@/server/backtest/service';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    const dataUrl = await loadShot(user._id, decodeURIComponent(id));
    if (!dataUrl) return json({ error: 'تصویر پیدا نشد' }, 404);
    return json({ dataUrl });
  } catch (e) {
    console.error('[backtest] shot load failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    const body = (await readJson(req, 2 * 1024 * 1024)) as { dataUrl?: unknown };
    await saveShot(user._id, decodeURIComponent(id), body?.dataUrl);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BacktestError) return json({ error: e.message }, e.status);
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    console.error('[backtest] shot save failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { id } = await params;
    await removeShot(user._id, decodeURIComponent(id));
    return json({ ok: true });
  } catch (e) {
    console.error('[backtest] shot delete failed', e);
    return json({ error: 'Server error' }, 500);
  }
}
