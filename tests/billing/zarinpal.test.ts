import { describe, expect, it } from 'vitest';
import {
  checkoutCharge,
  isPaymentRedirect,
  isZarinpalAuthority,
  isZarinpalMerchantId,
  parseZarinpalRequest,
  parseZarinpalVerify,
  paymentDescription,
  zarinpalErrorMessage,
  zarinpalStartPayUrl,
} from '@/lib/app/billing/gateway';

describe('zarinpal request parsing', () => {
  it('accepts a successful authority', () => {
    expect(
      parseZarinpalRequest({
        data: {
          code: 100,
          message: 'Success',
          authority: 'A0000000000000000000000000000wwOGYpd',
          fee_type: 'Merchant',
          fee: 100,
        },
        errors: [],
      }),
    ).toEqual({
      ok: true,
      authority: 'A0000000000000000000000000000wwOGYpd',
      fee: 100,
    });
  });

  it('reads an error object and an error list', () => {
    expect(
      parseZarinpalRequest({
        data: [],
        errors: { code: -9, message: 'The amount must be at least 1000.' },
      }),
    ).toMatchObject({ ok: false, code: -9, message: 'اطلاعات پرداخت ناقص است' });

    expect(
      parseZarinpalRequest({ data: {}, errors: [{ code: '-10', message: 'bad' }] }),
    ).toMatchObject({ ok: false, code: -10 });
  });

  it('rejects an authority that could change the payment path', () => {
    expect(
      parseZarinpalRequest({
        data: { code: 100, authority: '../pg/StartPay/evil', fee: 0 },
        errors: [],
      }).ok,
    ).toBe(false);
  });
});

describe('zarinpal verify parsing', () => {
  it('treats the first verify and a repeated verify as paid', () => {
    expect(
      parseZarinpalVerify({
        data: {
          code: 100,
          message: 'Verified',
          card_pan: '502229******5995',
          ref_id: 201,
          fee: 0,
        },
        errors: [],
      }),
    ).toMatchObject({ ok: true, code: 100, refId: '201', cardPan: '502229******5995' });

    expect(parseZarinpalVerify({ data: { code: 101, ref_id: '202' }, errors: [] })).toMatchObject({
      ok: true,
      code: 101,
      refId: '202',
    });
  });

  it('keeps a failed verify from looking successful', () => {
    expect(parseZarinpalVerify({ data: { code: -51 }, errors: [] })).toMatchObject({
      ok: false,
      code: -51,
      message: 'پرداخت ناموفق بود',
    });
  });
});

describe('checkout charge', () => {
  it('sends toman amounts to Zarinpal and skips the bank at zero', () => {
    expect(checkoutCharge('zarinpal', 199_000)).toEqual({
      ok: true,
      kind: 'zarinpal',
      amount: 199_000,
    });
    expect(checkoutCharge('zarinpal', 0)).toEqual({ ok: true, kind: 'free' });
  });

  it('refuses a tiny amount and the unfinished SEP gateway', () => {
    expect(checkoutCharge('zarinpal', 999).ok).toBe(false);
    expect(checkoutCharge('sep', 199_000)).toMatchObject({
      ok: false,
      error: 'درگاه سپ هنوز فعال نشده است',
    });
  });
});

describe('payment redirect', () => {
  it('allows the sandbox and live start pages, and the local receipt', () => {
    const authority = 'S0000000000000000000000000000wwOGYpd';
    expect(zarinpalStartPayUrl('sandbox', authority)).toBe(
      `https://sandbox.zarinpal.com/pg/StartPay/${authority}`,
    );
    expect(isPaymentRedirect(`https://payment.zarinpal.com/pg/StartPay/${authority}`)).toBe(true);
    expect(isPaymentRedirect('/home/checkout/result?payment=abc')).toBe(true);
    expect(isPaymentRedirect('https://evil.example/pg/StartPay/' + authority)).toBe(false);
    expect(zarinpalStartPayUrl('live', 'not safe')).toBeNull();
  });

  it('checks the merchant id shape', () => {
    expect(isZarinpalMerchantId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isZarinpalMerchantId('merchant')).toBe(false);
    expect(isZarinpalAuthority('A0000000000000000000000000000wwOGYpd')).toBe(true);
    expect(paymentDescription('متوسط', 'month')).toBe('خرید طرح متوسط ماهانه');
    expect(zarinpalErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
