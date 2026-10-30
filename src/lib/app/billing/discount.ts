/** Discount codes for subscription checkout. Pure: the clock is the `now` argument. */

export type DiscountKind = 'percent' | 'fixed';
export type DiscountPlanId = 'mid' | 'pro';
export type DiscountCycle = 'month' | 'year';

export type DiscountRejection =
  'empty' | 'invalid' | 'inactive' | 'expired' | 'exhausted' | 'used' | 'plan' | 'cycle';

export interface DiscountSeed {
  readonly code: string;
  readonly kind: DiscountKind;
  readonly value: number;
  /** Omitted or empty means every paid plan. */
  readonly plans?: readonly DiscountPlanId[];
  /** Omitted or empty means every billing cycle. */
  readonly cycles?: readonly DiscountCycle[];
  readonly active?: boolean;
  /** ISO timestamp. Null or omitted means the code does not expire. */
  readonly expiresAt?: string | null;
  /** Null or omitted means unlimited redemptions. */
  readonly maxUses?: number | null;
  /** Null or omitted means one buyer can use the code any number of times. */
  readonly perUser?: number | null;
  readonly label?: string;
}

export interface DiscountDefinition {
  readonly code: string;
  readonly kind: DiscountKind;
  readonly value: number;
  readonly plans: readonly DiscountPlanId[];
  readonly cycles: readonly DiscountCycle[];
  readonly active: boolean;
  readonly expiresAt: number | null;
  readonly maxUses: number | null;
  readonly perUser: number | null;
  readonly label: string;
}

/** A stored code plus how many times it has already been used. */
export interface DiscountRule {
  readonly kind: DiscountKind;
  readonly value: number;
  readonly plans: readonly DiscountPlanId[];
  readonly cycles: readonly DiscountCycle[];
  readonly active: boolean;
  readonly expiresAt: number | null;
  readonly maxUses: number | null;
  readonly used: number;
  readonly perUser: number | null;
  readonly userUses: number;
  readonly label: string;
}

export interface DiscountQuote {
  readonly code: string;
  readonly kind: DiscountKind;
  readonly value: number;
  readonly label: string;
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
}

const CODE_MAX = 32;
const LABEL_MAX = 80;
const CATALOG_MAX = 100;
const FIXED_MAX = 100_000_000;
const PLANS: readonly DiscountPlanId[] = ['mid', 'pro'];
const CYCLES: readonly DiscountCycle[] = ['month', 'year'];

const MESSAGES: Readonly<Record<DiscountRejection, string>> = {
  empty: 'کد تخفیف را وارد کنید',
  invalid: 'این کد تخفیف معتبر نیست',
  inactive: 'این کد تخفیف دیگر فعال نیست',
  expired: 'مهلت این کد تخفیف تمام شده',
  exhausted: 'ظرفیت این کد تخفیف تمام شده',
  used: 'این کد را قبلاً استفاده کرده‌اید',
  plan: 'این کد برای این طرح نیست',
  cycle: 'این کد برای این دورهٔ پرداخت نیست',
};

export function discountRejectionMessage(reason: DiscountRejection): string {
  // Opaque to callers so quote responses cannot classify unpublished codes.
  if (reason === 'empty') return MESSAGES.empty;
  return MESSAGES.invalid;
}

/** Latin uppercase code, or null when the text cannot be a code. */
export function normalizeDiscountCode(raw: string): string | null {
  const compact = raw.replace(/[\s\u200c\u200d]/g, '');
  if (!compact) return null;
  const folded = compact
    .replace(/[۰-۹٠-٩]/g, (digit) => {
      const persian = '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit);
      if (persian >= 0) return String(persian);
      const arabic = '٠١٢٣٤٥٦٧٨٩'.indexOf(digit);
      return arabic >= 0 ? String(arabic) : digit;
    })
    .toUpperCase();
  if (!folded || folded.length > CODE_MAX) return null;
  if (!/^[A-Z0-9_-]+$/.test(folded)) return null;
  return folded;
}

/** Toman taken off `subtotal`. Never more than the subtotal, never negative. */
export function discountOff(subtotal: number, kind: DiscountKind, value: number): number {
  const base = Math.max(0, Math.round(subtotal));
  if (base === 0 || !Number.isInteger(value) || value < 1) return 0;
  const raw = kind === 'percent' ? Math.round((base * value) / 100) : value;
  return Math.min(base, Math.max(0, raw));
}

export function quoteDiscount(input: {
  readonly code: string;
  readonly rule: DiscountRule | null;
  readonly subtotal: number;
  readonly planId: DiscountPlanId;
  readonly cycle: DiscountCycle;
  readonly now: number;
}): { ok: true; quote: DiscountQuote } | { ok: false; reason: DiscountRejection } {
  if (!input.code.trim()) return { ok: false, reason: 'empty' };
  const code = normalizeDiscountCode(input.code);
  if (!code) return { ok: false, reason: 'invalid' };
  const rule = input.rule;
  if (!rule || !ruleIsSound(rule)) return { ok: false, reason: 'invalid' };
  if (!rule.active) return { ok: false, reason: 'inactive' };
  if (rule.expiresAt !== null && input.now >= rule.expiresAt)
    return { ok: false, reason: 'expired' };
  if (rule.plans.length > 0 && !rule.plans.includes(input.planId))
    return { ok: false, reason: 'plan' };
  if (rule.cycles.length > 0 && !rule.cycles.includes(input.cycle)) {
    return { ok: false, reason: 'cycle' };
  }
  if (rule.maxUses !== null && rule.used >= rule.maxUses) return { ok: false, reason: 'exhausted' };
  if (rule.perUser !== null && rule.userUses >= rule.perUser) return { ok: false, reason: 'used' };
  if (!Number.isFinite(input.subtotal) || input.subtotal < 0)
    return { ok: false, reason: 'invalid' };

  const subtotal = Math.round(input.subtotal);
  const discount = discountOff(subtotal, rule.kind, rule.value);
  return {
    ok: true,
    quote: {
      code,
      kind: rule.kind,
      value: rule.value,
      label: rule.label,
      subtotal,
      discount,
      total: subtotal - discount,
    },
  };
}

/**
 * Accepts a JSON string (the DISCOUNT_CODES env) or an array of seed objects.
 * Invalid entries are skipped; valid ones still apply. The last copy of a code wins.
 */
export function parseDiscountCatalog(raw: unknown): {
  codes: DiscountDefinition[];
  error: string | null;
} {
  if (raw === undefined || raw === null || raw === '') return { codes: [], error: null };
  let data: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return { codes: [], error: null };
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      return { codes: [], error: 'DISCOUNT_CODES is not valid JSON' };
    }
  }
  if (!Array.isArray(data)) return { codes: [], error: 'DISCOUNT_CODES must be a JSON array' };
  if (data.length > CATALOG_MAX) {
    return { codes: [], error: 'DISCOUNT_CODES has too many entries' };
  }

  const byCode = new Map<string, DiscountDefinition>();
  let skipped = 0;
  for (const item of data) {
    const parsed = parseSeed(item);
    if (!parsed) {
      skipped += 1;
      continue;
    }
    byCode.set(parsed.code, parsed);
  }
  return {
    codes: [...byCode.values()],
    error: skipped > 0 ? `${skipped} discount code${skipped === 1 ? '' : 's'} skipped` : null,
  };
}

function ruleIsSound(rule: DiscountRule): boolean {
  if (rule.kind !== 'percent' && rule.kind !== 'fixed') return false;
  if (!Number.isInteger(rule.value) || rule.value < 1) return false;
  if (rule.kind === 'percent' && rule.value > 100) return false;
  if (rule.kind === 'fixed' && rule.value > FIXED_MAX) return false;
  if (rule.expiresAt !== null && !Number.isFinite(rule.expiresAt)) return false;
  return true;
}

function parseSeed(item: unknown): DiscountDefinition | null {
  if (!isRecord(item)) return null;
  if (typeof item.code !== 'string') return null;
  const code = normalizeDiscountCode(item.code);
  if (!code) return null;
  if (item.kind !== 'percent' && item.kind !== 'fixed') return null;
  if (typeof item.value !== 'number' || !Number.isInteger(item.value) || item.value < 1)
    return null;
  if (item.kind === 'percent' && item.value > 100) return null;
  if (item.kind === 'fixed' && item.value > FIXED_MAX) return null;

  const plans = pickList(item.plans, PLANS);
  const cycles = pickList(item.cycles, CYCLES);
  const maxUses = pickLimit(item.maxUses);
  const perUser = pickLimit(item.perUser);
  const expiresAt = pickExpiry(item.expiresAt);
  const label = cleanLabel(item.label);
  if (
    !plans ||
    !cycles ||
    maxUses === undefined ||
    perUser === undefined ||
    expiresAt === undefined
  ) {
    return null;
  }
  if (label === null) return null;
  if (item.active !== undefined && typeof item.active !== 'boolean') return null;

  return {
    code,
    kind: item.kind,
    value: item.value,
    plans,
    cycles,
    active: item.active !== false,
    expiresAt,
    maxUses,
    perUser,
    label,
  };
}

function pickList<T extends string>(value: unknown, allowed: readonly T[]): readonly T[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item as T)) return null;
    if (!out.includes(item as T)) out.push(item as T);
  }
  return out;
}

/** Null means unlimited. Undefined means the field is not a usable limit. */
function pickLimit(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return undefined;
  return value;
}

function pickExpiry(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return ms;
}

function cleanLabel(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  return value.trim().replace(/\s+/g, ' ').slice(0, LABEL_MAX);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
