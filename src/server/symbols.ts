import 'server-only';
import type { Candle, InstrumentSpec, TimeframeId } from '@/lib/core';
import { DAY_MS, canAggregate, compareTimeframes, isTimeframeId } from '@/lib/core';
import {
  INSTRUMENTS,
  MOCK_MODELS,
  MAX_IMPORT_BARS,
  MAX_SYMBOL_BARS,
  assetClassOf,
  barsBetween,
  draftToSpec,
  fromTuples,
  normalizeBars,
  parseInstrumentDraft,
  projectBars,
  sliceCandles,
  type CatalogInstrument,
  type InstrumentDraft,
} from '@/lib/data';
import { collections, type InstrumentDoc, type MarketChunkDoc } from './db';

export class SymbolError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const RESERVED = new Set(INSTRUMENTS.map((item) => item.symbol));

export interface AdminSymbolRow {
  readonly symbol: string;
  readonly description: string;
  readonly assetClass: string;
  readonly source: 'builtin' | 'custom';
  readonly active: boolean;
  readonly timeframe: TimeframeId | null;
  readonly barCount: number;
  readonly dataStart: number | null;
  readonly dataEnd: number | null;
  readonly practiceReady: boolean;
}

export interface AdminSymbolDetail extends AdminSymbolRow {
  readonly draft: InstrumentDraft | null;
  readonly preview: Candle[];
  readonly series: readonly StoredSeries[];
}

interface CachedBook {
  readonly stamp: number;
  readonly frames: ReadonlyMap<TimeframeId, Candle[]>;
}

export interface StoredSeries {
  readonly timeframe: TimeframeId;
  readonly barCount: number;
  readonly dataStart: number;
  readonly dataEnd: number;
}

const seriesCache = new Map<string, CachedBook>();
const MAX_SERIES_CACHE = 32;

export type MarketLookup =
  | { readonly kind: 'builtin' }
  | {
      readonly kind: 'custom';
      readonly spec: InstrumentSpec;
      readonly timeframe: TimeframeId | null;
      readonly range: { readonly start: number; readonly end: number } | null;
    };

export async function lookupMarket(symbol: string): Promise<MarketLookup> {
  const doc = await findInstrument(symbol);
  if (!doc) return { kind: 'builtin' };
  const draft = docToDraft(doc);
  return {
    kind: 'custom',
    spec: draftToSpec(draft),
    timeframe: doc.timeframe,
    range:
      doc.dataStart !== null && doc.dataEnd !== null
        ? { start: doc.dataStart, end: doc.dataEnd }
        : null,
  };
}

export async function readMarketBars(
  symbol: string,
  req: {
    readonly timeframe: TimeframeId;
    readonly startTime?: number;
    readonly endTime?: number;
    readonly limit: number;
  },
): Promise<{ bars: Candle[]; hasMoreHistory: boolean } | null> {
  const book = await loadBook(symbol);
  if (!book) return null;
  const direct = book.frames.get(req.timeframe);
  if (direct) return sliceCandles(direct, req);
  let base: TimeframeId | null = null;
  for (const timeframe of book.frames.keys()) {
    if (!canAggregate(timeframe, req.timeframe)) continue;
    if (!base || compareTimeframes(timeframe, base) < 0) base = timeframe;
  }
  const bars = base ? book.frames.get(base) : undefined;
  if (!base || !bars) return { bars: [], hasMoreHistory: false };
  return projectBars(base, bars, req);
}

/** 1-minute bars for a custom symbol, or null when the symbol is built in. */
export async function readMarketMinutes(
  symbol: string,
  from: number,
  to: number,
): Promise<Candle[] | null> {
  const found = await lookupMarket(symbol);
  if (found.kind === 'builtin') return null;
  const book = await loadBook(symbol);
  const minutes = book?.frames.get('1m');
  if (!minutes) throw new SymbolError('برای تمرین این نماد به کندل یک‌دقیقه‌ای نیاز است');
  return barsBetween(minutes, from, to);
}

export async function listAdminSymbols(): Promise<AdminSymbolRow[]> {
  const builtin = INSTRUMENTS.map((item) => {
    const model = MOCK_MODELS[item.symbol];
    return {
      symbol: item.symbol,
      description: item.description,
      assetClass: assetClassOf(item.symbol),
      source: 'builtin' as const,
      active: true,
      timeframe: '1m' as const,
      barCount: 0,
      dataStart: model?.start ?? null,
      dataEnd: model?.end ?? null,
      practiceReady: true,
    };
  });
  const { instruments } = await collections();
  const custom = await instruments.find({}).sort({ updatedAt: -1 }).toArray();
  return [...custom.map(toRow), ...builtin];
}

export async function symbolDetail(symbol: string): Promise<AdminSymbolDetail | null> {
  const doc = await findInstrument(symbol);
  if (!doc) return null;
  const book = await loadBook(doc._id);
  const primary = book?.frames.get(doc.timeframe ?? '1m') ?? firstFrame(book);
  const preview = primary ? primary.slice(-120) : [];
  return { ...toRow(doc), draft: docToDraft(doc), preview, series: await listSeries(doc._id) };
}

export async function saveInstrument(input: unknown): Promise<AdminSymbolRow> {
  const parsed = parseInstrumentDraft(input, RESERVED);
  if (!parsed.ok) throw new SymbolError(parsed.error);
  const { instruments } = await collections();
  const now = new Date();
  const draft = parsed.draft;
  await instruments.updateOne(
    { _id: draft.symbol },
    {
      $set: {
        description: draft.description,
        baseCurrency: draft.baseCurrency,
        quoteCurrency: draft.quoteCurrency,
        assetClass: draft.assetClass,
        hours: draft.hours,
        tickSize: draft.tickSize,
        pipSize: draft.pipSize,
        contractSize: draft.contractSize,
        lotMin: draft.lotMin,
        lotStep: draft.lotStep,
        lotMax: draft.lotMax,
        defaultSpread: draft.defaultSpread,
        defaultCommissionPerLot: draft.defaultCommissionPerLot,
        active: draft.active,
        updatedAt: now,
      },
      $setOnInsert: {
        timeframe: null,
        barCount: 0,
        dataStart: null,
        dataEnd: null,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  const saved = await instruments.findOne({ _id: draft.symbol });
  if (!saved) throw new SymbolError('ذخیرهٔ نماد انجام نشد', 500);
  return toRow(saved);
}

export async function removeInstrument(symbol: string): Promise<void> {
  const key = symbol.trim().toUpperCase();
  if (RESERVED.has(key)) throw new SymbolError('نمادهای داخلی کندلو حذف نمی‌شوند');
  const { instruments, marketChunks } = await collections();
  const found = await instruments.findOne({ _id: key }, { projection: { _id: 1 } });
  if (!found) throw new SymbolError('این نماد پیدا نشد', 404);
  await marketChunks.deleteMany({ symbol: key });
  await instruments.deleteOne({ _id: key });
  seriesCache.delete(key);
}

export async function importSymbolBars(
  symbol: string,
  timeframe: unknown,
  rows: unknown,
  mode: unknown,
): Promise<AdminSymbolRow> {
  if (!isTimeframeId(timeframe)) throw new SymbolError('تایم‌فریم نامعتبر است');
  if (mode !== 'replace' && mode !== 'append') throw new SymbolError('حالت ورود داده نامعتبر است');
  const doc = await findInstrument(symbol);
  if (!doc) throw new SymbolError('اول مشخصات نماد را ذخیره کنید', 404);
  const incoming = tuplesFrom(rows);
  if (incoming.length === 0) throw new SymbolError('کندلی برای ذخیره نیست');
  if (incoming.length > MAX_IMPORT_BARS)
    throw new SymbolError('هر بخش حداکثر ۲۰ هزار کندل می‌پذیرد');
  const normalized = normalizeBars(fromTuples(incoming), timeframe);
  if (!normalized.ok) throw new SymbolError(normalized.error);
  const { marketChunks, instruments } = await collections();
  const existingCount = mode === 'replace' ? 0 : await countTimeframe(doc._id, timeframe);
  if (existingCount + normalized.bars.length > MAX_SYMBOL_BARS) {
    throw new SymbolError('مجموع کندل‌های این تایم‌فریم از ۲۰۰ هزار گذشته است');
  }
  if (mode === 'replace') {
    await marketChunks.deleteMany({ symbol: doc._id, timeframe });
  }
  const grouped = groupByMonth(normalized.bars);
  for (const [month, bars] of grouped) {
    const id = chunkId(doc._id, timeframe, month);
    let merged = bars;
    if (mode === 'append') {
      const existing = await marketChunks.findOne({ _id: id });
      if (existing) merged = mergeCandles(fromTuples(existing.bars), bars);
    }
    if (merged.length === 0) continue;
    const first = merged[0]!;
    const last = merged[merged.length - 1]!;
    const chunk: MarketChunkDoc = {
      _id: id,
      symbol: doc._id,
      timeframe,
      month,
      count: merged.length,
      start: first.time,
      end: last.time,
      bars: merged.map((bar) => [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]),
      updatedAt: new Date(),
    };
    await marketChunks.replaceOne({ _id: id }, chunk, { upsert: true });
  }
  const summary = await summarize(doc._id);
  const now = new Date();
  await instruments.updateOne(
    { _id: doc._id },
    {
      $set: {
        timeframe: summary.timeframe,
        barCount: summary.barCount,
        dataStart: summary.dataStart,
        dataEnd: summary.dataEnd,
        updatedAt: now,
      },
    },
  );
  seriesCache.delete(doc._id);
  const saved = await instruments.findOne({ _id: doc._id });
  if (!saved) throw new SymbolError('ذخیرهٔ داده انجام نشد', 500);
  return toRow(saved);
}

export async function publishedCatalog(): Promise<CatalogInstrument[]> {
  const { instruments } = await collections();
  const docs = await instruments
    .find({ active: true, timeframe: '1m', barCount: { $gt: 0 } })
    .toArray();
  const out: CatalogInstrument[] = [];
  for (const doc of docs) {
    if (doc.dataStart === null || doc.dataEnd === null) continue;
    const draft = docToDraft(doc);
    out.push({
      ...draftToSpec(draft),
      assetClass: draft.assetClass,
      dataStart: doc.dataStart,
      dataEnd: doc.dataEnd,
    });
  }
  return out;
}

async function findInstrument(symbol: string): Promise<InstrumentDoc | null> {
  const key = symbol.trim().toUpperCase();
  if (!key || RESERVED.has(key)) return null;
  const { instruments } = await collections();
  return instruments.findOne({ _id: key });
}

async function loadBook(symbol: string): Promise<CachedBook | null> {
  const doc = await findInstrument(symbol);
  if (!doc || !doc.active || doc.barCount <= 0) return null;
  const stamp = doc.updatedAt.getTime();
  const hit = seriesCache.get(doc._id);
  if (hit && hit.stamp === stamp) return hit;
  const { marketChunks } = await collections();
  const chunks = await marketChunks.find({ symbol: doc._id }).sort({ month: 1 }).toArray();
  const frames = new Map<TimeframeId, Candle[]>();
  for (const chunk of chunks) {
    const bars = frames.get(chunk.timeframe) ?? [];
    bars.push(...fromTuples(chunk.bars));
    frames.set(chunk.timeframe, bars);
  }
  const book = { stamp, frames };
  if (seriesCache.size >= MAX_SERIES_CACHE) seriesCache.delete(seriesCache.keys().next().value!);
  seriesCache.set(doc._id, book);
  return book;
}

async function listSeries(symbol: string): Promise<StoredSeries[]> {
  const { marketChunks } = await collections();
  const rows = await marketChunks
    .aggregate<{ _id: TimeframeId; count: number; start: number; end: number }>([
      { $match: { symbol } },
      {
        $group: {
          _id: '$timeframe',
          count: { $sum: '$count' },
          start: { $min: '$start' },
          end: { $max: '$end' },
        },
      },
    ])
    .toArray();
  return rows
    .filter((row) => isTimeframeId(row._id) && row.count > 0)
    .map((row) => ({
      timeframe: row._id,
      barCount: row.count,
      dataStart: row.start,
      dataEnd: row.end,
    }))
    .sort((a, b) => compareTimeframes(a.timeframe, b.timeframe));
}

async function countTimeframe(symbol: string, timeframe: TimeframeId): Promise<number> {
  const { marketChunks } = await collections();
  const rows = await marketChunks
    .aggregate<{ count: number }>([
      { $match: { symbol, timeframe } },
      { $group: { _id: null, count: { $sum: '$count' } } },
    ])
    .toArray();
  return rows[0]?.count ?? 0;
}

/** Practice follows the 1-minute file when it exists; otherwise the finest stored series. */
async function summarize(symbol: string): Promise<{
  timeframe: TimeframeId | null;
  barCount: number;
  dataStart: number | null;
  dataEnd: number | null;
}> {
  const series = await listSeries(symbol);
  const primary = series.find((item) => item.timeframe === '1m') ?? series[0];
  if (!primary) return { timeframe: null, barCount: 0, dataStart: null, dataEnd: null };
  return {
    timeframe: primary.timeframe,
    barCount: primary.barCount,
    dataStart: primary.dataStart,
    dataEnd: primary.dataEnd + DAY_MS,
  };
}

function firstFrame(book: CachedBook | null): Candle[] | undefined {
  if (!book) return undefined;
  let best: TimeframeId | null = null;
  for (const timeframe of book.frames.keys()) {
    if (!best || compareTimeframes(timeframe, best) < 0) best = timeframe;
  }
  return best ? book.frames.get(best) : undefined;
}

function toRow(doc: InstrumentDoc): AdminSymbolRow {
  return {
    symbol: doc._id,
    description: doc.description,
    assetClass: doc.assetClass,
    source: 'custom',
    active: doc.active,
    timeframe: doc.timeframe,
    barCount: doc.barCount,
    dataStart: doc.dataStart,
    dataEnd: doc.dataEnd,
    practiceReady: doc.active && doc.timeframe === '1m' && doc.barCount > 0,
  };
}

function docToDraft(doc: InstrumentDoc): InstrumentDraft {
  return {
    symbol: doc._id,
    description: doc.description,
    baseCurrency: doc.baseCurrency,
    quoteCurrency: doc.quoteCurrency,
    assetClass: doc.assetClass,
    hours: doc.hours,
    tickSize: doc.tickSize,
    pipSize: doc.pipSize,
    contractSize: doc.contractSize,
    lotMin: doc.lotMin,
    lotStep: doc.lotStep,
    lotMax: doc.lotMax,
    defaultSpread: doc.defaultSpread,
    defaultCommissionPerLot: doc.defaultCommissionPerLot,
    active: doc.active,
  };
}

function tuplesFrom(rows: unknown): number[][] {
  if (!Array.isArray(rows)) throw new SymbolError('دادهٔ کندل نامعتبر است');
  const out: number[][] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6)
      throw new SymbolError('هر کندل باید زمان، قیمت‌ها و حجم داشته باشد');
    const tuple = row.slice(0, 6).map((value) => Number(value));
    if (tuple.some((value) => !Number.isFinite(value)))
      throw new SymbolError('یکی از کندل‌ها عدد نامعتبر دارد');
    out.push(tuple);
  }
  return out;
}

function groupByMonth(bars: readonly Candle[]): Map<number, Candle[]> {
  const groups = new Map<number, Candle[]>();
  for (const bar of bars) {
    const month = monthOf(bar.time);
    const list = groups.get(month);
    if (list) list.push(bar);
    else groups.set(month, [bar]);
  }
  return groups;
}

function mergeCandles(existing: readonly Candle[], incoming: readonly Candle[]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const bar of existing) byTime.set(bar.time, bar);
  for (const bar of incoming) byTime.set(bar.time, bar);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function monthOf(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function chunkId(symbol: string, timeframe: TimeframeId, month: number): string {
  return `${symbol}:${timeframe}:${month}`;
}
