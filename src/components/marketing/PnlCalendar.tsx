'use client';

import { useState } from 'react';
import { faNum } from '@/lib/locale/jalali';

const PNL: Readonly<Record<number, number>> = {
  3: 120,
  4: -80,
  5: 210,
  6: 40,
  7: -150,
  10: 90,
  11: 186,
  12: -40,
  13: 60,
  17: -220,
  18: 30,
  19: 140,
  20: -60,
  21: 80,
  24: 200,
  25: -30,
  26: 110,
  27: 70,
  28: -90,
  31: 50,
};

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;
const WEEKDAY_NAME = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const;

const CELLS: ReadonlyArray<{ day: number; pnl: number | null } | null> = [
  ...Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const dow = new Date(Date.UTC(2025, 2, day)).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    return { day, pnl: weekend ? null : (PNL[day] ?? null) };
  }),
  null,
  null,
  null,
  null,
];

const WEEKS = Array.from({ length: 5 }, (_, week) => CELLS.slice(week * 7, week * 7 + 7));

function signed(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${faNum(Math.abs(n), 0)}`;
}

/** Sample March profit calendar. Profit and loss keep separate colors. */
export function PnlCalendar() {
  const [hover, setHover] = useState<{ week: number; day: number } | null>(null);
  const [pin, setPin] = useState<number | null>(null);
  const activeCell = hover ? WEEKS[hover.week]?.[hover.day] : null;
  const weekTotal = (week: number) =>
    (WEEKS[week] ?? []).reduce((sum, cell) => sum + (cell?.pnl ?? 0), 0);

  const readout = (() => {
    if (activeCell?.day) {
      const name = WEEKDAY_NAME[hover?.day ?? 0];
      if (activeCell.pnl === null) return `${faNum(activeCell.day)} مارس، ${name} · بدون معامله`;
      return `${faNum(activeCell.day)} مارس، ${name} · ${signed(activeCell.pnl)} دلار`;
    }
    if (pin !== null) return `هفته ${faNum(pin + 1)} · جمع ${signed(weekTotal(pin))} دلار`;
    return 'یک روز را انتخاب کنید';
  })();

  return (
    <div className="rounded-xl border border-[var(--mk-line)] bg-[var(--mk-card)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold">تقویم سود و زیان</h3>
          <span className="text-[11px] text-[var(--mk-faint)]">نمونه</span>
        </div>
        <span className="text-[12px] text-[var(--mk-faint)]">مارس ۲۰۲۵</span>
      </div>
      <div
        className="mt-4"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setPin(null);
            setHover(null);
          }
        }}
      >
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--mk-faint)]">
          {WEEKDAYS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {WEEKS.flatMap((week, weekIndex) =>
            week.map((cell, dayIndex) => {
              if (!cell) return <span key={`${weekIndex}-${dayIndex}`} />;
              const magnitude = cell.pnl === null ? 0 : Math.min(1, Math.abs(cell.pnl) / 220);
              const hue = cell.pnl === null ? '255 255 255' : cell.pnl < 0 ? '255 107 129' : '61 206 160';
              const alpha = cell.pnl === null ? 0.06 : 0.18 + magnitude * 0.72;
              return (
                <button
                  key={cell.day}
                  type="button"
                  aria-pressed={pin === weekIndex}
                  aria-label={
                    cell.pnl === null
                      ? `${faNum(cell.day)} مارس، بدون معامله`
                      : `${faNum(cell.day)} مارس، ${signed(cell.pnl)} دلار`
                  }
                  onPointerEnter={() => setHover({ week: weekIndex, day: dayIndex })}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover({ week: weekIndex, day: dayIndex })}
                  onBlur={() => setHover(null)}
                  onClick={() => setPin((current) => (current === weekIndex ? null : weekIndex))}
                  className={`flex h-9 cursor-pointer items-center justify-center rounded-md font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-blue-2)] ${
                    pin === weekIndex ? 'ring-1 ring-white/40' : ''
                  }`}
                  style={{ background: `rgb(${hue} / ${alpha})` }}
                >
                  {faNum(cell.day)}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <p className="mt-3 min-h-5 text-[12px] text-[var(--mk-muted)]" aria-live="polite">
        {readout}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--mk-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--mk-down)]" aria-hidden="true" />
          زیان
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/15" aria-hidden="true" />
          بدون معامله
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--mk-up)]" aria-hidden="true" />
          سود
        </span>
      </div>
    </div>
  );
}
