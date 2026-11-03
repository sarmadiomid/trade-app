import 'server-only';
import { hostname } from 'node:os';
import { collections } from '../db';
import { ingestConfig } from './config';
import {
  ingestSymbol,
  listIngestTargets,
  needsBootstrap,
  type IngestMode,
  type IngestSymbolResult,
} from './dukascopy';

const LOCK_ID = 'dukascopy';

export interface RunOptions {
  readonly mode?: 'auto' | IngestMode;
  readonly symbol?: string;
  readonly once?: boolean;
}

export interface RunSummary {
  readonly results: readonly IngestSymbolResult[];
  readonly skippedLock: boolean;
}

/** One pass: bootstrap anything pending, then refresh the rest (or a forced mode). */
export async function runIngestPass(options: RunOptions = {}): Promise<RunSummary> {
  const holder = `${hostname()}:${process.pid}`;
  const modeLabel = options.mode ?? 'auto';
  const locked = await acquireLock(holder, modeLabel);
  if (!locked) {
    console.warn('[ingest] another worker holds the lock; skipping this pass');
    return { results: [], skippedLock: true };
  }

  try {
    let targets = await listIngestTargets();
    if (options.symbol) {
      const key = options.symbol.trim().toUpperCase();
      targets = targets.filter((doc) => doc._id === key);
      if (targets.length === 0) {
        console.warn(`[ingest] no active Dukascopy target for ${key}`);
      }
    }

    const results: IngestSymbolResult[] = [];
    for (const doc of targets) {
      const mode: IngestMode =
        options.mode === 'bootstrap' || options.mode === 'refresh'
          ? options.mode
          : needsBootstrap(doc)
            ? 'bootstrap'
            : 'refresh';

      console.warn(
        `[ingest] ${mode} ${doc._id} (${doc.dukascopyId})…`,
      );
      const result = await ingestSymbol(doc, mode);
      results.push(result);
      if (result.ok) {
        const tfSummary = result.byTimeframe
          ? Object.entries(result.byTimeframe)
              .map(([tf, n]) => `${tf}=${n}`)
              .join(' ')
          : '';
        console.warn(
          `[ingest] ok ${doc._id}: ${result.bars} bars ${new Date(result.from).toISOString()} → ${new Date(result.to).toISOString()}${tfSummary ? ` (${tfSummary})` : ''}`,
        );
      } else {
        console.error(`[ingest] fail ${doc._id}: ${result.error}`);
      }

      if (ingestConfig.pauseBetweenSymbolsMs > 0) {
        await sleep(ingestConfig.pauseBetweenSymbolsMs);
      }
    }
    return { results, skippedLock: false };
  } finally {
    await releaseLock(holder);
  }
}

/** Long-running worker: drain bootstraps, refresh, sleep 12h, repeat. */
export async function runIngestLoop(): Promise<never> {
  console.warn(
    `[ingest] loop start (bootstrapYears=${ingestConfig.bootstrapYears}, intervalMs=${ingestConfig.intervalMs}, cache=${ingestConfig.cachePath})`,
  );
  for (;;) {
    const started = Date.now();
    try {
      const summary = await runIngestPass({ mode: 'auto' });
      const failed = summary.results.filter((r) => !r.ok).length;
      const ok = summary.results.filter((r) => r.ok).length;
      console.warn(
        `[ingest] pass done ok=${ok} failed=${failed} skippedLock=${summary.skippedLock}`,
      );
    } catch (err) {
      console.error('[ingest] pass crashed', err);
    }
    const elapsed = Date.now() - started;
    const wait = Math.max(5_000, ingestConfig.intervalMs - elapsed);
    console.warn(`[ingest] sleeping ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }
}

async function acquireLock(holder: string, mode: string): Promise<boolean> {
  const { ingestLocks } = await collections();
  const now = new Date();
  await ingestLocks.deleteOne({
    _id: LOCK_ID,
    at: { $lt: new Date(now.getTime() - ingestConfig.lockStaleMs) },
  });
  try {
    await ingestLocks.insertOne({ _id: LOCK_ID, holder, at: now, mode });
    return true;
  } catch {
    return false;
  }
}

async function releaseLock(holder: string): Promise<void> {
  const { ingestLocks } = await collections();
  await ingestLocks.deleteOne({ _id: LOCK_ID, holder });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
