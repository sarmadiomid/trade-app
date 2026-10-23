/** Analytics of one session, inside the home shell on the آمار tab. */
export function statsHref(id: string): string {
  return `/home/stats/${encodeURIComponent(id)}`;
}
