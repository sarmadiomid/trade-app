'use client';

import { useState } from 'react';
import { PLAN_LABEL, type PlanId } from '@/lib/app';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { ApiError, api } from '@/components/platform/api';
import { Notice, PageHead, Panel, fieldClass, useAdminQuery } from './ui';

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly plan: PlanId;
  readonly createdAt: number;
  readonly lastLoginAt: number;
  readonly sessions: number;
  readonly battles: number;
}

interface Flash {
  readonly text: string;
  readonly tone: 'ok' | 'bad';
}

const PLANS: PlanId[] = ['beginner', 'mid', 'pro'];

// Full class strings so Tailwind can detect them statically.
const PLAN_STYLE: Record<string, string> = {
  beginner: 'border-[#2cc7d0]/30 bg-[#2cc7d0]/10 text-[#8be6ea]',
  mid: 'border-[#3b78ff]/35 bg-[#3b78ff]/12 text-[#9db9ff]',
  pro: 'border-[#9b7bff]/35 bg-[#9b7bff]/12 text-[#c0adff]',
};
const PLAN_FALLBACK = 'border-white/10 bg-white/[0.05] text-[#b9c6e4]';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b78ff]/60';

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

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

const ChevronDown = ({ className }: { className?: string }) => (
  <SvgIcon className={className}>
    <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
  </SvgIcon>
);

const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.06] ${className}`} />;
}

function Avatar({ name, phone }: { name: string; phone: string }) {
  const initial = Array.from((name || phone).trim())[0] ?? '؟';
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3b78ff]/30 to-[#9b7bff]/25 text-[13.5px] font-semibold text-[#cfdcff] ring-1 ring-white/10"
    >
      {initial}
    </span>
  );
}

function UserIdentity({ user }: { user: UserRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={user.name} phone={user.phone} />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-medium">
          {user.name || <span className="text-[var(--a-muted)]">بدون نام</span>}
        </div>
        <div dir="ltr" className="truncate text-end font-mono text-[12px] text-[var(--a-muted)]">
          {user.phone}
        </div>
      </div>
    </div>
  );
}

function PlanSelect({
  user,
  busy,
  onChange,
}: {
  user: UserRow;
  busy: boolean;
  onChange: (plan: PlanId) => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={user.plan}
        disabled={busy}
        aria-label={`طرح ${user.name || user.phone}`}
        onChange={(e) => onChange(e.target.value as PlanId)}
        className={`h-9 min-w-[7.5rem] cursor-pointer appearance-none rounded-full border ps-3.5 pe-9 text-[12.5px] font-medium transition hover:brightness-125 disabled:cursor-wait disabled:opacity-60 ${
          PLAN_STYLE[user.plan] ?? PLAN_FALLBACK
        } ${FOCUS_RING}`}
      >
        {PLANS.map((plan) => (
          <option key={plan} value={plan} className="bg-[#0c1018] text-white">
            {PLAN_LABEL[plan]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-2.5 flex items-center opacity-80">
        {busy ? <Spinner className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--a-line)] bg-white/[0.03] px-3 py-2">
      <div className="text-[11.5px] text-[var(--a-muted)]">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums">{faNum(value)}</div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.05] text-[var(--a-muted)] ring-1 ring-white/10">
        <SearchIcon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[14px] font-medium">کاربری پیدا نشد.</p>
      <p className="mt-1 max-w-xs text-[12.5px] leading-6 text-[var(--a-muted)]">
        {query
          ? `برای «${query}» نتیجه‌ای نیست. شماره یا نام را کامل‌تر یا کوتاه‌تر امتحان کنید.`
          : 'هنوز کاربری ثبت نشده است.'}
      </p>
    </div>
  );
}

function LastLogin({ at }: { at: number }) {
  return at ? <>{formatJalaliDateTime(at)}</> : <span>—</span>;
}

/* ------------------------------------------------------------------ */
/* Desk                                                                */
/* ------------------------------------------------------------------ */

export function UsersDesk() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useAdminQuery<{ users: UserRow[] }>(
    `/api/admin/users?q=${encodeURIComponent(query)}`,
  );
  const [flash, setFlash] = useState<Flash | null>(null);
  const [busy, setBusy] = useState('');

  const changePlan = async (user: UserRow, plan: PlanId) => {
    if (plan === user.plan) return;
    setBusy(user.id);
    setFlash(null);
    try {
      await api(`/api/admin/users/${user.id}/plan`, { method: 'POST', body: { plan } });
      setFlash({
        text: `طرح ${user.name || user.phone} به ${PLAN_LABEL[plan]} تغییر کرد.`,
        tone: 'ok',
      });
      await reload();
    } catch (e) {
      setFlash({
        text: e instanceof ApiError ? e.message : 'تغییر طرح انجام نشد',
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

  const users = data?.users ?? [];
  const showSkeleton = loading && !data;

  return (
    <div>
      <PageHead
        kicker="حساب‌ها"
        title="کاربران"
        text="جستجو با شماره یا نام، و تغییر طرح اشتراک. سقف جلسه و نبرد از روی طرح تازه محاسبه می‌شود."
      />

      <form
        role="search"
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--a-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="شماره یا نام"
            aria-label="جستجوی کاربر"
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
          <span>
            <span className="font-semibold tabular-nums text-white/90">{faNum(users.length)}</span>{' '}
            کاربر
          </span>
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
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-right text-[13px]">
            <thead className="border-b border-[var(--a-line)] bg-white/[0.03] text-[12px] text-[var(--a-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  کاربر
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  طرح
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  تمرین
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  نبرد
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  آخرین ورود
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--a-line)]">
              {showSkeleton ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 !rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-9 w-28 !rounded-full" />
                    </td>
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-4 w-32" />
                    </td>
                  </tr>
                ))
              ) : users.length ? (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors hover:bg-white/[0.03] ${
                      busy === user.id ? 'bg-[#3b78ff]/[0.05]' : ''
                    } ${loading ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <UserIdentity user={user} />
                    </td>
                    <td className="px-4 py-3">
                      <PlanSelect
                        user={user}
                        busy={busy === user.id}
                        onChange={(plan) => void changePlan(user, plan)}
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{faNum(user.sessions)}</td>
                    <td className="px-4 py-3 tabular-nums">{faNum(user.battles)}</td>
                    <td className="px-4 py-3 text-[var(--a-muted)]">
                      <LastLogin at={user.lastLoginAt} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <EmptyState query={query} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-[var(--a-line)] md:hidden">
          {showSkeleton ? (
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 !rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-12 w-full !rounded-xl" />
              </li>
            ))
          ) : users.length ? (
            users.map((user) => (
              <li
                key={user.id}
                className={`space-y-3 p-4 ${busy === user.id ? 'bg-[#3b78ff]/[0.05]' : ''} ${
                  loading ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <UserIdentity user={user} />
                  <PlanSelect
                    user={user}
                    busy={busy === user.id}
                    onChange={(plan) => void changePlan(user, plan)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="تمرین" value={user.sessions} />
                  <Metric label="نبرد" value={user.battles} />
                </div>
                <p className="text-[12px] text-[var(--a-muted)]">
                  آخرین ورود: <LastLogin at={user.lastLoginAt} />
                </p>
              </li>
            ))
          ) : (
            <li>
              <EmptyState query={query} />
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
