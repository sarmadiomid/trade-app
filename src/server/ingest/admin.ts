import 'server-only';
import { hostname } from 'node:os';
import type { InstrumentDoc } from '../db';
import { collections } from '../db';
import { ingestPhase, manualIngestBlockReason } from '@/lib/ingest-status';
import { SymbolError } from '../symbols';
import { listIngestTargets, needsBootstrap } from './dukascopy';
import { getIngestLockSnapshot, runIngestPass, type RunOptions } from './run';

export interface IngestFleetError {
  readonly symbol: string;
  readonly lastError: string;
  readonly lastRunAt: number | null;
}

export interface IngestFleetRunning {
  readonly symbol: string;
  readonly runningSince: number;
}

export interface IngestFleetSnapshot {
  readonly lock: {
    readonly held: boolean;
    readonly stale: boolean;
    readonly holder: string | null;
    readonly at: number | null;
    readonly mode: string | null;
  };
  readonly counts: {
    readonly targets: number;
    readonly running: number;
    readonly errors: number;
    readonly pendingBootstrap: number;
    readonly ok: number;
  };
  readonly errors: readonly IngestFleetError[];
  readonly running: readonly IngestFleetRunning[];
}

export async function getIngestFleetSnapshot(): Promise<IngestFleetSnapshot> {
  const [lock, targets] = await Promise.all([getIngestLockSnapshot(), listIngestTargets()]);
  const errors: IngestFleetError[] = [];
  const running: IngestFleetRunning[] = [];
  let errorCount = 0;
  let pendingBootstrap = 0;
  let ok = 0;
  let runningCount = 0;

  for (const doc of targets) {
    const phase = phaseOf(doc);
    if (phase === 'running') {
      runningCount += 1;
      const since = doc.ingest?.runningSince?.getTime();
      if (since != null) running.push({ symbol: doc._id, runningSince: since });
    } else if (phase === 'error') {
      errorCount += 1;
      if (errors.length < 20) {
        errors.push({
          symbol: doc._id,
          lastError: doc.ingest?.lastError ?? '',
          lastRunAt: doc.ingest?.lastRunAt?.getTime() ?? null,
        });
      }
    } else if (phase === 'pending') {
      pendingBootstrap += 1;
    } else if (phase === 'ok') {
      ok += 1;
    }
  }

  return {
    lock: {
      held: lock.held,
      stale: lock.stale,
      holder: lock.holder,
      at: lock.at,
      mode: lock.mode,
    },
    counts: {
      targets: targets.length,
      running: runningCount,
      errors: errorCount,
      pendingBootstrap,
      ok,
    },
    errors,
    running,
  };
}

export type ManualIngestMode = 'auto' | 'bootstrap' | 'refresh';

export interface ManualIngestStart {
  readonly started: true;
  readonly symbol: string;
  readonly mode: ManualIngestMode;
}

/** Validate + kick off a background ingest pass for one symbol. */
export async function startManualIngest(
  symbolRaw: string,
  mode: ManualIngestMode = 'auto',
): Promise<ManualIngestStart> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) throw new SymbolError('نماد نامعتبر است', 400);

  const { instruments } = await collections();
  const doc = await instruments.findOne({ _id: symbol });
  const lock = await getIngestLockSnapshot();
  const blocked = manualIngestBlockReason(doc, lock);
  if (blocked) throw new SymbolError(blocked.message, blocked.status);

  const options: RunOptions = { mode, symbol };
  const holderHint = `admin:${hostname()}:${process.pid}`;
  console.warn(`[ingest] admin trigger ${mode} ${symbol} (${holderHint})`);
  void runIngestPass(options).then(
    (summary) => {
      if (summary.skippedLock) {
        console.warn(`[ingest] admin trigger skipped lock for ${symbol}`);
        return;
      }
      const failed = summary.results.filter((r) => !r.ok);
      if (failed.length > 0) {
        console.error(
          `[ingest] admin trigger fail ${symbol}: ${failed.map((r) => r.error).join('; ')}`,
        );
      } else {
        console.warn(`[ingest] admin trigger done ${symbol}`);
      }
    },
    (err) => {
      console.error(`[ingest] admin trigger crashed ${symbol}`, err);
    },
  );

  return { started: true, symbol, mode };
}

function phaseOf(doc: InstrumentDoc) {
  return ingestPhase({
    dukascopyId: doc.dukascopyId,
    bootstrapped: !needsBootstrap(doc),
    runningSince: doc.ingest?.runningSince?.getTime() ?? null,
    lastError: doc.ingest?.lastError ?? null,
    enabled: doc.ingest?.enabled !== false,
  });
}
