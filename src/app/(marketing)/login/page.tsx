import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginView } from '@/components/marketing/LoginView';
import { currentUser } from '@/server/auth';

export const metadata: Metadata = { title: 'ورود / ثبت‌نام | چارتیکس' };

/** Only same-site relative paths are allowed as the post-login destination. */
function safeNext(next: string | string[] | undefined): string {
  const v = Array.isArray(next) ? next[0] : next;
  return v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/chart';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return <LoginView next={next} />;
}
