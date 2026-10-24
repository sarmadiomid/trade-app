import type { Metadata } from 'next';
import { SessionAnalytics } from '@/components/home/SessionAnalytics';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'آمار جلسه | Candelo' };

/** Session analytics inside the home shell (sidebar and top bar stay). */
export default async function HomeSessionStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/home/stats/${id}`);
  return (
    <SessionAnalytics user={{ id: user.id, name: user.name, phone: user.phone }} sessionId={id} />
  );
}
