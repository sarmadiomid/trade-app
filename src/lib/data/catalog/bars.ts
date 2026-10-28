import type { Candle } from '@/lib/core';
import {
  DAY_MS,
  aggregate,
  bucketStart,
  canAggregate,
  getTimeframe,
  type TimeframeId,
} from '@/lib/core';

/** Hard cap for one symbol so a CSV cannot fill the database. */
export const MAX_SYMBOL_BARS = 200_000;
/** Bars accepted in one upload request. The client sends larger files in batches. */
export const MAX_IMPORT_BARS = 20_000;

const HEADER_TIME = /^(time|timestamp|date|datetime|t|dt|dtyyyymmdd|yyyymmdd)$/i;
const HEADER_CLOCK = /^(time|hhmm|hhmmss)$/i;
const HEADER_OPEN = /^(open|o)$/i;
const HEADER_HIGH = /^(high|h)$/i;
const HEADER_LOW = /^(low|l)$/i;
const HEADER_CLOSE = /^(close|c)$/i;
const HEADER_VOLUME = /^(volume|vol|v)$/i;

/** Folder and file names used by the advanced-get export, longest match first. */
const PATH_TIMEFRAMES: readonly { readonly pattern: RegExp; readonly id: TimeframeId }[] = [
  { pattern: /240\s*minute|(?:^|[^\d])4\s*h(?:our)?(?:[^\d]|$)/i, id: '4h' },
  { pattern: /120\s*minute|(?:^|[^\d])2\s*h(?:our)?(?:[^\d]|$)/i, id: '2h' },
  { pattern: /60\s*minute|(?:^|[^\d])1\s*h(?:our)?(?:[^\d]|$)/i, id: '1h' },
  { pattern: /30\s*minute|(?:^|[^\d])30\s*m(?:inute)?(?:[^\d]|$)/i, id: '30m' },
  { pattern: /15\s*minute|(?:^|[^\d])15\s*m(?:inute)?(?:[^\d]|$)/i, id: '15m' },
  { pattern: /5\s*minute|(?:^|[^\d])5\s*m(?:inute)?(?:[^\d]|$)/i, id: '5m' },
  { pattern: /3\s*minute|(?:^|[^\d])3\s*m(?:inute)?(?:[^\d]|$)/i, id: '3m' },
  { pattern: /1\s*minute|(?:^|[^\d])1\s*m(?:inute)?(?:[^\d]|$)/i, id: '1m' },
  { pattern: /daily|1\s*day|(?:^|[^\d])1\s*d(?:ay)?(?:[^\d]|$)/i, id: '1D' },
];

/** Timeframe implied by a path such as `advanced-get/15minute/XAU_USD-15minute.prn`. */
export function timeframeFromPath(path: string): TimeframeId | null {
  const name = path.replaceAll('\\', '/');
  return PATH_TIMEFRAMES.find((item) => item.pattern.test(name))?.id ?? null;
}

export interface ParsedBars {
  readonly bars: Candle[];
}

/** Takes the last `limit` bars at or before `endTime`, or the first `limit` from `startTime`. */
export function sliceCandles(
  bars: readonly Candle[],
  req: { readonly startTime?: number; readonly endTime?: number; readonly limit: number },
): { bars: Candle[]; hasMoreHistory: boolean } {
  const limit = Math.max(0, Math.floor(req.limit));
  const end = req.endTime ?? Infinity;
  if (req.startTime !== undefined) {
    const start = req.startTime;
    const out: Candle[] = [];
    let first = -1;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]!;
      if (bar.time < start) continue;
      if (first < 0) first = i;
      if (bar.time > end || out.length >= limit) break;
      out.push(bar);
    }
    return { bars: out, hasMoreHistory: first > 0 };
  }
  let last = bars.length - 1;
  while (last >= 0 && bars[last]!.time > end) last -= 1;
  if (last < 0) return { bars: [], hasMoreHistory: false };
  const startIdx = Math.max(0, last + 1 - limit);
  return { bars: bars.slice(startIdx, last + 1), hasMoreHistory: startIdx > 0 };
}

/** Half-open `[from, to)` slice used by the practice replay. */
export function barsBetween(bars: readonly Candle[], from: number, to: number): Candle[] {
  const out: Candle[] = [];
  for (const bar of bars) {
    if (bar.time < from) continue;
    if (bar.time >= to) break;
    out.push(bar);
  }
  return out;
}

/**
 * Projects stored bars of timeframe `base` into `requested`.
 * A finer request than the stored series cannot be invented, so it comes back empty.
 */
export function projectBars(
  base: TimeframeId,
  bars: readonly Candle[],
  req: {
    readonly timeframe: TimeframeId;
    readonly startTime?: number;
    readonly endTime?: number;
    readonly limit: number;
  },
): { bars: Candle[]; hasMoreHistory: boolean } {
  if (req.timeframe === base) return sliceCandles(bars, req);
  if (!canAggregate(base, req.timeframe)) return { bars: [], hasMoreHistory: false };
  const need = baseBarsNeeded(base, req.timeframe, Math.max(1, req.limit));
  const window = sliceCandles(bars, {
    ...(req.startTime !== undefined
      ? { startTime: bucketStart(req.startTime, req.timeframe) }
      : {}),
    ...(req.endTime !== undefined ? { endTime: req.endTime } : {}),
    limit: need,
  });
  const aggregated = aggregate(window.bars, base, req.timeframe);
  const sliced = sliceCandles(aggregated, req);
  return { bars: sliced.bars, hasMoreHistory: window.hasMoreHistory || sliced.hasMoreHistory };
}

function baseBarsNeeded(base: TimeframeId, to: TimeframeId, limit: number): number {
  const a = getTimeframe(base).ms;
  const b = getTimeframe(to).ms;
  if (to === '1M') return limit * Math.ceil((31 * DAY_MS) / a) + 2;
  if (to === '1W') return limit * Math.ceil((7 * DAY_MS) / a) + 2;
  return limit * Math.max(1, Math.ceil(b / a)) + 2;
}

/** Snaps bars onto timeframe buckets and merges bars that land in the same bucket. */
export function normalizeBars(
  raw: readonly Candle[],
  timeframe: TimeframeId,
): { ok: true; bars: Candle[] } | { ok: false; error: string } {
  const sorted = [...raw].sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const bar = sorted[i]!;
    if (!Number.isFinite(bar.time) || bar.time <= 0) {
      return { ok: false, error: `زمان کندل ${i + 1} نامعتبر است` };
    }
    for (const value of [bar.open, bar.high, bar.low, bar.close]) {
      if (!Number.isFinite(value) || value < 0) {
        return { ok: false, error: `قیمت کندل ${i + 1} نامعتبر است` };
      }
    }
    if (
      bar.high < bar.low ||
      bar.high < Math.max(bar.open, bar.close) ||
      bar.low > Math.min(bar.open, bar.close)
    ) {
      return { ok: false, error: `سقف و کف کندل ${i + 1} با قیمت باز و بسته نمی‌خواند` };
    }
    if (!Number.isFinite(bar.volume) || bar.volume < 0) {
      return { ok: false, error: `حجم کندل ${i + 1} نامعتبر است` };
    }
    const time = bucketStart(bar.time, timeframe);
    const next: Candle = {
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    };
    const prev = out[out.length - 1];
    if (prev && prev.time === time) {
      if (next.high > prev.high) prev.high = next.high;
      if (next.low < prev.low) prev.low = next.low;
      prev.close = next.close;
      prev.volume += next.volume;
    } else {
      out.push(next);
    }
  }
  if (out.length === 0) return { ok: false, error: 'فایل هیچ کندلی ندارد' };
  if (out.length > MAX_SYMBOL_BARS)
    return { ok: false, error: 'تعداد کندل‌ها از سقف ۲۰۰ هزار گذشته است' };
  return { ok: true, bars: out };
}

/** Parses a CSV of time, open, high, low, close and optional volume. */
export function parseCandleCsv(
  text: string,
  timeframe: TimeframeId,
): { ok: true; bars: Candle[] } | { ok: false; error: string } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  if (lines.length === 0) return { ok: false, error: 'فایل خالی است' };
  const split = (line: string) =>
    line.split(/[,;\t]/).map((cell) => foldDigits(cell.trim()).replace(/^<|>$/g, ''));
  const head = split(lines[0]!);
  const mapped = columnMap(head);
  const start = mapped ? 1 : 0;
  const columns = mapped ?? {
    time: 0,
    clock: -1,
    open: 1,
    high: 2,
    low: 3,
    close: 4,
    volume: head.length > 5 ? 5 : -1,
  };
  if (!mapped && head.length < 5) {
    return {
      ok: false,
      error:
        'ستون‌ها باید تاریخ، open، high، low، close باشند. فایل PRN با سرستون DTYYYYMMDD هم پذیرفته می‌شود.',
    };
  }
  const raw: Candle[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]!);
    const time = parseBarTime(
      cells[columns.time] ?? '',
      columns.clock >= 0 ? cells[columns.clock] : undefined,
    );
    const open = numberAt(cells, columns.open);
    const high = numberAt(cells, columns.high);
    const low = numberAt(cells, columns.low);
    const close = numberAt(cells, columns.close);
    const volume = columns.volume >= 0 ? numberAt(cells, columns.volume) : 0;
    if (
      time === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      volume === null
    ) {
      return { ok: false, error: `سطر ${i + 1} خوانده نشد` };
    }
    raw.push({ time, open, high, low, close, volume });
    if (raw.length > MAX_SYMBOL_BARS)
      return { ok: false, error: 'تعداد کندل‌ها از سقف ۲۰۰ هزار گذشته است' };
  }
  return normalizeBars(raw, timeframe);
}

export function toTuples(bars: readonly Candle[]): number[][] {
  return bars.map((bar) => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]);
}

export function fromTuples(rows: readonly number[][]): Candle[] {
  const out: Candle[] = [];
  for (const row of rows) {
    if (row.length < 6) continue;
    const [time, open, high, low, close, volume] = row;
    if (
      time === undefined ||
      open === undefined ||
      high === undefined ||
      low === undefined ||
      close === undefined ||
      volume === undefined
    ) {
      continue;
    }
    out.push({ time, open, high, low, close, volume });
  }
  return out;
}

/** Exclusive end of the session range: the day after the last stored bar. */
export function rangeOfBars(bars: readonly Candle[]): { start: number; end: number } | null {
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!first || !last) return null;
  return { start: first.time, end: last.time + DAY_MS };
}

function columnMap(head: readonly string[]): {
  time: number;
  clock: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
} | null {
  const time = head.findIndex((cell) => HEADER_TIME.test(cell));
  if (time < 0) return null;
  const open = head.findIndex((cell) => HEADER_OPEN.test(cell));
  const high = head.findIndex((cell) => HEADER_HIGH.test(cell));
  const low = head.findIndex((cell) => HEADER_LOW.test(cell));
  const close = head.findIndex((cell) => HEADER_CLOSE.test(cell));
  if (open < 0 || high < 0 || low < 0 || close < 0) return null;
  const clock = head.findIndex((cell, index) => index !== time && HEADER_CLOCK.test(cell));
  return {
    time,
    clock,
    open,
    high,
    low,
    close,
    volume: head.findIndex((cell) => HEADER_VOLUME.test(cell)),
  };
}

function numberAt(cells: readonly string[], index: number): number | null {
  const value = Number(cells[index]);
  return Number.isFinite(value) ? value : null;
}

function parseBarTime(date: string, clock: string | undefined): number | null {
  const day = parseTime(date);
  if (day === null) return null;
  if (!clock) return day;
  const hm = /^(\d{2})(\d{2})(\d{2})?$/.exec(clock);
  if (!hm) return day;
  const hour = Number(hm[1]);
  const minute = Number(hm[2]);
  const second = hm[3] ? Number(hm[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return day + ((hour * 60 + minute) * 60 + second) * 1000;
}

function parseTime(raw: string): number | null {
  if (!raw) return null;
  const packed = parsePackedDate(raw);
  if (packed !== null) return packed;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    if (asNumber >= 1e12) return Math.round(asNumber);
    if (asNumber >= 1e9) return Math.round(asNumber * 1000);
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `YYYYMMDD`, `YYYYMMDDHHMM`, or `YYYYMMDDHHMMSS` from a PRN export. */
function parsePackedDate(raw: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/.exec(raw);
  if (!match || (raw.length !== 8 && raw.length !== 12 && raw.length !== 14)) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const second = match[6] ? Number(match[6]) : 0;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function foldDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit);
    if (persian >= 0) return String(persian);
    const arabic = '٠١٢٣٤٥٦٧٨٩'.indexOf(digit);
    return arabic >= 0 ? String(arabic) : digit;
  });
}
