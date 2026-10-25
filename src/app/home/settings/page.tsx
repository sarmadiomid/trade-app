import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountSettings } from '@/components/home/AccountSettings';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'تنظیمات حساب | Candelo' };

export default async function SettingsPage() {
  const user = await requireUser('/home/settings');
  return (
    <Suspense fallback={null}>
      <AccountSettings user={{ id: user.id, name: user.name, phone: user.phone }} />
    </Suspense>
  );
}
