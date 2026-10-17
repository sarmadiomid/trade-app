import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { profileView, setDisplayName } from '@/server/battles/profiles';
import { BattleError } from '@/server/battles/service';
import { activeBattleOf } from '@/server/battles/views';

/** The signed-in trader's battle profile (Elo, rank, Composite Score, stats). */
export function GET(req: NextRequest) {
  return battleRoute(req, async (me) => ({
    profile: await profileView(me._id, me.name),
    active: await activeBattleOf(me._id),
  }));
}

/** Changes the display name: `{ name }`. */
export function PATCH(req: NextRequest) {
  return battleRoute(req, async (me, body) => {
    const error = await setDisplayName(me._id, body.name);
    if (error) throw new BattleError(error);
    return { profile: await profileView(me._id, String(body.name).replace(/\s+/g, ' ').trim()) };
  });
}
