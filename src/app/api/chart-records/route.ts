import type { NextRequest } from 'next/server';
import { chartRecordDenial } from '@/lib/app';
import { planOf } from '@/server/billing';
import { collections } from '@/server/db';
import { json, readJson, requestUser, sameOrigin } from '@/server/http';

const MAX_RECORD_BYTES = 4 * 1024 * 1024;
const KEY_RE = /^[\w:.\-]{1,200}$/;

/** Every chart record of the signed-in user: `{ records: { [key]: value } }`. */
export async function GET(req: NextRequest) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { chartRecords } = await collections();
    const docs = await chartRecords
      .find({ userId: user._id }, { projection: { _id: 0, key: 1, value: 1 } })
      .toArray();
    return json({ records: Object.fromEntries(docs.map((d) => [d.key, d.value])) });
  } catch (e) {
    console.error('[chart-records] load failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

/** Upserts one record: `{ key, value }`. */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  let body: { key?: unknown; value?: unknown } | null;
  try {
    body = (await readJson(req, MAX_RECORD_BYTES)) as typeof body;
  } catch (e) {
    return json({ error: e instanceof RangeError ? e.message : 'Invalid JSON' }, e instanceof RangeError ? 413 : 400);
  }
  const key = body?.key;
  if (typeof key !== 'string' || !KEY_RE.test(key)) return json({ error: 'Invalid key' }, 400);
  if (body?.value === undefined) return json({ error: 'Missing value' }, 400);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { chartRecords } = await collections();
    const previous = await chartRecords.findOne(
      { userId: user._id, key },
      { projection: { value: 1 } },
    );
    const denial = chartRecordDenial(await planOf(user._id), key, body.value, previous?.value);
    if (denial) return json({ error: denial }, 403);
    await chartRecords.updateOne(
      { userId: user._id, key },
      { $set: { value: body.value, updatedAt: new Date() } },
      { upsert: true },
    );
    return json({ ok: true });
  } catch (e) {
    console.error('[chart-records] save failed', e);
    return json({ error: 'Server error' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const key = req.nextUrl.searchParams.get('key');
  if (!key || !KEY_RE.test(key)) return json({ error: 'Invalid key' }, 400);
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { chartRecords } = await collections();
    await chartRecords.deleteOne({ userId: user._id, key });
    return json({ ok: true });
  } catch (e) {
    console.error('[chart-records] delete failed', e);
    return json({ error: 'Server error' }, 500);
  }
}
