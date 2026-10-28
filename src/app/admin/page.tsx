import type { Metadata } from 'next';
import { OverviewPanel } from '@/components/admin/OverviewPanel';

export const metadata: Metadata = { title: 'نمای کلی | مدیریت کندلو' };

export default function AdminHomePage() {
  return <OverviewPanel />;
}
