import type { InstrumentSpec, TradingHours } from '@/lib/core';
import { setAssetClasses, type AssetClass } from './instruments';

/** One admin-published instrument the practice picker and the chart can use. */
export interface CatalogInstrument {
  readonly symbol: string;
  readonly description: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly tickSize: number;
  readonly pricePrecision: number;
  readonly qtyStep: number;
  readonly pipSize: number;
  readonly contractSize: number;
  readonly lotMin: number;
  readonly lotStep: number;
  readonly lotMax: number;
  readonly defaultSpread: number;
  readonly defaultCommissionPerLot: number;
  readonly tradingHours: TradingHours;
  readonly assetClass: AssetClass;
  readonly dataStart: number;
  readonly dataEnd: number;
}

let installed: readonly CatalogInstrument[] = [];
let version = 0;
let ready = false;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function customCatalogVersion(): number {
  return version;
}

export function subscribeCustomCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function customInstruments(): readonly CatalogInstrument[] {
  return installed;
}

export function customSpec(symbol: string): InstrumentSpec | null {
  const found = installed.find((item) => item.symbol === symbol.trim().toUpperCase());
  if (!found) return null;
  const { assetClass: _asset, dataStart: _start, dataEnd: _end, ...spec } = found;
  return spec;
}

export function customRange(symbol: string): { start: number; end: number } | null {
  const found = installed.find((item) => item.symbol === symbol.trim().toUpperCase());
  if (!found) return null;
  return { start: found.dataStart, end: found.dataEnd };
}

export function installCustomCatalog(instruments: readonly CatalogInstrument[]): void {
  installed = instruments.map((item) => ({ ...item, symbol: item.symbol.toUpperCase() }));
  setAssetClasses(installed.map((item) => ({ symbol: item.symbol, assetClass: item.assetClass })));
  ready = true;
  version += 1;
  listeners.forEach((listener) => listener());
}

/** Loads the published catalogue once per page. Safe to call from several screens. */
export function ensureCustomCatalog(): Promise<void> {
  if (typeof window === 'undefined' || ready) return Promise.resolve();
  pending ??= fetch('/api/catalog', { credentials: 'same-origin', cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return;
      const body = (await res.json()) as { instruments?: CatalogInstrument[] };
      if (Array.isArray(body.instruments)) installCustomCatalog(body.instruments);
    })
    .catch(() => {})
    .finally(() => {
      if (!ready) installCustomCatalog([]);
    });
  return pending;
}
