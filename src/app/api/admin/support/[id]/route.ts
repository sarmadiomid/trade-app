import type { NextRequest } from 'next/server';
import { staffThread, SupportError } from '@/server/support';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withAdmin(req, async () => {
    const thread = await staffThread(id);
    if (!thread) throw new SupportError('این گفتگو پیدا نشد', 404);
    return thread;
  });
}
