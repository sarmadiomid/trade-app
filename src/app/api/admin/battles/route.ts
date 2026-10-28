import type { NextRequest } from 'next/server';
import { listBattles } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => ({ battles: await listBattles() }));
}
