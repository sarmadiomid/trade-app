import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { UserChart } from '@/components/platform/UserChart';
import { currentUser } from '@/server/auth';

export const metadata: Metadata = { title: 'نمودار | چارتیکس' };

export default async function ChartPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/chart');
  return <UserChart phone={user.phone} />;
}
