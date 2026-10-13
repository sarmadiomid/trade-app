import { describe, expect, it } from 'vitest';
import { aggregate, bucketStart, createRng, type SeriesData } from '@/lib/core';
import { ChartApp, BacktestRuntime, createBacktestServices } from '@/lib/app';
import type { SessionSettings } from '@/lib/backtest';
import { MemoryStorage } from '@/lib/storage';
import { fakeContainer, fakeRuntime } from '../helpers/fake-dom';

const flush = () => new Promise((r) => setTimeout(r, 0));
const D = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);

const SETTINGS: SessionSettings = {
  name: 'Test',
  description: '',
  strategyTag: '',
  type: 'backtesting',
  symbol: 'XAUUSD',
  startingBalance: 10_000,
  startDate: D(2024, 3, 4),
  endDate: D(2024, 3, 8),
  spreadEnabled: true,
  spread: 0.2,
  commissionEnabled: false,
  commissionPerLot: 0,
  propRules: null,
};

async function open(settings = SETTINGS, storage = new MemoryStorage()) {
  const services = createBacktestServices(storage);
  const created = await services.create(settings);
  if ('error' in created) throw new Error(created.error);
  const session = (await services.repo.load(created.session.id))!;
  return mount(session, services, storage);
}

async function mount(
  session: NonNullable<
    Awaited<ReturnType<ReturnType<typeof createBacktestServices>['repo']['load']>>
  >,
  services: ReturnType<typeof createBacktestServices>,
  storage: MemoryStorage,
) {
  const clock = { now: () => D(2026, 1, 1) };
  const { runtime } = fakeRuntime(clock);
  const rt = new BacktestRuntime(session, services);
  const deps = rt.wrapDeps({
    runtime,
    clock,
    rng: createRng(1),
    storage,
    provider: services.market,
  });
  const { container } = fakeContainer();
  const app = new ChartApp(container, deps, rt.appOptions());
  await app.start();
  const c = rt.attach(app);
  await c.start();
  await flush();
  return { app, c, services, session, storage, rt };
}

/** Every bar of the chart is strictly before the cursor and matches the 1m data up to it. */
function expectNoFuture(
  series: SeriesData,
  cursor: number,
  minutes: ReturnType<typeof aggregate>,
  tf: Parameters<typeof aggregate>[2],
) {
  for (let i = 0; i < series.length; i++) expect(series.time[i]!).toBeLessThan(cursor);
  const last = series.bar(series.lastIndex)!;
  const own = minutes.filter((m) => m.time >= last.time && m.time < cursor);
  const expected = aggregate(own, '1m', tf)[0]!;
  expect(last).toEqual(expected);
}

describe('BacktestController', () => {
  it('opens at the session start with no future data and steps by the ticker value', async () => {
    const { app, c, services } = await open();
    expect(c.cursor).toBe(SETTINGS.startDate);
    const minutes = services.market.minuteBars('XAUUSD', D(2024, 3, 1), D(2024, 3, 9));
    expectNoFuture(app.market.data, c.cursor, minutes, app.timeframe);

    c.setTickerValue('15m');
    await c.next();
    expect(c.cursor).toBe(D(2024, 3, 4, 0, 15));
    await c.next();
    expect(c.cursor).toBe(D(2024, 3, 4, 0, 30));
    expectNoFuture(app.market.data, c.cursor, minutes, app.timeframe);
    expect(c.account.bid).toBe(minutes.filter((m) => m.time < c.cursor).at(-1)!.close);

    // Chart at 1h while stepping 15m: the hour candle forms progressively.
    await app.setTimeframe('1h');
    await flush();
    await flush();
    expectNoFuture(app.market.data, c.cursor, minutes, '1h');
    await c.next();
    expect(app.market.data.time[app.market.data.lastIndex]).toBe(D(2024, 3, 4, 0));
    expectNoFuture(app.market.data, c.cursor, minutes, '1h');
    await c.next();
    await c.next();
    expect(app.market.data.time[app.market.data.lastIndex]).toBe(D(2024, 3, 4, 1));
    expectNoFuture(app.market.data, c.cursor, minutes, '1h');
    app.destroy();
  });

  it('trades, fills pending orders while skipping, journals and rewinds', async () => {
    const { app, c, services, session } = await open();
    await c.next(); // actions taken exactly at a rewind target are kept, so trade after 00:01
    const bid = c.account.bid;
    expect(
      c.trading.place({ side: 'buy', type: 'market', volume: 1, sl: bid - 20, tp: null }),
    ).toBeNull();
    expect(c.account.positions[0]!.entryPrice).toBeCloseTo(bid + 0.2, 6);
    // A buy limit far below and a skip of a day.
    expect(
      c.trading.place({
        side: 'buy',
        type: 'limit',
        price: bid - 3,
        volume: 0.5,
        sl: null,
        tp: null,
      }),
    ).toBeNull();
    c.setTickerValue('1D');
    await c.next();
    expect(c.cursor).toBe(D(2024, 3, 5));
    const minutes = services.market.minuteBars('XAUUSD', SETTINGS.startDate, c.cursor);
    const low = Math.min(...minutes.map((m) => m.low));
    if (low + 0.2 <= bid - 3) expect(c.account.orders).toHaveLength(0);
    expect(session.actions).toHaveLength(2);

    c.trading.closeAll();
    const closed = c.account.trades.length;
    expect(closed).toBeGreaterThan(0);
    c.updateJournal(c.account.trades[0]!.id, { notes: 'clean breakout', tags: ['A+'] });

    // Rewinding before the trades needs confirmation, then removes them.
    const check = await c.rewindTo(SETTINGS.startDate);
    expect(check.ok).toBe(false);
    const done = await c.rewindTo(SETTINGS.startDate, true);
    expect(done.ok).toBe(true);
    expect(c.cursor).toBe(SETTINGS.startDate);
    expect(c.account.trades).toHaveLength(0);
    expect(c.account.positions).toHaveLength(0);
    expect(session.actions).toHaveLength(0);
    expect(session.journal).toEqual({});
    expectNoFuture(
      app.market.data,
      c.cursor,
      services.market.minuteBars('XAUUSD', D(2024, 2, 26), D(2024, 3, 9)),
      app.timeframe,
    );
    app.destroy();
  });

  it('rewinds deterministically: re-simulation equals the live account', async () => {
    const { app, c } = await open();
    c.setTickerValue('1h');
    for (let i = 0; i < 3; i++) await c.next();
    const bid = c.account.bid;
    c.trading.place({ side: 'sell', type: 'market', volume: 0.3, sl: bid + 15, tp: bid - 15 });
    c.trading.place({
      side: 'buy',
      type: 'stop',
      price: bid + 4,
      volume: 0.2,
      sl: bid - 6,
      tp: bid + 12,
    });
    for (let i = 0; i < 20; i++) await c.next();
    const live = JSON.stringify(c.account);
    const cursor = c.cursor;
    c.setTickerValue('1D');
    await c.next();
    await c.rewindTo(cursor, true);
    expect(JSON.stringify(c.account)).toBe(live);
    app.destroy();
  });

  it('persists and restores the full state', async () => {
    const storage = new MemoryStorage();
    const first = await open(SETTINGS, storage);
    first.c.setTickerValue('30m');
    await first.c.next();
    first.c.trading.place({ side: 'buy', type: 'market', volume: 0.1, sl: null, tp: null });
    first.c.trading.place({
      side: 'sell',
      type: 'limit',
      price: first.c.account.bid + 30,
      volume: 0.1,
      sl: null,
      tp: null,
    });
    first.c.flush();
    await flush();
    const cursor = first.c.cursor;
    first.app.destroy();
    const loaded = (await first.services.repo.load(first.session.id))!;
    expect(loaded.cursor).toBe(cursor);
    expect(loaded.prefs.tickerValue).toBe('30m');
    const again = await mount(loaded, first.services, storage);
    expect(again.c.account.positions).toHaveLength(1);
    expect(again.c.account.orders).toHaveLength(1);
    const last = again.app.market.data;
    expect(last.time[last.lastIndex]).toBe(bucketStart(cursor - 1, again.app.timeframe));
    again.app.destroy();
  });

  it('ends the session at the end date, closing everything', async () => {
    const { app, c } = await open();
    c.trading.place({ side: 'buy', type: 'market', volume: 0.1, sl: null, tp: null });
    const ended: string[] = [];
    c.events.on('ended', (e) => ended.push(e.status));
    expect(await c.goTo(SETTINGS.endDate + 86_400_000)).toBeNull();
    expect(c.cursor).toBe(SETTINGS.endDate + 86_400_000);
    expect(c.account.status).toBe('ended');
    expect(c.account.positions).toHaveLength(0);
    expect(c.account.trades[0]!.closeReason).toBe('session-end');
    expect(ended).toEqual(['ended']);
    expect(await c.goTo(SETTINGS.endDate + 2 * 86_400_000)).not.toBeNull();
    app.destroy();
  });
});
