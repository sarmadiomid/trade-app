import type { Metadata } from 'next';
import { BacktestJournalClient } from '@/components/backtest/BacktestClient';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'Backtest journal' };

export default async function BacktestJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/backtest/${id}/journal`);
  return <BacktestJournalClient id={id} />;
}
