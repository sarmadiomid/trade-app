import type { Metadata } from 'next';
import { BacktestSessionClient } from '@/components/backtest/BacktestClient';

export const metadata: Metadata = { title: 'Backtest session' };

export default async function BacktestSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BacktestSessionClient id={id} />;
}
