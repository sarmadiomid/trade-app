import type { NextRequest } from 'next/server';
import { changeUserPlan } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(req, async (_user, body) => {
    await changeUserPlan(id, body.plan);
    return { ok: true };
  });
}
