import { DAY_MS, TIMEFRAMES, type TimeframeId } from '@/lib/core';
import { assetClassOf } from '@/lib/data';
import { faDigits } from '@/lib/locale/jalali';

/**
 * Feature matrix from Settings → Subscription (Beginner, Intermediate, Professional).
 * `null` means unlimited. A `0` means the feature is unavailable.
 * There is no expiry in the product: a missing or unknown plan is Beginner.
 */
export const PLAN_IDS = ['beginner', 'mid', 'pro'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_LABEL: Readonly<Record<PlanId, string>> = {
  beginner: 'مبتدی',
  mid: 'متوسط',
  pro: 'حرفه‌ای',
};

/** Balance a Beginner session must use. Other amounts are the custom-balance feature. */
export const STANDARD_BALANCE = 100_000;

/**
 * Bars of the session ticker that playback may advance in one save.
 * A date jump is larger than this; candle-by-candle play is not.
 */
export const PLAY_BATCH = 120;

export interface PlanEntitlements {
  readonly backtestSessions: number | null;
  readonly prop: boolean;
  readonly randomCandle: boolean;
  readonly priceJump: boolean;
  readonly spread: boolean;
  readonly commission: boolean;
  readonly customBalance: boolean;
  /**
   * How many calendar months before the market's last day a session may start.
   * `null` is the full stored history.
   */
  readonly historyMonths: number | null;
  /** Distinct strategy tags across sessions. */
  readonly strategyTags: number | null;
  readonly gold: boolean;
  readonly otherMetals: boolean;
  readonly forex: boolean;
  readonly crypto: boolean;
  readonly indices: boolean;
  readonly exoticCharts: boolean;
  readonly orderFlow: boolean;
  readonly fib: boolean;
  readonly layouts: number | null;
  readonly drawingTransfer: boolean;
  readonly analytics: 'summary' | 'full';
  readonly rrSimulator: boolean;
  readonly journalTags: number | null;
  readonly journalShots: number | null;
  readonly journalConfidence: boolean;
  readonly journalSearch: boolean;
  readonly journalFilters: boolean;
  readonly battles: number | null;
  readonly ranked: boolean;
  readonly battleChat: boolean;
}

const BEGINNER: PlanEntitlements = {
  backtestSessions: 2,
  prop: false,
  randomCandle: false,
  priceJump: false,
  spread: false,
  commission: false,
  customBalance: false,
  historyMonths: 1,
  strategyTags: 0,
  gold: true,
  otherMetals: false,
  forex: false,
  crypto: false,
  indices: false,
  exoticCharts: false,
  orderFlow: false,
  fib: false,
  layouts: 1,
  drawingTransfer: false,
  analytics: 'summary',
  rrSimulator: false,
  journalTags: 1,
  journalShots: 1,
  journalConfidence: false,
  journalSearch: false,
  journalFilters: false,
  battles: 1,
  ranked: false,
  battleChat: false,
};

const MID: PlanEntitlements = {
  ...BEGINNER,
  backtestSessions: 15,
  prop: true,
  randomCandle: true,
  priceJump: true,
  spread: true,
  commission: true,
  customBalance: true,
  historyMonths: null,
  strategyTags: 3,
  otherMetals: true,
  forex: true,
  crypto: true,
  exoticCharts: true,
  fib: true,
  layouts: 5,
  drawingTransfer: true,
  analytics: 'full',
  rrSimulator: true,
  journalTags: null,
  journalShots: 10,
  journalConfidence: true,
  journalSearch: true,
  journalFilters: true,
  battles: null,
  ranked: true,
  battleChat: true,
};

const PRO: PlanEntitlements = {
  ...MID,
  backtestSessions: null,
  strategyTags: null,
  indices: true,
  orderFlow: true,
  layouts: null,
  journalShots: null,
};

const BY_PLAN: Readonly<Record<PlanId, PlanEntitlements>> = {
  beginner: BEGINNER,
  mid: MID,
  pro: PRO,
};

export function normalizePlan(value: unknown): PlanId {
  return PLAN_IDS.includes(value as PlanId) ? (value as PlanId) : 'beginner';
}

export function entitlements(plan: PlanId): PlanEntitlements {
  return BY_PLAN[plan];
}

export function requiresPlan(feature: string, plan: PlanId): string {
  return `${feature} برای طرح ${PLAN_LABEL[plan]} و بالاتر است.`;
}

export function limitMessage(feature: string, plan: PlanId, limit: number): string {
  return `سقف ${feature} در طرح ${PLAN_LABEL[plan]} ${faDigits(limit)} است.`;
}

export function isGoldSymbol(symbol: string): boolean {
  return /^XAU/i.test(symbol.trim());
}

export function symbolAllowed(plan: PlanId, symbol: string): boolean {
  const e = entitlements(plan);
  if (isGoldSymbol(symbol)) return e.gold;
  const kind = assetClassOf(symbol);
  if (kind === 'metals') return e.otherMetals;
  if (kind === 'forex') return e.forex;
  if (kind === 'crypto') return e.crypto;
  return e.indices;
}

/** Cheapest plan that unlocks `symbol`. Gold is Beginner; indices are Professional. */
export function symbolMinPlan(symbol: string): PlanId {
  if (isGoldSymbol(symbol)) return 'beginner';
  const kind = assetClassOf(symbol);
  if (kind === 'metals' || kind === 'forex' || kind === 'crypto') return 'mid';
  return 'pro';
}

/** True for the Persian copy from `requiresPlan` and `limitMessage`. */
export function isPlanLimitMessage(message: string): boolean {
  const text = message.trim();
  return (
    (text.includes('برای طرح ') && text.includes('و بالاتر است')) ||
    (text.startsWith('سقف ') && text.includes('در طرح '))
  );
}

export function symbolDenial(plan: PlanId, symbol: string): string | null {
  if (symbolAllowed(plan, symbol)) return null;
  if (isGoldSymbol(symbol)) return requiresPlan('طلا', 'beginner');
  const kind = assetClassOf(symbol);
  if (kind === 'metals') return requiresPlan('سایر فلزات', 'mid');
  if (kind === 'forex') return requiresPlan('نمادهای فارکس', 'mid');
  if (kind === 'crypto') return requiresPlan('کریپتو', 'mid');
  return requiresPlan('شاخص‌ها', 'pro');
}

/** Candle, bar, line and area, plus Heikin Ashi. */
const BASIC_CHARTS = new Set([
  'bars',
  'candles',
  'hollow-candles',
  'volume-candles',
  'line',
  'step-line',
  'area',
  'hlc-area',
  'baseline',
  'columns',
  'high-low',
  'heikin-ashi',
]);

/** Renko, Kagi, point and figure, range, and line break. */
const EXOTIC_CHARTS = new Set(['renko', 'kagi', 'point-figure', 'range', 'line-break']);

const ORDER_FLOW_CHARTS = new Set(['volume-footprint', 'tpo', 'session-volume-profile']);

export function chartTypeAllowed(plan: PlanId, chartType: string): boolean {
  if (BASIC_CHARTS.has(chartType)) return true;
  const e = entitlements(plan);
  if (EXOTIC_CHARTS.has(chartType)) return e.exoticCharts;
  if (ORDER_FLOW_CHARTS.has(chartType)) return e.orderFlow;
  return false;
}

export function chartTypeDenial(plan: PlanId, chartType: string): string | null {
  if (chartTypeAllowed(plan, chartType)) return null;
  if (ORDER_FLOW_CHARTS.has(chartType)) return requiresPlan('جریان سفارش', 'pro');
  return requiresPlan('رنکو، کاگی، نقطه و رقم و رنج', 'mid');
}

const FIB_TOOLS = new Set(['fib-retracement']);
const ORDER_FLOW_TOOLS = new Set(['fixed-range-volume-profile']);

export function drawingToolAllowed(plan: PlanId, tool: string): boolean {
  const e = entitlements(plan);
  if (ORDER_FLOW_TOOLS.has(tool)) return e.orderFlow;
  if (FIB_TOOLS.has(tool)) return e.fib;
  return true;
}

export function drawingToolDenial(plan: PlanId, tool: string): string | null {
  if (drawingToolAllowed(plan, tool)) return null;
  if (ORDER_FLOW_TOOLS.has(tool)) return requiresPlan('جریان سفارش', 'pro');
  return requiresPlan('فیبوناچی', 'mid');
}

export interface SessionGate {
  readonly type: 'backtesting' | 'prop';
  readonly symbol: string;
  readonly startingBalance: number;
  readonly spreadEnabled: boolean;
  readonly commissionEnabled: boolean;
  readonly strategyTag: string;
  readonly propRules: unknown;
  readonly startDate?: number;
}

/** UTC midnight `months` before `ms`, clamped to a real day of that month. */
export function addUtcMonths(ms: number, months: number): number {
  const date = new Date(ms);
  const day = date.getUTCDate();
  const index = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(day, last));
}

/**
 * Default practice window: end on today (or the market's last day, whichever is
 * earlier), start one calendar month before that.
 */
export function defaultHistoryWindow(
  range: { readonly start: number; readonly end: number },
  now = Date.now(),
): { readonly start: number; readonly end: number } {
  const lastDay = range.end - DAY_MS;
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const end = Math.max(range.start, Math.min(today, lastDay));
  const start = Math.max(range.start, addUtcMonths(end, -1));
  return { start, end: Math.max(start, end) };
}

/**
 * Earliest day a session on `plan` may start. Beginner is one calendar month
 * before today (clamped to the market); higher plans use the whole stored range.
 */
export function selectableHistoryStart(
  plan: PlanId,
  range: { readonly start: number; readonly end: number },
  now = Date.now(),
): number {
  const months = entitlements(plan).historyMonths;
  if (months === null) return range.start;
  const lastDay = range.end - DAY_MS;
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const anchor = Math.min(today, lastDay);
  return Math.max(range.start, addUtcMonths(anchor, -months));
}

export function historyDenial(
  plan: PlanId,
  startDate: number,
  range: { readonly start: number; readonly end: number },
  now = Date.now(),
): string | null {
  if (entitlements(plan).historyMonths === null) return null;
  if (startDate >= selectableHistoryStart(plan, range, now)) return null;
  return requiresPlan('تاریخ قبل از یک ماه گذشتهٔ بازار', 'mid');
}

export function sessionSettingsDenial(
  plan: PlanId,
  settings: SessionGate,
  range?: { readonly start: number; readonly end: number },
): string | null {
  const e = entitlements(plan);
  if (
    (settings.type === 'prop' ||
      (settings.propRules !== null && settings.propRules !== undefined)) &&
    !e.prop
  )
    return requiresPlan('جلسه پراپ', 'mid');
  const symbol = symbolDenial(plan, settings.symbol);
  if (symbol) return symbol;
  if (!e.customBalance && settings.startingBalance !== STANDARD_BALANCE)
    return requiresPlan('موجودی دلخواه', 'mid');
  if (!e.spread && settings.spreadEnabled) return requiresPlan('اسپرد', 'mid');
  if (!e.commission && settings.commissionEnabled) return requiresPlan('کارمزد', 'mid');
  if (e.strategyTags === 0 && settings.strategyTag.trim())
    return requiresPlan('برچسب استراتژی', 'mid');
  if (range && settings.startDate !== undefined) {
    const history = historyDenial(plan, settings.startDate, range);
    if (history) return history;
  }
  return null;
}

export interface JournalSlice {
  readonly tags: readonly string[];
  readonly screenshots: readonly string[];
  readonly confidence: number | null;
}

export function journalDenial(
  plan: PlanId,
  prev: Readonly<Record<string, JournalSlice>>,
  next: Readonly<Record<string, JournalSlice>>,
): string | null {
  const e = entitlements(plan);
  for (const [id, entry] of Object.entries(next)) {
    const before = prev[id];
    if (
      e.journalTags !== null &&
      entry.tags.length > e.journalTags &&
      entry.tags.length > (before?.tags.length ?? 0)
    )
      return limitMessage('برچسب دفتر معاملات', plan, e.journalTags);
    if (
      e.journalShots !== null &&
      entry.screenshots.length > e.journalShots &&
      entry.screenshots.length > (before?.screenshots.length ?? 0)
    )
      return limitMessage('عکس تحلیل', plan, e.journalShots);
    if (
      !e.journalConfidence &&
      entry.confidence !== null &&
      entry.confidence !== before?.confidence
    )
      return requiresPlan('امتیاز اطمینان', 'mid');
  }
  return null;
}

export function cursorDenial(
  plan: PlanId,
  from: number,
  to: number,
  ticker: TimeframeId,
): string | null {
  if (to <= from || entitlements(plan).priceJump) return null;
  if (to - from > TIMEFRAMES[ticker].ms * PLAY_BATCH) return requiresPlan('پرش قیمت', 'mid');
  return null;
}

export function quotaDenial(
  feature: string,
  plan: PlanId,
  used: number,
  limit: number | null,
): string | null {
  if (limit === null || used < limit) return null;
  return limitMessage(feature, plan, limit);
}

export function battleDenial(
  plan: PlanId,
  kind: 'join' | 'ranked' | 'chat',
  used: number,
  alreadyIn = false,
): string | null {
  const e = entitlements(plan);
  if (kind === 'chat') return e.battleChat ? null : requiresPlan('گفتگوی اتاق', 'mid');
  if (kind === 'ranked' && !e.ranked) return requiresPlan('نبرد رتبه‌ای', 'mid');
  if (alreadyIn) return null;
  return quotaDenial('شرکت در نبرد', plan, used, e.battles);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function drawingCounts(value: unknown): Map<string, number> {
  const root = asRecord(value);
  const data = asRecord(root?.data) ?? root;
  const list = Array.isArray(data?.drawings) ? data.drawings : [];
  const counts = new Map<string, number>();
  for (const item of list) {
    const type = asRecord(item)?.type;
    if (typeof type !== 'string') continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

function chartTypeOf(value: unknown): string | null {
  const root = asRecord(value);
  const data = asRecord(root?.data) ?? root;
  return typeof data?.chartType === 'string' ? data.chartType : null;
}

export function chartRecordDenial(
  plan: PlanId,
  key: string,
  value: unknown,
  previous: unknown,
): string | null {
  if (key === 'layouts' || key.endsWith(':layouts')) {
    const next = Array.isArray(value) ? value.length : 0;
    const limit = entitlements(plan).layouts;
    if (limit !== null && next > limit) return limitMessage('چیدمان ذخیره‌شده', plan, limit);
    return null;
  }
  if (key === 'chart-settings' || key.endsWith(':chart-settings')) {
    const next = chartTypeOf(value);
    const prev = chartTypeOf(previous);
    if (!next || next === prev || chartTypeAllowed(plan, next)) return null;
    return chartTypeDenial(plan, next);
  }
  if (key.includes('drawings:')) {
    const next = drawingCounts(value);
    const prev = drawingCounts(previous);
    for (const [type, count] of next) {
      if (drawingToolAllowed(plan, type) || count <= (prev.get(type) ?? 0)) continue;
      return drawingToolDenial(plan, type);
    }
  }
  return null;
}
