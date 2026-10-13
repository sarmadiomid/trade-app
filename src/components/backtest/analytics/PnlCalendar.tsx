'use client';

import { useMemo, useState } from 'react';
import { DAY_MS } from '@/lib/core';
import type { Bucket } from '@/lib/backtest';
import { MONTH_NAMES, signedMoney } from '../format';

/**
 * FX Replay's Risk/Reward performance calendar: a month grid, each day tinted by its net P&L
 * (diverging, neutral when flat) with trades, win % and R. Pick the month and year.
 */
export function PnlCalendar({
  days,
  initial,
}: {
  readonly days: ReadonlyMap<number, Bucket>;
  /** A time inside the month shown first. */
  readonly initial: number;
}) {
  const start = new Date(initial);
  const [ym, setYm] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });
  const maxAbs = useMemo(
    () => Math.max(1, ...[...days.values()].map((b) => Math.abs(b.pnl))),
    [days],
  );
  const years = useMemo(() => {
    const set = new Set([...days.keys()].map((k) => new Date(k).getUTCFullYear()));
    set.add(ym.y);
    return [...set].sort();
  }, [days, ym.y]);

  const first = Date.UTC(ym.y, ym.m, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday first
  const count = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array<null>(lead).fill(null)];
  for (let d = 0; d < count; d++) cells.push(first + d * DAY_MS);
  const month = [...days.entries()].filter(([k]) => k >= first && k < first + count * DAY_MS);
  const monthPnl = month.reduce((a, [, b]) => a + b.pnl, 0);
  const shift = (delta: number) =>
    setYm(({ y, m }) => ({
      y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y,
      m: (m + delta + 12) % 12,
    }));

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <button
          type="button"
          aria-label="Previous month"
          className="h-7 rounded px-2 hover:bg-hover"
          onClick={() => shift(-1)}
        >
          ‹
        </button>
        <select
          aria-label="Month"
          className="h-7 rounded border border-line bg-panel px-1"
          value={ym.m}
          onChange={(e) => setYm({ ...ym, m: Number(e.target.value) })}
        >
          {MONTH_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          className="h-7 rounded border border-line bg-panel px-1"
          value={ym.y}
          onChange={(e) => setYm({ ...ym, y: Number(e.target.value) })}
        >
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Next month"
          className="h-7 rounded px-2 hover:bg-hover"
          onClick={() => shift(1)}
        >
          ›
        </button>
        <div className="flex-1" />
        <span className="text-muted">
          Month:{' '}
          <span className={monthPnl >= 0 ? 'text-up' : 'text-down'}>{signedMoney(monthPnl)}</span> ·{' '}
          {month.length} trading days
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[11px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1 text-center text-muted">
            {d}
          </div>
        ))}
        {cells.map((t, i) => {
          if (t === null) return <div key={`e${i}`} />;
          const b = days.get(t);
          const alpha = b ? 0.15 + 0.55 * Math.min(1, Math.abs(b.pnl) / maxAbs) : 0;
          const bg =
            !b || Math.abs(b.pnl) < 0.005
              ? 'transparent'
              : b.pnl > 0
                ? `rgba(8,153,129,${alpha})`
                : `rgba(242,54,69,${alpha})`;
          return (
            <div
              key={t}
              className="min-h-16 rounded border border-line/60 p-1"
              style={{ background: bg }}
              title={
                b
                  ? `${b.trades} trades · ${signedMoney(b.pnl)} · win ${(b.winRate * 100).toFixed(0)}% · ${b.r.toFixed(2)}R`
                  : undefined
              }
            >
              <div className="text-muted">{new Date(t).getUTCDate()}</div>
              {b ? (
                <div className="leading-tight">
                  <div className="font-semibold text-fg">{signedMoney(b.pnl)}</div>
                  <div className="text-muted">
                    {b.trades}t · {(b.winRate * 100).toFixed(0)}% · {b.r.toFixed(1)}R
                  </div>
                  {b.breakeven ? <div className="text-muted">{b.breakeven} BE</div> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
