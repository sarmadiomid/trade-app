import type { NextRequest } from 'next/server';
import { withAdmin } from '@/server/admin-http';
import { botStatus, setBotConfig } from '@/server/battles/bots';

/** Bot presence: GET the effective config and live numbers, PATCH an override. */
export async function GET(req: NextRequest) {
  return withAdmin(req, () => botStatus());
}

export async function PATCH(req: NextRequest) {
  return withAdmin(req, async (_user, body) => {
    await setBotConfig(body);
    return botStatus();
  });
}
