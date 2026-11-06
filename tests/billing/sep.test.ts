import { describe, expect, it } from 'vitest';
import {
  checkoutCharge,
  isPaymentRedirect,
  isSepRefNum,
  isSepStateOk,
  isSepTerminalId,
  isSepToken,
  parseSepReturn,
  parseSepToken,
  parseSepVerify,
  sepCallbackTokenMatches,
  sepCellNumber,
  sepSendTokenUrl,
  tomanToRial,
} from '@/lib/app/billing/gateway';

describe('sep token parsing', () => {
  it('accepts a successful token', () => {
    expect(
      parseSepToken({
        status: 1,
        token: '2c3c1fefac5a48geb9f9be7e445dd9b2',
      }),
    ).toEqual({
      ok: true,
      token: '2c3c1fefac5a48geb9f9be7e445dd9b2',
    });
  });

  it('reads token errors', () => {
    expect(
      parseSepToken({
        status: -1,
        errorCode: '5',
        errorDesc: 'پارامترهای ارسال شده نامعتبر است.; شماره تراکنش پذیرنده الزامی است.',
      }),
    ).toMatchObject({
      ok: false,
      code: '5',
      message: 'پارامترهای ارسال شده نامعتبر است.; شماره تراکنش پذیرنده الزامی است.',
    });

    expect(parseSepToken({ status: -1, errorCode: '8' })).toMatchObject({
      ok: false,
      code: '8',
      message: 'آدرس سرور پذیرنده نزد سپ ثبت نشده است',
    });
  });

  it('rejects an unsafe token', () => {
    expect(parseSepToken({ status: 1, token: '../OnlinePG/evil' }).ok).toBe(false);
    expect(isSepToken('short')).toBe(false);
    expect(isSepToken('2c3c1fefac5a48geb9f9be7e445dd9b2')).toBe(true);
  });
});

describe('sep verify parsing', () => {
  it('treats the first verify and a repeated verify as parse success', () => {
    expect(
      parseSepVerify({
        TransactionDetail: {
          RRN: '14226761817',
          RefNum: 'jJnBmy/IojtTemplUH5ke9ULCGtDtb',
          MaskedPan: '621986****8080',
          HashedPan: 'b96a14400c3a59249e87c300ecc06e5920327e70220213b5bbb7d7b2410f7e0d',
          TerminalNumber: 2001,
          OrginalAmount: 1990000,
          AffectiveAmount: 1990000,
          StraceDate: '2019-09-16 18:11:06',
          StraceNo: '100428',
        },
        ResultCode: 0,
        ResultDescription: 'عملیات با موفقیت انجام شد',
        Success: true,
      }),
    ).toMatchObject({
      ok: true,
      refNum: 'jJnBmy/IojtTemplUH5ke9ULCGtDtb',
      cardPan: '621986****8080',
      originalAmount: 1_990_000,
      affectiveAmount: 1_990_000,
      duplicate: false,
    });

    // ResultCode 2 is parse-ok; settlement must still bind it to the claiming order.
    expect(
      parseSepVerify({
        TransactionDetail: {
          RefNum: 'jJnBmy/IojtTemplUH5ke9ULCGtDtb',
          OrginalAmount: 1000,
          AffectiveAmount: 1000,
        },
        ResultCode: 2,
        Success: false,
      }),
    ).toMatchObject({ ok: true, duplicate: true, originalAmount: 1000 });
  });

  it('keeps a failed verify from looking successful', () => {
    expect(parseSepVerify({ ResultCode: -2, Success: false })).toMatchObject({
      ok: false,
      code: -2,
      message: 'تراکنش نزد سپ یافت نشد',
    });
    expect(parseSepVerify({ ResultCode: -6, Success: false })).toMatchObject({
      ok: false,
      code: -6,
    });
  });
});

describe('sep return and charge helpers', () => {
  it('parses callback fields case-sensitively', () => {
    expect(
      parseSepReturn({
        State: 'OK',
        Status: '2',
        RefNum: 'jJnBmy/IojtTemplUH5ke9ULCGtDtb',
        ResNum: '67f1a2b3c4d5e6f708091011',
        Amount: '1990000',
        SecurePan: '621986****8080',
        TraceNo: '100428',
        RRN: '14226761817',
        Token: '2c3c1fefac5a48geb9f9be7e445dd9b2',
      }),
    ).toMatchObject({
      state: 'OK',
      refNum: 'jJnBmy/IojtTemplUH5ke9ULCGtDtb',
      resNum: '67f1a2b3c4d5e6f708091011',
      securePan: '621986****8080',
    });
    expect(isSepStateOk('OK')).toBe(true);
    expect(isSepStateOk('CanceledByUser')).toBe(false);
  });

  it('converts toman to rials and shapes the mobile for SEP', () => {
    expect(tomanToRial(199_000)).toBe(1_990_000);
    expect(checkoutCharge('sep', 199_000)).toEqual({
      ok: true,
      kind: 'sep',
      amount: 199_000,
    });
    expect(sepCellNumber('09121234567')).toBe('9121234567');
    expect(sepCellNumber('9121234567')).toBe('9121234567');
    expect(isSepTerminalId('2015')).toBe(true);
    expect(isSepTerminalId('abc')).toBe(false);
    expect(isSepRefNum('jJnBmy/IojtTemplUH5ke9ULCGtDtb')).toBe(true);
  });

  it('allows only the SEP SendToken redirect', () => {
    const token = '2c3c1fefac5a48geb9f9be7e445dd9b2';
    expect(sepSendTokenUrl(token)).toBe(
      `https://sep.shaparak.ir/OnlinePG/SendToken?token=${token}`,
    );
    expect(isPaymentRedirect(`https://sep.shaparak.ir/OnlinePG/SendToken?token=${token}`)).toBe(
      true,
    );
    expect(isPaymentRedirect(`https://evil.example/OnlinePG/SendToken?token=${token}`)).toBe(
      false,
    );
    expect(sepSendTokenUrl('not safe')).toBeNull();
  });

  it('binds the callback token to the stored SEP authority', () => {
    const token = '2c3c1fefac5a48geb9f9be7e445dd9b2';
    expect(sepCallbackTokenMatches(token, token)).toBe(true);
    expect(sepCallbackTokenMatches(token, ` ${token} `)).toBe(true);
    expect(sepCallbackTokenMatches(token, '9c3c1fefac5a48geb9f9be7e445dd9b2')).toBe(false);
    expect(sepCallbackTokenMatches(token, '')).toBe(false);
    expect(sepCallbackTokenMatches('', token)).toBe(false);
    expect(sepCallbackTokenMatches('short', 'short')).toBe(false);
  });
});
