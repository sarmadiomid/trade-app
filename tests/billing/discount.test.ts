import { describe, expect, it } from 'vitest';
import {
  discountOff,
  discountRejectionMessage,
  normalizeDiscountCode,
  parseDiscountCatalog,
  quoteDiscount,
  type DiscountRule,
} from '@/lib/app/billing/discount';

const NOW = Date.parse('2026-06-01T00:00:00.000Z');

function rule(patch: Partial<DiscountRule> = {}): DiscountRule {
  return {
    kind: 'percent',
    value: 20,
    plans: [],
    cycles: [],
    active: true,
    expiresAt: null,
    maxUses: null,
    used: 0,
    perUser: 1,
    userUses: 0,
    label: '',
    ...patch,
  };
}

describe('normalizeDiscountCode', () => {
  it('folds case, spaces and Persian digits', () => {
    expect(normalizeDiscountCode('  welcome۲۰  ')).toBe('WELCOME20');
    expect(normalizeDiscountCode('off-10')).toBe('OFF-10');
  });

  it('rejects blank, symbols and over-long text', () => {
    expect(normalizeDiscountCode('   ')).toBeNull();
    expect(normalizeDiscountCode('تخفیف')).toBeNull();
    expect(normalizeDiscountCode('A'.repeat(33))).toBeNull();
  });
});

describe('discountOff', () => {
  it('rounds a percent and caps a fixed amount at the subtotal', () => {
    expect(discountOff(199_000, 'percent', 10)).toBe(19_900);
    expect(discountOff(199_000, 'percent', 15)).toBe(29_850);
    expect(discountOff(50_000, 'fixed', 80_000)).toBe(50_000);
    expect(discountOff(199_000, 'percent', 100)).toBe(199_000);
  });
});

describe('quoteDiscount', () => {
  it('prices a percent code', () => {
    const result = quoteDiscount({
      code: 'welcome20',
      rule: rule({ label: 'تخفیف خوش‌آمد' }),
      subtotal: 399_000,
      planId: 'pro',
      cycle: 'month',
      now: NOW,
    });
    expect(result).toEqual({
      ok: true,
      quote: {
        code: 'WELCOME20',
        kind: 'percent',
        value: 20,
        label: 'تخفیف خوش‌آمد',
        subtotal: 399_000,
        discount: 79_800,
        total: 319_200,
      },
    });
  });

  it('rejects for the first matching reason', () => {
    const base = {
      code: 'OFF',
      subtotal: 199_000,
      planId: 'mid' as const,
      cycle: 'month' as const,
      now: NOW,
    };
    expect(quoteDiscount({ ...base, code: '  ', rule: rule() }).ok).toBe(false);
    expect(quoteDiscount({ ...base, rule: null })).toEqual({ ok: false, reason: 'invalid' });
    expect(quoteDiscount({ ...base, rule: rule({ active: false, expiresAt: NOW - 1 }) })).toEqual({
      ok: false,
      reason: 'inactive',
    });
    expect(quoteDiscount({ ...base, rule: rule({ expiresAt: NOW }) })).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(quoteDiscount({ ...base, rule: rule({ plans: ['pro'] }) })).toEqual({
      ok: false,
      reason: 'plan',
    });
    expect(quoteDiscount({ ...base, rule: rule({ cycles: ['year'] }) })).toEqual({
      ok: false,
      reason: 'cycle',
    });
    expect(quoteDiscount({ ...base, rule: rule({ maxUses: 2, used: 2 }) })).toEqual({
      ok: false,
      reason: 'exhausted',
    });
    expect(quoteDiscount({ ...base, rule: rule({ perUser: 1, userUses: 1 }) })).toEqual({
      ok: false,
      reason: 'used',
    });
    expect(discountRejectionMessage('used')).toBe('این کد تخفیف معتبر نیست');
    expect(discountRejectionMessage('empty')).toBe('کد تخفیف را وارد کنید');
  });

  it('allows a code with no plan or cycle limit, up to the last unused slot', () => {
    const open = quoteDiscount({
      code: 'YEAR',
      rule: rule({ kind: 'fixed', value: 50_000, plans: [], cycles: [], maxUses: 3, used: 2 }),
      subtotal: 199_000 * 12,
      planId: 'mid',
      cycle: 'year',
      now: NOW,
    });
    expect(open.ok).toBe(true);
    if (open.ok) expect(open.quote.total).toBe(199_000 * 12 - 50_000);
  });
});

describe('parseDiscountCatalog', () => {
  it('parses a JSON catalog and keeps the last copy of a code', () => {
    const parsed = parseDiscountCatalog(
      JSON.stringify([
        { code: 'off10', kind: 'percent', value: 10 },
        { code: 'OFF10', kind: 'percent', value: 15, plans: ['pro'], label: '  پرو  ' },
        { code: 'nope', kind: 'percent', value: 0 },
      ]),
    );
    expect(parsed.error).toBe('1 discount code skipped');
    expect(parsed.codes).toEqual([
      {
        code: 'OFF10',
        kind: 'percent',
        value: 15,
        plans: ['pro'],
        cycles: [],
        active: true,
        expiresAt: null,
        maxUses: null,
        perUser: null,
        label: 'پرو',
      },
    ]);
  });

  it('reports a catalog that is not a JSON array and ignores an empty one', () => {
    expect(parseDiscountCatalog('{"code":"X"}').error).toBe('DISCOUNT_CODES must be a JSON array');
    expect(parseDiscountCatalog(undefined)).toEqual({ codes: [], error: null });
    expect(parseDiscountCatalog('not json').error).toBe('DISCOUNT_CODES is not valid JSON');
  });
});
