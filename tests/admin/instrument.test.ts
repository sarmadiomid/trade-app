import { describe, expect, it } from 'vitest';
import { parseInstrumentDraft } from '@/lib/data';

const reserved = new Set(['XAUUSD']);

describe('parseInstrumentDraft', () => {
  it('accepts a forex contract', () => {
    const parsed = parseInstrumentDraft(
      {
        symbol: 'eurjpy',
        description: 'Euro / Yen',
        baseCurrency: 'eur',
        quoteCurrency: 'jpy',
        assetClass: 'forex',
        hours: 'forex',
        tickSize: 0.001,
        pipSize: 0.01,
        contractSize: 100000,
        lotMin: 0.01,
        lotStep: 0.01,
        lotMax: 50,
        defaultSpread: 0.01,
        defaultCommissionPerLot: 0,
      },
      reserved,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.symbol).toBe('EURJPY');
    expect(parsed.draft.baseCurrency).toBe('EUR');
  });

  it('refuses a built-in symbol', () => {
    const parsed = parseInstrumentDraft(
      {
        symbol: 'XAUUSD',
        description: 'Gold',
        baseCurrency: 'XAU',
        quoteCurrency: 'USD',
        assetClass: 'metals',
        hours: 'metals',
        tickSize: 0.01,
        pipSize: 0.1,
        contractSize: 100,
        lotMin: 0.01,
        lotStep: 0.01,
        lotMax: 100,
        defaultSpread: 0.2,
        defaultCommissionPerLot: 0,
      },
      reserved,
    );
    expect(parsed.ok).toBe(false);
  });
});
