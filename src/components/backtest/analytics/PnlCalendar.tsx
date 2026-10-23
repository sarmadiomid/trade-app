'use client';

import { useMemo, useState } from 'react';
import type { Bucket } from '@/lib/backtest';
import {
  JALALI_MONTHS,
  JALALI_WEEK_SHORT,
  faDigits,
  faNum,
  jalaliMonthLength,
  jalaliToUtc,
  utcToJalali,
} from '@/lib/locale/jalali';
import { Icon } from '../../ui/Icon';
import { signedMoney } from '../format';

/**
 * Iranian month grid (Saturday on the right). Each day is tinted by its net P&L.
 * Buckets are keyed by UTC midnight of the civil day; the clock is not shifted to Tehran.
 */
export function PnlCalendar({
  days,
  initial,
}: {
  readonly days: ReadonlyMap<number, Bucket>;
  /** A time inside the month shown first. */
  readonly initial: number;
}) {
  const start = utcToJalali(initial);
  const [ym, setYm] = useState({ y: start.jy, m: start.jm });
  const maxAbs = useMemo(
    () => Math.max(1, ...[...days.values()].map((b) => Math.abs(b.pnl))),
    [days],
  );
  const years = useMemo(() => {
    const set = new Set([...days.keys()].map((k) => utcToJalali(k).jy));
    set.add(ym.y);
    return [...set].sort((a, b) => a - b);
  }, [days, ym.y]);

  const count = jalaliMonthLength(ym.y, ym.m);
  const first = jalaliToUtc(ym.y, ym.m, 1);
  // Saturday-first: Sat→0 … Fri→6. In RTL the first column sits on the right.
  const lead = (new Date(first).getUTCDay() + 1) % 7;
  const cells: Array<{ t: number; d: number } | null> = [...Array<null>(lead).fill(null)];
  for (let d = 1; d <= count; d++) cells.push({ t: jalaliToUtc(ym.y, ym.m, d), d });
  const monthEnd = jalaliToUtc(ym.m === 12 ? ym.y + 1 : ym.y, ym.m === 12 ? 1 : ym.m + 1, 1);
  const month = [...days.entries()].filter(([k]) => k >= first && k < monthEnd);
  const monthPnl = month.reduce((a, [, b]) => a + b.pnl, 0);
  const shift = (delta: number) =>
    setYm(({ y, m }) => {
      const next = m + delta;
      if (next < 1) return { y: y - 1, m: 12 };
      if (next > 12) return { y: y + 1, m: 1 };
      return { y, m: next };
    });

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <button
          type="button"
          aria-label="ماه قبل"
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-hover"
          onClick={() => shift(-1)}
        >
          <Icon name="chevronLeft" size={14} className="rtl:-scale-x-100" />
        </button>
        <select
          aria-label="ماه"
          className="h-7 rounded border border-line bg-panel px-1"
          value={ym.m}
          onChange={(e) => setYm({ ...ym, m: Number(e.target.value) })}
        >
          {JALALI_MONTHS.map((n, i) => (
            <option key={n} value={i + 1}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label="سال"
          className="h-7 rounded border border-line bg-panel px-1"
          value={ym.y}
          onChange={(e) => setYm({ ...ym, y: Number(e.target.value) })}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {faDigits(y)}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="ماه بعد"
          className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-hover"
          onClick={() => shift(1)}
        >
          <Icon name="chevronLeft" size={14} />
        </button>
        <div className="flex-1" />
        <span className="text-muted">
          این ماه:{' '}
          <span className={monthPnl >= 0 ? 'text-up' : 'text-down'}>{signedMoney(monthPnl)}</span>
          {' · '}
          {faNum(month.length)} روز معاملاتی
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[11px]">
        {JALALI_WEEK_SHORT.map((d) => (
          <div key={d} className="py-1 text-center text-muted">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (cell === null) return <div key={`e${i}`} />;
          const b = days.get(cell.t);
          const alpha = b ? 0.15 + 0.55 * Math.min(1, Math.abs(b.pnl) / maxAbs) : 0;
          const bg =
            !b || Math.abs(b.pnl) < 0.005
              ? 'transparent'
              : b.pnl > 0
                ? `rgba(47,206,154,${alpha})`
                : `rgba(255,93,115,${alpha})`;
          return (
            <div
              key={cell.t}
              className="min-h-16 rounded border border-line/60 p-1"
              style={{ background: bg }}
              title={
                b
                  ? `${faNum(b.trades)} معامله · ${signedMoney(b.pnl)} · برد ${faNum(Math.round(b.winRate * 100))}٪ · ${faNum(b.r, 2)}R`
                  : undefined
              }
            >
              <div className="text-muted">{faNum(cell.d)}</div>
              {b ? (
                <div className="leading-tight">
                  <div className="font-semibold text-fg">{signedMoney(b.pnl)}</div>
                  <div className="text-muted">
                    {faNum(b.trades)} م · {faNum(Math.round(b.winRate * 100))}٪ · {faNum(b.r, 1)}R
                  </div>
                  {b.breakeven ? (
                    <div className="text-muted">{faNum(b.breakeven)} سربه‌سر</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
