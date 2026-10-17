import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { submitAction } from '@/server/battles/service';

type Ctx = { params: Promise<{ id: string }> };

/** A trade action taken at market time `t`: `{ t, action }`. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return battleRoute(req, async (me, body) => {
    await submitAction(id, me, body.t, body.action);
    return { ok: true };
  });
}
