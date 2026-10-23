import type { Metadata } from 'next';
import { LearnSoon } from '@/components/home/LearnSoon';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'آموزش | چارتیکس' };

export default async function LearnPage() {
  const user = await requireUser('/home/learn');
  return <LearnSoon user={{ id: user.id, name: user.name, phone: user.phone }} />;
}
