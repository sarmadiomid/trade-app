import type { Metadata } from 'next';
import { BacktestJournalClient } from '@/components/backtest/BacktestClient';

export const metadata: Metadata = { title: 'Backtest journal' };

export default async function BacktestJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BacktestJournalClient id={id} />;
}
