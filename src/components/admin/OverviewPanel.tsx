'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PLAN_LABEL, type PlanId } from '@/lib/app';
import { faNum, formatJalaliDateTime } from '@/lib/locale/jalali';
import { subjectById } from '@/lib/support/catalog';
import { PageHead, Panel, useAdminQuery } from './ui';

interface Overview {
  readonly userCount: number;
  readonly openTickets: number;
  readonly liveBattles: number;
  readonly sessionCount: number;
  readonly symbolCount: number;
  readonly discounts: number;
  readonly redemptions: number;
  readonly plans: Record<PlanId, number>;
  readonly recentUsers: ReadonlyArray<{
    id: string;
    name: string;
    phone: string;
    plan: PlanId;
    createdAt: number;
  }>;
  readonly waiting: ReadonlyArray<{
    id: string;
    number: number;
    title: string;
    subject: string;
    userName: string;
    updatedAt: number;
  }>;
}

/* ------------------------------------------------------------------ */
/* Icons (inline, no extra dependency)                                 */
/* ------------------------------------------------------------------ */

type IconName = 'users' | 'ticket' | 'symbol' | 'session' | 'battle' | 'discount';

const ICON_PATHS: Record<IconName, ReactNode> = {
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.2c1.8.6 3 2.2 3 4.8" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1z" />
      <path d="M14 6v12" strokeDasharray="2 2.4" />
    </>
  ),
  symbol: (
    <>
      <path d="M4 18V9M9 18V5M14 18v-6M19 18V8" />
      <path d="M3 20.5h18" />
    </>
  ),
  session: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  battle: (
    <>
      <path d="M5 4l7 7M19 4l-7 7" />
      <path d="M4 20l5-5M20 20l-5-5" />
      <path d="M3 5l2-2M21 5l-2-2" />
    </>
  ),
  discount: (
    <>
      <path d="M20 12.6 12.6 20a1.6 1.6 0 0 1-2.2 0L3.5 13.1a1.6 1.6 0 0 1-.5-1.2V5a2 2 0 0 1 2-2h6.9c.4 0 .9.2 1.2.5l6.9 6.9a1.6 1.6 0 0 1 0 2.2z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
};

function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function ChevronStart({ className = 'h-4 w-4' }: { className?: string }) {
  // Points toward the inline-end of an RTL layout (visually left).
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.5 6 8.5 12l6 6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

type Tone = 'blue' | 'amber' | 'green' | 'violet' | 'rose' | 'teal';

// Full class strings so Tailwind can detect them statically.
const TONES: Record<Tone, { chip: string; glow: string; bar: string }> = {
  blue: {
    chip: 'bg-[#3b78ff]/12 text-[#7aa2ff] ring-[#3b78ff]/25',
    glow: 'from-[#3b78ff]/14',
    bar: 'bg-[#3b78ff]',
  },
  amber: {
    chip: 'bg-[#f5b544]/12 text-[#f7c46a] ring-[#f5b544]/25',
    glow: 'from-[#f5b544]/14',
    bar: 'bg-[#f5b544]',
  },
  green: {
    chip: 'bg-[#3ecf8e]/12 text-[#6fe0ac] ring-[#3ecf8e]/25',
    glow: 'from-[#3ecf8e]/14',
    bar: 'bg-[#3ecf8e]',
  },
  violet: {
    chip: 'bg-[#9b7bff]/12 text-[#b7a0ff] ring-[#9b7bff]/25',
    glow: 'from-[#9b7bff]/14',
    bar: 'bg-[#9b7bff]',
  },
  rose: {
    chip: 'bg-[#ff6b81]/12 text-[#ff97a7] ring-[#ff6b81]/25',
    glow: 'from-[#ff6b81]/14',
    bar: 'bg-[#ff6b81]',
  },
  teal: {
    chip: 'bg-[#2cc7d0]/12 text-[#6fdde3] ring-[#2cc7d0]/25',
    glow: 'from-[#2cc7d0]/14',
    bar: 'bg-[#2cc7d0]',
  },
};

const CARDS: ReadonlyArray<{
  key: 'userCount' | 'openTickets' | 'symbolCount' | 'sessionCount' | 'liveBattles' | 'discounts';
  label: string;
  href: string;
  icon: IconName;
  tone: Tone;
}> = [
  { key: 'userCount', label: 'کاربران', href: '/admin/users', icon: 'users', tone: 'blue' },
  {
    key: 'openTickets',
    label: 'درخواست باز',
    href: '/admin/support',
    icon: 'ticket',
    tone: 'amber',
  },
  {
    key: 'symbolCount',
    label: 'نماد سفارشی',
    href: '/admin/symbols',
    icon: 'symbol',
    tone: 'teal',
  },
  {
    key: 'sessionCount',
    label: 'جلسه تمرین',
    href: '/admin/sessions',
    icon: 'session',
    tone: 'violet',
  },
  { key: 'liveBattles', label: 'نبرد فعال', href: '/admin/battles', icon: 'battle', tone: 'rose' },
  {
    key: 'discounts',
    label: 'کد تخفیف فعال',
    href: '/admin/discounts',
    icon: 'discount',
    tone: 'green',
  },
];

const PLAN_TONES: ReadonlyArray<Tone> = ['blue', 'violet', 'teal', 'amber', 'green', 'rose'];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b78ff]/60 focus-visible:ring-offset-0';

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function SectionHead({
  title,
  hint,
  href,
  hrefLabel = 'مشاهدهٔ همه',
}: {
  title: string;
  hint?: string | undefined;
  href?: string | undefined;
  hrefLabel?: string | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[14.5px] font-semibold tracking-tight">{title}</h3>
        {hint ? <p className="mt-0.5 text-[12px] text-[var(--a-muted)]">{hint}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className={`group inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-[var(--a-muted)] transition hover:bg-white/5 hover:text-[#9db9ff] ${FOCUS_RING}`}
        >
          {hrefLabel}
          <ChevronStart className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.06] ${className}`} />;
}

function Avatar({ name }: { name: string }) {
  const initial = Array.from(name.trim())[0] ?? '؟';
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3b78ff]/30 to-[#9b7bff]/25 text-[13px] font-semibold text-[#cfdcff] ring-1 ring-white/10"
    >
      {initial}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#3ecf8e]/12 text-[#6fe0ac] ring-1 ring-[#3ecf8e]/25">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <p className="mt-3 text-[13.5px] font-medium">{title}</p>
      {text ? <p className="mt-1 text-[12px] text-[var(--a-muted)]">{text}</p> : null}
    </div>
  );
}

function StatCard({
  card,
  value,
  loading,
}: {
  card: (typeof CARDS)[number];
  value: number | undefined;
  loading: boolean;
}) {
  const tone = TONES[card.tone];
  const showLive = card.key === 'liveBattles' && !loading && (value ?? 0) > 0;
  const showAttention = card.key === 'openTickets' && !loading && (value ?? 0) > 0;

  return (
    <Link href={card.href} className={`group block rounded-2xl ${FOCUS_RING}`}>
      <Panel className="relative h-full overflow-hidden p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[#3b78ff]/50 group-hover:shadow-[0_10px_30px_-12px_rgba(59,120,255,0.35)]">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${tone.glow} to-transparent opacity-70`}
        />
        <div className="relative flex items-start justify-between gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${tone.chip}`}>
            <Icon name={card.icon} />
          </span>
          <span className="flex items-center gap-2">
            {showLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b81]/12 px-2 py-0.5 text-[11px] font-medium text-[#ff97a7] ring-1 ring-[#ff6b81]/25">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b81] opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff6b81]" />
                </span>
                زنده
              </span>
            ) : null}
            {showAttention ? (
              <span className="rounded-full bg-[#f5b544]/12 px-2 py-0.5 text-[11px] font-medium text-[#f7c46a] ring-1 ring-[#f5b544]/25">
                نیازمند پاسخ
              </span>
            ) : null}
            <ChevronStart className="h-4 w-4 text-[var(--a-muted)] opacity-0 transition duration-200 group-hover:-translate-x-0.5 group-hover:opacity-100" />
          </span>
        </div>
        <div className="relative mt-4">
          <p className="text-[12.5px] text-[var(--a-muted)]">{card.label}</p>
          {loading || value === undefined ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1.5 text-[30px] font-bold leading-none tracking-tight tabular-nums">
              {faNum(value)}
            </p>
          )}
        </div>
      </Panel>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function OverviewPanel() {
  const { data, error, loading } = useAdminQuery<Overview>('/api/admin/overview');

  const planKeys = data ? (Object.keys(data.plans) as PlanId[]) : [];
  const planTotal = planKeys.reduce((sum, plan) => sum + (data?.plans[plan] ?? 0), 0);

  return (
    <div>
      <PageHead
        kicker="عملیات"
        title="نمای کلی کندلو"
        text="کاربران، پشتیبانی، نمادها، تمرین، نبرد و تخفیف از همین‌جا اداره می‌شوند. نماد تازه بعد از دادهٔ یک‌دقیقه‌ای در تمرین دیده می‌شود."
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#ff6b81]/30 bg-[#ff6b81]/10 px-3.5 py-3 text-[13px] text-[#ffb3bf]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5h.01" />
          </svg>
          <span>{error}</span>
        </div>
      ) : null}

      {/* KPI cards */}
      <section aria-label="آمار کلی" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <StatCard
            key={card.key}
            card={card}
            value={data ? data[card.key] : undefined}
            loading={loading}
          />
        ))}
      </section>

      {/* Loading skeleton for lower sections */}
      {loading && !data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Panel key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <div className="mt-5 space-y-4">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Plans distribution */}
          <Panel className="p-5">
            <SectionHead
              title="طرح‌ها"
              hint={`${faNum(planTotal)} کاربر در مجموع طرح‌ها`}
              href="/admin/users"
              hrefLabel="کاربران"
            />
            <ul className="mt-5 space-y-4">
              {planKeys.map((plan, index) => {
                const count = data.plans[plan];
                const pct = planTotal > 0 ? (count / planTotal) * 100 : 0;
                const tone = TONES[PLAN_TONES[index % PLAN_TONES.length] ?? 'blue'];
                return (
                  <li key={plan}>
                    <div className="flex items-center justify-between gap-3 text-[13.5px]">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`h-2 w-2 rounded-full ${tone.bar}`} aria-hidden="true" />
                        {PLAN_LABEL[plan]}
                      </span>
                      <span className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-[12px] text-[var(--a-muted)]">
                          {faNum(Math.round(pct))}٪
                        </span>
                        <span className="font-semibold">{faNum(count)}</span>
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(pct)}
                      aria-label={PLAN_LABEL[plan]}
                    >
                      <div
                        className={`h-full rounded-full ${tone.bar} transition-[width] duration-700 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--a-line)] bg-white/[0.03] px-3.5 py-3 text-[13px]">
              <span className="flex items-center gap-2 text-[var(--a-muted)]">
                <Icon name="discount" className="h-4 w-4" />
                استفاده از کد تخفیف
              </span>
              <span className="font-semibold tabular-nums">{faNum(data.redemptions)}</span>
            </div>
          </Panel>

          {/* Waiting tickets */}
          <Panel className="p-5">
            <SectionHead
              title="در انتظار پاسخ"
              hint={
                data.waiting.length > 0
                  ? `${faNum(data.waiting.length)} درخواست منتظر بررسی`
                  : undefined
              }
              href="/admin/support"
              hrefLabel="پشتیبانی"
            />
            {data.waiting.length === 0 ? (
              <EmptyState
                title="درخواست بازی نمانده است"
                text="همهٔ درخواست‌ها پاسخ داده شده‌اند."
              />
            ) : (
              <ul className="-mx-2 mt-3 space-y-0.5">
                {data.waiting.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/admin/support?id=${ticket.id}`}
                      className={`group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.04] ${FOCUS_RING}`}
                    >
                      <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg bg-[#f5b544]/12 px-1.5 text-[12px] font-semibold tabular-nums text-[#f7c46a] ring-1 ring-[#f5b544]/25">
                        {faNum(ticket.number)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">
                          {ticket.title || subjectById(ticket.subject)?.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--a-muted)]">
                          {ticket.userName} · {formatJalaliDateTime(ticket.updatedAt)}
                        </span>
                      </span>
                      <ChevronStart className="h-4 w-4 shrink-0 text-[var(--a-muted)] opacity-0 transition group-hover:-translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Recent signups */}
          <Panel className="p-5 lg:col-span-2">
            <SectionHead
              title="عضویت‌های تازه"
              hint="آخرین کاربرانی که ثبت‌نام کرده‌اند"
              href="/admin/users"
            />
            {data.recentUsers.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[var(--a-muted)]">
                هنوز عضویتی ثبت نشده است.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--a-line)]">
                {data.recentUsers.map((user) => (
                  <li
                    key={user.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:gap-x-4"
                  >
                    <Avatar name={user.name} />
                    <span className="min-w-0 truncate text-[13.5px] font-medium">{user.name}</span>
                    <span
                      dir="ltr"
                      className="col-start-2 row-start-2 truncate text-start font-mono text-[12px] text-[var(--a-muted)] sm:col-start-auto sm:row-start-auto sm:text-end sm:text-[12.5px]"
                    >
                      {user.phone}
                    </span>
                    <span className="justify-self-end rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11.5px] font-medium text-[#b9c6e4] ring-1 ring-white/10 sm:justify-self-start">
                      {PLAN_LABEL[user.plan]}
                    </span>
                    <span className="col-span-3 hidden text-[12px] tabular-nums text-[var(--a-muted)] sm:col-span-1 sm:block sm:text-end">
                      {formatJalaliDateTime(user.createdAt)}
                    </span>
                    <span className="col-start-3 row-start-2 justify-self-end text-[11.5px] tabular-nums text-[var(--a-muted)] sm:hidden">
                      {formatJalaliDateTime(user.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
