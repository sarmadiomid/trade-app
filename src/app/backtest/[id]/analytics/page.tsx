import { redirect } from 'next/navigation';
import { statsHref } from '@/components/home/stats-href';
import { requireUser } from '@/server/guard';

/** Old standalone URL. Analytics now lives on the home آمار tab. */
export default async function BacktestAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const next = statsHref(id);
  await requireUser(next);
  redirect(next);
}
