import type { Metadata } from 'next';
import { DiscountsDesk } from '@/components/admin/DiscountsDesk';

export const metadata: Metadata = { title: 'تخفیف‌ها | مدیریت کندلو' };

export default function DiscountsPage() {
  return <DiscountsDesk />;
}
