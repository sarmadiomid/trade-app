'use client';

import { useState } from 'react';
import { PLAN_LABEL, type PlanId } from '@/lib/app';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { ApiError, api } from '@/components/platform/api';
import { Notice, PageHead, Panel, fieldClass, useAdminQuery } from './ui';

interface TransactionRow {
  readonly id: string;
  readonly userId: string;
  readonly userName: string;
  readonly phone: string;
  readonly userPlan: PlanId;
  readonly planId: 'mid' | 'pro';
  readonly cycle: 'month' | 'year';
  readonly gateway: 'zarinpal' | 'sep';
  readonly status: 'pending' | 'paid' | 'canceled' | 'failed';
  readonly amount: number;
  readonly subtotal: number;
  readonly discount: number;
  readonly code: string;
  readonly authority: string;
  readonly refId: string | null;
  readonly cardPan: string | null;
  readonly failureMessage: string | null;
  readonly discountError: string | null;
  readonly createdAt: number;
  readonly paidAt: number | null;
  readonly mismatch: boolean;
}

type StatusFilter = '' | 'paid' | 'pending' | 'failed' | 'canceled';

const STATUS_LABEL: Record<TransactionRow['status'], string> = {
  paid: 'پرداخت‌شده',
  pending: 'در انتظار',
  failed: 'ناموفق',
  canceled: 'لغو',
};

const STATUS_STYLE: Record<TransactionRow['status'], string> = {
  paid: 'border-[#3dcea0]/30 bg-[#3dcea0]/10 text-[#8ef0cf]',
  pending: 'border-[#f5b544]/30 bg-[#f5b544]/10 text-[#f7c46a]',
  failed: 'border-[#ff6b81]/30 bg-[#ff6b81]/10 text-[#ffb3bf]',
  canceled: 'border-white/10 bg-white/[0.05] text-[#b9c6e4]',
};

const PLAN_STYLE: Record<string, string> = {
  beginner: 'border-[#2cc7d0]/30 bg-[#2cc7d0]/10 text-[#8be6ea]',
  mid: 'border-[#3b78ff]/35 bg-[#3b78ff]/12 text-[#9db9ff]',
  pro: 'border-[#9b7bff]/35 bg-[#9b7bff]/12 text-[#c0adff]',
};

const GATEWAY_LABEL: Record<TransactionRow['gateway'], string> = {
  zarinpal: 'زرین‌پال',
  sep: 'سپ',
};

const CYCLE_LABEL: Record<TransactionRow['cycle'], string> = {
  month: 'ماهانه',
  year: 'سالانه',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b78ff]/60';

function SvgIcon({
  children,
  className = 'h-4 w-4',
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const SearchIcon = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.8-3.8" />
  </SvgIcon>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </SvgIcon>
);

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

function Pill({
  className,
  children,
}: {
  readonly className: string;
  readonly children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function Amount({ value }: { readonly value: number }) {
  return (
    <span className="tabular-nums">
      {faNum(value)} <span className="text-[11.5px] text-[var(--a-muted)]">تومان</span>
    </span>
  );
}

export function TransactionsDesk() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [busy, setBusy] = useState('');
  const [flash, setFlash] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (status && !mismatchOnly) params.set('status', status);
  if (mismatchOnly) params.set('mismatch', '1');
  const url = `/api/admin/transactions${params.size ? `?${params}` : ''}`;

  const { data, error, loading, reload } = useAdminQuery<{
    transactions: TransactionRow[];
    mismatchCount: number;
  }>(url);

  const applyPlan = async (row: TransactionRow) => {
    setBusy(row.id);
    setFlash(null);
    try {
      await api(`/api/admin/users/${row.userId}/plan`, {
        method: 'POST',
        body: { plan: row.planId },
      });
      setFlash({
        text: `طرح ${row.userName || row.phone || 'کاربر'} به ${PLAN_LABEL[row.planId]} تغییر کرد.`,
        tone: 'ok',
      });
      await reload();
    } catch (e) {
      setFlash({
        text: e instanceof ApiError ? e.message : 'اعمال طرح انجام نشد',
        tone: 'bad',
      });
    } finally {
      setBusy('');
    }
  };

  const clearSearch = () => {
    setQ('');
    setQuery('');
  };

  const rows = data?.transactions ?? [];
  const showSkeleton = loading && !data;

  return (
    <div>
      <PageHead
        kicker="پرداخت"
        title="تراکنش‌ها"
        text="فهرست چک‌اوت‌ها با طرح فعلی کاربر. اگر کسی پرداخت موفق دارد ولی هنوز مبتدی است، اینجا مشخص می‌شود و می‌توانید طرح را اعمال کنید."
      />

      <form
        role="search"
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <div className="relative min-w-0 flex-1 basis-[14rem]">
          <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--a-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="شماره، نام، رسید یا شناسه"
            aria-label="جستجوی تراکنش"
            className={`${fieldClass} !ps-10 !pe-10`}
          />
          {q ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="پاک کردن جستجو"
              className={`absolute end-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--a-muted)] transition hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <select
          value={status}
          disabled={mismatchOnly}
          aria-label="وضعیت پرداخت"
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={`${fieldClass} w-auto min-w-[8.5rem] shrink-0`}
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="paid">پرداخت‌شده</option>
          <option value="pending">در انتظار</option>
          <option value="failed">ناموفق</option>
          <option value="canceled">لغو</option>
        </select>
        <button
          type="button"
          aria-pressed={mismatchOnly}
          onClick={() => setMismatchOnly((v) => !v)}
          className={`inline-flex h-11 shrink-0 items-center rounded-xl border px-4 text-[13px] font-semibold transition ${FOCUS_RING} ${
            mismatchOnly
              ? 'border-[#ff6b81]/40 bg-[#ff6b81]/15 text-[#ffb3bf]'
              : 'border-white/10 bg-white/[0.03] text-[var(--a-muted)] hover:border-white/20 hover:text-white'
          }`}
        >
          فقط ناهماهنگ
        </button>
        <button
          type="submit"
          className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--a-accent)] px-5 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(59,120,255,0.8)] transition hover:brightness-110 active:scale-[0.98] ${FOCUS_RING}`}
        >
          {loading ? <Spinner /> : null}
          جستجو
        </button>
      </form>

      <div className="mb-3 flex min-h-7 flex-wrap items-center gap-2 text-[12.5px] text-[var(--a-muted)]">
        {data ? (
          <>
            <span>
              <span className="font-semibold tabular-nums text-white/90">{faNum(rows.length)}</span>{' '}
              تراکنش
            </span>
            {data.mismatchCount > 0 ? (
              <span className="rounded-full border border-[#ff6b81]/30 bg-[#ff6b81]/10 px-2.5 py-0.5 text-[12px] text-[#ffb3bf]">
                {faNum(data.mismatchCount)} ناهماهنگ در این فهرست
              </span>
            ) : null}
          </>
        ) : null}
        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            className={`inline-flex items-center gap-1.5 rounded-full border border-[#3b78ff]/30 bg-[#3b78ff]/10 py-0.5 ps-2.5 pe-1.5 text-[12px] text-[#9db9ff] transition hover:bg-[#3b78ff]/20 ${FOCUS_RING}`}
          >
            «{query}»
            <CloseIcon className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {flash ? (
        <div className="mb-3" role="status" aria-live="polite">
          <Notice tone={flash.tone}>{flash.text}</Notice>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-[#ff6b81]/30 bg-[#ff6b81]/10 px-3.5 py-3 text-[13px] text-[#ffb3bf]"
        >
          {error}
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-right text-[13px]">
            <thead className="border-b border-[var(--a-line)] bg-white/[0.03] text-[12px] text-[var(--a-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  کاربر
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  وضعیت
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  خرید
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  طرح فعلی
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  مبلغ
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  درگاه / رسید
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  زمان
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  اقدام
                </th>
              </tr>
            </thead>
            <tbody>
              {showSkeleton
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="border-t border-[var(--a-line)]">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-8 animate-pulse rounded-md bg-white/[0.06]" />
                      </td>
                    </tr>
                  ))
                : null}
              {!showSkeleton && rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--a-muted)]">
                    {mismatchOnly
                      ? 'تراکنش ناهماهنگی پیدا نشد.'
                      : query
                        ? 'نتیجه‌ای برای این جستجو نیست.'
                        : 'هنوز تراکنشی ثبت نشده است.'}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-[var(--a-line)] ${
                    row.mismatch ? 'bg-[#ff6b81]/[0.04]' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-medium">
                        {row.userName || <span className="text-[var(--a-muted)]">بدون نام</span>}
                      </div>
                      <div
                        dir="ltr"
                        className="truncate text-end font-mono text-[12px] text-[var(--a-muted)]"
                      >
                        {row.phone || '—'}
                      </div>
                      {row.mismatch ? (
                        <p className="mt-1 text-[11.5px] text-[#ffb3bf]">
                          پرداخت موفق، طرح هنوز {PLAN_LABEL[row.userPlan]}
                        </p>
                      ) : null}
                      {row.failureMessage ? (
                        <p className="mt-1 max-w-[16rem] truncate text-[11.5px] text-[#ffb3bf]">
                          {row.failureMessage}
                        </p>
                      ) : null}
                      {row.discountError ? (
                        <p className="mt-1 max-w-[16rem] truncate text-[11.5px] text-[#f7c46a]">
                          تخفیف: {row.discountError}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={STATUS_STYLE[row.status]}>{STATUS_LABEL[row.status]}</Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill className={PLAN_STYLE[row.planId] ?? ''}>{PLAN_LABEL[row.planId]}</Pill>
                      <span className="text-[12px] text-[var(--a-muted)]">
                        {CYCLE_LABEL[row.cycle]}
                      </span>
                    </div>
                    {row.code ? (
                      <div dir="ltr" className="mt-1 font-mono text-[11.5px] text-[var(--a-muted)]">
                        {row.code}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Pill className={PLAN_STYLE[row.userPlan] ?? ''}>
                      {PLAN_LABEL[row.userPlan]}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Amount value={row.amount} />
                    {row.discount > 0 ? (
                      <div className="mt-1 text-[11.5px] text-[var(--a-muted)]">
                        تخفیف {faNum(row.discount)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{GATEWAY_LABEL[row.gateway]}</div>
                    <div
                      dir="ltr"
                      className="mt-1 max-w-[11rem] truncate text-end font-mono text-[11.5px] text-[var(--a-muted)]"
                      title={row.refId ?? row.authority}
                    >
                      {row.refId || row.authority}
                    </div>
                    {row.cardPan ? (
                      <div
                        dir="ltr"
                        className="mt-0.5 text-end font-mono text-[11px] text-[var(--a-muted)]"
                      >
                        {row.cardPan}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[var(--a-muted)]">
                    {formatJalaliDateTime(row.paidAt ?? row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {row.mismatch ? (
                      <button
                        type="button"
                        disabled={busy === row.id}
                        onClick={() => void applyPlan(row)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#3dcea0]/35 bg-[#3dcea0]/12 px-3 text-[12.5px] font-semibold text-[#8ef0cf] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`}
                      >
                        {busy === row.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                        اعمال {PLAN_LABEL[row.planId]}
                      </button>
                    ) : (
                      <span className="text-[12px] text-[var(--a-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
