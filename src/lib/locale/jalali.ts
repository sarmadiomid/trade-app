/** Gregorian ↔ Jalali conversion and Persian display helpers. Pure, no locale data files. */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const faDigits = (value: string | number): string =>
  String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);

export const faNum = (value: number, decimals?: number): string => {
  if (!Number.isFinite(value)) return '—';
  const text =
    decimals === undefined
      ? value.toLocaleString('fa-IR')
      : value.toLocaleString('fa-IR', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
  return text;
};

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** Sunday-first, matching `Date#getUTCDay`. */
export const JALALI_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
] as const;

/** Saturday-first short names, the Iranian week. */
export const JALALI_WEEK_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

export interface JalaliDate {
  readonly jy: number;
  readonly jm: number;
  readonly jd: number;
}

export interface GregorianDate {
  readonly gy: number;
  readonly gm: number;
  readonly gd: number;
}

const div = (a: number, b: number) => Math.trunc(a / b);

/** Civil Gregorian (month 1–12) → Jalali. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    gDM[gm - 1]!;
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Jalali (month 1–12) → civil Gregorian. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  const jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    div(jy2, 33) * 8 +
    div((jy2 % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const md = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  for (; gm < 13 && gd > md[gm]!; gm++) gd -= md[gm]!;
  return { gy, gm, gd };
}

export function isJalaliLeap(jy: number): boolean {
  const a = jalaliToGregorian(jy, 1, 1);
  const b = jalaliToGregorian(jy + 1, 1, 1);
  const days =
    (Date.UTC(b.gy, b.gm - 1, b.gd) - Date.UTC(a.gy, a.gm - 1, a.gd)) / 86_400_000;
  return days === 366;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/** Jalali date of a UTC instant (the UTC civil day, not Tehran local). */
export function utcToJalali(time: number): JalaliDate {
  const d = new Date(time);
  return gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** UTC midnight of a Jalali civil day. */
export function jalaliToUtc(jy: number, jm: number, jd: number): number {
  const g = jalaliToGregorian(jy, jm, jd);
  return Date.UTC(g.gy, g.gm - 1, g.gd);
}

const pad = (n: number) => n.toString().padStart(2, '0');

/** «۱۲ فروردین ۱۴۰۳». */
export function formatJalaliDate(time: number): string {
  const j = utcToJalali(time);
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`;
}

/** «یکشنبه ۱۲ فروردین ۱۴۰۳، ۱۴:۳۰» — clock is UTC. */
export function formatJalaliDateTime(time: number, withTime = true): string {
  const d = new Date(time);
  const j = utcToJalali(time);
  const date = `${JALALI_WEEKDAYS[d.getUTCDay()]} ${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`;
  if (!withTime) return date;
  return `${date}، ${faDigits(pad(d.getUTCHours()))}:${faDigits(pad(d.getUTCMinutes()))}`;
}

/** yyyy-mm-dd (Gregorian UTC) ↔ Jalali, for the value stored in date fields. */
export function gregorianInputToJalali(value: string): JalaliDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function jalaliToGregorianInput(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
