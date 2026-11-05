import type { NextRequest } from 'next/server';
import { withAdmin } from '@/server/admin-http';
import { startManualIngest, type ManualIngestMode } from '@/server/ingest/admin';

type Ctx = { params: Promise<{ symbol: string }> };

/** Kick off an async Dukascopy ingest pass for one symbol. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { symbol } = await params;
  return withAdmin(req, async (_user, body) => {
    const mode = parseMode(body.mode);
    return startManualIngest(decodeURIComponent(symbol), mode);
  });
}

function parseMode(raw: unknown): ManualIngestMode {
  if (raw === 'bootstrap' || raw === 'refresh' || raw === 'auto') return raw;
  return 'auto';
}
