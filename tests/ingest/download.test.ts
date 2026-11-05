import { describe, expect, it } from 'vitest';
import {
  DOWNLOAD_CHUNK_DAY_MS,
  DOWNLOAD_CHUNK_MONTH_MS,
  DOWNLOAD_CHUNK_WEEK_MS,
  downloadChunks,
  isDukascopyEmptyBatchError,
} from '@/server/ingest/download';

describe('isDukascopyEmptyBatchError', () => {
  it('matches the dukascopy-node getOHLC TypeError', () => {
    expect(
      isDukascopyEmptyBatchError(
        new TypeError("Cannot read properties of undefined (reading '0')"),
      ),
    ).toBe(true);
    expect(
      isDukascopyEmptyBatchError(new TypeError("Cannot read property '0' of undefined")),
    ).toBe(true);
  });

  it('ignores unrelated failures', () => {
    expect(isDukascopyEmptyBatchError(new TypeError('x is not a function'))).toBe(false);
    expect(
      isDukascopyEmptyBatchError(
        new Error("Cannot read properties of undefined (reading '0')"),
      ),
    ).toBe(false);
    expect(
      isDukascopyEmptyBatchError("Cannot read properties of undefined (reading '0')"),
    ).toBe(false);
  });
});

describe('downloadChunks', () => {
  it('returns nothing for empty ranges', () => {
    expect(downloadChunks(100, 100, DOWNLOAD_CHUNK_WEEK_MS)).toEqual([]);
    expect(downloadChunks(100, 50, DOWNLOAD_CHUNK_WEEK_MS)).toEqual([]);
  });

  it('keeps a short range as one chunk', () => {
    const from = Date.UTC(2025, 0, 1);
    const to = Date.UTC(2025, 0, 10);
    expect(downloadChunks(from, to, DOWNLOAD_CHUNK_MONTH_MS)).toEqual([{ from, to }]);
  });

  it('splits a long range into month-sized slices', () => {
    const from = Date.UTC(2024, 0, 1);
    const to = Date.UTC(2024, 0, 1) + DOWNLOAD_CHUNK_MONTH_MS * 2 + DOWNLOAD_CHUNK_WEEK_MS;
    const chunks = downloadChunks(from, to, DOWNLOAD_CHUNK_MONTH_MS);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ from, to: from + DOWNLOAD_CHUNK_MONTH_MS });
    expect(chunks[1]!.from).toBe(chunks[0]!.to);
    expect(chunks[chunks.length - 1]!.to).toBe(to);
  });

  it('can refine a month into days', () => {
    const from = Date.UTC(2024, 5, 1);
    const to = from + DOWNLOAD_CHUNK_MONTH_MS;
    const days = downloadChunks(from, to, DOWNLOAD_CHUNK_DAY_MS);
    expect(days.length).toBe(30);
    expect(days[0]!.from).toBe(from);
    expect(days[days.length - 1]!.to).toBe(to);
  });
});
