import type { NextRequest } from 'next/server';
import { listTransactions } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const status = req.nextUrl.searchParams.get('status') ?? '';
  const mismatch = req.nextUrl.searchParams.get('mismatch') === '1';
  return withAdmin(req, async () => listTransactions({ q, status, mismatch }));
}
