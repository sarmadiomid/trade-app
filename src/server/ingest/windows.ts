import type { InstrumentDoc } from '../db';
import { ingestConfig } from './config';

export type IngestMode = 'bootstrap' | 'refresh';

export function needsBootstrap(doc: InstrumentDoc): boolean {
  if (!doc.dukascopyId) return false;
  if (!doc.ingest || doc.ingest.bootstrappedAt === null) return true;
  if (doc.barCount <= 0 || doc.dataEnd === null) return true;
  return false;
}

export function windowFor(
  doc: InstrumentDoc,
  mode: IngestMode,
  now = Date.now(),
): { from: number; to: number } {
  const to = now;
  if (mode === 'bootstrap') {
    return { from: to - ingestConfig.bootstrapWindowMs, to };
  }
  const end = doc.dataEnd ?? to;
  return { from: Math.max(0, end - ingestConfig.overlapMs), to };
}
