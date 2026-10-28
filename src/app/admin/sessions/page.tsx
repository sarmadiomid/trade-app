import type { Metadata } from 'next';
import { SessionsDesk } from '@/components/admin/ActivityDesk';

export const metadata: Metadata = { title: 'تمرین‌ها | مدیریت کندلو' };

export default function SessionsAdminPage() {
  return <SessionsDesk />;
}
