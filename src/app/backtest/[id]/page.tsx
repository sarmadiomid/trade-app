import type { Metadata } from 'next';
import { BacktestSessionClient } from '@/components/backtest/BacktestClient';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'جلسه بک‌تست | چارتیکس' };

export default async function BacktestSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/backtest/${id}`);
  return <BacktestSessionClient id={id} />;
}
