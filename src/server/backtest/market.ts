import 'server-only';
import { MockMarketProvider } from '@/lib/data';

const globalForMarket = globalThis as unknown as { __practiceMarket?: MockMarketProvider };

/** The same seeded market the browser replays, so a server fill matches the chart. */
export function practiceMarket(): MockMarketProvider {
  globalForMarket.__practiceMarket ??= new MockMarketProvider();
  return globalForMarket.__practiceMarket;
}
