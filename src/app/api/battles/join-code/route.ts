import type { NextRequest } from 'next/server';
import { normalizeCode } from '@/lib/battles';
import { battleRoute } from '@/server/battles/http';
import { BattleError, findByCode, joinBattle } from '@/server/battles/service';

/** Finds a battle by its battle ID and joins it: `{ code }` → `{ id }`. */
export function POST(req: NextRequest) {
  return battleRoute(req, async (me, body) => {
    const code = typeof body.code === 'string' ? normalizeCode(body.code) : '';
    const b = code ? await findByCode(code) : null;
    if (!b) throw new BattleError('No battle has this ID', 404);
    const id = b._id.toHexString();
    if (!b.participants.some((p) => p.userId.equals(me._id))) await joinBattle(id, me, code);
    return { id };
  });
}
