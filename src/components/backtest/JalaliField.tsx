'use client';

import { useMemo } from 'react';
import {
  faDigits,
  faNum,
  gregorianInputToJalali,
  jalaliMonthLength,
  jalaliToGregorianInput,
  JALALI_MONTHS,
  type JalaliDate,
} from '@/lib/locale/jalali';

const select =
  'h-9 rounded-md border border-line bg-chart px-2 text-[13px] text-fg outline-none focus:border-accent';

function yearsBetween(min: string | undefined, max: string | undefined, current: number): number[] {
  const a = min ? gregorianInputToJalali(min) : null;
  const b = max ? gregorianInputToJalali(max) : null;
  const from = Math.min(a?.jy ?? current - 2, current);
  const to = Math.max(b?.jy ?? current + 1, current);
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

/**
 * Jalali day / month / year. The value stays a Gregorian `yyyy-mm-dd` so the session
 * still stores UTC midnights. The clock of the session is UTC; only the calendar is شمسی.
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
  const years = useMemo(
    () => yearsBetween(min, max, current.jy),
    [min, max, current.jy],
  );
  const days = jalaliMonthLength(current.jy, current.jm);
  const commit = (next: JalaliDate) => {
    const jd = Math.min(next.jd, jalaliMonthLength(next.jy, next.jm));
    let input = jalaliToGregorianInput(next.jy, next.jm, jd);
    if (min && input < min) input = min;
    if (max && input > max) input = max;
    onChange(input);
  };
  return (
    <div className="grid grid-cols-[4.5rem_1fr_5.5rem] gap-1.5" role="group" aria-label={ariaLabel}>
      <select
        aria-label={`${ariaLabel}، روز`}
        className={select}
        value={Math.min(current.jd, days)}
        onChange={(e) => commit({ ...current, jd: Number(e.target.value) })}
      >
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {faNum(d)}
          </option>
        ))}
      </select>
      <select
        aria-label={`${ariaLabel}، ماه`}
        className={select}
        value={current.jm}
        onChange={(e) => commit({ ...current, jm: Number(e.target.value) })}
      >
        {JALALI_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${ariaLabel}، سال`}
        className={select}
        value={current.jy}
        onChange={(e) => commit({ ...current, jy: Number(e.target.value) })}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {faDigits(y)}
          </option>
        ))}
      </select>
    </div>
  );
}
