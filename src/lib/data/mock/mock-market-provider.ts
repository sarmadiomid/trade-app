import {
  aggregate,
  HOUR_MS,
  TIMEFRAMES,
  type BarsRequest,
  type BarsResponse,
  type Candle,
  type DataProvider,
  type InstrumentSpec,
  type SymbolInfo,
  type TimeframeId,
} from '@/lib/core';
import { INSTRUMENTS, instrumentSpec } from '../instruments';
import { buildDailyPath, type DailyPath } from './daily-path';
import { generateDay, type DayBars } from './minute-day';
import { MOCK_MODELS, type MockModel } from './models';

/** Trading days of 1-minute bars kept in memory (≈ 4.5 months). */
const MINUTE_CACHE_DAYS = 100;

interface ModelState {
  readonly model: MockModel;
  readonly spec: InstrumentSpec;
  readonly path: DailyPath;
  readonly minutes: Map<number, DayBars>;
  readonly hours: Map<number, Candle[]>;
  readonly dayBars: Array<Candle | undefined>;
}

/**
 * Deterministic, seeded market data for the backtest instruments. The 1-minute bars are the
 * source of truth: every higher timeframe is aggregated from them (hours and days are cached as
 * they are computed). Implements the regular DataProvider port, so a real database or API can
 * replace it without touching anything else.
 */
export class MockMarketProvider implements DataProvider {
  readonly id = 'mock-market';
  readonly label = 'Mock market (seeded)';
  private readonly states = new Map<string, ModelState>();

  async fetchBars(req: BarsRequest): Promise<BarsResponse> {
    return this.generate(req);
  }

  /** Synchronous variant of fetchBars (tests, workers). */
  generate(req: BarsRequest): BarsResponse {
    const st = this.state(req.symbol);
    const tf = req.timeframe;
    const limit = Math.max(0, Math.floor(req.limit));
    const end = Math.min(req.endTime ?? Infinity, st.model.end - 1);
    if (TIMEFRAMES[tf].unit === 'week' || TIMEFRAMES[tf].unit === 'month')
      return this.calendarBars(st, tf, req.startTime, end, limit);
    const { path } = st;
    const bars: Candle[] = [];
    if (req.startTime !== undefined) {
      const start = req.startTime;
      for (let i = path.firstAtOrAfter(start); i < path.days.length && bars.length < limit; i++) {
        if (path.days[i]! > end) break;
        for (const b of this.dayTf(st, i, tf)) {
          if (b.time < start) continue;
          if (b.time > end || bars.length >= limit) break;
          bars.push(b);
        }
      }
      return { bars, source: 'mock', hasMoreHistory: path.firstAtOrAfter(start) > 0 };
    }
    let i = path.lastAtOrBefore(end);
    const chunks: Candle[][] = [];
    let count = 0;
    for (; i >= 0 && count < limit; i--) {
      const day = this.dayTf(st, i, tf).filter((b) => b.time <= end);
      const take = day.slice(Math.max(0, day.length - (limit - count)));
      chunks.push(take);
      count += take.length;
    }
    for (let c = chunks.length - 1; c >= 0; c--) bars.push(...chunks[c]!);
    return { bars, source: 'mock', hasMoreHistory: i >= 0 };
  }

  /** 1-minute bars with `from <= time < to` (synchronous). */
  minuteBars(symbol: string, from: number, to: number): Candle[] {
    const st = this.state(symbol);
    const out: Candle[] = [];
    for (let i = st.path.firstAtOrAfter(from); i < st.path.days.length; i++) {
      if (st.path.days[i]! >= to) break;
      const d = this.minuteDay(st, i);
      for (let k = 0; k < d.length; k++) {
        const t = d.time[k]!;
        if (t < from) continue;
        if (t >= to) break;
        out.push(barAt(d, k));
      }
    }
    return out;
  }

  /** [first, end) of the available data for `symbol`. */
  dataRange(symbol: string): { readonly start: number; readonly end: number } {
    const { model } = this.state(symbol);
    return { start: model.start, end: model.end };
  }

  searchSymbols(query: string): SymbolInfo[] {
    const q = query.trim().toUpperCase();
    return INSTRUMENTS.filter(
      (s) => MOCK_MODELS[s.symbol] && (!q || s.symbol.includes(q) || s.description.includes(q)),
    );
  }

  getSymbolInfo(symbol: string): InstrumentSpec {
    return this.state(symbol).spec;
  }

  // ---- internals --------------------------------------------------------------------------

  private state(symbol: string): ModelState {
    const key = MOCK_MODELS[symbol.toUpperCase()] ? symbol.toUpperCase() : 'XAUUSD';
    let st = this.states.get(key);
    if (!st) {
      const model = MOCK_MODELS[key]!;
      const spec = instrumentSpec(key)!;
      st = {
        model,
        spec,
        path: buildDailyPath(model, spec.tradingHours),
        minutes: new Map(),
        hours: new Map(),
        dayBars: [],
      };
      this.states.set(key, st);
    }
    return st;
  }

  private minuteDay(st: ModelState, i: number): DayBars {
    const cached = st.minutes.get(i);
    if (cached) {
      st.minutes.delete(i);
      st.minutes.set(i, cached);
      return cached;
    }
    const d = generateDay(st.model, st.path, i, st.spec.tradingHours);
    st.minutes.set(i, d);
    if (st.minutes.size > MINUTE_CACHE_DAYS) st.minutes.delete(st.minutes.keys().next().value!);
    return d;
  }

  private hourBars(st: ModelState, i: number): Candle[] {
    let h = st.hours.get(i);
    if (!h) {
      h = summarize(this.minuteDay(st, i), HOUR_MS);
      st.hours.set(i, h);
    }
    return h;
  }

  private dayBar(st: ModelState, i: number): Candle {
    let b = st.dayBars[i];
    if (!b) {
      const h = this.hourBars(st, i);
      b = aggregate(h, '1h', '1D')[0]!;
      st.dayBars[i] = b;
    }
    return b;
  }

  /** Bars of an intraday or daily timeframe that fall on trading day `i`. */
  private dayTf(st: ModelState, i: number, tf: TimeframeId): Candle[] {
    if (tf === '1D') return [this.dayBar(st, i)];
    if (tf === '1h') return this.hourBars(st, i);
    if (TIMEFRAMES[tf].unit === 'hour') return aggregate(this.hourBars(st, i), '1h', tf);
    const d = this.minuteDay(st, i);
    const bars: Candle[] = [];
    for (let k = 0; k < d.length; k++) bars.push(barAt(d, k));
    return tf === '1m' ? bars : aggregate(bars, '1m', tf);
  }

  private calendarBars(
    st: ModelState,
    tf: TimeframeId,
    start: number | undefined,
    end: number,
    limit: number,
  ): BarsResponse {
    const last = st.path.lastAtOrBefore(end);
    const days: Candle[] = [];
    for (let i = 0; i <= last; i++) days.push(this.dayBar(st, i));
    const all = aggregate(days, '1D', tf);
    if (start !== undefined) {
      const bars = all.filter((b) => b.time >= start).slice(0, limit);
      return { bars, source: 'mock', hasMoreHistory: all.length > 0 && all[0]!.time < start };
    }
    const bars = all.slice(Math.max(0, all.length - limit));
    return { bars, source: 'mock', hasMoreHistory: all.length > bars.length };
  }
}

/** Buckets of `span` ms over a day's minute columns (no intermediate objects). */
function summarize(d: DayBars, span: number): Candle[] {
  const out: Candle[] = [];
  let acc: Candle | null = null;
  for (let k = 0; k < d.length; k++) {
    const t = Math.floor(d.time[k]! / span) * span;
    if (acc && acc.time === t) {
      if (d.high[k]! > acc.high) acc.high = d.high[k]!;
      if (d.low[k]! < acc.low) acc.low = d.low[k]!;
      acc.close = d.close[k]!;
      acc.volume += d.volume[k]!;
    } else {
      acc = barAt(d, k);
      acc.time = t;
      out.push(acc);
    }
  }
  return out;
}

function barAt(d: DayBars, k: number): Candle {
  return {
    time: d.time[k]!,
    open: d.open[k]!,
    high: d.high[k]!,
    low: d.low[k]!,
    close: d.close[k]!,
    volume: d.volume[k]!,
  };
}
