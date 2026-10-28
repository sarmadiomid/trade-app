import type { NextRequest } from 'next/server';
import { closeTicketAsStaff } from '@/server/support';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(req, async () => ({ ticket: await closeTicketAsStaff(id) }));
}
