import type { Metadata } from 'next';
import { BacktestSessionsClient } from '@/components/backtest/BacktestClient';

export const metadata: Metadata = { title: 'Backtesting sessions' };

export default function BacktestPage() {
  return <BacktestSessionsClient />;
}
