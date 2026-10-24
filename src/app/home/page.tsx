import type { Metadata } from 'next';
import { HomeDashboard } from '@/components/home/HomeDashboard';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'تمرین | Candelo' };

const TABS = ['sessions', 'trades', 'stats'] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; session?: string }>;
}) {
  const user = await requireUser('/home');
  const query = await searchParams;
  const initialTab = TABS.find((tab) => tab === query.tab) ?? 'dashboard';
  return (
    <HomeDashboard
      user={{ id: user.id, name: user.name, phone: user.phone }}
      initialTab={initialTab}
      sessionId={query.session ?? null}
    />
  );
}
