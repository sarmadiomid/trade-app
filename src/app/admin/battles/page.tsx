import type { Metadata } from 'next';
import { BattlesDesk } from '@/components/admin/ActivityDesk';

export const metadata: Metadata = { title: 'نبردها | مدیریت کندلو' };

export default function BattlesPage() {
  return <BattlesDesk />;
}
