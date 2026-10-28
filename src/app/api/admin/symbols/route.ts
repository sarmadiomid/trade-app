import type { NextRequest } from 'next/server';
import { listAdminSymbols, saveInstrument } from '@/server/symbols';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => ({ symbols: await listAdminSymbols() }));
}

export async function POST(req: NextRequest) {
  return withAdmin(req, async (_user, body) => ({ symbol: await saveInstrument(body) }));
}
