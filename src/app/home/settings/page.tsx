import type { Metadata } from 'next';
import { AccountSettings } from '@/components/home/AccountSettings';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'تنظیمات حساب | چارتیکس' };

export default async function SettingsPage() {
  const user = await requireUser('/home/settings');
  return <AccountSettings user={{ id: user.id, name: user.name, phone: user.phone }} />;
}
