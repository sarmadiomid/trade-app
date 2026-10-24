'use client';

import { useEffect, useRef, useState } from 'react';
import type { RRSimRow } from '@/lib/backtest';
import { faNum, plainPct, pnlClass } from '../format';

/**
 * What-if take-profit curve. The line is total R at each target; the marked peak is the
 * target that maximises it. A chip group and the table carry the same numbers without the chart.
 */
export function RRSimulator({
  rows,
  ideal,
  ready,
  progress,
}: {
  readonly rows: readonly RRSimRow[] | null;
  readonly ideal: RRSimRow | null;
  readonly ready: boolean;
  readonly progress: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const focusTarget = useRef<number | null>(null);
  const current = rows?.find((r) => r.target === picked) ?? ideal ?? rows?.[0] ?? null;

  useEffect(() => {
    if (focusTarget.current === null) return;
    const target = focusTarget.current;
    focusTarget.current = null;
    document.querySelector<HTMLElement>(`[data-rr-target="${target}"]`)?.focus();
  }, [picked]);

  if (!rows || !current) {
    return <p className="an-note">در حال محاسبه{progress ? ` ${progress}` : '…'}</p>;
  }

  const blank = rows.every((r) => r.trades === 0);
  const move = (dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.target === current.target);
    const next = rows[i + dir];
    if (!next) return;
    focusTarget.current = next.target;
    setPicked(next.target);
  };

  return (
    <div className="mt-3 flex flex-col gap-4">
      <p className="an-note">
        {ready
          ? ideal
            ? `هدف ایده‌آل ۱ به ${faNum(ideal.target)} است و مجموع ${faNum(ideal.totalR, 2)}R می‌سازد. حد ضرر همان می‌ماند و فقط حد سود عوض می‌شود.`
            : 'معامله‌ای با حد ضرر اولیه نیست، پس هدفی برای مقایسه ساخته نشد.'
          : `معاملات روی دادهٔ یک‌دقیقه‌ای دوباره اجرا می‌شوند — در حال محاسبه ${progress}`}
      </p>

      {blank ? null : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.7fr)]">
          <div>
            <p className="an-label mb-2">مجموع R برای هر هدف</p>
            <RRCurve
              rows={rows}
              idealTarget={ideal?.target ?? null}
              selected={current.target}
              onPick={setPicked}
            />
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-accent" />
                مجموع R
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border-2 border-accent" />
                هدف انتخاب‌شده
              </span>
              <span>برچسب «ایده‌آل» روی قلهٔ منحنی است.</span>
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-chart p-4">
            <p className="text-[12px] text-muted">هدف انتخاب‌شده</p>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-[26px] font-bold tabular-nums">
                ۱ : {faNum(current.target)}
              </span>
              {ideal?.target === current.target ? (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                  ایده‌آل
                </span>
              ) : null}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
              <Stat
                label="مجموع R"
                value={`${faNum(current.totalR, 2)}R`}
                tone={pnlClass(current.totalR)}
              />
              <Stat
                label="نرخ برد"
                value={plainPct(current.winRate)}
                hint={`${faNum(current.wins)} سود از ${faNum(current.trades)}`}
              />
              <Stat label="امید ریاضی" value={`${faNum(current.expectancyR, 2)}R`} />
              <Stat
                label="ضریب سود"
                value={current.profitFactor === null ? '—' : faNum(current.profitFactor, 2)}
              />
              <Stat label="میانگین افت سودده‌ها" value={`${faNum(current.avgDrawdownR, 2)}R`} />
              <Stat label="ضررها" value={faNum(current.losses)} />
            </dl>
          </div>
        </div>
      )}

      {blank ? null : (
        <div role="radiogroup" aria-label="هدف ریسک به ریوارد" className="flex flex-wrap gap-1.5">
          {rows.map((r) => {
            const on = r.target === current.target;
            const isIdeal = ideal?.target === r.target;
            return (
              <button
                key={r.target}
                type="button"
                role="radio"
                data-rr-target={r.target}
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                aria-label={
                  isIdeal ? `هدف ۱ به ${faNum(r.target)}، ایده‌آل` : `هدف ۱ به ${faNum(r.target)}`
                }
                onClick={() => setPicked(r.target)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(1);
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    move(-1);
                  }
                }}
                className={`inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-[12.5px] tabular-nums transition-colors duration-200 motion-reduce:transition-none ${
                  on
                    ? 'border-accent bg-accent font-semibold text-accent-fg'
                    : 'border-line text-fg hover:bg-hover'
                }`}
              >
                {faNum(r.target)}
                {isIdeal ? (
                  <span className={`text-[10px] font-semibold ${on ? '' : 'text-accent'}`}>
                    ایده‌آل
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {blank ? null : (
        <div className="overflow-x-auto">
          <table className="an-table w-full min-w-[640px]">
            <caption className="sr-only">
              نتیجهٔ هر هدف ریسک به ریوارد. ردیف ایده‌آل بیشترین مجموع R را دارد.
            </caption>
            <thead>
              <tr className="text-muted">
                {[
                  'هدف',
                  'معاملات',
                  'نرخ برد',
                  'مجموع R',
                  'امید ریاضی',
                  'ضریب سود',
                  'میانگین افت سودده‌ها',
                ].map((h) => (
                  <th key={h} className="text-end font-medium first:text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.target === current.target;
                const isIdeal = ideal?.target === r.target;
                return (
                  <tr
                    key={r.target}
                    aria-selected={on}
                    onClick={() => setPicked(r.target)}
                    className={`cursor-pointer tabular-nums ${isIdeal ? 'an-ideal font-semibold' : ''} ${
                      on && !isIdeal ? 'bg-accent/10' : ''
                    }`}
                  >
                    <td>
                      ۱ : {faNum(r.target)}
                      {isIdeal ? ' · ایده‌آل' : ''}
                      {on && !isIdeal ? ' · انتخاب‌شده' : ''}
                    </td>
                    <td className="text-end">{faNum(r.trades)}</td>
                    <td className="text-end">{plainPct(r.winRate)}</td>
                    <td className={`text-end ${pnlClass(r.totalR)}`}>{faNum(r.totalR, 2)}R</td>
                    <td className="text-end">{faNum(r.expectancyR, 2)}R</td>
                    <td className="text-end">
                      {r.profitFactor === null ? '—' : faNum(r.profitFactor, 2)}
                    </td>
                    <td className="text-end">{faNum(r.avgDrawdownR, 2)}R</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = '',
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: string;
}) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[15px] font-semibold tabular-nums ${tone}`}>{value}</dd>
      {hint ? <dd className="text-[11px] text-muted">{hint}</dd> : null}
    </div>
  );
}

function RRCurve({
  rows,
  idealTarget,
  selected,
  onPick,
}: {
  readonly rows: readonly RRSimRow[];
  readonly idealTarget: number | null;
  readonly selected: number;
  readonly onPick: (target: number) => void;
}) {
  const W = 640;
  const H = 210;
  const pad = { l: 44, r: 12, t: 28, b: 28 };
  const values = rows.map((r) => r.totalR);
  const peak = Math.max(...values);
  const trough = Math.min(...values);
  const min = Math.min(0, trough);
  const max = Math.max(0, peak);
  const span = max - min || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.16;
  const x = (i: number) =>
    pad.l + (rows.length < 2 ? 0 : (i / (rows.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const d = rows
    .map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.totalR).toFixed(1)}`)
    .join('');
  const area = `${d}L${x(rows.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const ideal = idealTarget === null ? null : rows.find((r) => r.target === idealTarget);
  const idealIndex = ideal ? rows.indexOf(ideal) : -1;

  return (
    <div dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-pointer"
        role="img"
        aria-label={
          ideal
            ? `منحنی مجموع R. قله روی هدف ۱ به ${faNum(ideal.target)} با ${faNum(ideal.totalR, 2)}R است.`
            : 'منحنی مجموع R برای هدف‌های ریسک به ریوارد'
        }
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fx = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let dist = Infinity;
          rows.forEach((_, i) => {
            const gap = Math.abs(x(i) - fx);
            if (gap < dist) {
              dist = gap;
              best = i;
            }
          });
          const row = rows[best];
          if (row) onPick(row.target);
        }}
      >
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--tc-border)"
          strokeWidth={1}
        />
      <text x={pad.l - 8} y={y(0) + 4} textAnchor="end" fontSize={11} fill="var(--tc-muted)">
        ۰
      </text>
      {peak > 0 ? (
        <text x={pad.l - 8} y={y(peak) + 4} textAnchor="end" fontSize={11} fill="var(--tc-muted)">
          {faNum(peak, Math.abs(peak) >= 10 ? 0 : 1)}
        </text>
      ) : null}
      {trough < 0 ? (
        <text x={pad.l - 8} y={y(trough) + 4} textAnchor="end" fontSize={11} fill="var(--tc-muted)">
          {faNum(trough, Math.abs(trough) >= 10 ? 0 : 1)}
        </text>
      ) : null}
        <path d={area} fill="var(--tc-accent)" opacity={0.14} />
        <path d={d} fill="none" stroke="var(--tc-accent)" strokeWidth={2} strokeLinejoin="round" />
        {rows.map((r, i) => {
          const on = r.target === selected;
          const isIdeal = r.target === idealTarget;
          const label = i === 0 || r.target % 2 === 0;
          return (
            <g key={r.target}>
              <circle
                cx={x(i)}
                cy={y(r.totalR)}
                r={on ? 5 : 3}
                fill={on || isIdeal ? 'var(--tc-accent)' : 'var(--tc-panel)'}
                stroke="var(--tc-accent)"
                strokeWidth={on ? 2.5 : 1.5}
              />
              {label ? (
                <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--tc-muted)">
                  {faNum(r.target)}
                </text>
              ) : null}
            </g>
          );
        })}
        {ideal && idealIndex >= 0 ? (
          <text
            x={x(idealIndex)}
            y={Math.max(14, y(ideal.totalR) - 12)}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="var(--tc-accent)"
          >
            ایده‌آل
          </text>
        ) : null}
      </svg>
    </div>
  );
}
