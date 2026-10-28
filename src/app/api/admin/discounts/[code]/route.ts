import type { NextRequest } from 'next/server';
import { setDiscountActive } from '@/server/admin-desk';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { code } = await params;
  return withAdmin(req, async (_user, body) => {
    await setDiscountActive(decodeURIComponent(code), body.active === true);
    return { ok: true };
  });
}
