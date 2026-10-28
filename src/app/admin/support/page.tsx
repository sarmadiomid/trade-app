import type { Metadata } from 'next';
import { StaffInbox } from '@/components/admin/StaffInbox';

export const metadata: Metadata = { title: 'پشتیبانی | مدیریت کندلو' };

export default async function SupportAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <StaffInbox initialId={id ?? null} />;
}
