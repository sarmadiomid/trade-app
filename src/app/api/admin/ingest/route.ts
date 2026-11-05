import type { NextRequest } from 'next/server';
import { withAdmin } from '@/server/admin-http';
import { getIngestFleetSnapshot } from '@/server/ingest/admin';

/** Fleet snapshot for the Symbols admin ingest strip. */
export async function GET(req: NextRequest) {
  return withAdmin(req, async () => getIngestFleetSnapshot());
}
