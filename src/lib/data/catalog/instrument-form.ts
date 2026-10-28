import { decimalsOf, type InstrumentSpec, type TradingHours } from '@/lib/core';
import type { AssetClass } from '../instruments';

export const ASSET_CLASSES = ['metals', 'forex', 'indices', 'crypto'] as const;
export const HOUR_PRESETS = ['forex', 'metals', 'indices', 'crypto'] as const;
export type HourPreset = (typeof HOUR_PRESETS)[number];

const FOREX_HOURS: TradingHours = {
  weekOpen: { day: 1, minute: 0 },
  weekClose: { day: 5, minute: 21 * 60 },
  dailyBreak: null,
};

const METALS_HOURS: TradingHours = {
  weekOpen: { day: 1, minute: 0 },
  weekClose: { day: 5, minute: 21 * 60 },
  dailyBreak: { from: 21 * 60, to: 22 * 60 },
};

/** Sunday 00:00 through Saturday 24:00, no daily break. */
const CRYPTO_HOURS: TradingHours = {
  weekOpen: { day: 0, minute: 0 },
  weekClose: { day: 6, minute: 24 * 60 },
  dailyBreak: null,
};

export const HOURS_BY_PRESET: Readonly<Record<HourPreset, TradingHours>> = {
  forex: FOREX_HOURS,
  metals: METALS_HOURS,
  indices: METALS_HOURS,
  crypto: CRYPTO_HOURS,
};

export interface InstrumentDraft {
  readonly symbol: string;
  readonly description: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly assetClass: AssetClass;
  readonly hours: HourPreset;
  readonly tickSize: number;
  readonly pipSize: number;
  readonly contractSize: number;
  readonly lotMin: number;
  readonly lotStep: number;
  readonly lotMax: number;
  readonly defaultSpread: number;
  readonly defaultCommissionPerLot: number;
  readonly active: boolean;
}

const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;
const CCY_RE = /^[A-Z0-9]{2,12}$/;

export function hoursPresetOf(hours: TradingHours): HourPreset {
  if (hours.dailyBreak) return 'metals';
  if (hours.weekOpen.day === 0) return 'crypto';
  return 'forex';
}

export function draftToSpec(draft: InstrumentDraft): InstrumentSpec {
  return {
    symbol: draft.symbol,
    description: draft.description,
    baseCurrency: draft.baseCurrency,
    quoteCurrency: draft.quoteCurrency,
    tickSize: draft.tickSize,
    pricePrecision: decimalsOf(draft.tickSize),
    qtyStep: draft.lotStep,
    pipSize: draft.pipSize,
    contractSize: draft.contractSize,
    lotMin: draft.lotMin,
    lotStep: draft.lotStep,
    lotMax: draft.lotMax,
    defaultSpread: draft.defaultSpread,
    defaultCommissionPerLot: draft.defaultCommissionPerLot,
    tradingHours: HOURS_BY_PRESET[draft.hours],
  };
}

/** Checks an admin instrument form. `reserved` is the built-in symbol set. */
export function parseInstrumentDraft(
  input: unknown,
  reserved: ReadonlySet<string>,
): { ok: true; draft: InstrumentDraft } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: 'مشخصات نماد نامعتبر است' };
  const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
  if (!SYMBOL_RE.test(symbol))
    return { ok: false, error: 'نماد باید ۲ تا ۲۰ حرف یا عدد انگلیسی باشد' };
  if (reserved.has(symbol))
    return { ok: false, error: 'این نماد از قبل در کندلو هست و قابل جایگزینی نیست' };
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 2 || description.length > 80) {
    return { ok: false, error: 'توضیح نماد باید بین ۲ تا ۸۰ نویسه باشد' };
  }
  const baseCurrency = currency(input.baseCurrency);
  const quoteCurrency = currency(input.quoteCurrency);
  if (!baseCurrency || !quoteCurrency)
    return { ok: false, error: 'ارز پایه و ارز قیمت را وارد کنید' };
  if (!isAssetClass(input.assetClass)) return { ok: false, error: 'دسته بازار را انتخاب کنید' };
  if (!isHourPreset(input.hours)) return { ok: false, error: 'ساعت معاملاتی را انتخاب کنید' };
  const tickSize = positive(input.tickSize);
  const pipSize = positive(input.pipSize);
  const contractSize = positive(input.contractSize);
  const lotMin = positive(input.lotMin);
  const lotStep = positive(input.lotStep);
  const lotMax = positive(input.lotMax);
  const defaultSpread = nonNegative(input.defaultSpread);
  const defaultCommissionPerLot = nonNegative(input.defaultCommissionPerLot);
  if (
    tickSize === null ||
    pipSize === null ||
    contractSize === null ||
    lotMin === null ||
    lotStep === null ||
    lotMax === null ||
    defaultSpread === null ||
    defaultCommissionPerLot === null
  ) {
    return { ok: false, error: 'اندازه قرارداد، تیک و حجم را با عدد معتبر وارد کنید' };
  }
  if (lotMax < lotMin) return { ok: false, error: 'سقف حجم نمی‌تواند کمتر از حداقل حجم باشد' };
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    return { ok: false, error: 'وضعیت نمایش نماد نامعتبر است' };
  }
  return {
    ok: true,
    draft: {
      symbol,
      description,
      baseCurrency,
      quoteCurrency,
      assetClass: input.assetClass,
      hours: input.hours,
      tickSize,
      pipSize,
      contractSize,
      lotMin,
      lotStep,
      lotMax,
      defaultSpread,
      defaultCommissionPerLot,
      active: input.active !== false,
    },
  };
}

function currency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toUpperCase();
  return CCY_RE.test(text) ? text : null;
}

function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function nonNegative(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function isAssetClass(value: unknown): value is AssetClass {
  return value === 'metals' || value === 'forex' || value === 'indices' || value === 'crypto';
}

function isHourPreset(value: unknown): value is HourPreset {
  return value === 'forex' || value === 'metals' || value === 'indices' || value === 'crypto';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
