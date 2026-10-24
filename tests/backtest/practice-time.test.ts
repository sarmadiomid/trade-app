import { describe, expect, it } from 'vitest';
import { sanitizePracticeImport } from '@/lib/backtest/session/practice';

describe('practice time import', () => {
  it('keeps a real session total and drops a forged one', () => {
    const clean = sanitizePracticeImport({
      bt1fijq9k1: { totalMs: 999_999, days: { '2026-10-24': 120_000 } },
      nope: { totalMs: 120_000, days: { '2026-10-24': 120_000 } },
      bt1fijq9k1x: { totalMs: 10, days: { yesterday: 50 * 60 * 60 * 1000 } },
    });
    expect(clean).toEqual({ bt1fijq9k1: { totalMs: 120_000, days: { '2026-10-24': 120_000 } } });
  });
});
