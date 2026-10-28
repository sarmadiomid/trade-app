import type { BarsRequest, BarsResponse, InstrumentSpec } from '@/lib/core';
import { customRange, customSpec } from './custom-catalog';
import { MockMarketProvider } from './mock/mock-market-provider';
import { MOCK_MODELS } from './mock/models';

/**
 * Built-in symbols stay on the seeded market. Anything else is loaded from the
 * admin catalogue, and never silently replaced with gold.
 */
export class HybridMarketProvider extends MockMarketProvider {
  override async fetchBars(req: BarsRequest): Promise<BarsResponse> {
    if (isBuiltIn(req.symbol)) return super.fetchBars(req);
    return remoteBars(req);
  }

  override getSymbolInfo(symbol: string): InstrumentSpec {
    return customSpec(symbol) ?? super.getSymbolInfo(symbol);
  }

  override dataRange(symbol: string): { readonly start: number; readonly end: number } {
    if (isBuiltIn(symbol)) return super.dataRange(symbol);
    return customRange(symbol) ?? { start: 0, end: 0 };
  }

  override minuteBars(symbol: string, from: number, to: number) {
    if (!isBuiltIn(symbol)) return [];
    return super.minuteBars(symbol, from, to);
  }

  override generate(req: BarsRequest): BarsResponse {
    if (!isBuiltIn(req.symbol)) return { bars: [], source: 'catalog', hasMoreHistory: false };
    return super.generate(req);
  }
}

function isBuiltIn(symbol: string): boolean {
  return MOCK_MODELS[symbol.trim().toUpperCase()] !== undefined;
}

async function remoteBars(req: BarsRequest): Promise<BarsResponse> {
  const empty: BarsResponse = { bars: [], source: 'catalog', hasMoreHistory: false };
  if (typeof window === 'undefined') return empty;
  const query = new URLSearchParams({
    symbol: req.symbol.toUpperCase(),
    timeframe: req.timeframe,
    limit: String(req.limit),
  });
  if (req.startTime !== undefined) query.set('startTime', String(req.startTime));
  if (req.endTime !== undefined) query.set('endTime', String(req.endTime));
  try {
    const res = await fetch(`/api/market/bars?${query}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return empty;
    const body = (await res.json()) as { bars?: BarsResponse['bars']; hasMoreHistory?: boolean };
    return {
      bars: Array.isArray(body.bars) ? body.bars : [],
      source: 'catalog',
      hasMoreHistory: body.hasMoreHistory === true,
    };
  } catch {
    return empty;
  }
}

export function isCatalogSymbol(symbol: string): boolean {
  return !isBuiltIn(symbol);
}
