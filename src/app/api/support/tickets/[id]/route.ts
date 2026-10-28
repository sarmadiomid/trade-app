import type { NextRequest } from 'next/server';
import { getThread } from '@/server/support';
import { withSupport } from '@/server/support-http';

type Ctx = { params: Promise<{ id: string }> };

/** One ticket and its messages. Opening it clears the user's unread replies. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withSupport(req, (user) => getThread(user._id, id));
}
