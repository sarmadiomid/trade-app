import type { NextRequest } from 'next/server';
import { BacktestError, listSessions } from '@/server/backtest/service';
import { json, requestUser } from '@/server/http';

/** Every backtest session of the signed-in user. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    return json({ sessions: await listSessions(user._id) });
  } catch (e) {
    if (e instanceof BacktestError) return json({ error: e.message }, e.status);
    console.error('[backtest] list failed', e);
    return json({ error: 'Server error' }, 500);
  }
}
