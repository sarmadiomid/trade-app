/**
 * Helpers around dukascopy-node downloads.
 *
 * dukascopy-node ≤1.51 crashes inside getOHLC when a batch normalises to []
 * (`Cannot read properties of undefined (reading '0')`) — common for pairs
 * whose history is shorter than the requested window. We detect that and
 * retry the range in monthly chunks so sparse history still imports.
 */

export const DOWNLOAD_CHUNK_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export const DOWNLOAD_CHUNK_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DOWNLOAD_CHUNK_DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY_BATCH_RE =
  /Cannot read propert(?:y|ies) (?:of undefined \(reading ['"]0['"]\)|['"]0['"] of undefined)/i;

export function isDukascopyEmptyBatchError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  return EMPTY_BATCH_RE.test(err.message);
}

/** Half-open [from, to) slices, last slice ends at `to`. */
export function downloadChunks(
  from: number,
  to: number,
  chunkMs: number,
): readonly { from: number; to: number }[] {
  if (to <= from) return [];
  if (chunkMs <= 0) return [{ from, to }];
  const out: { from: number; to: number }[] = [];
  let cursor = from;
  while (cursor < to) {
    const end = Math.min(cursor + chunkMs, to);
    out.push({ from: cursor, to: end });
    cursor = end;
  }
  return out;
}
