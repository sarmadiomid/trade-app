import type { NextRequest } from 'next/server';
import { battleRoute } from '@/server/battles/http';
import { clearMatched, joinQueue, leaveQueue, pollQueue, startDuel } from '@/server/battles/queue';

/**
 * Ranked matchmaking: GET polls (and tries to pair), POST `{ format }` joins, POST
 * `{ format, duel: true }` accepts the unrated duel offered after a long search, DELETE leaves.
 */
export function GET(req: NextRequest) {
  return battleRoute(req, async (me) => {
    const s = await pollQueue(me);
    if (s.status === 'matched' && req.nextUrl.searchParams.get('ack') === '1')
      await clearMatched(me);
    return s;
  });
}

export function POST(req: NextRequest) {
  return battleRoute(req, (me, body) =>
    body.duel === true ? startDuel(me, body.format) : joinQueue(me, body.format),
  );
}

export function DELETE(req: NextRequest) {
  return battleRoute(req, (me) => leaveQueue(me));
}
