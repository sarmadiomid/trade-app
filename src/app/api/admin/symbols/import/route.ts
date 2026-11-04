import type { NextRequest } from 'next/server';
import { withAdmin } from '@/server/admin-http';
import { importInstruments } from '@/server/symbols';

/** Bulk upsert of instrument specs. Body: { instruments: InstrumentDraft[] }. */
export async function POST(req: NextRequest) {
  return withAdmin(
    req,
    async (_user, body) => {
      const result = await importInstruments(body.instruments);
      return result;
    },
    1024 * 1024,
  );
}
