'use client';

import { useEffect, useRef, useState } from 'react';
import {
  faDigits,
  faNum,
  gregorianInputToJalali,
  JALALI_MONTHS,
  JALALI_WEEK_SHORT,
  jalaliMonthLength,
  jalaliToGregorianInput,
  jalaliToUtc,
  utcToJalali,
  type JalaliDate,
} from '@/lib/locale/jalali';
import { Icon } from '../ui/Icon';
import { Popover } from '../ui/Popover';

const DAY = 86_400_000;

function clampInput(input: string, min?: string, max?: string): string {
  if (min && input < min) return min;
  if (max && input > max) return max;
  return input;
}

function inRange(input: string, min?: string, max?: string): boolean {
  if (min && input < min) return false;
  if (max && input > max) return false;
  return true;
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const next = m + delta;
  if (next < 1) return { y: y - 1, m: 12 };
  if (next > 12) return { y: y + 1, m: 1 };
  return { y, m: next };
}

function monthIntersects(y: number, m: number, min?: string, max?: string): boolean {
  const last = jalaliToGregorianInput(y, m, jalaliMonthLength(y, m));
  const first = jalaliToGregorianInput(y, m, 1);
  if (min && last < min) return false;
  if (max && first > max) return false;
  return true;
}

function addDays(j: JalaliDate, n: number): JalaliDate {
  return utcToJalali(jalaliToUtc(j.jy, j.jm, j.jd) + n * DAY);
}

function labelOf(j: JalaliDate): string {
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`;
}

/**
 * Persian calendar. The value stays a Gregorian `yyyy-mm-dd` so the session
 * still stores UTC midnights; only the calendar the trader sees is شمسی.
 */
export function JalaliDateField({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  readonly value: string;
  readonly min?: string;
  readonly max?: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
}) {
  const current = gregorianInputToJalali(value) ?? { jy: 1403, jm: 1, jd: 1 };
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [view, setView] = useState({ y: current.jy, m: current.jm });
  const [cursor, setCursor] = useState<JalaliDate>(current);
  const [mode, setMode] = useState<'days' | 'months'>('days');
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) gridRef.current?.focus();
  }, [open, mode]);

  const openCalendar = () => {
    setView({ y: current.jy, m: current.jm });
    setCursor(current);
    setMode('days');
    setOpen(true);
  };

  const commit = (j: JalaliDate) => {
    const input = jalaliToGregorianInput(j.jy, j.jm, j.jd);
    if (!inRange(input, min, max)) return;
    onChange(input);
    setOpen(false);
  };

  const move = (days: number) => {
    const next = gregorianInputToJalali(
      clampInput(jalaliToGregorianInput(cursor.jy, cursor.jm, cursor.jd), min, max),
    );
    const stepped = addDays(next ?? cursor, days);
    const input = clampInput(jalaliToGregorianInput(stepped.jy, stepped.jm, stepped.jd), min, max);
    const j = gregorianInputToJalali(input) ?? cursor;
    setCursor(j);
    setView({ y: j.jy, m: j.jm });
  };

  const prev = shiftMonth(view.y, view.m, -1);
  const next = shiftMonth(view.y, view.m, 1);

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-chart px-2.5 text-[13px] text-fg outline-none focus:border-accent"
      >
        <span>{labelOf(current)}</span>
        <Icon name="calendar" size={15} className="shrink-0 text-muted" />
      </button>
      {open ? (
        <Popover anchor={anchor} onClose={() => setOpen(false)}>
          <div
            ref={gridRef}
            dir="rtl"
            role="dialog"
            aria-label={ariaLabel}
            tabIndex={-1}
            className="w-[17.5rem] outline-none"
            onKeyDown={(e) => {
              if (mode !== 'days') return;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(-1);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                move(7);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                move(-7);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                commit(cursor);
              }
            }}
          >
            {mode === 'days' ? (
              <>
                <div className="mb-2 flex items-center gap-1">
                  <NavButton
                    label="ماه قبل"
                    disabled={!monthIntersects(prev.y, prev.m, min, max)}
                    onClick={() => setView(prev)}
                    flip
                  />
                  <button
                    type="button"
                    className="h-8 flex-1 rounded-md text-[13px] font-semibold hover:bg-hover"
                    onClick={() => setMode('months')}
                  >
                    {JALALI_MONTHS[view.m - 1]} {faDigits(view.y)}
                  </button>
                  <NavButton
                    label="ماه بعد"
                    disabled={!monthIntersects(next.y, next.m, min, max)}
                    onClick={() => setView(next)}
                  />
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {JALALI_WEEK_SHORT.map((d) => (
                    <div key={d} className="py-1 text-[11px] text-muted">
                      {d}
                    </div>
                  ))}
                  <MonthDays
                    view={view}
                    cursor={cursor}
                    selected={current}
                    min={min}
                    max={max}
                    onPick={commit}
                  />
                </div>
              </>
            ) : (
              <MonthPicker
                year={view.y}
                min={min}
                max={max}
                onYear={(y) => setView({ ...view, y })}
                onPick={(m) => {
                  setView({ y: view.y, m });
                  setMode('days');
                }}
              />
            )}
          </div>
        </Popover>
      ) : null}
    </>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  flip = false,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly flip?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
    >
      <Icon name="chevronLeft" size={15} className={flip ? 'rtl:-scale-x-100' : ''} />
    </button>
  );
}

function MonthDays({
  view,
  cursor,
  selected,
  min,
  max,
  onPick,
}: {
  readonly view: { y: number; m: number };
  readonly cursor: JalaliDate;
  readonly selected: JalaliDate;
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly onPick: (j: JalaliDate) => void;
}) {
  const count = jalaliMonthLength(view.y, view.m);
  const lead = (new Date(jalaliToUtc(view.y, view.m, 1)).getUTCDay() + 1) % 7;
  const cells: Array<number | null> = [...Array<null>(lead).fill(null)];
  for (let d = 1; d <= count; d++) cells.push(d);
  return (
    <>
      {cells.map((d, i) => {
        if (d === null) return <span key={`e${i}`} />;
        const input = jalaliToGregorianInput(view.y, view.m, d);
        const enabled = inRange(input, min, max);
        const isSelected = selected.jy === view.y && selected.jm === view.m && selected.jd === d;
        const isCursor = cursor.jy === view.y && cursor.jm === view.m && cursor.jd === d;
        return (
          <button
            key={input}
            type="button"
            disabled={!enabled}
            aria-pressed={isSelected}
            aria-label={`${faNum(d)} ${JALALI_MONTHS[view.m - 1]} ${faDigits(view.y)}`}
            onClick={() => onPick({ jy: view.y, jm: view.m, jd: d })}
            className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] tabular-nums ${
              isSelected
                ? 'bg-accent font-bold text-accent-fg'
                : enabled
                  ? 'hover:bg-hover'
                  : 'text-muted/40'
            } ${isCursor && !isSelected ? 'ring-1 ring-accent' : ''}`}
          >
            {faNum(d)}
          </button>
        );
      })}
    </>
  );
}

function MonthPicker({
  year,
  min,
  max,
  onYear,
  onPick,
}: {
  readonly year: number;
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly onYear: (year: number) => void;
  readonly onPick: (month: number) => void;
}) {
  const minY = min ? (gregorianInputToJalali(min)?.jy ?? year) : year - 20;
  const maxY = max ? (gregorianInputToJalali(max)?.jy ?? year) : year + 1;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <NavButton
          label="سال قبل"
          disabled={year - 1 < minY}
          onClick={() => onYear(year - 1)}
          flip
        />
        <div className="h-8 flex-1 text-center text-[13px] font-semibold leading-8">
          {faDigits(year)}
        </div>
        <NavButton label="سال بعد" disabled={year + 1 > maxY} onClick={() => onYear(year + 1)} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {JALALI_MONTHS.map((name, i) => {
          const m = i + 1;
          const enabled = monthIntersects(year, m, min, max);
          return (
            <button
              key={name}
              type="button"
              disabled={!enabled}
              onClick={() => onPick(m)}
              className="h-9 rounded-md text-[12.5px] hover:bg-hover disabled:text-muted/40"
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
