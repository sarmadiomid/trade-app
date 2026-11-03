/** Shared env knobs for the Dukascopy bootstrap + refresh worker. */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const YEAR_MS = 365.25 * DAY_MS;

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const ingestConfig = {
  bootstrapYears: intEnv('INGEST_BOOTSTRAP_YEARS', 3),
  intervalMs: intEnv('INGEST_INTERVAL_MS', 12 * HOUR_MS),
  overlapMs: intEnv('INGEST_OVERLAP_MS', 48 * HOUR_MS),
  cachePath: process.env.DUKASCOPY_CACHE_PATH?.trim() || '.dukascopy-cache',
  lockStaleMs: intEnv('INGEST_LOCK_STALE_MS', 6 * HOUR_MS),
  pauseBetweenSymbolsMs: intEnv('INGEST_SYMBOL_PAUSE_MS', 2_000),
  pauseBetweenTimeframesMs: intEnv('INGEST_TF_PAUSE_MS', 1_000),
  get bootstrapWindowMs() {
    return this.bootstrapYears * YEAR_MS;
  },
} as const;
