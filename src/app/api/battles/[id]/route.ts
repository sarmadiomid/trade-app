import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { loadBattle, refresh } from '@/server/battles/service';
import { battleView } from '@/server/battles/views';

type Ctx = { params: Promise<{ id: string }> };

/** The battle as the viewer sees it (polled about once a second by the battle page). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me) => battleView(await refresh(await loadBattle(id)), me._id));
}
