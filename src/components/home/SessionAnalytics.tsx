'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { browserBacktestServices } from '@/lib/app';
import type { SessionStatus, SessionSummary } from '@/lib/backtest';
import type { BattleSummary } from '@/lib/battles';
import { faNum } from '@/lib/locale/jalali';
import { signedMoney, utcDate } from '../backtest/format';
import { STATUS, battleTitle } from '../battles/format';
import { HOME_ICONS, HomeShell, ShellMenuButton, ShellTools } from './HomeShell';
import { statsHref } from './stats-href';
import { api, type Me } from '../platform/api';
import { Icon } from '../ui/Icon';
import type { IconName } from '../ui/icons';

const AnalyticsDashboard = dynamic(() => import('../backtest/analytics/AnalyticsDashboard'), {
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
  { id: 'trades', label: 'معاملات', href: '/home?tab=trades', icon: 'journal' },
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

/** One session's analytics inside the home shell. This route never mounts the all-sessions overview. */
export function SessionAnalytics({
  user,
  sessionId,
}: {
  readonly user: Me;
  readonly sessionId: string;
}) {
  const params = useParams();
  const router = useRouter();
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
            const on = t.id === 'stats';
            const href = t.id === 'stats' ? statsHref(routeId) : t.href;
            return (
              <Link
                key={t.id}
                href={href}
                role="tab"
                aria-selected={on}
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3dcea0] opacity-60" />
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

        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="session-analytics">
          {list.length > 1 ? (
            <div className="px-4 pt-4 sm:px-8">
              <SessionSwitcher
                sessions={list}
                value={routeId}
                onChange={(id) => router.push(statsHref(id))}
              />
            </div>
          ) : null}
          <AnalyticsDashboard key={routeId} id={routeId} embedded />
        </div>
      </div>
    </HomeShell>
  );
}

const MENU_VARS = [
  '--h-bg',
  '--h-card',
  '--h-line',
  '--h-text',
  '--h-muted',
  '--h-soft',
  '--h-chip',
  '--h-accent',
  '--h-field',
] as const;

const STATUS_META: Record<SessionStatus, { label: string; dot: string; chip: string }> = {
  'in-progress': {
    label: 'در جریان',
    dot: 'bg-[#3dcea0]',
    chip: 'bg-[#3dcea0]/12 text-[#3dcea0]',
  },
  completed: {
    label: 'تمام‌شده',
    dot: 'bg-[var(--h-muted)]',
    chip: 'bg-[var(--h-chip)] text-[var(--h-muted)]',
  },
  failed: {
    label: 'ناموفق',
    dot: 'bg-[#ff6b81]',
    chip: 'bg-[#ff6b81]/12 text-[#ff8b9a]',
  },
};

interface SessionChoice {
  readonly id: string;
  readonly session: SessionSummary | null;
}

function pnlTone(v: number): string {
  if (v > 0.004) return 'text-[#3dcea0]';
  if (v < -0.004) return 'text-[#ff6b81]';
  return 'text-[var(--h-muted)]';
}

function sessionChoices(
  sessions: readonly SessionSummary[],
  value: string,
  query: string,
): SessionChoice[] {
  const q = query.trim().toLocaleLowerCase('fa');
  const matched = q
    ? sessions.filter(
        (s) =>
          s.name.toLocaleLowerCase('fa').includes(q) ||
          s.symbol.toLocaleLowerCase('en').includes(q),
      )
    : sessions;
  const rows = matched.map((session) => ({ id: session.id, session }));
  if (!q && value && !sessions.some((s) => s.id === value)) {
    return [{ id: value, session: null }, ...rows];
  }
  return rows;
}

/** Home tokens live on `.home-shell`. The menu is portalled, so copy them across. */
function menuTheme(anchor: HTMLElement | null): CSSProperties {
  if (!anchor) return {};
  const cs = getComputedStyle(anchor);
  const style: Record<string, string> = {
    color: cs.color,
    fontFamily: cs.fontFamily,
    direction: cs.direction,
    colorScheme: cs.colorScheme,
  };
  for (const key of MENU_VARS) {
    const v = cs.getPropertyValue(key).trim();
    if (v) style[key] = v;
  }
  return style as CSSProperties;
}

function SessionSwitcher({
  sessions,
  value,
  onChange,
}: {
  readonly sessions: readonly SessionSummary[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [theme, setTheme] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const listId = useId();
  const rows = useMemo(() => sessionChoices(sessions, value, query), [sessions, value, query]);
  const current = sessions.find((s) => s.id === value) ?? null;
  const showSearch = sessions.length > 4;
  const optionDomId = (id: string) => `${listId}-${id}`;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const openMenu = useCallback(() => {
    const idx = sessions.findIndex((s) => s.id === value);
    setQuery('');
    setActive(idx < 0 ? 0 : idx);
    setOpen(true);
  }, [sessions, value]);

  const pick = useCallback(
    (id: string) => {
      close();
      if (id !== value) onChange(id);
      buttonRef.current?.focus();
    },
    [close, onChange, value],
  );

  const onKey = (e: ReactKeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, rows.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      buttonRef.current?.focus();
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = buttonRef.current;
    if (anchor) setTheme(menuTheme(anchor));
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;
      const a = button.getBoundingClientRect();
      const width = Math.min(Math.max(a.width, 280), window.innerWidth - 24);
      menu.style.width = `${width}px`;
      const rtl = getComputedStyle(button).direction === 'rtl';
      let left = rtl ? a.right - width : a.left;
      left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
      const height = menu.offsetHeight;
      let top = a.bottom + 8;
      if (top + height > window.innerHeight - 12) {
        const above = a.top - height - 8;
        top = above >= 12 ? above : Math.max(12, window.innerHeight - height - 12);
      }
      setBox((prev) =>
        prev && prev.top === top && prev.left === left && prev.width === width
          ? prev
          : { top, left, width },
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, query, rows.length]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const id = rows[active]?.id;
    if (!id) return;
    menuRef.current
      ?.querySelector(`[data-choice="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active, rows]);

  const activeId = open && rows[active] ? optionDomId(rows[active].id) : undefined;
  const currentPnl = current ? current.balance - current.startingBalance : 0;
  const currentStatus = current ? STATUS_META[current.status] : null;

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="presentation"
            onKeyDown={onKey}
            style={{
              ...theme,
              position: 'fixed',
              top: box?.top ?? -9999,
              left: box?.left ?? 0,
              width: box?.width,
              zIndex: 80,
            }}
            className="animate-pop overflow-hidden rounded-2xl border border-[var(--h-line)] bg-[var(--h-card)] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.85)] motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
              <span className="text-[11px] font-semibold text-[var(--h-muted)]">جلسه‌ها</span>
              <span className="rounded-full bg-[var(--h-chip)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--h-muted)]">
                {faNum(sessions.length)}
              </span>
            </div>
            {showSearch ? (
              <div className="px-2 pb-2">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--h-line)] bg-[var(--h-field)] px-3">
                  <Icon name="search" size={14} className="shrink-0 text-[var(--h-muted)]" />
                  <input
                    ref={searchRef}
                    value={query}
                    aria-label="جستجوی جلسه"
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    autoComplete="off"
                    placeholder="نام جلسه یا نماد"
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    className="h-9 w-full bg-transparent text-[13px] text-[var(--h-text)] outline-none placeholder:text-[var(--h-muted)]"
                  />
                </div>
              </div>
            ) : null}
            <ul
              id={listId}
              role="listbox"
              aria-label="جلسه‌ها"
              className="max-h-80 overflow-y-auto overscroll-contain p-1.5"
            >
              {rows.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-[var(--h-muted)]">
                  جلسه‌ای با این نام پیدا نشد
                </li>
              ) : (
                rows.map((row, i) => (
                  <SessionChoiceRow
                    key={row.id}
                    row={row}
                    selected={row.id === value}
                    highlighted={i === active}
                    optionId={optionDomId(row.id)}
                    onHighlight={() => setActive(i)}
                    onPick={() => pick(row.id)}
                  />
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="w-full max-w-xl" data-testid="session-picker">
      <p id={labelId} className="mb-1.5 text-[12px] font-medium text-[var(--h-muted)]">
        انتخاب جلسه
      </p>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={activeId}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-[var(--h-card)] px-3 py-2.5 text-start shadow-[0_14px_36px_-26px_rgba(0,0,0,0.9)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--h-accent)]/40 ${
          open
            ? 'border-[var(--h-accent)]/50 ring-4 ring-[var(--h-accent)]/15'
            : 'border-[var(--h-line)] hover:border-[var(--h-accent)]/40'
        }`}
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--h-accent)]/12 text-[var(--h-accent)]">
          <Icon name="chart" size={18} />
          {currentStatus ? (
            <span
              className={`absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--h-card)] ${currentStatus.dot}`}
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[var(--h-text)]">
            {current?.name ?? 'این جلسه'}
          </span>
          {current && currentStatus ? (
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-[var(--h-muted)]">
              <bdi dir="ltr" className="font-medium text-[var(--h-text)]">
                {current.symbol}
              </bdi>
              <span
                className={`inline-flex h-5 items-center rounded-full px-1.5 text-[11px] ${currentStatus.chip}`}
              >
                {currentStatus.label}
              </span>
              <span className={`font-semibold tabular-nums ${pnlTone(currentPnl)}`} dir="ltr">
                {signedMoney(currentPnl)}
              </span>
            </span>
          ) : (
            <span className="mt-0.5 block text-[12px] text-[var(--h-muted)]">
              یک جلسهٔ دیگر را انتخاب کنید
            </span>
          )}
        </span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--h-chip)] text-[var(--h-muted)] transition ${
            open ? 'rotate-180 text-[var(--h-text)]' : ''
          }`}
        >
          <Icon name="chevronDown" size={15} />
        </span>
      </button>
      {menu}
    </div>
  );
}

function SessionChoiceRow({
  row,
  selected,
  highlighted,
  optionId,
  onHighlight,
  onPick,
}: {
  readonly row: SessionChoice;
  readonly selected: boolean;
  readonly highlighted: boolean;
  readonly optionId: string;
  readonly onHighlight: () => void;
  readonly onPick: () => void;
}) {
  const session = row.session;
  const status = session ? STATUS_META[session.status] : null;
  const pnl = session ? session.balance - session.startingBalance : 0;
  return (
    <li role="presentation">
      <button
        type="button"
        id={optionId}
        role="option"
        aria-selected={selected}
        data-choice={row.id}
        tabIndex={-1}
        onMouseEnter={onHighlight}
        onClick={onPick}
        className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-start transition ${
          highlighted ? 'ring-1 ring-inset ring-[var(--h-accent)]/35' : ''
        } ${
          selected
            ? 'bg-[var(--h-accent)]/12'
            : highlighted
              ? 'bg-[var(--h-chip)]'
              : 'hover:bg-[var(--h-chip)]'
        }`}
      >
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${status?.dot ?? 'bg-[var(--h-muted)]'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--h-text)]">
              {session?.name ?? 'این جلسه'}
            </span>
            {selected ? (
              <Icon name="check" size={14} className="shrink-0 text-[var(--h-accent)]" />
            ) : null}
          </span>
          {session && status ? (
            <span className="mt-0.5 block truncate text-[11.5px] text-[var(--h-muted)]">
              <bdi dir="ltr" className="font-medium text-[var(--h-text)]">
                {session.symbol}
              </bdi>
              <span aria-hidden="true"> · </span>
              {status.label}
              <span aria-hidden="true"> · </span>
              {faNum(session.trades)} معامله
              <span aria-hidden="true"> · </span>
              <bdi dir="ltr">
                {utcDate(session.startDate)} – {utcDate(session.endDate)}
              </bdi>
            </span>
          ) : (
            <span className="mt-0.5 block text-[11.5px] text-[var(--h-muted)]">جلسهٔ باز</span>
          )}
        </span>
        {session ? (
          <span
            className={`shrink-0 pt-0.5 text-[12px] font-semibold tabular-nums ${pnlTone(pnl)}`}
            dir="ltr"
          >
            {signedMoney(pnl)}
          </span>
        ) : null}
      </button>
    </li>
  );
}
