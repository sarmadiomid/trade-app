import { redirect } from 'next/navigation';
import { journalHref } from '@/components/home/journal-href';
import { requireUser } from '@/server/guard';

/** Old standalone URL. The journal now lives in the home shell. */
export default async function BacktestJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const next = journalHref(id);
  await requireUser(next);
  redirect(next);
}
