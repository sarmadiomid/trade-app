import type { NextRequest } from 'next/server';
import { replyToTicket } from '@/server/support';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(req, async (user, body) => replyToTicket(id, body.body, user.name));
}
