import { describe, expect, it } from 'vitest';
import {
  checkSupportFile,
  parseNewTicket,
  parseSupportBody,
  subjectById,
  SUPPORT_BODY_MAX,
  SUPPORT_FILE_MAX_BYTES,
  SUPPORT_SUBJECTS,
  ticketHeading,
} from '@/lib/support/catalog';

describe('support subjects', () => {
  it('offers a custom-symbol request', () => {
    expect(SUPPORT_SUBJECTS.map((item) => item.id)).toContain('custom-symbol');
    expect(subjectById('custom-symbol')?.label).toBe('درخواست نماد دلخواه');
  });

  it('uses the subject label when the title is blank', () => {
    expect(ticketHeading({ title: '  ', subject: 'custom-symbol' })).toBe('درخواست نماد دلخواه');
    expect(ticketHeading({ title: 'نماد انس', subject: 'custom-symbol' })).toBe('نماد انس');
  });
});

describe('parseNewTicket', () => {
  it('requires a symbol only for a custom-symbol request', () => {
    expect(
      parseNewTicket({
        subject: 'custom-symbol',
        title: 'نماد جدید',
        symbol: '  ',
        body: 'لطفاً این نماد را اضافه کنید',
      }),
    ).toEqual({ ok: false, error: 'Symbol required' });
    expect(
      parseNewTicket({
        subject: 'billing',
        title: '   ',
        symbol: '',
        body: 'پرداخت انجام نشد.',
      }),
    ).toEqual({ ok: false, error: 'Title required' });

    expect(
      parseNewTicket({
        subject: 'custom-symbol',
        title: 'نماد انس',
        symbol: 'طلا (انس)',
        body: 'این نماد در فهرست نیست.',
      }),
    ).toMatchObject({
      ok: true,
      value: { subject: 'custom-symbol', title: 'نماد انس', symbol: 'طلا (انس)' },
    });

    expect(
      parseNewTicket({
        subject: 'billing',
        title: 'پرداخت ناموفق',
        symbol: 'ignored',
        body: 'پرداخت انجام نشد.',
      }),
    ).toMatchObject({ ok: true, value: { subject: 'billing', symbol: '' } });
  });

  it('rejects an unknown subject, a bad symbol and an empty message', () => {
    expect(parseNewTicket({ subject: 'nope', title: 'سلام', symbol: '', body: 'سلام' }).ok).toBe(
      false,
    );
    expect(
      parseNewTicket({
        subject: 'custom-symbol',
        title: 'نماد',
        symbol: 'EUR USD!',
        body: 'اضافه شود',
      }),
    ).toEqual({ ok: false, error: 'Invalid symbol' });
    expect(parseSupportBody('  \n ')).toEqual({ ok: false, error: 'Message too short' });
    expect(parseSupportBody('الف'.repeat(SUPPORT_BODY_MAX + 1)).ok).toBe(false);
  });

  it('keeps line breaks and does not ask for a title', () => {
    const parsed = parseSupportBody('  خط اول\r\n\r\nخط دوم  ');
    expect(parsed).toEqual({ ok: true, text: 'خط اول\n\nخط دوم' });
  });
});

describe('checkSupportFile', () => {
  it('accepts a photo and rejects an executable or an oversized file', () => {
    expect(checkSupportFile({ name: 'نمودار.PNG', type: 'image/png', size: 1200 })).toMatchObject({
      ok: true,
      image: true,
      type: 'image/png',
    });
    expect(checkSupportFile({ name: 'notes.pdf', type: '', size: 20 }).ok).toBe(true);
    expect(
      checkSupportFile({ name: 'run.exe', type: 'application/octet-stream', size: 20 }),
    ).toEqual({
      ok: false,
      error: 'Invalid file',
    });
    expect(
      checkSupportFile({ name: 'big.png', type: 'image/png', size: SUPPORT_FILE_MAX_BYTES + 1 }),
    ).toEqual({ ok: false, error: 'File too large' });
  });
});
