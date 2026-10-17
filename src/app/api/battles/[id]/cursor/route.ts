import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { advanceCursor } from '@/server/battles/service';

type Ctx = { params: Promise<{ id: string }> };

/** The trader stepped their replay forward to market time `t`: `{ t }`. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me, body) => {
    await advanceCursor(id, me, body.t);
    return { ok: true };
  });
}
