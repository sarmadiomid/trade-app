import { DAY_MS, type DataProvider } from '@/lib/core';
import {
  ExcursionScanner,
  sessionEnd,
  type AccountConfig,
  type BacktestSession,
  type Excursion,
  type Trade,
} from '@/lib/backtest';

const MINUTE_PAGE = 20_000;

/**
 * Feeds every trade with an initial stop to the RR simulator: its original stop is followed
 * over the session's 1-minute data from the entry until it is hit, the 10R target is reached or
 * the session ends.
 */
export async function scanExcursions(
  market: DataProvider,
  session: BacktestSession,
  cfg: AccountConfig,
  trades: readonly Trade[],
  onProgress?: (done: number, total: number) => void,
): Promise<Excursion[]> {
  const end = Math.min(sessionEnd(session.settings), session.cursor);
  const out: Excursion[] = [];
  const list = trades.filter((t) => t.initialSl !== null);
  for (let i = 0; i < list.length; i++) {
    const t = list[i]!;
    const scanner = new ExcursionScanner(t, cfg.spread);
    if (!scanner.valid) continue;
    let from = Math.floor(t.entryTime / 60_000) * 60_000;
    let done = false;
    while (!done && from < end) {
      const to = Math.min(end, from + 3 * DAY_MS);
      const res = await market.fetchBars({
        symbol: session.settings.symbol,
        timeframe: '1m',
        startTime: from,
        endTime: to - 1,
        limit: MINUTE_PAGE,
      });
      for (const bar of res.bars)
        if (scanner.push(bar)) {
          done = true;
          break;
        }
      from = to;
    }
    out.push(scanner.result());
    onProgress?.(i + 1, list.length);
  }
  return out;
}
