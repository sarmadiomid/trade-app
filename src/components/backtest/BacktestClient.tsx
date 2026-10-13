'use client';

import dynamic from 'next/dynamic';

const loading = () => <div className="h-full w-full bg-chart" />;

/** Client-only boundaries (canvas, IndexedDB): the backtest pages are never server-rendered. */
const Sessions = dynamic(() => import('./SessionsPage'), { ssr: false, loading });
const Session = dynamic(() => import('./BacktestSessionView'), { ssr: false, loading });
const Journal = dynamic(() => import('./JournalView'), { ssr: false, loading });
const Analytics = dynamic(() => import('./analytics/AnalyticsDashboard'), { ssr: false, loading });

export function BacktestSessionsClient() {
  return <Sessions />;
}

export function BacktestSessionClient({ id }: { readonly id: string }) {
  return <Session id={id} />;
}

export function BacktestJournalClient({ id }: { readonly id: string }) {
  return <Journal id={id} />;
}

export function BacktestAnalyticsClient({ id }: { readonly id: string }) {
  return <Analytics id={id} />;
}
