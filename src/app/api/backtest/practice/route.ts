import type { NextRequest } from 'next/server';
import { addPracticeTime, BacktestError, importPractice, listPractice } from '@/server/backtest/service';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

/** Visible replay time stored on the account, so every browser shows the same total. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    return json({ practice: await listPractice(user._id) });
  } catch (e) {
    console.error('[backtest] practice list failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await readJson(req, 256_000)) as { import?: unknown; sessionId?: unknown; ms?: unknown };
    if (body && typeof body === 'object' && 'import' in body) {
      await importPractice(user._id, body.import);
      return json({ ok: true });
    }
    await addPracticeTime(user._id, body?.sessionId, body?.ms);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BacktestError) return json({ error: e.message }, e.status);
    if (e instanceof RangeError) return json({ error: e.message }, 413);
    console.error('[backtest] practice save failed', e);
    return json({ error: 'Server error' }, 500);
  }
}
