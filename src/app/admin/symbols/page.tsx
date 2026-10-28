import type { Metadata } from 'next';
import { SymbolsDesk } from '@/components/admin/SymbolsDesk';

export const metadata: Metadata = { title: 'نمادها | مدیریت کندلو' };

export default function SymbolsPage() {
  return <SymbolsDesk />;
}
