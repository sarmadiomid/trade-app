import type { Metadata } from 'next';
import ChartClient from '@/components/chart/ChartClient';

/**
 * Lessons shell is still client-rendered (empty to crawlers).
 * Keep noindex until SSR lesson content ships (Phase 3).
 */
export const metadata: Metadata = {
  title: 'آموزش | Candelo',
  description: 'درس‌های تمرین معامله در Candelo',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ChartClient />;
}
