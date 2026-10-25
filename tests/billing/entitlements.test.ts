import { describe, expect, it } from 'vitest';
import { TIMEFRAMES } from '@/lib/core';
import {
  PLAY_BATCH,
  STANDARD_BALANCE,
  battleDenial,
  chartRecordDenial,
  chartTypeAllowed,
  cursorDenial,
  drawingToolAllowed,
  entitlements,
  historyDenial,
  journalDenial,
  isPlanLimitMessage,
  limitMessage,
  normalizePlan,
  requiresPlan,
  selectableHistoryStart,
  sessionSettingsDenial,
  symbolAllowed,
  symbolMinPlan,
  type PlanId,
  type SessionGate,
} from '@/lib/app/billing';
import { closePlanPrompt, openPlanPrompt, planPrompt } from '@/lib/app/billing/plan-prompt';

const PLANS: PlanId[] = ['beginner', 'mid', 'pro'];

function gate(patch: Partial<SessionGate> = {}): SessionGate {
  return {
    type: 'backtesting',
    symbol: 'XAUUSD',
    startingBalance: STANDARD_BALANCE,
    spreadEnabled: false,
    commissionEnabled: false,
    strategyTag: '',
    propRules: null,
    ...patch,
  };
}

const entry = (tags: string[], shots: string[] = [], confidence: number | null = null) => ({
  tags,
  screenshots: shots,
  confidence,
});

describe('plan entitlements', () => {
  it('treats a missing plan as beginner', () => {
    expect(normalizePlan(undefined)).toBe('beginner');
    expect(normalizePlan('enterprise')).toBe('beginner');
    expect(normalizePlan('pro')).toBe('pro');
  });

  it('matches the subscription matrix for sessions, symbols, and costs', () => {
    expect(entitlements('beginner').backtestSessions).toBe(2);
    expect(entitlements('mid').backtestSessions).toBe(15);
    expect(entitlements('pro').backtestSessions).toBeNull();

    for (const plan of PLANS) {
      expect(symbolAllowed(plan, 'XAUUSD')).toBe(true);
      expect(sessionSettingsDenial(plan, gate())).toBeNull();
    }

    expect(symbolAllowed('beginner', 'XAGUSD')).toBe(false);
    expect(symbolAllowed('mid', 'XAGUSD')).toBe(true);
    expect(symbolAllowed('beginner', 'EURUSD')).toBe(false);
    expect(symbolAllowed('mid', 'EURUSD')).toBe(true);
    expect(symbolAllowed('beginner', 'BTCUSDT')).toBe(false);
    expect(symbolAllowed('mid', 'BTCUSDT')).toBe(true);
    expect(symbolAllowed('mid', 'NAS100')).toBe(false);
    expect(symbolAllowed('pro', 'NAS100')).toBe(true);
    expect(symbolMinPlan('XAUUSD')).toBe('beginner');
    expect(symbolMinPlan('XAGUSD')).toBe('mid');
    expect(symbolMinPlan('EURUSD')).toBe('mid');
    expect(symbolMinPlan('BTCUSDT')).toBe('mid');
    expect(symbolMinPlan('NAS100')).toBe('pro');

    expect(isPlanLimitMessage(requiresPlan('نمادهای فارکس', 'mid'))).toBe(true);
    expect(isPlanLimitMessage(limitMessage('جلسات بک‌تست', 'beginner', 2))).toBe(true);
    expect(isPlanLimitMessage('تاریخ شروع و پایان معتبر نیست')).toBe(false);

    expect(sessionSettingsDenial('beginner', gate({ type: 'prop', propRules: {} }))).not.toBeNull();
    expect(sessionSettingsDenial('mid', gate({ type: 'prop', propRules: {} }))).toBeNull();
    expect(sessionSettingsDenial('beginner', gate({ startingBalance: 10_000 }))).not.toBeNull();
    expect(sessionSettingsDenial('mid', gate({ startingBalance: 10_000 }))).toBeNull();
    expect(sessionSettingsDenial('beginner', gate({ spreadEnabled: true }))).not.toBeNull();
    expect(sessionSettingsDenial('beginner', gate({ commissionEnabled: true }))).not.toBeNull();
    expect(
      sessionSettingsDenial('mid', gate({ spreadEnabled: true, commissionEnabled: true })),
    ).toBeNull();
    expect(sessionSettingsDenial('beginner', gate({ strategyTag: 'ICT' }))).not.toBeNull();
    expect(sessionSettingsDenial('mid', gate({ strategyTag: 'ICT' }))).toBeNull();
  });

  it('lets a beginner start only within one month of the market end', () => {
    const range = { start: Date.UTC(2019, 0, 1), end: Date.UTC(2026, 0, 1) };
    expect(entitlements('beginner').historyMonths).toBe(1);
    expect(entitlements('mid').historyMonths).toBeNull();
    expect(selectableHistoryStart('beginner', range)).toBe(Date.UTC(2025, 10, 30));
    expect(selectableHistoryStart('mid', range)).toBe(range.start);
    expect(selectableHistoryStart('pro', range)).toBe(range.start);
    expect(
      selectableHistoryStart('beginner', { start: Date.UTC(2025, 11, 20), end: range.end }),
    ).toBe(Date.UTC(2025, 11, 20));

    const denied = historyDenial('beginner', Date.UTC(2024, 0, 1), range);
    expect(denied).toBe(requiresPlan('تاریخ قبل از یک ماه گذشتهٔ بازار', 'mid'));
    expect(isPlanLimitMessage(denied ?? '')).toBe(true);
    expect(historyDenial('beginner', Date.UTC(2025, 11, 1), range)).toBeNull();
    expect(historyDenial('pro', Date.UTC(2020, 0, 1), range)).toBeNull();
    expect(
      sessionSettingsDenial('beginner', gate({ startDate: Date.UTC(2024, 0, 1) }), range),
    ).not.toBeNull();
    expect(
      sessionSettingsDenial('mid', gate({ startDate: Date.UTC(2020, 0, 1) }), range),
    ).toBeNull();
  });

  it('gates chart types, drawings, layouts, and saved chart settings', () => {
    expect(chartTypeAllowed('beginner', 'candles')).toBe(true);
    expect(chartTypeAllowed('beginner', 'heikin-ashi')).toBe(true);
    expect(chartTypeAllowed('beginner', 'renko')).toBe(false);
    expect(chartTypeAllowed('mid', 'renko')).toBe(true);
    expect(chartTypeAllowed('mid', 'line-break')).toBe(true);
    expect(chartTypeAllowed('mid', 'volume-footprint')).toBe(false);
    expect(chartTypeAllowed('pro', 'tpo')).toBe(true);
    expect(chartTypeAllowed('pro', 'not-a-chart')).toBe(false);

    expect(drawingToolAllowed('beginner', 'trend-line')).toBe(true);
    expect(drawingToolAllowed('beginner', 'fib-retracement')).toBe(false);
    expect(drawingToolAllowed('mid', 'fib-retracement')).toBe(true);
    expect(drawingToolAllowed('mid', 'fixed-range-volume-profile')).toBe(false);
    expect(drawingToolAllowed('pro', 'fixed-range-volume-profile')).toBe(true);

    expect(chartRecordDenial('beginner', 'layouts', [{}, {}], null)).not.toBeNull();
    expect(chartRecordDenial('beginner', 'layouts', [{}], [{}, {}, {}])).toBeNull();
    expect(
      chartRecordDenial(
        'mid',
        'layouts',
        Array.from({ length: 5 }, () => ({})),
        null,
      ),
    ).toBeNull();
    expect(
      chartRecordDenial(
        'mid',
        'layouts',
        Array.from({ length: 6 }, () => ({})),
        null,
      ),
    ).not.toBeNull();
    expect(
      chartRecordDenial(
        'pro',
        'layouts',
        Array.from({ length: 20 }, () => ({})),
        null,
      ),
    ).toBeNull();

    const fib = { drawings: [{ type: 'fib-retracement' }] };
    expect(
      chartRecordDenial('beginner', 'bt:1:drawings:XAUUSD', fib, { drawings: [] }),
    ).not.toBeNull();
    expect(chartRecordDenial('beginner', 'bt:1:drawings:XAUUSD', fib, fib)).toBeNull();
    expect(chartRecordDenial('mid', 'drawings:XAUUSD', fib, { drawings: [] })).toBeNull();

    expect(
      chartRecordDenial(
        'beginner',
        'chart-settings',
        { chartType: 'renko' },
        { chartType: 'candles' },
      ),
    ).not.toBeNull();
    expect(
      chartRecordDenial(
        'beginner',
        'chart-settings',
        { chartType: 'renko' },
        { chartType: 'renko' },
      ),
    ).toBeNull();
    expect(
      chartRecordDenial('beginner', 'chart-settings', { data: { chartType: 'candles' } }, null),
    ).toBeNull();
  });

  it('keeps beginner analytics and journal inside the published limits', () => {
    expect(entitlements('beginner').analytics).toBe('summary');
    expect(entitlements('mid').analytics).toBe('full');
    expect(entitlements('beginner').rrSimulator).toBe(false);
    expect(entitlements('mid').rrSimulator).toBe(true);
    expect(entitlements('beginner').journalSearch).toBe(false);
    expect(entitlements('mid').journalFilters).toBe(true);

    expect(journalDenial('beginner', {}, { a: entry(['one']) })).toBeNull();
    expect(journalDenial('beginner', {}, { a: entry(['one', 'two']) })).not.toBeNull();
    expect(
      journalDenial('beginner', { a: entry(['one', 'two']) }, { a: entry(['one', 'two']) }),
    ).toBeNull();
    expect(journalDenial('beginner', {}, { a: entry([], ['shot']) })).toBeNull();
    expect(journalDenial('beginner', {}, { a: entry([], ['a', 'b']) })).not.toBeNull();
    expect(
      journalDenial(
        'mid',
        {},
        {
          a: entry(
            [],
            Array.from({ length: 10 }, (_, i) => String(i)),
          ),
        },
      ),
    ).toBeNull();
    expect(
      journalDenial(
        'mid',
        {},
        {
          a: entry(
            [],
            Array.from({ length: 11 }, (_, i) => String(i)),
          ),
        },
      ),
    ).not.toBeNull();
    expect(
      journalDenial(
        'pro',
        {},
        {
          a: entry(
            [],
            Array.from({ length: 40 }, (_, i) => String(i)),
          ),
        },
      ),
    ).toBeNull();
    expect(journalDenial('beginner', {}, { a: entry([], [], 4) })).not.toBeNull();
    expect(journalDenial('beginner', { a: entry([], [], 4) }, { a: entry([], [], 4) })).toBeNull();
    expect(journalDenial('mid', {}, { a: entry(['a', 'b', 'c'], [], 5) })).toBeNull();
  });

  it('caps a beginner price jump at one playback batch and leaves faster plans open', () => {
    const step = TIMEFRAMES['1m'].ms;
    expect(cursorDenial('beginner', 0, step * PLAY_BATCH, '1m')).toBeNull();
    expect(cursorDenial('beginner', 0, step * PLAY_BATCH + 1, '1m')).not.toBeNull();
    expect(cursorDenial('beginner', 1_000, 500, '1h')).toBeNull();
    expect(cursorDenial('mid', 0, step * 10_000, '1m')).toBeNull();
    expect(entitlements('beginner').randomCandle).toBe(false);
    expect(entitlements('mid').priceJump).toBe(true);
  });

  it('limits beginner battles and opens ranked chat from the mid plan', () => {
    expect(battleDenial('beginner', 'join', 0)).toBeNull();
    expect(battleDenial('beginner', 'join', 1)).not.toBeNull();
    expect(battleDenial('beginner', 'join', 1, true)).toBeNull();
    expect(battleDenial('mid', 'join', 100)).toBeNull();
    expect(battleDenial('beginner', 'ranked', 0)).not.toBeNull();
    expect(battleDenial('mid', 'ranked', 0)).toBeNull();
    expect(battleDenial('beginner', 'chat', 0)).not.toBeNull();
    expect(battleDenial('pro', 'chat', 0)).toBeNull();
    expect(entitlements('beginner').battleChat).toBe(false);
    expect(entitlements('pro').ranked).toBe(true);
  });

  it('opens one upgrade prompt and clears it', () => {
    closePlanPrompt();
    openPlanPrompt(requiresPlan('شاخص‌ها', 'pro'));
    expect(planPrompt()).toBe(requiresPlan('شاخص‌ها', 'pro'));
    closePlanPrompt();
    expect(planPrompt()).toBeNull();
  });
});
