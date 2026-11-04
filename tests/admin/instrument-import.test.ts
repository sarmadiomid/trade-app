import { describe, expect, it } from 'vitest';
import {
  instrumentImportCsvTemplate,
  instrumentImportJsonTemplate,
  parseInstrumentCatalogFile,
} from '@/lib/data';

const reserved = new Set(['XAUUSD']);

describe('parseInstrumentCatalogFile', () => {
  it('parses the CSV template', () => {
    const preview = parseInstrumentCatalogFile(
      instrumentImportCsvTemplate(),
      'symbols.csv',
      reserved,
    );
    expect(preview.format).toBe('csv');
    expect(preview.issues).toHaveLength(0);
    expect(preview.ok).toHaveLength(2);
    expect(preview.ok[0]?.draft.symbol).toBe('EURJPY');
    expect(preview.ok[0]?.draft.dukascopyId).toBe('eurjpy');
  });

  it('parses the JSON template', () => {
    const preview = parseInstrumentCatalogFile(
      instrumentImportJsonTemplate(),
      'symbols.json',
      reserved,
    );
    expect(preview.format).toBe('json');
    expect(preview.issues).toHaveLength(0);
    expect(preview.ok).toHaveLength(2);
    expect(preview.ok.map((row) => row.draft.symbol)).toEqual(['EURJPY', 'USDJPY']);
  });

  it('rejects reserved builtins', () => {
    const preview = parseInstrumentCatalogFile(
      `symbol,description,baseCurrency,quoteCurrency,assetClass,hours,tickSize,pipSize,contractSize,lotMin,lotStep,lotMax,defaultSpread,defaultCommissionPerLot,active,dukascopyId
XAUUSD,Gold,XAU,USD,metals,metals,0.01,0.1,100,0.01,0.01,100,0.2,0,true,xauusd
`,
      'gold.csv',
      reserved,
    );
    expect(preview.ok).toHaveLength(0);
    expect(preview.issues[0]?.symbol).toBe('XAUUSD');
  });

  it('accepts { instruments: [...] } wrappers', () => {
    const preview = parseInstrumentCatalogFile(
      JSON.stringify({
        instruments: [
          {
            symbol: 'GBPUSD',
            description: 'Cable',
            baseCurrency: 'GBP',
            quoteCurrency: 'USD',
            assetClass: 'forex',
            hours: 'forex',
            tickSize: 0.00001,
            pipSize: 0.0001,
            contractSize: 100000,
            lotMin: 0.01,
            lotStep: 0.01,
            lotMax: 50,
            defaultSpread: 0.00012,
            defaultCommissionPerLot: 0,
            dukascopyId: 'gbpusd',
          },
        ],
      }),
      '',
      reserved,
    );
    expect(preview.ok).toHaveLength(1);
    expect(preview.issues).toHaveLength(0);
  });

  it('flags duplicate symbols inside the file', () => {
    const csv = `symbol,description,baseCurrency,quoteCurrency,assetClass,hours,tickSize,pipSize,contractSize,lotMin,lotStep,lotMax,defaultSpread,defaultCommissionPerLot,active,dukascopyId
EURUSD,Euro A,EUR,USD,forex,forex,0.00001,0.0001,100000,0.01,0.01,100,0.0001,0,true,eurusd
EURUSD,Euro B,EUR,USD,forex,forex,0.00001,0.0001,100000,0.01,0.01,100,0.0001,0,true,eurusd
`;
    const preview = parseInstrumentCatalogFile(csv, 'dup.csv', reserved);
    expect(preview.ok).toHaveLength(1);
    expect(preview.issues.some((issue) => issue.error.includes('تکراری'))).toBe(true);
  });

  it('requires the CSV header columns', () => {
    const preview = parseInstrumentCatalogFile('a,b,c\n1,2,3\n', 'bad.csv', reserved);
    expect(preview.ok).toHaveLength(0);
    expect(preview.issues[0]?.error).toMatch(/سرستون|ستون/);
  });
});
