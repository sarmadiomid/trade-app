import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SessionSummary } from '@/lib/backtest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement('a', { href, ...rest }, children),
}));
import { PracticeOverview } from '@/components/home/PracticeOverview';
import {
  DAY_MS,
  bucketHours,
  monthOfInstant,
  niceMax,
  recentPracticeDays,
  remainingDays,
  replayedMs,
  selectSessions,
  sessionSpanDays,
  symbolCounts,
  tehranDayKey,
  winRateByActivityMonth,
  winRateMonthSpan,
} from '@/components/home/overview';

function session(partial: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 'bt1',
    name: 'تمرین',
    type: 'backtesting',
    symbol: 'XAUUSD',
    startDate: Date.UTC(2026, 9, 18),
    endDate: Date.UTC(2026, 9, 24),
    cursor: Date.UTC(2026, 9, 19),
    startingBalance: 100_000,
    balance: 100_000,
    trades: 2,
    status: 'in-progress',
    strategyTag: '',
    createdAt: Date.UTC(2026, 9, 20, 8),
    updatedAt: Date.UTC(2026, 9, 20, 16),
    ...partial,
  };
}

describe('practice overview', () => {
  const now = Date.UTC(2026, 9, 20, 16);

  it('measures the replay window the way the session card does', () => {
    const s = session();
    expect(replayedMs(s)).toBe(DAY_MS);
    expect(sessionSpanDays(s)).toBe(7);
    expect(remainingDays(s)).toBe(6);
  });

  it('keeps prop sessions out of the backtest filter and old sessions out of 30 days', () => {
    const fresh = session();
    const prop = session({ id: 'p', type: 'prop', updatedAt: now });
    const old = session({ id: 'old', updatedAt: now - 40 * DAY_MS });
    expect(selectSessions([fresh, prop, old], 'backtesting', 'all', now).map((s) => s.id)).toEqual([
      'bt1',
      'old',
    ]);
    expect(selectSessions([fresh, old], 'all', '30d', now).map((s) => s.id)).toEqual(['bt1']);
  });

  it('rounds chart axes onto a 1 hour scale for a short session', () => {
    expect(niceMax(0.8)).toBe(1);
    expect(niceMax(17)).toBe(20);
    expect(niceMax(0)).toBe(1);
  });

  it('buckets wall-clock time by the Tehran month', () => {
    const day = tehranDayKey(now);
    const spent = bucketHours({ [day]: 48 * 60_000 }, 'all', now);
    expect(spent.totalMs).toBe(48 * 60_000);
    expect(spent.activeDays).toBe(1);
    expect(spent.months).toHaveLength(1);
    expect(spent.months[0]?.value).toBeCloseTo(0.8);
    expect(spent.months[0]?.key).toBe(monthOfInstant(now).key);
    expect(bucketHours({ [day]: 60_000 }, '30d', now + 40 * DAY_MS).totalMs).toBe(0);
    const series = recentPracticeDays({ [day]: 3_600_000 }, now, 14);
    expect(series).toHaveLength(14);
    expect(series[13]?.key).toBe(day);
    expect(series[13]?.ms).toBe(3_600_000);
    expect(series[0]?.ms).toBe(0);
  });

  it('reports win rate for the month the session was worked on', () => {
    const rows = winRateByActivityMonth([
      { updatedAt: now, wins: 1, trades: 2 },
      { updatedAt: now, wins: 0, trades: 1 },
      { updatedAt: now - 40 * DAY_MS, wins: 2, trades: 2 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.value).toBeCloseTo((1 / 3) * 100);
    expect(rows[0]?.value).toBe(100);
  });

  it('shows three months before and four after the current month', () => {
    const current = monthOfInstant(now);
    const span = winRateMonthSpan([{ key: current.key, label: current.label, value: 50 }], now);
    expect(span).toHaveLength(8);
    expect(span[3]).toMatchObject({ key: current.key, value: 50, current: true });
    expect(span[0]?.value).toBeNull();
    expect(span[7]?.value).toBeNull();
    expect(span[2]?.key < current.key).toBe(true);
    expect(span[4]?.key > current.key).toBe(true);

    const older = monthOfInstant(now - 200 * DAY_MS);
    const fixed = winRateMonthSpan([{ key: older.key, label: older.label, value: 10 }], now);
    expect(fixed).toHaveLength(8);
    expect(fixed.some((slot) => slot.key === older.key)).toBe(false);
    expect(fixed[3]?.current).toBe(true);
  });

  it('renders the activity summary once a session exists', () => {
    const html = renderToStaticMarkup(
      createElement(PracticeOverview, {
        sessions: [session({ name: 'هفته اول', trades: 3 })],
        onCreate: () => {},
        onChanged: () => {},
      }),
    );
    expect(html).toContain('عملکرد');
    expect(html).toContain('زمان صرف‌شده');
    expect(html).toContain('زمان تاریخی بازپخش');
    expect(html).toContain('معاملات انجام‌شده');
    expect(html).toContain('نرخ برد کلی');
    expect(html).toContain('معاملات هر نماد');
    expect(html).toContain('جلسه‌های اخیر');
    expect(html).toContain('هفته اول');
    expect(html).toContain('XAUUSD');
    expect(html).toContain('شروع جلسه');
    expect(html).toContain('شروع چالش');
  });

  it('ranks symbols by how many trades they have', () => {
    expect(
      symbolCounts([
        { symbol: 'EURUSD', count: 4 },
        { symbol: 'XAUUSD', count: 9 },
        { symbol: 'EURUSD', count: 1 },
        { symbol: 'GBPUSD', count: 0 },
      ]),
    ).toEqual([
      { symbol: 'XAUUSD', count: 9 },
      { symbol: 'EURUSD', count: 5 },
    ]);
  });
});
