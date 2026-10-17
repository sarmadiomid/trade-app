import type { NextRequest } from 'next/server';
import type { BattleSettings } from '@/lib/battles';
import { battleRoute } from '@/server/battles/http';
import { createBattle } from '@/server/battles/service';
import { browseBattles, myBattles } from '@/server/battles/views';

/** `?tab=browse` (public lobbies and battles in progress) or `?tab=mine`. */
export function GET(req: NextRequest) {
  return battleRoute(req, async (me) => {
    const tab = req.nextUrl.searchParams.get('tab');
    return { battles: tab === 'mine' ? await myBattles(me._id) : await browseBattles(me._id) };
  });
}

/** Creates a custom battle: `{ settings }`. */
export function POST(req: NextRequest) {
  return battleRoute(req, async (me, body) => {
    const b = await createBattle(me, body.settings as BattleSettings);
    return { id: b._id.toHexString(), code: b.code };
  });
}
