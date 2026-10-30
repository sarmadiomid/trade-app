import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth';

/** Lightweight signed-in check for marketing CTAs (keeps the homepage cacheable). */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    { signedIn: user !== null },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
