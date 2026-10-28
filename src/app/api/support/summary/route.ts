import type { NextRequest } from 'next/server';
import { unreadCount } from '@/server/support';
import { withSupport } from '@/server/support-http';

/** Unread support replies for the sidebar badge. */
export async function GET(req: NextRequest) {
  return withSupport(req, async (user) => ({ unread: await unreadCount(user._id) }));
}
