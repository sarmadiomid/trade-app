import type { Metadata } from 'next';
import { BattlesHubClient } from '@/components/battles/BattleClient';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'نبردها | چارتیکس' };

export default async function BattlesPage() {
  const user = await requireUser('/battle');
  return <BattlesHubClient user={{ id: user.id, name: user.name, phone: user.phone }} />;
}
