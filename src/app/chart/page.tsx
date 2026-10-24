import type { Metadata } from 'next';
import { UserChart } from '@/components/platform/UserChart';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'نمودار | Candelo' };

export default async function ChartPage() {
  const user = await requireUser('/chart');
  return <UserChart phone={user.phone} />;
}
