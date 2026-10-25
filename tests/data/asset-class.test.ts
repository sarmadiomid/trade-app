import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, assetClassOf } from '@/lib/data';

describe('assetClassOf', () => {
  it('sorts the backtest catalogue into market categories', () => {
    expect(assetClassOf('XAUUSD')).toBe('metals');
    expect(assetClassOf('EURUSD')).toBe('forex');
    expect(assetClassOf('GBPUSD')).toBe('forex');
    expect(assetClassOf('AUDUSD')).toBe('forex');
    expect(assetClassOf('NAS100')).toBe('indices');
    expect(assetClassOf('BTCUSDT')).toBe('crypto');
  });

  it('classifies every listed instrument', () => {
    const classes = INSTRUMENTS.map((item) => assetClassOf(item.symbol));
    expect(classes).toEqual(['metals', 'forex', 'forex', 'forex', 'indices']);
  });
});
