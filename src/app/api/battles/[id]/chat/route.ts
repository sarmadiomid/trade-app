import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { postChat } from '@/server/battles/service';

type Ctx = { params: Promise<{ id: string }> };

/** Posts a chat message: `{ text }`. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me, body) => {
    await postChat(id, me, body.text);
    return { ok: true };
  });
}
