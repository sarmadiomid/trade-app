import 'server-only';
import type { NextRequest } from 'next/server';
import { json, readJson, requestUser, sameOrigin } from '../http';
import { BattleError, type Player } from './service';

type Handler = (
  player: Player & { readonly id: string },
  body: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Shared plumbing of the battle API: same-origin check for writes, the signed-in user,
 * the JSON body and error mapping (BattleError → its status, anything else → 500).
 */
export async function battleRoute(req: NextRequest, handler: Handler): Promise<Response> {
  const write = req.method !== 'GET';
  if (write && !sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    let body: Record<string, unknown> = {};
    if (write && req.headers.get('content-length') !== '0') {
      try {
        body = ((await readJson(req, 16 * 1024)) ?? {}) as Record<string, unknown>;
      } catch {
        if (req.method !== 'DELETE') return json({ error: 'Invalid JSON' }, 400);
      }
    }
    return json(await handler({ _id: user._id, id: user.id, name: user.name }, body));
  } catch (e) {
    if (e instanceof BattleError) return json({ error: e.message }, e.status);
    console.error('[battles]', e);
    return json({ error: 'Server error' }, 500);
  }
}
