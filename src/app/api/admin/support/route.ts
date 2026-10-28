import type { NextRequest } from 'next/server';
import { listStaffTickets } from '@/server/support';
import { withAdmin } from '@/server/admin-http';
import type { SupportStatus } from '@/lib/support/catalog';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('status') ?? 'open';
  const status = raw === 'answered' || raw === 'closed' || raw === 'all' ? raw : 'open';
  return withAdmin(req, async () => ({
    tickets: await listStaffTickets(status as SupportStatus | 'all'),
  }));
}
