import type { NextRequest } from 'next/server';
import { json, requestUser } from '@/server/http';

/** The signed-in user: `{ id, name, phone }`. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    return json({ id: user.id, name: user.name, phone: user.phone });
  } catch (e) {
    console.error('[me]', e);
    return json({ error: 'Server error' }, 500);
  }
}
