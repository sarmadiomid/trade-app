'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { RRSimRow } from '@/lib/backtest';
import { faNum, plainPct, pnlClass } from '../format';

/**
 * What-if take-profit curve. The line is total R at each target; the marked peak is the
 * target that maximises it. Chips and the table keep the same numbers without the chart.
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
  const statusId = useId();

  useEffect(() => {
    if (focusTarget.current === null) return;
    const target = focusTarget.current;
    focusTarget.current = null;
    document.querySelector<HTMLElement>(`[data-rr-target="${target}"]`)?.focus();
  }, [picked]);

  if (!rows || !current) {
    return (
      <div className="rr-sim mt-3" aria-busy="true">
        <div className="rr-sim-banner rr-sim-banner-busy">
          <span className="rr-sim-pulse" aria-hidden="true" />
          <div>
            <p className="rr-sim-banner-title">در حال محاسبهٔ منحنی</p>
            <p className="rr-sim-banner-body" role="status" aria-atomic="true">
              معاملات روی دادهٔ یک‌دقیقه‌ای دوباره اجرا می‌شوند
              {progress ? ` — ${progress}` : '…'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const blank = rows.every((r) => r.trades === 0);
  const move = (dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.target === current.target);
    const next = rows[i + dir];
    if (!next) return;
    focusTarget.current = next.target;
    setPicked(next.target);
  };

  const statusText = blank
    ? 'معامله‌ای با حد ضرر اولیه نیست.'
    : ideal?.target === current.target
      ? `هدف ایده‌آل ۱ به ${faNum(current.target)} انتخاب شده؛ مجموع ${faNum(current.totalR, 2)}R.`
      : `هدف ۱ به ${faNum(current.target)} انتخاب شده؛ مجموع ${faNum(current.totalR, 2)}R.`;

  return (
    <div className="rr-sim mt-3 flex flex-col gap-4">
      <InsightBanner ready={ready} ideal={ideal} blank={blank} progress={progress} />

      <p id={statusId} className="sr-only" role="status" aria-atomic="true">
        {statusText}
      </p>

      {blank ? null : (
        <div className="rr-sim-stage">
          <div className="rr-sim-chart-panel">
            <div className="rr-sim-panel-head">
              <div>
                <p className="rr-sim-kicker">منحنی مجموع R</p>
                <p className="rr-sim-panel-title">هر نقطه یک هدف حد سود است</p>
              </div>
              <ul className="rr-sim-legend" aria-hidden="true">
                <li>
                  <span className="rr-sim-swatch rr-sim-swatch-line" />
                  مجموع R
                </li>
                <li>
                  <span className="rr-sim-swatch rr-sim-swatch-dot" />
                  انتخاب‌شده
                </li>
                <li>
                  <span className="rr-sim-swatch rr-sim-swatch-peak" />
                  ایده‌آل
                </li>
              </ul>
            </div>
            <RRCurve
              rows={rows}
              idealTarget={ideal?.target ?? null}
              selected={current.target}
              onPick={setPicked}
            />
          </div>

          <aside className="rr-sim-detail" aria-labelledby={statusId}>
            <div className="rr-sim-detail-head">
              <p className="rr-sim-kicker">هدف انتخاب‌شده</p>
              <div className="rr-sim-target-row">
                <p className="rr-sim-target-value">
                  ۱<span className="rr-sim-target-sep">:</span>
                  {faNum(current.target)}
                </p>
                {ideal?.target === current.target ? (
                  <span className="rr-sim-badge">ایده‌آل</span>
                ) : ideal ? (
                  <button
                    type="button"
                    className="rr-sim-jump"
                    onClick={() => setPicked(ideal.target)}
                  >
                    برو به ایده‌آل ۱:{faNum(ideal.target)}
                  </button>
                ) : null}
              </div>
            </div>
            <dl className="rr-sim-stats">
              <Stat
                label="مجموع R"
                value={`${faNum(current.totalR, 2)}R`}
                tone={pnlClass(current.totalR)}
                emphasize
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
          </aside>
        </div>
      )}

      {blank ? null : (
        <div
          role="radiogroup"
          aria-label="هدف ریسک به ریوارد"
          className="rr-sim-chips"
        >
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
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    const first = rows[0];
                    if (first) {
                      focusTarget.current = first.target;
                      setPicked(first.target);
                    }
                  } else if (e.key === 'End') {
                    e.preventDefault();
                    const last = rows[rows.length - 1];
                    if (last) {
                      focusTarget.current = last.target;
                      setPicked(last.target);
                    }
                  }
                }}
                className={`rr-sim-chip ${on ? 'rr-sim-chip-on' : ''} ${isIdeal ? 'rr-sim-chip-ideal' : ''}`}
              >
                <span className="rr-sim-chip-num">{faNum(r.target)}</span>
                {isIdeal ? <span className="rr-sim-chip-tag">ایده‌آل</span> : null}
              </button>
            );
          })}
        </div>
      )}

      {blank ? null : (
        <RRResultsList
          rows={rows}
          idealTarget={ideal?.target ?? null}
          selected={current.target}
          onPick={setPicked}
        />
      )}
    </div>
  );
}

const RR_COLS = [
  { key: 'target', label: 'هدف' },
  { key: 'trades', label: 'معاملات' },
  { key: 'winRate', label: 'نرخ برد' },
  { key: 'totalR', label: 'مجموع R' },
  { key: 'expectancyR', label: 'امید ریاضی' },
  { key: 'profitFactor', label: 'ضریب سود' },
  { key: 'avgDrawdownR', label: 'میانگین افت' },
] as const;

function RRResultsList({
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
  return (
    <div className="rr-sim-list" role="table" aria-label="نتیجهٔ هر هدف ریسک به ریوارد">
      <div className="rr-sim-list-scroll">
        <div className="rr-sim-list-head" role="row">
          {RR_COLS.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              className={`rr-sim-cell ${col.key === 'target' ? 'rr-sim-cell-target' : 'rr-sim-cell-num'}`}
            >
              {col.label}
            </div>
          ))}
        </div>
        <div className="rr-sim-list-body" role="rowgroup">
          {rows.map((r) => {
            const on = r.target === selected;
            const isIdeal = idealTarget === r.target;
            return (
              <div
                key={r.target}
                role="row"
                tabIndex={0}
                aria-selected={on}
                aria-label={
                  isIdeal
                    ? `هدف ۱ به ${faNum(r.target)}، ایده‌آل`
                    : `هدف ۱ به ${faNum(r.target)}`
                }
                onClick={() => onPick(r.target)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick(r.target);
                  }
                }}
                className={`rr-sim-list-row ${on ? 'is-on' : ''} ${isIdeal ? 'is-ideal' : ''}`}
              >
                <div role="cell" className="rr-sim-cell rr-sim-cell-target">
                  <span className="rr-sim-target-label">۱ : {faNum(r.target)}</span>
                  {isIdeal ? <span className="rr-sim-row-tag">ایده‌آل</span> : null}
                </div>
                <div role="cell" className="rr-sim-cell rr-sim-cell-num">
                  {faNum(r.trades)}
                </div>
                <div role="cell" className="rr-sim-cell rr-sim-cell-num">
                  {plainPct(r.winRate)}
                </div>
                <div role="cell" className={`rr-sim-cell rr-sim-cell-num ${pnlClass(r.totalR)}`}>
                  {faNum(r.totalR, 2)}R
                </div>
                <div role="cell" className="rr-sim-cell rr-sim-cell-num">
                  {faNum(r.expectancyR, 2)}R
                </div>
                <div role="cell" className="rr-sim-cell rr-sim-cell-num">
                  {r.profitFactor === null ? '—' : faNum(r.profitFactor, 2)}
                </div>
                <div role="cell" className="rr-sim-cell rr-sim-cell-num">
                  {faNum(r.avgDrawdownR, 2)}R
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InsightBanner({
  ready,
  ideal,
  blank,
  progress,
}: {
  readonly ready: boolean;
  readonly ideal: RRSimRow | null;
  readonly blank: boolean;
  readonly progress: string;
}) {
  if (!ready) {
    return (
      <div className="rr-sim-banner rr-sim-banner-busy">
        <span className="rr-sim-pulse" aria-hidden="true" />
        <div>
          <p className="rr-sim-banner-title">در حال آماده‌سازی شبیه‌ساز</p>
          <p className="rr-sim-banner-body" role="status" aria-atomic="true">
            {progress ? `پیشرفت ${progress}` : 'معاملات روی دادهٔ یک‌دقیقه‌ای دوباره اجرا می‌شوند…'}
          </p>
        </div>
      </div>
    );
  }
  if (blank || !ideal) {
    return (
      <div className="rr-sim-banner">
        <div>
          <p className="rr-sim-banner-title">هدفی برای مقایسه نیست</p>
          <p className="rr-sim-banner-body">
            معامله‌ای با حد ضرر اولیه نیست؛ بعد از ثبت حد ضرر، منحنی و جدول پر می‌شوند.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rr-sim-banner rr-sim-banner-ideal">
      <div className="rr-sim-banner-metric" aria-hidden="true">
        <span className="rr-sim-banner-metric-label">ایده‌آل</span>
        <span className="rr-sim-banner-metric-value">۱:{faNum(ideal.target)}</span>
      </div>
      <div>
        <p className="rr-sim-banner-title">
          بهترین مجموع R روی هدف ۱ به {faNum(ideal.target)} است
        </p>
        <p className="rr-sim-banner-body">
          مجموع {faNum(ideal.totalR, 2)}R · حد ضرر ثابت می‌ماند و فقط حد سود عوض می‌شود.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = '',
  emphasize = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: string;
  readonly emphasize?: boolean;
}) {
  return (
    <div className={`rr-sim-stat ${emphasize ? 'rr-sim-stat-em' : ''}`}>
      <dt>{label}</dt>
      <dd className={`tabular-nums ${tone}`}>{value}</dd>
      {hint ? <dd className="rr-sim-stat-hint">{hint}</dd> : null}
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
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 228;
  const pad = { l: 48, r: 16, t: 36, b: 32 };
  const values = rows.map((r) => r.totalR);
  const peak = Math.max(...values);
  const trough = Math.min(...values);
  const min = Math.min(0, trough);
  const max = Math.max(0, peak);
  const span = max - min || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.18;
  const x = (i: number) =>
    pad.l + (rows.length < 2 ? 0 : (i / (rows.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const d = rows
    .map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.totalR).toFixed(1)}`)
    .join('');
  const area = `${d}L${x(rows.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
  const ideal = idealTarget === null ? null : rows.find((r) => r.target === idealTarget);
  const idealIndex = ideal ? rows.indexOf(ideal) : -1;
  const activeIndex = useMemo(() => {
    const i = rows.findIndex((r) => r.target === selected);
    return i >= 0 ? i : 0;
  }, [rows, selected]);
  const tipIndex = hover ?? activeIndex;
  const tip = rows[tipIndex]!;

  const nearest = (clientX: number, rect: DOMRect) => {
    const fx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let dist = Infinity;
    rows.forEach((_, i) => {
      const gap = Math.abs(x(i) - fx);
      if (gap < dist) {
        dist = gap;
        best = i;
      }
    });
    return best;
  };

  return (
    <div dir="ltr" className="rr-sim-curve">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="rr-sim-svg"
        role="img"
        aria-label={
          ideal
            ? `منحنی مجموع R. قله روی هدف ۱ به ${faNum(ideal.target)} با ${faNum(ideal.totalR, 2)}R است.`
            : 'منحنی مجموع R برای هدف‌های ریسک به ریوارد'
        }
        onClick={(e) => {
          const row = rows[nearest(e.clientX, e.currentTarget.getBoundingClientRect())];
          if (row) onPick(row.target);
        }}
        onMouseMove={(e) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`rr-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tc-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--tc-accent)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`rr-stroke-${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--tc-accent)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--tc-accent)" stopOpacity="1" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((t) => {
          const v = lo + (hi - lo) * (1 - t);
          const yy = y(v);
          return (
            <line
              key={t}
              x1={pad.l}
              x2={W - pad.r}
              y1={yy}
              y2={yy}
              stroke="var(--tc-border)"
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          );
        })}

        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--tc-border)"
          strokeWidth={1.25}
        />
        <text x={pad.l - 10} y={y(0) + 4} textAnchor="end" fontSize={11} fill="var(--tc-muted)">
          ۰
        </text>
        {peak > 0 ? (
          <text
            x={pad.l - 10}
            y={y(peak) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--tc-muted)"
          >
            {faNum(peak, Math.abs(peak) >= 10 ? 0 : 1)}
          </text>
        ) : null}
        {trough < 0 ? (
          <text
            x={pad.l - 10}
            y={y(trough) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--tc-muted)"
          >
            {faNum(trough, Math.abs(trough) >= 10 ? 0 : 1)}
          </text>
        ) : null}

        <path d={area} fill={`url(#rr-fill-${gid})`} />
        <path
          d={d}
          fill="none"
          stroke={`url(#rr-stroke-${gid})`}
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line
          x1={x(tipIndex)}
          x2={x(tipIndex)}
          y1={pad.t}
          y2={H - pad.b}
          stroke="var(--tc-accent)"
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {rows.map((r, i) => {
          const on = r.target === selected;
          const isIdeal = r.target === idealTarget;
          const label = i === 0 || i === rows.length - 1 || r.target % 2 === 0;
          return (
            <g key={r.target}>
              <circle
                cx={x(i)}
                cy={y(r.totalR)}
                r={on ? 6 : isIdeal ? 5 : 3.25}
                fill={on || isIdeal ? 'var(--tc-accent)' : 'var(--tc-panel)'}
                stroke="var(--tc-accent)"
                strokeWidth={on ? 2.5 : isIdeal ? 2 : 1.5}
              />
              {on ? (
                <circle
                  cx={x(i)}
                  cy={y(r.totalR)}
                  r={10}
                  fill="none"
                  stroke="var(--tc-accent)"
                  strokeOpacity={0.28}
                  strokeWidth={2}
                />
              ) : null}
              {label ? (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--tc-muted)">
                  {faNum(r.target)}
                </text>
              ) : null}
            </g>
          );
        })}

        {ideal && idealIndex >= 0 ? (
          <g>
            <rect
              x={x(idealIndex) - 28}
              y={Math.max(8, y(ideal.totalR) - 28)}
              width={56}
              height={18}
              rx={5}
              fill="var(--tc-accent)"
            />
            <text
              x={x(idealIndex)}
              y={Math.max(21, y(ideal.totalR) - 15)}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill="var(--tc-accent-text)"
            >
              ایده‌آل
            </text>
          </g>
        ) : null}

        <g className="rr-sim-tip" style={{ pointerEvents: 'none' }}>
          <rect
            x={Math.min(W - pad.r - 118, Math.max(pad.l, x(tipIndex) - 52))}
            y={Math.max(8, y(tip.totalR) - (idealIndex === tipIndex ? 52 : 38))}
            width={104}
            height={28}
            rx={8}
            fill="var(--tc-panel)"
            stroke="var(--tc-border)"
          />
          <text
            x={Math.min(W - pad.r - 66, Math.max(pad.l + 52, x(tipIndex)))}
            y={Math.max(26, y(tip.totalR) - (idealIndex === tipIndex ? 34 : 20))}
            textAnchor="middle"
            fontSize={12}
            fontWeight={650}
            fill="var(--tc-text)"
          >
            {`۱:${faNum(tip.target)} · ${faNum(tip.totalR, 2)}R`}
          </text>
        </g>
      </svg>
    </div>
  );
}
