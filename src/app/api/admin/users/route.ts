import type { NextRequest } from 'next/server';
import { searchUsers } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  return withAdmin(req, async () => ({ users: await searchUsers(q) }));
}
