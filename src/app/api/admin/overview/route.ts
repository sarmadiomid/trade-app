import type { NextRequest } from 'next/server';
import { adminOverview } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => adminOverview());
}
