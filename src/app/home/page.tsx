import type { Metadata } from 'next';
import { HomeDashboard } from '@/components/home/HomeDashboard';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'Home | Chartix' };

export default async function HomePage() {
  const user = await requireUser('/home');
  return <HomeDashboard user={{ id: user.id, name: user.name, phone: user.phone }} />;
}
