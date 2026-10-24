import type { NextRequest } from 'next/server';
import { activeBattleOf } from '@/server/battles/views';
import { collections } from '@/server/db';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

/** Wipes practice data and battle stats. Login, phone and display name stay. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = (await readJson(req, 1024)) as { confirm?: unknown };
    if (body?.confirm !== 'reset') return json({ error: 'تأیید نامعتبر است.' }, 400);
    const active = await activeBattleOf(user._id);
    if (active) {
      return json({ error: 'اول از نبرد جاری خارج شوید، بعد حساب را بازنشانی کنید.' }, 409);
    }
    const { chartRecords, battleProfiles, battleQueue, backtestSessions, positionEvents, backtestShots } =
      await collections();
    await Promise.all([
      chartRecords.deleteMany({ userId: user._id }),
      battleProfiles.deleteOne({ _id: user._id }),
      battleQueue.deleteOne({ _id: user._id }),
      backtestSessions.deleteMany({ userId: user._id }),
      positionEvents.deleteMany({ userId: user._id }),
      backtestShots.deleteMany({ userId: user._id }),
    ]);
    return json({ ok: true });
  } catch (e) {
    console.error('[account/reset]', e);
    return json({ error: 'بازنشانی انجام نشد.' }, 500);
  }
}
