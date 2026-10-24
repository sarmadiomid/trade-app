import type { Metadata } from 'next';
import { BattleRoomClient } from '@/components/battles/BattleClient';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'نبرد | Candelo' };

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/battle/${id}`);
  return <BattleRoomClient id={id} user={{ id: user.id, name: user.name, phone: user.phone }} />;
}
