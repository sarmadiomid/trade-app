import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SupportDesk } from '@/components/home/SupportDesk';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'پشتیبانی | Candelo' };

export default async function SupportPage() {
  const user = await requireUser('/home/support');
  return (
    <Suspense fallback={null}>
      <SupportDesk user={{ id: user.id, name: user.name, phone: user.phone }} />
    </Suspense>
  );
}
