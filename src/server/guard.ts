import 'server-only';
import { redirect } from 'next/navigation';
import { currentUser, type SessionUser } from './auth';

/**
 * The signed-in user of a page that requires one. Anyone else is sent to the login page,
 * which brings them back to `next` afterwards.
 */
export async function requireUser(next: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
