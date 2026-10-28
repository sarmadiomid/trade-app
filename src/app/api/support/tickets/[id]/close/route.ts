import type { NextRequest } from 'next/server';
import { closeTicket } from '@/server/support';
import { withSupport } from '@/server/support-http';

type Ctx = { params: Promise<{ id: string }> };

/** Closes the user's ticket. A later message opens it again. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withSupport(req, async (user) => ({ ticket: await closeTicket(user._id, id) }));
}
