export interface PracticeLog {
  readonly totalMs: number;
  readonly days: Readonly<Record<string, number>>;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^bt[a-z0-9]{4,40}$/;

/** One visible-page sample. The clock flushes about every five seconds. */
export const MAX_PRACTICE_TICK_MS = 60_000;
/** A browser may upload the time it already counted, once, up to two days. */
export const MAX_PRACTICE_IMPORT_MS = 48 * 60 * 60 * 1000;

/** Keeps only well-formed session rows. Day totals are the source of the sum. */
export function sanitizePracticeImport(raw: unknown): Record<string, PracticeLog> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, PracticeLog> = {};
  for (const [id, row] of Object.entries(raw).slice(0, 100)) {
    if (!ID_RE.test(id) || !row || typeof row !== 'object') continue;
    const daysIn = (row as { days?: unknown }).days;
    if (!daysIn || typeof daysIn !== 'object') continue;
    const days: Record<string, number> = {};
    let sum = 0;
    for (const [day, ms] of Object.entries(daysIn)) {
      if (!DAY_RE.test(day) || typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) continue;
      const rounded = Math.min(MAX_PRACTICE_IMPORT_MS, Math.round(ms));
      days[day] = rounded;
      sum += rounded;
    }
    if (sum <= 0 || sum > MAX_PRACTICE_IMPORT_MS) continue;
    out[id] = { totalMs: sum, days };
  }
  return out;
}
