import type { NextRequest } from 'next/server';
import { publishedCatalog } from '@/server/symbols';
import { json, requestUser } from '@/server/http';

/** Instruments an admin published for practice. Built-in symbols stay on the seeded market. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    return json({ instruments: await publishedCatalog() });
  } catch (error) {
    console.error('[catalog]', error);
    return json({ error: 'Server error' }, 500);
  }
}
