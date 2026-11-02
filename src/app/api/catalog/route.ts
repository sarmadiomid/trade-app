import type { NextRequest } from 'next/server';
import { listDisabledBuiltins, publishedCatalog } from '@/server/symbols';
import { json, requestUser } from '@/server/http';

/** Instruments an admin published for practice, plus built-ins the admin removed. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const [instruments, disabledBuiltins] = await Promise.all([
      publishedCatalog(),
      listDisabledBuiltins(),
    ]);
    return json({ instruments, disabledBuiltins });
  } catch (error) {
    console.error('[catalog]', error);
    return json({ error: 'Server error' }, 500);
  }
}
