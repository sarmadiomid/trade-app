import type { NextRequest } from 'next/server';
import { postUserMessage, rawSupportFiles } from '@/server/support';
import { withSupport } from '@/server/support-http';

type Ctx = { params: Promise<{ id: string }> };

/** Adds the user's message. A closed ticket reopens. Body: `{ body }`. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withSupport(req, (user, body) =>
    postUserMessage(user, id, body.body, rawSupportFiles(body)),
  );
}
