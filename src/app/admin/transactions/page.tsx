import type { Metadata } from 'next';
import { TransactionsDesk } from '@/components/admin/TransactionsDesk';

export const metadata: Metadata = { title: 'تراکنش‌ها | مدیریت کندلو' };

export default function TransactionsPage() {
  return <TransactionsDesk />;
}
