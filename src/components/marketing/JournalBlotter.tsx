'use client';

import { useState } from 'react';
import { faNum } from '@/lib/locale/jalali';

type Side = 'buy' | 'sell';
type Status = 'open' | 'win' | 'loss';

interface Row {
  readonly id: string;
  readonly when: string;
  readonly asset: string;
  readonly side: Side;
  readonly size: string;
  readonly entry: string;
  readonly pnl: number | null;
  readonly r: number | null;
  readonly status: Status;
  readonly age: number;
}

const ROWS: readonly Row[] = [
  {
    id: 'open',
    when: '۱۲ مارس ۱۴:۱۵',
    asset: 'XAUUSD',
    side: 'buy',
    size: '0.40',
    entry: '2341.20',
    pnl: null,
    r: null,
    status: 'open',
    age: 0,
  },
  {
    id: 'w1',
    when: '۱۱ مارس ۱۶:۴۱',
    asset: 'XAUUSD',
    side: 'buy',
    size: '0.30',
    entry: '2328.50',
    pnl: 124,
    r: 1.9,
    status: 'win',
    age: 1,
  },
  {
    id: 'l1',
    when: '۴ مارس ۰۹:۰۵',
    asset: 'EURUSD',
    side: 'sell',
    size: '0.20',
    entry: '1.08420',
    pnl: -48.2,
    r: -0.76,
    status: 'loss',
    age: 8,
  },
  {
    id: 'w2',
    when: '۱۸ فوریه ۲۱:۱۲',
    asset: 'GBPUSD',
    side: 'buy',
    size: '0.10',
    entry: '1.26340',
    pnl: 41.6,
    r: 1.22,
    status: 'win',
    age: 22,
  },
  {
    id: 'l2',
    when: '۲۰ ژانویه ۱۱:۰۲',
    asset: 'NAS100',
    side: 'sell',
    size: '0.50',
    entry: '21440.0',
    pnl: -92.5,
    r: -1,
    status: 'loss',
    age: 51,
  },
];

const RANGES = [
  { id: '7', label: '۷ روز', days: 7 },
  { id: '30', label: '۳۰ روز', days: 30 },
  { id: 'all', label: 'همه', days: Number.POSITIVE_INFINITY },
] as const;

type RangeId = (typeof RANGES)[number]['id'];

const SIDE: Record<Side, string> = { buy: 'خرید', sell: 'فروش' };
const STATUS: Record<Status, string> = { open: 'باز', win: 'سود', loss: 'زیان' };

function money(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${faNum(Math.abs(n), 2)}`;
}

function StatusPill({ status }: { readonly status: Status }) {
  const tone =
    status === 'win'
      ? 'border-[color-mix(in_srgb,var(--mk-up)_35%,transparent)] bg-[color-mix(in_srgb,var(--mk-up)_12%,transparent)] text-[var(--mk-up)]'
      : status === 'loss'
        ? 'border-[color-mix(in_srgb,var(--mk-down)_35%,transparent)] bg-[color-mix(in_srgb,var(--mk-down)_12%,transparent)] text-[var(--mk-down)]'
        : 'border-[var(--mk-line)] bg-white/[0.04] text-[var(--mk-muted)]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {status === 'open' ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-up)]" aria-hidden="true" />
      ) : null}
      {STATUS[status]}
    </span>
  );
}

/** Sample session blotter. The open row stays lit; closed rows show profit or loss. */
export function JournalBlotter() {
  const [range, setRange] = useState<RangeId>('all');
  const days = RANGES.find((item) => item.id === range)?.days ?? Number.POSITIVE_INFINITY;
  const shown = ROWS.filter((row) => row.age <= days);

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--mk-line)] bg-[var(--mk-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold text-[var(--mk-text)]">دفتر معاملات</h3>
          <span className="text-[11px] text-[var(--mk-faint)]">نمونه</span>
          <span className="text-[12px] text-[var(--mk-faint)]">{faNum(shown.length)} معامله</span>
        </div>
        <div role="radiogroup" aria-label="بازه دفتر" className="flex rounded-full bg-white/[0.04] p-1">
          {RANGES.map((item) => {
            const on = item.id === range;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRange(item.id)}
                className={`h-8 cursor-pointer rounded-full px-3 text-[12px] font-semibold transition-colors duration-200 ${
                  on ? 'bg-white/[0.1] text-[var(--mk-text)]' : 'text-[var(--mk-faint)] hover:text-[var(--mk-text)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <ul>
        {shown.map((row) => {
          const sideColor = row.side === 'buy' ? 'var(--mk-up)' : 'var(--mk-down)';
          const open = row.status === 'open';
          return (
            <li
              key={row.id}
              className={`grid grid-cols-2 items-center gap-2 border-t border-[var(--mk-line)] px-4 py-3 md:grid-cols-[108px_minmax(0,1fr)_64px_64px_88px_72px_72px] md:gap-3 ${
                open ? 'bg-[color-mix(in_srgb,var(--mk-up)_8%,transparent)]' : ''
              }`}
            >
              <span className="text-[12px] text-[var(--mk-faint)]" dir="ltr">
                {row.when}
              </span>
              <span className="font-mono text-[13px] font-semibold" dir="ltr">
                {row.asset}
              </span>
              <span>
                <span
                  className="inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    color: sideColor,
                    background: `color-mix(in srgb, ${sideColor} 14%, transparent)`,
                  }}
                >
                  {SIDE[row.side]}
                </span>
              </span>
              <span className="font-mono text-[12px]" dir="ltr">
                {row.size}
              </span>
              <span className="font-mono text-[12px]" dir="ltr">
                {row.entry}
              </span>
              <span
                className="font-mono text-[12px] font-semibold"
                dir="ltr"
                style={{
                  color: open ? 'var(--mk-faint)' : (row.pnl ?? 0) < 0 ? 'var(--mk-down)' : 'var(--mk-up)',
                }}
              >
                {open || row.pnl === null ? '—' : `${money(row.pnl)} $`}
              </span>
              <StatusPill status={row.status} />
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-[var(--mk-muted)]">در این بازه معامله‌ای نیست.</p>
      ) : null}
    </div>
  );
}
