'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  browserBacktestServices,
  entitlements,
  openPlanPrompt,
  PLAN_LABEL,
  requiresPlan,
} from '@/lib/app';
import type { SessionSummary, SessionType } from '@/lib/backtest';
import type { BattleSummary } from '@/lib/battles';
import { faNum } from '@/lib/locale/jalali';
import { STATUS, battleTitle } from '../battles/format';
import { CreateSessionDialog } from '../backtest/CreateSessionDialog';
import { usePlan } from '../billing/usePlan';
import { PracticeOverview, PracticeSkeleton } from './PracticeOverview';
import { signedMoney } from '../backtest/format';
import { HOME_ICONS, HomeShell, ShellMenuButton, ShellTools } from './HomeShell';
import { SessionsBoard } from './SessionsBoard';
import { journalHref } from './journal-href';
import { statsHref } from './stats-href';

const AnalyticsDashboard = dynamic(() => import('../backtest/analytics/AnalyticsDashboard'), {
  ssr: false,
  loading: () => (
    <p className="px-4 py-8 text-center text-[13px] text-[var(--h-muted)] sm:px-8">
      در حال بارگذاری…
    </p>
  ),
});
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';

const DAY = 86_400_000;
const TEHRAN_MS = 3.5 * 60 * 60 * 1000;

type Tab = 'dashboard' | 'sessions' | 'trades' | 'stats';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: IconName | null; path?: string }> = [
  { id: 'dashboard', label: 'داشبورد', icon: null, path: HOME_ICONS.grid },
  { id: 'sessions', label: 'جلسه‌ها', icon: 'list' },
  { id: 'trades', label: 'معاملات', icon: 'journal' },
  { id: 'stats', label: 'آمار', icon: 'chart' },
];

function tehranDay(ts: number): number {
  return Math.floor((ts + TEHRAN_MS) / DAY);
}

/** Consecutive Tehran days with a session update, still alive through yesterday. */
function practiceStreak(sessions: readonly SessionSummary[], now = Date.now()): number {
  const days = new Set(sessions.map((s) => tehranDay(s.updatedAt)));
  let cursor = tehranDay(now);
  if (!days.has(cursor)) cursor -= 1;
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor -= 1;
  }
  return n;
}

function pnlTone(v: number): string {
  if (v > 0.004) return 'text-[#3dcea0]';
  if (v < -0.004) return 'text-[#ff6b81]';
  return 'text-[var(--h-muted)]';
}

/** `/home`: practice hub. Sidebar, tabs and the two session starters follow the reference layout, in RTL. */
export function HomeDashboard({
  user,
  initialTab = 'dashboard',
  sessionId = null,
}: {
  readonly user: Me;
  readonly initialTab?: Tab;
  readonly sessionId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const routeSession =
    pathname.startsWith('/home/stats/') && typeof params.id === 'string' ? params.id : null;
  const tab = routeSession ? 'stats' : initialTab;
  const statsSession = routeSession ?? sessionId;
  const [creating, setCreating] = useState<SessionType | null>(null);
  const [active, setActive] = useState<BattleSummary | null | 'error'>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null | 'error'>(null);

  const reloadSessions = useCallback(() => {
    void browserBacktestServices()
      .repo.list()
      .then(
        (list) => setSessions([...list].sort((a, b) => b.updatedAt - a.updatedAt)),
        () => setSessions('error'),
      );
  }, []);

  useEffect(() => {
    void api<{ active: BattleSummary | null }>('/api/battles/profile').then(
      (r) => setActive(r.active),
      () => setActive('error'),
    );
    reloadSessions();
  }, [reloadSessions]);

  const list = sessions && sessions !== 'error' ? sessions : [];
  const streak = sessions && sessions !== 'error' ? practiceStreak(list) : 0;
  const battle = active && active !== 'error' ? active : null;
  const notices = (battle ? 1 : 0) + list.filter((s) => s.status === 'in-progress').length;

  const openTab = (id: Tab) => {
    if (id === 'stats') {
      const sid = statsSession ?? list[0]?.id ?? null;
      router.push(sid ? statsHref(sid) : '/home?tab=stats');
      return;
    }
    router.push(id === 'dashboard' ? '/home' : `/home?tab=${id}`);
  };

  const openStats = (id: string) => {
    router.push(statsHref(id));
  };

  return (
    <HomeShell
      user={user}
      notices={notices}
      noticeMenu={
        <>
          {battle ? (
            <Link
              href={`/battle/${battle.id}`}
              className="rounded-lg px-2 py-2 text-[13px] hover:bg-[var(--h-chip)]"
            >
              در نبرد هستید: {battleTitle(battle.name)}
            </Link>
          ) : null}
          {list
            .filter((s) => s.status === 'in-progress')
            .slice(0, 4)
            .map((s) => (
              <Link
                key={s.id}
                href={`/backtest/${s.id}`}
                className="rounded-lg px-2 py-2 text-[13px] hover:bg-[var(--h-chip)]"
              >
                جلسهٔ «{s.name}» هنوز باز است
              </Link>
            ))}
        </>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="px-4 pb-2 pt-4 sm:px-8 sm:pt-5">
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center gap-1.5">
              <ShellMenuButton />
              <h1 className="text-[22px] font-bold leading-none sm:text-[30px]">تمرین</h1>
            </div>
            <div className="ms-auto min-w-0">
              <ShellTools />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] px-3 py-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] sm:px-4 sm:py-2.5">
              <span className="text-[13px] font-semibold sm:text-[14px]">
                {sessions === null ? '…' : faNum(streak)} روز پیاپی
              </span>
              <Icon path={HOME_ICONS.flame} size={18} className="text-[#ff8a3d]" />
            </div>
          </div>
        </header>

        <div
          role="tablist"
          aria-label="بخش تمرین"
          className="flex gap-1 overflow-x-auto px-4 sm:px-8"
        >
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => openTab(t.id)}
                className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-[14px] font-medium transition ${
                  on
                    ? 'border-[var(--h-text)] text-[var(--h-text)]'
                    : 'border-transparent text-[var(--h-muted)] hover:text-[var(--h-text)]'
                }`}
              >
                {t.path ? (
                  <Icon path={t.path} size={15} />
                ) : (
                  <Icon name={t.icon ?? 'list'} size={15} />
                )}
                {t.label}
              </button>
            );
          })}
        </div>

        {battle ? (
          <Link
            href={`/battle/${battle.id}`}
            data-testid="active-battle"
            className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-[#3dcea0]/30 bg-[#3dcea0]/10 px-4 py-2.5 text-[13.5px] sm:mx-8"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3dcea0] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3dcea0]" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              در یک نبرد هستید: {battleTitle(battle.name)}
              <span className="ms-2 text-[12px] text-[var(--h-muted)]">
                {STATUS[battle.status][0]}
              </span>
            </span>
            <span className="font-semibold text-[#3dcea0]">ادامه</span>
          </Link>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {routeSession ? (
            <div data-testid="session-analytics">
              <AnalyticsDashboard key={routeSession} id={routeSession} embedded />
            </div>
          ) : tab === 'dashboard' ? (
            sessions === null ? (
              <PracticeSkeleton />
            ) : sessions === 'error' ? (
              <Note text="خلاصهٔ تمرین بارگذاری نشد." />
            ) : sessions.length === 0 ? (
              <Dashboard onCreate={setCreating} />
            ) : (
              <PracticeOverview
                sessions={sessions}
                onCreate={setCreating}
                onChanged={reloadSessions}
              />
            )
          ) : tab === 'sessions' ? (
            <SessionsBoard
              sessions={sessions}
              onCreate={() => setCreating('backtesting')}
              onChanged={reloadSessions}
            />
          ) : tab === 'trades' ? (
            <TradeList sessions={sessions} />
          ) : (
            <StatsPane sessions={sessions} sessionId={statsSession} onPick={openStats} />
          )}
        </div>
      </div>

      {creating ? (
        <CreateSessionDialog
          key={creating}
          services={browserBacktestServices()}
          defaultType={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => router.push(`/backtest/${id}`)}
        />
      ) : null}
    </HomeShell>
  );
}

function Dashboard({ onCreate }: { readonly onCreate: (type: SessionType) => void }) {
  const propLocked = !entitlements(usePlan()).prop;
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-8">
        <h2 className="text-[32px] font-extrabold leading-tight sm:text-[40px]">
          به تمرین خوش آمدید
        </h2>
        <p className="mt-3 max-w-md text-[15px] leading-8 text-[var(--h-muted)]">
          روش سنجش استراتژی را انتخاب کنید؛ با ساخت داده روی گذشتهٔ بازار، یا با قوانین شرکت‌های
          پراپ.
        </p>
        <div className="mt-8 grid w-full max-w-[560px] gap-3 sm:grid-cols-2">
          <StartCard
            testId="start-backtest"
            primary
            icon="plus"
            title="جلسه بک‌تست"
            text="داده بسازید و استراتژی را دقیق‌تر کنید"
            hint="بازپخش کندل‌به‌کندل روی گذشتهٔ بازار، با حساب مجازی."
            onClick={() => onCreate('backtesting')}
          />
          <StartCard
            testId="start-prop"
            icon={propLocked ? 'lock' : 'shield'}
            title="جلسه پراپ"
            text="استراتژی را با قوانین پراپ بسنجید"
            hint="هدف سود، سقف ضرر روزانه و سقف ضرر کلی؛ مثل چالش شرکت‌های پراپ."
            badge={propLocked ? `ارتقا به ${PLAN_LABEL.mid}` : undefined}
            onClick={() =>
              propLocked ? openPlanPrompt(requiresPlan('جلسه پراپ', 'mid')) : onCreate('prop')
            }
          />
        </div>
      </div>

      <div className="px-4 pb-2 sm:px-8">
        <p className="mb-3 text-center text-[15px] text-[var(--h-muted)]">از اینجا شروع کنید</p>
        <div
          className="home-preview mx-auto h-[240px] max-w-5xl overflow-hidden"
          aria-hidden="true"
        >
          <StartPreview />
        </div>
      </div>
    </div>
  );
}

function StartCard({
  testId,
  primary = false,
  icon,
  title,
  text,
  hint,
  badge,
  onClick,
}: {
  readonly testId: string;
  readonly primary?: boolean;
  readonly icon: IconName;
  readonly title: string;
  readonly text: string;
  readonly hint: string;
  readonly badge?: string | undefined;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={badge ? `${title}، ${badge}` : undefined}
      onClick={onClick}
      className={`rounded-xl border bg-[var(--h-card)] p-4 text-start transition ${
        badge
          ? 'border-[var(--h-line)] hover:border-[var(--h-accent)]/45'
          : `hover:-translate-y-0.5 ${
              primary ? 'neon-blink' : 'border-[var(--h-line)] hover:border-[var(--h-accent)]/50'
            }`
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            badge
              ? 'border-[var(--h-accent)]/40 text-[var(--h-accent)]'
              : primary
                ? 'border-[#3d6dff]/70 text-[#8eb6ff]'
                : 'border-[var(--h-line)] text-[var(--h-muted)]'
          }`}
        >
          <Icon name={icon} size={16} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-bold">
            {title}
            {badge ? <UpgradeBadge label={badge} /> : null}
            <span title={hint} className="text-[var(--h-muted)]">
              <Icon name="info" size={14} />
            </span>
          </span>
          <span className="mt-1 block text-[12.5px] leading-6 text-[var(--h-muted)]">{text}</span>
        </span>
      </span>
    </button>
  );
}

function UpgradeBadge({ label }: { readonly label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--h-accent)_16%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--h-accent)]">
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <label className="block text-start">
      <span className="text-[12px] text-[var(--h-muted)]">
        {label}
        {required ? <span className="text-[#ff6b81]"> *</span> : null}
      </span>
      <span className="mt-1 flex h-10 items-center justify-between rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-3 text-[13px]">
        <span>{value}</span>
        <Icon name="chevronDown" size={14} className="text-[var(--h-muted)]" />
      </span>
    </label>
  );
}

/** Faded picture of the session form, the way the next step looks. Not interactive. */
function StartPreview() {
  return (
    <div className="grid items-start gap-3 md:grid-cols-[190px_minmax(0,1fr)_210px]">
      <section className="hidden rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-4 md:block">
        <h3 className="text-[13px] font-semibold">عملکرد</h3>
        <p className="mt-3 text-[11px] text-[var(--h-muted)]">زمان صرف‌شده</p>
        <p className="mt-1 text-[18px] font-bold">—</p>
        <p className="mt-4 text-[11px] text-[var(--h-muted)]">معاملات</p>
        <p className="mt-1 text-[18px] font-bold">—</p>
      </section>

      <section className="rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold">جلسه بک‌تست</h3>
            <p className="text-[12px] text-[var(--h-muted)]">شروع جلسه</p>
          </div>
          <span className="rounded-md bg-[var(--h-accent)]/15 px-2 py-1 text-[11px] font-semibold text-[#9cc0ff]">
            طلا / دلار
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="نماد" value="XAUUSD" required />
          <Field label="موجودی شروع" value="۱۰۰٬۰۰۰ $" />
          <Field label="تاریخ شروع" value="۱ فروردین ۱۴۰۳" />
          <Field label="تاریخ پایان" value="۳۱ فروردین ۱۴۰۳" />
        </div>
      </section>

      <div className="hidden flex-col gap-3 md:flex">
        <section className="rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-3">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <span>بازپخش</span>
            <span className="h-5 w-9 rounded-full bg-[var(--h-accent)] p-0.5">
              <span className="block h-4 w-4 rounded-full bg-white" />
            </span>
          </div>
          <svg viewBox="0 0 180 64" className="h-16 w-full" aria-hidden="true">
            <path
              d="M0 48 L18 44 L32 50 L48 36 L64 40 L80 28 L96 32 L112 18 L128 24 L146 12 L164 16 L180 8"
              fill="none"
              stroke="#5b8cff"
              strokeWidth="2"
            />
            <path
              d="M0 52 L22 50 L40 46 L60 48 L80 40 L100 42 L120 34 L140 36 L160 28 L180 30"
              fill="none"
              stroke="#ff6b81"
              strokeWidth="1.6"
              opacity="0.8"
            />
          </svg>
        </section>
        <section className="rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] p-3 text-[12px]">
          <Row k="اسپرد" v="خاموش" />
          <Row k="کارمزد" v="خاموش" />
          <Row k="هدف سود پراپ" v="۱۰٪" />
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[var(--h-muted)]">
      <span>{k}</span>
      <span className="text-[var(--h-text)]">{v}</span>
    </div>
  );
}

function Panel({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">{children}</div>;
}

function TradeList({ sessions }: { readonly sessions: SessionSummary[] | null | 'error' }) {
  if (sessions === null) return <Skeleton />;
  if (sessions === 'error') return <Note text="معاملات بارگذاری نشد." />;
  const withTrades = sessions.filter((s) => s.trades > 0);
  if (withTrades.length === 0) {
    return <Note text="هنوز معامله‌ای ثبت نشده. یک جلسه بسازید و روی نمودار وارد بازار شوید." />;
  }
  const total = withTrades.reduce((n, s) => n + s.trades, 0);
  return (
    <Panel>
      <h2 className="mb-3 text-[15px] font-semibold">
        معاملات <span className="text-[var(--h-muted)]">· {faNum(total)}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {withTrades.map((s) => {
          const pnl = s.balance - s.startingBalance;
          return (
            <li key={s.id}>
              <div className="flex items-center gap-3 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] px-4 py-3 transition hover:border-[var(--h-accent)]/40">
                <Link href={journalHref(s.id)} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{s.name}</span>
                  <span className="text-[12px] text-[var(--h-muted)]">
                    <bdi dir="ltr">{s.symbol}</bdi>
                    {' · '}
                    {faNum(s.trades)} معامله
                  </span>
                </Link>
                <Link
                  href={`/backtest/${s.id}`}
                  className="shrink-0 text-[12px] font-medium text-[var(--h-accent)]"
                >
                  نمودار
                </Link>
                <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${pnlTone(pnl)}`}>
                  {signedMoney(pnl)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function StatsPane({
  sessions,
  sessionId,
  onPick,
}: {
  readonly sessions: SessionSummary[] | null | 'error';
  readonly sessionId: string | null;
  readonly onPick: (id: string) => void;
}) {
  if (sessionId) {
    const choices = sessions && sessions !== 'error' ? sessions : [];
    return (
      <div>
        {choices.length > 1 ? (
          <div className="px-4 pt-4 sm:px-8">
            <label className="inline-flex items-center gap-2 text-[13px] text-[var(--h-muted)]">
              جلسه
              <select
                aria-label="جلسه"
                className="h-9 rounded-lg border border-[var(--h-line)] bg-[var(--h-field)] px-2 text-[13px] text-[var(--h-text)]"
                value={sessionId}
                onChange={(e) => onPick(e.target.value)}
              >
                {choices.some((s) => s.id === sessionId) ? null : (
                  <option value={sessionId}>این جلسه</option>
                )}
                {choices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <AnalyticsDashboard id={sessionId} embedded />
      </div>
    );
  }
  if (sessions === null) return <Skeleton />;
  if (sessions === 'error') return <Note text="آمار بارگذاری نشد." />;
  if (sessions.length === 0) {
    return <Note text="هنوز جلسه‌ای نیست. از داشبورد یک جلسه بسازید تا آمارش این‌جا بیاید." />;
  }
  return (
    <Panel>
      <h2 className="mb-3 text-[15px] font-semibold">یک جلسه را انتخاب کنید</h2>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s.id)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--h-line)] bg-[var(--h-card)] px-4 py-3 text-start transition hover:border-[var(--h-accent)]/40"
            >
              <span className="min-w-0 truncate text-[14px] font-semibold">{s.name}</span>
              <bdi dir="ltr" className="shrink-0 text-[12px] text-[var(--h-muted)]">
                {s.symbol}
              </bdi>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Skeleton() {
  return (
    <Panel>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--h-chip)]" />
        ))}
      </div>
    </Panel>
  );
}

function Note({
  text,
  action,
  onAction,
}: {
  readonly text: string;
  readonly action?: string;
  readonly onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <p className="max-w-sm text-[14px] leading-7 text-[var(--h-muted)]">{text}</p>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--h-accent)] px-3 text-[13px] font-semibold text-white"
        >
          <Icon name="plus" size={15} />
          {action}
        </button>
      ) : null}
    </div>
  );
}
