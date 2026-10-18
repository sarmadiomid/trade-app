import type { Metadata } from 'next';
import { BacktestAnalyticsClient } from '@/components/backtest/BacktestClient';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'عملکرد بک‌تست | چارتیکس' };

export default async function BacktestAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/backtest/${id}/analytics`);
  return <BacktestAnalyticsClient id={id} />;
}
