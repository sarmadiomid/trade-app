import type { NextRequest } from 'next/server';
import { listPracticeSessions } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => ({ sessions: await listPracticeSessions() }));
}
