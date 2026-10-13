import {
  aggregate,
  bucketStart,
  type BarsRequest,
  type BarsResponse,
  type Candle,
  type DataProvider,
  type SymbolInfo,
} from '@/lib/core';

/**
 * Wraps a DataProvider so nothing at or after the replay cursor can be read: bars are clipped
 * to the cursor and the bucket that contains it is rebuilt from 1-minute data up to the cursor
 * (the forming candle). Whatever the chart loads through this — any timeframe, history pages,
 * derived chart types — therefore never sees the future.
 */
export class CursorGatedProvider implements DataProvider {
  readonly id: string;
  readonly label: string;

  constructor(
    private readonly base: DataProvider,
    private readonly cursor: () => number,
    private readonly symbol: SymbolInfo,
  ) {
    this.id = `gated:${base.id}`;
    this.label = base.label;
  }

  async fetchBars(req: BarsRequest, signal?: AbortSignal): Promise<BarsResponse> {
    const cursor = this.cursor();
    const sym = this.symbol.symbol;
    if (req.startTime !== undefined && req.startTime >= cursor)
      return { bars: [], source: 'mock', hasMoreHistory: true };
    const end = Math.min(req.endTime ?? Infinity, cursor - 1);
    const res = await this.base.fetchBars({ ...req, symbol: sym, endTime: end }, signal);
    const bars = res.bars.filter((b) => b.time < cursor);
    const last = bars[bars.length - 1];
    const formingStart = bucketStart(cursor - 1, req.timeframe);
    if (last && last.time === formingStart && req.timeframe !== '1m') {
      const minutes = await this.base.fetchBars(
        {
          symbol: sym,
          timeframe: '1m',
          startTime: formingStart,
          endTime: cursor - 1,
          limit: 50_000,
        },
        signal,
      );
      const forming = formFrom(
        minutes.bars.filter((b) => b.time < cursor),
        req.timeframe,
      );
      if (forming) bars[bars.length - 1] = forming;
    }
    return { bars, source: res.source, hasMoreHistory: res.hasMoreHistory };
  }

  searchSymbols(): SymbolInfo[] {
    return [this.symbol];
  }

  getSymbolInfo(): SymbolInfo {
    return this.symbol;
  }
}

function formFrom(minutes: readonly Candle[], tf: BarsRequest['timeframe']): Candle | null {
  if (minutes.length === 0) return null;
  return aggregate(minutes, '1m', tf)[0] ?? null;
}
