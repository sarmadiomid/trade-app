import { NextResponse, type NextRequest } from 'next/server';
import { isAdminPhone } from '@/server/admin-http';
import { json, requestUser } from '@/server/http';
import { readStaffSupportFile } from '@/server/support';

type Ctx = { params: Promise<{ id: string }> };

/** Streams one attachment for staff. Admins only — not the ticket owner route. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!isAdminPhone(user.phone)) return json({ error: 'Forbidden' }, 403);
    const { id } = await params;
    const file = await readStaffSupportFile(id);
    if (!file) return json({ error: 'Ticket not found' }, 404);
    const encoded = encodeURIComponent(file.name);
    const ascii = file.name.replace(/[^\x20-\x7e]/g, '_');
    return new NextResponse(Buffer.from(file.data), {
      headers: {
        'Content-Type': file.type,
        'Content-Length': String(file.data.byteLength),
        'Content-Disposition': `${file.image ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[admin-support]', error);
    return json({ error: 'Server error' }, 500);
  }
}
