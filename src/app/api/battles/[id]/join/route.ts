import type { NextRequest } from 'next/server';
import { normalizeCode } from '@/lib/battles';
import { battleRoute } from '@/server/battles/http';
import { joinBattle } from '@/server/battles/service';
import { battleView } from '@/server/battles/views';

type Ctx = { params: Promise<{ id: string }> };

/** Joins a battle (`{ code }` is required for private battles). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me, body) => {
    const code = typeof body.code === 'string' ? normalizeCode(body.code) : undefined;
    return battleView(await joinBattle(id, me, code), me._id);
  });
}
