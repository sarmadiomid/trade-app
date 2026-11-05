import { describe, expect, it } from 'vitest';
import { ingestPhase, manualIngestBlockReason } from '@/lib/ingest-status';

describe('ingestPhase', () => {
  it('marks running ahead of error/pending', () => {
    expect(
      ingestPhase({
        dukascopyId: 'xagnzd',
        bootstrapped: false,
        runningSince: Date.now(),
        lastError: 'boom',
      }),
    ).toBe('running');
  });

  it('surfaces errors when not running', () => {
    expect(
      ingestPhase({
        dukascopyId: 'xagnzd',
        bootstrapped: true,
        runningSince: null,
        lastError: "Cannot read properties of undefined (reading '0')",
      }),
    ).toBe('error');
  });

  it('flags pending bootstrap', () => {
    expect(
      ingestPhase({
        dukascopyId: 'xagnzd',
        bootstrapped: false,
        runningSince: null,
        lastError: null,
      }),
    ).toBe('pending');
  });

  it('is ok when bootstrapped and clean', () => {
    expect(
      ingestPhase({
        dukascopyId: 'eurusd',
        bootstrapped: true,
        runningSince: null,
        lastError: null,
      }),
    ).toBe('ok');
  });

  it('is idle without dukascopy or when disabled', () => {
    expect(
      ingestPhase({
        dukascopyId: null,
        bootstrapped: false,
        runningSince: null,
        lastError: null,
      }),
    ).toBe('idle');
    expect(
      ingestPhase({
        dukascopyId: 'eurusd',
        bootstrapped: true,
        runningSince: null,
        lastError: null,
        enabled: false,
      }),
    ).toBe('idle');
  });
});

describe('manualIngestBlockReason', () => {
  const free = { held: false, stale: false };

  it('rejects missing symbol', () => {
    expect(manualIngestBlockReason(null, free)).toMatchObject({ status: 404 });
  });

  it('rejects missing dukascopyId', () => {
    expect(
      manualIngestBlockReason(
        { active: true, dukascopyId: null, ingest: { enabled: true } },
        free,
      ),
    ).toMatchObject({ status: 400, message: expect.stringMatching(/Dukascopy/) });
  });

  it('rejects when lock is held', () => {
    expect(
      manualIngestBlockReason(
        { active: true, dukascopyId: 'xagnzd', ingest: { enabled: true } },
        { held: true, stale: false },
      ),
    ).toMatchObject({ status: 409 });
  });

  it('allows stale lock', () => {
    expect(
      manualIngestBlockReason(
        { active: true, dukascopyId: 'xagnzd', ingest: { enabled: true } },
        { held: true, stale: true },
      ),
    ).toBeNull();
  });
});
