'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { browserBacktestServices } from '@/lib/app';
import type { SessionSummary } from '@/lib/backtest';
import type { BattleSummary } from '@/lib/battles';
import { faNum } from '@/lib/locale/jalali';
import { STATUS, battleTitle } from '../battles/format';
import { HOME_ICONS, HomeShell, ShellMenuButton, ShellTools } from './HomeShell';
import { journalHref } from './journal-href';
import { statsHref } from './stats-href';
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';

const JournalView = dynamic(() => import('../backtest/JournalView'), {
  ssr: false,
  loading: () => (
    <p className="px-4 py-8 text-center text-[13px] text-[var(--h-muted)] sm:px-8">
      در حال بارگذاری…
    </p>
  ),
});

const DAY = 86_400_000;
const TEHRAN_MS = 3.5 * 60 * 60 * 1000;

const TABS: ReadonlyArray<{
  id: string;
  label: string;
  href: string;
  icon: IconName | null;
  path?: string;
}> = [
  { id: 'dashboard', label: 'داشبورد', href: '/home', icon: null, path: HOME_ICONS.grid },
  { id: 'sessions', label: 'جلسه‌ها', href: '/home?tab=sessions', icon: 'list' },
  { id: 'trades', label: 'معاملات', href: '', icon: 'journal' },
  { id: 'stats', label: 'آمار', href: '', icon: 'chart' },
];

function tehranDay(ts: number): number {
  return Math.floor((ts + TEHRAN_MS) / DAY);
}

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

/** One session's trade journal inside the home shell. */
export function SessionJournal({
  user,
  sessionId,
}: {
  readonly user: Me;
  readonly sessionId: string;
}) {
  const params = useParams();
  const routeId = typeof params.id === 'string' && params.id ? params.id : sessionId;
  const [active, setActive] = useState<BattleSummary | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);

  const reloadSessions = useCallback(() => {
    void browserBacktestServices()
      .repo.list()
      .then(
        (list) => setSessions([...list].sort((a, b) => b.updatedAt - a.updatedAt)),
        () => setSessions([]),
      );
  }, []);

  useEffect(() => {
    void api<{ active: BattleSummary | null }>('/api/battles/profile').then(
      (r) => setActive(r.active),
      () => setActive(null),
    );
    reloadSessions();
  }, [reloadSessions]);

  const list = sessions ?? [];
  const streak = sessions ? practiceStreak(list) : 0;
  const notices = (active ? 1 : 0) + list.filter((s) => s.status === 'in-progress').length;

  return (
    <HomeShell
      user={user}
      notices={notices}
      noticeMenu={
        <>
          {active ? (
            <Link
              href={`/battle/${active.id}`}
              className="rounded-lg px-2 py-2 text-[13px] hover:bg-[var(--h-chip)]"
            >
              در نبرد هستید: {battleTitle(active.name)}
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="session-journal">
        <header className="flex flex-wrap items-start justify-between gap-4 px-4 pb-2 pt-5 sm:px-8">
          <div className="flex items-center gap-2">
            <ShellMenuButton />
            <h1 className="text-[26px] font-bold sm:text-[30px]">تمرین</h1>
          </div>

          <div className="flex flex-col items-end gap-3">
            <ShellTools />
            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] px-4 py-2.5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)]">
              <span className="text-[14px] font-semibold">
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
            const on = t.id === 'trades';
            const href =
              t.id === 'trades'
                ? journalHref(routeId)
                : t.id === 'stats'
                  ? statsHref(routeId)
                  : t.href;
            return (
              <Link
                key={t.id}
                href={href}
                role="tab"
                aria-selected={on}
                className={`inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-[14px] font-medium transition-colors duration-200 motion-reduce:transition-none ${
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
              </Link>
            );
          })}
        </div>

        {active ? (
          <Link
            href={`/battle/${active.id}`}
            data-testid="active-battle"
            className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-[#3dcea0]/30 bg-[#3dcea0]/10 px-4 py-2.5 text-[13.5px] sm:mx-8"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3dcea0] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3dcea0]" />
            </span>
            <span className="min-w-0 flex-1 truncate">
              در یک نبرد هستید: {battleTitle(active.name)}
              <span className="ms-2 text-[12px] text-[var(--h-muted)]">
                {STATUS[active.status][0]}
              </span>
            </span>
            <span className="font-semibold text-[#3dcea0]">ادامه</span>
          </Link>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <JournalView key={routeId} id={routeId} sessions={list} />
        </div>
      </div>
    </HomeShell>
  );
}
