import 'server-only';
import { getHistoricalRates, RateLimitError } from 'dukascopy-node';
import { MAX_IMPORT_BARS } from '@/lib/data';
import type { TimeframeId } from '@/lib/core';
import type { InstrumentDoc, InstrumentIngestState } from '../db';
import { collections } from '../db';
import { importSymbolBars, SymbolError } from '../symbols';
import { ingestConfig } from './config';
import {
  DOWNLOAD_CHUNK_DAY_MS,
  DOWNLOAD_CHUNK_MONTH_MS,
  DOWNLOAD_CHUNK_WEEK_MS,
  downloadChunks,
  isDukascopyEmptyBatchError,
} from './download';
import { INGEST_TIMEFRAMES, type DukascopyTimeframe } from './timeframes';
import { windowFor, type IngestMode } from './windows';

export type { IngestMode } from './windows';
export { needsBootstrap, windowFor } from './windows';
export { INGEST_TIMEFRAMES } from './timeframes';

export interface IngestSymbolResult {
  readonly symbol: string;
  readonly mode: IngestMode;
  readonly ok: boolean;
  readonly bars: number;
  readonly from: number;
  readonly to: number;
  readonly error?: string;
  readonly byTimeframe?: Readonly<Partial<Record<TimeframeId, number>>>;
}

interface DukascopyCandle {
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
}

/** Active catalog symbols that have a Dukascopy id and ingest enabled. */
export async function listIngestTargets(): Promise<InstrumentDoc[]> {
  const { instruments } = await collections();
  const docs = await instruments
    .find({
      active: true,
      dukascopyId: { $exists: true, $nin: [null, ''] },
      $or: [{ ingest: null }, { ingest: { $exists: false } }, { 'ingest.enabled': { $ne: false } }],
    })
    .sort({ _id: 1 })
    .toArray();
  return docs.filter(
    (doc) =>
      typeof doc.dukascopyId === 'string' &&
      doc.dukascopyId.length > 0 &&
      doc.ingest?.enabled !== false,
  );
}

/** Download all mapped candle timeframes and append into market_chunks. */
export async function ingestSymbol(
  doc: InstrumentDoc,
  mode: IngestMode,
  now = Date.now(),
): Promise<IngestSymbolResult> {
  const dukascopyId = doc.dukascopyId;
  if (!dukascopyId) {
    return {
      symbol: doc._id,
      mode,
      ok: false,
      bars: 0,
      from: 0,
      to: 0,
      error: 'dukascopyId missing',
    };
  }

  const { from, to } = windowFor(doc, mode, now);
  await patchIngest(doc._id, {
    runningSince: new Date(now),
    lastRunAt: new Date(now),
    lastError: null,
    lastFrom: from,
    lastTo: to,
  });

  const byTimeframe: Partial<Record<TimeframeId, number>> = {};
  let imported = 0;

  try {
    for (const tf of INGEST_TIMEFRAMES) {
      console.warn(`[ingest] ${doc._id} ${tf.dukascopy}→${tf.app}…`);
      const candles = await downloadCandles(dukascopyId, tf.dukascopy, from, to);
      const count = await importCandles(doc._id, tf.app, candles);
      byTimeframe[tf.app] = count;
      imported += count;
      if (ingestConfig.pauseBetweenTimeframesMs > 0) {
        await sleep(ingestConfig.pauseBetweenTimeframesMs);
      }
    }

    const successAt = new Date();
    const ingestPatch: Partial<InstrumentIngestState> = {
      runningSince: null,
      lastSuccessAt: successAt,
      lastError: null,
      lastBarCount: imported,
      lastFrom: from,
      lastTo: to,
      enabled: true,
    };
    if (mode === 'bootstrap') ingestPatch.bootstrappedAt = successAt;

    await patchIngest(doc._id, ingestPatch);
    return { symbol: doc._id, mode, ok: true, bars: imported, from, to, byTimeframe };
  } catch (err) {
    const message = formatIngestError(err);
    await patchIngest(doc._id, {
      runningSince: null,
      lastError: message,
      lastFrom: from,
      lastTo: to,
      lastBarCount: imported,
    });
    return {
      symbol: doc._id,
      mode,
      ok: false,
      bars: imported,
      from,
      to,
      error: message,
      byTimeframe,
    };
  }
}

async function importCandles(
  symbol: string,
  timeframe: TimeframeId,
  candles: readonly DukascopyCandle[],
): Promise<number> {
  if (candles.length === 0) return 0;
  const tuples = candles.map((bar) => [
    bar.timestamp,
    bar.open,
    bar.high,
    bar.low,
    bar.close,
    bar.volume ?? 0,
  ]);
  const parts = Math.ceil(tuples.length / MAX_IMPORT_BARS);
  let imported = 0;
  for (let i = 0; i < parts; i++) {
    const slice = tuples.slice(i * MAX_IMPORT_BARS, (i + 1) * MAX_IMPORT_BARS);
    await importSymbolBars(symbol, timeframe, slice, 'append');
    imported += slice.length;
  }
  return imported;
}

async function downloadCandles(
  instrument: string,
  timeframe: DukascopyTimeframe,
  from: number,
  to: number,
): Promise<DukascopyCandle[]> {
  if (to <= from) return [];
  try {
    return await downloadCandlesRange(instrument, timeframe, from, to);
  } catch (err) {
    if (!isDukascopyEmptyBatchError(err)) throw err;
    // dukascopy-node getOHLC crashes on empty day batches inside a wide window.
    // Fall back to monthly slices so pairs with short/sparse history still import.
    console.warn(
      `[ingest] ${instrument} ${timeframe}: empty-batch crash on full window; retrying monthly`,
    );
    return downloadCandlesChunked(instrument, timeframe, from, to);
  }
}

async function downloadCandlesChunked(
  instrument: string,
  timeframe: DukascopyTimeframe,
  from: number,
  to: number,
): Promise<DukascopyCandle[]> {
  const out: DukascopyCandle[] = [];
  for (const month of downloadChunks(from, to, DOWNLOAD_CHUNK_MONTH_MS)) {
    const part = await downloadCandlesRefining(instrument, timeframe, month.from, month.to, [
      DOWNLOAD_CHUNK_WEEK_MS,
      DOWNLOAD_CHUNK_DAY_MS,
    ]);
    out.push(...part);
    if (ingestConfig.pauseBetweenTimeframesMs > 0) {
      await sleep(ingestConfig.pauseBetweenTimeframesMs);
    }
  }
  return out;
}

/**
 * Try a range; on empty-batch crash, split with the next finer size until days,
 * then skip days that still crash.
 */
async function downloadCandlesRefining(
  instrument: string,
  timeframe: DukascopyTimeframe,
  from: number,
  to: number,
  refineMs: readonly number[],
): Promise<DukascopyCandle[]> {
  try {
    return await downloadCandlesRange(instrument, timeframe, from, to);
  } catch (err) {
    if (!isDukascopyEmptyBatchError(err)) throw err;
  }

  const next = refineMs[0];
  if (next === undefined || to - from <= next) {
    console.warn(
      `[ingest] ${instrument} ${timeframe}: skip empty chunk ${new Date(from).toISOString()}→${new Date(to).toISOString()}`,
    );
    return [];
  }

  const out: DukascopyCandle[] = [];
  const rest = refineMs.slice(1);
  for (const piece of downloadChunks(from, to, next)) {
    out.push(...(await downloadCandlesRefining(instrument, timeframe, piece.from, piece.to, rest)));
    if (ingestConfig.pauseBetweenTimeframesMs > 0) {
      await sleep(ingestConfig.pauseBetweenTimeframesMs);
    }
  }
  return out;
}

async function downloadCandlesRange(
  instrument: string,
  timeframe: DukascopyTimeframe,
  from: number,
  to: number,
): Promise<DukascopyCandle[]> {
  if (to <= from) return [];
  const data = await getHistoricalRates({
    instrument: instrument as never,
    dates: { from: new Date(from), to: new Date(to) },
    timeframe,
    priceType: 'bid',
    volumes: true,
    format: 'json',
    useCache: true,
    cacheFolderPath: ingestConfig.cachePath,
    retryCount: 3,
    rateLimitRetryCount: 3,
    batchSize: 10,
    pauseBetweenBatchesMs: 1000,
    failAfterRetryCount: true,
  });

  if (!Array.isArray(data)) {
    throw new Error('dukascopy-node returned a non-array payload');
  }
  return parseDukascopyCandles(data);
}

function parseDukascopyCandles(data: readonly unknown[]): DukascopyCandle[] {
  const out: DukascopyCandle[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const candle = row as Partial<DukascopyCandle>;
    if (
      typeof candle.timestamp !== 'number' ||
      typeof candle.open !== 'number' ||
      typeof candle.high !== 'number' ||
      typeof candle.low !== 'number' ||
      typeof candle.close !== 'number'
    ) {
      continue;
    }
    out.push({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: typeof candle.volume === 'number' ? candle.volume : 0,
    });
  }
  return out;
}

async function patchIngest(symbol: string, patch: Partial<InstrumentIngestState>): Promise<void> {
  const { instruments } = await collections();
  const doc = await instruments.findOne({ _id: symbol });
  const base: InstrumentIngestState = doc?.ingest ?? {
    enabled: true,
    bootstrappedAt: null,
    runningSince: null,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastFrom: null,
    lastTo: null,
    lastBarCount: null,
  };
  await instruments.updateOne(
    { _id: symbol },
    {
      $set: {
        ingest: { ...base, ...patch },
        updatedAt: new Date(),
      },
    },
  );
}

function formatIngestError(err: unknown): string {
  if (err instanceof RateLimitError) return `rate limited: ${err.message}`;
  if (err instanceof SymbolError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
