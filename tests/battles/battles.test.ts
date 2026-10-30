import { describe, expect, it } from 'vitest';
import { battleAccountConfig } from '@/lib/app/battle/battle-config';
import { ExecutionEngine, resimulate, type LoggedAction } from '@/lib/backtest';
import {
  DEFAULT_SETTINGS,
  RANKED_FORMATS,
  RANKS,
  battleCode,
  eloChanges,
  elapsedMs,
  levelFor,
  marketCursor,
  marketEnd,
  normalizeCode,
  placesOf,
  rankFor,
  rankProgress,
  remainingMs,
  sortStandings,
  validateBattleSettings,
  xpFor,
  type BattleClock,
  type BattleSettings,
  type Standing,
} from '@/lib/battles';
import { MINUTE_MS } from '@/lib/core';
import { MockMarketProvider, instrumentSpec } from '@/lib/data';

const settings = (patch: Partial<BattleSettings> = {}): BattleSettings => ({
  ...DEFAULT_SETTINGS,
  name: 'Test',
  ...patch,
});

describe('battle settings', () => {
  it('accepts the defaults and every ranked format', () => {
    expect(validateBattleSettings(settings())).toBeNull();
    for (const f of RANKED_FORMATS) expect(validateBattleSettings(f.settings)).toBeNull();
  });

  it('rejects broken settings', () => {
    expect(validateBattleSettings(settings({ name: '  ' }))).toMatch(/name/);
    expect(validateBattleSettings(settings({ assets: [] }))).toMatch(/asset/);
    expect(validateBattleSettings(settings({ assets: ['XAUUSD', 'XAUUSD'] }))).toMatch(/unique/);
    expect(validateBattleSettings(settings({ assets: ['BTCUSD'] }))).toMatch(/not available/);
    expect(validateBattleSettings(settings({ durationMin: 0 }))).toMatch(/Duration/);
    expect(validateBattleSettings(settings({ durationMin: 100 }))).toMatch(/Duration/);
    expect(validateBattleSettings(settings({ speed: 7 }))).toMatch(/speed/);
    expect(
      validateBattleSettings(settings({ winCondition: 'profit-target', profitTargetPct: null })),
    ).toMatch(/profit target/);
    expect(validateBattleSettings(settings({ maxDrawdownPct: 0.1 }))).toMatch(/drawdown/);
    expect(validateBattleSettings(settings({ maxParticipants: 1 }))).toMatch(/Participants/);
    expect(
      validateBattleSettings(settings({ historyStart: Date.UTC(2025, 0, 1), historyEnd: null })),
    ).toMatch(/incomplete/);
    expect(
      validateBattleSettings(
        settings({ historyStart: Date.UTC(2025, 5, 1), historyEnd: Date.UTC(2025, 0, 1) }),
      ),
    ).toMatch(/End date/);
  });

  it('keeps every battle inside one trading week', () => {
    expect(validateBattleSettings(settings({ durationMin: 99, speed: 60 }))).toBeNull();
  });

  it('makes readable battle IDs', () => {
    let i = 0;
    const seq = [0, 0.5, 0.99, 0.2, 0.7, 0.4];
    const code = battleCode(() => seq[i++ % seq.length]!);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(code).not.toMatch(/[01OI]/);
    expect(normalizeCode(' ab-c12 ')).toBe('ABC12');
  });
});

describe('battle clock', () => {
  const clock = (patch: Partial<BattleClock> = {}): BattleClock => ({
    status: 'live',
    startedAt: 1_000_000,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    marketStart: 100 * MINUTE_MS,
    speed: 30,
    durationMin: 10,
    ...patch,
  });

  it('replays `speed` market minutes per real minute, in whole minutes', () => {
    const c = clock();
    expect(marketCursor(c, 1_000_000)).toBe(c.marketStart);
    // 1.9 s at 30× = 57 s of market: the first candle is not complete yet.
    expect(marketCursor(c, 1_001_900)).toBe(c.marketStart);
    expect(marketCursor(c, 1_002_000)).toBe(c.marketStart + MINUTE_MS);
    expect(marketCursor(c, 1_060_000)).toBe(c.marketStart + 30 * MINUTE_MS);
  });

  it('freezes while paused and excludes paused time', () => {
    const paused = clock({ status: 'paused', pausedAt: 1_010_000 });
    expect(elapsedMs(paused, 1_050_000)).toBe(10_000);
    const resumed = clock({ pausedMs: 40_000 });
    expect(elapsedMs(resumed, 1_050_000)).toBe(10_000);
  });

  it('stops at the duration and at the end', () => {
    const c = clock();
    expect(remainingMs(c, 1_000_000 + 11 * MINUTE_MS)).toBe(0);
    expect(marketCursor(c, 1_000_000 + 11 * MINUTE_MS)).toBe(marketEnd(c));
    const ended = clock({ status: 'completed', endedAt: 1_030_000 });
    expect(elapsedMs(ended, 9_999_999)).toBe(30_000);
  });

  it('does not run before the start', () => {
    expect(elapsedMs(clock({ status: 'standby', startedAt: null }), 5_000_000)).toBe(0);
  });
});

describe('Elo', () => {
  const players = (a: number, b: number, games = 20) => [
    { id: 'a', rating: a, games },
    { id: 'b', rating: b, games },
  ];

  it('moves equal duelists by K/2', () => {
    const d = eloChanges(
      players(1000, 1000),
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    expect(d.get('a')).toBe(16);
    expect(d.get('b')).toBe(-16);
    const provisional = eloChanges(
      players(1000, 1000, 0),
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    expect(provisional.get('a')).toBe(24);
  });

  it('rewards upsets more than expected wins', () => {
    const upset = eloChanges(
      players(1000, 1400),
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    const expected = eloChanges(
      players(1400, 1000),
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    expect(upset.get('a')!).toBeGreaterThan(expected.get('a')!);
    expect(upset.get('a')! + upset.get('b')!).toBe(0);
  });

  it('scores ties as half a game', () => {
    const d = eloChanges(
      players(1000, 1000),
      new Map([
        ['a', 1],
        ['b', 1],
      ]),
    );
    expect(d.get('a')).toBe(0);
  });

  it('scales free-for-alls so the winner gains about one duel', () => {
    const four = ['a', 'b', 'c', 'd'].map((id) => ({ id, rating: 1200, games: 20 }));
    const d = eloChanges(
      four,
      new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
        ['d', 4],
      ]),
    );
    expect(d.get('a')).toBe(16);
    expect(d.get('d')).toBe(-16);
    expect([...d.values()].reduce((x, y) => x + y, 0)).toBe(0);
  });
});

describe('ranks', () => {
  it('has eight tiers from Rookie to Master', () => {
    expect(RANKS.map((r) => r.name)).toEqual([
      'Rookie',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Elite',
      'Master',
    ]);
    expect(rankFor(1000).name).toBe('Rookie');
    expect(rankFor(1100).name).toBe('Bronze');
    expect(rankFor(2400).name).toBe('Master');
    expect(rankProgress(2400)).toEqual({ next: null, progress: 1 });
    expect(rankProgress(1175).next?.name).toBe('Silver');
    expect(rankProgress(1175).progress).toBeCloseTo(0.5);
  });
});

describe('standings', () => {
  const s = (userId: string, patch: Partial<Standing>): Standing => ({
    userId,
    name: userId,
    elo: 1000,
    status: 'active',
    balance: 100_000,
    equity: 100_000,
    returnPct: 0,
    openPositions: 0,
    trades: 0,
    wins: 0,
    targetAt: null,
    reason: null,
    ...patch,
  });

  it('orders target hitters, then returns, then leavers, then the disqualified', () => {
    const sorted = sortStandings([
      s('dq', { status: 'disqualified', returnPct: 5 }),
      s('low', { returnPct: -1 }),
      s('late-target', { status: 'target', targetAt: 200 }),
      s('left', { status: 'left', returnPct: 9 }),
      s('high', { returnPct: 3 }),
      s('first-target', { status: 'target', targetAt: 100 }),
    ]);
    expect(sorted.map((x) => x.userId)).toEqual([
      'first-target',
      'late-target',
      'high',
      'low',
      'left',
      'dq',
    ]);
  });

  it('shares a place between equal returns', () => {
    const sorted = sortStandings([
      s('a', { returnPct: 1.001 }),
      s('b', { returnPct: 1.0012 }),
      s('c', { returnPct: -2 }),
    ]);
    const places = placesOf(sorted);
    expect(places.get('a')).toBe(1);
    expect(places.get('b')).toBe(1);
    expect(places.get('c')).toBe(3);
  });
});

describe('Composite Score', () => {
  it('rewards taking part, winning, trades and streaks', () => {
    const base = {
      place: 2,
      participants: 2,
      status: 'active' as const,
      profitableTrades: 0,
      winStreak: 0,
    };
    expect(xpFor(base)).toBe(100);
    expect(xpFor({ ...base, place: 1, winStreak: 1 })).toBe(150);
    expect(xpFor({ ...base, place: 1, winStreak: 3, profitableTrades: 20 })).toBe(250);
    expect(xpFor({ ...base, place: 3, participants: 5 })).toBe(125);
    expect(xpFor({ ...base, status: 'disqualified' })).toBe(25);
    expect(xpFor({ ...base, status: 'left' })).toBe(0);
  });

  it('levels up every 300, 400, 500… XP', () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, needed: 300 });
    expect(levelFor(300)).toEqual({ level: 2, into: 0, needed: 400 });
    expect(levelFor(750)).toEqual({ level: 3, into: 50, needed: 500 });
  });
});

describe('server and browser agree on every account', () => {
  it('re-simulating the action log equals trading step by step', () => {
    const provider = new MockMarketProvider();
    const spec = instrumentSpec('EURUSD')!;
    const s = settings({ assets: ['EURUSD'], maxDrawdownPct: 2, maxDailyDrawdownPct: 1 });
    const start = Date.UTC(2024, 2, 5, 8, 0);
    const cfg = battleAccountConfig(s, 'EURUSD', spec, start);
    const minutes = provider.minuteBars('EURUSD', start, start + 300 * MINUTE_MS);
    const startBid = provider.generate({
      symbol: 'EURUSD',
      timeframe: '1m',
      endTime: start - 1,
      limit: 1,
    }).bars[0]!.close;

    // Browser: the replay reaches the cursor, then the trader acts at the cursor.
    const plan = new Map<number, LoggedAction['a'][]>([
      [10, [{ type: 'market', id: '1', side: 'buy', volume: 2, sl: null, tp: null }]],
      [
        40,
        [
          {
            type: 'pending',
            id: '2',
            side: 'sell',
            kind: 'limit',
            price: minutes[40]!.close + 0.0008,
            volume: 1,
            sl: null,
            tp: null,
          },
        ],
      ],
      [90, [{ type: 'close', id: '1' }]],
      [
        150,
        [
          {
            type: 'market',
            id: '3',
            side: 'sell',
            volume: 3,
            sl: minutes[150]!.close + 0.002,
            tp: minutes[150]!.close - 0.002,
          },
        ],
      ],
    ]);
    const live = new ExecutionEngine(cfg, ExecutionEngine.initialState(cfg, start, startBid));
    const log: LoggedAction[] = [];
    minutes.forEach((bar, i) => {
      for (const a of plan.get(i) ?? []) {
        live.state.time = Math.max(live.state.time, bar.time);
        if (live.apply(a).ok) log.push({ t: bar.time, a });
      }
      live.processBar(bar);
    });
    expect(log.length).toBe(4);

    // Server: the same log replayed from scratch.
    const until = minutes[minutes.length - 1]!.time + MINUTE_MS;
    const server = resimulate(
      cfg,
      ExecutionEngine.initialState(cfg, start, startBid),
      log,
      minutes,
      until,
    );
    expect(server.state.balance).toBeCloseTo(live.state.balance, 6);
    expect(server.state.trades.length).toBe(live.state.trades.length);
    expect(server.state.positions.map((p) => p.id)).toEqual(live.state.positions.map((p) => p.id));
    expect(server.state.status).toBe(live.state.status);
  });

  it('turns battle drawdown limits into a disqualifying broker rule', () => {
    const spec = instrumentSpec('XAUUSD')!;
    const cfg = battleAccountConfig(
      settings({ maxDrawdownPct: 3, maxDailyDrawdownPct: null }),
      'XAUUSD',
      spec,
      0,
    );
    expect(cfg.propRules).toEqual({
      profitTargetPct: 1e9,
      maxDailyLossPct: 100,
      maxTotalLossPct: 3,
    });
    expect(cfg.spread).toBe(spec.defaultSpread);
  });
});
