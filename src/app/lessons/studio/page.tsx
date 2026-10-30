import type { Metadata } from 'next';
import ChartClient from '@/components/chart/ChartClient';

/** Interactive lesson studio — client-only chart shell; keep out of the index. */
export const metadata: Metadata = {
  title: 'کارگاه درس | Candelo',
  description: 'ویرایشگر و پخش درس‌های نموداری Candelo',
  robots: { index: false, follow: false },
};

export default function LessonsStudioPage() {
  return <ChartClient />;
}
