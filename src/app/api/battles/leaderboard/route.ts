import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { leaderboard } from '@/server/battles/profiles';

/** Global leaderboard: `?sort=elo` (ranked rating, default) or `?sort=xp` (Composite Score). */
export function GET(req: NextRequest) {
  return battleRoute(req, async (me) => {
    const sort = req.nextUrl.searchParams.get('sort') === 'xp' ? 'xp' : 'elo';
    return { entries: await leaderboard(me._id, sort) };
  });
}
