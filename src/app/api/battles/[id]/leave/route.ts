import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { leaveBattle } from '@/server/battles/service';
import { battleView } from '@/server/battles/views';

type Ctx = { params: Promise<{ id: string }> };

/** Leaves the lobby, or forfeits a battle in progress. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me) => battleView(await leaveBattle(id, me), me._id));
}
