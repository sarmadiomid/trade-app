import type { Metadata } from 'next';
import { BacktestSessionsClient } from '@/components/backtest/BacktestClient';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'بک‌تست | Candelo' };

export default async function BacktestPage() {
  await requireUser('/backtest');
  return <BacktestSessionsClient />;
}
