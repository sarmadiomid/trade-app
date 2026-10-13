import type { Metadata } from 'next';
import { BacktestAnalyticsClient } from '@/components/backtest/BacktestClient';

export const metadata: Metadata = { title: 'Backtest analytics' };

export default async function BacktestAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BacktestAnalyticsClient id={id} />;
}
