import type { Metadata } from 'next';
import { UsersDesk } from '@/components/admin/UsersDesk';

export const metadata: Metadata = { title: 'کاربران | مدیریت کندلو' };

export default function UsersPage() {
  return <UsersDesk />;
}
