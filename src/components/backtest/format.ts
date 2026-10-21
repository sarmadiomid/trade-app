import { faDigits, faNum, formatJalaliDate, formatJalaliDateTime } from '@/lib/locale/jalali';

const faFixed = (v: number, decimals: number) =>
  Math.abs(v).toLocaleString('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** «۱۲٬۳۴۵٫۰۰ $» — the dollar mark stays with the number (rendered LTR). */
export const money = (v: number, decimals = 2): string =>
  `${v < 0 ? '−' : ''}${faFixed(v, decimals)} $`;

export const signedMoney = (v: number): string => {
  const n = Math.abs(v) < 0.004 ? 0 : v;
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${faFixed(n, 2)} $`;
};

export const pct = (v: number, decimals = 2): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${faFixed(v, decimals)}٪`;

export const plainPct = (ratio: number, decimals = 1): string =>
  `${faFixed(ratio * 100, decimals)}٪`;

export const lots = (v: number): string => faFixed(v, 2);

export const num = (v: number | null | undefined, decimals = 2): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : faFixed(v, decimals);

/*
 * Trading figures (prices, lots, account money) stay in Latin digits on the trading screen:
 * they sit next to the chart's Latin price axis and are compared at a glance.
 */
const enFixed = (v: number, decimals: number) =>
  Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** «$12,345.00» */
export const usd = (v: number, decimals = 2): string =>
  `${v < 0 ? '−' : ''}$${enFixed(v, decimals)}`;

/** «+$120.50» / «−$40.00» / «$0.00» */
export const signedUsd = (v: number): string => {
  const n = Math.abs(v) < 0.004 ? 0 : v;
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${enFixed(n, 2)}`;
};

/** Price or lot in Latin digits, «—» when missing. */
export const enNum = (v: number | null | undefined, decimals = 2): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v < 0 ? '−' : ''}${enFixed(v, decimals)}`;

export const pnlClass = (v: number): string =>
  v > 0.004 ? 'text-up' : v < -0.004 ? 'text-down' : 'text-muted';

const pad = (n: number) => n.toString().padStart(2, '0');

/** Jalali date of the UTC civil day, with the UTC clock. The session never shifts to Tehran. */
export function utcDateTime(t: number, withTime = true): string {
  return formatJalaliDateTime(t, withTime);
}

export function utcDate(t: number): string {
  return formatJalaliDate(t);
}

/** yyyy-mm-dd (Gregorian UTC) for storage and `<input type="date">` bounds. */
export function toDateInput(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fromDateInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** yyyy-mm-ddThh:mm (UTC) for datetime bounds. */
export function toDateTimeInput(t: number): string {
  const d = new Date(t);
  return `${toDateInput(t)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function fromDateTimeInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  return m
    ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
    : null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** «۳ روز و ۴ ساعت»، «۴۵ دقیقه». */
export function duration(ms: number): string {
  if (!(ms > 0)) return '—';
  if (ms >= DAY) {
    const d = Math.floor(ms / DAY);
    const h = Math.round((ms - d * DAY) / HOUR);
    return h ? `${faNum(d)} روز و ${faNum(h)} ساعت` : `${faNum(d)} روز`;
  }
  if (ms >= HOUR) {
    const h = Math.floor(ms / HOUR);
    const m = Math.round((ms - h * HOUR) / MINUTE);
    return m ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(h)} ساعت`;
  }
  return `${faNum(Math.max(1, Math.round(ms / MINUTE)))} دقیقه`;
}

/** Monday-first labels for the weekday chart (it only buckets Mon–Fri). */
export const WEEKDAY_NAMES = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const;

export const EXIT_REASON_LABEL: Readonly<Record<string, string>> = {
  tp: 'حد سود',
  sl: 'حد ضرر',
  manual: 'دستی',
  partial: 'جزئی',
  'session-end': 'پایان جلسه',
  'stop-out': 'کال مارجین',
  'rule-breach': 'نقض قانون پراپ',
};

export const SIDE_FA = { buy: 'خرید', sell: 'فروش' } as const;

export const ORDER_KIND_FA = { limit: 'لیمیت', stop: 'استاپ', market: 'بازار' } as const;

/** Stored engine reasons stay English; this is display only. */
export function failReasonFa(reason: string): string {
  const daily = /^Max daily loss \((.+)\)$/.exec(reason);
  if (daily) return `سقف ضرر روزانه (${faDigits(daily[1]!)})`;
  const total = /^Max total loss \((.+)\)$/.exec(reason);
  if (total) return `سقف ضرر کل (${faDigits(total[1]!)})`;
  if (reason === 'Stop out' || reason === 'Stopped out') return 'کال مارجین';
  if (reason === 'Session end') return 'پایان جلسه';
  return reason;
}

export const TF_FA: Readonly<Record<string, string>> = {
  '1m': '۱ دقیقه',
  '3m': '۳ دقیقه',
  '5m': '۵ دقیقه',
  '15m': '۱۵ دقیقه',
  '30m': '۳۰ دقیقه',
  '1h': '۱ ساعت',
  '2h': '۲ ساعت',
  '4h': '۴ ساعت',
  '1D': 'روزانه',
  '1W': 'هفتگی',
  '1M': 'ماهانه',
};

export const ASSET_FA: Readonly<Record<string, string>> = {
  XAUUSD: 'طلا / دلار',
  EURUSD: 'یورو / دلار',
  GBPUSD: 'پوند / دلار',
  AUDUSD: 'دلار استرالیا / دلار',
  NAS100: 'شاخص نزدک ۱۰۰',
};

export const SESSION_FA: Readonly<Record<string, string>> = {
  asia: 'آسیا',
  london: 'لندن',
  'new-york': 'نیویورک',
  off: 'خارج از سشن',
};

export { faDigits, faNum };
