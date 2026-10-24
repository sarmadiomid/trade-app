import type { Metadata } from 'next';
import { SessionJournal } from '@/components/home/SessionJournal';
import { requireUser } from '@/server/guard';

export const metadata: Metadata = { title: 'دفتر معاملات | Candelo' };

/** Session journal inside the home shell (sidebar and top bar stay). */
export default async function HomeJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/home/journal/${id}`);
  return (
    <SessionJournal user={{ id: user.id, name: user.name, phone: user.phone }} sessionId={id} />
  );
}
