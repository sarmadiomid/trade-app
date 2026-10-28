import type { NextRequest } from 'next/server';
import { importSymbolBars } from '@/server/symbols';
import { withAdmin } from '@/server/admin-http';

type Ctx = { params: Promise<{ symbol: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { symbol } = await params;
  return withAdmin(
    req,
    async (_user, body) => ({
      symbol: await importSymbolBars(decodeURIComponent(symbol), body.timeframe, body.bars, body.mode),
    }),
    8_000_000,
  );
}
