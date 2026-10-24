/** Trade journal of one session, inside the home shell on the معاملات tab. */
export function journalHref(id: string): string {
  return `/home/journal/${encodeURIComponent(id)}`;
}
