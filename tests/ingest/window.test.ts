import { describe, expect, it } from 'vitest';
import type { InstrumentDoc } from '@/server/db';
import { needsBootstrap, windowFor } from '@/server/ingest/windows';

function doc(partial: Partial<InstrumentDoc> & Pick<InstrumentDoc, '_id'>): InstrumentDoc {
  return {
    description: 'Test',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    assetClass: 'forex',
    hours: 'forex',
    tickSize: 0.00001,
    pipSize: 0.0001,
    contractSize: 100_000,
    lotMin: 0.01,
    lotStep: 0.01,
    lotMax: 100,
    defaultSpread: 0.0001,
    defaultCommissionPerLot: 0,
    active: true,
    dukascopyId: 'eurusd',
    ingest: null,
    timeframe: '1m',
    barCount: 0,
    dataStart: null,
    dataEnd: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  };
}

describe('dukascopy ingest windows', () => {
  it('flags symbols without bootstrappedAt', () => {
    expect(needsBootstrap(doc({ _id: 'EURUSD' }))).toBe(true);
    expect(
      needsBootstrap(
        doc({
          _id: 'EURUSD',
          barCount: 10,
          dataEnd: 1,
          ingest: {
            enabled: true,
            bootstrappedAt: new Date('2024-01-01'),
            lastRunAt: null,
            lastSuccessAt: null,
            lastError: null,
            lastFrom: null,
            lastTo: null,
            lastBarCount: null,
          },
        }),
      ),
    ).toBe(false);
  });

  it('uses 3y for bootstrap and overlap for refresh', () => {
    const now = Date.UTC(2026, 0, 1);
    const boot = windowFor(doc({ _id: 'EURUSD' }), 'bootstrap', now);
    expect(boot.to).toBe(now);
    expect(boot.from).toBeLessThan(now - 2.9 * 365.25 * 24 * 60 * 60 * 1000);

    const end = Date.UTC(2025, 11, 1);
    const refresh = windowFor(
      doc({
        _id: 'EURUSD',
        dataEnd: end,
        barCount: 100,
        ingest: {
          enabled: true,
          bootstrappedAt: new Date('2025-01-01'),
          lastRunAt: null,
          lastSuccessAt: null,
          lastError: null,
          lastFrom: null,
          lastTo: null,
          lastBarCount: null,
        },
      }),
      'refresh',
      now,
    );
    expect(refresh.to).toBe(now);
    expect(refresh.from).toBe(end - 48 * 60 * 60 * 1000);
  });
});
