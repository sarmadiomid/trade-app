/**
 * Pure helpers for admin ingest monitoring (shared by server + client).
 */

export type IngestPhase = 'running' | 'error' | 'pending' | 'ok' | 'idle';

export interface IngestPhaseInput {
  readonly dukascopyId: string | null | undefined;
  readonly bootstrapped: boolean;
  readonly runningSince: number | null | undefined;
  readonly lastError: string | null | undefined;
  readonly enabled?: boolean;
}

export function ingestPhase(input: IngestPhaseInput): IngestPhase {
  if (!input.dukascopyId) return 'idle';
  if (input.enabled === false) return 'idle';
  if (input.runningSince != null) return 'running';
  if (input.lastError) return 'error';
  if (!input.bootstrapped) return 'pending';
  return 'ok';
}

export interface ManualIngestBlock {
  readonly status: number;
  readonly message: string;
}

/** Returns a block reason for manual ingest, or null when the run may start. */
export function manualIngestBlockReason(
  doc: {
    readonly active: boolean;
    readonly dukascopyId: string | null;
    readonly ingest: { readonly enabled?: boolean } | null;
  } | null,
  lock: { readonly held: boolean; readonly stale: boolean },
): ManualIngestBlock | null {
  if (!doc || !doc.active) {
    return { status: 404, message: 'این نماد پیدا نشد' };
  }
  if (!doc.dukascopyId) {
    return { status: 400, message: 'این نماد شناسهٔ Dukascopy ندارد' };
  }
  if (doc.ingest?.enabled === false) {
    return { status: 400, message: 'همگام‌سازی Dukascopy برای این نماد غیرفعال است' };
  }
  if (lock.held && !lock.stale) {
    return {
      status: 409,
      message: 'همگام‌سازی دیگری در حال اجراست. کمی بعد دوباره تلاش کنید.',
    };
  }
  return null;
}
