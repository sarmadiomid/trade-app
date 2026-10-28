import type { NextRequest } from 'next/server';
import { isTimeframeId } from '@/lib/core';
import { readMarketBars } from '@/server/symbols';
import { json, requestUser } from '@/server/http';

function num(value: string | null): number | undefined {
  if (value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Candles of an admin symbol. Built-in symbols are not served here. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const p = req.nextUrl.searchParams;
    const symbol = (p.get('symbol') ?? '').toUpperCase();
    const timeframe = p.get('timeframe');
    if (!/^[A-Z0-9]{2,20}$/.test(symbol) || !isTimeframeId(timeframe)) {
      return json({ error: 'Invalid symbol or timeframe' }, 400);
    }
    const startTime = num(p.get('startTime'));
    const endTime = num(p.get('endTime'));
    const bars = await readMarketBars(symbol, {
      timeframe,
      limit: Math.min(5000, Math.max(1, num(p.get('limit')) ?? 500)),
      ...(startTime !== undefined ? { startTime } : {}),
      ...(endTime !== undefined ? { endTime } : {}),
    });
    if (!bars) return json({ error: 'Symbol not found' }, 404);
    return json(bars);
  } catch (error) {
    console.error('[market/bars]', error);
    return json({ error: 'Server error' }, 500);
  }
}
