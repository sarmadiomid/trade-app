import type { NextRequest } from 'next/server';
import { removeInstrument, saveInstrument, symbolDetail, SymbolError } from '@/server/symbols';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ symbol: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { symbol } = await params;
  return withAdmin(req, async () => {
    const detail = await symbolDetail(symbol);
    if (!detail) throw new SymbolError('این نماد پیدا نشد', 404);
    return { symbol: detail };
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { symbol } = await params;
  return withAdmin(req, async (_user, body) => {
    const next = { ...body, symbol: body.symbol ?? decodeURIComponent(symbol) };
    return { symbol: await saveInstrument(next) };
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { symbol } = await params;
  return withAdmin(req, async () => {
    await removeInstrument(decodeURIComponent(symbol));
    return { ok: true };
  });
}
