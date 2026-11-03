/**
 * Dukascopy catalog ingest worker.
 *
 *   npm run ingest:dukascopy                  # one auto pass (bootstrap pending, else refresh)
 *   npm run ingest:dukascopy -- --loop        # 12h loop for Docker
 *   npm run ingest:dukascopy -- --mode bootstrap --symbol EURUSD
 *
 * Uses --conditions=react-server so `server-only` modules resolve in plain Node.
 *
 * Proxy (sing-box / HTTP / SOCKS): set DUKASCOPY_PROXY or HTTPS_PROXY before running.
 */

import { applyIngestProxy } from '../src/server/ingest/proxy';
import { runIngestLoop, runIngestPass } from '../src/server/ingest/run';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const proxy = await applyIngestProxy();
  if (proxy) console.warn(`[ingest] using proxy ${proxy}`);
  else console.warn('[ingest] no proxy configured (DUKASCOPY_PROXY / HTTPS_PROXY)');

  if (has('--loop')) {
    await runIngestLoop();
    return;
  }

  const modeRaw = arg('--mode');
  const mode =
    modeRaw === 'bootstrap' || modeRaw === 'refresh' || modeRaw === 'auto'
      ? modeRaw
      : 'auto';
  const symbol = arg('--symbol');
  const summary = await runIngestPass({
    mode,
    ...(symbol ? { symbol } : {}),
  });

  const failed = summary.results.filter((r) => !r.ok);
  if (summary.skippedLock) process.exit(0);
  if (failed.length > 0) {
    console.error(`[ingest] ${failed.length} symbol(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
