import type { NextRequest } from 'next/server';
import { listDiscounts, saveDiscount } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

export async function GET(req: NextRequest) {
  return withAdmin(req, async () => ({ discounts: await listDiscounts() }));
}

export async function POST(req: NextRequest) {
  return withAdmin(req, async (_user, body) => {
    await saveDiscount(body);
    return { ok: true };
  });
}
