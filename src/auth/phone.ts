const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Converts Persian/Arabic digits to ASCII. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const p = PERSIAN_DIGITS.indexOf(d);
    return String(p >= 0 ? p : ARABIC_DIGITS.indexOf(d));
  });
}

/**
 * Normalises an Iranian mobile number to `09XXXXXXXXX`. Accepts `09…`, `9…`, `+989…`,
 * `00989…`, `989…`, spaces/dashes and Persian digits. Returns null when it isn't a mobile number.
 */
export function normalizeIranianMobile(input: string): string | null {
  let d = toAsciiDigits(input).replace(/[\s\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0098')) d = d.slice(4);
  else if (d.startsWith('98') && d.length === 12) d = d.slice(2);
  if (d.startsWith('9') && d.length === 10) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

/** `09121234567` -> `0912 123 4567` */
export function formatIranianMobile(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone;
}

export const OTP_LENGTH = 5;
export const OTP_RESEND_SECONDS = 60;
